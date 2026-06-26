// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspaceShell } from "../../../src/components/app/WorkspaceShell";
import { renderWithIntl } from "../../test-utils/renderWithIntl";
import koMessages from "../../../messages/ko.json";

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
  routerReplace: vi.fn(),
  pathname: "/dashboard",
  authCallback: null as ((event: string) => void) | null,
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
  useRouter: () => ({
    push: navMock.routerPush,
    replace: navMock.routerReplace,
  }),
}));

// WorkspaceShell mounts an onAuthStateChange listener for multi-tab session
// sync. Stub the browser client so the effect has a no-op subscription and no
// real Supabase env is required.
vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      onAuthStateChange: (cb: (event: string) => void) => {
        navMock.authCallback = cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
  }),
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
    navMock.routerReplace.mockClear();
    navMock.pathname = "/dashboard";
    navMock.authCallback = null;
  });

  it("redirects to /login on SIGNED_OUT (multi-tab/device sync) but ignores INITIAL_SESSION", () => {
    renderWithIntl(
      <WorkspaceShell role="learner" userId="user-1" email={null} planLabel={null}>
        <div>body</div>
      </WorkspaceShell>,
    );

    expect(navMock.authCallback).toBeTypeOf("function");
    navMock.authCallback?.("INITIAL_SESSION");
    expect(navMock.routerReplace).not.toHaveBeenCalled();

    navMock.authCallback?.("SIGNED_OUT");
    expect(navMock.routerReplace).toHaveBeenCalledWith("/login");
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

  it("groups the notification bell inside the user summary pill", () => {
    const { container } = renderWithIntl(
      <WorkspaceShell
        role="learner"
        userId="user-1"
        email="student@example.com"
        displayName="Chan"
        nickname="talkpik-chan"
        planLabel="premium"
      >
        <div>body</div>
      </WorkspaceShell>,
    );

    const summary = container.querySelector(".app-workspace-user-summary");
    const actionGroup = summary?.closest(
      ".app-notification-corner, .app-workspace-mobile-actions",
    );
    const divider = actionGroup?.querySelector(
      ".app-workspace-user-summary__divider",
    );
    const bell = actionGroup?.querySelector(".app-notification-bell");

    expect(summary).toBeTruthy();
    expect(actionGroup).toBeTruthy();
    expect(divider).toBeTruthy();
    expect(bell).toBeTruthy();
    if (!summary || !actionGroup || !divider || !bell) {
      throw new Error("user summary action group is incomplete");
    }
    expect(actionGroup.contains(summary)).toBe(true);
    expect(actionGroup.contains(divider)).toBe(true);
    expect(actionGroup.contains(bell)).toBe(true);
    expect(summary?.querySelector(".ant-avatar")).toBeTruthy();
    expect(summary?.textContent).toContain("talkpik-chan");
    expect(summary?.textContent).toContain("student@example.com");
    expect(cssRule(".app-notification-corner")).not.toContain("height:");
    expect(cssRule(".app-notification-corner")).toContain("gap: 0");
    expect(cssRule(".app-notification-corner")).toContain("padding: 8px");
    expect(cssRule(".app-workspace-mobile-actions")).toContain(
      "padding: 8px",
    );
    expect(cssRule(".app-workspace-user-summary__divider")).toContain(
      "height: 60%",
    );
    expect(
      cssRule(".app-notification-corner .app-notification-bell"),
    ).toContain("border: 0");
    expect(
      cssRule(".app-notification-corner .app-notification-bell"),
    ).toContain("box-shadow: none");
    expect(
      cssRule(".app-notification-corner .app-notification-bell:hover"),
    ).toContain("background: transparent");
    expect(
      cssRule(".app-notification-corner .app-notification-bell:hover"),
    ).toContain("box-shadow: none");
  });

  it("opens profile actions in a notification-style popover", async () => {
    const { container } = renderWithIntl(
      <WorkspaceShell
        role="learner"
        userId="user-1"
        email="student@example.com"
        displayName="Chan"
        nickname="talkpik-chan"
        planLabel="premium"
      >
        <div>body</div>
      </WorkspaceShell>,
    );

    const profileTrigger = within(container).getByRole("button", {
      name: koMessages.app.userSummary,
    });
    const popoverItem = (label: string) => {
      const item = Array.from(
        document.body.querySelectorAll(
          ".app-profile-popover-panel [role='menuitem']",
        ),
      ).find((candidate) => candidate.textContent?.includes(label));
      if (!item) throw new Error(`profile popover item not found: ${label}`);
      return item;
    };

    fireEvent.click(profileTrigger);
    await waitFor(() => {
      const panel = document.body.querySelector(".app-profile-popover-panel");
      expect(panel).toBeTruthy();
      expect(panel?.closest(".app-profile-popover")).toBeTruthy();
      expect(panel?.closest(".app-notification-popover")).toBeTruthy();
      expect(
        panel?.querySelector(".app-profile-popover-panel__header"),
      ).toBeNull();
      expect(
        panel?.querySelector(".app-profile-popover-list"),
      ).toBeTruthy();
      expect(panel?.querySelector(".ant-list")).toBeNull();
      expect(panel?.textContent).not.toContain("talkpik-chan");
      expect(panel?.textContent).not.toContain("student@example.com");
    });
    fireEvent.click(popoverItem(koMessages.nav.profile));

    expect(navMock.routerPush).toHaveBeenCalledWith("/profile");

    fireEvent.click(profileTrigger);
    await waitFor(() => expect(popoverItem(koMessages.nav.settingsLearning)));
    fireEvent.click(popoverItem(koMessages.nav.settingsLearning));

    expect(navMock.routerPush).toHaveBeenCalledWith("/settings/learning");

    const signOutForm = container.querySelector(".app-profile-menu-signout");
    expect(signOutForm).toBeTruthy();
    expect(signOutForm?.getAttribute("method")).toBe("post");
    expect(signOutForm?.getAttribute("action")).toBe("/auth/sign-out");
    fireEvent.click(profileTrigger);
    await waitFor(() => expect(popoverItem(koMessages.nav.logout)));
    const logoutAction = popoverItem(koMessages.nav.logout);
    expect(logoutAction).toBeTruthy();
    expect(
      logoutAction.classList.contains("app-profile-popover-action--danger"),
    ).toBe(false);
    expect(cssRule(".app-profile-popover-panel")).toContain("font-size: 14px");
    expect(
      cssRule(".app-profile-popover-list .app-profile-popover-item"),
    ).toContain("list-style: none");
    expect(cssRule(".app-profile-popover-list")).toContain("display: grid");
    expect(cssRule(".app-profile-popover-actions")).toBe("");
    expect(cssRule(".app-profile-popover-panel__header")).toBe("");
    expect(cssRule(".app-profile-popover-action")).toContain(
      "padding: 8px 0",
    );
    expect(cssRule(".app-profile-popover-action")).toContain(
      "font-size: 14px",
    );
    expect(cssRule(".app-profile-popover-action::before")).toContain(
      "background: var(--app-color-bg-layout)",
    );
    expect(cssRule(".app-profile-popover-action::before")).toContain(
      "z-index: 0",
    );
    expect(cssRule(".app-profile-popover-action__label")).toContain(
      "position: relative",
    );
    expect(cssRule(".app-profile-popover-action__label")).toContain(
      "z-index: 1",
    );
    expect(cssRule(".app-profile-popover-action--danger")).toBe("");
  });

  it("renders Iconsax icons in the sidebar menu", () => {
    const { container } = renderWithIntl(
      <WorkspaceShell
        role="learner"
        userId="user-1"
        email="learner@example.com"
        planLabel="premium"
      >
        <div>body</div>
      </WorkspaceShell>,
    );

    const sidebarMenu = container.querySelector(".app-sidebar-menu");

    expect(
      sidebarMenu?.querySelectorAll('[data-sidebar-icon-library="iconsax"]'),
    ).toHaveLength(6);
    expect(
      sidebarMenu?.querySelectorAll('[data-sidebar-icon-kind="svg"]'),
    ).toHaveLength(6);

    const growthItem = Array.from(
      sidebarMenu?.querySelectorAll(".ant-menu-item, .ant-menu-submenu-title") ??
        [],
    ).find((item) => item.textContent?.includes("성장 리포트"));

    expect(
      growthItem?.querySelector('[data-sidebar-icon-name="DocumentText"]'),
    ).toBeTruthy();

    expect(growthItem).toBeTruthy();
    fireEvent.click(growthItem as Element);
    expect(
      sidebarMenu?.querySelector('[data-sidebar-icon-name="Chart2"]'),
    ).toBeTruthy();
  });

  it("uses the requested problem-type icons for writing practice leaves", () => {
    const { container } = renderWithIntl(
      <WorkspaceShell
        role="learner"
        userId="user-1"
        email="learner@example.com"
        planLabel="premium"
      >
        <div>body</div>
      </WorkspaceShell>,
    );

    const sidebarMenu = container.querySelector(".app-sidebar-menu");
    const writingTitle = sidebarMenu?.querySelector(
      '[data-menu-id="rc-menu-uuid-writing"]',
    );

    expect(writingTitle).toBeTruthy();
    fireEvent.click(writingTitle as Element);

    expect(
      sidebarMenu?.querySelector('[data-sidebar-icon-name="DirectboxNotif"]'),
    ).toBeTruthy();
    expect(
      sidebarMenu?.querySelector('[data-sidebar-icon-name="ProgrammingArrows"]'),
    ).toBeTruthy();
    expect(
      sidebarMenu?.querySelector('[data-sidebar-icon-name="PresentationChart"]'),
    ).toBeTruthy();
    expect(
      sidebarMenu?.querySelector('[data-sidebar-icon-name="DocumentText"]'),
    ).toBeTruthy();
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
    expect(
      container
        .querySelector<HTMLImageElement>(".app-sidebar-brand img")
        ?.getAttribute("loading"),
    ).toBe("eager");
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

  it("sets sidebar icon spacing", () => {
    const appIconRule = cssRule(".app-sidebar-icon");
    const iconRule = cssRule(".app-sidebar-menu.ant-menu .ant-menu-item-icon");
    const titleRule = cssRule(
      ".app-sidebar-menu.ant-menu .ant-menu-title-content",
    );

    expect(appIconRule).toContain("margin-inline-end: 8px;");
    expect(iconRule).toContain("margin-inline-end: 8px;");
    expect(titleRule).toContain("margin-inline-start: 0;");
    expect(GLOBAL_CSS).not.toContain("@keyframes app-sidebar-icon-hover");
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

  it("keeps the responsive workspace logo 48px tall", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/app/WorkspaceShell.tsx"),
      "utf8",
    );
    const mobileBrandRule = cssRule(".app-workspace-mobile-brand");
    const mobileLogoRule = cssRule(
      ".app-workspace-mobile-brand .brand-logo__image",
    );

    expect(source).toContain('<BrandLogo height={48} loading="eager" />');
    expect(mobileBrandRule).toContain("height: 48px;");
    expect(mobileBrandRule).toContain("justify-content: center;");
    expect(mobileLogoRule).toContain("height: 48px;");
  });

  it("pins the mobile GNB to the top and aligns its icons to the content edge", () => {
    const stickyRule = cssRulesFrom(GLOBAL_CSS, ".app-workspace-mobile-bar")
      .find((body) => body.includes("position: sticky;"));
    const headerRule = cssRule(".app-workspace-mobile-bar.ant-layout-header");

    expect(stickyRule).toBeTruthy();
    expect(stickyRule).toContain("top: 0;");
    expect(headerRule).toContain("padding-inline: 6px;");
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

  it("opens settings for separated account and learning setting routes", () => {
    navMock.pathname = "/settings/account";

    const account = renderWithIntl(
      <WorkspaceShell
        role="learner"
        userId="user-1"
        email={null}
        planLabel="premium"
      >
        <div>body</div>
      </WorkspaceShell>,
    );

    expect(hasExpandedMenuItem(account.container, "설정")).toBe(true);
    expect(account.container.textContent).toContain("계정");
    account.unmount();

    navMock.pathname = "/settings/learning";

    const learning = renderWithIntl(
      <WorkspaceShell
        role="learner"
        userId="user-1"
        email={null}
        planLabel="premium"
      >
        <div>body</div>
      </WorkspaceShell>,
    );

    expect(hasExpandedMenuItem(learning.container, "설정")).toBe(true);
    expect(learning.container.textContent).toContain("학습 목표");
  });
});
