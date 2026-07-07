// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";

import { LibraryFeedbackWaitingPanel } from "../../../src/components/library/LibraryFeedbackWaitingPanel";
import type { LibraryFeedbackWaitingVisibleItem } from "../../../src/lib/library/types";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

const refreshMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

const analyzingItem: LibraryFeedbackWaitingVisibleItem = {
  id: "waiting-1",
  submissionId: "submission-1",
  problemId: "problem-1",
  questionNo: 53,
  title: "Digital citizenship",
  submittedAt: "2026-04-07T00:04:00.000Z",
  charCount: 123,
  status: "analyzing",
  retryHref: null,
};

function renderPanel(
  overrides: Partial<ComponentProps<typeof LibraryFeedbackWaitingPanel>> = {},
) {
  return renderWithIntl(
    <LibraryFeedbackWaitingPanel
      items={[analyzingItem]}
      canRefresh={true}
      isRefreshing={false}
      onRefresh={vi.fn()}
      syncErrorIds={new Set()}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  refreshMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe("LibraryFeedbackWaitingPanel", () => {
  it("keeps completed submissions visible with a feedback link", () => {
    renderPanel({
      items: [{ ...analyzingItem, status: "complete" }],
      canRefresh: false,
    });

    expect(screen.getByTestId("library-feedback-waiting-row")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "피드백 보기" }).getAttribute("href"),
    ).toBe("/writing/feedback/long/submission-1");
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("keeps the row and marks a transient check error", () => {
    renderPanel({
      syncErrorIds: new Set([analyzingItem.id]),
    });

    expect(
      screen.getByTestId("library-feedback-waiting-sync-error"),
    ).toBeTruthy();
    expect(screen.getByTestId("library-feedback-waiting-row")).toBeTruthy();
    expect(screen.queryByTestId("library-feedback-waiting-spinner")).toBeNull();
  });

  it("renders analyzing rows with a loading spinner instead of a status tag", () => {
    renderPanel();

    const panel = screen.getByTestId("library-feedback-waiting-panel");
    const statusActions = within(panel).getByTestId(
      "library-feedback-waiting-status-actions",
    );

    expect(
      within(statusActions).getByTestId("library-feedback-waiting-spinner"),
    ).toBeTruthy();
    expect(statusActions.querySelector(".ant-tag")).toBeNull();
    expect(within(statusActions).queryAllByRole("button")).toHaveLength(0);
  });

  it("uses compact metadata and the review-candidate question number badge", () => {
    renderPanel();

    const panel = screen.getByTestId("library-feedback-waiting-panel");
    const row = within(panel).getByTestId("library-feedback-waiting-row");
    const meta = within(panel).getByTestId("library-feedback-waiting-meta");
    const questionNumber = panel.querySelector(".writing-question-number");

    expect(
      Array.from(row.children).map((child) =>
        child.getAttribute("data-testid"),
      ),
    ).toEqual([
      "library-feedback-waiting-question",
      "library-feedback-waiting-content",
      "library-feedback-waiting-status-actions",
    ]);
    expect(meta.textContent).toContain("04. 07. 09:04");
    expect(meta.textContent).toContain("123");
    expect(meta.className).toContain("!text-[14px]");
    expect(questionNumber?.textContent).toBe("53");
    expect(questionNumber?.className).toContain(
      "library-review-candidate-question-number",
    );
    expect(questionNumber?.className).toContain("writing-question-number--q53");
  });

  it("delegates refresh clicks to the parent handler", () => {
    const onRefresh = vi.fn();
    renderPanel({ onRefresh });

    fireEvent.click(screen.getByTestId("library-feedback-waiting-refresh"));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("disables refresh while parent refresh is running", () => {
    const onRefresh = vi.fn();
    renderPanel({ isRefreshing: true, onRefresh });

    fireEvent.click(screen.getByTestId("library-feedback-waiting-refresh"));

    expect(onRefresh).not.toHaveBeenCalled();
  });
});
