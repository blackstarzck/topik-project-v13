"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "../supabase/browser";
import {
  createComparisonReportAction,
  submitWritingAction,
  type CreateComparisonReportInput,
  type SubmitWritingInput,
  type SubmitWritingResult,
} from "./server-actions";
import { draftQueryKey } from "./queries";
import type { WritingDraftInsert, WritingDraftRow } from "./types";

type BrowserClient = ReturnType<typeof createSupabaseBrowserClient>;
type ClientFactory = () => BrowserClient;

export async function upsertDraft(
  input: WritingDraftInsert,
  createClient: ClientFactory = createSupabaseBrowserClient,
): Promise<WritingDraftRow> {
  const supabase = createClient();

  // `writing_drafts_active_unique` is a partial unique index
  // `(user_id, problem_id) where autosave_status <> 'superseded'`.
  // PostgREST upsert cannot target that predicate, so autosave has to resolve
  // the active draft explicitly instead of using `onConflict`.
  const activeDraftId = await findActiveDraftId(supabase, input);
  if (activeDraftId) {
    const updated = await updateActiveDraft(supabase, activeDraftId, input);
    if (updated) return updated;
  }

  const inserted = await insertDraft(supabase, input);
  if (inserted.error && isUniqueViolation(inserted.error)) {
    const racedDraftId = await findActiveDraftId(supabase, input);
    if (racedDraftId) {
      const updated = await updateActiveDraft(supabase, racedDraftId, input);
      if (updated) return updated;
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
): Promise<WritingDraftRow | null> {
  const { data, error } = await supabase
    .from("writing_drafts")
    .update(input)
    .eq("id", draftId)
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
      qc.invalidateQueries({
        queryKey: draftQueryKey(variables.user_id, variables.problem_id),
      });
    },
  });
}

// Phase 6 R-DEAD-INVALIDATE: previously this mutation invalidated submission /
// feedback bundle / feedback status keys keyed by the newly-minted submissionId.
// Those keys have no mounted query at the time of invalidation (the caller
// navigates to /feedback/[id] right after, and that page mounts fresh), so the
// invalidations were dead. Drop them.
export function useSubmitWriting() {
  return useMutation<SubmitWritingResult, Error, SubmitWritingInput>({
    mutationFn: (input) => submitWritingAction(input),
  });
}

export function useCreateComparisonReport() {
  return useMutation<
    { reportId: string },
    Error,
    CreateComparisonReportInput
  >({
    mutationFn: (input) => createComparisonReportAction(input),
  });
}
