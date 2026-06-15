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
  replace: vi.fn(),
  search: "",
}));

const rpcMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: navState.replace,
  }),
  useSearchParams: () => new URLSearchParams(navState.search),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    rpc: (...args: unknown[]) => rpcMock(...args),
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
      row.solve_state === "submitted"
        ? "2026-06-10T00:00:00.000Z"
        : null,
    writing_feedback_status:
      row.solve_state === "submitted" ? "complete" : null,
    lifecycle_status: "active",
    lifecycle_reason: null,
    publish_status: "published",
    review_status: "approved",
  };
}

beforeEach(() => {
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
    renderInApp(<ProblemListView userId="user-1" />);

    const allTabRoot = screen
      .getByText(enMessages.practice.common.typeTabAll)
      .closest(".ant-segmented");
    expect(allTabRoot?.className).toContain("problem-type-tabs");
    expect(allTabRoot?.className).toContain("problem-type-tabs--with-all");
    expect(
      screen.getByText(enMessages.practice.common.typeTabAll).closest("label")
        ?.className,
    ).toContain("is-selected");
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
      screen.getByRole("columnheader", {
        name: koMessages.practice.problems.solveStatusLabel,
      }),
    ).toBeTruthy();
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
    expect(screen.getAllByText("미풀이")).toHaveLength(2);
    expect(screen.getAllByText("완료")).toHaveLength(2);
    expect(screen.getByText("오답 노트")).toBeTruthy();
    expect(screen.getByText("복습 필요")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /시작하기/ })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /다시 풀기/ })).toHaveLength(4);
  });
});
