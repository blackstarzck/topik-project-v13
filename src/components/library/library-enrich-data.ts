"use client";

/**
 * F-01 row enrichment — pulls score/feedback-preview/status for saved
 * submissions so the list rows can show 점수 / 피드백 요약(2줄) / 상태 배지.
 *
 * The shared LibrarySubmissionView (src/lib/library/types.ts, read-only here)
 * only carries problem_id/submitted_at/char_count, so this client helper
 * augments it with writing_submissions.feedback_status + writing_feedback
 * (score_total/score_max/overall_summary). Both tables are owner-scoped RLS.
 */

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type SubmissionEnrichment = {
  feedbackStatus: "pending" | "analyzing" | "complete" | "failed";
  scoreTotal: number | null;
  scoreMax: number | null;
  summary: string | null;
};

export async function fetchSubmissionEnrichment(
  submissionIds: string[],
): Promise<Map<string, SubmissionEnrichment>> {
  const out = new Map<string, SubmissionEnrichment>();
  if (submissionIds.length === 0) return out;

  const supabase = createSupabaseBrowserClient();

  const { data: subs, error: subErr } = await supabase
    .from("writing_submissions")
    .select("id, feedback_status")
    .in("id", submissionIds);
  if (subErr) throw new Error(subErr.message);

  const { data: fbs, error: fbErr } = await supabase
    .from("writing_feedback")
    .select("submission_id, score_total, score_max, overall_summary")
    .in("submission_id", submissionIds);
  if (fbErr) throw new Error(fbErr.message);

  const fbBySub = new Map(
    (fbs ?? []).map((f) => [f.submission_id, f] as const),
  );

  for (const sub of subs ?? []) {
    const fb = fbBySub.get(sub.id);
    out.set(sub.id, {
      feedbackStatus: sub.feedback_status,
      scoreTotal: fb?.score_total ?? null,
      scoreMax: fb?.score_max ?? null,
      summary: fb?.overall_summary ?? null,
    });
  }
  return out;
}

const STATUS_LABELS: Record<
  SubmissionEnrichment["feedbackStatus"],
  { label: string; color: string }
> = {
  pending: { label: "분석 대기", color: "default" },
  analyzing: { label: "분석 중", color: "blue" },
  complete: { label: "분석 완료", color: "green" },
  failed: { label: "분석 실패", color: "red" },
};

export function statusBadge(status: SubmissionEnrichment["feedbackStatus"]) {
  return STATUS_LABELS[status] ?? STATUS_LABELS.pending;
}

/** Title <= 32 chars (F-01 row constraint). */
export function clampTitle(title: string, max = 32): string {
  return title.length <= max ? title : `${title.slice(0, max - 1)}…`;
}
