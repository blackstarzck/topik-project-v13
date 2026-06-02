// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";

import { renderWithIntl } from "../../test-utils/renderWithIntl";
import { ChecklistRow } from "../../../src/components/writing/ChecklistRow";

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

describe("ChecklistRow", () => {
  it("renders label and three state options", () => {
    renderWithIntl(
      <ChecklistRow label="서론" status="unchecked" onChange={vi.fn()} />,
    );
    expect(screen.getByText("서론")).toBeTruthy();
    // Segmented renders all three options as labels
    expect(screen.getByText("⚪ 아직")).toBeTruthy();
    expect(screen.getByText("🟡 부분")).toBeTruthy();
    expect(screen.getByText("🟢 완료")).toBeTruthy();
  });

  it("calls onChange with the next state when an option is clicked", async () => {
    const onChange = vi.fn();
    renderWithIntl(
      <ChecklistRow label="본론" status="unchecked" onChange={onChange} />,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("🟢 완료"));
    });

    expect(onChange).toHaveBeenCalledWith("complete");
  });
});
