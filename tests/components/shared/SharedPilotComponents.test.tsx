// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";

import { AppCard } from "../../../src/components/shared/AppCard";
import { AppDrawer } from "../../../src/components/shared/AppDrawer";
import { PageContainer } from "../../../src/components/shared/PageContainer";
import { PageHeader } from "../../../src/components/shared/PageHeader";
import { PublicShell } from "../../../src/components/shared/PublicShell";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

// PLAN §Phase 1 — shared pilot components, TDD contract (#12 · #15 a11y).
// Role/class/key based only (no Korean literal coupling). Every component is
// also asserted NOT to declare `--app-*` in inline style (08 Rule 1: --app-* may
// only live on html/:root).

afterEach(() => {
  cleanup();
});

// Rule 1 guard: no element below html declares an --app-* variable via style=.
function expectNoAppVarDeclarationsIn(container: HTMLElement) {
  const all = [container, ...Array.from(container.querySelectorAll<HTMLElement>("*"))];
  for (const el of all) {
    const style = el.getAttribute("style") ?? "";
    // Using var(--app-*) is allowed (consumption); DECLARING --app-*: is not.
    expect(style).not.toMatch(/--app-[a-z0-9-]+\s*:/i);
  }
}

describe("AppCard", () => {
  it("exposes stable .app-card and .app-surface theme hooks and renders children", () => {
    const { container } = renderWithIntl(
      <AppCard title="card-title">
        <span data-testid="card-child">body</span>
      </AppCard>,
    );
    const card = container.querySelector(".app-card");
    expect(card).toBeTruthy();
    expect(card?.classList.contains("app-surface")).toBe(true);
    expect(screen.getByTestId("card-child")).toBeTruthy();
    expect(screen.getByText("card-title")).toBeTruthy();
  });

  it("merges a caller className without dropping the hooks", () => {
    const { container } = renderWithIntl(<AppCard className="caller-x">x</AppCard>);
    const card = container.querySelector(".app-card");
    expect(card?.classList.contains("app-surface")).toBe(true);
    expect(card?.classList.contains("caller-x")).toBe(true);
  });

  it("declares no --app-* variable in inline style", () => {
    const { container } = renderWithIntl(<AppCard>x</AppCard>);
    expectNoAppVarDeclarationsIn(container);
  });
});

describe("PageContainer", () => {
  it("renders a single main landmark with the size + caller class", () => {
    renderWithIntl(
      <PageContainer size="narrow" className="caller-y" aria-label="login region">
        <span data-testid="pc-child">c</span>
      </PageContainer>,
    );
    const main = screen.getByRole("main");
    expect(main.classList.contains("app-page-container")).toBe(true);
    expect(main.classList.contains("app-page-container--narrow")).toBe(true);
    expect(main.classList.contains("caller-y")).toBe(true);
    expect(main.getAttribute("aria-label")).toBe("login region");
    expect(within(main).getByTestId("pc-child")).toBeTruthy();
  });

  it("defaults to the default size variant", () => {
    renderWithIntl(<PageContainer>c</PageContainer>);
    expect(
      screen.getByRole("main").classList.contains("app-page-container--default"),
    ).toBe(true);
  });

  it("declares no --app-* variable in inline style", () => {
    const { container } = renderWithIntl(<PageContainer>c</PageContainer>);
    expectNoAppVarDeclarationsIn(container);
  });
});

describe("PageHeader", () => {
  it("renders the title as a level-1 heading and shows subtitle + actions when given", () => {
    renderWithIntl(
      <PageHeader
        title="page-title"
        subtitle="page-subtitle"
        actions={<button type="button">act</button>}
      />,
    );
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe("page-title");
    expect(screen.getByText("page-subtitle")).toBeTruthy();
    expect(screen.getByRole("button", { name: "act" })).toBeTruthy();
  });

  it("carries no copy of its own — renders only what is passed", () => {
    renderWithIntl(<PageHeader title="only-title" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("only-title");
    // no subtitle/actions rendered when not provided
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("PublicShell", () => {
  it("renders the header slot and children under the shell hook", () => {
    const { container } = renderWithIntl(
      <PublicShell header={<nav aria-label="public-nav">nav</nav>}>
        <span data-testid="ps-child">c</span>
      </PublicShell>,
    );
    expect(container.querySelector(".app-public-shell")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "public-nav" })).toBeTruthy();
    expect(screen.getByTestId("ps-child")).toBeTruthy();
  });

  it("omits the header region when no header is provided", () => {
    const { container } = renderWithIntl(
      <PublicShell>
        <span>c</span>
      </PublicShell>,
    );
    expect(container.querySelector(".app-public-shell__header")).toBeNull();
  });
});

describe("AppDrawer (overlay sentinel)", () => {
  it("renders an accessible dialog with the .app-drawer hook and children when open", () => {
    renderWithIntl(
      <AppDrawer open title="drawer-title" onClose={() => undefined}>
        <span data-testid="drawer-child">menu</span>
      </AppDrawer>,
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByTestId("drawer-child")).toBeTruthy();
    expect(document.querySelector(".app-drawer")).toBeTruthy();
  });

  it("calls onClose when the mask (overlay) is clicked", () => {
    const onClose = vi.fn();
    renderWithIntl(
      <AppDrawer open title="t" onClose={onClose}>
        <span>menu</span>
      </AppDrawer>,
    );
    const mask = document.querySelector(".ant-drawer-mask");
    expect(mask).toBeTruthy();
    fireEvent.click(mask as Element);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose on Escape (keyboard close)", () => {
    const onClose = vi.fn();
    renderWithIntl(
      <AppDrawer open title="t" onClose={onClose}>
        <span>menu</span>
      </AppDrawer>,
    );
    fireEvent.keyDown(screen.getByRole("dialog"), {
      key: "Escape",
      code: "Escape",
    });
    expect(onClose).toHaveBeenCalled();
  });
});
