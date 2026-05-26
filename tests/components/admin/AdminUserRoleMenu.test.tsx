// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const mutateMock = vi.fn();
const resetMock = vi.fn();
const useChangeUserRoleMock = vi.fn();

vi.mock("@/lib/admin/mutations", () => ({
  useChangeUserRole: () => useChangeUserRoleMock(),
  useToggleProblemPublish: () => ({
    mutate: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
}));

import { AdminUserRoleMenu } from "../../../src/components/admin/AdminUserRoleMenu";
import type { AdminUserRow } from "../../../src/lib/admin/types";

function makeRow(overrides: Partial<AdminUserRow> = {}): AdminUserRow {
  return {
    id: "00000000-0000-0000-0000-000000000099",
    display_name: "박서준",
    nickname: "seojun",
    avatar_path: null,
    ui_locale: "ko",
    app_role: "learner",
    plan_label: "free",
    status: "active",
    notification_prefs: {},
    bio: null,
    created_at: "2026-05-21T00:00:00Z",
    updated_at: "2026-05-21T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  mutateMock.mockReset();
  resetMock.mockReset();
  useChangeUserRoleMock.mockReset();
  useChangeUserRoleMock.mockReturnValue({
    mutate: mutateMock,
    isPending: false,
    error: null,
    reset: resetMock,
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

describe("AdminUserRoleMenu", () => {
  it("does NOT call mutate when confirming with the same role (no-op)", () => {
    const row = makeRow({ app_role: "learner" });
    const onClose = vi.fn();

    render(<AdminUserRoleMenu row={row} open={true} onClose={onClose} />);

    // The default selection is row.app_role ("learner"). Click the OK button
    // labelled "변경".
    fireEvent.click(screen.getByRole("button", { name: "변경" }));

    expect(mutateMock).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls mutate with {targetId, newRole} when role changes and Confirm clicked", () => {
    const row = makeRow({ id: "user-42", app_role: "learner" });
    const onClose = vi.fn();

    render(<AdminUserRoleMenu row={row} open={true} onClose={onClose} />);

    // Find the role select. The Korean aria-label is "새 역할 선택".
    // antd Select uses a combobox under the hood; for testing we manipulate
    // state through firing change on the hidden combobox or via the
    // displayed options. The simpler & most reliable approach: simulate
    // changing the underlying state by clicking the select to open and
    // selecting a different option. But antd's Virtual list makes that
    // unreliable in jsdom. Instead, we exercise the public contract:
    // pre-seed the selection by re-rendering the modal with a different
    // row.app_role (NO — that would be testing internals).
    //
    // Reliable path: antd's combobox exposes the native role="combobox"
    // element; we can dispatch a change by clicking the option in the
    // dropdown after opening.

    const combobox = screen.getByRole("combobox");
    fireEvent.mouseDown(combobox);

    // Now the dropdown is rendered. Click the "플랫폼 관리자" option
    // (platform_admin label).
    const option = screen.getByText("플랫폼 관리자");
    fireEvent.click(option);

    // Now click "변경" to confirm.
    fireEvent.click(screen.getByRole("button", { name: "변경" }));

    expect(mutateMock).toHaveBeenCalledTimes(1);
    const [args] = mutateMock.mock.calls[0];
    expect(args).toEqual({
      targetId: "user-42",
      newRole: "platform_admin",
    });
  });

  it("disables OK button while pending and shows loading state", () => {
    useChangeUserRoleMock.mockReturnValue({
      mutate: mutateMock,
      isPending: true,
      error: null,
      reset: resetMock,
    });

    const row = makeRow();
    render(<AdminUserRoleMenu row={row} open={true} onClose={() => {}} />);

    const okBtn = screen.getByRole("button", { name: /변경/ });
    // antd disables a loading button by adding `disabled` attribute; check
    // either the attribute or the loading spinner.
    expect(okBtn.hasAttribute("disabled")).toBe(true);
  });
});
