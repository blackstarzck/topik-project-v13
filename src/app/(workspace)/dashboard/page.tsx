import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  DashboardContent,
} from "@/components/learning/DashboardContent";
import type { RecentFeedbackItem } from "@/components/learning/RecentFeedbackCard";
import type { DashboardAlert } from "@/components/learning/AlertsCard";
import { requireUser } from "@/lib/auth/session";
import { getDashboardKpi } from "@/lib/learning/kpi";
import { getLearningGoal } from "@/lib/learning/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "대시보드 — TALKPIK" };

export default async function DashboardPage() {
  const user = await requireUser();
  const goal = await getLearningGoal(user.id);
  if (!goal) redirect("/onboarding/learning-goal");
  const supabase = await createSupabaseServerClient();
  const kpi = await getDashboardKpi(user.id, supabase);

  // Phase 7-D Task 11 (P1-7) — RecentFeedback fetch with single join query
  // for question_no context (Codex P2-1 fix; Plan rev3 R-5 N+1 avoidance).
  const { data: feedbacks } = await supabase
    .from("writing_feedback")
    .select(
      "submission_id, score_total, generated_at, writing_submissions!inner(question_no)",
    )
    .eq("user_id", user.id)
    .order("generated_at", { ascending: false })
    .limit(3);

  const recentFeedbacks: RecentFeedbackItem[] = (feedbacks ?? []).map((f) => {
    // Embedded relation: writing_submissions is 1:1 keyed by submission_id PK,
    // but PostgREST may return as array or object — normalize either way.
    const sub = (f as { writing_submissions: unknown }).writing_submissions;
    const subObj = Array.isArray(sub) ? sub[0] : sub;
    const questionNo =
      subObj && typeof subObj === "object" && "question_no" in subObj
        ? ((subObj as { question_no: number | null }).question_no ?? null)
        : null;
    return {
      submissionId: f.submission_id,
      questionNo,
      scoreTotal: f.score_total,
      generatedAt: f.generated_at,
    };
  });

  // In-app alerts — exam D-day + dirty drafts. Tier 2 OOS-9 transport 없이.
  const alerts: DashboardAlert[] = [];
  if (goal.exam_date) {
    const examMs = new Date(goal.exam_date).getTime();
    const dDay = Math.ceil((examMs - Date.now()) / (1000 * 60 * 60 * 24));
    if (dDay >= 0 && dDay <= 30) {
      alerts.push({
        id: "exam-dday",
        level: dDay <= 7 ? "warning" : "info",
        title: `시험 D-${dDay}`,
        description: `목표 시험일까지 ${dDay}일 남았습니다.`,
      });
    }
  }
  const { count: dirtyDraftCount } = await supabase
    .from("writing_drafts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("autosave_status", "dirty");
  if ((dirtyDraftCount ?? 0) > 0) {
    alerts.push({
      id: "dirty-drafts",
      level: "info",
      title: "작성 중인 답안",
      description: `완성하지 않은 답안 ${dirtyDraftCount}건이 있습니다.`,
    });
  }

  return (
    <DashboardContent
      goal={goal}
      kpi={kpi}
      recentFeedbacks={recentFeedbacks}
      alerts={alerts}
    />
  );
}
