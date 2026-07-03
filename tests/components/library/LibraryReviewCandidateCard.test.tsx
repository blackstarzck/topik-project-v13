// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";

import { LibraryReviewCandidateCard } from "../../../src/components/library/LibraryReviewCandidateCard";
import type { LibraryReviewCandidate } from "../../../src/lib/library/types";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

const candidate: LibraryReviewCandidate = {
  id: "candidate-1",
  itemId: "item-1",
  submissionId: "sub-1",
  problemId: "problem-1",
  questionNo: 54,
  title: "문화 사회형 질문",
  submittedAt: "2026-06-29T12:00:00.000Z",
  charCount: 724,
  estimatedMinutes: 50,
  difficultyLevel: 5,
  scoreTotal: 76,
  scoreMax: 100,
  scorePercent: 76,
  feedbackHref: "/writing/feedback/long/sub-1",
  retryHref: "/writing/54?problem=problem-1&fresh=1&retrySubmission=sub-1",
  primaryReason: "length_off_target",
  reasons: ["length_off_target", "low_dimension"],
  hasRewrite: false,
  lowestDimension: {
    dimension: "structure",
    normalizedScore: 68,
    score: 68,
    scoreMax: 100,
  },
  lengthTarget: { min: 600, max: 700, status: "over" },
};

afterEach(() => {
  cleanup();
});

describe("LibraryReviewCandidateCard", () => {
  it("renders the reference-inspired body and footer layout", () => {
    renderWithIntl(<LibraryReviewCandidateCard candidate={candidate} />);

    const card = screen.getByTestId("library-review-candidate-card");
    expect(card.className).toContain("library-review-candidate-card");
    const shell = within(card).getByTestId("library-review-candidate-shell");
    expect(shell.className).toContain("h-[300px]");
    expect(shell.className).toContain("min-h-[300px]");
    expect(shell.className).toContain("flex-col");
    const top = within(card).getByTestId("library-review-candidate-top");
    expect(top.className).toContain("justify-between");
    const heading = within(top).getByTestId("library-review-candidate-heading");
    expect(heading.className).toContain("gap-4");
    const metaGroup = within(top).getByTestId(
      "library-review-candidate-meta-group",
    );
    expect(metaGroup.className).toContain("mt-auto");
    expect(metaGroup.className).toContain("pt-8");

    expect(within(top).getByText("2026-06-29")).toBeTruthy();
    expect(within(top).getByText("54번")).toBeTruthy();
    const title = within(top).getByTestId("library-review-candidate-title");
    expect(title.textContent).toBe("문화 사회형 질문");
    expect(title.className).toContain("text-base");
    expect(within(top).queryByRole("link", { name: "피드백 보기" })).toBeNull();
    expect(within(top).queryByText("예상 시간")).toBeNull();
    expect(within(top).getByText("50분")).toBeTruthy();
    expect(within(top).queryByText("난이도")).toBeNull();
    expect(within(top).getByText("어려움")).toBeTruthy();
    expect(
      within(top).getByTestId("library-review-candidate-summary").className,
    ).toContain("!text-[14px]");
    expect(
      within(top).queryByTestId("library-review-candidate-lowest-dimension"),
    ).toBeNull();
    const totalScore = within(top).getByTestId(
      "library-review-candidate-total-score",
    );
    expect(totalScore.textContent).toBe("총점 76점");
    expect(totalScore.className).toContain("!text-[14px]");
    expect(
      within(top).getByTestId("library-review-candidate-estimated-time")
        .className,
    ).toContain("!text-[14px]");
    expect(
      within(top).getByTestId("library-review-candidate-difficulty").className,
    ).toContain("!text-[14px]");
    const difficultyIcon = within(top).getByTestId(
      "library-review-candidate-difficulty-icon",
    );
    expect(difficultyIcon.getAttribute("data-difficulty-icon-src")).toBe(
      "/assets/state/difficulty-high.svg",
    );
    expect(difficultyIcon.className).toContain("bg-[#c75d4f]");

    const progress = within(card).getByTestId(
      "library-review-candidate-progress",
    );
    expect(progress.className).toContain("h-[3px]");
    expect(progress.getAttribute("value")).toBe("76");
    expect(progress.getAttribute("max")).toBe("100");
    expect(progress.getAttribute("aria-label")).toBe("총 76/100");

    const footer = within(card).getByTestId("library-review-candidate-footer");
    expect(footer.className).toContain("grid-cols-[auto_1fr]");
    const footerLinks = within(footer).getAllByRole("link");
    expect(footerLinks).toHaveLength(2);
    expect(footerLinks[0].getAttribute("aria-label")).toBe("피드백 보기");
    expect(footerLinks[0].getAttribute("href")).toBe(
      "/writing/feedback/long/sub-1",
    );
    expect(footerLinks[0].textContent?.trim()).toBe("");
    expect(footerLinks[0].className).toContain("size-8");
    expect(footerLinks[0].querySelector("svg")).toBeTruthy();
    expect(footerLinks[1].getAttribute("href")).toBe(
      "/writing/54?problem=problem-1&fresh=1&retrySubmission=sub-1",
    );
    expect(footerLinks[1].textContent).toContain("다시 풀기");
  });

  it("keeps the AntD card body full height for uniform swiper cards", () => {
    const css = readFileSync(
      join(process.cwd(), "src/styles/global.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.library-review-candidate-card\.app-card\.app-surface\s*>\s*\.ant-card-body[\s\S]*?height:\s*100%;/,
    );
    expect(css).toMatch(
      /\.library-review-candidate-score-progress\s*\{[\s\S]*?background:\s*color-mix\(\s*in srgb,\s*var\(--app-color-border\) 18%,\s*var\(--app-color-bg-container\)\s*\);/,
    );
    expect(css).toMatch(
      /\.library-review-candidate-score-progress::-webkit-progress-value\s*\{[\s\S]*?background:\s*var\(--app-color-link-secondary\);/,
    );
    expect(css).toMatch(
      /\.library-review-candidate-score-progress::-moz-progress-bar\s*\{[\s\S]*?background:\s*var\(--app-color-link-secondary\);/,
    );
  });

  it("shows the total score tooltip from the progress bar", async () => {
    renderWithIntl(<LibraryReviewCandidateCard candidate={candidate} />);

    fireEvent.mouseEnter(
      screen.getByTestId("library-review-candidate-progress"),
    );

    expect(await screen.findByText("총 76/100")).toBeTruthy();
  });
  it("uses scorePercent as the progress value regardless of raw score scale", () => {
    renderWithIntl(
      <LibraryReviewCandidateCard
        candidate={{
          ...candidate,
          scoreTotal: 6,
          scoreMax: 10,
          scorePercent: 60,
        }}
      />,
    );

    const progress = screen.getByTestId("library-review-candidate-progress");
    expect(progress.getAttribute("value")).toBe("60");
    expect(progress.getAttribute("max")).toBe("100");
    expect(progress.getAttribute("aria-label")).toBe("총 6/10");
  });
});
