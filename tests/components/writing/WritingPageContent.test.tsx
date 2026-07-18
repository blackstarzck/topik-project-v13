// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}));

import { WritingPageContent } from "@/components/writing/WritingPageContent";

afterEach(() => cleanup());

describe("WritingPageContent", () => {
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
