// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";

import DashboardLoading from "../../../src/app/(workspace)/dashboard/loading";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

// PLAN §Phase 2 / §G #10 — the dashboard segment loading.tsx is a layout-matched
// skeleton (antd Skeleton on AppCard surfaces) that reserves space to keep CLS
// low. The live skeleton is behind auth (requireUser → /dashboard), so this
// component test is the deterministic "skeleton present" evidence.

afterEach(() => {
  cleanup();
});

describe("dashboard loading skeleton", () => {
  it("renders antd Skeletons on shared app-card surfaces", () => {
    const { container } = renderWithIntl(<DashboardLoading />);
    expect(container.querySelectorAll(".ant-skeleton").length).toBeGreaterThan(
      0,
    );
    // surfaces reuse the AppCard hook so the skeleton mirrors the populated grid
    expect(container.querySelectorAll(".app-card").length).toBeGreaterThan(0);
  });

  it("carries no text copy of its own", () => {
    const { container } = renderWithIntl(<DashboardLoading />);
    // skeleton is purely structural — no literal copy to translate
    expect(container.textContent?.trim()).toBe("");
  });
});
