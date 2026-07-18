"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import { markWritingDraftRoutePersisted } from "@/lib/writing/fresh-route";
import { USER_PROBLEMS_RPC_QUERY_KEY_ROOT } from "@/lib/practice/problem-list-query-key";
import { createSupabaseBrowserClient } from "../supabase/browser";
import {
  createComparisonReportAction,
  createComparisonReportWithViewAction,
  submitWritingAction,
  type SubmitWritingActionResult,
  type CreateComparisonReportInput,
  type SubmitWritingInput,
  type SubmitWritingResult,
} from "./server-actions";
import type { ComparisonReportViewModel } from "./comparison-report-view-model";
import type {
  ClientSubmissionIntent,
  SubmissionIntentPersistence,
} from "./client-recovery";
import { draftQueryKey } from "./queries";
import type { WritingDraftInsert, WritingDraftRow } from "./types";
import {
  classifySubmitWritingError,
  toSubmitWritingErrorMessage,
} from "./submit-errors";

type BrowserClient = ReturnType<typeof createSupabaseBrowserClient>;
type ClientFactory = () => BrowserClient;
type SubmitWritingAction = (
  input: SubmitWritingInput,
) => Promise<SubmitWritingActionResult>;

export async function upsertDraft(
  input: WritingDraftInsert,
  createClient: ClientFactory = createSupabaseBrowserClient,
  now: () => string = () => new Date().toISOString(),
): Promise<WritingDraftRow> {
  const supabase = createClient();
  const expectedLastSavedAt = input.last_saved_at ?? null;
  const persistedInput: WritingDraftInsert = {
    ...input,
    autosave_status: "clean",
    last_saved_at: now(),
  };

  // `writing_drafts_active_unique` is a partial unique index
  // `(user_id, problem_id) where autosave_status <> 'superseded'`.
  // PostgREST upsert cannot target that predicate, so autosave has to resolve
  // the active draft explicitly instead of using `onConflict`.
  const activeDraftId = await findActiveDraftId(supabase, persistedInput);
  if (activeDraftId) {
    const updated = await updateActiveDraft(
      supabase,
      activeDraftId,
      persistedInput,
      expectedLastSavedAt,
    );
    if (updated) return updated;
    throw new Error("writing_draft_revision_conflict");
  }

  const inserted = await insertDraft(supabase, persistedInput);
  if (inserted.error && isUniqueViolation(inserted.error)) {
    const racedDraftId = await findActiveDraftId(supabase, persistedInput);
    if (racedDraftId) {
      const updated = await updateActiveDraft(
        supabase,
        racedDraftId,
        persistedInput,
        expectedLastSavedAt,
      );
      if (updated) return updated;
      throw new Error("writing_draft_revision_conflict");
    }
  }
  if (inserted.error) throw inserted.error;
  if (!inserted.data) throw new Error("upsertDraft: empty row");
  return inserted.data;
}

async function findActiveDraftId(
  supabase: BrowserClient,
  input: Pick<WritingDraftInsert, "user_id" | "problem_id">,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("writing_drafts")
    .select("id")
    .eq("user_id", input.user_id)
    .eq("problem_id", input.problem_id)
    .neq("autosave_status", "superseded")
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

async function updateActiveDraft(
  supabase: BrowserClient,
  draftId: string,
  input: WritingDraftInsert,
  expectedLastSavedAt: string | null,
): Promise<WritingDraftRow | null> {
  const update = supabase
    .from("writing_drafts")
    .update(input)
    .eq("id", draftId);
  const guardedUpdate = expectedLastSavedAt
    ? update.eq("last_saved_at", expectedLastSavedAt)
    : update.is("last_saved_at", null);
  const { data, error } = await guardedUpdate
    .neq("autosave_status", "superseded")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

function insertDraft(supabase: BrowserClient, input: WritingDraftInsert) {
  return supabase.from("writing_drafts").insert(input).select("*").single();
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

export function useUpsertDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WritingDraftInsert) => upsertDraft(input),
    onSuccess: (_data, variables) => {
      markWritingDraftRoutePersisted();
      void Promise.all([
        qc.invalidateQueries({
          queryKey: draftQueryKey(variables.user_id, variables.problem_id),
        }),
        qc.invalidateQueries({
          queryKey: USER_PROBLEMS_RPC_QUERY_KEY_ROOT,
        }),
      ]).catch(() => undefined);
    },
  });
}

