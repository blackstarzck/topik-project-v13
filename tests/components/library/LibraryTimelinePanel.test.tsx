// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LibraryTimelinePanel } from "../../../src/components/library/LibraryTimelinePanel";
import type { LibraryTimelineItem } from "../../../src/lib/library/types";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

const baseItems: LibraryTimelineItem[] = [
  {
    id: "event-1",
    eventType: "report_viewed",
    occurredAt: "2026-07-01T08:00:00.000Z",
    problemId: "problem-54",
    submissionId: "sub-54",
    questionNo: 54,
    title: "문화 소비 다양화 영향",
  },
  {
    id: "event-2",
    eventType: "feedback_viewed",
    occurredAt: "2026-06-30T09:00:00.000Z",
    problemId: "problem-53",
    submissionId: "sub-53",
    questionNo: 53,
    title: "지역 경제 활성화",
  },
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-01T09:00:00.000Z"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("LibraryTimelinePanel", () => {
  it("renders relative event time, plain icons, and prefixes event labels with question numbers", () => {
    renderWithIntl(<LibraryTimelinePanel items={baseItems} />);

    expect(screen.getByText("1시간 전")).toBeTruthy();
    expect(screen.getByText("1일 전")).toBeTruthy();
    expect(screen.getByText("54번 리포트 확인")).toBeTruthy();
    expect(screen.getByText("53번 피드백 확인")).toBeTruthy();

    const icon = screen.getAllByTestId("library-timeline-icon")[0];
    expect(icon.className).not.toContain("rounded-full");
    expect(icon.className).not.toContain("library-timeline-icon");

    const reportRow = screen.getByTestId("library-timeline-row-event-1");
    const reportContent = screen.getByTestId(
      "library-timeline-content-event-1",
    );
    const reportTime = screen.getByTestId("library-timeline-time-event-1");

    expect(reportRow.firstElementChild).toBe(reportContent);
    expect(reportRow.lastElementChild).toBe(reportTime);
    expect(reportRow.className).toContain("justify-between");
    expect(reportContent.className).toContain("gap-2");
    expect(reportContent.textContent).toContain("54번 리포트 확인");
    expect(reportTime.className).toContain("ml-auto");
    expect(reportTime.textContent).toBe("1시간 전");
    expect(
      screen.queryByRole("link", { name: "전체 타임라인 보기" }),
    ).toBeNull();
  });
});
