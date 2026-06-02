// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";

import { renderWithIntl } from "../../test-utils/renderWithIntl";
import { AutosaveWarningModal } from "../../../src/components/writing/AutosaveWarningModal";

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

describe("AutosaveWarningModal", () => {
  it("renders nothing when trigger is null", () => {
    const { container } = renderWithIntl(
      <AutosaveWarningModal
        trigger={null}
        lastSavedAt={null}
        onKeep={vi.fn()}
        onRetry={vi.fn()}
        onProceed={vi.fn()}
      />,
    );
    expect(container.textContent).toBe("");
  });

  it("save_failure trigger shows failure title + last-saved time", () => {
    renderWithIntl(
      <AutosaveWarningModal
        trigger="save_failure"
        lastSavedAt="2026-05-26T08:30:00Z"
        onKeep={vi.fn()}
        onRetry={vi.fn()}
        onProceed={vi.fn()}
      />,
    );
    expect(screen.getByText(/자동 저장 실패/)).toBeTruthy();
    expect(screen.getByText(/마지막 저장:/)).toBeTruthy();
  });

  it("disable_attempt trigger disables retry button", () => {
    const onRetry = vi.fn();
    renderWithIntl(
      <AutosaveWarningModal
        trigger="disable_attempt"
        lastSavedAt={null}
        onKeep={vi.fn()}
        onRetry={onRetry}
        onProceed={vi.fn()}
      />,
    );
    const retryBtn = screen.getByText(/대신 자동 저장 유지/);
    expect(
      (retryBtn.closest("button") as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("exit_with_dirty trigger shows exit warning + invokes onProceed", () => {
    const onProceed = vi.fn();
    renderWithIntl(
      <AutosaveWarningModal
        trigger="exit_with_dirty"
        lastSavedAt={null}
        onKeep={vi.fn()}
        onRetry={vi.fn()}
        onProceed={onProceed}
      />,
    );
    // Title + body both contain "저장되지 않은 변경 사항" — use getAllBy.
    expect(screen.getAllByText(/저장되지 않은 변경 사항/).length).toBeGreaterThan(
      0,
    );
    fireEvent.click(screen.getByText(/위험을 알지만 진행/));
    expect(onProceed).toHaveBeenCalledTimes(1);
  });

  it("save_failure: clicking '지금 다시 시도' fires onRetry", () => {
    const onRetry = vi.fn();
    renderWithIntl(
      <AutosaveWarningModal
        trigger="save_failure"
        lastSavedAt={null}
        onKeep={vi.fn()}
        onRetry={onRetry}
        onProceed={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("지금 다시 시도"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("any trigger: clicking '자동 저장 유지' fires onKeep", () => {
    const onKeep = vi.fn();
    renderWithIntl(
      <AutosaveWarningModal
        trigger="save_failure"
        lastSavedAt={null}
        onKeep={onKeep}
        onRetry={vi.fn()}
        onProceed={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("자동 저장 유지"));
    expect(onKeep).toHaveBeenCalledTimes(1);
  });
});
