import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sourcePath = join(
  process.cwd(),
  "src/components/writing/ShortAnswerWriting51Workspace.tsx",
);

describe("ShortAnswerWriting51Workspace structure", () => {
  it("renders normalized q51 role and function metadata instead of placeholder-only hints", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("blank.functionLabel");
    expect(source).toContain("blank.answerType");
    expect(source).toContain("blankHints");
    expect(source).toContain("writing-guide-hints");
    expect(source).toContain('tPage("guidePlaceholder")');
    expect(source).toContain('tPage("tipsPlaceholder")');
    expect(source).toContain('tPage("hintPlaceholder")');
  });
});
