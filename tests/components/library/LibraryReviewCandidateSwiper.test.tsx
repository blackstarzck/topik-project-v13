// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";

import { LibraryReviewCandidateSwiper } from "../../../src/components/library/LibraryReviewCandidateSwiper";
import type { LibraryReviewCandidate } from "../../../src/lib/library/types";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

vi.mock("swiper/modules", () => ({
  A11y: {},
  Grid: {},
  Navigation: {},
  Pagination: {},
}));

vi.mock("swiper/react", () => ({
  Swiper: ({
    children,
    breakpoints,
    grid,
  }: {
    children: ReactNode;
    breakpoints?: Record<number, { slidesPerView?: number }>;
    grid?: { rows?: number };
  }) => (
    <div
      data-testid="mock-swiper"
      data-grid-rows={grid?.rows}
      data-desktop-slides={breakpoints?.[1280]?.slidesPerView}
      data-tablet-slides={breakpoints?.[768]?.slidesPerView}
    >
      {children}
    </div>
  ),
  SwiperSlide: ({ children }: { children: ReactNode }) => (
    <div data-testid="mock-swiper-slide">{children}</div>
  ),
}));

const candidates: LibraryReviewCandidate[] = Array.from(
  { length: 12 },
  (_, index) => {
    const number = index + 1;
    return {
      id: `candidate-${number}`,
      itemId: `item-${number}`,
      submissionId: `sub-${number}`,
      problemId: `problem-${number}`,
      questionNo: number % 2 === 0 ? 53 : 54,
      title: `복습 후보 ${number}`,
      submittedAt: "2026-06-29T12:00:00.000Z",
      charCount: 240 + number,
      feedbackHref: `/writing/feedback/long/sub-${number}`,
      retryHref: `/writing/53?problem=problem-${number}&fresh=1&retrySubmission=sub-${number}`,
      primaryReason: "feedback_ready",
      reasons: ["feedback_ready"],
      hasRewrite: false,
    };
  },
);

afterEach(() => {
  cleanup();
});

describe("LibraryReviewCandidateSwiper", () => {
  it("renders 12 candidate slides with grid rows and numeric breakpoints", () => {
    renderWithIntl(<LibraryReviewCandidateSwiper candidates={candidates} />);

    expect(screen.getByTestId("mock-swiper").getAttribute("data-grid-rows")).toBe(
      "2",
    );
    expect(
      screen.getByTestId("mock-swiper").getAttribute("data-desktop-slides"),
    ).toBe("3.25");
    expect(
      screen.getByTestId("mock-swiper").getAttribute("data-tablet-slides"),
    ).toBe("2.2");
    expect(screen.getAllByTestId("mock-swiper-slide")).toHaveLength(12);
    expect(screen.getByText("1 / 2")).toBeTruthy();
  });

  it("provides accessible navigation buttons", () => {
    renderWithIntl(<LibraryReviewCandidateSwiper candidates={candidates} />);

    expect(
      screen.getByRole("button", { name: "이전 복습 후보" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "다음 복습 후보" }),
    ).toBeTruthy();
  });
});
