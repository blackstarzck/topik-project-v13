// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";

import { LibraryFeedbackWaitingPanel } from "../../../src/components/library/LibraryFeedbackWaitingPanel";
import type { LibraryFeedbackWaitingItem } from "../../../src/lib/library/types";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

const refreshMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

const analyzingItem: LibraryFeedbackWaitingItem = {
  id: "waiting-1",
  submissionId: "submission-1",
  problemId: "problem-1",
  questionNo: 53,
  title: "지역 경제 활성화 기여 방안",
  submittedAt: "2026-04-07T00:04:00.000Z",
  charCount: 123,
  status: "analyzing",
  retryHref: null,
};

beforeEach(() => {
  refreshMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("LibraryFeedbackWaitingPanel", () => {
  it("refreshes the library dashboard from the card header", () => {
    renderWithIntl(<LibraryFeedbackWaitingPanel items={[analyzingItem]} />);

    fireEvent.click(
      screen.getByRole("button", { name: "분석 완료 여부 새로고침" }),
    );

    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("renders analyzing rows with a loading spinner instead of a status tag", () => {
    renderWithIntl(<LibraryFeedbackWaitingPanel items={[analyzingItem]} />);

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
    renderWithIntl(<LibraryFeedbackWaitingPanel items={[analyzingItem]} />);

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
    expect(meta.textContent).toContain("123자");
    expect(meta.textContent).not.toContain("제출일");
    expect(meta.className).toContain("!text-[14px]");
    expect(questionNumber?.textContent).toBe("53");
    expect(questionNumber?.className).toContain(
      "library-review-candidate-question-number",
    );
    expect(questionNumber?.className).toContain("writing-question-number--q53");
  });
});
