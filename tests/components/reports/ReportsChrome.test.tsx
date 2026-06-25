// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { App as AntdApp } from "antd";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";

import { ComparisonKpiBlock } from "../../../src/components/reports/ComparisonKpiBlock";
import { DimensionComparisonCards } from "../../../src/components/reports/DimensionComparisonCards";
import { ComparisonReportView } from "../../../src/components/reports/ComparisonReportView";
import { ScoreComparisonChart } from "../../../src/components/reports/ScoreComparisonChart";
import { SubmissionDiffPanel } from "../../../src/components/reports/SubmissionDiffPanel";
import koMessages from "../../../messages/ko.json";

// The `reports.*` catalog is now merged into messages/ko.json. We render against
// the real ko catalog (the same Korean strings the assertions match), so these
// stay green without depending on the ephemeral messages/_staging/ dir.

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

vi.mock("@/lib/events/study-events", () => ({
  logStudyEvent: vi.fn(() => Promise.resolve()),
}));

function renderReports(ui: ReactElement) {
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

describe("ComparisonKpiBlock i18n chrome", () => {
  it("renders KPI labels from the reports.kpi namespace", () => {
    renderReports(
      <ComparisonKpiBlock
        currentScore={82}
        scoreDelta={3.5}
        changedDimensions={2}
        hasPrevious
      />,
    );
    expect(screen.getByText("현재 총점")).toBeTruthy();
    expect(screen.getByText("개선 폭")).toBeTruthy();
    expect(screen.getByText("변화한 항목")).toBeTruthy();
  });

  it("shows the empty state when the current score is null", () => {
    renderReports(
      <ComparisonKpiBlock
        currentScore={null}
        scoreDelta={null}
        changedDimensions={0}
        hasPrevious={false}
      />,
    );
    expect(
      screen.getByText(
        "이번 답안의 점수를 산출하지 못해 KPI를 계산할 수 없어요.",
      ),
    ).toBeTruthy();
  });

  it("shows single-result chrome when there is no previous data", () => {
    renderReports(
      <ComparisonKpiBlock
        currentScore={70}
        scoreDelta={null}
        changedDimensions={0}
        hasPrevious={false}
      />,
    );
    expect(screen.getByText("비교 대상 없음")).toBeTruthy();
    expect(screen.getByText("단일 결과")).toBeTruthy();
  });
});

describe("DimensionComparisonCards i18n chrome", () => {
  it("renders dimension labels and trend tags when previous data exists", () => {
    renderReports(
      <DimensionComparisonCards
        deltas={{ grammar: 4, vocab: -3 }}
        hasPrevious
      />,
    );
    expect(screen.getByText("항목별 변화")).toBeTruthy();
    expect(screen.getByText("문법")).toBeTruthy();
    expect(screen.getByText("어휘")).toBeTruthy();
    // Trend tag text is composed: label + delta. Match the label substring.
    expect(screen.getByText(/상승/)).toBeTruthy();
    expect(screen.getByText(/하락/)).toBeTruthy();
  });

  it("renders the current-scores variant when there is no previous data", () => {
    renderReports(
      <DimensionComparisonCards
        deltas={{}}
        hasPrevious={false}
        currentScores={{ structure: 88 }}
      />,
    );
    expect(screen.getByText("항목별 점수")).toBeTruthy();
    expect(screen.getByText("구성")).toBeTruthy();
    // ICU "{value}점" leaf.
    expect(screen.getByText("88점")).toBeTruthy();
  });
});

describe("ScoreComparisonChart i18n chrome", () => {
  it("shows the empty state when there is no data", () => {
    renderReports(<ScoreComparisonChart data={[]} hasPrevious={false} />);
    expect(
      screen.getByText(
        "항목별 점수 데이터가 없어 그래프를 그릴 수 없어요.",
      ),
    ).toBeTruthy();
  });

  it("switches to the table fallback and renders localized column titles", () => {
    renderReports(
      <ScoreComparisonChart
        data={[{ dimension: "grammar", previous: 70, current: 80 }]}
        hasPrevious
      />,
    );
    expect(screen.getByText("항목별 점수 비교")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "표로 보기" }));
    expect(screen.getByText("항목별 점수 (표)")).toBeTruthy();
    // Column header "항목" + the localized dimension label inside the table.
    expect(screen.getByText("항목")).toBeTruthy();
    expect(screen.getByText("문법")).toBeTruthy();
    // ICU "{value}점" applied by the table formatter.
    expect(screen.getByText("80점")).toBeTruthy();
  });
});

describe("SubmissionDiffPanel i18n chrome", () => {
  it("renders both answer headings and the no-previous empty state", () => {
    renderReports(
      <SubmissionDiffPanel currentText="안녕하세요" previousText={null} />,
    );
    expect(screen.getByText("이번 답안")).toBeTruthy();
    expect(screen.getByText("이전 답안")).toBeTruthy();
    expect(screen.getByText("이전 답안 없음")).toBeTruthy();
  });
});

describe("ComparisonReportView next action chrome", () => {
  it("renders the bottom CTA with the same feedback action-group shell", () => {
    renderReports(
      <ComparisonReportView
        metrics={{
          score_delta: 12,
          dimension_deltas: { grammar: 12 },
          char_delta: 24,
          no_previous: false,
        }}
        narrative="이전 답안보다 문법과 구성 점수가 올랐습니다."
        currentText="이번 답안입니다."
        previousText="이전 답안입니다."
        retryHref="/writing/51?retry=sub-1"
        reportId="report-1"
        currentScore={82}
        chartData={[]}
        currentNorm={{ grammar: 82 }}
        hasPrevious
      />,
    );

    const actions = screen.getByTestId("comparison-next-actions");
    expect(actions.className).toContain("feedback-actions");
    expect(actions.className).not.toContain("app-card");

    const controls = within(actions).getByTestId(
      "comparison-next-actions-controls",
    );
    const secondary = within(actions).getByTestId(
      "comparison-next-actions-secondary",
    );

    expect(controls.className).toContain("flex");
    expect(secondary.className).toContain("flex");
    expect(
      within(actions).getByTestId("comparison-action-next").className,
    ).toContain("ant-btn-primary");
    expect(
      within(secondary).getByTestId("comparison-action-weakness"),
    ).toBeTruthy();
    expect(
      within(secondary).getByTestId("comparison-action-retry"),
    ).toBeTruthy();
  });
});