// Phase 6 R-DEAD-INVALIDATE: previously this mutation invalidated submission /
// feedback bundle / feedback status keys keyed by the newly-minted submissionId.
// Those keys have no mounted query at the time of invalidation (the caller
// navigates to /feedback/[id] right after, and that page mounts fresh), so the
// invalidations were dead. Drop them.
export function useSubmitWriting(
  action: SubmitWritingAction = submitWritingAction,
  options: {
    createFingerprint?: (input: SubmitWritingInput) => Promise<string>;
    createIntentId?: () => string;
    intentPersistence?: SubmissionIntentPersistence;
    now?: () => string;
  } = {},
) {
  const volatileIntentRef = useRef<ClientSubmissionIntent | null>(null);
  const intentResolutionRef = useRef<Promise<void>>(Promise.resolve());
  const submissionOperationsRef = useRef(
    new Map<string, Promise<SubmitWritingResult>>(),
  );
  const volatilePersistence: SubmissionIntentPersistence = {
    async clear(intentId) {
      if (volatileIntentRef.current?.intentId === intentId) {
        volatileIntentRef.current = null;
      }
    },
    async find(fingerprint) {
      return volatileIntentRef.current?.fingerprint === fingerprint
        ? volatileIntentRef.current
        : null;
    },
    async markAmbiguous(intentId) {
      if (volatileIntentRef.current?.intentId === intentId) {
        volatileIntentRef.current = {
          ...volatileIntentRef.current,
          state: "ambiguous",
        };
      }
    },
    async persist(intent) {
      volatileIntentRef.current = intent;
    },
  };
  const persistence = options.intentPersistence ?? volatilePersistence;
  const createFingerprint =
    options.createFingerprint ?? createWritingSubmissionFingerprint;
  const createIntentId =
    options.createIntentId ?? (() => globalThis.crypto.randomUUID());
  const now = options.now ?? (() => new Date().toISOString());

  function resolveIntent(fingerprint: string) {
    const operation = intentResolutionRef.current.then(async () => {
      const existing = await persistence.find(fingerprint);
      if (existing) return existing;
      const intent: ClientSubmissionIntent = {
        createdAt: now(),
        fingerprint,
        intentId: createIntentId(),
        state: "pending",
      };
      await persistence.persist(intent);
      return intent;
    });
    intentResolutionRef.current = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  return useMutation<SubmitWritingResult, Error, SubmitWritingInput>({
    mutationFn: async (input) => {
      let fingerprint: string;
      try {
        fingerprint = await createFingerprint(input);
      } catch {
        throw new Error(toSubmitWritingErrorMessage("preflight_failed"));
      }
      const existingOperation =
        submissionOperationsRef.current.get(fingerprint);
      if (existingOperation) return existingOperation;

      const operation = (async () => {
        let intent: ClientSubmissionIntent;
        try {
          intent = await resolveIntent(fingerprint);
        } catch {
          throw new Error(toSubmitWritingErrorMessage("preflight_failed"));
        }
        try {
          const result = await submitWriting(
            { ...input, submission_intent_id: intent.intentId },
            action,
          );
          try {
            await persistence.clear(intent.intentId);
          } catch {
            // The durable server result is authoritative. A stale local intent
            // is safe to reuse because the server deduplicates the payload.
          }
          return result;
        } catch (error) {
          try {
            if (
              error instanceof Error &&
              classifySubmitWritingError(error.message) ===
                "submission_ambiguous"
            ) {
              await persistence.markAmbiguous(intent.intentId);
            } else {
              await persistence.clear(intent.intentId);
            }
          } catch {
            // Keep the original, already-sanitized submit result for the UI.
          }
          throw new Error(
            toSubmitWritingErrorMessage(
              error instanceof Error ? error.message : "submit_failed",
            ),
          );
        }
      })();
      submissionOperationsRef.current.set(fingerprint, operation);
      try {
        return await operation;
      } finally {
        if (submissionOperationsRef.current.get(fingerprint) === operation) {
          submissionOperationsRef.current.delete(fingerprint);
        }
      }
    },
  });
}

function canonicalFingerprintValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalFingerprintValue);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalFingerprintValue(child)]),
    );
  }
  throw new Error("writing_submission_fingerprint_invalid");
}

export async function createWritingSubmissionFingerprint(
  input: SubmitWritingInput,
): Promise<string> {
  const canonical = JSON.stringify(
    canonicalFingerprintValue({
      draft_id: input.draft_id ?? null,
      parent_submission_id: input.parent_submission_id ?? null,
      problem_id: input.problem_id,
      question_no: input.question_no,
      answer_text: input.answer_text,
      answer_json: input.answer_json ?? null,
      char_count: input.char_count,
      canonical_question_id: input.canonical_question_id ?? null,
      canonical_import_id: input.canonical_import_id ?? null,
      canonical_payload_hash: input.canonical_payload_hash ?? null,
    }),
  );
  if (!globalThis.crypto?.subtle) {
    throw new Error("writing_submission_fingerprint_unavailable");
  }
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function submitWriting(
  input: SubmitWritingInput,
  action: SubmitWritingAction = submitWritingAction,
): Promise<SubmitWritingResult> {
  try {
    const result = await action(input);
    if ("rejection" in result) {
      throw new Error(result.rejection.message);
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(toSubmitWritingErrorMessage(message));
  }
}

export function useCreateComparisonReport() {
  return useMutation<{ reportId: string }, Error, CreateComparisonReportInput>({
    mutationFn: (input) => createComparisonReportAction(input),
  });
}

export function useCreateComparisonReportWithView() {
  return useMutation<
    { reportId: string; viewModel: ComparisonReportViewModel },
    Error,
    CreateComparisonReportInput
  >({
    mutationFn: (input) => createComparisonReportWithViewAction(input),
  });
}
