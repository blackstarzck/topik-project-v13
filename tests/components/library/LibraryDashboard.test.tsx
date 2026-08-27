// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import { LibraryDashboard } from "../../../src/components/library/LibraryDashboard";
import typographyStyles from "../../../src/components/library/LibraryTypography.module.css";
import type { LibraryDashboardView } from "../../../src/lib/library/types";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

const routerRefreshMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: routerRefreshMock,
  }),
}));

const dashboardFixture: LibraryDashboardView = {
  kpis: {
    reviewableCount: 12,
    feedbackWaitingCount: 2,
    comparisonAvailableCount: 3,
    recentSubmissionDate: "2026-06-29T12:00:00.000Z",
  },
  reviewCandidates: [
    {
      id: "candidate-1",
      itemId: "item-1",
      submissionId: "sub-1",
      problemId: "problem-1",
      questionNo: 54,
      title: "문화 사회형 질문",
      submittedAt: "2026-06-29T12:00:00.000Z",
      charCount: 724,
      estimatedMinutes: 50,
      difficultyLevel: 5,
      scoreTotal: 76,
      scoreMax: 100,
      scorePercent: 76,
      feedbackHref: "/writing/feedback/long/sub-1",
      retryHref: "/writing/54?problem=problem-1&fresh=1&retrySubmission=sub-1",
      primaryReason: "length_off_target",
      reasons: ["length_off_target", "low_dimension"],
      hasRewrite: false,
      lowestDimension: {
        dimension: "structure",
        normalizedScore: 68,
        score: 68,
        scoreMax: 100,
      },
      lengthTarget: { min: 600, max: 700, status: "over" },
    },
  ],
  feedbackWaiting: [
    {
      id: "waiting-1",
      submissionId: "sub-2",
      problemId: "problem-2",
      questionNo: 51,
      title: "도표 빈칸 문장 완성",
      submittedAt: "2026-06-28T09:16:00.000Z",
      charCount: 14,
      status: "analyzing",
      retryHref: "/writing/51?problem=problem-2&fresh=1&retrySubmission=sub-2",
    },
  ],
  feedbackWaitingSyncTargets: [
    {
      itemId: "waiting-1",
      submissionId: "sub-2",
      initialStatus: "analyzing",
    },
  ],
  weakItems: [
    {
      id: "weak-1",
      submissionId: "sub-1",
      problemId: "problem-1",
      questionNo: 54,
      title: "문화 사회형 질문",
      dimension: "structure",
      normalizedScore: 68,
      score: 68,
      scoreMax: 100,
      submittedAt: "2026-06-29T12:00:00.000Z",
    },
  ],
  timeline: [
    {
      id: "event-1",
      eventType: "submission_submitted",
      occurredAt: "2026-06-29T12:35:00.000Z",
      problemId: "problem-1",
      submissionId: "sub-1",
      questionNo: 54,
      title: "문화 사회형 질문",
    },
  ],
};

function waitingSyncDashboard(): LibraryDashboardView {
  return {
    ...dashboardFixture,
    kpis: {
      ...dashboardFixture.kpis,
      feedbackWaitingCount: 3,
    },
    feedbackWaiting: [
      {
        id: "waiting-visible-complete",
        submissionId: "sub-visible-complete",
        problemId: "problem-visible-complete",
        questionNo: 53,
        title: "Visible complete",
        submittedAt: "2026-06-28T10:00:00.000Z",
        charCount: 230,
        status: "analyzing",
        retryHref:
          "/writing/long-form-writing-53?problem=problem-visible-complete&fresh=1&retrySubmission=sub-visible-complete",
      },
      {
        id: "waiting-visible-failed",
        submissionId: "sub-visible-failed",
        problemId: "problem-visible-failed",
        questionNo: 52,
        title: "Visible failed",
        submittedAt: "2026-06-28T09:00:00.000Z",
        charCount: 18,
        status: "pending",
        retryHref:
          "/writing/52?problem=problem-visible-failed&fresh=1&retrySubmission=sub-visible-failed",
      },
    ],
    feedbackWaitingSyncTargets: [
      {
        itemId: "waiting-visible-complete",
        submissionId: "sub-visible-complete",
        initialStatus: "analyzing",
      },
      {
        itemId: "waiting-visible-failed",
        submissionId: "sub-visible-failed",
        initialStatus: "pending",
      },
      {
        itemId: "waiting-hidden-complete",
        submissionId: "sub-hidden-complete",
        initialStatus: "analyzing",
      },
    ],
  };
}

