import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardBody } from "@/components/dashboard/DashboardBody";
import { AuthIdentityNotice } from "@/components/auth/AuthIdentityNotice";
import type { RecentFeedbackItem } from "@/components/learning/RecentFeedbackCard";
import type {
  DashboardPrimary,
  DashboardAlternative,
} from "@/components/dashboard/DashboardRecommendations";
import { WorkspaceBody } from "@/components/app/WorkspaceBody";
import { requireUser } from "@/lib/auth/session";
import { calculateGoalProgress } from "@/lib/growth/goalProgress";
import { getDashboardKpi } from "@/lib/learning/kpi";
import { getLearningGoal } from "@/lib/learning/server";
import { getNextProblemBundle } from "@/lib/practice/next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  pickDashboardContinueDraft,
  type DashboardContinueDraftQueryRow,
} from "@/lib/writing/dashboard-drafts";
import { getCanonicalWritingProblems } from "@/lib/writing/canonical-source";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.page");
  return { title: t("metaTitle") };
}

// 요청 시점의 현재 시각(ms). 컴포넌트 렌더 본문에서 Date.now()를 직접 부르면
// purity 규칙에 걸리므로(불순 함수), 별도 헬퍼로 분리해 한 번만 읽는다.
// growth/page.tsx의 loadGrowthData 패턴과 동일.
function getRequestNowMs(): number {
  return Date.now();
}

export default async function DashboardPage() {
  const user = await requireUser();
  const goal = await getLearningGoal(user.id);
  if (!goal) redirect("/onboarding/learning-goal");
  const supabase = await createSupabaseServerClient();
  const kpi = await getDashboardKpi(user.id, supabase);

  // area 3 추천/진행 카드 — 실제 추천 데이터(recommendation_items 기반 bundle).
  const bundle = await getNextProblemBundle(user.id, () =>
    Promise.resolve(supabase),
  );
  const primary: DashboardPrimary | null = bundle.primary
    ? {
        problemId: bundle.primary.problemId,
        title: bundle.primary.title,
        questionNo: bundle.primary.questionNo,
        reason: bundle.primary.reason ?? null,
        source: bundle.primary.source,
        primaryTier: bundle.primaryTier,
      }
    : null;
  const alternatives: DashboardAlternative[] = bundle.alternatives.map((a) => ({
    problemId: a.id,
    title: a.title,
    questionNo: a.questionNo,
    reason: a.reason,
  }));

  // 이어쓰기 카드는 추천 문제와 분리해 실제 작성 중 draft가 있을 때만 표시한다.
  const { data: rawDraftRows } = await supabase
    .from("writing_drafts")
    .select(
      "problem_id, question_no, answer_text, answer_json, char_count, autosave_status, last_saved_at, updated_at",
    )
    .eq("user_id", user.id)
    .neq("autosave_status", "superseded")
    .order("last_saved_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(10);
  const canonicalProblems = await getCanonicalWritingProblems({ supabase });
  const canonicalById = new Map(
    canonicalProblems.map((problem) => [problem.id, problem]),
  );
  const draftRows = (rawDraftRows ?? []).map((row) => {
    const typed = row as unknown as Omit<
      DashboardContinueDraftQueryRow,
      "problems"
    >;
    const problem = canonicalById.get(typed.problem_id);
    return {
      ...typed,
      problems: problem
        ? { title: problem.title, question_no: problem.questionNo }
        : null,
    };
  });
  const continueDraft = pickDashboardContinueDraft(draftRows ?? []);

  // 최근 첨삭(받은 피드백) — KPI 타일 + 카드. single join query for question_no.
  const { data: feedbacks } = await supabase
    .from("writing_feedback")
    .select(
      "submission_id, score_total, score_max, generated_at, writing_submissions!inner(question_no)",
    )
    .eq("user_id", user.id)
    .order("generated_at", { ascending: false })
    .limit(20);

  const feedbackRows = feedbacks ?? [];
  const recentFeedbacks: RecentFeedbackItem[] = feedbackRows
    .slice(0, 3)
    .map((f) => {
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

  // 목표 달성률 — /growth와 같은 제품 산식: TOPIK II 목표 등급 총점 하한을
  // 쓰기 100점 기준으로 환산하고, 실제 feedback 점수를 score_max로 정규화한다.
  const goalAchievementPct = calculateGoalProgress({
    goal: { topikLevel: goal.topik_level, targetGrade: goal.target_grade },
    feedbacks: feedbackRows.map((f) => ({
      scoreTotal: f.score_total,
      scoreMax: f.score_max,
    })),
  });

  const nowMs = getRequestNowMs();

  const kpiData = {
    todayAttempts: kpi.todayAttempts,
    totalAttempts: kpi.totalAttempts,
    recentFeedbackCount: feedbackRows.length,
    goalAchievementPct,
    streakDays: kpi.streakDays,
    updatedAt: new Date(nowMs).toISOString(),
  };

  return (
    <WorkspaceBody className="app-cards-bordered grid gap-6">
      <AuthIdentityNotice />
      <DashboardHeader />
      <DashboardBody
        userId={user.id}
        kpi={kpiData}
        examDate={goal.exam_date}
        primary={primary}
        continueDraft={continueDraft}
        alternatives={alternatives}
        recentFeedbacks={recentFeedbacks}
      />
    </WorkspaceBody>
  );
}
