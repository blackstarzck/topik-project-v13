// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: navState.push,
    replace: navState.replace,
  }),
  useSearchParams: () => new URLSearchParams(navState.search),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: () => ({
      select: () => ({
        in: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
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
  navState.push.mockReset();
  navState.replace.mockReset();
  navState.search = "";
  rpcMock.mockReset();
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

    renderInApp(<ProblemListView userId="user-1" />, "ko");

    await screen.findByText("51-128_동의어 어휘 빈칸");

    expect(
      screen.getByRole("columnheader", {
        name: koMessages.practice.problems.problemColumnLabel,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("columnheader", {
        name: koMessages.practice.problems.difficultyLabel,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("columnheader", {
        name: koMessages.practice.problems.estimatedTimeLabel,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("columnheader", {
        name: koMessages.practice.problems.previousScoreLabel,
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("columnheader", {
        name: koMessages.practice.problems.solveStatusLabel,
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("columnheader", {
        name: koMessages.practice.problems.solveAction,
      }),
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
    expect(screen.getAllByRole("button", { name: /시작하기/ })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /다시 풀기/ })).toHaveLength(
      4,
    );
  }, 45_000);

  it("starts an unsolved problem when the learner selects the problem row", async () => {
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
      "/writing/short-answer-writing-51?problem=problem-128",
    );
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
    expect(
      screen.getByRole("button", { name: "View analysis status" }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByText("Pending analysis problem").closest("tr")!,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "View analysis status" }),
    );

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
    ).toContain(enMessages.practice.retry.statusFailed);
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
