import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const writingComponents = [
  "ShortAnswerWriting51Workspace.tsx",
  "ShortAnswerWriting52Workspace.tsx",
  "LongFormWriting53Workspace.tsx",
  "EssayWriting54Workspace.tsx",
  "LongFormEditor.tsx",
  "WritingEditor.tsx",
] as const;

describe("writing submission analysis routing", () => {
  it.each(writingComponents)(
    "keeps %s on a transient analysis surface after submit success",
    (fileName) => {
      const source = readFileSync(
        join(process.cwd(), "src", "components", "writing", fileName),
        "utf8",
      );

      expect(source).not.toMatch(/router\.push\(`\/writing\/feedback\//);
      expect(source).toContain("setSubmittedAnalysis");
      expect(source).toContain("SubmittedAnalysisPanel");
      expect(source).toContain("SubmissionFailedModal");
      expect(source).toMatch(
        /onError:\s*\(e\)\s*=>\s*\{[\s\S]*setConfirmOpen\(false\);[\s\S]*setSubmitError\(e\.message\);[\s\S]*\}/,
      );
    },
  );
});
