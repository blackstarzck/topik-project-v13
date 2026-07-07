// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import koMessages from "../../../messages/ko.json";
import { DashboardAlertsCard } from "../../../src/components/dashboard/DashboardAlertsCard";
import { DashboardBody } from "../../../src/components/dashboard/DashboardBody";
import { DashboardHeader } from "../../../src/components/dashboard/DashboardHeader";
import {
  DashboardKpiSummary,
  type DashboardKpiData,
} from "../../../src/components/dashboard/DashboardKpiSummary";
import { DashboardRecommendations } from "../../../src/components/dashboard/DashboardRecommendations";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

const routerPushMock = vi.hoisted(() => vi.fn());
const routerRefreshMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
    replace: vi.fn(),
    refresh: routerRefreshMock,
  }),
}));

// DashboardAlertsCard fetches user_notifications client-side; vitest has no
// Supabase env, so the data module is mocked at the boundary.
const fetchNotificationsMock = vi.hoisted(() => vi.fn());
const markNotificationReadMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/notifications/notifications-data", () => ({
  fetchNotifications: (...args: unknown[]) => fetchNotificationsMock(...args),
  markNotificationRead: (...args: unknown[]) =>
    markNotificationReadMock(...args),
  resolveNotificationDestination: (item: {
    route_path?: string | null;
    link_url?: string | null;
  }) => {
    const destination = item.route_path?.trim() || item.link_url?.trim();
    return destination?.startsWith("/") ? destination : null;
  },
}));

const dashboard = koMessages.dashboard;

const emptyKpi: DashboardKpiData = {
  todayAttempts: 0,
  totalAttempts: 0,
  recentFeedbackCount: 0,
  goalAchievementPct: null,
  streakDays: 0,
  updatedAt: "2026-06-02T09:00:00.000Z",
};

