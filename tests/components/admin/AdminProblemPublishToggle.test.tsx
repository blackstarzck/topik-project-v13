// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const mutateMock = vi.fn();
const useToggleMock = vi.fn();

vi.mock("@/lib/admin/mutations", () => ({
  useToggleProblemPublish: () => useToggleMock(),
  useChangeUserRole: () => ({
    mutate: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
}));

import { AdminProblemPublishToggle } from "../../../src/components/admin/AdminProblemPublishToggle";
import type { AdminProblemRow } from "../../../src/lib/admin/types";

function makeProblemRow(
  overrides: Partial<AdminProblemRow> = {},
): AdminProblemRow {
  return {
    id: "prob-1",
    source: "curated",
    author_id: null,
    domain: "writing",
    question_no: 51,
    topik_level: 6,
    difficulty: 3,
    title: "테스트 문제",
    prompt: "프롬프트",
    materials: null,
    answer_key: null,
    rubric: null,
    explanation: null,
    tags: [],
    publish_status: "draft",
    review_status: "approved",
    review_workflow_status: null,
    topic_category_code: null,
    lifecycle_status: "active",
    lifecycle_reason: null,
    expires_at: null,
    visibility: "public",
    created_at: "2026-05-21T00:00:00Z",
    updated_at: "2026-05-21T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  mutateMock.mockReset();
  useToggleMock.mockReset();
  useToggleMock.mockReturnValue({
    mutate: mutateMock,
    isPending: false,
    error: null,
    reset: vi.fn(),
  });

  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  }
  if (typeof window.ResizeObserver === "undefined") {
    class RO {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    (window as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
  }
});

afterEach(() => {
  cleanup();
});

describe("AdminProblemPublishToggle", () => {
  it("calls useToggleProblemPublish.mutate with {problemId, newStatus} on change", () => {
    const row = makeProblemRow({ id: "prob-7", publish_status: "draft" });

    render(<AdminProblemPublishToggle row={row} />);

    // Open the Select dropdown.
    const combobox = screen.getByRole("combobox");
    fireEvent.mouseDown(combobox);

    // Click "공개" (published).
    fireEvent.click(screen.getByText("공개"));

    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledWith({
      problemId: "prob-7",
      newStatus: "published",
    });
  });

  it("does not call mutate when picking the current status (no-op)", () => {
    const row = makeProblemRow({ publish_status: "draft" });

    render(<AdminProblemPublishToggle row={row} />);

    const combobox = screen.getByRole("combobox");
    fireEvent.mouseDown(combobox);

    // Click "초안" (the same status it already has).
    // There may be multiple "초안" matches — the visible Select value and
    // the dropdown option. Use getAllByText and click the LAST one (the
    // option in the dropdown).
    const items = screen.getAllByText("초안");
    fireEvent.click(items[items.length - 1]);

    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("disables the select while pending", () => {
    useToggleMock.mockReturnValue({
      mutate: mutateMock,
      isPending: true,
      error: null,
      reset: vi.fn(),
    });
    const row = makeProblemRow();
    const { container } = render(<AdminProblemPublishToggle row={row} />);

    // antd 6.x adds the `ant-select-disabled` class to the wrapper when the
    // Select is disabled. Also asserts that clicking the combobox does NOT
    // call mutate.
    const wrapper = container.querySelector(".ant-select");
    expect(wrapper).not.toBeNull();
    expect(wrapper?.classList.contains("ant-select-disabled")).toBe(true);
  });
});
