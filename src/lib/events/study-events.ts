"use client";

import { createSupabaseBrowserClient } from "../supabase/browser";
import type { Json, TablesInsert } from "../supabase/types";
import { trackStudyEventInGoogleAnalytics } from "../analytics/google-analytics";

type BrowserClient = ReturnType<typeof createSupabaseBrowserClient>;
type ClientFactory = () => BrowserClient;

/**
 * Frozen catalog (migration 20260520120700_library_events_exports.sql:118).
 * Keep in lockstep with the SQL `comment on table` ledger.
 */
export type StudyEventType =
  | "practice_started"
  | "attempt_submitted"
  | "draft_autosaved"
  | "submission_submitted"
  | "feedback_viewed"
  | "report_viewed"
  | "recommendation_clicked"
  | "export_downloaded";

export const STUDY_EVENT_TYPES: readonly StudyEventType[] = [
  "practice_started",
  "attempt_submitted",
  "draft_autosaved",
  "submission_submitted",
  "feedback_viewed",
  "report_viewed",
  "recommendation_clicked",
  "export_downloaded",
] as const;

/**
 * Payload value contract: primitives only (string | number | boolean | null).
 * No nested objects/arrays. No raw writing content.
 *
 * Rationale (PII contract, rev4 P2-R5-NEW-1):
 *   `get_admin_org_dashboard()` returns the latest 100 study_events to org
 *   admins. If a payload carried `answer_text`, draft body, or feedback
 *   `narrative`, every org_admin could read learners' private writing.
 *   We keep IDs (problem_id/submission_id/attempt_id/recommendation_item_id)
 *   on dedicated columns and prevent content keys at the helper boundary.
 */
export type StudyEventPayloadValue = string | number | boolean | null;
export type StudyEventPayload = Record<string, StudyEventPayloadValue>;

/**
 * Blocked payload keys. The list is over-broad on purpose — false positives
 * are cheap (rename the key), false negatives leak PII to org admins.
 */
const FORBIDDEN_PAYLOAD_KEYS = new Set<string>([
  "answer_text",
  "answer",
  "content",
  "draft",
  "draft_text",
  "narrative",
  "summary",
  "overall_summary",
  "comment",
  "corrected_text",
  "original_text",
]);

const MAX_STRING_VALUE_CHARS = 200;

function isDevEnvironment(): boolean {
  // Vitest sets NODE_ENV=test; treat both dev and test as strict mode.
  // In production we degrade to console.warn to avoid crashing the client.
  if (typeof process === "undefined" || !process.env) return true;
  const env = process.env.NODE_ENV;
  return env !== "production";
}

/**
 * Throws (dev/test) or warns (prod) when a payload violates the PII contract.
 * Exported for tests; callers should use `logStudyEvent` instead.
 */
export function assertSafePayload(payload: StudyEventPayload): void {
  const strict = isDevEnvironment();
  for (const [key, value] of Object.entries(payload)) {
    const keyLower = key.toLowerCase();
    if (FORBIDDEN_PAYLOAD_KEYS.has(keyLower)) {
      const msg = `study-events: payload key "${key}" is forbidden — raw writing content must not be logged (PII contract).`;
      if (strict) throw new Error(msg);

      console.warn(msg);
      continue;
    }
    if (typeof value === "string") {
      if (value.length > MAX_STRING_VALUE_CHARS) {
        const msg = `study-events: payload value for "${key}" is ${value.length} chars (> ${MAX_STRING_VALUE_CHARS}). Likely raw content — refusing to log.`;
        if (strict) throw new Error(msg);

        console.warn(msg);
      }
      continue;
    }
    if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      continue;
    }
    // Reject nested objects/arrays defensively.
    const msg = `study-events: payload value for "${key}" must be a primitive (string|number|boolean|null), got ${typeof value}.`;
    if (strict) throw new Error(msg);

    console.warn(msg);
  }
}

/**
 * Production safety-net: strip every key that violates the PII contract before
 * insert. Codex post-impl found that `assertSafePayload` only warns in prod and
 * the original payload was still inserted (P1 — PII leak). This sanitizer runs
 * AFTER `assertSafePayload` and is the actual filter that touches the DB row.
 * In dev/test `assertSafePayload` already threw, so this function never sees
 * those payloads in practice.
 */
export function sanitizePayloadForInsert(
  payload: StudyEventPayload,
): StudyEventPayload {
  const clean: StudyEventPayload = {};
  for (const [key, value] of Object.entries(payload)) {
    const keyLower = key.toLowerCase();
    if (FORBIDDEN_PAYLOAD_KEYS.has(keyLower)) continue;
    if (typeof value === "string") {
      if (value.length > MAX_STRING_VALUE_CHARS) continue;
      clean[key] = value;
      continue;
    }
    if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      clean[key] = value;
      continue;
    }
    // Drop nested objects/arrays defensively.
  }
  return clean;
}

export interface LogStudyEventInput {
  eventType: StudyEventType;
  problemId?: string;
  submissionId?: string;
  attemptId?: string;
  sessionId?: string;
  payload?: StudyEventPayload;
}

/**
 * Fire-and-forget study_events insert. Catches its own errors and never
 * blocks/raises to the caller — analytics are best-effort. The PII guard
 * (`assertSafePayload`) is the only path that throws, and only in dev/test
 * so misuse surfaces during development.
 *
 * Returns a Promise so callers can `void logStudyEvent(...)` or await it in
 * tests; the contract is "the returned Promise never rejects".
 *
 * Auth: the row's `user_id` is derived from the active session via
 * `supabase.auth.getUser()`. If no session, the call no-ops silently.
 */
export async function logStudyEvent(
  input: LogStudyEventInput,
  createClient: ClientFactory = createSupabaseBrowserClient,
): Promise<void> {
  try {
    // PII guard runs synchronously — throw in dev to surface bad payloads.
    // Production behaviour: assertSafePayload only warns; sanitizePayloadForInsert
    // below is the actual filter that strips forbidden keys from the row we
    // insert (Codex post-impl P1 fix).
    if (input.payload) {
      assertSafePayload(input.payload);
    }
    trackStudyEventInGoogleAnalytics(input);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      // No authenticated session — silently drop. Logging anon events would
      // violate RLS anyway.
      return;
    }

    const safePayload = input.payload
      ? sanitizePayloadForInsert(input.payload)
      : null;

    const row: TablesInsert<"study_events"> = {
      user_id: user.id,
      event_type: input.eventType,
      problem_id: input.problemId ?? null,
      submission_id: input.submissionId ?? null,
      attempt_id: input.attemptId ?? null,
      session_id: input.sessionId ?? null,
      payload:
        safePayload && Object.keys(safePayload).length > 0
          ? (safePayload as unknown as Json)
          : null,
    };

    const { error } = await supabase.from("study_events").insert(row);
    if (error) {
      console.warn("logStudyEvent: insert failed", error.message);
    }
  } catch (err) {
    // Re-throw assertion errors in dev so misuse is caught early. Swallow
    // every other error (network, RLS, transient) to honor the fire-and-
    // forget contract.
    if (err instanceof Error && /study-events:/.test(err.message)) {
      throw err;
    }

    console.warn("logStudyEvent: swallowed unexpected error", err);
  }
}
