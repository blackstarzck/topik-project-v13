// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

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
  title: "Digital citizenship",
  submittedAt: "2026-04-07T00:04:00.000Z",
  charCount: 123,
  status: "analyzing",
  retryHref: null,
};

beforeEach(() => {
  refreshMock.mockReset();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ feedback_status: "analyzing" }), {
      status: 200,
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe("LibraryFeedbackWaitingPanel", () => {
  it("syncs waiting submission statuses from the card header without refreshing the route", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ feedback_status: "complete" }), {
        status: 200,
      }),
    );
    renderWithIntl(<LibraryFeedbackWaitingPanel items={[analyzingItem]} />);

    fireEvent.click(screen.getByTestId("library-feedback-waiting-refresh"));

    await waitFor(() => {
      expect(
        screen.queryByTestId("library-feedback-waiting-row"),
      ).toBeNull();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/writing/evaluation-status?submissionId=submission-1",
      { cache: "no-store" },
    );
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("keeps the row and marks a transient check error when status sync fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          feedback_status: "analyzing",
          error: "status_check_failed",
        }),
        { status: 502 },
      ),
    );
    renderWithIntl(<LibraryFeedbackWaitingPanel items={[analyzingItem]} />);

    fireEvent.click(screen.getByTestId("library-feedback-waiting-refresh"));

    await waitFor(() => {
      expect(
        screen.getByTestId("library-feedback-waiting-sync-error"),
      ).toBeTruthy();
    });
    expect(screen.getByTestId("library-feedback-waiting-row")).toBeTruthy();
    expect(
      screen.queryByTestId("library-feedback-waiting-spinner"),
    ).toBeNull();
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
    expect(meta.textContent).toContain("123");
    expect(meta.className).toContain("!text-[14px]");
    expect(questionNumber?.textContent).toBe("53");
    expect(questionNumber?.className).toContain(
      "library-review-candidate-question-number",
    );
    expect(questionNumber?.className).toContain("writing-question-number--q53");
  });
});
