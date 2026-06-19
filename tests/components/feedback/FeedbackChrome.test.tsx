// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithIntl } from "../../test-utils/renderWithIntl";
import { FeedbackSummary } from "../../../src/components/feedback/FeedbackSummary";
import { DimensionCardGrid } from "../../../src/components/feedback/DimensionCardGrid";
import { SentenceFeedbackList } from "../../../src/components/feedback/SentenceFeedbackList";
import { DetailedFeedbackPanel } from "../../../src/components/feedback/DetailedFeedbackPanel";
import { FeedbackRecommendationCards } from "../../../src/components/feedback/FeedbackRecommendationCards";
import { FeedbackPageContent } from "../../../src/components/feedback/FeedbackPageContent";
import type {
  FeedbackBundle,
  FeedbackDimensionScoreRow,
  SentenceFeedbackRow,
  WritingFeedbackRow,
  WritingSubmissionRow,
} from "../../../src/lib/writing/types";

// router is only used on click paths exercised here indirectly; stub it so the
// next/navigation import resolves under jsdom.
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

vi.mock("@/lib/export/pdf-export-client", () => ({
  exportPdfWithPrintFallback: vi.fn(),
}));

vi.mock("@/lib/library/mutations", () => ({
  useSaveLibraryItem: () => ({
    isPending: false,
    mutate: vi.fn(),
  }),
}));

vi.mock("@/lib/writing/mutations", () => ({
  useCreateComparisonReport: () => ({
    isPending: false,
    mutate: vi.fn(),
  }),
}));

// Minimal fixture builders — only the fields the chrome reads. Cast through
// unknown because the real rows are generated Supabase table types with many
// non-null columns the UI never touches.
function feedback(overrides: Partial<WritingFeedbackRow>): WritingFeedbackRow {
  return {
    status: "complete",
    score_total: 80,
    score_max: 100,
    overall_summary: null,
    ...overrides,
  } as unknown as WritingFeedbackRow;
}

function dim(
  overrides: Partial<FeedbackDimensionScoreRow>,
): FeedbackDimensionScoreRow {
  return {
    dimension: "grammar",
    score: 70,
    score_max: 100,
    weakness_level: null,
    summary: null,
    ...overrides,
  } as unknown as FeedbackDimensionScoreRow;
}

function sentence(
  overrides: Partial<SentenceFeedbackRow>,
): SentenceFeedbackRow {
  return {
    id: "s-1",
    original_text: "원문",
    corrected_text: "고침",
    comment: "설명",
    ...overrides,
  } as unknown as SentenceFeedbackRow;
}

function submission(
  overrides: Partial<WritingSubmissionRow> = {},
): WritingSubmissionRow {
  return {
    id: "sub-1",
    user_id: "user-1",
    problem_id: "problem-1",
    question_no: 51,
    feedback_status: "complete",
    ...overrides,
  } as unknown as WritingSubmissionRow;
}

beforeEach(() => {
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
});

describe("FeedbackSummary (i18n chrome)", () => {
  it("renders the score title and the overall-summary fallback when summary is null", () => {
    renderWithIntl(
      <FeedbackSummary feedback={feedback({ overall_summary: null })} />,
    );
    expect(screen.getByText("총평 점수")).toBeTruthy();
    expect(screen.getByText("총평이 준비되는 중입니다.")).toBeTruthy();
  });

  it("renders the score-failed alert when status is failed", () => {
    renderWithIntl(
      <FeedbackSummary
        feedback={feedback({ status: "failed", score_total: null })}
      />,
    );
    expect(screen.getByText("점수를 산출하지 못했어요")).toBeTruthy();
  });
});

describe("DimensionCardGrid (i18n chrome)", () => {
  it("renders the localized dimension label and summary fallback", () => {
    renderWithIntl(
      <DimensionCardGrid
        rows={[dim({ dimension: "topic_fit", score: 90, summary: null })]}
        maxCards={1}
      />,
    );
    // topic_fit label in the dimension grid is the 적합도 variant.
    expect(screen.getByText("주제 적합도")).toBeTruthy();
    expect(screen.getByText("요약 없음")).toBeTruthy();
  });

  it("shows the analysis-failed text + reanalyze CTA for a null-score dimension", () => {
    renderWithIntl(
      <DimensionCardGrid
        rows={[dim({ dimension: "grammar", score: null })]}
        maxCards={1}
        onReanalyze={vi.fn()}
      />,
    );
    expect(screen.getByText("이 항목은 분석에 실패했어요.")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "다시 분석하기" }),
    ).toBeTruthy();
  });
});

describe("SentenceFeedbackList (i18n chrome)", () => {
  it("renders the empty-state copy when there are no rows", () => {
    renderWithIntl(<SentenceFeedbackList rows={[]} />);
    expect(screen.getByText("문장별 첨삭이 없습니다.")).toBeTruthy();
  });

  it("renders the ICU 'show more' count when rows exceed the initial window", () => {
    const rows = Array.from({ length: 7 }, (_, i) =>
      sentence({ id: `s-${i}` }),
    );
    renderWithIntl(<SentenceFeedbackList rows={rows} />);
    // 7 rows, 5 shown initially → 2 hidden.
    expect(screen.getByText("더보기 (2개)")).toBeTruthy();
  });
});

describe("DetailedFeedbackPanel (i18n chrome)", () => {
  it("renders the empty-state copy when no detail dimensions are present", () => {
    renderWithIntl(<DetailedFeedbackPanel dimensions={[]} />);
    expect(
      screen.getByText(
        "세부 평가가 아직 준비되지 않았어요. 다시 분석하면 항목별 상세 평가를 볼 수 있어요.",
      ),
    ).toBeTruthy();
  });

  it("renders the card title + localized detail label", () => {
    renderWithIntl(
      <DetailedFeedbackPanel
        dimensions={[dim({ dimension: "content", score: 60, summary: "ok" })]}
      />,
    );
    expect(screen.getAllByText("상세 피드백").length).toBeGreaterThan(0);
    // content maps to '논리' in the detail panel.
    expect(screen.getByText("논리")).toBeTruthy();
  });
});

