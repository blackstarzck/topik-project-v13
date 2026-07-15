// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  act,
} from "@testing-library/react";

import koMessages from "../../../messages/ko.json";
import { renderWithIntl } from "../../test-utils/renderWithIntl";
import { WritingEditor } from "../../../src/components/writing/WritingEditor";

const helpers = vi.hoisted(() => ({
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
  refreshMock: vi.fn(),
  submitMutateMock: vi.fn(),
  upsertMutateMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: helpers.pushMock,
    replace: helpers.replaceMock,
    refresh: helpers.refreshMock,
    back: vi.fn(),
  }),
}));

vi.mock("@/lib/events/study-events", () => ({
  logStudyEvent: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/writing/mutations", () => ({
  useUpsertDraft: () => ({
    isPending: false,
    mutate: helpers.upsertMutateMock,
  }),
  useSubmitWriting: () => ({
    isPending: false,
    mutate: helpers.submitMutateMock,
  }),
}));

vi.mock("@/lib/writing/queries", () => ({
  useFeedbackStatus: () => ({ data: "analyzing" }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  helpers.submitMutateMock.mockImplementation((_input, options) => {
    options?.onSuccess?.({ submissionId: "submission-51", questionNo: 51 });
  });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

function renderEditor({ withSavedDraft = false } = {}) {
  renderWithIntl(
    <WritingEditor
      userId="user-1"
      problemId="problem-1"
      questionNo={51}
      initialDraft={
        withSavedDraft
          ? {
              id: "saved-draft-1",
              user_id: "user-1",
              problem_id: "problem-1",
              question_no: 51,
              answer_text: "",
              answer_json: null,
              char_count: 0,
              canonical_question_id: "question-1",
              canonical_import_id: 1,
              canonical_payload_hash: "payload-hash-1",
              question_snapshot: null,
              legacy_cutover_snapshot: null,
              autosave_status: "clean",
              last_saved_at: "2026-07-14T00:00:00.000Z",
              created_at: "2026-07-14T00:00:00.000Z",
              updated_at: "2026-07-14T00:00:00.000Z",
            }
          : null
      }
    />,
  );
}

describe("WritingEditor submit flow", () => {
  it("submits with the draft id returned by autosave when the editor started without a draft", async () => {
    vi.useFakeTimers();
    helpers.upsertMutateMock.mockImplementation((_input, options) => {
      options?.onSuccess?.({
        id: "draft-from-autosave",
        last_saved_at: "2026-06-25T00:00:00.000Z",
      });
    });
    renderEditor();

    fireEvent.change(
      screen.getByPlaceholderText(koMessages.writing.editor.placeholderShort),
      { target: { value: "1234567890" } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    vi.useRealTimers();

    fireEvent.click(
      screen.getByRole("button", {
        name: koMessages.writing.editor.submit,
      }),
    );
    fireEvent.click(await screen.findByTestId("submission-confirm-submit"));

    expect(helpers.submitMutateMock).toHaveBeenCalledWith(
      expect.objectContaining({ draft_id: "draft-from-autosave" }),
      expect.any(Object),
    );
  });

  it("shows page-level D-M2 analysis UI after submit succeeds", async () => {
    renderEditor({ withSavedDraft: true });

    fireEvent.change(
      screen.getByPlaceholderText(koMessages.writing.editor.placeholderShort),
      { target: { value: "1234567890" } },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: koMessages.writing.editor.submit,
      }),
    );
    fireEvent.click(await screen.findByTestId("submission-confirm-submit"));

    expect(helpers.pushMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("analysis-loading-page")).toBeTruthy();
    expect(await screen.findByTestId("analysis-loading-panel")).toBeTruthy();
    const stateAsset = screen.getByTestId(
      "analysis-state-asset",
    ) as HTMLImageElement;
    expect(stateAsset.getAttribute("src")).toBe("/assets/state/refresh.svg");
    const stateCard = screen.getByTestId("analysis-state-card");
    expect(stateCard.classList.contains("app-card")).toBe(false);
    expect(
      screen.getByRole("heading", {
        name: koMessages.feedback.analysis.title,
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(koMessages.feedback.analysis.subtitle),
    ).toBeTruthy();
    expect(
      screen.getByText(koMessages.feedback.analysis.expectedTime),
    ).toBeTruthy();
    expect(screen.queryByTestId("analysis-slow-handoff")).toBeNull();
    expect(screen.queryByTestId("analysis-loading-background")).toBeNull();
    expect(screen.queryByTestId("analysis-loading-modal")).toBeNull();
  });

  it("closes the submit confirm modal and shows a failure modal when submit fails", async () => {
    helpers.submitMutateMock.mockImplementation((_input, options) => {
      options?.onError?.(new Error("network down"));
    });
    renderEditor({ withSavedDraft: true });

    fireEvent.change(
      screen.getByPlaceholderText(koMessages.writing.editor.placeholderShort),
      { target: { value: "1234567890" } },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: koMessages.writing.editor.submit,
      }),
    );
    fireEvent.click(await screen.findByTestId("submission-confirm-submit"));

    await waitFor(() => {
      expect(screen.queryByTestId("submission-confirm-modal")).toBeNull();
    });
    expect(await screen.findByTestId("submission-failed-modal")).toBeTruthy();
    expect(
      screen.getByText(koMessages.writing.submit.submitFailedTitle),
    ).toBeTruthy();
    expect(screen.getByText(/network down/)).toBeTruthy();
  });
});
