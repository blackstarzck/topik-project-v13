// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspaceShell } from "../../../src/components/app/WorkspaceShell";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

const GLOBAL_CSS = readFileSync(
  join(process.cwd(), "src/styles/global.css"),
  "utf8",
);
const WORKSPACE_LAYOUT_CSS = readFileSync(
  join(process.cwd(), "src/styles/workspace-layout.css"),
  "utf8",
);

const navMock = vi.hoisted(() => ({
  routerPush: vi.fn(),
  pathname: "/dashboard",
}));
const LOGO_SRC = "/assets/logo.png";

function decodedImageSrc(image: HTMLImageElement | null) {
  return decodeURIComponent(image?.getAttribute("src") ?? "");
}

function cssRule(selector: string) {
  return cssRuleFrom(GLOBAL_CSS, selector);
}

function workspaceLayoutCssRule(selector: string) {
  return workspaceLayoutCssRules(selector)[0] ?? "";
}

function workspaceLayoutCssRules(selector: string) {
  return cssRulesFrom(WORKSPACE_LAYOUT_CSS, selector);
}

function cssRuleFrom(source: string, selector: string) {
  return cssRulesFrom(source, selector)[0] ?? "";
}

function cssRulesFrom(source: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = source.matchAll(
    new RegExp(`${escapedSelector}\\s*\\{(?<body>[^}]*)\\}`, "gm"),
  );

  return Array.from(matches, (match) => match.groups?.body ?? "");
}

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
    expect(container.querySelector(".app-sidebar-menu-scroll")).toBeTruthy();
    expect(container.querySelector(".app-sidebar-menu")).toBeTruthy();
    expect(
      container.querySelector(".app-sidebar-menu-scroll .app-sidebar-menu"),
    ).toBeTruthy();
    expect(container.querySelector(".app-sidebar-nudge")).toBeNull();
    expect(container.querySelector(".app-sidebar-logout")).toBeNull();
    expect(container.querySelector(".app-workspace-content")).toBeTruthy();
    expect(container.querySelector(".app-header")).toBeNull();
    expect(screen.getByTestId("workspace-child")).toBeTruthy();
  });

  it("sends the brand mark to the learner home route", () => {
    renderWithIntl(
      <WorkspaceShell
        role="learner"
        userId="user-1"
        email={null}
        planLabel={null}
      >
        <div>body</div>
      </WorkspaceShell>,
    );

    fireEvent.click(screen.getAllByLabelText("TALKPIK")[0]);

    expect(navMock.routerPush).toHaveBeenCalledWith("/dashboard");
  });

  it("renders the uploaded logo asset in the sidebar brand", () => {
    const { container } = renderWithIntl(
      <WorkspaceShell
        role="learner"
        userId="user-1"
        email={null}
        planLabel={null}
      >
        <div>body</div>
      </WorkspaceShell>,
    );

    expect(
      decodedImageSrc(
        container.querySelector<HTMLImageElement>(".app-sidebar-brand img"),
      ),
    ).toContain(LOGO_SRC);
  });

  it("hides workspace navigation chrome on the onboarding learning goal route", () => {
    navMock.pathname = "/onboarding/learning-goal";

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

    expect(container.querySelector(".app-workspace-sider")).toBeNull();
    expect(container.querySelector(".app-sidebar-shell")).toBeNull();
    expect(container.querySelector(".app-notification-corner")).toBeNull();
    expect(
      container.querySelector('[data-testid="workspace-child"]'),
    ).toBeTruthy();
  });

  it("uses a white full-viewport content surface for the onboarding learning goal route", () => {
    navMock.pathname = "/onboarding/learning-goal";

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

    const content = container.querySelector(".app-workspace-content");
    expect(
      content?.classList.contains("app-workspace-content--onboarding"),
    ).toBe(true);

    const onboardingRule = workspaceLayoutCssRule(
      ".app-workspace-content--onboarding.ant-layout-content",
    );
    expect(onboardingRule).toContain("min-height: 100vh;");
    expect(onboardingRule).toContain("min-height: max(100vh, 100dvh);");
    expect(onboardingRule).toContain(
      "background: var(--app-color-bg-container);",
    );

    const onboardingRules = workspaceLayoutCssRules(
      ".app-workspace-content--onboarding.ant-layout-content",
    );
    expect(
      onboardingRules.some((rule) => rule.includes("min-height: 100dvh;")),
    ).toBe(true);
  });

  it("uses a white content surface for normal workspace pages", () => {
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

    const content = container.querySelector(".app-workspace-content");
    expect(content?.classList.contains("app-workspace-content--exam")).toBe(
      false,
    );

    const contentRule = workspaceLayoutCssRule(
      ".app-workspace-content.ant-layout-content",
    );
    expect(contentRule).toContain(
      "background: var(--app-color-bg-container);",
    );
  });

  it("keeps writing exam pages on the layout canvas surface", () => {
    navMock.pathname = "/writing/short-answer-writing-51";

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

    const content = container.querySelector(".app-workspace-content");
    expect(content?.classList.contains("app-workspace-content--exam")).toBe(
      true,
    );

    const examRule = workspaceLayoutCssRule(
      ".app-workspace-content--exam.ant-layout-content",
    );
    expect(examRule).toContain("background: var(--app-color-bg-layout);");
  });

  it("keeps the sidebar logo slot 68px tall and centered", () => {
    const brandRule = cssRule(".app-sidebar-brand");
    const logoRule = cssRule(".app-sidebar-brand__logo .brand-logo__image");

    expect(brandRule).toContain("height: 68px;");
    expect(brandRule).toContain("justify-content: center;");
    expect(brandRule).toContain("text-align: center;");
    expect(logoRule).toContain("height: 68px;");
  });

  it("sets the selected sidebar shell horizontal padding to zero", () => {
    const shellRule = cssRule(".app-sidebar-shell");

    expect(shellRule).toContain("padding: 18px 0;");
  });

  it("sets the workspace sidebar width contract to 300px", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/app/WorkspaceShell.tsx"),
      "utf8",
    );
    const layoutRule = workspaceLayoutCssRule(
      ".app-workspace-layout.ant-layout",
    );

    expect(source).toContain("width={300}");
    expect(source).toContain("size={300}");
    expect(layoutRule).toContain("--workspace-sider-width: 300px;");
  });

  it("keeps the responsive workspace logo 68px tall", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/app/WorkspaceShell.tsx"),
      "utf8",
    );
    const mobileBrandRule = cssRule(".app-workspace-mobile-brand");
    const mobileLogoRule = cssRule(
      ".app-workspace-mobile-brand .brand-logo__image",
    );

    expect(source).toContain("<BrandLogo height={68} />");
    expect(mobileBrandRule).toContain("height: 68px;");
    expect(mobileBrandRule).toContain("justify-content: center;");
    expect(mobileLogoRule).toContain("height: 68px;");
  });

  it("keeps growth dashboard available for free-plan learners", () => {
    const { container } = renderWithIntl(
      <WorkspaceShell
        role="learner"
        userId="user-1"
        email={null}
        planLabel={null}
      >
        <div>body</div>
      </WorkspaceShell>,
    );

    expect(container.querySelector(".app-sidebar-lock-label")).toBeNull();
    expect(container.querySelector(".app-sidebar-lock-icon")).toBeNull();
    expect(container.querySelector(".app-sidebar-lock-tag")).toBeNull();

    fireEvent.click(screen.getAllByText("성장 리포트")[0]);
    fireEvent.click(screen.getAllByText("성장 대시보드")[0]);
    expect(navMock.routerPush).toHaveBeenCalledWith("/growth");
  });

  it("keeps the current nested route group open on direct entry", () => {
    navMock.pathname = "/practice/problems";

    const { container } = renderWithIntl(
      <WorkspaceShell
        role="learner"
        userId="user-1"
        email={null}
        planLabel="premium"
      >
        <div>body</div>
      </WorkspaceShell>,
    );

    expect(hasExpandedMenuItem(container, "문제 풀기")).toBe(true);
    expect(container.textContent).toContain("문제 목록");
  });

  it("lets the user collapse the active group even while a child is selected", () => {
    navMock.pathname = "/practice/problems";

    const { container } = renderWithIntl(
      <WorkspaceShell
        role="learner"
        userId="user-1"
        email={null}
        planLabel="premium"
      >
        <div>body</div>
      </WorkspaceShell>,
    );

    expect(hasExpandedMenuItem(container, "문제 풀기")).toBe(true);

    const groupTitle = Array.from(
      container.querySelectorAll('[role="menuitem"][aria-expanded]'),
    ).find((item) => item.textContent?.includes("문제 풀기")) as HTMLElement;
    fireEvent.click(within(groupTitle).getByText("문제 풀기"));

    expect(hasExpandedMenuItem(container, "문제 풀기")).toBe(false);
  });

  it("opens the writing group for nested writing feedback routes", () => {
    navMock.pathname = "/writing/feedback/short/submission-1";

    const { container } = renderWithIntl(
      <WorkspaceShell
        role="learner"
        userId="user-1"
        email={null}
        planLabel="premium"
      >
        <div>body</div>
      </WorkspaceShell>,
    );

    expect(hasExpandedMenuItem(container, "쓰기 연습")).toBe(true);
  });

  it("applies the flush content chrome only on short feedback detail routes", () => {
    navMock.pathname = "/writing/feedback/short/submission-1";

    const { container } = renderWithIntl(
      <WorkspaceShell
        role="learner"
        userId="user-1"
        email={null}
        planLabel="premium"
      >
        <div>body</div>
      </WorkspaceShell>,
    );

    const content = container.querySelector(".app-workspace-content");
    expect(
      content?.classList.contains("app-workspace-content--feedback-flush"),
    ).toBe(true);
  });

  it("keeps normal workspace content chrome on non-feedback routes", () => {
    navMock.pathname = "/dashboard";

    const { container } = renderWithIntl(
      <WorkspaceShell
        role="learner"
        userId="user-1"
        email={null}
        planLabel="premium"
      >
        <div>body</div>
      </WorkspaceShell>,
    );

    const content = container.querySelector(".app-workspace-content");
    expect(
      content?.classList.contains("app-workspace-content--feedback-flush"),
    ).toBe(false);
  });

  it("opens settings for profile direct entry because profile is an account setting", () => {
    navMock.pathname = "/profile";

    const { container } = renderWithIntl(
      <WorkspaceShell
        role="learner"
        userId="user-1"
        email={null}
        planLabel="premium"
      >
        <div>body</div>
      </WorkspaceShell>,
    );

    expect(hasExpandedMenuItem(container, "설정")).toBe(true);
    expect(container.textContent).toContain("프로필");
  });
});
