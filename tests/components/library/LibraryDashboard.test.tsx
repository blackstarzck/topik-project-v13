// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, screen } from "@testing-library/react";

import { LibraryDashboard } from "../../../src/components/library/LibraryDashboard";
import type { LibraryDashboardView } from "../../../src/lib/library/types";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

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

afterEach(() => {
  cleanup();
});

describe("LibraryDashboard", () => {
  it("renders KPI strip, review candidate cards, and the three bottom panels", () => {
    renderWithIntl(<LibraryDashboard dashboard={dashboardFixture} />);

    expect(screen.getByTestId("library-dashboard")).toBeTruthy();
    expect(screen.getByTestId("library-kpi-strip")).toBeTruthy();
    expect(screen.getAllByText("복습 가능").length).toBeGreaterThan(0);
    expect(screen.getAllByText("피드백 대기").length).toBeGreaterThan(0);
    expect(screen.getAllByText("비교 가능").length).toBeGreaterThan(0);
    expect(screen.getAllByText("최근 학습").length).toBeGreaterThan(0);
    expect(
      screen.getByTestId("library-review-candidate-card").textContent,
    ).toContain("문화 사회형 질문");
    expect(
      screen.getByRole("link", { name: "피드백 보기" }).getAttribute("href"),
    ).toBe("/writing/feedback/long/sub-1");
    expect(
      screen.getByRole("link", { name: /다시 풀기/ }).getAttribute("href"),
    ).toBe("/writing/54?problem=problem-1&fresh=1&retrySubmission=sub-1");
    expect(screen.getByTestId("library-feedback-waiting-panel")).toBeTruthy();
    expect(screen.getByTestId("library-weak-items-panel")).toBeTruthy();
    expect(screen.getByTestId("library-timeline-panel")).toBeTruthy();
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
