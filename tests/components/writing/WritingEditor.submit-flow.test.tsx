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

afterEach(() => cleanup());

function renderEditor() {
  renderWithIntl(
    <WritingEditor
      userId="user-1"
      problemId="problem-1"
      questionNo={51}
      initialDraft={null}
    />,
  );
}

describe("WritingEditor submit flow", () => {
  it("shows page-level D-M2 analysis UI after submit succeeds", async () => {
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

    expect(helpers.pushMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("analysis-loading-page")).toBeTruthy();
    expect(await screen.findByTestId("analysis-loading-panel")).toBeTruthy();
    expect(screen.queryByTestId("analysis-loading-modal")).toBeNull();
  });

  it("closes the submit confirm modal and shows a failure modal when submit fails", async () => {
    helpers.submitMutateMock.mockImplementation((_input, options) => {
      options?.onError?.(new Error("network down"));
    });
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
      expect(screen.queryByTestId("submission-confirm-modal")).toBeNull();
    });
    expect(await screen.findByTestId("submission-failed-modal")).toBeTruthy();
    expect(
      screen.getByText(koMessages.writing.submit.submitFailedTitle),
    ).toBeTruthy();
    expect(screen.getByText(/network down/)).toBeTruthy();
  });
});
