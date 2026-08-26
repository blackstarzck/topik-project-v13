// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, screen } from "@testing-library/react";

import { LibraryReviewQuestionNumber } from "../../../src/components/library/LibraryReviewQuestionNumber";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

afterEach(() => {
  cleanup();
});

describe("LibraryReviewQuestionNumber", () => {
  it("keeps the review question number visual and accessible contract", () => {
    renderWithIntl(<LibraryReviewQuestionNumber questionNo={54} />);

    const questionNumber = screen.getByTestId("library-review-question-number");

    expect(questionNumber.textContent).toBe("54");
    expect(questionNumber.getAttribute("aria-label")).toBe("54번");
    expect(questionNumber.className).toContain("writing-question-number");
    expect(questionNumber.className).toContain(
      "library-review-candidate-question-number",
    );
    expect(questionNumber.className).not.toContain("font-['Space_Grotesk']");
    expect(questionNumber.className).toContain("leading-none");
    expect(questionNumber.className).toContain("writing-question-number--q54");
  });

  it("shows the existing translated unknown-question tag when no number exists", () => {
    renderWithIntl(<LibraryReviewQuestionNumber questionNo={null} />);

    const unknownQuestion = screen.getByTestId(
      "library-review-question-number",
    );

    expect(unknownQuestion.textContent).toBe("문항");
    expect(unknownQuestion.className).toContain("ant-tag");
    expect(unknownQuestion.className).toContain("m-0");
    expect(unknownQuestion.className).toContain("text-sm");
    expect(screen.queryByLabelText(/번$/)).toBeNull();
  });
});
