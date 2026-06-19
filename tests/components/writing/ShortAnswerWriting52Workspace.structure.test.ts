import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sourcePath = join(
  process.cwd(),
  "src/components/writing/ShortAnswerWriting52Workspace.tsx",
);
const stylesPath = join(process.cwd(), "src/styles/global.css");

describe("ShortAnswerWriting52Workspace structure", () => {
  it("keeps conditions in the right guide rail instead of the main answer body", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("<WritingGuideAccordion");
    expect(source).not.toContain(
      'import { ConditionsPanel } from "./ConditionsPanel";',
    );
    expect(source).not.toContain("<ConditionsPanel");
    expect(source).not.toContain('className="writing-expression-accordion"');
  });

  it("uses the same inline blank prompt structure as q51", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain(
      'import { InteractiveBlankPrompt } from "./InteractiveBlankPrompt";',
    );
    expect(source).toContain("<InteractiveBlankPrompt");
    expect(source).toContain(
      "prompt={problem.blankedPrompt || problem.prompt}",
    );
    expect(source).not.toContain(
      'import { QuestionPrompt } from "./QuestionPrompt";',
    );
    expect(source).not.toContain("<QuestionPrompt problem={problem} />");
  });

  it("configures exactly the three q52 wireframe guide cards", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("problem.rubric.conditions.slice(0, 4)");
    expect(source).toContain("problem.validationMessages.slice(0, 2)");
    expect(source).toContain('key: "conditions"');
    expect(source).toContain('key: "guide"');
    expect(source).toContain('key: "examples"');
    expect(source).toContain('title: tPage("guideTitle")');
    expect(source).toContain('title: tPage("tipsTitle")');
    expect(source).toContain('title: tPage("hintTitle")');
    expect(source).not.toContain("blankHints");
    expect(source).not.toContain("problem.rubric.criteria");
  });

  it("renders q52 example expressions as a list, not chips", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain(
      '<ul className="writing-guide-list writing-guide-list--examples">',
    );
    expect(source).toContain("<li key={hint}>{hint}</li>");
    expect(source).not.toContain("writing-expression-chip-list");
    expect(source).not.toContain("writing-expression-chip");
  });

  it("styles q52 example expressions with small bullets", () => {
    const styles = readFileSync(stylesPath, "utf8");

    expect(styles).toContain(".writing-guide-list--examples");
    expect(styles).toContain(".writing-guide-list--examples > li::before");
    expect(styles).toContain("width: 4px;");
    expect(styles).toContain("height: 4px;");
    expect(styles).toContain("border-radius: 999px;");
    expect(styles).toContain("background: var(--app-color-text-secondary);");
  });

  it("uses wireframe terminology for q52 guide titles in all locales", () => {
    const expectations = {
      "messages/ko.json": ["문제 조건", "작성 가이드", "예시 표현"],
      "messages/en.json": [
        "Problem conditions",
        "Writing guide",
        "Example expressions",
      ],
      "messages/vi.json": [
        "Điều kiện đề bài",
        "Hướng dẫn viết",
        "Cụm diễn đạt mẫu",
      ],
    };

    for (const [file, [guideTitle, tipsTitle, hintTitle]] of Object.entries(
      expectations,
    )) {
      const messages = JSON.parse(
        readFileSync(join(process.cwd(), file), "utf8"),
      );

      expect(messages.writing.q52.guideTitle).toBe(guideTitle);
      expect(messages.writing.q52.tipsTitle).toBe(tipsTitle);
      expect(messages.writing.q52.hintTitle).toBe(hintTitle);
    }
  });
});
