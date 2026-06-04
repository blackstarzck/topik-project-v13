import type { Metadata } from "next";

import { DashboardBody } from "@/components/dashboard/DashboardBody";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import type { DashboardAlertItem } from "@/components/dashboard/DashboardAlertsCard";
import type { DashboardKpiData } from "@/components/dashboard/DashboardKpiSummary";
import type {
  DashboardAlternative,
  DashboardPrimary,
} from "@/components/dashboard/DashboardRecommendations";
import type { RecentFeedbackItem } from "@/components/learning/RecentFeedbackCard";
import { PageContainer } from "@/components/shared/PageContainer";
import { SPACING } from "@/theme/spacing";

/**
 * PILOT QA SCAFFOLDING (PLAN §Phase 2 #13) — NOT navigation-linked.
 *
 * Renders the dashboard presentation components (DashboardHeader + DashboardBody)
 * with fixture props and NO auth / NO Supabase, so the redesign can be browser-
 * verified (Playwright targets /dev-preview/dashboard + /login) without a real
 * session. Remove or feature-flag before cluster expansion. noindex so it never
 * leaks into search.
 *
 * Fixture timestamps are fixed strings (no Date.now()) for deterministic render.
 */
export const metadata: Metadata = {
  title: "Dashboard preview (dev)",
  robots: { index: false, follow: false },
};

const KPI: DashboardKpiData = {
  todayAttempts: 2,
  totalAttempts: 18,
  recentFeedbackCount: 3,
  goalAchievementPct: 78,
  streakDays: 5,
  updatedAt: "2026-06-02T09:00:00.000Z",
};

const PRIMARY: DashboardPrimary = {
  problemId: "preview-p1",
  title: "TOPIK II 쓰기 53번 — 그래프 설명",
  questionNo: 53,
  reason: "최근 학습 흐름을 따라가는 추천이에요.",
  source: "recommendation",
};

const ALTERNATIVES: DashboardAlternative[] = [
  {
    problemId: "preview-a1",
    title: "쓰기 52번 — 빈칸 완성",
    questionNo: 52,
    reason: null,
  },
  {
    problemId: "preview-a2",
    title: "쓰기 51번 — 실용문 작성",
    questionNo: 51,
    reason: null,
  },
];

const RECENT_FEEDBACKS: RecentFeedbackItem[] = [
  {
    submissionId: "preview-s1",
    questionNo: 53,
    scoreTotal: 42,
    generatedAt: "2026-06-01T12:00:00.000Z",
  },
  {
    submissionId: "preview-s2",
    questionNo: 52,
    scoreTotal: 8,
    generatedAt: "2026-05-30T12:00:00.000Z",
  },
];

const ALERTS: DashboardAlertItem[] = [
  {
    id: "preview-exam",
    level: "warning",
    title: "시험 D-7",
    description: "시험이 일주일 남았어요. 마무리 점검을 시작하세요.",
  },
  {
    id: "preview-draft",
    level: "info",
    title: "저장 중인 답안 1개",
    description: "이어서 작성할 답안이 있어요.",
  },
];

export default function DashboardPreviewPage() {
  return (
    <PageContainer size="wide">
      <DashboardHeader />
      <div style={{ marginTop: SPACING.lg }}>
        <DashboardBody
          kpi={KPI}
          examDate="2026-06-09"
          primary={PRIMARY}
          alternatives={ALTERNATIVES}
          recentFeedbacks={RECENT_FEEDBACKS}
          alerts={ALERTS}
          alertsLoadFailed={false}
        />
      </div>
    </PageContainer>
  );
}
