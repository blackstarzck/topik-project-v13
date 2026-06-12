// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspaceShell } from "../../../src/components/app/WorkspaceShell";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

const { routerPush } = vi.hoisted(() => ({
  routerPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: routerPush }),
}));

describe("WorkspaceShell", () => {
  beforeEach(() => {
    routerPush.mockClear();
  });

  it("renders the workspace sidebar while keeping AppHeader unused", () => {
    const { container } = renderWithIntl(
      <WorkspaceShell
        role="learner"
        email="learner@example.com"
        planLabel="premium"
      >
        <div data-testid="workspace-child">body</div>
      </WorkspaceShell>,
    );

    expect(container.querySelector(".app-workspace-layout")).toBeTruthy();
    expect(container.querySelector(".app-workspace-sider")).toBeTruthy();
    expect(container.querySelector(".app-sidebar-shell")).toBeTruthy();
    expect(container.querySelector(".app-sidebar-menu")).toBeTruthy();
    expect(container.querySelector(".app-workspace-content")).toBeTruthy();
    expect(container.querySelector(".app-header")).toBeNull();
    expect(screen.getByTestId("workspace-child")).toBeTruthy();
  });

  it("renders locked sidebar entries with class-based affordances", () => {
    const { container } = renderWithIntl(
      <WorkspaceShell role="learner" email={null} planLabel={null}>
        <div>body</div>
      </WorkspaceShell>,
    );

    expect(container.querySelector(".app-sidebar-lock-label")).toBeTruthy();
    expect(container.querySelector(".app-sidebar-lock-icon")).toBeTruthy();
    expect(container.querySelector(".app-sidebar-lock-tag")).toBeTruthy();
  });
});
