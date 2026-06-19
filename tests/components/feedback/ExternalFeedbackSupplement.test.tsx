// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, screen } from "@testing-library/react";

import { renderWithIntl } from "../../test-utils/renderWithIntl";
import { ExternalLearningFeedbackCard } from "../../../src/components/feedback/ExternalFeedbackSupplement";
import type { ExternalFeedbackSupplement } from "../../../src/lib/writing/external-feedback";

afterEach(() => {
  cleanup();
});

describe("ExternalFeedbackSupplement", () => {
  it("renders combined feedback as recommended learning material", () => {
    const supplement = {
      learning: {
        focusAreas: ["formal endings"],
        studyTips: "Start by matching the prompt context.",
        grammarPoints: [
          {
            grammar: "-습니다",
            explanation: "Use formal endings in TOPIK writing.",
            example: "정보의 중요성은 커지고 있습니다.",
          },
        ],
        vocabulary: ["therefore"],
        exercises: [
          {
            exerciseType: "rewrite",
            question: "Rewrite the sentence formally.",
            answer: "정보의 중요성은 커지고 있습니다.",
            explanation: "The ending is formal.",
            targetErrorType: "style",
          },
        ],
      },
      hasLearning: true,
    } satisfies ExternalFeedbackSupplement;

    renderWithIntl(<ExternalLearningFeedbackCard supplement={supplement} />);

    expect(screen.getByTestId("external-learning-feedback")).toBeTruthy();
    expect(screen.getByText("formal endings")).toBeTruthy();
    expect(
      screen.getByText("Start by matching the prompt context."),
    ).toBeTruthy();
    expect(screen.getByText("Use formal endings in TOPIK writing.")).toBeTruthy();
    expect(screen.getByText("Rewrite the sentence formally.")).toBeTruthy();
  });
});
