// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";

import koMessages from "../../../messages/ko.json";
import { DashboardAlertsCard } from "../../../src/components/dashboard/DashboardAlertsCard";
import { DashboardHeader } from "../../../src/components/dashboard/DashboardHeader";
import {
  DashboardKpiSummary,
  type DashboardKpiData,
} from "../../../src/components/dashboard/DashboardKpiSummary";
import { DashboardRecommendations } from "../../../src/components/dashboard/DashboardRecommendations";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const dashboard = koMessages.dashboard;

afterEach(() => {
  cleanup();
});

describe("DashboardHeader", () => {
  it("renders the heading, subtitle, and primary CTA", () => {
    renderWithIntl(<DashboardHeader />);
    expect(screen.getByText(dashboard.header.title)).toBeTruthy();
    expect(screen.getByText(dashboard.header.subtitle)).toBeTruthy();
    expect(screen.getByText(dashboard.header.startCta)).toBeTruthy();
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
    expect(screen.getByText(dashboard.kpi.newUserTitle)).toBeTruthy();
    expect(screen.getByText(dashboard.kpi.newUserCta)).toBeTruthy();
  });

  it("renders the four KPI tile labels when populated", () => {
    renderWithIntl(<DashboardKpiSummary kpi={populated} />);
    expect(screen.getByText(dashboard.kpi.todaySubmissionsTitle)).toBeTruthy();
    expect(screen.getByText(dashboard.kpi.recentFeedbackTitle)).toBeTruthy();
    expect(screen.getByText(dashboard.kpi.goalAchievementTitle)).toBeTruthy();
    expect(screen.getByText(dashboard.kpi.streakTitle)).toBeTruthy();
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
});

describe("DashboardAlertsCard", () => {
  it("renders the empty state when there are no alerts", () => {
    renderWithIntl(<DashboardAlertsCard alerts={[]} />);
    expect(screen.getByText(dashboard.alerts.cardTitle)).toBeTruthy();
    expect(screen.getByText(dashboard.alerts.settingsLink)).toBeTruthy();
    expect(screen.getByText(dashboard.alerts.empty)).toBeTruthy();
  });

  it("renders the retry CTA when alerts failed to load", () => {
    renderWithIntl(<DashboardAlertsCard alerts={[]} loadFailed />);
    expect(screen.getByText(dashboard.alerts.loadFailedMessage)).toBeTruthy();
    expect(screen.getByText(dashboard.alerts.retry)).toBeTruthy();
    expect(screen.getByText(dashboard.alerts.goToSettings)).toBeTruthy();
  });
});