function mockEvaluationStatuses(
  responses: Record<
    string,
    { feedbackStatus: string; responseStatus?: number; invalidBody?: boolean }
  >,
) {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input) => {
      const url = new URL(String(input), "http://localhost");
      const submissionId = url.searchParams.get("submissionId") ?? "";
      const response = responses[submissionId];
      if (!response) {
        return new Response(JSON.stringify({ feedback_status: "analyzing" }), {
          status: 200,
        });
      }
      return new Response(
        response.invalidBody
          ? "{"
          : JSON.stringify({ feedback_status: response.feedbackStatus }),
        {
          status: response.responseStatus ?? 200,
        },
      );
    });
  fetchMock.mockClear();
  return fetchMock;
}

function mockDeferredEvaluationStatuses(
  responses: Record<
    string,
    { feedbackStatus: string; responseStatus?: number; invalidBody?: boolean }
  >,
) {
  const pending: Array<{
    submissionId: string;
    resolve: (response: Response) => void;
  }> = [];
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation((input) => {
      const url = new URL(String(input), "http://localhost");
      const submissionId = url.searchParams.get("submissionId") ?? "";
      return new Promise<Response>((resolve) => {
        pending.push({ submissionId, resolve });
      });
    });
  fetchMock.mockClear();

  return {
    fetchMock,
    pending,
    resolveAll() {
      for (const request of pending) {
        const response = responses[request.submissionId] ?? {
          feedbackStatus: "analyzing",
        };
        request.resolve(
          new Response(
            response.invalidBody
              ? "{"
              : JSON.stringify({ feedback_status: response.feedbackStatus }),
            {
              status: response.responseStatus ?? 200,
            },
          ),
        );
      }
    },
  };
}

