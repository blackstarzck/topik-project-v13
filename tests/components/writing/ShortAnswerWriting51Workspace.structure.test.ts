import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sourcePath = join(
  process.cwd(),
  "src/components/writing/ShortAnswerWriting51Workspace.tsx",
);
const messagesPath = join(process.cwd(), "messages", "ko.json");

describe("ShortAnswerWriting51Workspace structure", () => {
  it("renders normalized q51 role and function metadata instead of placeholder-only hints", () => {
    const source = readFileSync(sourcePath, "utf8");
    const messages = JSON.parse(readFileSync(messagesPath, "utf8"));

    expect(source).toContain("blank.functionLabel");
    expect(source).toContain("blank.answerType");
    expect(source).toContain("blankHints");
    expect(source).toContain("writing-guide-hints");
    expect(source).toContain('tPage("hintRoleLabel")');
    expect(source).toContain('tPage("hintFunctionLabel")');
    expect(source).toContain('tPage("hintAnswerTypeLabel")');
    expect(source).toContain('tPage("guidePlaceholder")');
    expect(source).toContain('tPage("tipsPlaceholder")');
    expect(source).not.toContain('tPage("hintPlaceholder")');
    expect(source).not.toContain("blank.targetHint");
    expect(source).not.toContain("expressionHints");
    expect(source).not.toContain('tPage("expressionHint0")');
    expect(source).not.toContain("writing-expression-chip-list");
    expect(messages.writing.q51.hintTitle).toBe("빈칸별 작성 힌트");
    expect(messages.writing.q51).not.toHaveProperty("expressionHint0");
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
});
