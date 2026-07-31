"use client";

import { createSupabaseBrowserClient } from "../supabase/browser";
import type { TablesInsert } from "../supabase/types";

type BrowserClient = ReturnType<typeof createSupabaseBrowserClient>;
type ClientFactory = () => BrowserClient;

/**
 * Contract SoT: supabase/migrations/20260708113000_writing_submission_metrics.sql
 * (learning-data collection Phase 1, owner decision 2026-07-08).
 *
 * Numbers/ids only — no answer text, draft body, or feedback narrative
 * (same PII stance as study_events). DB checks reject elapsed > 86400 or
 * active > elapsed, so both are clamped here before insert.
 */
const MAX_SECONDS = 86_400;

export interface WritingTimeMetricsSnapshot {
  elapsedSeconds: number;
  activeSeconds: number;
  startedAt: string;
}

export interface RecordWritingSubmissionMetricsInput extends WritingTimeMetricsSnapshot {
  submissionId: string;
  problemId?: string | null;
  questionNo: number;
}

function clampSeconds(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.floor(value), 0), MAX_SECONDS);
}

/**
 * Fire-and-forget metrics insert, mirroring `logStudyEvent`'s contract:
 * derives user_id from the active session (no session → silent no-op) and
 * the returned Promise never rejects — a lost metric must never break the
 * submit success path. PK = submission_id, so a duplicate insert (submit
 * retry with the same id) fails silently and keeps the first measurement.
 */
export async function recordWritingSubmissionMetrics(
  input: RecordWritingSubmissionMetricsInput,
  createClient: ClientFactory = createSupabaseBrowserClient,
): Promise<void> {
  try {
    const elapsed = clampSeconds(input.elapsedSeconds);
    const active = Math.min(clampSeconds(input.activeSeconds), elapsed);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return;
    }

    const row: TablesInsert<"writing_submission_metrics"> = {
      submission_id: input.submissionId,
      user_id: user.id,
      problem_id: input.problemId ?? null,
      question_no: input.questionNo,
      elapsed_seconds: elapsed,
      active_seconds: active,
      started_at: input.startedAt || null,
    };

    const { error } = await supabase
      .from("writing_submission_metrics")
      .insert(row);
    if (error) {
      console.warn(
        "recordWritingSubmissionMetrics: insert failed",
        error.message,
      );
    }
  } catch (err) {
    console.warn(
      "recordWritingSubmissionMetrics: swallowed unexpected error",
      err,
    );
  }
}
