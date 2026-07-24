import { describe, expect, it } from "vitest";

import sample54 from "../../fixtures/writing/sample-54.json";
import sample542 from "../../fixtures/writing/sample-54-2.json";
import { parseQ54PromptPresentation } from "../../../src/lib/writing/q54-prompt-presentation";

type FixtureRecord = {
  prompt_text?: unknown;
};

function normalizedText(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

describe("parseQ54PromptPresentation", () => {
  it("separates line-based numbered questions from the preceding passage", () => {
    const prompt = [
      "Write 600 to 700 characters about the following topic.",
      "",
      "Digital literacy is increasingly important.",
      "",
      "Use the following points to organize your response.",
      "1) What role should schools play?",
      "2) What problems can occur?",
      "3) What support is needed?",
    ].join("\n");

    expect(parseQ54PromptPresentation(prompt)).toEqual({
      passage: [
        "Write 600 to 700 characters about the following topic.",
        "",
        "Digital literacy is increasingly important.",
        "",
        "Use the following points to organize your response.",
      ].join("\n"),
      questions: [
        "What role should schools play?",
        "What problems can occur?",
        "What support is needed?",
      ],
    });
  });

  it("separates inline numbered questions without dropping the lead-in", () => {
    const prompt =
      "Discuss public transportation. Address these questions: 1) What are its benefits? 2) What problems remain? 3) How should cities respond?";

    expect(parseQ54PromptPresentation(prompt)).toEqual({
      passage: "Discuss public transportation. Address these questions:",
      questions: [
        "What are its benefits?",
        "What problems remain?",
        "How should cities respond?",
      ],
    });
  });

  it("returns the original prompt when the complete 1-to-3 sequence is absent", () => {
    const prompt =
      "Discuss the topic.\n1) Give one reason.\n2) Add an example.";

    expect(parseQ54PromptPresentation(prompt)).toEqual({
      passage: prompt,
      questions: [],
    });
  });

  it("parses every canonical q54 fixture while preserving all prompt content", () => {
    const fixtures = [...sample54, ...sample542] as FixtureRecord[];

    expect(fixtures).toHaveLength(238);

    for (const fixture of fixtures) {
      expect(typeof fixture.prompt_text).toBe("string");
      const prompt = fixture.prompt_text as string;
      const presentation = parseQ54PromptPresentation(prompt);

      expect(presentation.questions).toHaveLength(3);
      expect(
        normalizedText(
          [presentation.passage, ...presentation.questions].join(" "),
        ),
      ).toBe(normalizedText(prompt.replace(/[123]\)\s*/gu, "")));
    }
  });
});
