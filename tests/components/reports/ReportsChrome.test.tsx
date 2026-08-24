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
import CompareReportLoading from "../../../src/app/(workspace)/writing/reports/[id]/compare/loading";
import { logStudyEvent } from "../../../src/lib/events/study-events";
import koMessages from "../../../messages/ko.json";

// The `reports.*` catalog is now merged into messages/ko.json. We render against
// the real ko catalog (the same Korean strings the assertions match), so these
// stay green without depending on the ephemeral messages/_staging/ dir.

const mutationMocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
}));

const viewMutationMocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
}));

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
}));

const appApiMocks = vi.hoisted(() => ({
  notification: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  message: {},
  modal: {},
}));

vi.mock("antd", async (importOriginal) => {
  const actual = await importOriginal<typeof import("antd")>();
  return {
    ...actual,
    App: Object.assign(actual.App, {
      useApp: () => appApiMocks,
    }),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

vi.mock("@/lib/events/study-events", () => ({
  logStudyEvent: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/writing/mutations", () => ({
  useCreateComparisonReport: () => mutationMocks,
  useCreateComparisonReportWithView: () => viewMutationMocks,
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
  viewMutationMocks.mutate.mockClear();
  viewMutationMocks.isPending = false;
  Object.values(routerMocks).forEach((mock) => mock.mockClear());
  appApiMocks.notification.success.mockClear();
  appApiMocks.notification.error.mockClear();
  appApiMocks.notification.info.mockClear();
  vi.mocked(logStudyEvent).mockClear();
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
  it("keeps each KPI item inside its own card surface", () => {
    renderReports(
      <ComparisonKpiBlock
        currentScore={82}
        scoreDelta={3.5}
        changedDimensions={2}
        hasPrevious
      />,
    );

    const block = screen.getByTestId("comparison-kpi-block");
    expect(block.className).not.toContain("ant-card");
    expect(block.className).not.toContain("app-card");
    const items = screen.getAllByTestId("comparison-kpi-item");
    expect(items).toHaveLength(3);
    items.forEach((item) => {
      expect(item.className).toContain("ant-card");
      expect(item.className).toContain("app-card");
    });
  });

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
    const section = screen.getByTestId("comparison-dimension-cards");
    expect(section.className).toContain("pb-[62px]");
    const title = screen.getByTestId("comparison-dimension-section-title");
    expect(title.tagName).toBe("H5");
    expect(title.className).toContain("ant-typography");
    expect(title.className).toContain("!mb-[40px]");
    expect(title.className).not.toContain("mb-4");
    expect(title.className).toContain("mt-0");
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
    const title = screen.getByTestId("comparison-dimension-section-title");
    expect(title.textContent).toBe("항목별 점수");
    expect(title.tagName).toBe("H5");
    expect(title.className).toContain("ant-typography");
    expect(title.className).toContain("!mb-[40px]");
    expect(title.className).not.toContain("mb-4");
    expect(title.className).toContain("mt-0");
    expect(title.className).not.toContain("text-lg");
    const section = title.closest("section");
    expect(section?.className).toContain("comparison-diff-panel");
    expect(section?.className).toContain("pb-[62px]");
  });
  it("renders current score values without tag backgrounds at 36px", () => {
    renderReports(
      <DimensionComparisonCards
        deltas={{}}
        hasPrevious={false}
        currentScores={{ content: 0, language: 18.8, structure: 0 }}
      />,
    );

    const scoreValues = screen.getAllByTestId(
      "comparison-dimension-score-value",
    );
    expect(scoreValues).toHaveLength(3);
    scoreValues.forEach((scoreValue) => {
      expect(scoreValue.closest(".ant-tag")).toBeNull();
      expect(scoreValue.className).toContain("text-[36px]");
      expect(scoreValue.className).not.toContain("bg-");
    });

    const labels = screen.getAllByTestId("comparison-dimension-label");
    expect(labels).toHaveLength(3);
    labels.forEach((label) => {
      expect(label.className).toContain("font-normal");
      expect(label.className).toContain(
        "!text-[var(--ant-color-text-description)]",
      );
      expect(label.querySelector("strong")).toBeNull();
    });
  });
});

describe("ScoreComparisonChart i18n chrome", () => {
  it("shows the empty state when there is no data", () => {
    renderReports(<ScoreComparisonChart data={[]} hasPrevious={false} />);
    expect(
      screen.getByText("항목별 점수 데이터가 없어 그래프를 그릴 수 없어요."),
    ).toBeTruthy();
  });

  it("renders only the score comparison chart without the duplicate table toggle", () => {
    renderReports(
      <ScoreComparisonChart
        data={[{ dimension: "grammar", previous: 70, current: 80 }]}
        hasPrevious
      />,
    );
    const chartSection = screen.getByTestId("comparison-chart");
    expect(chartSection.className).toContain("comparison-diff-panel");
    expect(chartSection.className).not.toContain("pb-[62px]");
    const chartTitle = within(chartSection).getByRole("heading", {
      name: "항목별 점수 비교",
    });
    expect(chartTitle.tagName).toBe("H5");
    expect(chartTitle.className).toContain("ant-typography");
    expect(chartTitle.className).toContain("!mb-[40px]");
    expect(chartTitle.className).not.toContain("mb-4");
    expect(chartTitle.className).toContain("mt-0");
    expect(screen.queryByRole("button", { name: "표로 보기" })).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "항목별 점수 (표)" }),
    ).toBeNull();
    expect(screen.queryByTestId("comparison-chart-table")).toBeNull();
    expect(screen.queryByTestId("comparison-chart-view-table")).toBeNull();
    expect(screen.queryByTestId("comparison-chart-view-chart")).toBeNull();
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

  it("renders long-form answers as a section comparison table without diff styling", () => {
    renderReports(
      <SubmissionDiffPanel
        currentText="fallback current"
        previousText="fallback previous"
        currentAnswerJson={{
          _v: "53.v1",
          sections: {
            intro: "이번 서론",
            body: "이번 본론",
            conclusion: "이번 결론",
          },
        }}
        previousAnswerJson={{
          _v: "53.v1",
          sections: {
            intro: "이전 서론",
            body: "이전 본론",
            conclusion: "이전 결론",
          },
        }}
      />,
    );

    const panel = screen.getByTestId("comparison-submission-diff");
    expect(panel.className).not.toContain("pb-[62px]");
    const title = within(panel).getByRole("heading", {
      name: "제출 답안 비교",
    });
    expect(title.tagName).toBe("H5");
    expect(title.className).toContain("ant-typography");
    expect(title.className).toContain("!mb-[40px]");
    expect(title.className).not.toContain("mb-4");
    expect(title.className).toContain("mt-0");
    const table = within(panel).getByRole("table");
    const currentAnswerHeader = within(table).getByText("이번 답안");
    const previousAnswerHeader = within(table).getByText("이전 답안");
    expect(currentAnswerHeader).toBeTruthy();
    expect(previousAnswerHeader).toBeTruthy();
    [currentAnswerHeader, previousAnswerHeader].forEach((header) => {
      expect(header.className).toContain("font-medium");
      expect(header.className).toContain(
        "!text-[var(--ant-color-text-description)]",
      );
      expect(header.closest("th")?.className).toContain("!font-medium");
      expect(header.closest("th")?.className).toContain(
        "!text-[var(--ant-color-text-description)]",
      );
    });
    const sectionHeadings = ["서론", "본론", "결론"].map((label) =>
      within(table).getByText(label),
    );
    sectionHeadings.forEach((heading) => {
      expect(heading.className).toContain("font-medium");
      expect(heading.className).toContain(
        "!text-[var(--ant-color-text-description)]",
      );
    });
    expect(within(table).getByText("이번 서론")).toBeTruthy();
    expect(within(table).getByText("이전 결론")).toBeTruthy();
    const answerTextNodes = [
      "이번 서론",
      "이전 서론",
      "이번 본론",
      "이전 본론",
      "이번 결론",
      "이전 결론",
    ].map((text) => within(table).getByText(text));
    answerTextNodes.forEach((node) => {
      expect(node.tagName).toBe("SPAN");
      expect(node.classList.contains("comparison-submission-answer-text")).toBe(
        true,
      );
      expect(node.classList.contains("ant-typography")).toBe(false);
      expect(
        Array.from(node.classList).some(
          (className) =>
            className === "m-0" ||
            className.startsWith("mb-") ||
            className.startsWith("!mb-"),
        ),
      ).toBe(false);
    });
    expect(within(panel).queryByText("추가됨")).toBeNull();
    expect(within(panel).queryByText("삭제됨")).toBeNull();
    expect(within(panel).queryByText("표현 변경")).toBeNull();
    expect(panel.innerHTML).not.toContain("color-success");
    expect(panel.innerHTML).not.toContain("color-error");
    expect(panel.innerHTML).not.toContain("color-warning");
  });

  it("does not render trend icons in the section comparison table", () => {
    renderReports(
      <SubmissionDiffPanel
        currentText="fallback current"
        previousText="fallback previous"
        currentAnswerJson={{
          _v: "53.v1",
          sections: {
            intro: "current intro with more detail",
            body: "short body",
            conclusion: "same conclusion",
          },
        }}
        previousAnswerJson={{
          _v: "53.v1",
          sections: {
            intro: "short intro",
            body: "previous body has much more detail than current",
            conclusion: "same conclusion",
          },
        }}
      />,
    );

    const table = within(
      screen.getByTestId("comparison-submission-diff"),
    ).getByRole("table");
    expect(
      within(table).getByText("current intro with more detail"),
    ).toBeTruthy();
    expect(within(table).getByText("short body")).toBeTruthy();
    expect(
      within(table).queryByTestId("comparison-submission-trend-up-intro"),
    ).toBeNull();
    expect(
      within(table).queryByTestId("comparison-submission-trend-down-body"),
    ).toBeNull();
    expect(
      within(table).queryByTestId("comparison-submission-trend-up-conclusion"),
    ).toBeNull();
    expect(
      within(table).queryByTestId(
        "comparison-submission-trend-down-conclusion",
      ),
    ).toBeNull();
  });

  it("keeps current and previous answer columns at equal width", () => {
    renderReports(
      <SubmissionDiffPanel
        currentText="fallback current"
        previousText="fallback previous"
        currentAnswerJson={{
          _v: "53.v1",
          sections: {
            intro: "이번 서론",
            body: "이번 본론",
            conclusion: "이번 결론",
          },
        }}
        previousAnswerJson={{
          _v: "53.v1",
          sections: {
            intro: "이전 서론",
            body: "이전 본론",
            conclusion: "이전 결론",
          },
        }}
      />,
    );

    const table = within(
      screen.getByTestId("comparison-submission-diff"),
    ).getByRole("table");
    const columns = Array.from(table.querySelectorAll("col"));
    expect(table.getAttribute("style")).toContain("table-layout: fixed");
    expect(columns).toHaveLength(3);
    expect(columns[0]?.getAttribute("style")).toContain("width: 112px");
    expect(columns[1]?.getAttribute("style")).toContain("calc");
    expect(columns[2]?.getAttribute("style")).toBe(
      columns[1]?.getAttribute("style"),
    );
  });
});

describe("Comparison report loading chrome", () => {
  it("uses the same doubled content gap as the loaded comparison report", () => {
    renderReports(<CompareReportLoading />);

    const loadingShell = screen.getByTestId("comparison-page-loading");
    const loadingBody = Array.from(
      loadingShell.querySelectorAll(".app-workspace-body--workspace"),
    ).find((node) => node.className.includes("pb-32"));
    expect(loadingBody?.className).toContain("gap-20");
    expect(loadingBody?.className).not.toContain("gap-10");
    expect(loadingBody?.className).toContain("pt-[100px]");
    expect(loadingBody?.className).not.toContain("py-4");
    expect(loadingBody?.className).not.toContain("sm:py-6");
    expect(
      Array.from(loadingBody?.children ?? []).some((child) =>
        child.className.includes("md:grid-cols-3"),
      ),
    ).toBe(false);
  });
});

describe("ComparisonReportView next action chrome", () => {
  it("logs report views with the current submission id for timeline attribution", () => {
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
        ]}
      />,
    );

    expect(logStudyEvent).toHaveBeenCalledWith({
      eventType: "report_viewed",
      submissionId: "current-1",
      payload: { report_id: "report-1" },
    });
  });

  it("renders the report title with only digits in the styled question number", () => {
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
        ]}
      />,
    );

    const stickyHeader = screen.getByTestId("comparison-page-header");
    const title = within(stickyHeader).getByRole("heading", {
      name: "54번 비교 리포트",
    });
    const titleQuestionNo = within(title).getByTestId(
      "comparison-title-question-no",
    );
    const titleLabel = within(title).getByTestId("comparison-title-label");

    expect(titleQuestionNo.textContent).toBe("54");
    expect(titleQuestionNo.textContent).not.toContain("번");
    expect(titleQuestionNo.className).toContain("font-['Space_Grotesk']");
    expect(titleQuestionNo.className).toContain("writing-question-number");
    expect(titleQuestionNo.className).toContain("writing-question-number--q54");
    expect(titleLabel.textContent).toBe("번 비교 리포트");
  });

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
          {
            submissionId: "previous-3",
            questionNo: 54,
            problemId: "problem-54",
            submittedAt: "2026-05-18T10:00:00.000Z",
            feedbackStatus: "analyzing",
            score: null,
            scoreMax: 100,
            charCount: 90,
            isSelected: false,
            isRecommended: false,
            isDisabled: true,
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
    const backLink = within(titleRegion).getByTestId(
      "comparison-header-back-link",
    );
    expect(backLink.getAttribute("href")).toBe(
      "/writing/feedback/long/current-1",
    );
    expect(backLink.getAttribute("aria-label")).toBe("피드백으로 돌아가기");
    expect(actionRegion.contains(backLink)).toBe(false);
    const body = screen.getByTestId("comparison-page-body");
    expect(body.className).toContain("gap-20");
    expect(body.className).not.toContain("gap-10");
    expect(body.className).toContain("pt-[100px]");
    expect(body.className).not.toContain("py-4");
    expect(body.className).not.toContain("sm:py-6");
    const summaryStrip = screen.getByTestId("comparison-summary-strip");
    expect(screen.queryByTestId("comparison-kpi-block")).toBeNull();
    expect(screen.queryAllByTestId("comparison-kpi-item")).toHaveLength(0);
    expect(
      within(summaryStrip).queryByTestId("comparison-summary-action-row"),
    ).toBeNull();
    const summaryAnswerRow = within(summaryStrip).getByTestId(
      "comparison-summary-answer-row",
    );
    expect(summaryAnswerRow.children).toHaveLength(2);
    expect(summaryAnswerRow.className).toContain("gap-10");
    expect(summaryAnswerRow.className).toContain("xl:gap-16");
    expect(summaryAnswerRow.className).toContain("xl:grid-cols-2");
    expect(summaryAnswerRow.className).not.toContain("_auto");
    expect(summaryAnswerRow.className).not.toContain("_88px_");
    const summaryAnswerCards = within(summaryAnswerRow).getAllByTestId(
      "comparison-summary-answer-card",
    );
    expect(summaryAnswerCards).toHaveLength(2);
    summaryAnswerCards.forEach((card) => {
      expect(card.className).toContain("w-full");
      expect(card.className).toContain("px-6");
      expect(card.className).toContain("py-8");
      expect(within(card).queryByTestId("comparison-summary-title")).toBeNull();
    });
    expect(summaryAnswerCards[0].querySelector("svg")).toBeNull();
    const changeTargetButton = within(summaryAnswerCards[1]).getByTestId(
      "comparison-action-change-target",
    );
    expect(changeTargetButton.textContent).toBe("");
    expect(changeTargetButton.getAttribute("aria-label")).toBe(
      "이전 답안 변경",
    );
    const changeTargetIcon = changeTargetButton.querySelector("svg");
    expect(changeTargetIcon?.getAttribute("width")).toBe("16");
    expect(changeTargetIcon?.getAttribute("height")).toBe("16");
    expect(
      within(summaryAnswerCards[1])
        .getByTestId("comparison-summary-score-row")
        .contains(changeTargetButton),
    ).toBe(true);
    expect(summaryAnswerCards[0].textContent).toContain("이번 답안");
    expect(summaryAnswerCards[0].textContent).toContain("제출일");
    expect(summaryAnswerCards[0].textContent).not.toContain("54번");
    expect(summaryAnswerCards[1].textContent).toContain("비교 대상");
    expect(summaryAnswerCards[1].textContent).toContain("제출일");
    expect(summaryAnswerCards[1].textContent).not.toContain("54번");
    const summaryLabels = within(summaryAnswerRow).getAllByTestId(
      "comparison-summary-label",
    );
    expect(summaryLabels).toHaveLength(2);
    summaryLabels.forEach((label) => {
      expect(label.className).toContain("!text-[16px]");
      expect(label.className).not.toContain("!text-[14px]");
      expect(label.className).not.toContain("text-sm");
      expect(label.className).not.toContain("text-xs");
    });
    const summaryScores = within(summaryAnswerRow).getAllByTestId(
      "comparison-summary-score",
    );
    expect(summaryScores).toHaveLength(2);
    summaryScores.forEach((score) => {
      const scoreClasses = Array.from(score.classList);
      expect(scoreClasses).toContain("!text-[46px]");
      expect(scoreClasses).not.toContain("text-[46px]");
      expect(score.className).toContain("leading-none");
      expect(score.className).not.toContain("ml-auto");
    });
    const summarySubmittedDates = within(summaryAnswerRow).getAllByTestId(
      "comparison-summary-submitted-at",
    );
    expect(summarySubmittedDates).toHaveLength(2);
    summarySubmittedDates.forEach((submittedAt) => {
      expect(submittedAt.className).toContain("!text-[14px]");
      expect(submittedAt.className).not.toContain("text-sm");
      expect(submittedAt.className).not.toContain("text-xs");
    });
    const currentSummaryText = summaryAnswerCards[0].textContent ?? "";
    const currentSummaryScore = summaryScores[0].textContent ?? "";
    expect(currentSummaryText.indexOf("이번 답안")).toBeLessThan(
      currentSummaryText.indexOf(currentSummaryScore),
    );
    expect(currentSummaryText.indexOf(currentSummaryScore)).toBeLessThan(
      currentSummaryText.indexOf("제출일"),
    );
    expect(summaryStrip.textContent).not.toContain("+12");
    expect(stickyHeader.className).toContain("sticky");
    expect(stickyHeader.className).toContain("top-0");
    expect(stickyHeader.className).toContain("border-b");
    expect(stickyHeader.className).toContain("border-border");
    expect(inner.className).toContain("app-workspace-body");
    expect(inner.className).toContain("lg:flex-row");

    const title = within(stickyHeader).getByRole("heading", {
      name: "54번 비교 리포트",
    });
    const titleQuestionNo = within(title).getByTestId(
      "comparison-title-question-no",
    );
    const titleLabel = within(title).getByTestId("comparison-title-label");
    expect(titleQuestionNo.textContent).toBe("54");
    expect(titleQuestionNo.className).toContain("font-['Space_Grotesk']");
    expect(titleQuestionNo.className).toContain("writing-question-number");
    expect(titleQuestionNo.className).toContain("writing-question-number--q54");
    expect(titleLabel.textContent).toBe("번 비교 리포트");
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
    const narrativeSummary = within(
      screen.getByTestId("comparison-narrative"),
    ).getByTestId("comparison-narrative-summary");
    const narrativeSummaryRow = within(
      screen.getByTestId("comparison-narrative"),
    ).getByTestId("comparison-narrative-summary-row");
    const narrativeSummaryGroup = within(narrativeSummaryRow).getByTestId(
      "comparison-narrative-summary-group",
    );
    const narrativeSummaryIcon = within(narrativeSummaryRow).getByTestId(
      "comparison-narrative-summary-icon",
    );
    expect(narrativeSummaryRow.className).toContain("flex");
    expect(narrativeSummaryRow.className).toContain("items-center");
    expect(narrativeSummaryRow.className).not.toContain("items-start");
    expect(narrativeSummaryRow.className).toContain("gap-3");
    expect(narrativeSummaryRow.contains(narrativeSummaryIcon)).toBe(true);
    expect(narrativeSummaryRow.contains(narrativeSummaryGroup)).toBe(true);
    expect(narrativeSummaryGroup.contains(narrativeSummary)).toBe(true);
    expect(narrativeSummaryIcon.tagName.toLowerCase()).toBe("svg");
    expect(narrativeSummaryIcon.getAttribute("aria-hidden")).toBe("true");
    expect(narrativeSummaryIcon.getAttribute("width")).toBe("32");
    expect(narrativeSummaryIcon.getAttribute("height")).toBe("32");
    expect(narrativeSummaryIcon.getAttribute("class") ?? "").not.toContain(
      "mt-0.5",
    );
    expect(narrativeSummaryIcon.getAttribute("fill")).toBe("none");
    expect(
      Array.from(narrativeSummaryIcon.querySelectorAll("path")).some(
        (path) => path.getAttribute("stroke") === "currentColor",
      ),
    ).toBe(true);
    expect(
      Array.from(narrativeSummaryIcon.querySelectorAll("path")).some(
        (path) => path.getAttribute("fill") === "currentColor",
      ),
    ).toBe(false);
    expect(narrativeSummary.className).toContain("!mb-[10px]");
    expect(narrativeSummary.className).toContain("!text-[20px]");
    expect(narrativeSummary.className).not.toContain("text-[26px]");
    expect(narrativeSummary.className).toContain("min-w-0");
    expect(narrativeSummary.className).toContain("font-semibold");
    expect(narrativeSummary.className).toContain("leading-8");
    const narrativeDisclaimer = within(narrativeSummaryGroup).getByTestId(
      "comparison-narrative-disclaimer",
    );
    expect(narrativeSummaryGroup.className).toContain("min-w-0");
    expect(narrativeDisclaimer.className).toContain("block");
    expect(narrativeDisclaimer.className).toContain("text-sm");
    expect(screen.getByTestId("comparison-submission-diff")).toBeTruthy();
  });

  it("opens an in-page right drawer for same-problem comparison targets", async () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    viewMutationMocks.mutate.mockImplementation((_input, options) => {
      options?.onSuccess?.({
        reportId: "report-2",
        viewModel: {
          metrics: {
            score_delta: 18,
            dimension_deltas: { grammar: 18 },
            char_delta: 28,
            no_previous: false,
          },
          narrative: "Updated comparison narrative",
          currentText: "updated current answer",
          previousText: "updated previous answer",
          retryHref: "/writing/54?retry=sub-1",
          reportId: "report-2",
          currentScore: 82,
          chartData: [],
          currentNorm: { grammar: 82 },
          hasPrevious: true,
          currentSubmissionId: "current-1",
          currentQuestionNo: 54,
          currentSubmittedAt: "2026-05-20T10:00:00.000Z",
          selectedPreviousSubmissionId: "previous-2",
          comparisonTargets: [
            {
              submissionId: "previous-1",
              questionNo: 54,
              problemId: "problem-54",
              submittedAt: "2026-05-19T10:00:00.000Z",
              feedbackStatus: "complete",
              score: 70,
              scoreMax: 100,
              charCount: 80,
              isSelected: false,
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
              isSelected: true,
              isRecommended: false,
              isDisabled: false,
            },
          ],
          showBlankComparison: false,
          hasBlankTraitData: false,
          blankComparisons: [],
        },
      });
    });

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
    const drawerRoot = shell.querySelector(
      ".comparison-target-drawer",
    ) as HTMLElement | null;
    expect(drawerRoot).toBeTruthy();
    expect(drawerRoot?.style.position).toBe("fixed");
    expect(drawerRoot?.style.inset).toBe("0px");
    const drawerWrapper = drawerRoot?.querySelector(
      ".ant-drawer-content-wrapper",
    ) as HTMLElement | null;
    expect(drawerWrapper?.style.height).toBe("100dvh");
    const drawerSection = drawerRoot?.querySelector(
      ".ant-drawer-section",
    ) as HTMLElement | null;
    expect(drawerSection?.style.height).toBe("100%");
    expect(drawerSection?.style.overflow).toBe("hidden");
    const drawerBody = screen.getByTestId("comparison-target-drawer-body");
    expect(drawerBody.className).toContain("overflow-hidden");
    expect(drawerBody.className).not.toContain("overflow-y-auto");
    expect(drawerBody.className).toContain("px-3");
    expect(drawerBody.className).not.toContain("px-6");
    const antDrawerBody = drawerBody.closest(
      ".ant-drawer-body",
    ) as HTMLElement | null;
    expect(antDrawerBody?.style.flex).toBe("1 1 0%");
    expect(antDrawerBody?.style.minHeight).toBe("0px");
    const drawerFooter = screen.getByTestId("comparison-target-drawer-footer");
    expect(drawerFooter.className).toContain("comparison-target-drawer-footer");
    const drawerFooterShell = drawerFooter.closest(".ant-drawer-footer");
    expect((drawerFooterShell as HTMLElement | null)?.style.position).toBe(
      "sticky",
    );
    expect((drawerFooterShell as HTMLElement | null)?.style.bottom).toBe("0px");
    expect((drawerFooterShell as HTMLElement | null)?.style.flexShrink).toBe(
      "0",
    );
    const targetListScroll = screen.getByTestId(
      "comparison-target-list-scroll",
    );
    expect(targetListScroll.className).toContain("min-h-0");
    expect(targetListScroll.className).toContain("flex-1");
    expect(targetListScroll.className).toContain("overflow-y-auto");
    expect(targetListScroll.className).toContain("pb-6");
    expect(screen.getAllByTestId("comparison-target-option")).toHaveLength(2);
    expect(
      screen.queryByTestId("comparison-target-status-filter"),
    ).not.toBeTruthy();
    expect(
      screen.queryByTestId("comparison-target-same-problem"),
    ).not.toBeTruthy();
    expect(screen.queryByText("같은 문제만")).not.toBeTruthy();
    expect(screen.queryByText("완료 답안")).not.toBeTruthy();
    expect(screen.queryByText("분석 상태 포함")).not.toBeTruthy();
    expect(screen.queryByText("직전 완료 답안")).not.toBeTruthy();
    expect(screen.queryByText("추천")).not.toBeTruthy();
    expect(screen.queryByText("이전 완료")).not.toBeTruthy();
    expect(screen.queryByText("80자")).not.toBeTruthy();
    expect(screen.queryByText("76자")).not.toBeTruthy();
    expect(
      screen.queryByText("분석 중이라 비교할 수 없어요."),
    ).not.toBeTruthy();
    screen.getAllByTestId("comparison-target-option").forEach((option) => {
      expect(option.className).toContain("border-b");
      expect(option.className).toContain(
        "border-[var(--ant-color-border-secondary)]",
      );
      expect(option.className).not.toContain(
        "border-[var(--app-color-border)]",
      );
      expect(option.className).toContain("px-3");
      expect(option.className).not.toContain("rounded-lg");
      expect(option.className).not.toContain("border-border");
      expect(option.className).not.toContain("bg-background");
      const optionMeta = within(option).getByTestId(
        "comparison-target-option-meta",
      );
      expect(optionMeta.className).toContain("gap-1");
      expect(optionMeta.className).not.toContain("gap-2");
    });
    const candidateScore = screen.getAllByTestId(
      "comparison-target-option-score",
    )[1];
    expect(candidateScore.textContent).toBe("64점");
    expect(candidateScore.className).toContain("self-center");
    expect(candidateScore.parentElement?.className).toContain("items-center");
    expect(screen.queryByText(/same type/i)).toBeNull();
    expect(screen.queryByText(/all/i)).toBeNull();

    fireEvent.click(screen.getAllByTestId("comparison-target-option")[1]);
    fireEvent.click(screen.getByTestId("comparison-target-confirm"));

    expect(viewMutationMocks.mutate).toHaveBeenCalledWith(
      { current_id: "current-1", previous_id: "previous-2" },
      expect.any(Object),
    );
    expect(mutationMocks.mutate).not.toHaveBeenCalled();
    expect(routerMocks.push).not.toHaveBeenCalled();
    expect(replaceStateSpy).toHaveBeenCalledWith(
      null,
      "",
      "/writing/reports/report-2/compare",
    );
    await screen.findByText("updated previous answer");
    expect(
      screen.getByTestId("comparison-summary-strip").textContent,
    ).toContain("64");
    expect(appApiMocks.notification.success).toHaveBeenCalledWith({
      title: "비교 리포트를 갱신했어요",
    });

    fireEvent.click(screen.getByTestId("comparison-action-change-target"));
    const selectedOption = screen
      .getAllByTestId("comparison-target-option")
      .find(
        (option) => option.getAttribute("data-submission-id") === "previous-2",
      );
    expect(selectedOption?.getAttribute("data-selected")).toBe("true");
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

    expect(
      screen.queryByTestId("comparison-target-same-problem"),
    ).not.toBeTruthy();
    expect(screen.queryByText("같은 문제만")).not.toBeTruthy();
    expect(screen.getByTestId("comparison-target-empty")).toBeTruthy();
    expect(
      (screen.getByTestId("comparison-target-confirm") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("renders blank-level comparison instead of empty charts for Q51", () => {
    renderReports(
      <ComparisonReportView
        metrics={{
          score_delta: 20,
          dimension_deltas: { blank_1: 40, blank_2: 0 },
          char_delta: 2,
          no_previous: false,
        }}
        narrative="이번 답안의 총점이 20점 향상되었습니다. 주요 변화: ㄱ 빈칸 +40점."
        currentText="ㄱ: 현재 답안\nㄴ: 현재 두 번째"
        previousText="ㄱ: 이전 답안\nㄴ: 이전 두 번째"
        retryHref="/writing/51?retry=sub-1"
        reportId="report-51"
        currentScore={40}
        chartData={[]}
        currentNorm={{ blank_1: 80, blank_2: 40 }}
        hasPrevious
        currentSubmissionId="current-51"
        currentQuestionNo={51}
        currentSubmittedAt="2026-06-20T10:00:00.000Z"
        selectedPreviousSubmissionId="previous-51"
        comparisonTargets={[
          {
            submissionId: "previous-51",
            questionNo: 51,
            problemId: "problem-51",
            submittedAt: "2026-06-19T10:00:00.000Z",
            feedbackStatus: "complete",
            score: 2,
            scoreMax: 10,
            charCount: 16,
            isSelected: true,
            isRecommended: true,
            isDisabled: false,
          },
        ]}
        showBlankComparison
        hasBlankTraitData
        blankComparisons={[
          {
            key: "blank_1",
            delta: 40,
            rawDelta: 2,
            currentAnswer: "현재 답안",
            previousAnswer: "이전 답안",
            current: {
              key: "blank_1",
              kind: "blank",
              normalizedScore: 80,
              rawScore: 4,
              scoreMax: 5,
              summary: "문맥에 맞게 보완했습니다.",
              strengths: ["핵심 의미가 분명합니다."],
              improvements: ["종결 표현을 더 자연스럽게 다듬어 보세요."],
            },
            previous: {
              key: "blank_1",
              kind: "blank",
              normalizedScore: 40,
              rawScore: 2,
              scoreMax: 5,
              summary: "문맥 정보가 부족했습니다.",
              strengths: [],
              improvements: [],
            },
          },
          {
            key: "blank_2",
            delta: 0,
            rawDelta: 0,
            currentAnswer: "현재 두 번째",
            previousAnswer: "이전 두 번째",
            current: {
              key: "blank_2",
              kind: "blank",
              normalizedScore: 40,
              rawScore: 2,
              scoreMax: 5,
              summary: null,
              strengths: [],
              improvements: [],
            },
            previous: {
              key: "blank_2",
              kind: "blank",
              normalizedScore: 40,
              rawScore: 2,
              scoreMax: 5,
              summary: null,
              strengths: [],
              improvements: [],
            },
          },
        ]}
      />,
    );

    const blankPanel = screen.getByTestId("comparison-blank-trait-panel");
    expect(blankPanel).toBeTruthy();
    expect(blankPanel.tagName).toBe("SECTION");
    expect(blankPanel.className).not.toContain("ant-card");
    expect(blankPanel.className).not.toContain("app-card");
    const blankHeader = within(blankPanel).getByTestId(
      "comparison-blank-section-header",
    );
    expect(blankHeader.className).toContain("!mb-[40px]");
    expect(blankHeader.className).not.toContain("mb-4");
    expect(blankHeader.querySelector(".ant-tag")).toBeNull();
    const blankTitle = within(blankHeader).getByText("빈칸별 점수 비교");
    expect(blankTitle).toBeTruthy();
    expect(screen.getByText("ㄱ 빈칸")).toBeTruthy();
    expect(screen.queryAllByText("비교 항목")).toHaveLength(0);
    expect(screen.getByText("4/5점")).toBeTruthy();
    expect(
      screen.getAllByTestId("comparison-blank-score-normalized")[0].textContent,
    ).toBe("(환산 80점)");
    expect(screen.queryByTestId("comparison-blank-attempt-section")).toBeNull();
    const blankCards = screen.getAllByTestId("comparison-blank-trait-row");
    expect(blankCards).toHaveLength(2);
    expect(
      screen.queryAllByTestId("comparison-blank-trait-delta"),
    ).toHaveLength(0);
    const blankRowsGrid = blankCards[0].parentElement;
    expect(blankRowsGrid?.className).toContain("grid");
    expect(blankRowsGrid?.className).toContain("gap-10");
    expect(blankRowsGrid?.className).not.toContain("gap-3");
    expect(blankRowsGrid?.className).not.toContain("lg:grid-cols-2");

    const firstBlankCard = blankCards[0];
    expect(firstBlankCard.className).not.toContain("rounded-lg");
    expect(firstBlankCard.className).not.toContain("border-border");
    expect(firstBlankCard.className).not.toContain("bg-background");
    expect(firstBlankCard.className).not.toContain("p-4");
    expect(firstBlankCard.textContent).toContain("ㄱ 빈칸");
    expect(firstBlankCard.textContent).not.toContain("원점수 +2점");
    const firstBlankCurrent = within(firstBlankCard).getByTestId(
      "comparison-blank-answer-feedback-current",
    );
    const firstBlankPrevious = within(firstBlankCard).getByTestId(
      "comparison-blank-answer-feedback-previous",
    );
    const answerFeedbackGrid = firstBlankCurrent.parentElement;
    expect(answerFeedbackGrid).toBe(firstBlankPrevious.parentElement);
    expect(answerFeedbackGrid?.className).toContain("mt-6");
    expect(answerFeedbackGrid?.className).not.toContain("mt-4");
    expect(answerFeedbackGrid?.className).toContain("lg:grid-cols-2");
    expect(firstBlankCurrent.className).toContain("ant-card");
    expect(firstBlankCurrent.className).toContain("app-card");
    expect(firstBlankCurrent.className).toContain("app-surface");
    expect(firstBlankCurrent.className).toContain("h-full");
    expect(firstBlankCurrent.className).toContain("lg:col-start-1");
    expect(firstBlankPrevious.className).toContain("ant-card");
    expect(firstBlankPrevious.className).toContain("app-card");
    expect(firstBlankPrevious.className).toContain("app-surface");
    expect(firstBlankPrevious.className).toContain("h-full");
    expect(firstBlankPrevious.className).toContain("lg:col-start-2");
    expect(
      within(firstBlankCurrent)
        .getByTestId("comparison-blank-answer-feedback-current-answer")
        .closest(".ant-card"),
    ).toBe(firstBlankCurrent);
    expect(
      within(firstBlankCurrent).getByTestId(
        "comparison-blank-answer-feedback-current-answer",
      ).className,
    ).not.toContain("rounded-lg");
    expect(
      within(firstBlankCurrent).getByTestId(
        "comparison-blank-answer-feedback-current-answer",
      ).className,
    ).not.toContain("bg-[var(--app-color-bg-layout)]");
    expect(
      within(firstBlankCurrent).getByTestId(
        "comparison-blank-answer-feedback-current-answer-label",
      ).className,
    ).toContain("!text-[14px]");
    expect(
      within(firstBlankCurrent).getByTestId(
        "comparison-blank-answer-feedback-current-answer-label",
      ).className,
    ).not.toContain("text-sm");
    expect(
      within(firstBlankCurrent)
        .getByTestId("comparison-blank-answer-feedback-current-feedback")
        .closest(".ant-card"),
    ).toBe(firstBlankCurrent);
    expect(
      within(firstBlankCurrent).getByTestId(
        "comparison-blank-answer-feedback-current-feedback",
      ).className,
    ).not.toContain("rounded-lg");
    expect(
      within(firstBlankCurrent).getByTestId(
        "comparison-blank-answer-feedback-current-feedback",
      ).className,
    ).not.toContain("bg-[var(--app-color-bg-layout)]");
    expect(
      within(firstBlankCurrent).getByTestId(
        "comparison-blank-answer-feedback-current-feedback-label",
      ).className,
    ).toContain("!text-[14px]");
    expect(
      within(firstBlankCurrent).getByTestId(
        "comparison-blank-answer-feedback-current-feedback-label",
      ).className,
    ).not.toContain("text-sm");
    expect(
      within(firstBlankCurrent).getByTestId(
        "comparison-blank-answer-feedback-current-feedback-support-list",
      ).className,
    ).not.toContain("pl-5");
    expect(
      within(firstBlankCurrent).getByTestId(
        "comparison-blank-answer-feedback-current-feedback-support-list",
      ).className,
    ).toContain("list-none");
    const currentFeedbackSupportIcons = within(
      firstBlankCurrent,
    ).getAllByTestId(
      "comparison-blank-answer-feedback-current-feedback-support-icon",
    );
    expect(currentFeedbackSupportIcons).toHaveLength(2);
    currentFeedbackSupportIcons.forEach((icon) => {
      expect(icon.tagName.toLowerCase()).toBe("svg");
      expect(icon.getAttribute("width")).toBe("16");
      expect(icon.getAttribute("height")).toBe("16");
      expect(icon.getAttribute("aria-hidden")).toBe("true");
    });
    expect(
      within(firstBlankPrevious)
        .getByTestId("comparison-blank-answer-feedback-previous-answer")
        .closest(".ant-card"),
    ).toBe(firstBlankPrevious);
    expect(
      within(firstBlankPrevious).getByTestId(
        "comparison-blank-answer-feedback-previous-answer-label",
      ).className,
    ).toContain("!text-[14px]");
    expect(
      within(firstBlankPrevious)
        .getByTestId("comparison-blank-answer-feedback-previous-feedback")
        .closest(".ant-card"),
    ).toBe(firstBlankPrevious);
    expect(
      within(firstBlankPrevious).getByTestId(
        "comparison-blank-answer-feedback-previous-feedback-label",
      ).className,
    ).toContain("!text-[14px]");
    expect(firstBlankCurrent.textContent).toContain("현재 답안");
    expect(firstBlankCurrent.textContent).toContain("이번 답안 피드백");
    expect(firstBlankCurrent.textContent?.indexOf("현재 답안")).toBeLessThan(
      firstBlankCurrent.textContent?.indexOf("이번 답안 피드백") ?? -1,
    );
    expect(firstBlankPrevious.textContent).toContain("이전 답안");
    expect(firstBlankPrevious.textContent).toContain("이전 답안 피드백");
    expect(firstBlankPrevious.textContent?.indexOf("이전 답안")).toBeLessThan(
      firstBlankPrevious.textContent?.indexOf("이전 답안 피드백") ?? -1,
    );
    expect(firstBlankCard.textContent?.indexOf("이번 답안")).toBeLessThan(
      firstBlankCard.textContent?.indexOf("이전 답안") ?? -1,
    );
    const secondBlankCard = blankCards[1];
    expect(secondBlankCard.textContent).toContain("ㄴ 빈칸");
    expect(secondBlankCard.textContent).toContain("현재 두 번째");
    expect(secondBlankCard.textContent).toContain("이전 두 번째");

    expect(
      within(firstBlankCard).queryByTestId("comparison-blank-score-meter"),
    ).toBeNull();
    const scoreArea = within(firstBlankCard).getByTestId(
      "comparison-blank-score-area",
    );
    expect(scoreArea.className).toContain("mt-4");
    expect(scoreArea.className).toContain("lg:grid-cols-2");
    expect(scoreArea.className).toContain("gap-3");
    const scoreAreaContent = within(firstBlankCard).getByTestId(
      "comparison-blank-score-area-content",
    );
    const scoreRows = within(firstBlankCard).getAllByTestId(
      "comparison-blank-score-row",
    );
    expect(scoreRows).toHaveLength(2);
    scoreRows.forEach((row) => {
      expect(row.parentElement).toBe(scoreAreaContent);
    });
    expect(
      within(firstBlankCard).getByTestId("comparison-blank-score-current")
        .textContent,
    ).toContain("이번 답안");
    expect(
      within(firstBlankCard).getByTestId("comparison-blank-score-current")
        .textContent,
    ).toContain("4/5점");
    expect(
      within(firstBlankCard).getByTestId("comparison-blank-score-current")
        .textContent,
    ).toContain("(환산 80점)");
    expect(
      within(firstBlankCard).getByTestId("comparison-blank-score-previous")
        .textContent,
    ).toContain("이전 답안");
    expect(
      within(firstBlankCard).getByTestId("comparison-blank-score-previous")
        .textContent,
    ).toContain("2/5점");
    expect(
      within(firstBlankCard).getByTestId("comparison-blank-score-previous")
        .textContent,
    ).toContain("(환산 40점)");
    expect(
      within(firstBlankCard).getAllByTestId("comparison-blank-score-value")[1]
        .textContent,
    ).not.toContain(" / ");
    expect(
      within(firstBlankCard).getAllByTestId(
        "comparison-blank-score-normalized",
      )[1].className,
    ).toContain("!text-[14px]");
    expect(within(firstBlankCard).queryByText("→")).toBeNull();
    expect(screen.queryByTestId("comparison-chart")).toBeNull();
    expect(screen.queryByTestId("comparison-dimension-cards")).toBeNull();
    expect(screen.queryByTestId("comparison-submission-diff")).toBeNull();
  });
});
