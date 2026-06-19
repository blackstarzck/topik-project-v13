// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";

import { renderWithIntl } from "../../test-utils/renderWithIntl";
import { SubmissionConfirmModal } from "../../../src/components/writing/SubmissionConfirmModal";

beforeEach(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: () => ({
        matches: false,
        media: "",
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  }
});

afterEach(() => cleanup());

describe("SubmissionConfirmModal (i18n)", () => {
  it("renders the confirm title from the ko catalog", () => {
    renderWithIntl(
      <SubmissionConfirmModal
        open
        charCount={650}
        minChars={600}
        questionNo={54}
        lastSavedAt={null}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("답안을 제출하시겠어요?")).toBeTruthy();
    expect(screen.getByText("작성한 답안을 제출하면 수정할 수 없습니다.")).toBeTruthy();
  });

  it("keeps submit enabled when the answer is long enough", () => {
    renderWithIntl(
      <SubmissionConfirmModal
        open
        charCount={650}
        minChars={600}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const okBtn = screen
      .getByTestId("submission-confirm-submit")
      .closest("button") as HTMLButtonElement;
    expect(okBtn.disabled).toBe(false);
  });

  it("surfaces the submit error inline and switches OK to retry submit", () => {
    renderWithIntl(
      <SubmissionConfirmModal
        open
        charCount={650}
        minChars={600}
        submitError="network error"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("제출하지 못했어요")).toBeTruthy();
    expect(screen.getByText("다시 제출")).toBeTruthy();
  });

  it("locks the submit actions while submission is pending", () => {
    renderWithIntl(
      <SubmissionConfirmModal
        open
        charCount={650}
        minChars={600}
        loading
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const cancelBtn = screen
      .getByTestId("submission-confirm-cancel")
      .closest("button") as HTMLButtonElement;
    const submitBtn = screen
      .getByTestId("submission-confirm-submit")
      .closest("button") as HTMLButtonElement;

    expect(cancelBtn.disabled).toBe(true);
    expect(submitBtn.disabled).toBe(true);
    expect(submitBtn.className).toContain("ant-btn-loading");
  });
});