function calledSubmissionIds(
  fetchMock: ReturnType<typeof mockEvaluationStatuses>,
) {
  return fetchMock.mock.calls
    .map((call) =>
      new URL(String(call[0]), "http://localhost").searchParams.get(
        "submissionId",
      ),
    )
    .sort();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-04T12:00:00.000Z"));
  routerRefreshMock.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("LibraryDashboard", () => {
  it("renders KPI strip, review candidate cards, and the two bottom panels", () => {
    renderWithIntl(<LibraryDashboard dashboard={dashboardFixture} />);

    expect(screen.getByTestId("library-dashboard")).toBeTruthy();
    expect(screen.getByTestId("library-dashboard").className).toContain(
      "gap-10",
    );
    expect(screen.getByTestId("library-kpi-strip")).toBeTruthy();
    for (const card of screen.getAllByTestId("library-kpi-card")) {
      const hasRefreshButton = within(card).queryByTestId(
        "library-kpi-feedbackWaiting-refresh",
      );
      expect(card.querySelector(".library-kpi-icon")).toBeNull();
      expect(within(card).queryByRole("img", { hidden: true })).toBeNull();
      if (!hasRefreshButton) expect(card.querySelector("svg")).toBeNull();
      expect(within(card).queryByText(/건$/)).toBeNull();
    }
    expect(
      screen.getByTestId("library-kpi-card-reviewable").textContent,
    ).toContain("12");
    expect(
      screen.getByTestId("library-kpi-card-feedbackWaiting").textContent,
    ).toContain("2");
    expect(
      screen.getByTestId("library-kpi-card-comparison").textContent,
    ).toContain("3");
    for (const testId of [
      "library-kpi-card-reviewable",
      "library-kpi-card-feedbackWaiting",
      "library-kpi-card-comparison",
    ]) {
      const value = within(screen.getByTestId(testId)).getByTestId(
        "library-kpi-value",
      );
      expect(value.className).not.toContain("!text-[24px]");
      expect(value.className.split(" ")).toContain(typographyStyles.kpiValue);
    }
    expect(
      screen.getByTestId("library-kpi-card-recentStudy").textContent,
    ).toContain("6월 29일");
    expect(
      within(screen.getByTestId("library-kpi-card-recentStudy")).getByText(
        "최근 학습일 6월 29일",
      ),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId("library-kpi-card-recentStudy")).getByText(
        "마지막 학습 후 5일",
      ),
    ).toBeTruthy();
    expect(
      screen
        .getByTestId("library-kpi-recent-inactive-duration")
        .className.split(" "),
    ).toContain(typographyStyles.kpiValue);
    expect(
      within(screen.getByTestId("library-kpi-card-recentStudy")).queryByText(
        "최근 학습",
      ),
    ).toBeNull();
    expect(
      screen
        .getByTestId("library-kpi-card-recentStudy")
        .textContent?.startsWith("최근 학습일 6월 29일"),
    ).toBe(true);
    expect(screen.queryByText("12건")).toBeNull();
    expect(screen.queryByText("2건")).toBeNull();
    expect(screen.queryByText("3건")).toBeNull();
    expect(screen.queryByText("복습할 수 있는 저장 답안")).toBeNull();
    expect(screen.queryByText("AI 분석을 기다리는 답안")).toBeNull();
    expect(screen.queryByText("비교 리포트를 만들 수 있는 답안")).toBeNull();
    expect(screen.queryByText("마지막 제출일 기준")).toBeNull();
    expect(screen.getAllByText("복습 가능").length).toBeGreaterThan(0);
    expect(screen.getAllByText("피드백 대기").length).toBeGreaterThan(0);
    expect(screen.getAllByText("비교 가능").length).toBeGreaterThan(0);
    expect(screen.queryByText("최근 학습")).toBeNull();
    expect(
      screen.getByTestId("library-review-candidate-card").textContent,
    ).toContain("문화 사회형 질문");
    expect(
      screen.getByRole("link", { name: "피드백 보기" }).getAttribute("href"),
    ).toBe("/writing/feedback/long/sub-1");
    expect(
      screen.getByRole("link", { name: /다시 풀기/ }).getAttribute("href"),
    ).toBe("/writing/54?problem=problem-1&fresh=1&retrySubmission=sub-1");
    const feedbackWaitingPanel = screen.getByTestId(
      "library-feedback-waiting-panel",
    );
    const timelinePanel = screen.getByTestId("library-timeline-panel");
    const bottomPanelGrid = feedbackWaitingPanel.parentElement;

    expect(feedbackWaitingPanel).toBeTruthy();
    expect(screen.queryByTestId("library-weak-items-panel")).toBeNull();
    expect(timelinePanel).toBeTruthy();
    expect(bottomPanelGrid?.className).toContain("xl:grid-cols-2");
    expect(bottomPanelGrid?.className).not.toContain("xl:grid-cols-3");
  });

  it("refreshes all feedback waiting sync targets from the top KPI without refreshing the page", async () => {
    vi.useRealTimers();
    const fetchMock = mockEvaluationStatuses({
      "sub-visible-complete": { feedbackStatus: "complete" },
      "sub-visible-failed": { feedbackStatus: "failed" },
      "sub-hidden-complete": { feedbackStatus: "complete" },
    });
    renderWithIntl(<LibraryDashboard dashboard={waitingSyncDashboard()} />);

    fireEvent.click(screen.getByTestId("library-kpi-feedbackWaiting-refresh"));

    await waitFor(() => {
      expect(
        screen.getByTestId("library-kpi-card-feedbackWaiting").textContent,
      ).toContain("1");
    });
    expect(calledSubmissionIds(fetchMock)).toEqual([
      "sub-hidden-complete",
      "sub-visible-complete",
      "sub-visible-failed",
    ]);
    expect(
      screen
        .getByTestId("library-feedback-waiting-panel")
        .querySelector('a[href="/writing/feedback/long/sub-visible-complete"]'),
    ).toBeTruthy();
    expect(screen.getAllByTestId("library-feedback-waiting-row")).toHaveLength(
      2,
    );
    expect(routerRefreshMock).not.toHaveBeenCalled();
  });

  it("deduplicates near-simultaneous top and bottom refresh clicks", async () => {
    vi.useRealTimers();
    const deferred = mockDeferredEvaluationStatuses({
      "sub-visible-complete": { feedbackStatus: "complete" },
      "sub-visible-failed": { feedbackStatus: "pending" },
      "sub-hidden-complete": { feedbackStatus: "complete" },
    });
    renderWithIntl(<LibraryDashboard dashboard={waitingSyncDashboard()} />);

    fireEvent.click(screen.getByTestId("library-kpi-feedbackWaiting-refresh"));
    await waitFor(() => {
      expect(deferred.pending).toHaveLength(3);
    });

    fireEvent.click(screen.getByTestId("library-feedback-waiting-refresh"));
    expect(deferred.pending).toHaveLength(3);
    expect(calledSubmissionIds(deferred.fetchMock)).toEqual([
      "sub-hidden-complete",
      "sub-visible-complete",
      "sub-visible-failed",
    ]);

    deferred.resolveAll();
    await waitFor(() => {
      expect(
        screen.getByTestId("library-kpi-card-feedbackWaiting").textContent,
      ).toContain("1");
    });
    expect(routerRefreshMock).not.toHaveBeenCalled();
  });

  it("keeps the top KPI count in sync when the bottom panel refreshes", async () => {
    vi.useRealTimers();
    mockEvaluationStatuses({
      "sub-visible-complete": { feedbackStatus: "complete" },
      "sub-visible-failed": { feedbackStatus: "pending" },
      "sub-hidden-complete": { feedbackStatus: "analyzing" },
    });
    renderWithIntl(<LibraryDashboard dashboard={waitingSyncDashboard()} />);

    fireEvent.click(screen.getByTestId("library-feedback-waiting-refresh"));

    await waitFor(() => {
      expect(
        screen.getByTestId("library-kpi-card-feedbackWaiting").textContent,
      ).toContain("2");
    });
    expect(routerRefreshMock).not.toHaveBeenCalled();
  });

  it("preserves previous state for partial status check failures", async () => {
    vi.useRealTimers();
    mockEvaluationStatuses({
      "sub-visible-complete": { feedbackStatus: "complete" },
      "sub-visible-failed": {
        feedbackStatus: "analyzing",
        responseStatus: 502,
      },
      "sub-hidden-complete": {
        feedbackStatus: "complete",
        invalidBody: true,
      },
    });
    renderWithIntl(<LibraryDashboard dashboard={waitingSyncDashboard()} />);

    fireEvent.click(screen.getByTestId("library-kpi-feedbackWaiting-refresh"));

    await waitFor(() => {
      expect(
        screen.getByTestId("library-feedback-waiting-sync-error"),
      ).toBeTruthy();
    });
    expect(
      screen.getByTestId("library-kpi-card-feedbackWaiting").textContent,
    ).toContain("2");
    expect(routerRefreshMock).not.toHaveBeenCalled();
  });

  it("uses AntD Card heads and footer actions for the bottom dashboard panels", () => {
    renderWithIntl(<LibraryDashboard dashboard={dashboardFixture} />);

    const feedbackWaitingPanel = screen.getByTestId(
      "library-feedback-waiting-panel",
    );
    const timelinePanel = screen.getByTestId("library-timeline-panel");

    for (const panel of [feedbackWaitingPanel, timelinePanel]) {
      expect(panel.classList.contains("ant-card")).toBe(true);
      expect(panel.classList.contains("app-card")).toBe(true);
    }

    expect(
      feedbackWaitingPanel.querySelector(".ant-card-head-title")?.textContent,
    ).toContain("피드백 대기");
    expect(
      timelinePanel.querySelector(".ant-card-head-title")?.textContent,
    ).toContain("학습 타임라인");

    expect(screen.queryByTestId("library-weak-items-panel")).toBeNull();
    expect(screen.queryByText("최근 완료된 피드백 기준")).toBeNull();

    expect(
      screen.queryByRole("link", { name: "전체 타임라인 보기" }),
    ).toBeNull();
  });

  it("renders the review empty state with a practice CTA", () => {
    renderWithIntl(
      <LibraryDashboard
        dashboard={{
          ...dashboardFixture,
          kpis: {
            ...dashboardFixture.kpis,
            reviewableCount: 0,
            comparisonAvailableCount: 0,
          },
          reviewCandidates: [],
          weakItems: [],
          timeline: [],
        }}
      />,
    );

    expect(
      screen.getByText("저장한 답안의 피드백이 완료되면 복습 후보가 표시돼요"),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "문제 풀러 가기" }).getAttribute("href"),
    ).toBe("/practice/problems");
  });
});