describe("FeedbackRecommendationCards (i18n chrome)", () => {
  it("renders the empty-state CTA when no rankable dimensions exist", () => {
    renderWithIntl(<FeedbackRecommendationCards dimensions={[]} />);
    expect(
      screen.getByText("이번 답안에서는 추천할 약점 영역을 찾지 못했어요."),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "문제 목록 보기" }),
    ).toBeTruthy();
  });

  it("renders a recommendation card title for the weakest dimension", () => {
    renderWithIntl(
      <FeedbackRecommendationCards
        dimensions={[
          dim({
            dimension: "grammar",
            score: 40,
            weakness_level: 3,
            summary: "Dynamic grammar feedback from the stored analysis.",
          }),
        ]}
      />,
    );
    expect(
      screen.getByText("Dynamic grammar feedback from the stored analysis."),
    ).toBeTruthy();
    expect(screen.getByText("문법 집중 연습")).toBeTruthy();
  });
});

describe("FeedbackPageContent (short feedback fallback)", () => {
  it("renders the short-answer report overview from external trait scores and learning focus areas", () => {
    const bundle: FeedbackBundle = {
      feedback: feedback({
        score_total: 0,
        score_max: 10,
        overall_summary: "두 빈칸 모두 내용과 표현 면에서 추가적인 연습이 필요합니다.",
        raw_ai_result: {
          time_spent: 1127,
          processing_time_seconds: 16.16,
          trait_scores: [
            {
              trait: "blank_1",
              trait_korean: "빈칸 ㉠",
              score: 0,
              weight: 0.25,
              feedback: "첫 번째 빈칸은 문제 맥락에 맞는 격식체 표현이 필요합니다.",
              improvements: ["격식체(-습니다/습니까) 사용 연습"],
            },
            {
              trait: "blank_2",
              trait_korean: "빈칸 ㉡",
              score: 0,
              weight: 0.25,
              feedback: "두 번째 빈칸은 문장 완성도와 어휘 선택을 다시 점검해야 합니다.",
              improvements: ["상황에 맞는 정중한 표현 익히기"],
            },
          ],
          combined_feedback: {
            focus_areas: [
              "격식체(-습니다/습니까) 사용 연습",
              "상황에 맞는 정중한 표현 익히기",
              "무의미한 문자 입력 금지",
            ],
            study_tips: "문제의 맥락을 먼저 파악한 뒤 문장을 완성해 보세요.",
          },
        },
      }),
      dimensions: [],
      sentences: [],
    };

    renderWithIntl(
      <FeedbackPageContent
        submission={submission({
          question_no: 51,
          submitted_at: "2026-06-18T10:06:00.000Z",
        })}
        bundle={bundle}
        withSentences
        showDetailPanel={false}
        dimensionCardLimit={4}
        reloadHref="/writing/feedback/short/sub-1"
        userId="user-1"
        saveLocked
      />,
    );

    expect(screen.getByTestId("feedback-report-overview")).toBeTruthy();
    expect(screen.getByText("51번 피드백 리포트")).toBeTruthy();
    expect(screen.getByText("제출일 2026.06.18 19:06")).toBeTruthy();
    expect(screen.getByText("소요 시간 18분 47초")).toBeTruthy();
    expect(screen.queryByText("AI 분석 16.16초")).toBeNull();
    expect(screen.getByText("이번 점수")).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.getByText("/ 10점")).toBeTruthy();
    expect(screen.getByText("빈칸별 점수")).toBeTruthy();
    expect(screen.getByText("㉠ 빈칸")).toBeTruthy();
    expect(screen.getByText("㉡ 빈칸")).toBeTruthy();
    expect(screen.getAllByText("0점")).toHaveLength(2);
    expect(screen.getAllByText("배점 2.5점")).toHaveLength(2);
    expect(screen.getByText("다음 보완 포인트")).toBeTruthy();
    expect(screen.getAllByText("무의미한 문자 입력 금지").length).toBeGreaterThan(
      0,
    );
  });

  it("uses raw trait scores in the report and raw combined feedback for recommended learning", () => {
    const bundle: FeedbackBundle = {
      feedback: feedback({
        raw_ai_result: {
          trait_scores: [
            {
              trait: "blank_1",
              score: 0,
              feedback: "Use a sentence that fits the first blank.",
            },
          ],
          combined_feedback: {
            focus_areas: ["formal endings"],
            study_tips: "Start by matching the prompt context.",
          },
        },
      }),
      dimensions: [],
      sentences: [],
    };

    renderWithIntl(
      <FeedbackPageContent
        submission={submission()}
        bundle={bundle}
        withSentences
        showDetailPanel={false}
        dimensionCardLimit={4}
        reloadHref="/writing/feedback/short/sub-1"
        userId="user-1"
        saveLocked
      />,
    );

    expect(screen.getByTestId("feedback-report-overview")).toBeTruthy();
    expect(screen.queryAllByTestId("feedback-dimension-card")).toHaveLength(0);
    expect(screen.getAllByTestId("feedback-report-score-item")).toHaveLength(1);
    expect(
      screen.getByText("Use a sentence that fits the first blank."),
    ).toBeTruthy();
    expect(screen.getByTestId("external-learning-feedback")).toBeTruthy();
    expect(screen.queryByTestId("external-trait-feedback-grid")).toBeNull();
  });
});
