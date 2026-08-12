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

  it("renders q54 passage and canonical questions in one problem card", () => {
    const prompt = [
      "Write 600 to 700 characters about the following topic.",
      "Digital citizenship means participating responsibly.",
      "Its importance is increasing.",
      "Use the following points to organize your response.",
      "1) What role does digital citizenship play?",
      "2) What conflicts can occur?",
      "3) What standards are needed?",
    ].join("\n\n");
    const { container } = renderWithIntl(
      <QuestionPrompt problem={q54Problem({ prompt })} />,
    );

    const passage = container.querySelector(".writing-question-prompt");
    const questions = container.querySelectorAll(
      ".writing-question-task-list > li",
    );

    expect(passage?.textContent).toBe(
      [
        "Write 600 to 700 characters about the following topic.",
        "Digital citizenship means participating responsibly.",
        "Its importance is increasing.",
        "Use the following points to organize your response.",
      ].join("\n\n"),
    );
    expect(passage?.textContent).not.toContain("1)");
    expect(questions).toHaveLength(3);
    expect(Array.from(questions, (question) => question.textContent)).toEqual([
      "What role does digital citizenship play?",
      "What conflicts can occur?",
      "What standards are needed?",
    ]);
    expect(container.querySelector("ol")).not.toBeNull();
    expect(container.querySelector("ul")).toBeNull();
  });

  it("keeps an unstructured q54 prompt intact as a safe fallback", () => {
    const prompt =
      "Discuss the topic.\n1) Give one reason.\n2) Add an example.";
    const { container } = renderWithIntl(
      <QuestionPrompt problem={q54Problem({ prompt })} />,
    );

    expect(
      container.querySelector(".writing-question-prompt")?.textContent,
    ).toBe(prompt);
    expect(container.querySelector("ol")).toBeNull();
  });
});