function getContinueCard() {
  const title = screen.getByText(dashboard.hub.continueTitle);
  const card = title.closest(".ant-card");
  if (!card) throw new Error("continue card not found");
  return within(card as HTMLElement);
}

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("DashboardHeader", () => {
  it("renders the heading and subtitle without a header CTA", () => {
    renderWithIntl(<DashboardHeader />);
    expect(screen.getByText(dashboard.header.title)).toBeTruthy();
    expect(screen.getByText(dashboard.header.subtitle)).toBeTruthy();
    expect(screen.queryByText(dashboard.header.startCta)).toBeNull();
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

  it("keeps the four KPI tiles and replaces zero values with start guidance", () => {
    const empty: DashboardKpiData = {
      todayAttempts: 0,
      totalAttempts: 0,
      recentFeedbackCount: 0,
      goalAchievementPct: null,
      streakDays: 0,
      updatedAt: "2026-06-02T09:00:00.000Z",
    };
    renderWithIntl(<DashboardKpiSummary kpi={empty} />);
    expect(screen.getByText(dashboard.kpi.todaySubmissionsTitle)).toBeTruthy();
    expect(screen.getByText(dashboard.kpi.recentFeedbackTitle)).toBeTruthy();
    expect(screen.getByText(dashboard.kpi.goalAchievementTitle)).toBeTruthy();
    expect(screen.getByText(dashboard.kpi.streakTitle)).toBeTruthy();
    expect(screen.getAllByText(dashboard.kpi.zeroValuePrompt)).toHaveLength(4);
  });

  it("renders the four KPI tile labels when populated", () => {
    renderWithIntl(<DashboardKpiSummary kpi={populated} />);
    expect(screen.getByText(dashboard.kpi.todaySubmissionsTitle)).toBeTruthy();
    expect(screen.getByText(dashboard.kpi.recentFeedbackTitle)).toBeTruthy();
    expect(screen.getByText(dashboard.kpi.goalAchievementTitle)).toBeTruthy();
    expect(screen.getByText(dashboard.kpi.streakTitle)).toBeTruthy();
    expect(screen.queryByText(/업데이트:/)).toBeNull();
  });
});

describe("DashboardRecommendations", () => {
  it("renders empty-state cards when there is no primary or alternatives", () => {
    renderWithIntl(
      <DashboardRecommendations primary={null} alternatives={[]} />,
    );
    expect(
      screen.getByText(dashboard.recommendations.continueCardTitle),
    ).toBeTruthy();
    expect(
      screen.getByText(dashboard.recommendations.continueEmpty),
    ).toBeTruthy();
    expect(
      screen.getByText(dashboard.recommendations.viewRecommendations),
    ).toBeTruthy();
    expect(
      screen.getByText(dashboard.recommendations.typesCardTitle),
    ).toBeTruthy();
  });

  it("renders the source label and question-no ICU tag for a primary pick", () => {
    renderWithIntl(
      <DashboardRecommendations
        primary={{
          problemId: "p1",
          title: "테스트 문제",
          questionNo: 53,
          reason: null,
          primaryTier: 1,
          source: "recommendation",
        }}
        alternatives={[]}
      />,
    );
    expect(
      screen.getByText(dashboard.recommendations.sourceRecommendation),
    ).toBeTruthy();
    expect(screen.getByText("53번 문항")).toBeTruthy();
    expect(
      screen.getByText(dashboard.recommendations.continueButton),
    ).toBeTruthy();
    expect(
      screen.getByText(dashboard.recommendations.defaultReason),
    ).toBeTruthy();
  });

  it("does not label a published-problem fallback as a recommendation", () => {
    renderWithIntl(
      <DashboardRecommendations
        primary={{
          problemId: "p-fallback",
          title: "Published fallback",
          questionNo: 51,
          reason: null,
          primaryTier: 3,
          source: "random",
        }}
        alternatives={[]}
      />,
    );

    expect(screen.getByText("Published fallback")).toBeTruthy();
    expect(screen.queryByText("오늘의 추천")).toBeNull();
    expect(
      screen.queryByText(dashboard.recommendations.defaultReason),
    ).toBeNull();
  });
});

describe("DashboardBody", () => {
  beforeEach(() => {
    fetchNotificationsMock.mockReset();
    fetchNotificationsMock.mockResolvedValue([]);
    markNotificationReadMock.mockReset();
    markNotificationReadMock.mockResolvedValue(undefined);
  });

  it("shows an empty continue-writing card when there is no active draft", () => {
    renderWithIntl(
      <DashboardBody
        userId="user-1"
        kpi={emptyKpi}
        examDate={null}
        primary={{
          problemId: "recommended-problem",
          title: "추천 전용 문제",
          questionNo: 51,
          reason: "추천 카드에만 보여야 하는 이유",
          primaryTier: 3,
          source: "random",
        }}
        alternatives={[]}
        recentFeedbacks={[]}
        continueDraft={null}
      />,
    );

    const continueCard = getContinueCard();
    expect(continueCard.queryByText("추천 전용 문제")).toBeNull();
    expect(
      continueCard.queryByText("추천 카드에만 보여야 하는 이유"),
    ).toBeNull();
    expect(continueCard.getByText("작성 중인 답안이 없어요")).toBeTruthy();
    expect(continueCard.getByText("문제 목록 보기")).toBeTruthy();
  });

  it("labels a published-problem fallback as a direct practice option", () => {
    renderWithIntl(
      <DashboardBody
        userId="user-1"
        kpi={emptyKpi}
        examDate={null}
        primary={{
          problemId: "fallback-problem",
          title: "Published fallback",
          questionNo: 51,
          reason: null,
          primaryTier: 3,
          source: "random",
        }}
        alternatives={[]}
        recentFeedbacks={[]}
        continueDraft={null}
      />,
    );

    expect(screen.getByText("Published fallback")).toBeTruthy();
    expect(screen.queryByText("AI 튜터의 오늘 추천")).toBeNull();
    expect(screen.queryByText("추천 이유")).toBeNull();

    const cta = screen.getByRole("link", { name: dashboard.hub.solveNow });
    expect(cta.getAttribute("href")).toContain(
      "/writing/short-answer-writing-51?problem=fallback-problem",
    );
  });

  it("uses the active draft instead of the recommendation in the continue-writing card", () => {
    renderWithIntl(
      <DashboardBody
        userId="user-1"
        kpi={emptyKpi}
        examDate={null}
        primary={{
          problemId: "recommended-problem",
          title: "추천 전용 문제",
          questionNo: 51,
          reason: "추천 카드에만 보여야 하는 이유",
          source: "random",
        }}
        alternatives={[]}
        recentFeedbacks={[]}
        continueDraft={{
          problemId: "draft-problem",
          title: "작성 중인 문제",
          questionNo: 52,
          lastSavedAt: "2026-06-02T09:00:00.000Z",
        }}
      />,
    );

    const continueCard = getContinueCard();
    expect(continueCard.getByText("작성 중인 문제")).toBeTruthy();
    expect(continueCard.queryByText("추천 전용 문제")).toBeNull();
    expect(continueCard.getByText(dashboard.hub.continueCta)).toBeTruthy();
    const link = continueCard.getByText(dashboard.hub.continueCta).closest("a");
    expect(link?.getAttribute("href")).toContain(
      "/writing/answer-writing-52?problem=draft-problem",
    );
  });
});

describe("DashboardAlertsCard", () => {
  beforeEach(() => {
    fetchNotificationsMock.mockReset();
    fetchNotificationsMock.mockResolvedValue([]);
    markNotificationReadMock.mockReset();
    markNotificationReadMock.mockResolvedValue(undefined);
    routerPushMock.mockReset();
    routerRefreshMock.mockReset();
  });

  it("renders the empty state when there are no alerts or notifications", async () => {
    renderWithIntl(<DashboardAlertsCard userId="user-1" />);
    expect(screen.getByText(dashboard.alerts.cardTitle)).toBeTruthy();
    expect(screen.queryByText(dashboard.alerts.settingsLink)).toBeNull();
    await waitFor(() => {
      expect(screen.getByText(dashboard.alerts.empty)).toBeTruthy();
    });
  });

  it("renders the retry CTA when alerts failed to load", async () => {
    renderWithIntl(<DashboardAlertsCard userId="user-1" loadFailed />);
    await waitFor(() => {
      expect(screen.getByText(dashboard.alerts.loadFailedMessage)).toBeTruthy();
    });
    expect(screen.getByText(dashboard.alerts.retry)).toBeTruthy();
    expect(screen.queryByText(dashboard.alerts.goToSettings)).toBeNull();
  });

  it("runs the failed-load retry only once while the retry action is pending", async () => {
    vi.useFakeTimers();
    renderWithIntl(<DashboardAlertsCard userId="user-1" loadFailed />);
    const retry = screen.getByRole("button", {
      name: dashboard.alerts.retry,
    });

    fireEvent.click(retry);
    fireEvent.click(retry);

    expect(routerRefreshMock).toHaveBeenCalledTimes(1);
    expect(retry).toHaveProperty("disabled", true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });
  });

  it("renders latest notices without category tags or duplicating study/exam notifications", async () => {
    fetchNotificationsMock.mockResolvedValue([
      {
        id: "n1",
        template_key: "notice",
        category: "notice",
        title: "서비스 점검 공지",
        body: "오늘 밤 점검이 있어요.",
        link_url: "/dashboard",
        read_at: null,
        created_at: "2026-06-11T09:00:00.000Z",
      },
      {
        id: "n2",
        template_key: "exam_d7",
        category: "exam_schedule",
        title: "시험 D-7 안내",
        body: "시험이 일주일 남았어요.",
        link_url: "/dashboard",
        read_at: null,
        created_at: "2026-06-10T09:00:00.000Z",
      },
    ]);
    renderWithIntl(<DashboardAlertsCard userId="user-1" />);
    await waitFor(() => {
      expect(screen.getByText("서비스 점검 공지")).toBeTruthy();
    });
    expect(screen.queryByText("시험 D-7 안내")).toBeNull();
    expect(screen.queryByText(dashboard.alerts.category.notice)).toBeNull();
    expect(fetchNotificationsMock).toHaveBeenCalledWith("user-1", 5, {
      category: "notice",
    });
  });

  it("moves to the notification route path when it exists", async () => {
    fetchNotificationsMock.mockResolvedValue([
      {
        id: "n-route",
        template_key: "notice",
        category: "notice",
        title: "Route notice",
        body: "Notice has a detail page.",
        link_url: null,
        route_path: "/dashboard?notice=route",
        read_at: null,
        created_at: "2026-06-22T09:00:00.000Z",
      },
    ]);
    renderWithIntl(<DashboardAlertsCard userId="user-1" />);
    await waitFor(() => {
      expect(screen.getByText("Route notice")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Route notice"));

    await waitFor(() => {
      expect(markNotificationReadMock).toHaveBeenCalledWith("n-route");
    });
    expect(routerPushMock).toHaveBeenCalledWith("/dashboard?notice=route");
  });

  it("marks a notification read without moving when there is no route path", async () => {
    fetchNotificationsMock.mockResolvedValue([
      {
        id: "n-no-route",
        template_key: "notice",
        category: "notice",
        title: "No route alert",
        body: "Plain notice.",
        link_url: null,
        route_path: null,
        read_at: null,
        created_at: "2026-06-22T09:00:00.000Z",
      },
    ]);
    renderWithIntl(<DashboardAlertsCard userId="user-1" />);
    await waitFor(() => {
      expect(screen.getByText("No route alert")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("No route alert"));

    await waitFor(() => {
      expect(markNotificationReadMock).toHaveBeenCalledWith("n-no-route");
    });
    expect(routerPushMock).not.toHaveBeenCalled();
  });
});
