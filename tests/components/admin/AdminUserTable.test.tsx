// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// Mock the queries + mutations modules BEFORE importing the component.
const useAdminUsersMock = vi.fn();
vi.mock("@/lib/admin/queries", () => ({
  useAdminUsers: (...args: unknown[]) => useAdminUsersMock(...args),
  adminUsersKey: () => ["admin-users", { search: "", role: "" }] as const,
  adminProblemsKey: () => ["admin-problems", { status: "" }] as const,
}));

vi.mock("@/lib/admin/mutations", () => ({
  useChangeUserRole: () => ({
    mutate: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
  useToggleProblemPublish: () => ({
    mutate: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
}));

import { AdminUserTable } from "../../../src/components/admin/AdminUserTable";
import type { AdminUserRow } from "../../../src/lib/admin/types";

beforeEach(() => {
  useAdminUsersMock.mockReset();
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

function makeRow(overrides: Partial<AdminUserRow> = {}): AdminUserRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    display_name: "김민지",
    nickname: "minji",
    avatar_path: null,
    ui_locale: "ko",
    app_role: "learner",
    plan_label: "free",
    status: "active",
    notification_prefs: {},
    created_at: "2026-05-21T00:00:00Z",
    updated_at: "2026-05-21T00:00:00Z",
    ...overrides,
  };
}

describe("AdminUserTable", () => {
  it("renders initialRows when the query has no data yet", () => {
    useAdminUsersMock.mockReturnValue({
      data: undefined,
      error: null,
      isFetching: false,
    });

    const rows = [
      makeRow({ id: "u-1", display_name: "김민지" }),
      makeRow({
        id: "u-2",
        display_name: "박서준",
        app_role: "content_admin",
      }),
    ];
    render(<AdminUserTable initialRows={rows} />);

    expect(screen.getByText("김민지")).toBeTruthy();
    expect(screen.getByText("박서준")).toBeTruthy();
    // Role tag should show the Korean label.
    expect(screen.getByText("콘텐츠 관리자")).toBeTruthy();
  });

  it("calls useAdminUsers with the empty filter on first render", () => {
    useAdminUsersMock.mockReturnValue({
      data: undefined,
      error: null,
      isFetching: false,
    });

    render(<AdminUserTable initialRows={[makeRow()]} />);

    expect(useAdminUsersMock).toHaveBeenCalled();
    const firstArg = useAdminUsersMock.mock.calls[0]?.[0];
    expect(firstArg).toEqual({});
  });

  it("prefers query.data over initialRows once the hook returns data", () => {
    useAdminUsersMock.mockReturnValue({
      data: [
        makeRow({ id: "live-1", display_name: "라이브유저" }),
      ],
      error: null,
      isFetching: false,
    });

    render(
      <AdminUserTable
        initialRows={[
          makeRow({ id: "init-1", display_name: "초기유저" }),
        ]}
      />,
    );

    expect(screen.getByText("라이브유저")).toBeTruthy();
    expect(screen.queryByText("초기유저")).toBeNull();
  });

  it("opens the role modal when the action button is clicked", () => {
    useAdminUsersMock.mockReturnValue({
      data: undefined,
      error: null,
      isFetching: false,
    });

    render(
      <AdminUserTable
        initialRows={[makeRow({ id: "u-9", display_name: "이수민" })]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "역할 변경" }));
    // Modal title is "역할 변경" (Korean for "change role").
    // There may be multiple matches (button + modal heading); ensure at least 2 found.
    const matches = screen.getAllByText("역할 변경");
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});
