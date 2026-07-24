// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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

const routerPushMock = vi.hoisted(() => vi.fn());
const exportPdfMock = vi.hoisted(() => vi.fn());

// router is only used on click paths exercised here indirectly; stub it so the
// next/navigation import resolves under jsdom.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/lib/export/pdf-export-client", () => ({
  exportPdfWithPrintFallback: exportPdfMock,
}));

const libraryMutationMock = vi.hoisted(() => ({
  mutate: vi.fn(),
  isDuplicateLibrarySaveError: vi.fn((error: unknown) => {
    const err = error as {
      code?: string;
      details?: string | null;
      message?: string | null;
    };
    return (
      err.code === "23505" &&
      `${err.message ?? ""} ${err.details ?? ""}`.includes(
        "library_items_user_submission_uniq",
      )
    );
  }),
}));

vi.mock("@/lib/library/mutations", () => ({
  useSaveLibraryItem: () => ({
    isPending: false,
    mutate: libraryMutationMock.mutate,
  }),
  isDuplicateLibrarySaveError: libraryMutationMock.isDuplicateLibrarySaveError,
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
    answer_text: "",
    answer_json: null,
    ...overrides,
  } as unknown as WritingSubmissionRow;
}

beforeEach(() => {
  routerPushMock.mockReset();
  exportPdfMock.mockReset();
  exportPdfMock.mockResolvedValue({ mode: "file", exportId: "export-1" });
  libraryMutationMock.mutate.mockReset();
  libraryMutationMock.isDuplicateLibrarySaveError.mockClear();
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

  it("does not clamp the overall summary copy", () => {
    const longSummary =
      "전체 점수는 3/30점입니다. 기초부터 차근차근 다시 정리해 보겠습니다. 세 영역 모두 F등급으로 고르게 작성되었습니다. 내용 감점 내역과 구성 감점 내역, 언어 사용 감점 내역을 모두 확인해야 합니다.";

    renderWithIntl(
      <FeedbackSummary feedback={feedback({ overall_summary: longSummary })} />,
    );

    const summary = screen.getByText(longSummary);
    expect(summary.className).not.toContain("ant-typography-ellipsis");
    expect(summary.getAttribute("style") ?? "").not.toContain("line-clamp");
  });

  it("emphasizes the top summary score value at 46px and weight 700", () => {
    renderWithIntl(
      <FeedbackSummary
        feedback={feedback({ score_total: 3, score_max: 30 })}
      />,
    );

    const score = screen.getByTestId("feedback-summary-score");
    expect(score.className).toContain(
      "[&_.ant-statistic-content-value]:text-[46px]",
    );
    expect(score.className).toContain(
      "[&_.ant-statistic-content-value]:font-bold",
    );
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
    expect(screen.getByRole("button", { name: "다시 분석하기" })).toBeTruthy();
  });

  it("shows a long dimension summary in full without a line clamp", () => {
    const longSummary =
      "문법과 어휘 선택의 근거부터 문장 연결 방식과 다음 연습 방법까지 사용자가 확인해야 하는 정보를 끝까지 보여 주는 긴 피드백입니다.";

    renderWithIntl(
      <DimensionCardGrid
        rows={[dim({ dimension: "grammar", summary: longSummary })]}
        maxCards={1}
      />,
    );

    const summary = screen.getByText(longSummary);
    expect(summary.className).not.toMatch(/\bline-clamp-\d+\b/);
    expect(summary.className).not.toContain("truncate");
    expect(summary.getAttribute("style") ?? "").not.toContain("line-clamp");
  });
});

describe("SentenceFeedbackList (i18n chrome)", () => {
  // 51/52는 답안 줄("ㄱ: …")에 첨삭 원문을 대조해 그룹을 만든다.
  const shortAnchorProps = {
    questionNo: 51,
    answerText: "ㄱ: 그러므로 시작합니다\nㄴ: 하지만 마무리합니다",
    answerJson: null,
  };

  it("renders the empty-state copy when there are no rows", () => {
    renderWithIntl(<SentenceFeedbackList rows={[]} {...shortAnchorProps} />);
    expect(screen.getByText("문장별 첨삭이 없습니다.")).toBeTruthy();
  });

  it("uses the shared content section title structure", () => {
    renderWithIntl(
      <SentenceFeedbackList
        rows={[sentence({ id: "s-title" })]}
        {...shortAnchorProps}
      />,
    );

    const title = screen.getByRole("heading", {
      level: 5,
      name: "문장별 첨삭",
    });
    expect(title.tagName).toBe("H5");
    expect(title.className).toContain("ant-typography");
    expect(title.className).toContain("m-0");
  });

  it("renders the ICU 'show more' count when rows exceed the initial window", () => {
    const rows = Array.from({ length: 7 }, (_, i) =>
      sentence({ id: `s-${i}` }),
    );
    renderWithIntl(<SentenceFeedbackList rows={rows} {...shortAnchorProps} />);
    // 7 rows, 5 shown initially → 2 hidden.
    expect(screen.getByText("더보기 (2개)")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });

  it("renders correction cards with before, after, and reason columns", () => {
    renderWithIntl(
      <SentenceFeedbackList
        rows={[
          sentence({
            id: "s-correction",
            original_text: "그러므로",
            corrected_text: "하지만",
            comment: "앞뒤 문장의 대조 관계를 자연스럽게 연결합니다.",
          }),
        ]}
        {...shortAnchorProps}
      />,
    );

    expect(screen.getByText("ㄱ")).toBeTruthy();
    expect(screen.queryByText("빈칸")).toBeNull();
    expect(screen.getByText("Before (내 답안)")).toBeTruthy();
    expect(screen.getByText("After (권장 표현)")).toBeTruthy();
    expect(screen.getByText("교정 이유")).toBeTruthy();
    expect(screen.getByTestId("feedback-sentence-before")).toBeTruthy();
    expect(screen.getByTestId("feedback-sentence-after")).toBeTruthy();
    expect(screen.getByTestId("feedback-sentence-reason")).toBeTruthy();
  });

  it("labels only the blanks that exist in the answer and never invents ㄷ/ㄹ", () => {
    renderWithIntl(
      <SentenceFeedbackList
        rows={[
          sentence({ id: "s-1", original_text: "그러므로" }),
          sentence({ id: "s-2", original_text: "하지만" }),
          sentence({ id: "s-3", original_text: "" }),
          sentence({ id: "s-4", original_text: "답안에 없는 텍스트" }),
        ]}
        {...shortAnchorProps}
      />,
    );

    const labels = screen
      .getAllByTestId("feedback-sentence-group-label")
      .map((node) => node.textContent);
    expect(labels).toEqual(["ㄱ", "ㄴ", "전체"]);
    expect(screen.queryByText("ㄷ")).toBeNull();
    expect(screen.queryByText("ㄹ")).toBeNull();
  });

  it("groups long feedback under one header per matched section", () => {
    renderWithIntl(
      <SentenceFeedbackList
        questionNo={53}
        answerText={null}
        answerJson={{
          _v: "53.v1",
          sections: {
            intro: "서론 원문입니다",
            body: "본론 원문입니다",
            conclusion: "결론 원문입니다",
          },
        }}
        rows={[
          sentence({ id: "s-long-intro", original_text: "서론 원문" }),
          sentence({ id: "s-long-body-1", original_text: "본론 원문" }),
          sentence({ id: "s-long-body-2", original_text: "본론 원문입니다" }),
          sentence({ id: "s-long-conclusion", original_text: "결론 원문" }),
        ]}
      />,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    const labels = screen
      .getAllByTestId("feedback-sentence-group-label")
      .map((node) => node.textContent);
    // 본론 첨삭이 2개여도 헤더는 1번만 나타난다.
    expect(labels).toEqual(["서론", "본론", "결론"]);
  });

  it("sends document-level long annotations to the 전체 group", () => {
    renderWithIntl(
      <SentenceFeedbackList
        questionNo={53}
        answerText={"서론입니다.\n\n본론입니다.\n\n결론입니다."}
        answerJson={null}
        rows={[
          sentence({
            id: "s-doc",
            original_text: "",
            corrected_text: null,
            comment: "문단을 나누어 구조를 분명히 하세요.",
          }),
        ]}
      />,
    );

    const labels = screen
      .getAllByTestId("feedback-sentence-group-label")
      .map((node) => node.textContent);
    expect(labels).toEqual(["전체"]);
    expect(screen.queryByText("서론")).toBeNull();
    expect(screen.queryByText("본론")).toBeNull();
    expect(screen.queryByText("결론")).toBeNull();
    // 빈 원문의 문서 수준 조언은 "입력된 답안이 없습니다" 대신 전용 문구를 쓴다.
    expect(screen.getByText("글 전체에 대한 조언입니다.")).toBeTruthy();
    expect(screen.getByText("해당 없음")).toBeTruthy();
    expect(screen.queryByText("입력된 답안이 없습니다.")).toBeNull();
    expect(screen.queryByText("권장 표현을 만들지 못했어요.")).toBeNull();
  });

  it("uses a chevron between before and after correction cards", () => {
    renderWithIntl(
      <SentenceFeedbackList
        rows={[
          sentence({
            id: "s-correction-icon",
            original_text: "Before",
            corrected_text: "After",
          }),
        ]}
        {...shortAnchorProps}
      />,
    );

    const beforeCard = screen.getByTestId("feedback-sentence-before");
    const connector = beforeCard.nextElementSibling;

    expect(connector?.querySelector("svg")).toBeTruthy();
  });

  it("renders sentence feedback without an outer card or row dividers", () => {
    renderWithIntl(
      <SentenceFeedbackList
        rows={[sentence({ id: "s-border-1" }), sentence({ id: "s-border-2" })]}
        {...shortAnchorProps}
      />,
    );

    expect(
      screen.getByTestId("feedback-sentence-card").className,
    ).not.toContain("app-card");
    for (const item of screen.getAllByRole("listitem")) {
      expect(item.className).not.toContain("border-b");
    }
  });
});

describe("DetailedFeedbackPanel (i18n chrome)", () => {
  it("does not render when no detail dimensions are present", () => {
    renderWithIntl(<DetailedFeedbackPanel dimensions={[]} />);
    expect(screen.queryByTestId("feedback-detail-panel")).toBeNull();
  });

  it("omits content and structure dimensions already shown in the overview", () => {
    renderWithIntl(
      <DetailedFeedbackPanel
        dimensions={[
          dim({ dimension: "content", score: 60, summary: "content summary" }),
          dim({
            dimension: "structure",
            score: 55,
            summary: "structure summary",
          }),
          dim({ dimension: "grammar", score: 70, summary: "grammar summary" }),
        ]}
      />,
    );
    const title = screen.getByRole("heading", {
      level: 5,
      name: "상세 피드백",
    });
    expect(title.className).toContain("m-0");
    expect(screen.getByTestId("feedback-detail-panel").className).not.toContain(
      "app-card",
    );
    expect(screen.getByText("문법")).toBeTruthy();
    expect(screen.queryByText("논리")).toBeNull();
    expect(screen.queryByText("구조")).toBeNull();
  });

  it("shows detailed feedback in full without ellipsis or an expand action", () => {
    const longSummary =
      "이 상세 피드백은 사용자가 문법 문제의 원인과 수정 방향, 다음 연습 방법을 한 번에 확인할 수 있도록 마지막 문장까지 기본 상태에서 모두 보여 줍니다.";

    renderWithIntl(
      <DetailedFeedbackPanel
        dimensions={[
          dim({ dimension: "grammar", score: 70, summary: longSummary }),
        ]}
      />,
    );

    const summary = screen.getByText(longSummary);
    expect(summary.className).not.toContain("ant-typography-ellipsis");
    expect(summary.getAttribute("style") ?? "").not.toContain("line-clamp");
    expect(screen.queryByText("더보기")).toBeNull();
  });
});

describe("FeedbackRecommendationCards (i18n chrome)", () => {
  it("renders three next-study action cards even without rankable dimensions", () => {
    renderWithIntl(
      <FeedbackRecommendationCards
        dimensions={[]}
        retryHref="/writing/51/problem-1"
      />,
    );
    expect(screen.getAllByTestId(/^feedback-reco-action-/)).toHaveLength(3);
    expect(screen.getByText("다시 풀기 (피드백 반영)")).toBeTruthy();
    expect(screen.getByText("유사 문제 풀기")).toBeTruthy();
    expect(screen.getByText("취약 표현 더 공부하기")).toBeTruthy();
  });

  it("uses the weakest dimension summary as the weakness action reason", () => {
    renderWithIntl(
      <FeedbackRecommendationCards
        retryHref="/writing/51/problem-1"
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
    expect(screen.getByText("취약 표현 더 공부하기")).toBeTruthy();
  });
  it("renders recommendations without an outer card and without elevated action shadows", () => {
    renderWithIntl(
      <FeedbackRecommendationCards
        dimensions={[]}
        retryHref="/writing/51/problem-1"
      />,
    );

    const title = screen.getByRole("heading", {
      level: 5,
      name: "추천 학습",
    });
    expect(title.className).toContain("m-0");
    expect(
      screen.getByTestId("feedback-recommendation-card").className,
    ).not.toContain("app-card");
    for (const action of screen.getAllByTestId(/^feedback-reco-action-/)) {
      expect(action.className).not.toContain("ant-card-hoverable");
      expect(action.className).not.toContain("shadow-sm");
      expect(action.className).not.toContain("hover:shadow");
    }
  });

  it("pins recommendation icons at the top and copy at the bottom", () => {
    renderWithIntl(
      <FeedbackRecommendationCards
        dimensions={[]}
        retryHref="/writing/51/problem-1"
      />,
    );

    const action = screen.getByTestId("feedback-reco-action-retry");
    const layout = within(action).getByTestId(
      "feedback-recommendation-layout-retry",
    );
    const leadingIcon = within(action).getByTestId(
      "feedback-recommendation-icon-retry",
    );
    const copy = within(action).getByTestId(
      "feedback-recommendation-copy-retry",
    );
    const arrow = within(action).getByTestId(
      "feedback-recommendation-arrow-retry",
    );

    expect(layout.className).toContain("relative");
    expect(layout.className).toContain("min-h-[190px]");
    expect(layout.className).toContain("flex-col");
    expect(leadingIcon.className).toContain("absolute");
    expect(leadingIcon.className).toContain("left-0");
    expect(leadingIcon.className).toContain("top-0");
    expect(leadingIcon.className).not.toContain("bg-");
    expect(copy.className).not.toContain("mt-auto");
    expect(copy.className).not.toContain("pr-8");
    expect(copy.className).toContain("pr-0");
    expect(copy.className).toContain("pt-[104px]");
    expect(arrow.getAttribute("class") ?? "").toContain(
      "lucide-arrow-up-right",
    );
    expect(arrow.getAttribute("class") ?? "").toContain("absolute");
    expect(arrow.getAttribute("class") ?? "").toContain("right-0");
    expect(arrow.getAttribute("class") ?? "").toContain("top-0");
  });

  it("removes icon backgrounds and aligns recommendation copy starts", () => {
    renderWithIntl(
      <FeedbackRecommendationCards
        dimensions={[]}
        retryHref="/writing/51/problem-1"
      />,
    );

    for (const key of ["retry", "similar", "weakness"]) {
      const icon = screen.getByTestId(`feedback-recommendation-icon-${key}`);
      const copy = screen.getByTestId(`feedback-recommendation-copy-${key}`);

      expect(icon.className).not.toMatch(/\bbg-/);
      expect(icon.className).not.toContain("rounded-md");
      expect(icon.className).toContain("h-6");
      expect(icon.className).toContain("w-6");
      expect(copy.className).not.toContain("pr-8");
      expect(copy.className).toContain("pr-0");
      expect(copy.className).toContain("pt-[104px]");
      expect(copy.className).not.toContain("mt-auto");
    }
  });
});

describe("FeedbackPageContent (short feedback fallback)", () => {
  it("renders a simple failure notice instead of the legacy pending screen when failed feedback has no bundle", () => {
    renderWithIntl(
      <FeedbackPageContent
        submission={submission({ feedback_status: "failed" })}
        bundle={null}
        withSentences={false}
        reloadHref="/writing/feedback/short/sub-1"
        userId="user-1"
      />,
    );

    expect(screen.getByText("피드백을 불러오지 못했어요")).toBeTruthy();
    expect(screen.queryByTestId("analysis-loading-background")).toBeNull();
    expect(screen.queryByTestId("analysis-loading-modal")).toBeNull();
  });

  it("places the short-feedback action group inside the sticky page header", () => {
    const bundle: FeedbackBundle = {
      feedback: feedback({
        raw_ai_result: {
          trait_scores: [
            {
              trait: "blank_1",
              score: 0,
              weight: 0.25,
              feedback: "Use a sentence that fits the first blank.",
            },
          ],
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

    const header = screen.getByTestId("feedback-page-header");
    const body = screen.getByTestId("feedback-page-body");
    const inner = within(header).getByTestId("report-page-header-inner");
    const titleRegion = within(header).getByTestId("report-page-header-title");
    const actionRegion = within(header).getByTestId(
      "report-page-header-actions",
    );
    const title = within(header).getByRole("heading", { level: 3 });
    expect(header.className).toContain("sticky");
    expect(body.className).toContain("gap-12");
    expect(body.className).toContain("pb-32");
    expect(body.className).toContain("sm:pb-40");
    expect(inner.className).toContain("app-workspace-body");
    expect(inner.className).toContain("lg:flex-row");
    expect(titleRegion.contains(title)).toBe(true);
    expect(
      actionRegion.contains(within(header).getByTestId("feedback-actions")),
    ).toBe(true);
    const backLink = within(titleRegion).getByTestId(
      "feedback-header-back-link",
    );
    expect(backLink.getAttribute("href")).toBe("/library");
    expect(backLink.getAttribute("aria-label")).toBe("내 서재로 돌아가기");
    expect(actionRegion.contains(backLink)).toBe(false);
    expect(backLink.querySelector("svg")).toBeTruthy();
    expect(title.className).toContain("!m-0");
    const titleQuestionNo = within(title).getByTestId(
      "feedback-title-question-no",
    );
    expect(titleQuestionNo.textContent).toBe("51");
    expect(titleQuestionNo.textContent).not.toContain("번");
    expect(titleQuestionNo.className).toContain("font-['Space_Grotesk']");
    expect(titleQuestionNo.className).toContain("writing-question-number");
    expect(titleQuestionNo.className).toContain("writing-question-number--q51");
    expect(
      within(header).queryByText("두 빈칸 답안을 기준으로 분석했어요."),
    ).toBeNull();
    expect(within(header).getByTestId("feedback-action-retry")).toBeTruthy();
    expect(within(header).getByTestId("feedback-action-next")).toBeTruthy();
    expect(within(header).getByTestId("feedback-action-pdf")).toBeTruthy();
    expect(within(header).queryByTestId("feedback-action-save")).toBeNull();
    expect(within(header).getByTestId("feedback-action-compare")).toBeTruthy();
    const retryLink = within(header).getByTestId("feedback-action-retry");
    fireEvent.click(retryLink);
    const retryUrl = new URL(
      String(routerPushMock.mock.calls.at(-1)?.[0] ?? ""),
      "https://talkpik.test",
    );
    expect(retryUrl.searchParams.get("returnTo")).toBe(
      "/writing/feedback/short/sub-1",
    );
    expect(screen.getAllByTestId("feedback-actions")).toHaveLength(1);
  });

  it("keeps a semantic library back control when feedback cannot load", () => {
    renderWithIntl(
      <FeedbackPageContent
        submission={submission({ feedback_status: "failed" })}
        bundle={null}
        withSentences
        reloadHref="/writing/feedback/short/sub-1"
        userId="user-1"
      />,
    );

    const backLink = screen.getByTestId("feedback-header-back-link");
    expect(backLink.getAttribute("href")).toBe("/library");
    expect(backLink.getAttribute("aria-label")).toBe("내 서재로 돌아가기");
    expect(screen.getByText("피드백을 불러오지 못했어요")).toBeTruthy();
  });

  it("navigates the short feedback next action to the provided fresh problem URL", () => {
    const bundle: FeedbackBundle = {
      feedback: feedback({ raw_ai_result: {} }),
      dimensions: [],
      sentences: [],
    };
    const nextHref = "/writing/answer-writing-51?problem=next-problem&fresh=1";

    renderWithIntl(
      <FeedbackPageContent
        submission={submission({ question_no: 51 })}
        bundle={bundle}
        withSentences
        showDetailPanel={false}
        dimensionCardLimit={4}
        reloadHref="/writing/feedback/short/sub-1"
        userId="user-1"
        nextHref={nextHref}
      />,
    );

    fireEvent.click(screen.getByTestId("feedback-action-next"));

    expect(routerPushMock).toHaveBeenCalledWith(nextHref);
    expect(routerPushMock).not.toHaveBeenCalledWith("/practice/next");
    expect(nextHref).not.toContain("retrySubmission");
  });

  it("renders the short feedback summary with score and submission metadata", () => {
    const bundle: FeedbackBundle = {
      feedback: feedback({
        score_total: 4,
        score_max: 10,
        overall_summary:
          "두 빈칸 모두 문맥에 맞게 보완해야 하며 질문에서 요구하는 핵심 정보를 포함해야 합니다.",
        raw_ai_result: {},
      }),
      dimensions: [],
      sentences: [],
    };

    renderWithIntl(
      <FeedbackPageContent
        submission={submission({
          question_no: 51,
          char_count: 37,
          submitted_at: "2026-06-29T09:16:00.000Z",
        })}
        bundle={bundle}
        withSentences
        showDetailPanel={false}
        dimensionCardLimit={4}
        reloadHref="/writing/feedback/short/sub-1"
        userId="user-1"
      />,
    );

    const summary = screen.getByTestId("feedback-summary");
    expect(within(summary).getByText("총평 점수")).toBeTruthy();
    expect(within(summary).getByText("4")).toBeTruthy();
    expect(within(summary).getByText("/ 10")).toBeTruthy();
    expect(within(summary).getByTestId("feedback-summary-meta")).toBeTruthy();
    expect(within(summary).getByText("51번 문항")).toBeTruthy();
    expect(within(summary).getByText("37자")).toBeTruthy();
  });

  it("places the long-feedback action group inside the sticky page header", () => {
    const bundle: FeedbackBundle = {
      feedback: feedback({ raw_ai_result: {} }),
      dimensions: [],
      sentences: [],
    };

    renderWithIntl(
      <FeedbackPageContent
        submission={submission({ question_no: 54 })}
        bundle={bundle}
        withSentences
        showSubmissionMeta
        showDimensionGrid={false}
        reloadHref="/writing/feedback/long/sub-1"
        userId="user-1"
      />,
    );

    const header = screen.getByTestId("feedback-page-header");
    const actionRegion = within(header).getByTestId(
      "report-page-header-actions",
    );

    expect(header.className).toContain("sticky");
    const title = within(header).getByRole("heading", {
      name: "54번 피드백 리포트",
    });
    const titleQuestionNo = within(title).getByTestId(
      "feedback-title-question-no",
    );
    expect(titleQuestionNo.textContent).toBe("54");
    expect(titleQuestionNo.textContent).not.toContain("번");
    expect(titleQuestionNo.className).toContain("font-['Space_Grotesk']");
    expect(titleQuestionNo.className).toContain("writing-question-number");
    expect(titleQuestionNo.className).toContain("writing-question-number--q54");
    expect(
      actionRegion.contains(within(header).getByTestId("feedback-actions")),
    ).toBe(true);
    expect(
      within(header).getByTestId("feedback-action-retry").textContent,
    ).toBe("다시 작성");
    expect(screen.getAllByTestId("feedback-actions")).toHaveLength(1);
  });

  it("uses the provided next href for the non-sticky bottom action group", () => {
    const bundle: FeedbackBundle = {
      feedback: feedback({ raw_ai_result: {} }),
      dimensions: [],
      sentences: [],
    };
    const nextHref = "/writing/essay-writing-54?problem=next-problem&fresh=1";

    renderWithIntl(
      <FeedbackPageContent
        submission={submission({ question_no: 54 })}
        bundle={bundle}
        withSentences={false}
        reloadHref="/writing/feedback/long/sub-1"
        userId="user-1"
        nextHref={nextHref}
      />,
    );

    fireEvent.click(screen.getByTestId("feedback-action-next"));

    expect(routerPushMock).toHaveBeenCalledWith(nextHref);
    expect(routerPushMock).not.toHaveBeenCalledWith("/practice/next");
    expect(nextHref).not.toContain("retrySubmission");
  });

  it("renders long feedback with the short-feedback overview section order", () => {
    const bundle: FeedbackBundle = {
      feedback: feedback({ raw_ai_result: {} }),
      dimensions: [
        dim({ dimension: "structure", score: 7, score_max: 10 }),
        dim({ dimension: "content", score: 8, score_max: 10 }),
        dim({ dimension: "grammar", score: 6, score_max: 10 }),
        dim({ dimension: "vocab", score: 7, score_max: 10 }),
      ],
      sentences: [sentence({ id: "s-1" })],
    };

    renderWithIntl(
      <FeedbackPageContent
        submission={submission({ question_no: 53 })}
        bundle={bundle}
        withSentences
        showSubmissionMeta
        showDimensionGrid={false}
        reloadHref="/writing/feedback/long/sub-1"
        userId="user-1"
      />,
    );

    const bodyChildren = Array.from(
      screen.getByTestId("feedback-page-body").children,
    ).map((element) => element.getAttribute("data-testid"));

    expect(screen.queryByTestId("feedback-report-overview")).toBeNull();
    expect(bodyChildren.slice(0, 5)).toEqual([
      "feedback-summary",
      "feedback-report-criteria-card",
      "feedback-report-focus-card",
      "feedback-sentence-card",
      "feedback-recommendation-card",
    ]);
    expect(bodyChildren).toContain("feedback-detail-panel");
  });

  it("labels long feedback sentence corrections by matching answer sections", () => {
    const bundle: FeedbackBundle = {
      feedback: feedback({ raw_ai_result: {} }),
      dimensions: [],
      sentences: [
        sentence({ id: "s-intro", original_text: "서론 문장" }),
        sentence({ id: "s-body", original_text: "본론 문장" }),
        sentence({ id: "s-conclusion", original_text: "결론 문장" }),
      ],
    };

    renderWithIntl(
      <FeedbackPageContent
        submission={submission({
          question_no: 53,
          answer_text:
            "서론 문장입니다.\n\n본론 문장입니다.\n\n결론 문장입니다.",
          answer_json: {
            _v: "53.v1",
            sections: {
              intro: "서론 문장입니다.",
              body: "본론 문장입니다.",
              conclusion: "결론 문장입니다.",
            },
          },
        })}
        bundle={bundle}
        withSentences
        showSubmissionMeta
        showDimensionGrid={false}
        reloadHref="/writing/feedback/long/sub-1"
        userId="user-1"
      />,
    );

    expect(screen.getByText("서론")).toBeTruthy();
    expect(screen.getByText("본론")).toBeTruthy();
    expect(screen.getByText("결론")).toBeTruthy();
    expect(screen.queryByText("빈칸")).toBeNull();
  });

  it("renders a direct PDF action instead of the saved-library menu", async () => {
    const bundle: FeedbackBundle = {
      feedback: feedback({ raw_ai_result: {} }),
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
        alreadySaved
      />,
    );

    const pdfButton = screen.getByTestId("feedback-action-pdf");
    expect(pdfButton.textContent).toBe("PDF 저장");
    expect(screen.queryByTestId("feedback-action-save")).toBeNull();

    fireEvent.click(pdfButton);

    await waitFor(() => {
      expect(exportPdfMock).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: "submission",
          sourceId: "sub-1",
        }),
      );
    });
    expect(
      screen.queryByRole("menuitem", { name: "보관함에 저장됨" }),
    ).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "보관함 저장" })).toBeNull();
  });

  it("does not save to the library from the feedback header actions", async () => {
    const bundle: FeedbackBundle = {
      feedback: feedback({ raw_ai_result: {} }),
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
      />,
    );

    expect(screen.queryByTestId("feedback-action-save")).toBeNull();
    fireEvent.click(screen.getByTestId("feedback-action-pdf"));

    await waitFor(() => {
      expect(exportPdfMock).toHaveBeenCalled();
    });

    expect(libraryMutationMock.mutate).not.toHaveBeenCalled();
  });

  it("disables retry actions when the submitted problem is no longer available", () => {
    const bundle: FeedbackBundle = {
      feedback: feedback({ raw_ai_result: {} }),
      dimensions: [],
      sentences: [],
    };

    renderWithIntl(
      <FeedbackPageContent
        submission={submission()}
        bundle={bundle}
        withSentences={false}
        reloadHref="/writing/feedback/long/sub-1"
        userId="user-1"
        canRetryProblem={false}
      />,
    );

    const retryButton = screen.getByTestId(
      "feedback-action-retry",
    ) as HTMLButtonElement;
    expect(retryButton.disabled).toBe(true);
    expect(
      screen
        .getByTestId("feedback-reco-action-retry")
        .getAttribute("aria-disabled"),
    ).toBe("true");
  });

  it("starts feedback retry from the original submission answer", () => {
    const bundle: FeedbackBundle = {
      feedback: feedback({ raw_ai_result: {} }),
      dimensions: [],
      sentences: [],
    };

    renderWithIntl(
      <FeedbackPageContent
        submission={submission({
          id: "submission-1",
          problem_id: "problem-1",
          question_no: 54,
        })}
        bundle={bundle}
        withSentences
        reloadHref="/writing/feedback/long/submission-1"
        userId="user-1"
      />,
    );

    fireEvent.click(screen.getByTestId("feedback-action-retry"));

    expect(routerPushMock).toHaveBeenCalledWith(
      "/writing/essay-writing-54?problem=problem-1&fresh=1&retrySubmission=submission-1&returnTo=%2Fwriting%2Ffeedback%2Flong%2Fsubmission-1",
    );
  });

  it("renders the short-answer report overview from external trait scores and learning focus areas", () => {
    const bundle: FeedbackBundle = {
      feedback: feedback({
        score_total: 0,
        score_max: 10,
        overall_summary:
          "두 빈칸 모두 내용과 표현 면에서 추가적인 연습이 필요합니다.",
        raw_ai_result: {
          time_spent: 1127,
          processing_time_seconds: 16.16,
          trait_scores: [
            {
              trait: "blank_1",
              trait_korean: "빈칸 ㉠",
              score: 0,
              weight: 0.25,
              feedback:
                "첫 번째 빈칸은 문제 맥락에 맞는 격식체 표현이 필요합니다.",
              improvements: ["격식체(-습니다/습니까) 사용 연습"],
            },
            {
              trait: "blank_2",
              trait_korean: "빈칸 ㉡",
              score: 0,
              weight: 0.25,
              feedback:
                "두 번째 빈칸은 문장 완성도와 어휘 선택을 다시 점검해야 합니다.",
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

    expect(screen.queryByTestId("feedback-report-overview")).toBeNull();
    expect(screen.getByTestId("feedback-report-criteria-card")).toBeTruthy();
    expect(screen.getByTestId("feedback-report-focus-card")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "51번 피드백 리포트" }),
    ).toBeTruthy();
    expect(screen.queryByTestId("feedback-report-meta")).toBeNull();
    expect(screen.queryByText("제출일 2026.06.18 19:06")).toBeNull();
    expect(screen.queryByText("소요 시간 18분 47초")).toBeNull();
    expect(screen.queryByText("AI 분석 16.16초")).toBeNull();
    expect(screen.queryByText("score와 weight 기준")).toBeNull();
    expect(screen.queryByTestId("feedback-report-total-score-card")).toBeNull();
    expect(screen.queryByTestId("feedback-report-total-score-line")).toBeNull();
    expect(screen.getByText("빈칸별 점수")).toBeTruthy();
    expect(screen.getByText("㉠ 빈칸")).toBeTruthy();
    expect(screen.getByText("㉡ 빈칸")).toBeTruthy();
    expect(screen.getAllByText("0점")).toHaveLength(2);
    expect(screen.getAllByText("배점 2.5점")).toHaveLength(2);
    expect(screen.getByText("다음 보완 포인트")).toBeTruthy();
    expect(
      screen.getAllByText("무의미한 문자 입력 금지").length,
    ).toBeGreaterThan(0);
  });

  it("does not render report metadata above the score sections", () => {
    const bundle: FeedbackBundle = {
      feedback: feedback({
        raw_ai_result: {
          processing_time_seconds: 7.97,
          trait_scores: [
            {
              trait: "blank_1",
              score: 0,
              feedback: "Use a sentence that fits the first blank.",
            },
          ],
        },
      }),
      dimensions: [],
      sentences: [],
    };

    renderWithIntl(
      <FeedbackPageContent
        submission={submission({
          submitted_at: "2026-06-19T03:01:00.000Z",
        })}
        bundle={bundle}
        withSentences
        showDetailPanel={false}
        dimensionCardLimit={4}
        reloadHref="/writing/feedback/short/sub-1"
        userId="user-1"
      />,
    );

    expect(screen.queryByTestId("feedback-report-meta")).toBeNull();
    expect(screen.queryAllByTestId("feedback-report-meta-item")).toHaveLength(
      0,
    );
    expect(screen.queryByText("제출일 2026.06.19 12:01")).toBeNull();
    expect(screen.queryByText("AI 분석 7.97초")).toBeNull();
    expect(screen.queryByText("score와 weight 기준")).toBeNull();
  });

  it("does not render a duplicate total score card in the report overview", () => {
    const bundle: FeedbackBundle = {
      feedback: feedback({
        score_total: 5,
        score_max: 10,
        raw_ai_result: {
          trait_scores: [
            {
              trait: "blank_1",
              score: 5,
              feedback: "Use a sentence that fits the first blank.",
            },
          ],
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
      />,
    );

    expect(screen.queryByTestId("feedback-report-total-score-card")).toBeNull();
    expect(screen.queryByTestId("feedback-report-total-score-line")).toBeNull();
    expect(screen.getByTestId("feedback-report-criteria-card")).toBeTruthy();
    expect(screen.getByTestId("feedback-report-focus-card")).toBeTruthy();
  });

  it("renders the focus section outside the blank score hierarchy with a star icon", () => {
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
      />,
    );

    const body = screen.getByTestId("feedback-page-body");
    const criteria = screen.getByTestId("feedback-report-criteria-card");
    const focus = screen.getByTestId("feedback-report-focus-card");
    const starIcon = focus.querySelector("img");

    expect(screen.queryByTestId("feedback-report-overview")).toBeNull();
    expect(body.children[1]).toBe(criteria);
    expect(body.children[2]).toBe(focus);
    expect(criteria.parentElement).toBe(body);
    expect(focus.parentElement).toBe(body);
    expect(criteria.className).not.toContain("bg-surface/40");
    expect(criteria.className).not.toContain("rounded-default");
    expect(criteria.className).not.toContain("p-4");
    expect(focus.className).not.toContain("bg-surface/40");
    expect(focus.className).not.toContain("rounded-default");
    expect(focus.className).not.toContain("p-4");
    const criteriaTitle = within(criteria).getByRole("heading", {
      level: 5,
      name: "빈칸별 점수",
    });
    const focusTitle = within(focus).getByRole("heading", {
      level: 5,
      name: "다음 보완 포인트",
    });
    const focusTitleRow = focusTitle.parentElement;
    const starIconBox = starIcon?.parentElement;
    expect(focusTitleRow?.children[0]).toBe(focusTitle);
    expect(focusTitleRow?.children[1]).toBe(starIconBox);
    expect(criteriaTitle.className).toContain("m-0");
    expect(focusTitle.className).toContain("!m-0");
    expect(focusTitle.className).toContain("!flex");
    expect(focusTitle.className).toContain("!h-5");
    expect(focusTitle.className).toContain("!items-center");
    expect(focusTitle.className).toContain("!leading-5");
    expect(focusTitleRow?.className).toContain(
      "feedback-report-focus-title-row",
    );
    expect(focusTitleRow?.className).toContain("h-5");
    expect(focusTitleRow?.className).toContain("items-center");
    expect(starIconBox?.className).toContain(
      "feedback-report-focus-title-icon-box",
    );
    expect(starIconBox?.className).toContain("items-center");
    expect(starIconBox?.className).toContain("justify-center");
    expect(starIcon?.getAttribute("src")).toContain(
      "/assets/star-brush.png?v=red-20260630",
    );
    expect(starIcon?.getAttribute("src")).not.toContain("/_next/image");
    expect(starIcon?.getAttribute("alt")).toBe("");
    expect(starIcon?.getAttribute("aria-hidden")).toBe("true");
    expect(starIcon?.className).toContain("feedback-report-focus-title-icon");
    expect(starIcon?.className).toContain("block");
    expect(starIcon?.className).toContain("h-5");
    expect(starIcon?.className).toContain("w-5");
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

    expect(screen.queryByTestId("feedback-report-overview")).toBeNull();
    expect(screen.getByTestId("feedback-report-criteria-card")).toBeTruthy();
    expect(screen.getByTestId("feedback-report-focus-card")).toBeTruthy();
    expect(screen.queryAllByTestId("feedback-dimension-card")).toHaveLength(0);
    expect(screen.getAllByTestId("feedback-report-score-item")).toHaveLength(1);
    expect(
      screen.getByText("Use a sentence that fits the first blank."),
    ).toBeTruthy();
    expect(screen.queryByTestId("external-learning-feedback")).toBeNull();
    expect(screen.getAllByTestId(/^feedback-reco-action-/)).toHaveLength(3);
    expect(
      screen.getAllByText("Start by matching the prompt context.").length,
    ).toBeGreaterThan(0);
  });

  it("does not clamp blank score item explanations", () => {
    const longFeedback =
      "This feedback explains the blank in full, including why the answer missed the prompt, which grammar signal was expected, and what the learner should practice next without hiding the ending behind an ellipsis.";
    const bundle: FeedbackBundle = {
      feedback: feedback({
        raw_ai_result: {
          trait_scores: [
            {
              trait: "blank_1",
              score: 0,
              feedback: longFeedback,
            },
          ],
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
      />,
    );

    const scoreItem = screen.getByTestId("feedback-report-score-item");
    const explanation = within(scoreItem).getByText(longFeedback);

    expect(explanation.className).not.toMatch(/\bline-clamp-\d+\b/);
    expect(explanation.className).not.toContain("truncate");
    expect(explanation.getAttribute("style") ?? "").not.toContain("line-clamp");
  });

  it("renders the short report KPI content without an outer overview wrapper", () => {
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

    expect(screen.queryByTestId("feedback-report-overview")).toBeNull();
    expect(screen.getByTestId("feedback-report-criteria-card")).toBeTruthy();
    expect(screen.getByTestId("feedback-report-focus-card")).toBeTruthy();
  });
});
