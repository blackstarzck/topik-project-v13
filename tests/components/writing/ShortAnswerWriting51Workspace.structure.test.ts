import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import postcss from "postcss";

import {
  build51AnswerText,
  count51AnswerChars,
  isShortAnswer51DraftJson,
} from "@/lib/writing/types";
import type { NormalizedBlank } from "@/lib/writing/problem-normalizer";
import {
  createShortAnswerPayload,
  readInitialShortAnswerAnswers,
  shortAnswerWriting51Adapter,
} from "@/components/writing/shortAnswerWritingAdapters";
import { findGlobalCssOwners, hasExactCssRule } from "./writing-style-contract";

const sourcePath = join(
  process.cwd(),
  "src/components/writing/ShortAnswerWriting51Workspace.tsx",
);
const q52SourcePath = join(
  process.cwd(),
  "src/components/writing/ShortAnswerWriting52Workspace.tsx",
);
const orchestrationPath = join(
  process.cwd(),
  "src/components/writing/useShortAnswerWritingWorkspace.ts",
);
const messagesPath = join(process.cwd(), "messages", "ko.json");
const sharedStylesPath = join(
  process.cwd(),
  "src/components/writing/ShortAnswerWritingWorkspace.module.css",
);
const globalStylesPath = join(process.cwd(), "src/styles/global.css");

function declarationNamesForSelector(source: string, selector: string) {
  const normalizedSelector = selector.replace(/\s+/gu, " ").trim();
  const names = new Set<string>();

  postcss.parse(source).walkRules((rule) => {
    const selectors = rule.selector
      .split(",")
      .map((candidate) => candidate.replace(/\s+/gu, " ").trim());
    if (!selectors.includes(normalizedSelector)) return;
    for (const node of rule.nodes ?? []) {
      if (node.type === "decl") names.add(node.prop);
    }
  });

  return names;
}

function classSpecificity(selector: string) {
  return selector.match(/\.[\w-]+/gu)?.length ?? 0;
}

