// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}));

import { WritingPageContent } from "@/components/writing/WritingPageContent";

afterEach(() => cleanup());

describe("WritingPageContent", () => {
  it("owns its empty-state layout without a global CSS dependency", () => {
    const modulePath = join(
      process.cwd(),
      "src/components/writing/WritingPageContent.module.css",
    );
    const source = readFileSync(
      join(process.cwd(), "src/components/writing/WritingPageContent.tsx"),
      "utf8",
    );
    const globalCss = readFileSync(
      join(process.cwd(), "src/styles/global.css"),
      "utf8",
    );

    expect(existsSync(modulePath)).toBe(true);
    if (!existsSync(modulePath)) return;

    expect(readFileSync(modulePath, "utf8").trim()).toBe(`.emptyState {
  display: flex;
  min-height: 100dvh;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.title {
  margin: 0;
  color: var(--app-color-text);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.4;
}`);
    expect(source).toContain(
      'import styles from "./WritingPageContent.module.css";',
    );
    expect(source).toContain('"writing-empty-state", styles.emptyState');
    expect(source).toContain('"writing-empty-state__title", styles.title');
    expect(globalCss).not.toMatch(/\.writing-empty-state(?:__title)?\s*\{/u);
  });

  it("uses a destination-neutral label for contextual return navigation", async () => {
    const element = await WritingPageContent({
      questionNo: 51,
      userId: "user-1",
      problem: null,
      draft: null,
      canRetryProblemLoad: false,
      returnHref: "/dashboard",
    });

    render(element);

    const returnLink = screen.getByRole("link", {
      name: "writing.editor.back",
    });
    expect(returnLink.getAttribute("href")).toBe("/dashboard");
  });

  it("changes the workspace identity when user, problem, or canonical revision changes", async () => {
    type Problem = NonNullable<
      Parameters<typeof WritingPageContent>[0]["problem"]
    >;
    const problem = {
      canonicalImportId: 701,
      canonicalQuestionId: "question-54",
      id: "problem-1",
      kind: "q54",
      payloadHash: "payload-hash-1",
    } as unknown as Problem;
    const renderWorkspace = (
      overrides: Partial<{
        userId: string;
        problem: Problem;
      }> = {},
    ) =>
      WritingPageContent({
        questionNo: 54,
        userId: "user-1",
        problem,
        draft: null,
        returnHref: "/writing",
        ...overrides,
      });

    const initial = await renderWorkspace();
    const otherUser = await renderWorkspace({ userId: "user-2" });
    const otherProblem = await renderWorkspace({
      problem: { ...problem, id: "problem-2" },
    });
    const otherRevision = await renderWorkspace({
      problem: { ...problem, payloadHash: "payload-hash-2" },
    });

    if (!initial || !otherUser || !otherProblem || !otherRevision) {
      throw new Error("expected writing workspace elements");
    }
    expect(initial.key).not.toBeNull();
    expect(otherUser.key).not.toBe(initial.key);
    expect(otherProblem.key).not.toBe(initial.key);
    expect(otherRevision.key).not.toBe(initial.key);
  });
});
