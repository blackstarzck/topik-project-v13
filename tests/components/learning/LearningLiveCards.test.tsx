// @vitest-environment jsdom
import { describe, expect, it, afterEach } from "vitest";
import { cleanup, screen } from "@testing-library/react";

import { renderWithIntl } from "../../test-utils/renderWithIntl";
import {
  RecentFeedbackCard,
  type RecentFeedbackItem,
} from "../../../src/components/learning/RecentFeedbackCard";
import { UpcomingExamCard } from "../../../src/components/learning/UpcomingExamCard";

// The dashboard.recentFeedback / dashboard.upcomingExam keys are merged into the
// committed ko catalog from staging. renderWithIntl loads the ko baseline, so the
// assertions below match the verbatim Korean.

afterEach(() => {
  cleanup();
});

describe("RecentFeedbackCard i18n chrome", () => {
  it("renders the empty state when there are no items", () => {
    renderWithIntl(<RecentFeedbackCard items={[]} />);
    expect(screen.getByText("최근 피드백")).toBeTruthy();
    expect(
      screen.getByText("아직 받은 피드백이 없어요. 글쓰기를 제출해 보세요."),
    ).toBeTruthy();
  });

  it("renders the score label, ICU question-no tag, and view link for an item", () => {
    const items: RecentFeedbackItem[] = [
      {
        submissionId: "s1",
        questionNo: 53,
        scoreTotal: 78,
        generatedAt: "2026-06-02T09:00:00.000Z",
      },
    ];
    renderWithIntl(<RecentFeedbackCard items={items} />);
    expect(screen.getByText("점수")).toBeTruthy();
    expect(screen.getByText("53번")).toBeTruthy();
    // scoreValue ICU leaf "{score}점".
    expect(screen.getByText("78점")).toBeTruthy();
    expect(screen.getByText("보기")).toBeTruthy();
  });

  it("links short-answer feedback for 51/52 and long-form feedback for 53/54", () => {
    const items: RecentFeedbackItem[] = [
      {
        submissionId: "s-short",
        questionNo: 52,
        scoreTotal: 72,
        generatedAt: "2026-06-02T09:00:00.000Z",
      },
      {
        submissionId: "s-long",
        questionNo: 53,
        scoreTotal: 78,
        generatedAt: "2026-06-02T09:00:00.000Z",
      },
    ];
    const { container } = renderWithIntl(<RecentFeedbackCard items={items} />);
    const links = Array.from(container.querySelectorAll("a"));
    expect(links[0]?.getAttribute("href")).toBe(
      "/writing/feedback/short/s-short",
    );
    expect(links[1]?.getAttribute("href")).toBe(
      "/writing/feedback/long/s-long",
    );
  });

  it("renders the pending score copy when the score is null", () => {
    const items: RecentFeedbackItem[] = [
      {
        submissionId: "s2",
        questionNo: null,
        scoreTotal: null,
        generatedAt: "2026-06-02T09:00:00.000Z",
      },
    ];
    renderWithIntl(<RecentFeedbackCard items={items} />);
    expect(screen.getByText("대기")).toBeTruthy();
  });

  it("passes dashboard height classes to the card root", () => {
    const { container } = renderWithIntl(
      <RecentFeedbackCard items={[]} className="w-full lg:h-full" />,
    );
    const card = container.querySelector(".app-card");
    expect(card?.className).toContain("flex flex-col");
    expect(card?.className).toContain("w-full lg:h-full");
  });
});

describe("UpcomingExamCard i18n chrome", () => {
  it("renders the title and the D-day copy for a future exam", () => {
    // 10 days from now so daysLeft > 0 (the D-{days} ICU branch).
    const future = new Date();
    future.setDate(future.getDate() + 10);
    const iso = future.toISOString().slice(0, 10);
    renderWithIntl(<UpcomingExamCard examDate={iso} />);
    expect(screen.getByText("예정된 시험")).toBeTruthy();
    expect(screen.getByText("남은 일수: D-10")).toBeTruthy();
  });

  it("renders the today copy when the exam is today", () => {
    const today = new Date().toISOString().slice(0, 10);
    renderWithIntl(<UpcomingExamCard examDate={today} />);
    expect(screen.getByText("남은 일수: 오늘")).toBeTruthy();
  });
});
