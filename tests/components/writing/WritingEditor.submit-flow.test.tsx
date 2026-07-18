// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";

import koMessages from "../../../messages/ko.json";
import { renderWithIntl } from "../../test-utils/renderWithIntl";
import { WritingEditor } from "../../../src/components/writing/WritingEditor";

const helpers = vi.hoisted(() => ({
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
  refreshMock: vi.fn(),
  clearAfterSubmitSuccessMock: vi.fn(() => Promise.resolve()),
  chooseRecoveryMock: vi.fn(),
  editMock: vi.fn(),
  getLatestSnapshotMock: vi.fn(),
  intentPersistence: {
    clear: vi.fn(),
    find: vi.fn(),
    markAmbiguous: vi.fn(),
    persist: vi.fn(),
  },
  latestSnapshot: null as null | {
    draft: Record<string, unknown>;
    draftId: string | null;
  },
  manualSaveMock: vi.fn(),
  prepareForSubmitMock: vi.fn(),
  resilienceOptions: null as null | Record<string, unknown>,
  resilienceState: {
    conflict: null as null | Record<string, unknown>,
    hydrated: true,
    lastSavedAt: "2026-07-14T00:00:00.000Z" as string | null,
    recoveryState: "possible" as const,
    status: "clean" as const,
  },
  retryMock: vi.fn(),
  submitHookOptions: null as null | Record<string, unknown>,
  submitMutateMock: vi.fn(),
  upsertMutateAsyncMock: vi.fn(),
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
    mutateAsync: helpers.upsertMutateAsyncMock,
  }),
  useSubmitWriting: (_action: unknown, options: Record<string, unknown>) => {
    helpers.submitHookOptions = options;
    return {
      isPending: false,
      mutate: helpers.submitMutateMock,
    };
  },
}));

vi.mock("@/lib/writing/use-writing-resilience", () => ({
  useWritingResilience: (options: Record<string, unknown>) => {
    helpers.resilienceOptions = options;
    if (!helpers.latestSnapshot) {
      helpers.latestSnapshot =
        options.initialSnapshot as typeof helpers.latestSnapshot;
    }
    return {
      chooseRecovery: helpers.chooseRecoveryMock,
      clearAfterSubmitSuccess: helpers.clearAfterSubmitSuccessMock,
      edit: helpers.editMock,
      getLatestSnapshot: helpers.getLatestSnapshotMock,
      intentPersistence: helpers.intentPersistence,
      manualSave: helpers.manualSaveMock,
      prepareForSubmit: helpers.prepareForSubmitMock,
      retry: helpers.retryMock,
      setServerAutosaveEnabled: vi.fn(),
      state: helpers.resilienceState,
    };
  },
}));

vi.mock("@/lib/writing/queries", () => ({
  useFeedbackStatus: () => ({ data: "analyzing" }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  helpers.latestSnapshot = null;
  helpers.resilienceOptions = null;
  helpers.resilienceState.conflict = null;
  helpers.resilienceState.lastSavedAt = "2026-07-14T00:00:00.000Z";
  helpers.resilienceState.status = "clean";
  helpers.submitHookOptions = null;
  helpers.editMock.mockImplementation((snapshot) => {
    helpers.latestSnapshot = snapshot;
  });
  helpers.getLatestSnapshotMock.mockImplementation(
    () => helpers.latestSnapshot,
  );
  helpers.prepareForSubmitMock.mockResolvedValue({
    id: "draft-from-latest-save",
    last_saved_at: "2026-07-18T00:00:00.000Z",
  });
  helpers.submitMutateMock.mockImplementation((_input, options) => {
    options?.onSuccess?.({ submissionId: "submission-51", questionNo: 51 });
  });
});

afterEach(() => {
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
  it("does not send the server-owned cutover snapshot in client draft saves", () => {
    renderEditor({ withSavedDraft: true });

    const initialSnapshot = helpers.resilienceOptions?.initialSnapshot as {
      draft: Record<string, unknown>;
    };
    expect(initialSnapshot.draft).not.toHaveProperty("legacy_cutover_snapshot");
  });

  it("records every edit as an immutable resilience snapshot", () => {
    renderEditor();

    fireEvent.change(
      screen.getByPlaceholderText(koMessages.writing.editor.placeholderShort),
      { target: { value: "1234567890" } },
    );

    expect(helpers.editMock).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: expect.objectContaining({
          answer_text: "1234567890",
          char_count: 10,
          problem_id: "problem-1",
          question_no: 51,
          user_id: "user-1",
        }),
        draftId: null,
      }),
    );
  });

  it("flushes the latest snapshot and submits with the returned draft id", async () => {
    renderEditor();

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
      expect(helpers.prepareForSubmitMock).toHaveBeenCalledTimes(1);
      expect(helpers.submitMutateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          answer_text: "1234567890",
          char_count: 10,
          draft_id: "draft-from-latest-save",
        }),
        expect.any(Object),
      );
    });
    expect(helpers.submitHookOptions).toEqual({
      intentPersistence: helpers.intentPersistence,
    });
    expect(helpers.clearAfterSubmitSuccessMock).toHaveBeenCalledTimes(1);
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
    expect(await screen.findByTestId("analysis-loading-page")).toBeTruthy();
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
    expect(helpers.clearAfterSubmitSuccessMock).not.toHaveBeenCalled();
  });

  it("blocks submission when the latest draft cannot be flushed", async () => {
    helpers.prepareForSubmitMock.mockRejectedValue(
      new Error("latest save failed"),
    );
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

    expect(await screen.findByTestId("autosave-warning-modal")).toBeTruthy();
    expect(helpers.submitMutateMock).not.toHaveBeenCalled();
    expect(helpers.clearAfterSubmitSuccessMock).not.toHaveBeenCalled();
  });

  it("restores the full prior snapshot selected from a recovery conflict", async () => {
    helpers.resilienceState.conflict = {
      current: {
        draft: { answer_text: "current content" },
        draftId: "saved-draft-1",
      },
      currentSavedAt: "2026-07-18T01:00:00.000Z",
      prior: { answerText: "prior recovered content" },
      priorSavedAt: "2026-07-18T00:00:00.000Z",
    };
    helpers.chooseRecoveryMock.mockResolvedValue({
      draft: {
        answer_text: "prior recovered content",
        char_count: 23,
      },
      draftId: "saved-draft-1",
    });
    renderEditor({ withSavedDraft: true });

    fireEvent.click(await screen.findByTestId("writing-recovery-choose-prior"));

    await waitFor(() => {
      expect(helpers.chooseRecoveryMock).toHaveBeenCalledWith("prior");
      expect(
        (
          screen.getByPlaceholderText(
            koMessages.writing.editor.placeholderShort,
          ) as HTMLTextAreaElement
        ).value,
      ).toBe("prior recovered content");
    });
  });
});
