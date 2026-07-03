// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

import koMessages from "../../../messages/ko.json";
import type {
  LibraryItemView,
  LibraryProblemView,
  LibrarySubmissionView,
} from "../../../src/lib/library/types";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

vi.mock("@/lib/library/queries", () => ({
  useLibraryItems: vi.fn(),
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
  title: "휴대전화 진동 문장 완성",
  question_no: 52,
  item_id: "library-problem-1",
  saved_at: "2026-06-30T10:00:00.000Z",
  tags: ["bookmark"],
  availabilityStatus: "available",
  availabilityReason: null,
  canRetry: true,
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
  mockedUseLibraryItems.mockImplementation((tab) => {
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
      initialSubmissions={[submission]}
      initialProblems={[problem]}
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

    // 유형 라벨은 행 태그와 필터 카드에 함께 노출된다.
    expect(
      screen.getAllByText(koMessages.library.problemsList.typeProblem).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(koMessages.library.problemsList.typeSubmission)
        .length,
    ).toBeGreaterThan(0);

    expect(
      screen
        .getByRole("link", { name: koMessages.library.saved.retry })
        .getAttribute("href"),
    ).toBe("/writing/answer-writing-52?problem=problem-52");

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
      <LibraryProblemsList initialSubmissions={[]} initialProblems={[]} />,
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
        initialSubmissions={[]}
        initialProblems={problems}
      />,
    );

    expect(screen.getAllByTestId("library-problems-mixed-row")).toHaveLength(
      10,
    );
    expect(screen.getByTestId("library-pagination")).toBeTruthy();
  });

  it("renders filter cards with facet counts", async () => {
    renderList();

    expect(screen.getByTestId("library-problems-filter-cards")).toBeTruthy();
    expect(
      screen.getByTestId("library-problems-filter-count-submissions")
        .textContent,
    ).toBe("1");
    expect(
      screen.getByTestId("library-problems-filter-count-problems").textContent,
    ).toBe("1");

    // enrichment 반영 후 complete=1, pending=0으로 이동한다.
    await waitFor(() => {
      expect(
        screen.getByTestId("library-problems-filter-count-statusComplete")
          .textContent,
      ).toBe("1");
    });
    expect(
      screen.getByTestId("library-problems-filter-count-statusPending")
        .textContent,
    ).toBe("0");
    expect(
      screen.getByTestId("library-problems-filter-count-providedEnded")
        .textContent,
    ).toBe("0");
  });

  it("filters the list by checked cards as a union", () => {
    renderList();

    fireEvent.click(
      screen.getByTestId("library-problems-filter-card-submissions"),
    );
    let rows = screen.getAllByTestId("library-problems-mixed-row");
    expect(rows).toHaveLength(1);
    expect(rows[0].getAttribute("data-library-kind")).toBe("submission");

    fireEvent.click(
      screen.getByTestId("library-problems-filter-card-problems"),
    );
    rows = screen.getAllByTestId("library-problems-mixed-row");
    expect(rows).toHaveLength(2);

    fireEvent.click(
      screen.getByTestId("library-problems-filter-card-submissions"),
    );
    rows = screen.getAllByTestId("library-problems-mixed-row");
    expect(rows).toHaveLength(1);
    expect(rows[0].getAttribute("data-library-kind")).toBe("problem");
  });

  it("shows the filter empty state and resets checked filters", () => {
    renderList();

    fireEvent.click(
      screen.getByTestId("library-problems-filter-card-statusFailed"),
    );
    expect(
      screen.getByText(koMessages.library.problemsList.emptyFiltered),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: koMessages.library.saved.resetFilter,
      }),
    );
    expect(screen.getAllByTestId("library-problems-mixed-row")).toHaveLength(2);
  });

  it("hides filter cards when nothing is saved", () => {
    configureQueries({ submissions: [], problems: [] });

    renderList(
      <LibraryProblemsList initialSubmissions={[]} initialProblems={[]} />,
    );

    expect(screen.queryByTestId("library-problems-filter-cards")).toBeNull();
  });
});
