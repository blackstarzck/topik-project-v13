// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, screen } from "@testing-library/react";

import { QuestionPrompt } from "../../../src/components/writing/QuestionPrompt";
import type { NormalizedWritingProblem } from "../../../src/lib/writing/problem-normalizer";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

afterEach(() => cleanup());

describe("QuestionPrompt", () => {
  function q53Problem(
    override: Partial<Extract<NormalizedWritingProblem, { kind: "q53" }>> = {},
  ): Extract<NormalizedWritingProblem, { kind: "q53" }> {
    return {
      id: "q53-text-type",
      title: "Gym satisfaction survey",
      textType: "Survey notice",
      prompt: "1) Describe the trend.",
      questionNo: 53,
      kind: "q53",
      lifecycleStatus: "active",
      lifecycleReason: null,
      rubric: { conditions: [], criteria: [] },
      fallbackWarnings: [],
      submitBlockedReason: null,
      charts: [],
      materialCards: [],
      guideCards: [],
      writingTasks: ["Describe the trend."],
      rubricCriteria: [],
      ...override,
    };
  }

  function q54Problem(
    override: Partial<Extract<NormalizedWritingProblem, { kind: "q54" }>> = {},
  ): Extract<NormalizedWritingProblem, { kind: "q54" }> {
    return {
      id: "q54-essay",
      title: "Technology and education",
      textType: "Essay",
      prompt: "Discuss your position.\n\nUse reasons and examples.",
      questionNo: 54,
      kind: "q54",
      lifecycleStatus: "active",
      lifecycleReason: null,
      rubric: { conditions: [], criteria: [] },
      fallbackWarnings: [],
      submitBlockedReason: null,
      topicTitle: "Technology and education",
      topicDefinition: "Technology use in schools",
      background: "Students use digital tools every day.",
      requiredQuestions: [
        "State your position.",
        "Give two reasons.",
        "Summarize your opinion.",
      ],
      rubricSummary: {
        content: null,
        structure: null,
        language: null,
      },
      checklistItems: [],
      essayGuidance: {
        structure: [],
        reasonCount: null,
        reasoningPattern: null,
        scoringFocus: [],
        prohibitedElements: [],
        modelOutline: [],
      },
      ...override,
    };
  }

  it("uses textType instead of the question number prefix in long-form prompt titles", () => {
    const problem = q53Problem();

    renderWithIntl(<QuestionPrompt problem={problem} />);

    expect(
      screen.getByRole("heading", {
        name: "Survey notice - Gym satisfaction survey",
      }),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /53/ })).toBeNull();
  });

  it("falls back to the problem title without a question number prefix", () => {
    const problem = q53Problem({ textType: null });

    renderWithIntl(<QuestionPrompt problem={problem} />);

    expect(
      screen.getByRole("heading", {
        name: "Gym satisfaction survey",
      }),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /53/ })).toBeNull();
  });

  it("renders q53 writing tasks as a flush bullet list instead of an ordered list", () => {
    const { container } = renderWithIntl(
      <QuestionPrompt problem={q53Problem()} />,
    );

    const task = screen.getByText("Describe the trend.");
    const list = task.closest("ul");

    expect(container.querySelector("ol")).toBeNull();
    expect(list).not.toBeNull();
    expect(list?.classList.contains("writing-guide-list")).toBe(true);
  });

  it("renders q54 required questions as a flush bullet list instead of an ordered list", () => {
    const { container } = renderWithIntl(
      <QuestionPrompt problem={q54Problem()} />,
    );

    const question = screen.getByText("State your position.");
    const list = question.closest("ul");

    expect(container.querySelector("ol")).toBeNull();
    expect(list).not.toBeNull();
    expect(list?.classList.contains("writing-guide-list")).toBe(true);
  });
});
