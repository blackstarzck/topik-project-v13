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

const mutationMocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
}));

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

vi.mock("@/lib/writing/mutations", () => ({
  useCreateComparisonReport: () => mutationMocks,
}));

function renderReports(ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale="ko" messages={koMessages}>
      <AntdApp>{ui}</AntdApp>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  mutationMocks.mutate.mockClear();
  mutationMocks.isPending = false;
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
      screen.getByText("항목별 점수 데이터가 없어 그래프를 그릴 수 없어요."),
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
  it("places the learning CTA group in the page header actions", () => {
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
        currentSubmissionId="current-1"
        currentQuestionNo={54}
        currentSubmittedAt="2026-05-20T10:00:00.000Z"
        selectedPreviousSubmissionId="previous-1"
        comparisonTargets={[
          {
            submissionId: "previous-1",
            questionNo: 54,
            problemId: "problem-54",
            submittedAt: "2026-05-19T10:00:00.000Z",
            feedbackStatus: "complete",
            score: 70,
            scoreMax: 100,
            charCount: 80,
            isSelected: true,
            isRecommended: true,
            isDisabled: false,
          },
          {
            submissionId: "previous-2",
            questionNo: 54,
            problemId: "problem-54",
            submittedAt: "2026-05-12T10:00:00.000Z",
            feedbackStatus: "complete",
            score: 64,
            scoreMax: 100,
            charCount: 76,
            isSelected: false,
            isRecommended: false,
            isDisabled: false,
          },
        ]}
      />,
    );

    const stickyHeader = screen.getByTestId("comparison-page-header");
    const inner = within(stickyHeader).getByTestId("report-page-header-inner");
    const titleRegion = within(stickyHeader).getByTestId(
      "report-page-header-title",
    );
    const actionRegion = within(stickyHeader).getByTestId(
      "report-page-header-actions",
    );
    expect(stickyHeader.className).toContain("sticky");
    expect(stickyHeader.className).toContain("top-0");
    expect(stickyHeader.className).toContain("border-b");
    expect(stickyHeader.className).toContain("border-border");
    expect(inner.className).toContain("app-workspace-body");
    expect(inner.className).toContain("lg:flex-row");

    const title = within(stickyHeader).getByRole("heading", {
      name: "비교 리포트",
    });
    expect(titleRegion.contains(title)).toBe(true);
    expect(title.tagName).toBe("H3");
    expect(title.className).toContain("ant-typography");
    expect(title.className).toContain("!m-0");
    expect(title.className).toContain("text-2xl");
    expect(title.className).not.toContain("app-page-header__title");

    const actions = screen.getByTestId("comparison-next-actions");

    expect(stickyHeader.contains(actions)).toBe(true);
    expect(stickyHeader.querySelector(".app-page-header")).toBeNull();
    expect(actionRegion.contains(actions)).toBe(true);
    expect(
      actionRegion.querySelector('[data-testid="comparison-action-share"]'),
    ).toBeTruthy();
    expect(actions.className).toContain("feedback-actions");
    expect(actions.className).not.toContain("app-card");
    expect(within(actions).getAllByRole("button")).toHaveLength(4);
    expect(
      Array.from(actionRegion.querySelectorAll("button")).map((button) =>
        button.getAttribute("data-testid"),
      ),
    ).toEqual([
      "comparison-action-retry",
      "comparison-action-next",
      "comparison-action-weakness",
      "comparison-action-share",
    ]);
    expect(
      Array.from(actions.querySelectorAll("button")).map((button) =>
        button.getAttribute("data-testid"),
      ),
    ).toEqual([
      "comparison-action-retry",
      "comparison-action-next",
      "comparison-action-weakness",
      "comparison-action-share",
    ]);

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
      within(actions).getByTestId("comparison-action-retry").className,
    ).not.toContain("ant-btn-primary");
    expect(
      within(secondary).getByTestId("comparison-action-weakness").className,
    ).not.toContain("ant-btn-primary");
    expect(
      within(secondary).getByTestId("comparison-action-weakness"),
    ).toBeTruthy();
    expect(
      within(secondary).getByTestId("comparison-action-share"),
    ).toBeTruthy();
  });

  it("opens an in-page right drawer for same-problem comparison targets", () => {
    renderReports(
      <ComparisonReportView
        metrics={{
          score_delta: 12,
          dimension_deltas: { grammar: 12 },
          char_delta: 24,
          no_previous: false,
        }}
        narrative="?댁쟾 ?듭븞蹂대떎 臾몃쾿怨?援ъ꽦 ?먯닔媛 ?щ옄?듬땲??"
        currentText="?대쾲 ?듭븞?낅땲??"
        previousText="?댁쟾 ?듭븞?낅땲??"
        retryHref="/writing/54?retry=sub-1"
        reportId="report-1"
        currentScore={82}
        chartData={[]}
        currentNorm={{ grammar: 82 }}
        hasPrevious
        currentSubmissionId="current-1"
        currentQuestionNo={54}
        currentSubmittedAt="2026-05-20T10:00:00.000Z"
        selectedPreviousSubmissionId="previous-1"
        comparisonTargets={[
          {
            submissionId: "previous-1",
            questionNo: 54,
            problemId: "problem-54",
            submittedAt: "2026-05-19T10:00:00.000Z",
            feedbackStatus: "complete",
            score: 70,
            scoreMax: 100,
            charCount: 80,
            isSelected: true,
            isRecommended: true,
            isDisabled: false,
          },
          {
            submissionId: "previous-2",
            questionNo: 54,
            problemId: "problem-54",
            submittedAt: "2026-05-12T10:00:00.000Z",
            feedbackStatus: "complete",
            score: 64,
            scoreMax: 100,
            charCount: 76,
            isSelected: false,
            isRecommended: false,
            isDisabled: false,
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByTestId("comparison-action-change-target"));

    const shell = screen.getByTestId("comparison-page-shell");
    expect(shell.querySelector(".comparison-target-drawer")).toBeTruthy();
    expect(screen.getByTestId("comparison-target-drawer-body")).toBeTruthy();
    expect(screen.getAllByTestId("comparison-target-option")).toHaveLength(2);
    expect(screen.queryByText(/same type/i)).toBeNull();
    expect(screen.queryByText(/all/i)).toBeNull();

    fireEvent.click(screen.getAllByTestId("comparison-target-option")[1]);
    fireEvent.click(screen.getByTestId("comparison-target-confirm"));

    expect(mutationMocks.mutate).toHaveBeenCalledWith(
      { current_id: "current-1", previous_id: "previous-2" },
      expect.any(Object),
    );
  });

  it("shows an empty drawer state when the same problem has no previous answer", () => {
    renderReports(
      <ComparisonReportView
        metrics={{
          score_delta: null,
          dimension_deltas: {},
          char_delta: 0,
          no_previous: true,
        }}
        narrative={null}
        currentText="이번 답안입니다."
        previousText={null}
        retryHref="/writing/54?retry=sub-1"
        reportId="report-1"
        currentScore={82}
        chartData={[]}
        currentNorm={{ grammar: 82 }}
        hasPrevious={false}
        currentSubmissionId="current-1"
        currentQuestionNo={54}
        currentSubmittedAt="2026-05-20T10:00:00.000Z"
        selectedPreviousSubmissionId={null}
        comparisonTargets={[]}
      />,
    );

    fireEvent.click(screen.getByTestId("comparison-action-change-target"));

    expect(screen.getByTestId("comparison-target-same-problem")).toBeTruthy();
    expect(screen.getByTestId("comparison-target-empty")).toBeTruthy();
    expect(
      (screen.getByTestId("comparison-target-confirm") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
