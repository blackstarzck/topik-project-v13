// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { App as AntdApp } from "antd";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";

import { GrowthDashboard } from "../../../src/components/growth/GrowthDashboard";
import type { GrowthDashboardProps } from "../../../src/components/growth/GrowthDashboard";
import { GrowthTrendChart } from "../../../src/components/growth/GrowthTrendChart";
import { GrowthLockedReport } from "../../../src/components/growth/GrowthLockedReport";
import { GrowthLoadError } from "../../../src/components/growth/GrowthLoadError";
import koMessages from "../../../messages/ko.json";

// router is exercised on retry/refresh paths; stub it so next/navigation resolves
// under jsdom.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// The `growth.*` catalog is now merged into messages/ko.json. Render against the
// real ko catalog (same Korean strings the assertions match) so these stay green
// without depending on the ephemeral messages/_staging/ dir.

function renderGrowth(ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale="ko" messages={koMessages}>
      <AntdApp>{ui}</AntdApp>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  // Ant Design / recharts touch ResizeObserver + matchMedia, which jsdom omits.
  if (!(globalThis as Record<string, unknown>).ResizeObserver) {
    (globalThis as Record<string, unknown>).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const baseProps: GrowthDashboardProps = {
  kpi: {
    averageScore: 82,
    totalAttempts: 12,
    improvementPct: 5,
    goalAchievementPct: 90,
    goalLabel: "3급",
  },
  weakDimensions: [
    { dimension: "grammar", avgScore: 0.55, sampleCount: 4 },
    { dimension: "vocab", avgScore: 0.7, sampleCount: 3 },
  ],
  recommendations: [
    { problemId: "p-1", title: "추천 문제 A", questionNo: 51 },
  ],
  trendPoints: [],
  recentCompleted: [
    {
      submissionId: "s-1",
      questionNo: 51,
      scoreTotal: 80,
      generatedAt: "2026-05-01T00:00:00Z",
    },
  ],
  streakDays: 3,
  recentVolume: 6,
  hasGoal: true,
  reportLocked: false,
  planLabel: "premium",
};

describe("GrowthDashboard (i18n chrome)", () => {
  it("renders the heading, KPI labels, and a localized dimension label", () => {
    renderGrowth(<GrowthDashboard {...baseProps} />);
    expect(screen.getByText("성장 대시보드")).toBeTruthy();
    expect(screen.getByText("평균 점수")).toBeTruthy();
    expect(screen.getByText("개선률")).toBeTruthy();
    expect(screen.getByText("목표 달성률")).toBeTruthy();
    // weakest dimension (grammar) label via the dynamic dimension key.
    expect(screen.getByText("문법")).toBeTruthy();
    // ICU "{score}점 · {count}건" weakness sample leaf (grammar: 55점 · 4건).
    expect(screen.getByText("55점 · 4건")).toBeTruthy();
  });

  it("resolves a numeric ICU insight from the key-expose pattern", () => {
    renderGrowth(<GrowthDashboard {...baseProps} />);
    // improvementPct 5 (>=3) → growth.insights.scoreUp with pct=5.
    expect(screen.getByText("최근 평균 점수가 이전보다 5% 올랐어요.")).toBeTruthy();
  });

  it("renders the locked report when reportLocked is true", () => {
    renderGrowth(<GrowthDashboard {...baseProps} reportLocked planLabel={null} />);
    expect(screen.getByTestId("growth-kpi-grid")).toBeTruthy();
    expect(screen.getByTestId("growth-kpi-average")).toBeTruthy();
    expect(screen.getByTestId("growth-kpi-attempts")).toBeTruthy();
    expect(screen.getByTestId("growth-kpi-improvement")).toBeTruthy();
    expect(screen.getByTestId("growth-kpi-goal")).toBeTruthy();
    expect(
      screen.getByText("상세 성장 리포트는 유료 플랜 전용이에요"),
    ).toBeTruthy();
    expect(screen.getByTestId("growth-locked-report")).toBeTruthy();
    expect(screen.queryByText("성장 추세 차트")).toBeNull();
  });

  it("shows the no-goal setup prompt when hasGoal is false", () => {
    renderGrowth(<GrowthDashboard {...baseProps} hasGoal={false} />);
    expect(
      screen.getByText(
        "학습 목표가 아직 없어요. 목표를 설정하면 성장 지표가 채워집니다.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "목표 설정하기" })).toBeTruthy();
  });
});

describe("GrowthTrendChart (i18n chrome)", () => {
  it("renders the localized title and period filter labels", () => {
    renderGrowth(<GrowthTrendChart points={[]} />);
    expect(screen.getByText("성장 추세 차트")).toBeTruthy();
    expect(screen.getByText("7일")).toBeTruthy();
    expect(screen.getByText("전체")).toBeTruthy();
  });

  it("shows the empty state + retry button when there is no data", () => {
    renderGrowth(<GrowthTrendChart points={[]} onRetry={vi.fn()} />);
    expect(
      screen.getByText(
        "아직 추세를 그릴 학습 기록이 없어요. 글쓰기를 제출하면 점수·풀이량 추세가 채워집니다.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
  });
});

describe("GrowthLockedReport (i18n chrome)", () => {
  it("renders the plan tag inside the rich body and the upgrade CTA", () => {
    renderGrowth(<GrowthLockedReport planLabel="무료" />);
    expect(
      screen.getByText("상세 성장 리포트는 유료 플랜 전용이에요"),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "플랜 업그레이드" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "구독 관리" })).toBeTruthy();
  });
});

describe("GrowthLoadError (i18n chrome)", () => {
  it("renders the failure title, subtitle, and retry button", () => {
    renderGrowth(<GrowthLoadError />);
    expect(screen.getByText("성장 지표를 불러오지 못했어요.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
  });
});
