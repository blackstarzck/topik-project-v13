// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";

import { renderWithIntl } from "../../test-utils/renderWithIntl";
import { EssayChecklist } from "../../../src/components/writing/EssayChecklist";
import {
  emptyChecklist,
  ESSAY_CHECKLIST_KEYS,
} from "../../../src/lib/writing/types";

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

describe("EssayChecklist", () => {
  it("renders 6 IA-specified items", () => {
    renderWithIntl(
      <EssayChecklist status={emptyChecklist()} onChange={vi.fn()} />,
    );
    expect(ESSAY_CHECKLIST_KEYS).toHaveLength(6);
    // Some Korean tokens appear in multiple labels (e.g. "근거" in 본론 + 근거 row);
    // use getAllByText to confirm presence without uniqueness requirement.
    expect(screen.getAllByText(/서론/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/본론/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/결론/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/근거/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/연결어/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/주제 일치/).length).toBeGreaterThan(0);
  });

  it("calls onChange(key, next) when a row's state is changed", async () => {
    const onChange = vi.fn();
    renderWithIntl(
      <EssayChecklist status={emptyChecklist()} onChange={onChange} />,
    );
    // Click "🟢 완료" on the first row — Ant Design Segmented renders multiple
    // identical labels per row; clicking any one triggers the matching onChange.
    const completeButtons = screen.getAllByText("🟢 완료");
    expect(completeButtons.length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.click(completeButtons[0]);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][1]).toBe("complete");
  });
});
