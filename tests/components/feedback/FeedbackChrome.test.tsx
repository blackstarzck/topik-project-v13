// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithIntl } from "../../test-utils/renderWithIntl";
import { FeedbackSummary } from "../../../src/components/feedback/FeedbackSummary";
import { DimensionCardGrid } from "../../../src/components/feedback/DimensionCardGrid";
import { SentenceFeedbackList } from "../../../src/components/feedback/SentenceFeedbackList";
import { DetailedFeedbackPanel } from "../../../src/components/feedback/DetailedFeedbackPanel";
import { FeedbackRecommendationCards } from "../../../src/components/feedback/FeedbackRecommendationCards";
import type {
  FeedbackDimensionScoreRow,
  SentenceFeedbackRow,
  WritingFeedbackRow,
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
        dimensions={[dim({ dimension: "grammar", score: 40, weakness_level: 3 })]}
      />,
    );
    expect(screen.getByText("문법 집중 연습")).toBeTruthy();
  });
});
