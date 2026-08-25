// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";

import { LibraryReviewCandidateCard } from "../../../src/components/library/LibraryReviewCandidateCard";
import typographyStyles from "../../../src/components/library/LibraryTypography.module.css";
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
    expect(heading.className).toContain("gap-2");
    expect(heading.className).not.toContain("relative");
    const questionNumberRow = within(heading).getByTestId(
      "library-review-candidate-question-row",
    );
    expect(questionNumberRow.className).toContain("justify-end");
    const content = within(heading).getByTestId(
      "library-review-candidate-content",
    );
    const metaGroup = within(top).getByTestId(
      "library-review-candidate-meta-group",
    );
    expect(metaGroup.className).toContain("mt-auto");
    expect(metaGroup.className).toContain("pt-8");

    expect(
      Array.from(heading.children).map((child) =>
        child.getAttribute("data-testid"),
      ),
    ).toEqual([
      "library-review-candidate-question-row",
      "library-review-candidate-content",
    ]);

    const date = within(content).getByTestId("library-review-candidate-date");
    expect(date.textContent).toContain("2026-06-29");
    const questionNumber = within(questionNumberRow).getByTestId(
      "library-review-question-number",
    );
    expect(questionNumber.getAttribute("aria-label")).toBe("54번");
    expect(questionNumber.textContent).toBe("54");
    expect(questionNumber.className).toContain("writing-question-number");
    expect(questionNumber.className).toContain("writing-question-number--q54");
    expect(questionNumber.className).toContain(
      "library-review-candidate-question-number",
    );
    const title = within(top).getByTestId("library-review-candidate-title");
    expect(title.textContent).toBe("문화 사회형 질문");
    expect(title.className).toContain("text-base");
    expect(within(top).queryByRole("link", { name: "피드백 보기" })).toBeNull();
    expect(within(top).queryByText("예상 시간")).toBeNull();
    expect(within(top).getByText("50분")).toBeTruthy();
    expect(within(top).queryByText("난이도")).toBeNull();
    expect(within(top).getByText("어려움")).toBeTruthy();
    const summary = within(top).getByTestId("library-review-candidate-summary");
    expect(summary.className).not.toContain("!text-[14px]");
    expect(summary.className.split(" ")).toContain(typographyStyles.metadata);
    expect(
      within(top).queryByTestId("library-review-candidate-lowest-dimension"),
    ).toBeNull();
    const totalScore = within(top).getByTestId(
      "library-review-candidate-total-score",
    );
    expect(totalScore.textContent).toBe("총점 76점");
    expect(totalScore.className).not.toContain("!text-[14px]");
    expect(totalScore.className.split(" ")).toContain(
      typographyStyles.metadata,
    );
    const estimatedTime = within(top).getByTestId(
      "library-review-candidate-estimated-time",
    );
    expect(estimatedTime.className).not.toContain("!text-[14px]");
    expect(estimatedTime.className.split(" ")).toContain(
      typographyStyles.metadata,
    );
    const difficulty = within(top).getByTestId(
      "library-review-candidate-difficulty",
    );
    expect(difficulty.className).not.toContain("!text-[14px]");
    expect(difficulty.className.split(" ")).toContain(
      typographyStyles.metadata,
    );
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

  it("owns the full-height swiper layout through the public card body slot", () => {
    renderWithIntl(<LibraryReviewCandidateCard candidate={candidate} />);

    const card = screen.getByTestId("library-review-candidate-card");
    expect.soft(card.className).toContain("flex");
    expect.soft(card.className).toContain("h-full");

    const body = Array.from(card.children).find(
      (child) =>
        child.classList.contains("flex") &&
        child.classList.contains("h-full") &&
        child.classList.contains("w-full"),
    );
    expect.soft(body).toBeTruthy();

    const shell = within(card).getByTestId("library-review-candidate-shell");
    expect.soft(shell.className).toContain("w-full");

    const css = readFileSync(
      join(process.cwd(), "src/styles/global.css"),
      "utf8",
    );

    expect
      .soft(css)
      .not.toMatch(
        /\.library-review-candidate-card\.app-card\.app-surface\s*\{[^}]*\}/,
      );
    expect
      .soft(css)
      .not.toMatch(/\.library-review-candidate-card[^\{]*>\s*\.ant-card-body/);
    expect
      .soft(css)
      .not.toMatch(
        /\.library-review-candidate-card[^\{]*>\s*\.ant-card-body\s*>\s*\*/,
      );
    expect(css).toMatch(
      /\.library-review-candidate-card\s+\.library-review-candidate-question-number\s*\{[\s\S]*?width:\s*1\.47em;/,
    );
    expect(css).toMatch(
      /\.library-review-candidate-card\s+\.library-review-candidate-question-number\s*\{[\s\S]*?height:\s*1\.47em;/,
    );
    expect(css).toMatch(
      /\.library-review-candidate-card\s+\.library-review-candidate-question-number\s*\{[\s\S]*?font-size:\s*18px;/,
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
