// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { existsSync, readFileSync } from "node:fs";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "../../test-utils/renderWithIntl";
import { WritingExamShell } from "../../../src/components/writing/WritingExamShell";
import {
  findGlobalCssOwners,
  hasStableAndScopedClasses,
  hasExactCssRule,
} from "./writing-style-contract";

const libraryDeleteMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    rpc: (name: string) => {
      if (name === "list_user_library_problem_items") {
        return Promise.resolve({
          data: [
            {
              item_id: "library-writing-51",
              problem_id: "problem-writing-51",
              title: "Writing saved problem",
              question_no: 51,
              tags: [],
              saved_at: "2026-07-08T00:00:00.000Z",
              availability_status: "available",
              availability_reason: null,
              can_retry: true,
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: [], error: null });
    },
    from: (table: string) => {
      if (table === "library_items") {
        return {
          select: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "library-writing-51",
                      user_id: "user-1",
                      item_type: "problem",
                      attempt_id: null,
                      submission_id: null,
                      report_id: null,
                      export_id: null,
                      problem_id: "problem-writing-51",
                      note: null,
                      tags: [],
                      saved_at: "2026-07-08T00:00:00.000Z",
                    },
                  ],
                  error: null,
                }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: null,
                  error: null,
                }),
            }),
          }),
          delete: () => {
            const builder = {
              eq: vi.fn((column: string, value: unknown) => {
                libraryDeleteMock(column, value);
                if (column === "problem_id") {
                  return Promise.resolve({ data: null, error: null });
                }
                return builder;
              }),
            };
            return builder;
          },
        };
      }
      return {
        select: () => ({
          in: () => Promise.resolve({ data: [], error: null }),
        }),
      };
    },
  }),
}));

function renderWithBookmark(node: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return renderWithIntl(
    <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>,
  );
}

afterEach(() => {
  vi.useRealTimers();
  libraryDeleteMock.mockReset();
  cleanup();
});

