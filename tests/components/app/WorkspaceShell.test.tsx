// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspaceShell } from "../../../src/components/app/WorkspaceShell";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

const navMock = vi.hoisted(() => ({
  routerPush: vi.fn(),
  pathname: "/dashboard",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navMock.pathname,
  useRouter: () => ({ push: navMock.routerPush }),
}));

function hasExpandedMenuItem(container: HTMLElement, label: string) {
  return Array.from(
    container.querySelectorAll('[role="menuitem"][aria-expanded]'),
  ).some(
    (menuItem) =>
      menuItem.textContent?.includes(label) &&
      menuItem.getAttribute("aria-expanded") === "true",
  );
}

describe("WorkspaceShell", () => {
  beforeEach(() => {
    navMock.routerPush.mockClear();
    navMock.pathname = "/dashboard";
  });

  it("renders the workspace sidebar while keeping AppHeader unused", () => {
    const { container } = renderWithIntl(
      <WorkspaceShell
        role="learner"
        userId="user-1"
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
      <WorkspaceShell role="learner" userId="user-1" email={null} planLabel={null}>
        <div>body</div>
      </WorkspaceShell>,
    );

    expect(container.querySelector(".app-sidebar-lock-label")).toBeTruthy();
    expect(container.querySelector(".app-sidebar-lock-icon")).toBeTruthy();
    expect(container.querySelector(".app-sidebar-lock-tag")).toBeTruthy();
  });

  it("keeps the current nested route group open on direct entry", () => {
    navMock.pathname = "/practice/problems";

    const { container } = renderWithIntl(
      <WorkspaceShell role="learner" userId="user-1" email={null} planLabel="premium">
        <div>body</div>
      </WorkspaceShell>,
    );

    expect(hasExpandedMenuItem(container, "학습")).toBe(true);
    expect(container.textContent).toContain("문제 풀이");
  });

  it("lets the user collapse the active group even while a child is selected", () => {
    navMock.pathname = "/practice/problems";

    const { container } = renderWithIntl(
      <WorkspaceShell role="learner" userId="user-1" email={null} planLabel="premium">
        <div>body</div>
      </WorkspaceShell>,
    );

    expect(hasExpandedMenuItem(container, "학습")).toBe(true);

    const groupTitle = Array.from(
      container.querySelectorAll('[role="menuitem"][aria-expanded]'),
    ).find((item) => item.textContent?.includes("학습")) as HTMLElement;
    fireEvent.click(within(groupTitle).getByText("학습"));

    expect(hasExpandedMenuItem(container, "학습")).toBe(false);
  });

  it("opens the writing group for nested writing feedback routes", () => {
    navMock.pathname = "/writing/feedback/short/submission-1";

    const { container } = renderWithIntl(
      <WorkspaceShell role="learner" userId="user-1" email={null} planLabel="premium">
        <div>body</div>
      </WorkspaceShell>,
    );

    expect(hasExpandedMenuItem(container, "글쓰기")).toBe(true);
  });
});
