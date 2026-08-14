// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

import koMessages from "../../../messages/ko.json";
import type {
  LibraryDraftView,
  LibraryItemView,
  LibraryProblemView,
  LibrarySubmissionView,
} from "../../../src/lib/library/types";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

const exportPdfWithPrintFallbackMock = vi.hoisted(() => vi.fn());
const routerPushMock = vi.hoisted(() => vi.fn());
const compareMutateMock = vi.hoisted(() => vi.fn());
const appApiMocks = vi.hoisted(() => ({
  notification: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
  message: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
  modal: {},
}));

const actionMenuLabels = {
  open: "\ubb38\uc81c \uc791\uc5c5 \uba54\ub274 \uc5f4\uae30",
  exportPdf: "PDF \ub0b4\ubcf4\ub0b4\uae30",
  nextProblem: "\ub2e4\uc74c \ubb38\uc81c \ud480\uae30",
  compareReport: "\ube44\uad50 \ub9ac\ud3ec\ud2b8",
  retry: "\ub2e4\uc2dc \ud480\uae30",
};

vi.mock("@/lib/library/queries", () => ({
  useLibraryItems: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
  }),
}));

vi.mock("antd", async (importOriginal) => {
  const actual = await importOriginal<typeof import("antd")>();
  return {
    ...actual,
    App: Object.assign(actual.App, {
      useApp: () => appApiMocks,
    }),
  };
});

vi.mock("@/lib/export/pdf-export-client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/export/pdf-export-client")>();
  return {
    ...actual,
    exportPdfWithPrintFallback: exportPdfWithPrintFallbackMock,
  };
});

vi.mock("@/lib/writing/mutations", () => ({
  useCreateComparisonReport: () => ({
    isPending: false,
    mutate: compareMutateMock,
  }),
}));

vi.mock("@/components/library/library-enrich-data", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    fetchSubmissionEnrichment: vi.fn(),
  };
});

import { LibraryProblemsList } from "../../../src/components/library/LibraryProblemsList";
import { fetchSubmissionEnrichment } from "@/components/library/library-enrich-data";
import { useLibraryItems } from "@/lib/library/queries";

const mockedUseLibraryItems = vi.mocked(useLibraryItems);
const mockedFetchSubmissionEnrichment = vi.mocked(fetchSubmissionEnrichment);

const submission: LibrarySubmissionView = {
  kind: "submission",
  id: "sub-1",
  problem_id: "problem-53",
  problem_title: "문화 소비 다양화 영향",
  question_no: 53,
  submitted_at: "2026-06-29T09:30:00.000Z",
  char_count: 252,
  item_id: "library-sub-1",
  saved_at: "2026-06-29T10:00:00.000Z",
  tags: ["weak-structure"],
};

const problem: LibraryProblemView = {
  kind: "problem",
  id: "problem-52",
  title: "No. 52 - 휴대전화 진동 문장 완성",
  question_no: 52,
  answer_text: "bookmark answer body",
  item_id: "library-problem-1",
  saved_at: "2026-06-30T10:00:00.000Z",
  tags: ["bookmark"],
  availabilityStatus: "available",
  availabilityReason: null,
  canRetry: true,
};

const draft: LibraryDraftView = {
  kind: "draft",
  id: "draft-51",
  problem_id: "problem-51",
  problem_title: "No. 51 - Draft answer problem",
  question_no: 51,
  answer_text: "draft body",
  char_count: 10,
  autosave_status: "clean",
  item_id: "draft:draft-51",
  saved_at: "2026-07-01T10:00:00.000Z",
  last_saved_at: "2026-07-01T10:00:00.000Z",
};

function configureQueries({
  submissions = undefined,
  problems = undefined,
  isLoading = false,
  error = null,
}: {
  submissions?: LibraryItemView[];
  problems?: LibraryItemView[];
  isLoading?: boolean;
  error?: Error | null;
} = {}) {
  mockedUseLibraryItems.mockImplementation((_userId, tab) => {
    if (tab === "submissions") {
      return { data: submissions, isLoading, error } as never;
    }
    if (tab === "problems") {
      return { data: problems, isLoading, error } as never;
    }
    return { data: [], isLoading: false, error: null } as never;
  });
}

