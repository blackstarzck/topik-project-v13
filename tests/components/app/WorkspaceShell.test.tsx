// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";

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

  it("renders workspace chrome through stable class hooks", () => {
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
    expect(container.querySelector(".app-workspace-main")).toBeTruthy();
    expect(container.querySelector(".app-workspace-content")).toBeTruthy();
    expect(container.querySelector(".app-header")).toBeTruthy();
    expect(container.querySelector(".app-sidebar-shell")).toBeTruthy();
    expect(screen.getByTestId("workspace-child")).toBeTruthy();
    expect(screen.getByText("learner@example.com")).toBeTruthy();
  });

  it("keeps shell token consumption out of inline style props", () => {
    const { container } = renderWithIntl(
      <WorkspaceShell role="learner" email={null} planLabel="premium">
        <div>body</div>
      </WorkspaceShell>,
    );

    for (const selector of [
      ".app-workspace-layout",
      ".app-workspace-sider",
      ".app-workspace-main",
      ".app-workspace-content",
      ".app-header",
      ".app-sidebar-menu",
    ]) {
      const el = container.querySelector<HTMLElement>(selector);
      expect(el, selector).toBeTruthy();
      expect(el?.getAttribute("style") ?? "").not.toMatch(/var\(--app-/);
    }
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