describe("ShortAnswerWriting51Workspace structure", () => {
  it("shares concise writing layouts while preserving q51 and q52 stable classes", () => {
    const sources = [sourcePath, q52SourcePath].map((path) =>
      readFileSync(path, "utf8"),
    );
    const sharedStyles = readFileSync(sharedStylesPath, "utf8");
    const expectedRules = [
      [".guideHints", "display: grid; gap: 10px;"],
      [".guideHints .guideHintCard", "display: grid; gap: 4px;"],
      [".answerPanel", "display: grid; gap: 0;"],
      [
        ".blankTabs",
        "display: flex; gap: 8px; overflow-x: auto; padding-inline: 0;",
      ],
      [
        ".blankTab",
        "border-radius: var(--app-radius-card) var(--app-radius-card) var(--app-radius-none) var(--app-radius-none);",
      ],
      [".blankTab.blankTabActive", "color: var(--app-color-text-inverse);"],
      [
        ".answerCard",
        "border-radius: var(--app-radius-none) var(--app-radius) var(--app-radius) var(--app-radius);",
      ],
    ] as const;

    expect(
      expectedRules
        .filter(
          ([selector, declarations]) =>
            !hasExactCssRule(sharedStyles, selector, declarations),
        )
        .map(([selector]) => selector),
    ).toEqual([]);
    expect(classSpecificity(".blankTab.blankTabActive")).toBeGreaterThan(
      classSpecificity(".writing-blank-tab"),
    );
    expect(
      hasExactCssRule(
        sharedStyles,
        ".answerCard",
        "border-radius: var(--app-radius);",
        ["@media (max-width: 767px)"],
      ),
    ).toBe(true);
    expect(
      findGlobalCssOwners([
        "writing-guide-hints",
        "writing-answer-panel",
        "writing-blank-tabs",
      ]),
    ).toEqual([]);
    for (const source of sources) {
      const compactSource = source.replace(/\s+/gu, " ");
      expect(source).toContain(
        'import styles from "./ShortAnswerWritingWorkspace.module.css";',
      );
      expect(compactSource).toContain(
        '"writing-guide-hints", styles.guideHints',
      );
      expect(compactSource).toContain(
        '"app-card-compact", styles.guideHintCard',
      );
      expect(compactSource).toContain(
        '"writing-answer-panel", styles.answerPanel',
      );
      expect(compactSource).toContain('"writing-blank-tabs", styles.blankTabs');
      expect(compactSource).toContain('"writing-blank-tab", styles.blankTab');
      expect(compactSource).toContain("styles.blankTabActive");
      expect(compactSource).toContain(
        '"writing-answer-card", styles.answerCard',
      );
    }

    const globalStyles = readFileSync(globalStylesPath, "utf8");
    expect(
      declarationNamesForSelector(globalStyles, ".writing-blank-tab").has(
        "border-radius",
      ),
    ).toBe(false);
    expect(
      declarationNamesForSelector(
        globalStyles,
        ".writing-blank-tab--active",
      ).has("color"),
    ).toBe(false);
    expect(
      declarationNamesForSelector(globalStyles, ".writing-answer-card").has(
        "border-radius",
      ),
    ).toBe(false);
  });

  it("keeps the q51 JSON version, answer text order, and character count contract", () => {
    const answers = { "(ㄱ)": "  첫째 답  ", "(ㄴ)": "둘째 답" };
    const blanks = [{ label: "(ㄱ)" }, { label: "(ㄴ)" }] as NormalizedBlank[];

    expect(isShortAnswer51DraftJson({ _v: "51.v1", blanks: answers })).toBe(
      true,
    );
    expect(isShortAnswer51DraftJson({ _v: "52.v1", blanks: answers })).toBe(
      false,
    );
    expect(build51AnswerText(answers, blanks)).toBe(
      "(ㄱ): 첫째 답\n(ㄴ): 둘째 답",
    );
    expect(count51AnswerChars(answers)).toBe(8);

    const payload = createShortAnswerPayload(
      shortAnswerWriting51Adapter,
      answers,
      blanks,
    );
    expect(payload).toEqual({
      answerJson: { _v: "51.v1", blanks: answers },
      answerText: "(ㄱ): 첫째 답\n(ㄴ): 둘째 답",
      charCount: 8,
    });
    expect(
      readInitialShortAnswerAnswers(shortAnswerWriting51Adapter, blanks, {
        answer_json: payload.answerJson,
        answer_text: "legacy answer",
      }),
    ).toEqual(answers);
  });

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
    expect(source).not.toContain('tPage("answerHintFallback")');
    expect(messages.writing.q51.hintTitle).toBe("빈칸별 작성 힌트");
    expect(messages.writing.q51).not.toHaveProperty("expressionHint0");
  });

  it("keeps only the character count above the q51 answer input", () => {
    const source = readFileSync(sourcePath, "utf8");
    const messages = JSON.parse(readFileSync(messagesPath, "utf8"));

    expect(source).toContain('className="writing-answer-card__head');
    expect(source).toContain('tEditor("charCount"');
    expect(source).not.toContain('tPage("answerTitle"');
    expect(source).not.toContain('tPage("answerHintFallback"');
    expect(source).not.toContain("writing-answer-card__hint");
    expect(messages.writing.q51).not.toHaveProperty("answerTitle");
    expect(messages.writing.q51).not.toHaveProperty("answerHintFallback");
  });

  it("delegates local recovery, latest-save flushing, and conflicts to the shared resilience controller", () => {
    const source = readFileSync(sourcePath, "utf8");
    const orchestration = readFileSync(orchestrationPath, "utf8");

    expect(source).toContain("useShortAnswerWritingWorkspace");
    expect(source).not.toContain("adapter:");
    expect(orchestration).toContain("shortAnswerWriting51Adapter");
    expect(source).not.toContain("useWritingResilience");
    expect(orchestration).toContain("intentPersistence");
    expect(source).toContain("prepareSubmission");
    expect(source).toContain("clearAfterSubmitSuccess");
    expect(source).toContain("WritingRecoveryConflictModal");
    expect(source).toContain("recoveryState={resilience.state.recoveryState}");
    expect(orchestration).toContain(
      "resilience.edit(buildSnapshot(nextAnswers))",
    );
    expect(source).toContain("prepared.payload.answerJson");
    expect(source).toContain("draft_id: prepared.savedDraft.id");
    expect(orchestration).toContain("setBlankAnswers(");
    expect(source).not.toContain("debounceRef");
    expect(source).not.toContain("saveSeqRef");
    expect(source).not.toContain("legacy_cutover_snapshot:");
  });
});