function renderList(
  ui: ReactElement = (
    <LibraryProblemsList
      userId="user-1"
      initialSubmissions={[submission]}
      initialProblems={[problem]}
      initialDrafts={[]}
    />
  ),
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderWithIntl(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

async function waitForEnrichment() {
  await waitFor(() => {
    expect(screen.getByText(/68\/100/)).toBeTruthy();
  });
}

beforeEach(() => {
  configureQueries();
  mockedFetchSubmissionEnrichment.mockResolvedValue(
    new Map([
      [
        "sub-1",
        {
          feedbackStatus: "complete",
          scoreTotal: 68,
          scoreMax: 100,
          summary: "구조 보완이 필요합니다.",
        },
      ],
    ]),
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LibraryProblemsList", () => {
  it("mixes saved submissions and problems in saved_at descending order", async () => {
    renderList();

    const rows = screen.getAllByTestId("library-problems-mixed-row");
    expect(rows).toHaveLength(2);
    expect(rows[0].getAttribute("data-library-kind")).toBe("problem");
    expect(rows[1].getAttribute("data-library-kind")).toBe("submission");

    const resultsColumn = screen.getByTestId("library-problems-results-column");
    const problemRow = rows[0];
    expect(
      within(problemRow).getByTestId("library-problems-type-badge").textContent,
    ).toBe("북마크");
    expect(
      within(resultsColumn).queryByText(
        koMessages.library.submissions.statusComplete,
      ),
    ).toBeNull();
    expect(within(resultsColumn).queryByText(/No\.\s*5[1-4]/)).toBeNull();
    expect(
      within(resultsColumn).getAllByTestId("library-problems-question-number")
        .length,
    ).toBeGreaterThan(0);
    expect(
      within(resultsColumn).getByText("휴대전화 진동 문장 완성"),
    ).toBeTruthy();
    const list = screen.getByTestId("library-item-list");
    expect(within(list).queryAllByText(/2026-06-(29|30)/)).toHaveLength(0);
    expect(within(list).queryAllByText("252자")).toHaveLength(0);

    expect(
      within(rows[0]).queryByRole("link", {
        name: koMessages.library.saved.retry,
      }),
    ).toBeNull();
    expect(
      within(rows[0]).getByRole("button", { name: actionMenuLabels.open }),
    ).toBeTruthy();

    const feedbackLink = await screen.findByRole("link", {
      name: /문화 소비 다양화 영향/,
    });
    expect(feedbackLink.getAttribute("href")).toBe(
      "/writing/feedback/long/sub-1",
    );

    await waitFor(() => {
      expect(screen.getByText("구조 보완이 필요합니다.")).toBeTruthy();
      expect(screen.getByText(/68\/100/)).toBeTruthy();
    });
  });

  it("moves saved problem retry into the shared action menu", async () => {
    renderList();

    const problemRow = screen
      .getAllByTestId("library-problems-mixed-row")
      .find((row) => row.getAttribute("data-library-kind") === "problem");
    if (!problemRow) throw new Error("expected problem row");

    expect(
      within(problemRow).queryByRole("link", {
        name: koMessages.library.saved.retry,
      }),
    ).toBeNull();

    fireEvent.click(
      within(problemRow).getByRole("button", {
        name: actionMenuLabels.open,
      }),
    );
    const menu = await screen.findByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual([actionMenuLabels.retry]);

    fireEvent.click(
      within(menu).getByRole("menuitem", { name: actionMenuLabels.retry }),
    );
    expect(routerPushMock).toHaveBeenLastCalledWith(
      "/writing/answer-writing-52?problem=problem-52&returnTo=%2Flibrary%2Fproblems",
    );
  });

  it("renders bookmarked problem title with a bookmark tag and optional answer preview", () => {
    const problemTitleText = "Festival trash prompt title";
    const answerText = "ㄱ: bookmark answer preview";

    renderList(
      <LibraryProblemsList
        userId="user-1"
        initialSubmissions={[]}
        initialProblems={[
          { ...problem, title: problemTitleText, answer_text: answerText },
        ]}
        initialDrafts={[]}
      />,
    );

    const problemRow = screen.getByTestId("library-problems-mixed-row");
    expect(
      within(problemRow).getByText(problemTitleText, { selector: "strong" }),
    ).toBeTruthy();
    expect(
      within(problemRow).getByTestId("library-problems-type-badge").textContent,
    ).toBe("북마크");

    const answer = within(problemRow).getByText(answerText);
    expect(answer.closest(".ant-typography-secondary")).toBeTruthy();
    expect(
      within(problemRow).queryByText(answerText, { selector: "strong" }),
    ).toBeNull();
    expect(
      within(problemRow).queryByText(problemTitleText, {
        selector: ".ant-typography-secondary",
      }),
    ).toBeNull();

    fireEvent.click(
      screen.getByTitle(koMessages.library.problemsList.viewCard),
    );

    const card = screen.getByTestId("library-problems-mixed-row");
    expect(
      within(card).getByText(problemTitleText, { selector: "strong" }),
    ).toBeTruthy();
    expect(
      within(card).getByTestId("library-problems-type-badge").textContent,
    ).toBe("북마크");
    const cardAnswer = within(card).getByText(answerText);
    expect(cardAnswer.closest(".ant-typography-secondary")).toBeTruthy();
    expect(
      within(card).queryByText(answerText, { selector: "strong" }),
    ).toBeNull();
  });

  it("shows the four-item action menu for completed submissions", async () => {
    exportPdfWithPrintFallbackMock.mockResolvedValue({
      exportId: "export-1",
      mode: "file",
    });
    compareMutateMock.mockImplementation(
      (
        _input: unknown,
        options?: {
          onSuccess?: (data: { reportId: string }) => void;
        },
      ) => {
        options?.onSuccess?.({ reportId: "report-1" });
      },
    );

    renderList();
    await waitForEnrichment();

    const rows = screen.getAllByTestId("library-problems-mixed-row");
    const submissionRow = rows.find(
      (row) => row.getAttribute("data-library-kind") === "submission",
    );
    const problemRow = rows.find(
      (row) => row.getAttribute("data-library-kind") === "problem",
    );
    if (!submissionRow || !problemRow) {
      throw new Error("expected submission and problem rows");
    }

    expect(
      within(problemRow).getByRole("button", {
        name: actionMenuLabels.open,
      }),
    ).toBeTruthy();
    expect(
      within(problemRow).queryByRole("link", {
        name: koMessages.library.saved.retry,
      }),
    ).toBeNull();

    const trigger = within(submissionRow).getByRole("button", {
      name: actionMenuLabels.open,
    });
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");

    fireEvent.click(trigger);
    let menu = await screen.findByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual([
      actionMenuLabels.exportPdf,
      actionMenuLabels.nextProblem,
      actionMenuLabels.compareReport,
      actionMenuLabels.retry,
    ]);

    fireEvent.click(
      within(menu).getByRole("menuitem", {
        name: actionMenuLabels.exportPdf,
      }),
    );
    await waitFor(() => {
      expect(exportPdfWithPrintFallbackMock).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: "submission",
          sourceId: "sub-1",
        }),
      );
    });
    expect(appApiMocks.message.success).toHaveBeenCalledWith(
      koMessages.feedback.actions.pdfDownloaded,
    );
    expect(appApiMocks.notification.success).not.toHaveBeenCalled();

    fireEvent.click(trigger);
    menu = await screen.findByRole("menu");
    fireEvent.click(
      within(menu).getByRole("menuitem", {
        name: actionMenuLabels.nextProblem,
      }),
    );
    expect(routerPushMock).toHaveBeenLastCalledWith("/practice/next");

    fireEvent.click(trigger);
    menu = await screen.findByRole("menu");
    fireEvent.click(
      within(menu).getByRole("menuitem", {
        name: actionMenuLabels.compareReport,
      }),
    );
    expect(compareMutateMock).toHaveBeenCalledWith(
      { current_id: "sub-1" },
      expect.objectContaining({
        onError: expect.any(Function),
        onSuccess: expect.any(Function),
      }),
    );
    expect(routerPushMock).toHaveBeenLastCalledWith(
      "/writing/reports/report-1/compare",
    );

    fireEvent.click(trigger);
    menu = await screen.findByRole("menu");
    fireEvent.click(
      within(menu).getByRole("menuitem", { name: actionMenuLabels.retry }),
    );
    expect(routerPushMock).toHaveBeenLastCalledWith(
      "/writing/long-form-writing-53?problem=problem-53&fresh=1&retrySubmission=sub-1&returnTo=%2Flibrary%2Fproblems",
    );
  });

  it("hides submission action menus while analysis is pending", async () => {
    mockedFetchSubmissionEnrichment.mockResolvedValue(
      new Map([
        [
          "sub-1",
          {
            feedbackStatus: "analyzing",
            scoreTotal: null,
            scoreMax: null,
            summary: null,
          },
        ],
      ]),
    );

    renderList();

    await waitFor(() => {
      expect(
        screen.getByText(koMessages.library.submissions.analysisPendingHint),
      ).toBeTruthy();
    });
    const submissionRow = screen
      .getAllByTestId("library-item-row")
      .find((row) => row.getAttribute("data-library-tab") === "submissions");
    if (!submissionRow) throw new Error("submission row not found");

    expect(
      within(submissionRow).queryByRole("button", {
        name: actionMenuLabels.open,
      }),
    ).toBeNull();
  });

  it("hides submission action menus when analysis failed", async () => {
    mockedFetchSubmissionEnrichment.mockResolvedValue(
      new Map([
        [
          "sub-1",
          {
            feedbackStatus: "failed",
            scoreTotal: null,
            scoreMax: null,
            summary: "분석 실패 답안은 메뉴를 숨깁니다.",
          },
        ],
      ]),
    );

    renderList();

    await waitFor(() => {
      expect(
        screen.getByText("분석 실패 답안은 메뉴를 숨깁니다."),
      ).toBeTruthy();
    });
    const submissionRow = screen
      .getAllByTestId("library-item-row")
      .find((row) => row.getAttribute("data-library-tab") === "submissions");
    if (!submissionRow) throw new Error("submission row not found");

    expect(
      within(submissionRow).queryByRole("button", {
        name: actionMenuLabels.open,
      }),
    ).toBeNull();
  });

  it("does not render delete buttons in the problems list rows", () => {
    renderList();

    expect(
      screen.queryByRole("button", {
        name: koMessages.library.item.delete,
      }),
    ).toBeNull();
  });

  it("searches by type label and resets an empty search result", () => {
    renderList();

    const search = screen.getByLabelText(
      koMessages.library.problemsList.searchAriaLabel,
    );
    fireEvent.change(search, {
      target: { value: koMessages.library.problemsList.typeSubmission },
    });

    let rows = screen.getAllByTestId("library-problems-mixed-row");
    expect(rows).toHaveLength(1);
    expect(rows[0].getAttribute("data-library-kind")).toBe("submission");

    fireEvent.change(search, { target: { value: "없는 검색어" } });
    expect(
      screen.getByText(koMessages.library.problemsList.emptySearch),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: koMessages.library.problemsList.resetSearch,
      }),
    );
    rows = screen.getAllByTestId("library-problems-mixed-row");
    expect(rows).toHaveLength(2);
  });

  it("shows empty state when there are no saved submissions or problems", () => {
    configureQueries({ submissions: [], problems: [] });

    renderList(
      <LibraryProblemsList
        userId="user-1"
        initialSubmissions={[]}
        initialProblems={[]}
        initialDrafts={[]}
      />,
    );

    expect(
      screen.getByText(koMessages.library.problemsList.emptyNoItems),
    ).toBeTruthy();
  });

  it("paginates the mixed list with ten rows per page", () => {
    const problems = Array.from({ length: 11 }, (_, index) => ({
      ...problem,
      id: `problem-${index}`,
      item_id: `library-problem-${index}`,
      title: `저장 문제 ${index}`,
      saved_at: `2026-06-${String(30 - index).padStart(2, "0")}T10:00:00.000Z`,
    }));

    renderList(
      <LibraryProblemsList
        userId="user-1"
        initialSubmissions={[]}
        initialProblems={problems}
        initialDrafts={[]}
      />,
    );

    expect(screen.getAllByTestId("library-problems-mixed-row")).toHaveLength(
      10,
    );
    expect(screen.getByTestId("library-pagination")).toBeTruthy();
  });

  it("renders the filter panel groups with facet counts", async () => {
    renderList();

    expect(screen.getByTestId("library-problems-filter-panel")).toBeTruthy();
    expect(
      screen.getByTestId("library-problems-filter-panel").className,
    ).toContain("gap-6");
    expect(
      screen.getByTestId("library-problems-filter-panel-desktop"),
    ).toBeTruthy();
    expect(
      screen.getByTestId("library-problems-filter-panel-desktop").className,
    ).toContain("sticky");
    expect(
      screen.getByTestId("library-problems-filter-panel-desktop").className,
    ).toContain("top-6");
    expect(
      screen.getByTestId("library-problems-filter-panel-desktop").className,
    ).toContain("w-[22rem]");
    expect(
      screen.getByTestId("library-problems-filter-panel-desktop").className,
    ).toContain("overflow-x-hidden");
    expect(
      screen.getByTestId("library-problems-filter-kind-submission-count")
        .textContent,
    ).toBe("1");
    expect(
      screen.getByTestId("library-problems-filter-kind-problem-count")
        .textContent,
    ).toBe("1");
    expect(
      screen.getByTestId("library-problems-filter-kind-draft-count")
        .textContent,
    ).toBe("0");
    const itemTypeGroup = screen.getByTestId(
      "library-problems-filter-group-item-type",
    );
    expect(
      within(itemTypeGroup).queryByTestId(
        "library-problems-filter-availability-soft_unavailable",
      ),
    ).toBeNull();
    expect(
      screen.getByTestId("library-problems-filter-group-submission-status"),
    ).toBeTruthy();
    expect(
      screen.getByTestId("library-problems-filter-group-problem-availability"),
    ).toBeTruthy();
    expect(
      screen.getByTestId("library-problems-filter-question-52-count")
        .textContent,
    ).toBe("1");
    expect(
      screen.getByTestId("library-problems-filter-question-51-count")
        .textContent,
    ).toBe("0");
    // 날짜 프리셋과 점수 슬라이더 그룹도 함께 렌더링된다.
    expect(
      screen.getByTestId("library-problems-filter-date-presets"),
    ).toBeTruthy();
    expect(
      screen.getByTestId("library-problems-filter-score-slider"),
    ).toBeTruthy();
    expect(
      screen.getByTestId("library-problems-filter-date-stack").className,
    ).toContain("gap-4");
    expect(
      screen.getByTestId("library-problems-filter-date-presets").className,
    ).toContain("grid");
    expect(
      screen.getByTestId("library-problems-filter-date-presets").className,
    ).toContain("library-problems-date-presets");
    expect(
      screen.getByTestId("library-problems-filter-date-presets").className,
    ).toContain("gap-x-8");
    expect(
      screen.getByTestId("library-problems-filter-date-presets").className,
    ).toContain("gap-y-5");
    expect(
      screen.getByTestId("library-problems-filter-date-range").className,
    ).toContain("px-3");
    expect(
      screen.getByTestId("library-problems-filter-score-slider").className,
    ).toContain("px-3");
    const resetButton = screen.getByTestId("library-problems-filter-reset");
    expect(resetButton.getAttribute("aria-label")).toBe(
      koMessages.library.saved.resetFilter,
    );
    expect(resetButton.className).toContain("mr-2");
    const resetIcon = resetButton.querySelector("svg");
    expect(resetIcon).toBeTruthy();
    expect(resetIcon?.getAttribute("width")).toBe("18");
    expect(resetIcon?.getAttribute("height")).toBe("18");
    expect(resetButton.textContent?.trim()).toBe("");

    // enrichment 반영 후 complete=1, pending=0으로 이동한다.
    await waitFor(() => {
      expect(
        screen.getByTestId("library-problems-filter-status-complete-count")
          .textContent,
      ).toBe("1");
    });
    expect(
      screen.getByTestId("library-problems-filter-status-pending-count")
        .textContent,
    ).toBe("0");
    expect(
      screen.getByTestId(
        "library-problems-filter-availability-soft_unavailable-count",
      ).textContent,
    ).toBe("0");
  });

  it("keeps toolbar controls on the search row without a result count label", () => {
    renderList();

    expect(screen.getByTestId("library-problems-toolbar")).toBeTruthy();
    expect(screen.queryByTestId("library-problems-result-count")).toBeNull();
    expect(
      screen.getByTestId("library-problems-toolbar-controls"),
    ).toBeTruthy();
    expect(screen.getByTestId("library-problems-sort")).toBeTruthy();

    const viewToggleShell = screen.getByTestId("library-problems-view-toggle");
    expect(viewToggleShell.className).toContain(
      "library-problems-view-toggle-shell",
    );
    expect(
      viewToggleShell.querySelector(".library-problems-view-toggle"),
    ).toBeTruthy();
  });

  it("filters by item kind as a branch union", () => {
    renderList();

    fireEvent.click(
      screen.getByTestId("library-problems-filter-kind-submission"),
    );
    let rows = screen.getAllByTestId("library-problems-mixed-row");
    expect(rows).toHaveLength(1);
    expect(rows[0].getAttribute("data-library-kind")).toBe("submission");

    fireEvent.click(screen.getByTestId("library-problems-filter-kind-problem"));
    rows = screen.getAllByTestId("library-problems-mixed-row");
    expect(rows).toHaveLength(2);

    fireEvent.click(
      screen.getByTestId("library-problems-filter-kind-submission"),
    );
    rows = screen.getAllByTestId("library-problems-mixed-row");
    expect(rows).toHaveLength(1);
    expect(rows[0].getAttribute("data-library-kind")).toBe("problem");
  });

  it("filters temporary drafts separately from saved answers and bookmarked problems", async () => {
    renderList(
      <LibraryProblemsList
        userId="user-1"
        initialSubmissions={[submission]}
        initialProblems={[problem]}
        initialDrafts={[draft]}
      />,
    );

    expect(
      screen.getByTestId("library-problems-filter-kind-draft-count")
        .textContent,
    ).toBe("1");

    fireEvent.click(screen.getByTestId("library-problems-filter-kind-draft"));

    const rows = screen.getAllByTestId("library-problems-mixed-row");
    expect(rows).toHaveLength(1);
    expect(rows[0].getAttribute("data-library-kind")).toBe("draft");
    expect(
      within(rows[0]).queryByRole("link", {
        name: koMessages.library.problemsList.continueDraft,
      }),
    ).toBeNull();

    fireEvent.click(
      within(rows[0]).getByRole("button", { name: actionMenuLabels.open }),
    );
    const menu = await screen.findByRole("menu");
    fireEvent.click(
      within(menu).getByRole("menuitem", {
        name: koMessages.library.problemsList.continueDraft,
      }),
    );
    expect(routerPushMock).toHaveBeenLastCalledWith(
      "/writing/short-answer-writing-51?problem=problem-51&returnTo=%2Flibrary%2Fproblems",
    );
  });

  it("combines the question type group with the kind group as AND", () => {
    renderList();

    fireEvent.click(screen.getByTestId("library-problems-filter-question-53"));
    const rows = screen.getAllByTestId("library-problems-mixed-row");
    expect(rows).toHaveLength(1);
    expect(rows[0].getAttribute("data-library-kind")).toBe("submission");

    // 53번(답안뿐) AND 저장 문제 브랜치 → 매칭 없음.
    fireEvent.click(screen.getByTestId("library-problems-filter-kind-problem"));
    expect(
      screen.getByText(koMessages.library.problemsList.emptyFiltered),
    ).toBeTruthy();
  });

  it("shows the filter empty state and resets all groups at once", async () => {
    renderList();
    await waitForEnrichment();

    fireEvent.click(
      screen.getByTestId("library-problems-filter-status-failed"),
    );
    const empty = screen.getByTestId("library-problems-empty");
    expect(
      within(empty).getByText(koMessages.library.problemsList.emptyFiltered),
    ).toBeTruthy();

    fireEvent.click(
      within(empty).getByRole("button", {
        name: koMessages.library.saved.resetFilter,
      }),
    );
    expect(screen.getAllByTestId("library-problems-mixed-row")).toHaveLength(2);
  });

  it("shows a loading indicator instead of the filtered empty state while enrichment loads", () => {
    mockedFetchSubmissionEnrichment.mockReturnValue(new Promise(() => {}));
    renderList();

    fireEvent.click(
      screen.getByTestId("library-problems-filter-status-failed"),
    );
    expect(screen.getByTestId("library-problems-enrich-loading")).toBeTruthy();
    expect(screen.queryByTestId("library-problems-empty")).toBeNull();
  });

  it("opens the mobile filter drawer with the shared panel content", async () => {
    renderList();

    fireEvent.click(screen.getByTestId("library-problems-filter-open"));

    await waitFor(() => {
      expect(
        screen.getByTestId("library-problems-filter-drawer-apply"),
      ).toBeTruthy();
    });
    // 데스크톱 aside + Drawer 양쪽에 같은 패널 콘텐츠가 렌더링된다.
    expect(screen.getAllByTestId("library-problems-filter-panel").length).toBe(
      2,
    );
  });

  it("sorts by score keeping unscored items last", async () => {
    renderList();
    await waitForEnrichment();

    // 기본: 최근 저장 순 → problem(6/30)이 submission(6/29)보다 앞.
    let rows = screen.getAllByTestId("library-problems-mixed-row");
    expect(rows[0].getAttribute("data-library-kind")).toBe("problem");

    fireEvent.mouseDown(
      screen.getByRole("combobox", {
        name: koMessages.library.problemsList.sortAriaLabel,
      }),
    );
    const matches = await screen.findAllByText(
      koMessages.library.problemsList.sortScoreDesc,
    );
    const option = matches.find((node) =>
      node.closest(".ant-select-item-option"),
    );
    if (!option) throw new Error("sort option not found");
    fireEvent.click(option);

    // 점수 있는 submission이 앞으로, 점수 없는 problem은 뒤로.
    rows = screen.getAllByTestId("library-problems-mixed-row");
    expect(rows[0].getAttribute("data-library-kind")).toBe("submission");
    expect(rows[1].getAttribute("data-library-kind")).toBe("problem");
  });

  it("switches between list and card views", async () => {
    renderList();
    await waitForEnrichment();

    expect(screen.getByTestId("library-item-list")).toBeTruthy();
    expect(screen.queryByTestId("library-problems-card-grid")).toBeNull();

    fireEvent.click(
      screen.getByTitle(koMessages.library.problemsList.viewCard),
    );

    const cardGrid = screen.getByTestId("library-problems-card-grid");
    expect(cardGrid).toBeTruthy();
    expect(screen.queryByTestId("library-item-list")).toBeNull();
    expect(
      within(cardGrid).getByTestId("library-problems-type-badge").textContent,
    ).toBe("북마크");
    expect(
      within(cardGrid).queryByText(
        koMessages.library.submissions.statusComplete,
      ),
    ).toBeNull();
    expect(within(cardGrid).queryByText(/No\.\s*5[1-4]/)).toBeNull();
    expect(
      within(cardGrid).getAllByTestId("library-problems-question-number")
        .length,
    ).toBeGreaterThan(0);
    expect(within(cardGrid).queryAllByText(/2026-06-(29|30)/)).toHaveLength(0);
    expect(within(cardGrid).queryAllByText("252자")).toHaveLength(0);
    // Card view keeps the mixed-row testid contract and submission-only menu.
    expect(screen.getAllByTestId("library-problems-mixed-row")).toHaveLength(2);
    expect(
      within(cardGrid).queryByRole("link", {
        name: koMessages.library.saved.retry,
      }),
    ).toBeNull();
    expect(
      within(cardGrid).getAllByRole("button", {
        name: actionMenuLabels.open,
      }).length,
    ).toBe(2);

    fireEvent.click(
      screen.getByTitle(koMessages.library.problemsList.viewList),
    );
    expect(screen.getByTestId("library-item-list")).toBeTruthy();
  });

  it("hides the filter panel and filter button when nothing is saved", () => {
    configureQueries({ submissions: [], problems: [] });

    renderList(
      <LibraryProblemsList
        userId="user-1"
        initialSubmissions={[]}
        initialProblems={[]}
        initialDrafts={[]}
      />,
    );

    expect(
      screen.queryByTestId("library-problems-filter-panel-desktop"),
    ).toBeNull();
    expect(screen.queryByTestId("library-problems-filter-open")).toBeNull();
  });
});