describe("WritingExamShell", () => {
  it("owns its shell layout in a scoped CSS module", () => {
    const modulePath = "src/components/writing/WritingExamShell.module.css";
    const source = readFileSync(
      "src/components/writing/WritingExamShell.tsx",
      "utf8",
    );
    const moduleCss = readFileSync(modulePath, "utf8");
    const expectedRules: Array<{
      atRules: readonly string[];
      declarations: string;
      selector: string;
    }> = [
      {
        selector: ".shell",
        declarations:
          "min-height: 100dvh; background: var(--app-color-bg-layout);",
        atRules: [],
      },
      {
        selector: ".main",
        declarations:
          "width: min(100%, 1320px); margin-inline: auto; padding: 28px 28px 48px;",
        atRules: [],
      },
      {
        selector: ".main :global(.writing-workspace)",
        declarations: "gap: 20px;",
        atRules: [],
      },
      {
        selector: ".main",
        declarations: "padding: 18px 16px 40px;",
        atRules: ["@media (max-width: 767px)"],
      },
    ];

    expect(existsSync(modulePath)).toBe(true);
    expect(
      expectedRules
        .filter(
          ({ selector, declarations, atRules }) =>
            !hasExactCssRule(moduleCss, selector, declarations, atRules),
        )
        .map(({ selector, atRules }) => [...atRules, selector].join(" > ")),
    ).toEqual([]);
    expect(source).toContain(
      'import styles from "./WritingExamShell.module.css";',
    );
    expect(source).toContain(
      'className={["writing-exam-shell", styles.shell].join(" ")}',
    );
    expect(source).toContain(
      'className={["writing-exam-main", styles.main].join(" ")}',
    );
    expect(
      findGlobalCssOwners(["writing-exam-shell", "writing-exam-main"]),
    ).toEqual([]);

    const { container } = renderWithIntl(
      <WritingExamShell
        title="53"
        subtitle="subtitle"
        progressPercent={0}
        elapsedSeconds={0}
        autosaveStatus="clean"
        lastSavedAt={null}
        canSave={false}
        canSubmit={false}
        isSaving={false}
        isSubmitting={false}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
        onRequestBack={vi.fn()}
      >
        <div className="writing-workspace">content</div>
      </WritingExamShell>,
    );
    expect(
      hasStableAndScopedClasses(
        container.querySelector(".writing-exam-shell"),
        "writing-exam-shell",
      ),
    ).toBe(true);
    expect(
      hasStableAndScopedClasses(
        container.querySelector(".writing-exam-main"),
        "writing-exam-main",
      ),
    ).toBe(true);
  });

  it("labels the header save action as draft save and delegates it", () => {
    const onSave = vi.fn();
    renderWithIntl(
      <WritingExamShell
        title="51번 단답형"
        subtitle="답안을 작성하세요"
        progressPercent={10}
        elapsedSeconds={0}
        autosaveStatus="dirty"
        lastSavedAt={null}
        canSave
        canSubmit={false}
        isSaving={false}
        isSubmitting={false}
        onSave={onSave}
        onSubmit={vi.fn()}
        onRequestBack={vi.fn()}
      >
        <div>content</div>
      </WritingExamShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "임시 저장" }));

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("delegates the header back action to the writing exit guard", () => {
    const onRequestBack = vi.fn();
    const { container } = renderWithIntl(
      <WritingExamShell
        title="52번 설명문 빈칸"
        subtitle="조건을 확인하고 답안을 작성하세요."
        progressPercent={10}
        elapsedSeconds={65}
        autosaveStatus="clean"
        lastSavedAt={null}
        canSave={false}
        canSubmit={false}
        isSaving={false}
        isSubmitting={false}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
        onRequestBack={onRequestBack}
      >
        <div>content</div>
      </WritingExamShell>,
    );

    const back = container.querySelector(".writing-exam-header__back");
    expect(back).toBeTruthy();

    fireEvent.click(back as Element);

    expect(onRequestBack).toHaveBeenCalledTimes(1);
  });

  it("uses the localized semantic label for contextual back navigation", () => {
    renderWithIntl(
      <WritingExamShell
        title="53"
        subtitle="subtitle"
        progressPercent={10}
        elapsedSeconds={0}
        autosaveStatus="clean"
        lastSavedAt={null}
        canSave={false}
        canSubmit={false}
        isSaving={false}
        isSubmitting={false}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
        onRequestBack={vi.fn()}
      >
        <div>content</div>
      </WritingExamShell>,
    );

    expect(
      screen.getByRole("button", { name: "이전 화면으로 돌아가기" }),
    ).toBeTruthy();
  });

  it("renders the elapsed timer from workspace metrics", () => {
    const { container } = renderWithIntl(
      <WritingExamShell
        title="54"
        subtitle="subtitle"
        progressPercent={10}
        elapsedSeconds={65}
        autosaveStatus="clean"
        lastSavedAt={null}
        canSave={false}
        canSubmit={false}
        isSaving={false}
        isSubmitting={false}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
        onRequestBack={vi.fn()}
      >
        <div>content</div>
      </WritingExamShell>,
    );

    expect(
      container.querySelector(".writing-exam-header__timer")?.textContent,
    ).toContain("00:01:05");
  });

  it("renders a problem bookmark toggle in the writing header", async () => {
    const { container } = renderWithBookmark(
      <WritingExamShell
        title="51"
        subtitle="subtitle"
        progressPercent={10}
        elapsedSeconds={0}
        autosaveStatus="clean"
        lastSavedAt={null}
        canSave={false}
        canSubmit={false}
        isSaving={false}
        isSubmitting={false}
        problemBookmark={{
          userId: "user-1",
          problemId: "problem-writing-51",
        }}
        onSave={vi.fn()}
        onSubmit={vi.fn()}
        onRequestBack={vi.fn()}
      >
        <div>content</div>
      </WritingExamShell>,
    );

    const bookmarkButton = await screen.findByRole("button", {
      name: "저장됨",
    });

    expect(bookmarkButton.className).toContain("problem-bookmark-toggle");
    expect(
      container.querySelector(
        ".writing-exam-header__title-row .writing-exam-header__bookmark-button",
      ),
    ).toBe(bookmarkButton);
    expect(
      container.querySelector(
        ".writing-exam-header__actions .writing-exam-header__bookmark-button",
      ),
    ).toBeNull();
    expect(bookmarkButton.getAttribute("aria-pressed")).toBe("true");
    expect(bookmarkButton.querySelector("svg.lucide-bookmark")).toBeTruthy();
    expect(bookmarkButton.querySelector("svg")?.getAttribute("fill")).toBe(
      "currentColor",
    );

    fireEvent.click(bookmarkButton);

    await screen.findByText("저장 문제에서 제거했어요.");
    expect(libraryDeleteMock).toHaveBeenCalledWith("user_id", "user-1");
    expect(libraryDeleteMock).toHaveBeenCalledWith("item_type", "problem");
    expect(libraryDeleteMock).toHaveBeenCalledWith(
      "problem_id",
      "problem-writing-51",
    );
  });
});
