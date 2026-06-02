// @vitest-environment jsdom
import { describe, expect, it, afterEach, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";

// DashboardAlertsCard's load-failed branch calls useRouter().refresh(); jsdom has
// no Next.js app-router context, so mock the navigation hook (mirrors the auth
// LoginForm test). next/link renders as a plain anchor in jsdom and is fine.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

import { renderWithIntl } from "../../test-utils/renderWithIntl";
import { DashboardHeader } from "../../../src/components/dashboard/DashboardHeader";
import {
  DashboardKpiSummary,
  type DashboardKpiData,
} from "../../../src/components/dashboard/DashboardKpiSummary";
import { DashboardRecommendations } from "../../../src/components/dashboard/DashboardRecommendations";
import { DashboardAlertsCard } from "../../../src/components/dashboard/DashboardAlertsCard";

// The dashboard namespace is in the committed ko catalog (merged from staging),
// so renderWithIntl (ko baseline + antd App) resolves all keys. ko is the i18n
// baseline, so the assertions below match the verbatim Korean.

afterEach(() => {
  cleanup();
});

describe("DashboardHeader", () => {
  it("renders the heading, subtitle, and primary CTA", () => {
    renderWithIntl(<DashboardHeader />);
    expect(screen.getByText("홈 대시보드")).toBeTruthy();
    expect(
      screen.getByText("오늘의 학습 상태와 다음 할 일을 한눈에 확인하세요."),
    ).toBeTruthy();
    expect(screen.getByText("학습 시작")).toBeTruthy();
  });
});

describe("DashboardKpiSummary", () => {
  const populated: DashboardKpiData = {
    todayAttempts: 2,
    totalAttempts: 10,
    recentFeedbackCount: 3,
    goalAchievementPct: 80,
    streakDays: 5,
    updatedAt: "2026-06-02T09:00:00.000Z",
  };

  it("shows the new-user empty state when there is no activity", () => {
    const empty: DashboardKpiData = {
      todayAttempts: 0,
      totalAttempts: 0,
      recentFeedbackCount: 0,
      goalAchievementPct: null,
      streakDays: 0,
      updatedAt: "2026-06-02T09:00:00.000Z",
    };
    renderWithIntl(<DashboardKpiSummary kpi={empty} />);
    expect(screen.getByText("첫 학습을 시작해 볼까요?")).toBeTruthy();
    expect(screen.getByText("추천 문제로 시작하기")).toBeTruthy();
  });

  it("renders the four KPI tile labels when populated", () => {
    renderWithIntl(<DashboardKpiSummary kpi={populated} />);
    expect(screen.getByText("오늘 제출")).toBeTruthy();
    expect(screen.getByText("최근 첨삭")).toBeTruthy();
    expect(screen.getByText("목표 달성")).toBeTruthy();
    expect(screen.getByText("연속 학습")).toBeTruthy();
  });
});

describe("DashboardRecommendations", () => {
  it("renders empty-state cards when there is no primary or alternatives", () => {
    renderWithIntl(
      <DashboardRecommendations primary={null} alternatives={[]} />,
    );
    expect(screen.getByText("이어 풀 문제")).toBeTruthy();
    expect(
      screen.getByText(
        "이어 풀 문제가 아직 없어요. 추천에서 새 문제를 골라보세요.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("추천 보기")).toBeTruthy();
    expect(screen.getByText("추천 유형")).toBeTruthy();
  });

  it("renders the source label and question-no ICU tag for a primary pick", () => {
    renderWithIntl(
      <DashboardRecommendations
        primary={{
          problemId: "p1",
          title: "테스트 문제",
          questionNo: 53,
          reason: null,
          source: "recommendation",
        }}
        alternatives={[]}
      />,
    );
    expect(screen.getByText("맞춤 추천")).toBeTruthy();
    expect(screen.getByText("53번 문항")).toBeTruthy();
    expect(screen.getByText("이어 풀기")).toBeTruthy();
    expect(
      screen.getByText("최근 학습 흐름을 따라가는 추천이에요."),
    ).toBeTruthy();
  });
});

describe("DashboardAlertsCard", () => {
  it("renders the empty state when there are no alerts", () => {
    renderWithIntl(<DashboardAlertsCard alerts={[]} />);
    expect(screen.getByText("알림")).toBeTruthy();
    expect(screen.getByText("알림 설정")).toBeTruthy();
    expect(screen.getByText("새 알림이 없어요.")).toBeTruthy();
  });

  it("renders the retry CTA when alerts failed to load", () => {
    renderWithIntl(<DashboardAlertsCard alerts={[]} loadFailed />);
    expect(screen.getByText("알림을 불러오지 못했어요.")).toBeTruthy();
    expect(screen.getByText("다시 시도")).toBeTruthy();
    expect(screen.getByText("알림 설정으로 이동")).toBeTruthy();
  });
});
