import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const COMPONENTS = [
  "LongFormWriting53Workspace.tsx",
  "EssayWriting54Workspace.tsx",
  "LongFormEditor.tsx",
] as const;

function readComponent(fileName: (typeof COMPONENTS)[number]) {
  return readFileSync(
    join(process.cwd(), "src", "components", "writing", fileName),
    "utf8",
  );
}

describe.each(COMPONENTS)("%s writing resilience integration", (fileName) => {
  it("replaces component-owned debounce sequencing with the shared controller", () => {
    const source = readComponent(fileName);

    expect(source).toContain("useWritingResilience({");
    expect(source).not.toContain("debounceRef");
    expect(source).not.toContain("saveSeqRef");
    expect(source).not.toContain("setTimeout(");
  });

  it("uses recovery-backed submission intent and clears only on success", () => {
    const source = readComponent(fileName);

    expect(source).toMatch(
      /useSubmitWriting\(undefined,\s*\{\s*intentPersistence:\s*resilience\.intentPersistence,?\s*\}\)/,
    );
    expect(source).toContain("await resilience.prepareForSubmit()");
    expect(source).toMatch(
      /onSuccess:\s*\(result\)\s*=>\s*\{[\s\S]*?void resilience\.clearAfterSubmitSuccess\(\)/,
    );
    expect(source).not.toMatch(
      /onError:\s*\(e\)\s*=>\s*\{[\s\S]*?clearAfterSubmitSuccess/,
    );
  });

  it("shows actual recovery state and requires an explicit conflict choice", () => {
    const source = readComponent(fileName);

    expect(source).toContain("<WritingRecoveryConflictModal");
    expect(source).toContain("conflict={resilience.state.conflict}");
    expect(source).toContain("recoveryState={resilience.state.recoveryState}");
    expect(source).toContain("await resilience.chooseRecovery(choice)");
  });
});

describe("question-specific immutable snapshots", () => {
  it("keeps all q53 sections in each edit and recovery selection", () => {
    const source = readComponent("LongFormWriting53Workspace.tsx");

    expect(source).toContain("cloneLongFormDraftJson(build53Json(state))");
    expect(source).toContain("combine53Sections(state)");
    expect(source).toContain("resilience.edit(createSnapshot(nextState))");
    expect(source).toContain("setState(readInitial53(selected.draft))");
  });

  it("keeps q54 text and the full checklist in each edit and recovery selection", () => {
    const source = readComponent("EssayWriting54Workspace.tsx");

    expect(source).toContain("cloneLongFormDraftJson(build54Json(state))");
    expect(source).toContain("resilience.edit(createSnapshot(nextState))");
    expect(source).toContain("setState(readInitial54(selected.draft))");
  });

  it.each([
    "LongFormWriting53Workspace.tsx",
    "EssayWriting54Workspace.tsx",
  ] as const)(
    "%s keeps the exit guard dirty until a chosen current draft is actually saved",
    (fileName) => {
      const source = readComponent(fileName);

      expect(source.match(/setLastSavedSnapshot\(/g)).toHaveLength(1);
      expect(source).toMatch(
        /onServerSaved:[\s\S]*?setLastSavedSnapshot\([\s\S]*?\),/,
      );
    },
  );

  it("keeps both legacy long-form question shapes immutable", () => {
    const source = readComponent("LongFormEditor.tsx");

    expect(source).toContain("cloneLongFormDraftJson(buildAnswerJson(state))");
    expect(source).toContain(
      "resilience.edit(createEditedSnapshot(nextState))",
    );
    expect(source).toContain("setState53(readInitial53(selected.draft))");
    expect(source).toContain("setState54(readInitial54(selected.draft))");
  });
});
