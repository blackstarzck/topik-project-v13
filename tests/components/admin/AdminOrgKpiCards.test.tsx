// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

// Mock next/navigation (the component calls useRouter for router.refresh).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

// Stub the heavy children so this test stays focused on the KPI cards (region 2).
vi.mock("../../../src/components/admin/AdminOrgOperationsCards", () => ({
  AdminOrgOperationsCards: () => null,
}));
vi.mock("../../../src/components/admin/AdminOrgPerUserTable", () => ({
  AdminOrgPerUserTable: () => null,
}));
vi.mock("../../../src/components/admin/AdminAuditLogDrawer", () => ({
  AdminAuditLogDrawer: () => null,
}));

import { AdminOrgKpiCards } from "../../../src/components/admin/AdminOrgKpiCards";
import type { AdminOrgDashboardExtended } from "../../../src/components/admin/admin-rpc";

function makeDash(
  overrides: Partial<AdminOrgDashboardExtended> = {},
): AdminOrgDashboardExtended {
  return {
    learner_count: 12,
    active_7d_count: 5,
    submissions_7d_count: 8,
    recent_events: [],
    avg_writing_score: 73,
    per_user: [],
    assignment_submission_rate: 60,
    ...overrides,
  };
}

beforeEach(() => {
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

describe("AdminOrgKpiCards — region 2 KPI 현황", () => {
  it("renders exactly the 4 documented KPI titles in spec order", () => {
    const { container } = render(<AdminOrgKpiCards data={makeDash()} />);
    // antd Statistic renders the title in `.ant-statistic-title`.
    const titles = Array.from(
      container.querySelectorAll(".ant-statistic-title"),
    ).map((el) => el.textContent);
    expect(titles).toEqual([
      "학습자 수",
      "과제 제출률",
      "평균 점수",
      "활성 사용자 수",
    ]);
  });

  it("renders 과제 제출률 as a percentage when present", () => {
    const { container } = render(
      <AdminOrgKpiCards data={makeDash({ assignment_submission_rate: 60 })} />,
    );
    const card = Array.from(
      container.querySelectorAll(".ant-statistic"),
    ).find((el) =>
      el.querySelector(".ant-statistic-title")?.textContent === "과제 제출률",
    );
    expect(card).toBeTruthy();
    // value 60 + "%" suffix
    expect(card?.textContent).toContain("60");
    expect(card?.textContent).toContain("%");
  });

  it("renders 과제 제출률 as '—' with no % suffix when null", () => {
    const { container } = render(
      <AdminOrgKpiCards data={makeDash({ assignment_submission_rate: null })} />,
    );
    const card = Array.from(
      container.querySelectorAll(".ant-statistic"),
    ).find((el) =>
      el.querySelector(".ant-statistic-title")?.textContent === "과제 제출률",
    );
    expect(card).toBeTruthy();
    const content = card?.querySelector(".ant-statistic-content")?.textContent ?? "";
    expect(content).toContain("—");
    expect(content).not.toContain("%");
  });

  it("falls back to the onboarding empty state when there is no data", () => {
    render(
      <AdminOrgKpiCards
        data={makeDash({
          learner_count: 0,
          active_7d_count: 0,
          submissions_7d_count: 0,
          avg_writing_score: null,
          assignment_submission_rate: null,
        })}
      />,
    );
    // 예외 (region 2): 데이터 없음은 0 대신 온보딩 안내로 대체.
    expect(
      screen.getByText(/아직 기관 학습 데이터가 없어요/),
    ).toBeTruthy();
    // No KPI titles should render in the empty state.
    expect(screen.queryByText("과제 제출률")).toBeNull();
  });
});
