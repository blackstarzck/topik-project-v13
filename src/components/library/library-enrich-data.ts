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

// i18n: 이 모듈은 컴포넌트가 아니라 useTranslations를 쓸 수 없다. 라벨 문구는
// library.submissions.* 카탈로그 키로 노출하고, 렌더 컴포넌트가 t()로 해석한다
// (wave-2/3 key-expose 패턴). 여기서는 카탈로그 키 + 배지 색만 보관한다.
const STATUS_BADGES: Record<
  SubmissionEnrichment["feedbackStatus"],
  { labelKey: string; color: string }
> = {
  pending: { labelKey: "statusPending", color: "default" },
  analyzing: { labelKey: "statusAnalyzing", color: "blue" },
  complete: { labelKey: "statusComplete", color: "green" },
  failed: { labelKey: "statusFailed", color: "red" },
};

export function statusBadge(status: SubmissionEnrichment["feedbackStatus"]) {
  return STATUS_BADGES[status] ?? STATUS_BADGES.pending;
}

/** Title <= 32 chars (F-01 row constraint). */
export function clampTitle(title: string, max = 32): string {
  return title.length <= max ? title : `${title.slice(0, max - 1)}…`;
}
