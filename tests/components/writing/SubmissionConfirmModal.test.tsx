// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";

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
  it("renders the confirm title + summary rows from the ko catalog", () => {
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
    // §2 summary — question type / answer length / save record (ko verbatim).
    expect(screen.getByText("54번")).toBeTruthy();
    expect(screen.getByText("650자")).toBeTruthy();
    expect(screen.getByText("자동 저장 기록 없음")).toBeTruthy();
    // §3 — agreement checkbox label.
    expect(
      screen.getByText("제출 후 수정할 수 없음을 확인했어요."),
    ).toBeTruthy();
  });

  it("ok button stays disabled until the agreement is checked", () => {
    const onConfirm = vi.fn();
    renderWithIntl(
      <SubmissionConfirmModal
        open
        charCount={650}
        minChars={600}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    const okBtn = screen
      .getByText("제출")
      .closest("button") as HTMLButtonElement;
    expect(okBtn.disabled).toBe(true);
    // Check the agreement, then the primary CTA enables.
    fireEvent.click(
      screen.getByText("제출 후 수정할 수 없음을 확인했어요."),
    );
    expect(okBtn.disabled).toBe(false);
  });

  it("surfaces the submit error inline and switches OK to '다시 제출'", () => {
    renderWithIntl(
      <SubmissionConfirmModal
        open
        charCount={650}
        minChars={600}
        submitError="네트워크 오류"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("제출하지 못했어요")).toBeTruthy();
    expect(screen.getByText("다시 제출")).toBeTruthy();
  });
});
