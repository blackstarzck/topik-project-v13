// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import koMessages from "../../../messages/ko.json";
import { RecommendationsView } from "../../../src/components/practice/RecommendationsView";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  searchParams: "",
  useRecommendationBundle: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(mocks.searchParams),
}));

vi.mock("../../../src/components/practice/recommendations-data", () => ({
  useRecommendationBundle: mocks.useRecommendationBundle,
}));

beforeEach(() => {
  mocks.replace.mockReset();
  mocks.searchParams = "";
  mocks.useRecommendationBundle.mockReturnValue({
    data: { run: null, items: [], availableTypes: new Set() },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
});

function expectHeroDifficultyUsesLucideChartIcon() {
  const difficultyLabel = screen.getByText(
    koMessages.practice.recommendations.fallbackHeroDifficulty,
  );
  const difficultyTile = difficultyLabel.closest("span")?.parentElement;

  expect(
    difficultyTile?.querySelector("svg.lucide-chart-no-axes-column-increasing"),
  ).toBeTruthy();
  expect(difficultyTile?.querySelector("svg.lucide-target")).toBeNull();
}

describe("RecommendationsView", () => {
  it("does not show a recommendation badge in the type tabs", () => {
    renderWithIntl(<RecommendationsView />);

    const tabs = screen
      .getByText(koMessages.practice.recommendations.typeButtonLabel51)
      .closest(".problem-type-tabs");
    const badgeTexts = Array.from(
      tabs?.querySelectorAll(".problem-type-tabs__badge") ?? [],
    ).map((badge) => badge.textContent?.trim());

    expect(badgeTexts).not.toContain(
      koMessages.practice.recommendations.typeRecommendedBadge,
    );
  });

  it("renders the empty recommendation action as a left-aligned anchor", () => {
    renderWithIntl(<RecommendationsView />);

    const copy = screen.getByText(
      koMessages.practice.recommendations.emptyDescription,
    );
    const row = copy.closest("div");
    expect(row?.className).toContain("items-start");
    expect(row?.className).not.toContain("justify-center");

    const link = screen.getByRole("link", {
      name: koMessages.practice.recommendations.viewProblemList,
    });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/practice/problems");
    expect(
      screen.queryByRole("button", {
        name: koMessages.practice.recommendations.viewProblemList,
      }),
    ).toBeNull();
    expect(
      screen.queryByText(koMessages.practice.recommendations.footerNote),
    ).toBeNull();
  });

  it("renders an empty 52번 filter with the hero metric card pattern", () => {
    mocks.searchParams = "type=52";
    mocks.useRecommendationBundle.mockReturnValue({
      data: {
        run: {
          reasonSummary: "52번 추천 근거",
          sourceType: "weakness",
          createdAt: "2026-06-15T00:00:00.000Z",
        },
        items: [],
        availableTypes: new Set(),
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderWithIntl(<RecommendationsView />);

    expect(mocks.useRecommendationBundle).toHaveBeenCalledWith(52);
    expect(
      screen.getByText(
        koMessages.practice.recommendations.fallbackHeroTitle.replace(
          "{type}",
          koMessages.practice.common.questionType52,
        ),
      ),
    ).toBeTruthy();
    expect(
      screen.getAllByText(koMessages.practice.recommendations.primaryBadge)
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(koMessages.practice.recommendations.fallbackHeroTime),
    ).toBeTruthy();
    expectHeroDifficultyUsesLucideChartIcon();
    expect(
      screen.getByText(koMessages.practice.recommendations.fallbackHeroStatus),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", {
          name: koMessages.practice.recommendations.fallbackHeroCta.replace(
            "{type}",
            "52번",
          ),
        })
        .getAttribute("href"),
    ).toBe("/writing/answer-writing-52");
  });

  it("renders a real 51번 recommendation with the same hero metric layout", () => {
    mocks.searchParams = "type=51";
    mocks.useRecommendationBundle.mockReturnValue({
      data: {
        run: null,
        items: [
          {
            itemId: "rec-51",
            problemId: "problem-51",
            rank: 1,
            reason: "문법 정확도 보완에 맞는 추천입니다.",
            estimatedMinutes: 12,
            weaknessTags: ["grammar"],
            title: "도서관 출입증 신청 방법 문의",
            questionNo: 51,
          },
        ],
        availableTypes: new Set([51]),
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderWithIntl(<RecommendationsView />);

    expect(screen.getByText("도서관 출입증 신청 방법 문의")).toBeTruthy();
    expect(
      screen.getAllByText(koMessages.practice.recommendations.primaryBadge)
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(koMessages.practice.recommendations.fallbackHeroTime),
    ).toBeTruthy();
    expectHeroDifficultyUsesLucideChartIcon();
    expect(
      screen.getByText(koMessages.practice.recommendations.fallbackHeroStatus),
    ).toBeTruthy();
    expect(screen.getByText("12분")).toBeTruthy();
    expect(
      screen
        .getByRole("link", {
          name: koMessages.practice.recommendations.startFromThis,
        })
        .getAttribute("href"),
    ).toBe("/writing/short-answer-writing-51?problem=problem-51");
  });

  it("shows retry guidance instead of an endless spinner when recommendations fail", () => {
    const refetch = vi.fn();
    mocks.useRecommendationBundle.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("recommendation_request_timeout"),
      refetch,
    });

    renderWithIntl(<RecommendationsView />);

    expect(
      screen.getByText(koMessages.practice.recommendations.loadErrorTitle),
    ).toBeTruthy();
    expect(
      screen.getByText(
        koMessages.practice.recommendations.loadErrorDescription,
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText(koMessages.practice.recommendations.loadingTip),
    ).toBeNull();
    expect(
      screen.getByRole("button", {
        name: koMessages.practice.recommendations.retry,
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(koMessages.practice.recommendations.typeButtonLabel51),
    ).toBeTruthy();
  });

  it("renders skeleton placeholders instead of spinner copy while recommendations load", () => {
    mocks.useRecommendationBundle.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    renderWithIntl(<RecommendationsView />);

    expect(screen.getByTestId("recommendation-reason-skeleton")).toBeTruthy();
    expect(screen.getByTestId("recommendation-results-skeleton")).toBeTruthy();
    expect(
      screen.queryByText(koMessages.practice.recommendations.loadingTip),
    ).toBeNull();
    expect(
      screen.queryByText(
        koMessages.practice.recommendations.reasonSummaryLoading,
      ),
    ).toBeNull();
    expect(
      screen.getByText(koMessages.practice.recommendations.typeButtonLabel51),
    ).toBeTruthy();
  });

  it("navigates to the selected type when a tab is clicked", () => {
    renderWithIntl(<RecommendationsView />);

    fireEvent.click(
      screen.getByText(koMessages.practice.recommendations.typeButtonLabel52),
    );

    expect(mocks.replace).toHaveBeenCalledWith(
      "/practice/recommendations?type=52",
    );
  });

  it("keys the reason stagger to the shown content, not the tab click", () => {
    // Regression: the stagger key used to be a counter bumped on click, which
    // fired before the URL→active→bundle update landed. The panel remounted
    // against the previous tab's still-current data, so the old tags staggered
    // in before the new tab's tags. The key must instead track the displayed
    // content — the selected type and its load state — so it only changes once
    // the new tab's data is actually shown.
    const reasonKey = () =>
      screen
        .getByText(koMessages.practice.recommendations.reasonSummaryTitle)
        .closest("section")
        ?.getAttribute("data-animation-key");

    const noType = renderWithIntl(<RecommendationsView />);
    const reasonCard = screen
      .getByText(koMessages.practice.recommendations.reasonSummaryTitle)
      .closest("section");
    expect(reasonCard?.className).toContain(
      "recommendation-reason-card--stagger",
    );
    expect(reasonKey()).toBe("auto-ready");
    noType.unmount();

    mocks.searchParams = "type=52";
    renderWithIntl(<RecommendationsView />);
    expect(reasonKey()).toBe("52-ready");
  });

  it("keeps the reason panel static (no stagger) while recommendations load", () => {
    mocks.searchParams = "type=53";
    mocks.useRecommendationBundle.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    renderWithIntl(<RecommendationsView />);

    const section = screen
      .getByText(koMessages.practice.recommendations.reasonSummaryTitle)
      .closest("section");
    // The skeleton must not animate — the stagger class is dropped while loading.
    expect(section?.className).not.toContain(
      "recommendation-reason-card--stagger",
    );
    expect(section?.getAttribute("data-animation-key")).toBe("53-loading");
  });
});
