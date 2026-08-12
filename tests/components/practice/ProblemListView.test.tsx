// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { App as AntdApp } from "antd";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../../messages/en.json";
import koMessages from "../../../messages/ko.json";

const navState = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  search: "",
}));

const rpcMock = vi.hoisted(() => vi.fn());
const libraryInsertMock = vi.hoisted(() => vi.fn());
const libraryDeleteMock = vi.hoisted(() => vi.fn());
const libraryInsertState = vi.hoisted(() => ({
  error: null as {
    code: string;
    message: string;
    details?: string | null;
  } | null,
}));
const libraryDeleteState = vi.hoisted(() => ({
  error: null as { message: string } | null,
}));
const libraryRowsState = vi.hoisted(() => ({
  rows: [] as Array<{
    id: string;
    item_id?: string;
    problem_id: string;
    title: string;
    question_no: number | null;
    saved_at: string;
  }>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: navState.push,
    replace: navState.replace,
  }),
  useSearchParams: () => new URLSearchParams(navState.search),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    rpc: (name: string, args?: unknown) => {
      if (name === "list_user_library_problem_items") {
        return Promise.resolve({
          data: libraryRowsState.rows.map((row) => ({
            item_id: row.item_id ?? row.id,
            problem_id: row.problem_id,
            title: row.title,
            question_no: row.question_no,
            tags: [],
            saved_at: row.saved_at,
            availability_status: "available",
            availability_reason: null,
            can_retry: true,
          })),
          error: null,
        });
      }
      return rpcMock(name, args);
    },
    from: (table: string) => {
      if (table === "library_items") {
        return {
          select: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({
                  data: libraryRowsState.rows.map((row) => ({
                    id: row.item_id ?? row.id,
                    user_id: "user-1",
                    item_type: "problem",
                    attempt_id: null,
                    submission_id: null,
                    report_id: null,
                    export_id: null,
                    problem_id: row.problem_id,
                    note: null,
                    tags: [],
                    saved_at: row.saved_at,
                  })),
                  error: null,
                }),
            }),
          }),
          insert: (payload: unknown) => {
            libraryInsertMock(payload);
            return {
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: libraryInsertState.error
                      ? null
                      : {
                          id: "library-new",
                          user_id: "user-1",
                          item_type: "problem",
                          attempt_id: null,
                          submission_id: null,
                          report_id: null,
                          export_id: null,
                          problem_id:
                            typeof payload === "object" && payload !== null
                              ? ((
                                  payload as {
                                    problem_id?: string;
                                  }
                                ).problem_id ?? null)
                              : null,
                          note: null,
                          tags: [],
                          saved_at: "2026-07-08T00:00:00.000Z",
                        },
                    error: libraryInsertState.error,
                  }),
              }),
            };
          },
          delete: () => {
            const builder = {
              eq: vi.fn((column: string, value: unknown) => {
                libraryDeleteMock(column, value);
                if (column === "problem_id") {
                  return Promise.resolve({
                    data: null,
                    error: libraryDeleteState.error,
                  });
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

import { ProblemListView } from "../../../src/components/practice/ProblemListView";

type RpcProblemRow = {
  problem_id: string;
  title: string;
  difficulty: number;
  tags: string[];
  attempt_count: number;
  is_solved: boolean;
  solve_state: "none" | "attempted" | "submitted";
};

function renderInApp(node: ReactNode, locale: "en" | "ko" = "en") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  const messages = locale === "ko" ? koMessages : enMessages;

  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AntdApp>
        <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>
      </AntdApp>
    </NextIntlClientProvider>,
  );
}

function rpcRow(row: RpcProblemRow, index: number) {
  return {
    problem_id: row.problem_id,
    title: row.title,
    domain: "writing",
    topik_level: 2,
    question_no: 51,
    difficulty: row.difficulty,
    tags: row.tags,
    attempt_count: row.attempt_count,
    is_solved: row.is_solved,
    last_attempt_at: row.attempt_count > 0 ? "2026-06-10T00:00:00.000Z" : null,
    created_at: `2026-06-${String(10 - index).padStart(2, "0")}T00:00:00.000Z`,
    total_count: 6,
    solve_state: row.solve_state,
    has_draft: false,
    draft_status: null,
    writing_submission_count: row.solve_state === "submitted" ? 1 : 0,
    latest_submission_id:
      row.solve_state === "submitted" ? `submission-${index}` : null,
    latest_submission_at:
      row.solve_state === "submitted" ? "2026-06-10T00:00:00.000Z" : null,
    writing_feedback_status:
      row.solve_state === "submitted" ? "complete" : null,
    lifecycle_status: "active",
    lifecycle_reason: null,
    publish_status: "published",
    review_status: "approved",
  };
}

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  navState.push.mockReset();
  navState.replace.mockReset();
  navState.search = "";
  rpcMock.mockReset();
  libraryInsertMock.mockReset();
  libraryDeleteMock.mockReset();
  libraryInsertState.error = null;
  libraryDeleteState.error = null;
  libraryRowsState.rows = [];
  rpcMock.mockResolvedValue({ data: [], error: null });
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
});

describe("ProblemListView", () => {
  it("uses the recommendation tab card style without a recommendation badge", () => {
    const { container } = renderInApp(<ProblemListView userId="user-1" />);

    const allTabRoot = screen
      .getByText(enMessages.practice.common.typeTabAll)
      .closest(".ant-tabs");
    expect(allTabRoot?.className).toContain("problem-type-tabs");
    expect(allTabRoot?.className).toContain("problem-type-tabs--with-all");
    expect(allTabRoot?.className).toContain("ant-tabs-card");
    expect(
      screen
        .getByText(enMessages.practice.common.typeTabAll)
        .closest(".ant-tabs-tab")?.className,
    ).toContain("ant-tabs-tab-active");
    expect(
      screen.queryByText(
        enMessages.practice.recommendations.typeRecommendedBadge,
      ),
    ).toBeNull();

    fireEvent.click(
      screen.getByText(enMessages.practice.recommendations.typeButtonLabel52),
    );

    expect(navState.replace).toHaveBeenCalledWith(
      "/practice/problems?type=52&page=1",
    );

    for (const iconName of [
      "DirectboxNotif",
      "ProgrammingArrows",
      "PresentationChart",
      "DocumentText",
    ]) {
      expect(
        container.querySelector(`[data-app-icon-name="${iconName}"]`),
      ).toBeTruthy();
    }
  });

  it("updates the recommended-only control immediately while URL navigation is still pending", async () => {
    renderInApp(<ProblemListView userId="user-1" />);

    expect(screen.queryByText("Recommendation")).toBeNull();
    expect(screen.getAllByText("Recommended only")).toHaveLength(1);

    const recommendedSwitch = screen.getByRole("switch", {
      name: "Show recommended problems only",
    });
    expect(recommendedSwitch.getAttribute("aria-checked")).toBe("false");
    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalled();
    });
    const initialRpcCallCount = rpcMock.mock.calls.length;

    fireEvent.click(recommendedSwitch);

    await waitFor(() => {
      expect(recommendedSwitch.getAttribute("aria-checked")).toBe("true");
      expect(screen.getAllByText("Recommended only")).toHaveLength(2);
    });
    expect(navState.replace).toHaveBeenCalledWith(
      "/practice/problems?recommended=1&page=1",
    );

    await waitFor(() => {
      expect(rpcMock.mock.calls.length).toBeGreaterThan(initialRpcCallCount);
    });
  });

  it("renders the C-02 row metrics using compact difficulty buckets and display data", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        rpcRow(
          {
            problem_id: "problem-128",
            title: "51-128_동의어 어휘 빈칸",
            difficulty: 3,
            tags: ["어휘", "동의어", "빈칸"],
            attempt_count: 0,
            is_solved: false,
            solve_state: "none",
          },
          0,
        ),
        rpcRow(
          {
            problem_id: "problem-127",
            title: "51-127_반의어 어휘 빈칸",
            difficulty: 2,
            tags: ["어휘", "반의어", "빈칸"],
            attempt_count: 1,
            is_solved: true,
            solve_state: "submitted",
          },
          1,
        ),
        rpcRow(
          {
            problem_id: "problem-126",
            title: "51-126_관용 표현 빈칸",
            difficulty: 3,
            tags: ["어휘", "관용 표현", "빈칸"],
            attempt_count: 1,
            is_solved: false,
            solve_state: "attempted",
          },
          2,
        ),
        rpcRow(
          {
            problem_id: "problem-125",
            title: "51-125_접속 부사 빈칸",
            difficulty: 4,
            tags: ["문법", "접속 부사", "빈칸"],
            attempt_count: 0,
            is_solved: false,
            solve_state: "none",
          },
          3,
        ),
        rpcRow(
          {
            problem_id: "problem-124",
            title: "51-124_문맥상 어휘 빈칸",
            difficulty: 3,
            tags: ["어휘", "문맥", "빈칸"],
            attempt_count: 1,
            is_solved: true,
            solve_state: "submitted",
          },
          4,
        ),
        rpcRow(
          {
            problem_id: "problem-123",
            title: "51-123_유의어 어휘 빈칸",
            difficulty: 2,
            tags: ["어휘", "유의어", "빈칸"],
            attempt_count: 1,
            is_solved: false,
            solve_state: "attempted",
          },
          5,
        ),
      ],
      error: null,
    });

    const { container } = renderInApp(
      <ProblemListView userId="user-1" />,
      "ko",
    );

    await screen.findByText("51-128_동의어 어휘 빈칸");

    const tableHeader = within(container.querySelector("thead")!);
    expect(
      tableHeader.getByText(koMessages.practice.problems.problemColumnLabel),
    ).toBeTruthy();
    expect(
      tableHeader.getByText(koMessages.practice.problems.difficultyLabel),
    ).toBeTruthy();
    expect(
      tableHeader.getByText(koMessages.practice.problems.estimatedTimeLabel),
    ).toBeTruthy();
    expect(
      tableHeader.getByText(koMessages.practice.problems.previousScoreLabel),
    ).toBeTruthy();
    expect(
      tableHeader.queryByText(koMessages.practice.problems.solveStatusLabel),
    ).toBeNull();
    expect(
      tableHeader.queryByText(koMessages.practice.problems.solveAction),
    ).toBeNull();

    expect(screen.getByText("신규")).toBeTruthy();
    expect(screen.getAllByText("중")).toHaveLength(3);
    expect(screen.getAllByText("하")).toHaveLength(2);
    expect(screen.getByText("상")).toBeTruthy();
    expect(screen.getAllByText("12분")).toHaveLength(2);
    expect(screen.getByText("10분")).toBeTruthy();
    expect(screen.getByText("13분")).toBeTruthy();
    expect(screen.getByText("15분")).toBeTruthy();
    expect(screen.getByText("9분")).toBeTruthy();
    expect(screen.getByText("85점")).toBeTruthy();
    expect(screen.getByText("62점")).toBeTruthy();
    expect(screen.getByText("90점")).toBeTruthy();
    expect(screen.getByText("70점")).toBeTruthy();
    expect(screen.queryByText("미풀이")).toBeNull();
    expect(screen.queryByText("완료")).toBeNull();
    expect(screen.queryByText("오답 노트")).toBeNull();
    expect(screen.queryByText("복습 필요")).toBeNull();
    expect(
      screen.getAllByText(koMessages.practice.problems.startProblem),
    ).toHaveLength(2);
    expect(
      screen.getAllByText(koMessages.practice.problems.retryAttempt),
    ).toHaveLength(4);
  }, 45_000);

  it("adds the matching neon background class to each writing question number", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [51, 52, 53, 54].map((questionNo, index) => ({
        ...rpcRow(
          {
            problem_id: `problem-neon-${questionNo}`,
            title: `Neon question ${questionNo}`,
            difficulty: 3,
            tags: [`q${questionNo}`],
            attempt_count: 0,
            is_solved: false,
            solve_state: "none",
          },
          index,
        ),
        question_no: questionNo,
      })),
      error: null,
    });

    const { container } = renderInApp(<ProblemListView userId="user-1" />);

    await screen.findByText("Neon question 51");

    for (const questionNo of [51, 52, 53, 54]) {
      const badge = container.querySelector(
        `.problem-table__type-index--q${questionNo}`,
      );

      expect(badge?.textContent).toBe(String(questionNo));
      expect(
        badge?.classList.contains("problem-table__type-index--number"),
      ).toBe(true);
    }
  });

  it("renders problem tags as icon-led description metadata instead of filled AntD tags", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        rpcRow(
          {
            problem_id: "problem-tag-icons-51",
            title: "Icon tag problem",
            difficulty: 3,
            tags: ["교육", "문의", "설명"],
            attempt_count: 0,
            is_solved: false,
            solve_state: "none",
          },
          0,
        ),
      ],
      error: null,
    });

    const { container } = renderInApp(
      <ProblemListView userId="user-1" />,
      "ko",
    );

    await screen.findByText("Icon tag problem");

    const tags = Array.from(
      container.querySelectorAll(
        ".problem-table__tags .problem-table__tag--meta",
      ),
    );

    expect(tags).toHaveLength(3);
    expect(tags.map((tag) => tag.textContent)).toEqual([
      "교육",
      "문의",
      "설명",
    ]);
    expect(
      container.querySelector(
        ".problem-table__tags .problem-table__tag.ant-tag",
      ),
    ).toBeNull();
    expect(
      container.querySelectorAll(
        ".problem-table__tags .problem-table__tag-icon",
      ),
    ).toHaveLength(3);
  });

  it("starts an unsolved problem when the learner selects the problem row", async () => {
    navState.search = "type=51&sort=oldest&page=2";
    window.location.hash = "#results";
    rpcMock.mockResolvedValueOnce({
      data: [
        rpcRow(
          {
            problem_id: "problem-128",
            title: "51-128_동의어 어휘 빈칸",
            difficulty: 3,
            tags: ["어휘", "동의어", "빈칸"],
            attempt_count: 0,
            is_solved: false,
            solve_state: "none",
          },
          0,
        ),
      ],
      error: null,
    });

    renderInApp(<ProblemListView userId="user-1" />, "ko");

    const title = await screen.findByText("51-128_동의어 어휘 빈칸");
    const row = title.closest("tr");
    expect(row).toBeTruthy();

    fireEvent.click(row!);

    expect(navState.push).toHaveBeenCalledWith(
      "/writing/short-answer-writing-51?problem=problem-128&returnTo=%2Fpractice%2Fproblems%3Ftype%3D51%26sort%3Doldest%26page%3D2%23results",
    );
  });

  it("saves an unsolved problem to the saved problem library without opening the row", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        rpcRow(
          {
            problem_id: "problem-save-51",
            title: "Save this problem",
            difficulty: 3,
            tags: ["save"],
            attempt_count: 0,
            is_solved: false,
            solve_state: "none",
          },
          0,
        ),
      ],
      error: null,
    });

    const { container } = renderInApp(
      <ProblemListView userId="user-1" />,
      "ko",
    );

    await screen.findByText("Save this problem");
    const bookmarkButton = screen.getByRole("button", {
      name: "문제 저장",
    }) as HTMLButtonElement;
    expect(
      container.querySelector(".problem-table__overflow-button"),
    ).toBeNull();
    expect(bookmarkButton.className).toContain(
      "problem-table__bookmark-button",
    );
    expect(bookmarkButton.querySelector("svg.lucide-bookmark")).toBeTruthy();
    expect(bookmarkButton.querySelector("svg")?.getAttribute("fill")).toBe(
      "none",
    );
    expect(bookmarkButton.getAttribute("aria-pressed")).toBe("false");
    expect(bookmarkButton.textContent).toBe("");
    expect(
      container.querySelector(".problem-table__actions-compact"),
    ).toBeTruthy();
    await waitFor(() => {
      expect(bookmarkButton.disabled).toBe(false);
    });
    fireEvent.click(bookmarkButton);

    await waitFor(() => {
      expect(libraryInsertMock).toHaveBeenCalledWith({
        user_id: "user-1",
        item_type: "problem",
        problem_id: "problem-save-51",
      });
    });
    await waitFor(() => {
      expect(document.querySelector(".ant-message-notice")).toBeTruthy();
    });
    expect(
      screen.getByText(koMessages.practice.problems.saveProblemSuccess),
    ).toBeTruthy();
    expect(document.querySelector(".ant-notification-notice")).toBeNull();
    expect(navState.push).not.toHaveBeenCalled();
  });

  it("toggles already saved problems off without inserting duplicates", async () => {
    libraryRowsState.rows = [
      {
        id: "library-saved-51",
        problem_id: "problem-saved-51",
        title: "Already saved problem",
        question_no: 51,
        saved_at: "2026-07-08T00:00:00.000Z",
      },
    ];
    rpcMock.mockResolvedValueOnce({
      data: [
        rpcRow(
          {
            problem_id: "problem-saved-51",
            title: "Already saved problem",
            difficulty: 3,
            tags: ["saved"],
            attempt_count: 0,
            is_solved: false,
            solve_state: "none",
          },
          0,
        ),
      ],
      error: null,
    });

    const { container } = renderInApp(
      <ProblemListView userId="user-1" />,
      "ko",
    );

    await screen.findByText("Already saved problem");

    const savedButton = screen.getByRole("button", {
      name: "저장됨",
    }) as HTMLButtonElement;
    expect(
      container.querySelector(".problem-table__overflow-button"),
    ).toBeNull();
    expect(savedButton.className).toContain("problem-table__bookmark-button");
    expect(savedButton.disabled).toBe(false);
    expect(savedButton.getAttribute("aria-pressed")).toBe("true");
    expect(savedButton.querySelector("svg.lucide-bookmark")).toBeTruthy();
    expect(savedButton.querySelector("svg")?.getAttribute("fill")).toBe(
      "currentColor",
    );
    fireEvent.click(savedButton);

    expect(libraryInsertMock).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(libraryDeleteMock).toHaveBeenCalledWith("user_id", "user-1");
      expect(libraryDeleteMock).toHaveBeenCalledWith("item_type", "problem");
      expect(libraryDeleteMock).toHaveBeenCalledWith(
        "problem_id",
        "problem-saved-51",
      );
    });
    await waitFor(() => {
      expect(savedButton.getAttribute("aria-pressed")).toBe("false");
      expect(savedButton.querySelector("svg")?.getAttribute("fill")).toBe(
        "none",
      );
    });
  });

  it("treats duplicate problem save errors as an already saved state", async () => {
    libraryInsertState.error = {
      code: "23505",
      message:
        'duplicate key value violates unique constraint "library_items_user_problem_uniq"',
      details:
        "Key (user_id, problem_id)=(user-1, problem-dup-51) already exists.",
    };
    rpcMock.mockResolvedValueOnce({
      data: [
        rpcRow(
          {
            problem_id: "problem-dup-51",
            title: "Duplicate save problem",
            difficulty: 3,
            tags: ["saved"],
            attempt_count: 0,
            is_solved: false,
            solve_state: "none",
          },
          0,
        ),
      ],
      error: null,
    });

    renderInApp(<ProblemListView userId="user-1" />, "ko");

    await screen.findByText("Duplicate save problem");
    const bookmarkButton = screen.getByRole("button", {
      name: "문제 저장",
    }) as HTMLButtonElement;
    expect(
      document.querySelector(".problem-table__overflow-button"),
    ).toBeNull();
    expect(bookmarkButton.className).toContain(
      "problem-table__bookmark-button",
    );
    await waitFor(() => {
      expect(bookmarkButton.disabled).toBe(false);
    });
    fireEvent.click(bookmarkButton);

    await waitFor(() => {
      expect(libraryInsertMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      const savedButton = screen.getByRole("button", {
        name: "저장됨",
      }) as HTMLButtonElement;
      expect(savedButton.disabled).toBe(false);
      expect(savedButton.getAttribute("aria-pressed")).toBe("true");
      expect(savedButton.querySelector("svg")?.getAttribute("fill")).toBe(
        "currentColor",
      );
    });
  });

  it("opens the retry modal when the learner selects a row with prior work", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        rpcRow(
          {
            problem_id: "problem-127",
            title: "51-127_반의어 어휘 빈칸",
            difficulty: 2,
            tags: ["어휘", "반의어", "빈칸"],
            attempt_count: 1,
            is_solved: true,
            solve_state: "submitted",
          },
          0,
        ),
      ],
      error: null,
    });

    renderInApp(<ProblemListView userId="user-1" />, "ko");

    const title = await screen.findByText("51-127_반의어 어휘 빈칸");
    const row = title.closest("tr");
    expect(row).toBeTruthy();

    fireEvent.click(row!);

    expect(await screen.findByText("이전 풀이가 있어요")).toBeTruthy();
    expect(navState.push).not.toHaveBeenCalled();
  });

  it("renders the bookmark save control as an icon beside the retry action", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        rpcRow(
          {
            problem_id: "problem-retry-save-51",
            title: "Retry row bookmark action",
            difficulty: 2,
            tags: ["retry"],
            attempt_count: 1,
            is_solved: true,
            solve_state: "submitted",
          },
          0,
        ),
      ],
      error: null,
    });

    const { container } = renderInApp(
      <ProblemListView userId="user-1" />,
      "ko",
    );

    await screen.findByText("Retry row bookmark action");
    const retryButton = screen.getByText("다시 풀기").closest("button");
    const bookmarkButton = screen.getByRole("button", {
      name: "문제 저장",
    });
    expect(
      container.querySelector(".problem-table__overflow-button"),
    ).toBeNull();
    expect(bookmarkButton.className).toContain(
      "problem-table__bookmark-button",
    );
    if (!retryButton) {
      throw new Error("Expected retry button to render.");
    }

    const actions = bookmarkButton.closest(".problem-table__actions-compact");
    expect(bookmarkButton.textContent).toBe("");
    expect(actions).toBeTruthy();
    expect(actions?.contains(retryButton)).toBe(true);
    expect(actions?.contains(bookmarkButton)).toBe(true);
    fireEvent.click(bookmarkButton);
    await waitFor(() => {
      expect(libraryInsertMock).toHaveBeenCalledWith({
        user_id: "user-1",
        item_type: "problem",
        problem_id: "problem-retry-save-51",
      });
    });
  });

  it("matches the Start and Solve again action button sizing", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        rpcRow(
          {
            problem_id: "problem-start-size-51",
            title: "Start button size row",
            difficulty: 3,
            tags: ["size"],
            attempt_count: 0,
            is_solved: false,
            solve_state: "none",
          },
          0,
        ),
        rpcRow(
          {
            problem_id: "problem-retry-size-51",
            title: "Retry button size row",
            difficulty: 2,
            tags: ["size"],
            attempt_count: 1,
            is_solved: true,
            solve_state: "submitted",
          },
          1,
        ),
      ],
      error: null,
    });

    const { container } = renderInApp(
      <ProblemListView userId="user-1" />,
      "en",
    );

    await screen.findByText("Start button size row");
    const startButton = container.querySelector<HTMLButtonElement>(
      '[data-row-key="problem-start-size-51"] .problem-table__action-button',
    );
    const retryButton = container.querySelector<HTMLButtonElement>(
      '[data-row-key="problem-retry-size-51"] .problem-table__action-button',
    );

    expect(startButton?.className).toContain("problem-table__action-button");
    expect(retryButton?.className).toContain("problem-table__action-button");
    expect(startButton?.className).not.toContain("ant-btn-lg");
    expect(retryButton?.className).not.toContain("ant-btn-lg");
  });

  it("keeps submitted rows with pending analysis on the problem list", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          ...rpcRow(
            {
              problem_id: "problem-pending-51",
              title: "Pending analysis problem",
              difficulty: 2,
              tags: ["pending"],
              attempt_count: 1,
              is_solved: true,
              solve_state: "submitted",
            },
            0,
          ),
          latest_submission_id: "submission-pending-51",
          writing_feedback_status: "analyzing",
        },
      ],
      error: null,
    });

    renderInApp(<ProblemListView userId="user-1" />, "en");

    expect(await screen.findByText("Pending analysis problem")).toBeTruthy();
    const analysisStatusAction = screen.getByText("View analysis status");
    expect(analysisStatusAction).toBeTruthy();

    fireEvent.click(
      screen.getByText("Pending analysis problem").closest("tr")!,
    );
    fireEvent.click(analysisStatusAction);

    expect(navState.push).not.toHaveBeenCalled();
  });

  it("renders pending analysis rows without opening a row tooltip", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          ...rpcRow(
            {
              problem_id: "problem-tooltip-51",
              title: "Tooltip analysis problem",
              difficulty: 2,
              tags: ["pending"],
              attempt_count: 1,
              is_solved: true,
              solve_state: "submitted",
            },
            0,
          ),
          latest_submission_id: "submission-tooltip-51",
          writing_feedback_status: "analyzing",
        },
      ],
      error: null,
    });

    renderInApp(<ProblemListView userId="user-1" />, "en");

    expect(await screen.findByText("Tooltip analysis problem")).toBeTruthy();
    expect(screen.queryByText("Analyzing answer")).toBeNull();
    expect(screen.queryByTestId("problem-analysis-tooltip-trigger")).toBeNull();
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.click(
      screen.getByText("Tooltip analysis problem").closest("tr")!,
    );
    expect(navState.push).not.toHaveBeenCalled();
  });

  it("keeps long problem titles intact for CSS two-line clamping without native title tooltips", async () => {
    const longTitle =
      "51-999_Long problem title that should remain intact and be visually clamped by CSS instead of truncated in React";
    rpcMock.mockResolvedValueOnce({
      data: [
        rpcRow(
          {
            problem_id: "problem-long-title-51",
            title: longTitle,
            difficulty: 3,
            tags: ["long-title"],
            attempt_count: 0,
            is_solved: false,
            solve_state: "none",
          },
          0,
        ),
      ],
      error: null,
    });

    renderInApp(<ProblemListView userId="user-1" />, "en");

    const title = await screen.findByText(longTitle);
    expect(title.className).toContain("problem-table__title");
    expect(title.textContent).toBe(longTitle);
    expect(title.getAttribute("title")).toBeNull();
    expect(screen.queryByText(`${longTitle.slice(0, 32)}...`)).toBeNull();
  });

  it("runs the failed-load retry only once while refetch is pending", async () => {
    const pending = new Promise(() => undefined);
    rpcMock
      .mockRejectedValueOnce(new Error("problem_list_timeout"))
      .mockReturnValue(pending);

    renderInApp(<ProblemListView userId="user-1" />, "ko");

    const retry = await screen.findByRole("button", {
      name: koMessages.practice.problems.retry,
    });
    fireEvent.click(retry);
    fireEvent.click(retry);

    expect(rpcMock).toHaveBeenCalledTimes(2);
  });

  it("marks failed submitted rows as analysis failed while keeping the retry CTA", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          ...rpcRow(
            {
              problem_id: "problem-failed-51",
              title: "Failed analysis problem",
              difficulty: 2,
              tags: ["failed"],
              attempt_count: 1,
              is_solved: true,
              solve_state: "submitted",
            },
            0,
          ),
          latest_submission_id: "submission-failed-51",
          writing_feedback_status: "failed",
        },
      ],
      error: null,
    });

    renderInApp(<ProblemListView userId="user-1" />, "en");

    expect(await screen.findByText("Failed analysis problem")).toBeTruthy();
    expect(
      screen.getByText(enMessages.practice.problems.analysisFailedBadge),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: enMessages.practice.problems.retryAttempt,
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: enMessages.practice.problems.analysisStatusAction,
      }),
    ).toBeNull();

    fireEvent.click(screen.getByText("Failed analysis problem").closest("tr")!);

    await screen.findByTestId("retry-modal-compact-summary");
    expect(
      screen.getByTestId("retry-modal-compact-summary").textContent,
    ).toContain(enMessages.practice.retry.statusSubmittedRecentFailure);
    fireEvent.click(
      screen.getByRole("button", {
        name: enMessages.practice.retry.viewFailedStatus,
      }),
    );

    expect(navState.push).toHaveBeenCalledWith(
      "/writing/feedback/short/submission-failed-51",
    );
  });
});
