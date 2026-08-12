// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";

import { renderWithIntl } from "../../test-utils/renderWithIntl";
import { AutosaveWarningModal } from "../../../src/components/writing/AutosaveWarningModal";

type ModalProps = ComponentProps<typeof AutosaveWarningModal>;

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

function renderModal(props: Partial<ModalProps> = {}) {
  const handlers = {
    onKeep: vi.fn(),
    onRetry: vi.fn(),
    onProceed: vi.fn(),
  };

  renderWithIntl(
    <AutosaveWarningModal
      trigger="save_failure"
      lastSavedAt={null}
      recoveryState="impossible"
      {...handlers}
      {...props}
    />,
  );

  return handlers;
}

function modalButton(testId: string) {
  return screen.getByTestId(testId) as HTMLButtonElement;
}

describe("AutosaveWarningModal", () => {
  it("renders nothing when trigger is null", () => {
    const { container } = renderWithIntl(
      <AutosaveWarningModal
        trigger={null}
        lastSavedAt={null}
        recoveryState="impossible"
        onKeep={vi.fn()}
        onRetry={vi.fn()}
        onProceed={vi.fn()}
      />,
    );
    expect(container.textContent).toBe("");
  });

  it("save_failure shows the warning copy, last-saved time, and recoverable state", () => {
    renderModal({
      trigger: "save_failure",
      lastSavedAt: "2026-05-26T08:30:00Z",
      recoveryState: "possible",
    });

    const modal = screen.getByTestId("autosave-warning-modal");
    expect(screen.getByText("자동 저장 실패")).toBeTruthy();
    expect(screen.getByTestId("autosave-warning-body").textContent).toBe(
      "저장이 지연되고 있습니다. 작성 내용은 이 기기에 임시 보관되었습니다.",
    );
    expect(
      within(modal).getByTestId("autosave-warning-last-saved").textContent,
    ).toContain("2026");
    expect(
      within(modal).getByTestId("autosave-warning-recovery-state").textContent,
    ).toContain("이 기기에 임시 보관됨");
    expect(screen.queryByTestId("autosave-warning-alert")).toBeNull();
    expect(modalButton("autosave-warning-retry").disabled).toBe(false);
  });

  it("disable_attempt disables retry and requires the danger proceed action", () => {
    const handlers = renderModal({ trigger: "disable_attempt" });

    expect(screen.queryByTestId("autosave-warning-alert")).toBeNull();
    expect(screen.queryByTestId("autosave-warning-no-backup")).toBeNull();
    expect(screen.getByTestId("autosave-warning-body").textContent).toContain(
      "이 기기 임시 보관은 계속됩니다",
    );

    const retryButton = modalButton("autosave-warning-retry");
    expect(retryButton.disabled).toBe(true);
    fireEvent.click(retryButton);
    expect(handlers.onRetry).not.toHaveBeenCalled();

    fireEvent.click(modalButton("autosave-warning-proceed"));
    expect(handlers.onProceed).toHaveBeenCalledTimes(1);
  });

  it("exit_with_dirty can show checking recovery state and invokes onProceed", () => {
    const handlers = renderModal({
      trigger: "exit_with_dirty",
      recoveryState: "checking",
    });

    expect(screen.getByTestId("autosave-warning-body").textContent).toContain(
      "서버에 반영되지 않습니다",
    );
    expect(
      screen.getByTestId("autosave-warning-recovery-state").textContent,
    ).toContain("확인 중");
    expect(screen.queryByTestId("autosave-warning-no-backup")).toBeNull();
    expect(modalButton("autosave-warning-keep").textContent).toContain(
      "현재 페이지에 머물기",
    );
    expect(modalButton("autosave-warning-retry").textContent).toContain(
      "저장 후 이동",
    );
    expect(modalButton("autosave-warning-proceed").textContent).toContain(
      "저장하지 않고 이동",
    );

    fireEvent.click(modalButton("autosave-warning-proceed"));
    expect(handlers.onProceed).toHaveBeenCalledTimes(1);
  });

  it("save_failure retry fires onRetry", () => {
    const handlers = renderModal({ trigger: "save_failure" });

    fireEvent.click(modalButton("autosave-warning-retry"));
    expect(handlers.onRetry).toHaveBeenCalledTimes(1);
  });

  it("keep action fires onKeep", () => {
    const handlers = renderModal({ trigger: "save_failure" });

    fireEvent.click(modalButton("autosave-warning-keep"));
    expect(handlers.onKeep).toHaveBeenCalledTimes(1);
  });
});
