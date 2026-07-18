import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sourcePath = join(
  process.cwd(),
  "src/components/writing/ShortAnswerWriting52Workspace.tsx",
);
const stylesPath = join(process.cwd(), "src/styles/global.css");

describe("ShortAnswerWriting52Workspace structure", () => {
  it("mirrors q51 answer-card support structure", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("<WritingGuideAccordion");
    expect(source).toContain("Collapse");
    expect(source).toContain("Plus");
    expect(source).toContain('className="writing-expression-accordion"');
    expect(source).toContain('defaultActiveKey={["expression"]}');
    expect(source).toContain("writing-expression-chip-list");
    expect(source).toContain("writing-expression-chip");
    expect(source).not.toContain('className="writing-answer-card__actions"');
    expect(source).not.toContain(
      'import { ConditionsPanel } from "./ConditionsPanel";',
    );
    expect(source).not.toContain("<ConditionsPanel");
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

  it("configures the same guide, tips, and hints rail structure as q51", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain('defaultActiveKeys={["guide", "tips", "hints"]}');
    expect(source).toContain('key: "guide"');
    expect(source).toContain('key: "tips"');
    expect(source).toContain('key: "hints"');
    expect(source).toContain('title: tPage("guideTitle")');
    expect(source).toContain('title: tPage("tipsTitle")');
    expect(source).toContain('title: tPage("hintTitle")');
    expect(source).toContain("blankHints");
    expect(source).toContain("problem.rubric.criteria");
    expect(source).not.toContain("problem.rubric.conditions.slice(0, 4)");
    expect(source).not.toContain("problem.validationMessages.slice(0, 2)");
    expect(source).not.toContain('key: "conditions"');
    expect(source).not.toContain('key: "examples"');
  });

  it("renders q52 example expressions as answer-card chips, not a right-rail list", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain('key: "expression"');
    expect(source).toContain("label: (");
    expect(source).toContain('tPage("expressionTitle")');
    expect(source).toContain("writing-expression-chip-list");
    expect(source).toContain("writing-expression-chip");
    expect(source).toContain("onClick={onToggleAutosave}");
    expect(source).not.toContain(
      '<ul className="writing-guide-list writing-guide-list--examples">',
    );
    expect(source).not.toContain("<li key={hint}>{hint}</li>");
  });

  it("uses the shared q51 expression accordion and chip styles", () => {
    const styles = readFileSync(stylesPath, "utf8");

    expect(styles).toContain(".writing-expression-accordion.ant-collapse");
    expect(styles).toContain(".writing-expression-content");
    expect(styles).toContain(".writing-expression-chip-list");
    expect(styles).toContain(".writing-expression-chip");
  });

  it("delegates local recovery, latest-save flushing, and conflicts to the shared resilience controller", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("useWritingResilience");
    expect(source).toContain("intentPersistence");
    expect(source).toContain("prepareForSubmit");
    expect(source).toContain("clearAfterSubmitSuccess");
    expect(source).toContain("WritingRecoveryConflictModal");
    expect(source).toContain("recoveryState={resilience.state.recoveryState}");
    expect(source).toContain("resilience.edit(buildSnapshot(nextAnswers))");
    expect(source).toContain(
      "const submittedAnswers = latest.draft.answer_json.blanks",
    );
    expect(source).toContain("draft_id: savedDraft.id");
    expect(source).toContain("setBlankAnswers(");
    expect(source).not.toContain("debounceRef");
    expect(source).not.toContain("saveSeqRef");
    expect(source).not.toContain("legacy_cutover_snapshot:");
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
