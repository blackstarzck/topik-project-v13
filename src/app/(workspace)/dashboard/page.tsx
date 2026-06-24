import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import {
  DashboardBody,
  type DashboardContinueDraft,
} from "@/components/dashboard/DashboardBody";
import { AuthIdentityNotice } from "@/components/auth/AuthIdentityNotice";
import type { RecentFeedbackItem } from "@/components/learning/RecentFeedbackCard";
import type { DashboardAlertItem } from "@/components/dashboard/DashboardAlertsCard";
import type { DashboardPrimary, DashboardAlternative } from "@/components/dashboard/DashboardRecommendations";
import { WorkspaceBody } from "@/components/app/WorkspaceBody";
import { requireUser } from "@/lib/auth/session";
import { calculateGoalProgress } from "@/lib/growth/goalProgress";
import { getDashboardKpi } from "@/lib/learning/kpi";
import { getLearningGoal } from "@/lib/learning/server";
import { getNextProblemBundle } from "@/lib/practice/next";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.page");
  return { title: t("metaTitle") };
}

const DAY_MS = 1000 * 60 * 60 * 24;

type ContinueDraftProblemJoin = {
  title: string;
  question_no: number | null;
};

type ContinueDraftQueryRow = {
  problem_id: string;
  question_no: number | null;
  last_saved_at: string | null;
  problems: ContinueDraftProblemJoin | ContinueDraftProblemJoin[] | null;
};

function getExamDday(examDate: string, nowMs: number): number {
  const examMs = new Date(examDate).getTime();
  return Math.ceil((examMs - nowMs) / DAY_MS);
}

// 요청 시점의 현재 시각(ms). 컴포넌트 렌더 본문에서 Date.now()를 직접 부르면
// purity 규칙에 걸리므로(불순 함수), 별도 헬퍼로 분리해 한 번만 읽는다.
// growth/page.tsx의 loadGrowthData 패턴과 동일.
function getRequestNowMs(): number {
  return Date.now();
}

function pickJoinedOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function toDashboardContinueDraft(
  row: ContinueDraftQueryRow | null,
): DashboardContinueDraft | null {
  if (!row) return null;

  const problem = pickJoinedOne(row.problems);
  if (!problem) return null;

  return {
    problemId: row.problem_id,
    title: problem.title,
    questionNo: problem.question_no ?? row.question_no,
    lastSavedAt: row.last_saved_at,
  };
}

export default async function DashboardPage() {
  const t = await getTranslations("dashboard.page");
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
      }
    : null;
  const alternatives: DashboardAlternative[] = bundle.alternatives.map((a) => ({
    problemId: a.id,
    title: a.title,
    questionNo: a.questionNo,
    reason: a.reason,
  }));

  // 이어쓰기 카드는 추천 문제와 분리해 실제 작성 중 draft가 있을 때만 표시한다.
  const { data: draftRows } = await supabase
    .from("writing_drafts")
    .select(
      "problem_id, question_no, last_saved_at, updated_at, char_count, problems!inner(title, question_no)",
    )
    .eq("user_id", user.id)
    .neq("autosave_status", "superseded")
    .gt("char_count", 0)
    .order("last_saved_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(1);
  const continueDraft = toDashboardContinueDraft(
    ((draftRows ?? [])[0] as unknown as ContinueDraftQueryRow | undefined) ??
      null,
  );

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

  // area 4 — in-app alerts. 로드 실패는 try/catch 로 감지해 재시도/설정 CTA.
  const alerts: DashboardAlertItem[] = [];
  let alertsLoadFailed = false;
  const nowMs = getRequestNowMs();
  if (goal.exam_date) {
    const dDay = getExamDday(goal.exam_date, nowMs);
    if (dDay >= 0 && dDay <= 30) {
      alerts.push({
        id: "exam-dday",
        level: dDay <= 7 ? "warning" : "info",
        title: t("examDdayTitle", { days: dDay }),
        description: t("examDdayDescription", { days: dDay }),
      });
    }
  }
  try {
    const { count: dirtyDraftCount, error } = await supabase
      .from("writing_drafts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("autosave_status", "dirty");
    if (error) throw error;
    if ((dirtyDraftCount ?? 0) > 0) {
      alerts.push({
        id: "dirty-drafts",
        level: "info",
        title: t("dirtyDraftsTitle"),
        description: t("dirtyDraftsDescription", { count: dirtyDraftCount ?? 0 }),
      });
    }
  } catch {
    alertsLoadFailed = true;
  }

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
        alerts={alerts}
        alertsLoadFailed={alertsLoadFailed}
      />
    </WorkspaceBody>
  );
}
