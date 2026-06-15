// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import koMessages from "../../../messages/ko.json";
import { RecommendationsView } from "../../../src/components/practice/RecommendationsView";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
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
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("../../../src/components/practice/recommendations-data", () => ({
  useRecommendationBundle: mocks.useRecommendationBundle,
}));

beforeEach(() => {
  mocks.replace.mockReset();
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

describe("RecommendationsView", () => {
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
});
