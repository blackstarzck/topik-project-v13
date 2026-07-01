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
  SwiperSlide: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => (
    <div data-testid="mock-swiper-slide" className={className}>
      {children}
    </div>
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
      estimatedMinutes: number % 2 === 0 ? 30 : 50,
      difficultyLevel: 5,
      scoreTotal: 76,
      scoreMax: 100,
      scorePercent: 76,
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

    const section = screen.getByTestId("library-review-swiper");
    expect(section.className).not.toContain("rounded-default");
    expect(section.className).not.toContain("border");
    expect(section.className).not.toContain("bg-background");
    expect(section.className).not.toContain("p-4");
    expect(section.querySelector(".lucide-info")).toBeNull();
    const header = screen.getByTestId("library-review-swiper-header");
    const title = header.querySelector("h4");
    expect(title?.className).toContain("!m-0");
    expect(header.className).toContain("items-center");
    expect(header.className).not.toContain("justify-center");
    expect(header.className).not.toContain("justify-between");
    expect(screen.queryByTestId("library-review-swiper-caption")).toBeNull();
    expect(
      screen.getByTestId("library-review-swiper-actions").previousElementSibling
        ?.tagName,
    ).toBe("H4");
    expect(screen.getByTestId("mock-swiper").getAttribute("data-grid-rows")).toBe(
      "2",
    );
    expect(
      screen.getByTestId("mock-swiper").getAttribute("data-desktop-slides"),
    ).toBe("3.25");
    expect(
      screen.getByTestId("mock-swiper").getAttribute("data-tablet-slides"),
    ).toBe("2.2");
    const slides = screen.getAllByTestId("mock-swiper-slide");
    expect(slides).toHaveLength(12);
    for (const slide of slides) {
      expect(slide.className).toContain("h-auto");
    }
    expect(screen.getByText("1 / 2")).toBeTruthy();
  });

  it("renders the empty review section without a wrapping card or title info icon", () => {
    renderWithIntl(<LibraryReviewCandidateSwiper candidates={[]} />);

    const section = screen.getByTestId("library-review-swiper");
    expect(section.className).not.toContain("rounded-default");
    expect(section.className).not.toContain("border");
    expect(section.className).not.toContain("bg-background");
    expect(section.className).not.toContain("p-5");
    expect(section.querySelector(".lucide-info")).toBeNull();
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
