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
  useWritingAvailability: vi.fn(),
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

vi.mock("../../../src/components/practice/writing-availability-data", () => ({
  useWritingAvailability: mocks.useWritingAvailability,
}));

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  mocks.replace.mockReset();
  mocks.searchParams = "";
  mocks.useRecommendationBundle.mockReturnValue({
    data: { run: null, items: [], availableTypes: new Set() },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
  mocks.useWritingAvailability.mockReturnValue({
    data: {
      availableTypes: new Set([51, 52, 53, 54]),
      lockedTypes: new Set(),
      hasAny: true,
    },
    isLoading: false,
    error: null,
  });
});

afterEach(() => {
  cleanup();
});

function expectHeroDifficultyUsesIconsaxIcon() {
  const difficultyLabel = screen.getByText(
    koMessages.practice.recommendations.fallbackHeroDifficulty,
  );
  const difficultyTile = difficultyLabel.closest("span")?.parentElement;

  expect(difficultyTile?.querySelector("svg")).toBeTruthy();
}

describe("RecommendationsView", () => {
  it("uses the requested Iconsax icons for question type tabs and cards", () => {
    const { container } = renderWithIntl(<RecommendationsView />);

    const expectedIconNames = [
      "DirectboxNotif",
      "ProgrammingArrows",
      "PresentationChart",
      "DocumentText",
    ];

    const typeTabs = container.querySelector(".problem-type-tabs");
    for (const iconName of expectedIconNames) {
      expect(
        typeTabs?.querySelector(`[data-app-icon-name="${iconName}"]`),
      ).toBeTruthy();
    }

    for (const iconName of expectedIconNames) {
      expect(
        container.querySelector(
          `a[href^="/writing/"] [data-app-icon-name="${iconName}"]`,
        ),
      ).toBeTruthy();
    }
  });

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

  it("renders an honest empty state without a fabricated recommendation", () => {
    // DB-empty (run: null, items: []) is the beforeEach default. The page must
    // NOT dress this up as a personalized result: no "대표 추천" hero, no
    // "이렇게 추천했어요" analysis panel, no default weakness tags.
    renderWithIntl(<RecommendationsView />);

    expect(
      screen.getByText(koMessages.practice.recommendations.emptyDescription),
    ).toBeTruthy();

    // "문제 목록 보기" is an emphasized primary button that links to the list.
    const button = screen.getByRole("button", {
      name: koMessages.practice.recommendations.viewProblemList,
    });
    expect(button.className).toContain("ant-btn-primary");
    expect(button.closest("a")?.getAttribute("href")).toBe(
      "/practice/problems",
    );

    // No fabricated recommendation content.
    expect(
      screen.queryByText(koMessages.practice.recommendations.primaryBadge),
    ).toBeNull();
    expect(
      screen.queryByText(
        koMessages.practice.recommendations.reasonSummaryTitle,
      ),
    ).toBeNull();
    // The fabricated default weakness tags were removed for honesty — assert
    // the old copy never resurfaces.
    expect(screen.queryByText("문법 정확도 개선")).toBeNull();

    // The type-select cards remain — the honest "pick a type to start" path.
    expect(
      screen.getByText(koMessages.practice.recommendations.typeSelectTitle),
    ).toBeTruthy();
  });

  it("renders a computed rule-based bundle with resolved reason codes and unique keys", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const computedItem = (
      problemId: string,
      questionNo: number,
      reasonCode: string,
      weaknessTags: string[],
      rank: number,
    ) => ({
      itemId: null,
      problemId,
      rank,
      reason: null,
      reasonCode,
      estimatedMinutes: null,
      weaknessTags,
      title: `규칙 추천 ${questionNo}`,
      questionNo,
    });
    mocks.useRecommendationBundle.mockReturnValue({
      data: {
        run: null,
        source: "computed",
        summaryCode: "history",
        items: [
          computedItem("p-51", 51, "TYPE_ROTATION_NEXT", ["grammar"], 1),
          computedItem("p-52", 52, "UNATTEMPTED_AVAILABLE", [], 2),
          computedItem("p-53", 53, "UNATTEMPTED_AVAILABLE", [], 3),
        ],
        availableTypes: new Set([51, 52, 53]),
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderWithIntl(<RecommendationsView />);

    // Hero + honest computed summary + reason-code copy resolved to locale text.
    expect(
      screen.getByText(koMessages.practice.recommendations.primaryBadge),
    ).toBeTruthy();
    expect(screen.getByText("규칙 추천 51")).toBeTruthy();
    expect(
      screen.getByText(
        koMessages.practice.recommendations.computedSummary.history,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        koMessages.practice.recommendations.reasonCode.TYPE_ROTATION_NEXT,
      ),
    ).toBeTruthy();

    // Measured weakness tag renders as its locale label, never the raw key.
    expect(
      screen.getByText(koMessages.practice.recommendations.dimension.grammar),
    ).toBeTruthy();
    expect(screen.queryByText("grammar")).toBeNull();

    // Card-level CTAs belong to the Ant Design footer, not the content body.
    const continueButtons = screen.getAllByRole("button", {
      name: koMessages.practice.recommendations.continueProblem,
    });
    expect(continueButtons).toHaveLength(2);
    for (const button of continueButtons) {
      for (const className of [
        "inline-flex",
        "items-center",
        "justify-center",
        "gap-2",
      ]) {
        expect(button.classList.contains(className)).toBe(true);
      }
      expect(button.closest(".ant-card-actions")).toBeTruthy();
      expect(button.closest(".ant-card-body")).toBeNull();
      expect(
        button.closest(".ant-card")?.querySelector(".app-card-footer-actions"),
      ).toBeTruthy();
    }

    // Two secondary cards with null itemId — keys fall back to problemId, so
    // React must not log a duplicate-key warning.
    const keyWarnings = consoleErrorSpy.mock.calls.filter((call) =>
      String(call[0]).includes("key"),
    );
    expect(keyWarnings).toEqual([]);
    consoleErrorSpy.mockRestore();
  });

  it("renders the honest empty state for a type filter with zero items", () => {
    // Even when a recommendation RUN exists, zero items means there is nothing
    // concrete to recommend — we must not fabricate a hero or surface the run
    // summary as if a problem was recommended.
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
      screen.queryByText(
        koMessages.practice.recommendations.fallbackHeroTitle.replace(
          "{type}",
          koMessages.practice.common.questionType52,
        ),
      ),
    ).toBeNull();
    expect(
      screen.queryByText(koMessages.practice.recommendations.primaryBadge),
    ).toBeNull();
    expect(
      screen.queryByText(
        koMessages.practice.recommendations.reasonSummaryTitle,
      ),
    ).toBeNull();
    expect(screen.queryByText("52번 추천 근거")).toBeNull();

    // Honest empty copy + type-select cards instead.
    expect(
      screen.getByText(koMessages.practice.recommendations.emptyDescription),
    ).toBeTruthy();
    expect(
      screen.getByText(koMessages.practice.recommendations.typeSelectTitle),
    ).toBeTruthy();
  });

  it("renders a real 51번 recommendation with the same hero metric layout", () => {
    mocks.searchParams = "type=51";
    window.location.hash = "#recommendations";
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
    expectHeroDifficultyUsesIconsaxIcon();
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
    ).toBe(
      "/writing/short-answer-writing-51?problem=problem-51&returnTo=%2Fpractice%2Frecommendations%3Ftype%3D51%23recommendations",
    );
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

  it("runs the failed-load retry only once while the retry action is pending", () => {
    const pending = new Promise<void>(() => undefined);
    const refetch = vi.fn(() => pending);
    mocks.useRecommendationBundle.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("recommendation_request_timeout"),
      refetch,
    });

    renderWithIntl(<RecommendationsView />);

    const retry = screen.getByRole("button", {
      name: koMessages.practice.recommendations.retry,
    });
    fireEvent.click(retry);
    fireEvent.click(retry);

    expect(refetch).toHaveBeenCalledTimes(1);
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

  it("locks unavailable writing types and removes direct writing card links", () => {
    mocks.useWritingAvailability.mockReturnValue({
      data: {
        availableTypes: new Set(),
        lockedTypes: new Set([51, 52, 53, 54]),
        hasAny: false,
      },
      isLoading: false,
      error: null,
    });

    const { container } = renderWithIntl(<RecommendationsView />);

    expect(container.querySelector('a[href^="/writing/"]')).toBeNull();
    expect(
      screen.getAllByText(koMessages.practice.recommendations.locked).length,
    ).toBeGreaterThanOrEqual(4);
    expect(
      screen.getAllByText(koMessages.practice.recommendations.typeLockedCta)
        .length,
    ).toBe(4);
  });

  it("pessimistically hides writing links while availability is loading", () => {
    mocks.useWritingAvailability.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    const { container } = renderWithIntl(<RecommendationsView />);

    expect(container.querySelector('a[href^="/writing/"]')).toBeNull();
    expect(
      screen.getAllByText(koMessages.practice.recommendations.typeLockedCta)
        .length,
    ).toBe(4);
  });

  it("keys the reason stagger to the shown content, not the tab click", () => {
    // Regression: the stagger key used to be a counter bumped on click, which
    // fired before the URL→active→bundle update landed. The panel remounted
    // against the previous tab's still-current data, so the old tags staggered
    // in before the new tab's tags. The key must instead track the displayed
    // content — the selected type and its load state — so it only changes once
    // the new tab's data is actually shown.
    //
    // The reason panel now only renders when there are real recommendations, so
    // this exercises it with an active item bundle.
    const bundleFor = (questionNo: number) => ({
      data: {
        run: null,
        items: [
          {
            itemId: `rec-${questionNo}`,
            problemId: `problem-${questionNo}`,
            rank: 1,
            reason: "추천 사유",
            estimatedMinutes: 12,
            weaknessTags: ["grammar"],
            title: "추천 문제",
            questionNo,
          },
        ],
        availableTypes: new Set([questionNo]),
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const reasonKey = () =>
      screen
        .getByText(koMessages.practice.recommendations.reasonSummaryTitle)
        .closest("section")
        ?.getAttribute("data-animation-key");

    mocks.useRecommendationBundle.mockReturnValue(bundleFor(51));
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
    mocks.useRecommendationBundle.mockReturnValue(bundleFor(52));
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
