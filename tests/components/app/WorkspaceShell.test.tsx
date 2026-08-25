// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import postcss from "postcss";

import { WorkspaceShell } from "../../../src/components/app/WorkspaceShell";
import workspaceShellStyles from "../../../src/components/app/WorkspaceShell.module.css";
import { renderWithIntl } from "../../test-utils/renderWithIntl";
import koMessages from "../../../messages/ko.json";

const GLOBAL_CSS_PATH = join(process.cwd(), "src/styles/global.css");
const GLOBAL_CSS = readFileSync(GLOBAL_CSS_PATH, "utf8");
const WORKSPACE_LAYOUT_CSS = readFileSync(
  join(process.cwd(), "src/styles/workspace-layout.css"),
  "utf8",
);
const SIDEBAR_NAV_SOURCE = readFileSync(
  join(process.cwd(), "src/components/app/SidebarNav.tsx"),
  "utf8",
);
const SIDEBAR_NAV_CSS_PATH = join(
  process.cwd(),
  "src/components/app/SidebarNav.module.css",
);
const SIDEBAR_NAV_CSS = existsSync(SIDEBAR_NAV_CSS_PATH)
  ? readFileSync(SIDEBAR_NAV_CSS_PATH, "utf8")
  : "";
const WORKSPACE_SHELL_CSS_PATH = join(
  process.cwd(),
  "src/components/app/WorkspaceShell.module.css",
);
const WORKSPACE_SHELL_CSS = existsSync(WORKSPACE_SHELL_CSS_PATH)
  ? readFileSync(WORKSPACE_SHELL_CSS_PATH, "utf8")
  : "";
const PROFILE_POPOVER_MODULE_RULES = [
  [".profilePopoverPanel", "width: 240px; max-width: 72vw; font-size: 14px;"],
  [
    ".profilePopover.profilePopover :global(.ant-popover-container)",
    "padding: 0;",
  ],
  [".profilePopoverPanel :global(.ant-typography)", "font-size: 14px;"],
  [".profilePopoverList", "display: grid; margin: 0; padding: 8px;"],
  [".profilePopoverList .profilePopoverItem", "list-style: none;"],
] as const;
const PROFILE_POPOVER_STABLE_STRUCTURE_CLASSES = [
  "app-profile-popover",
  "app-profile-popover-panel",
  "app-profile-popover-list",
  "app-profile-popover-item",
] as const;
const PROFILE_POPOVER_LOCAL_CLASSES = [
  "profilePopover",
  "profilePopoverPanel",
  "profilePopoverList",
  "profilePopoverItem",
] as const;

const navMock = vi.hoisted(() => ({
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
  pathname: "/dashboard",
  authCallback: null as
    | ((event: string, session?: { user: { id: string } } | null) => void)
    | null,
}));
const recoveryCleanupMock = vi.hoisted(() => vi.fn());
const sessionBoundaryMocks = vi.hoisted(() => ({
  clearCache: vi.fn(),
  replaceDocument: vi.fn(),
}));
type WritingAvailabilityMockValue = {
  data:
    | {
        availableTypes: Set<number>;
        lockedTypes: Set<number>;
        hasAny: boolean;
      }
    | undefined;
  isLoading: boolean;
  error: Error | null;
};
const writingAvailabilityMock = vi.hoisted(() => ({
  value: {
    data: {
      availableTypes: new Set([51, 52, 53, 54]),
      lockedTypes: new Set(),
      hasAny: true,
    },
    isLoading: false,
    error: null,
  } as WritingAvailabilityMockValue,
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

function cssSelectorsFrom(source: string) {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//gu, "");
  const rulePreludes = withoutComments.matchAll(/([^{}]+)\{/gu);

  return Array.from(rulePreludes, (match) => match[1]?.trim() ?? "")
    .filter((prelude) => prelude && !prelude.startsWith("@"))
    .flatMap((prelude) =>
      prelude.split(",").map((selector) => selector.trim()),
    );
}

function compactCssRule(source: string, selector: string) {
  return cssRuleFrom(source, selector).replace(/\s+/gu, " ").trim();
}

function normalizeCssSelector(selector: string) {
  return selector
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/\s*([,>+~])\s*/gu, "$1")
    .replace(/\(\s+/gu, "(")
    .replace(/\s+\)/gu, ")");
}

function normalizeCssAtRule(atRule: string) {
  return normalizeCssSelector(atRule)
    .replace(/^(@[\w-]+)\s*\(/u, "$1(")
    .replace(/\s*:\s*/gu, ":");
}

function splitCssSelectors(selector: string) {
  const selectors: string[] = [];
  let start = 0;
  let parentheses = 0;
  let brackets = 0;
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < selector.length; index += 1) {
    const character = selector[index];
    const previous = selector[index - 1];

    if (quote) {
      if (character === quote && previous !== "\\") quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "(") parentheses += 1;
    if (character === ")") parentheses = Math.max(0, parentheses - 1);
    if (character === "[") brackets += 1;
    if (character === "]") brackets = Math.max(0, brackets - 1);
    if (character === "," && parentheses === 0 && brackets === 0) {
      selectors.push(normalizeCssSelector(selector.slice(start, index)));
      start = index + 1;
    }
  }

  selectors.push(normalizeCssSelector(selector.slice(start)));
  return selectors.filter(Boolean);
}

function canonicalDeclarations(source: string) {
  return source
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const separator = declaration.indexOf(":");
      return [
        declaration.slice(0, separator).trim().toLowerCase(),
        declaration
          .slice(separator + 1)
          .replace(/\s+/gu, " ")
          .trim(),
      ] as const;
    })
    .sort(([leftName, leftValue], [rightName, rightValue]) =>
      `${leftName}:${leftValue}`.localeCompare(`${rightName}:${rightValue}`),
    );
}

type ParsedCssRule = {
  atRules: string[];
  declarations: string;
  depth: number;
  selector: string;
  selectors: string[];
};

function parseCssRules(source: string): ParsedCssRule[] {
  const rules: ParsedCssRule[] = [];

  postcss.parse(source).walkRules((rule) => {
    const atRules: string[] = [];
    let depth = 0;
    let parent = rule.parent;
    while (parent && parent.type !== "root") {
      depth += 1;
      if (parent.type === "atrule") {
        atRules.unshift(
          normalizeCssAtRule(
            `@${parent.name}${parent.params ? ` ${parent.params}` : ""}`,
          ),
        );
      }
      parent = parent.parent;
    }

    const selector = normalizeCssSelector(rule.selector);
    rules.push({
      atRules,
      declarations: (rule.nodes ?? [])
        .filter((node) => node.type === "decl")
        .map(
          (node) =>
            `${node.prop}: ${node.value}${node.important ? " !important" : ""};`,
        )
        .join(" "),
      depth,
      selector,
      selectors: splitCssSelectors(selector),
    });
  });

  return rules;
}

function selectorContainsClass(selector: string, className: string) {
  const decodedSelector = selector.replace(
    /\\(?:([0-9a-f]{1,6})(?:\r\n|[\t\n\f\r ])?|([^\r\n\f0-9a-f]))/giu,
    (_match, hexadecimal: string | undefined, escaped: string | undefined) =>
      hexadecimal
        ? String.fromCodePoint(Number.parseInt(hexadecimal, 16))
        : (escaped ?? ""),
  );
  const escapedClassName = className.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  if (
    new RegExp(`\\.${escapedClassName}(?![\\w-])`, "u").test(decodedSelector)
  ) {
    return true;
  }

  const classAttributePattern =
    /\[\s*class\s*(=|~=|\|=|\^=|\$=|\*=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+))\s*([is])?\s*\]/giu;
  return Array.from(decodedSelector.matchAll(classAttributePattern)).some(
    (match) => {
      const operator = match[1];
      const value = match[2] ?? match[3] ?? match[4] ?? "";
      const caseInsensitive = match[5]?.toLowerCase() === "i";
      const comparableClassName = caseInsensitive
        ? className.toLowerCase()
        : className;
      const comparableValue = caseInsensitive ? value.toLowerCase() : value;

      if (operator === "=" || operator === "~=") {
        return comparableClassName === comparableValue;
      }
      if (operator === "^=") {
        return comparableClassName.startsWith(comparableValue);
      }
      if (operator === "$=") {
        return comparableClassName.endsWith(comparableValue);
      }
      if (operator === "*=") {
        return comparableClassName.includes(comparableValue);
      }
      if (operator === "|=") {
        return (
          comparableClassName === comparableValue ||
          comparableClassName.startsWith(`${comparableValue}-`)
        );
      }
      return false;
    },
  );
}

function profilePopoverModuleContractViolations(source: string) {
  const profileRules = parseCssRules(source).filter((rule) =>
    rule.selectors.some((selector) =>
      PROFILE_POPOVER_LOCAL_CLASSES.some((className) =>
        selectorContainsClass(selector, className),
      ),
    ),
  );
  const isExactAllowedRule = (
    rule: ParsedCssRule,
    selector: string,
    declarations: string,
  ) =>
    rule.depth === 0 &&
    rule.atRules.length === 0 &&
    rule.selectors.length === 1 &&
    rule.selector === normalizeCssSelector(selector) &&
    JSON.stringify(canonicalDeclarations(rule.declarations)) ===
      JSON.stringify(canonicalDeclarations(declarations));
  const violations: string[] = [];

  for (const [selector, declarations] of PROFILE_POPOVER_MODULE_RULES) {
    const matchCount = profileRules.filter((rule) =>
      isExactAllowedRule(rule, selector, declarations),
    ).length;
    if (matchCount !== 1) {
      violations.push(
        `module rule count: ${selector} expected 1, received ${matchCount}`,
      );
    }
  }
  for (const rule of profileRules) {
    const allowed = PROFILE_POPOVER_MODULE_RULES.some(
      ([selector, declarations]) =>
        isExactAllowedRule(rule, selector, declarations),
    );
    if (!allowed) {
      violations.push(
        `unexpected module rule: depth=${rule.depth} ${[
          ...rule.atRules,
          rule.selector,
        ].join(" > ")}`,
      );
    }
  }

  return violations;
}

function globalProfileStructureOwners(source: string) {
  const selectors = parseCssRules(source).flatMap((rule) => rule.selectors);
  return PROFILE_POPOVER_STABLE_STRUCTURE_CLASSES.filter((className) =>
    selectors.some((selector) => selectorContainsClass(selector, className)),
  );
}

type CssRuntimeSource = { path: string; source: string };

function localCssImportPath(params: string) {
  const urlMatch = params
    .trim()
    .match(/^url\(\s*(?:"([^"]+)"|'([^']+)'|([^)'"\s]+))\s*\)/u);
  if (urlMatch) return urlMatch[1] ?? urlMatch[2] ?? urlMatch[3] ?? null;

  const quotedMatch = params.trim().match(/^(?:"([^"]+)"|'([^']+)')/u);
  return quotedMatch?.[1] ?? quotedMatch?.[2] ?? null;
}

function readGlobalCssRuntimeSources(
  entryPath: string,
  visited = new Set<string>(),
): CssRuntimeSource[] {
  const resolvedEntryPath = resolve(entryPath);
  if (visited.has(resolvedEntryPath)) return [];
  visited.add(resolvedEntryPath);

  const source = readFileSync(resolvedEntryPath, "utf8");
  const importedSources: CssRuntimeSource[] = [];
  postcss.parse(source).walkAtRules("import", (atRule) => {
    const importPath = localCssImportPath(atRule.params);
    if (!importPath?.startsWith(".")) return;
    importedSources.push(
      ...readGlobalCssRuntimeSources(
        resolve(dirname(resolvedEntryPath), importPath),
        visited,
      ),
    );
  });

  return [{ path: resolvedEntryPath, source }, ...importedSources];
}

function globalProfileStructureOwnersInSources(sources: CssRuntimeSource[]) {
  return sources.flatMap(({ path, source }) =>
    globalProfileStructureOwners(source).map(
      (className) => `${path}: ${className}`,
    ),
  );
}

const GLOBAL_CSS_RUNTIME_SOURCES = readGlobalCssRuntimeSources(GLOBAL_CSS_PATH);

vi.mock("next/navigation", () => ({
  usePathname: () => navMock.pathname,
  useRouter: () => ({
    push: navMock.routerPush,
    replace: navMock.routerReplace,
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => ({ clear: sessionBoundaryMocks.clearCache }),
  };
});

vi.mock("@/lib/auth/workspace-session-navigation", () => ({
  replaceWorkspaceDocument: sessionBoundaryMocks.replaceDocument,
}));

// WorkspaceShell mounts an onAuthStateChange listener for multi-tab session
// sync. Stub the browser client so the effect has a no-op subscription and no
// real Supabase env is required.
vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      onAuthStateChange: (
        cb: (event: string, session?: { user: { id: string } } | null) => void,
      ) => {
        navMock.authCallback = cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
  }),
}));

vi.mock("@/lib/writing/client-recovery-cleanup", () => ({
  clearClientRecoveryForLogout: recoveryCleanupMock,
}));

vi.mock("@/components/practice/writing-availability-data", () => ({
  useWritingAvailability: () => writingAvailabilityMock.value,
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

function sidebarMenuItemByLabel(container: HTMLElement, label: string) {
  return Array.from(
    container.querySelectorAll(".app-sidebar-menu .ant-menu-item"),
  ).find((item) => item.textContent?.includes(label));
}

describe("WorkspaceShell", () => {
  beforeEach(() => {
    navMock.routerPush.mockClear();
    navMock.routerReplace.mockClear();
    navMock.pathname = "/dashboard";
    navMock.authCallback = null;
    sessionBoundaryMocks.clearCache.mockReset();
    sessionBoundaryMocks.replaceDocument.mockReset();
    recoveryCleanupMock.mockReset();
    recoveryCleanupMock.mockResolvedValue(true);
    window.sessionStorage.clear();
    writingAvailabilityMock.value = {
      data: {
        availableTypes: new Set([51, 52, 53, 54]),
        lockedTypes: new Set(),
        hasAny: true,
      },
      isLoading: false,
      error: null,
    };
  });

  afterEach(() => {
    cleanup();
  });

  it("clears cached user data before login navigation on SIGNED_OUT but ignores a matching initial session", () => {
    renderWithIntl(
      <WorkspaceShell
        role="learner"
        userId="user-1"
        email={null}
        planLabel={null}
      >
        <div data-testid="workspace-session-child">body</div>
      </WorkspaceShell>,
    );

    expect(navMock.authCallback).toBeTypeOf("function");
    navMock.authCallback?.("INITIAL_SESSION", { user: { id: "user-1" } });
    expect(navMock.routerReplace).not.toHaveBeenCalled();
    expect(sessionBoundaryMocks.clearCache).not.toHaveBeenCalled();

    act(() => {
      navMock.authCallback?.("SIGNED_OUT", null);
      expect(screen.queryByTestId("workspace-session-child")).toBeNull();
    });
    expect(sessionBoundaryMocks.clearCache).toHaveBeenCalledTimes(1);
    expect(navMock.routerReplace).toHaveBeenCalledWith("/login");
    expect(
      sessionBoundaryMocks.clearCache.mock.invocationCallOrder[0],
    ).toBeLessThan(navMock.routerReplace.mock.invocationCallOrder[0]);
  });

  it("fails closed and reloads the full document when the browser session changes users", () => {
    renderWithIntl(
      <WorkspaceShell
        role="learner"
        userId="user-a"
        email={null}
        planLabel={null}
      >
        <div data-testid="workspace-session-child">user A data</div>
      </WorkspaceShell>,
    );

    expect(screen.getByTestId("workspace-session-child")).toBeTruthy();

    act(() => {
      navMock.authCallback?.("SIGNED_IN", { user: { id: "user-b" } });
      expect(screen.queryByTestId("workspace-session-child")).toBeNull();
    });

    expect(sessionBoundaryMocks.clearCache).toHaveBeenCalledTimes(1);
    expect(sessionBoundaryMocks.replaceDocument).toHaveBeenCalledTimes(1);
    expect(navMock.routerReplace).not.toHaveBeenCalled();
  });

  it("renders an app-owned workspace aside while keeping AppHeader unused", () => {
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

    const workspaceLayout = container.querySelector(".app-workspace-layout");
    const workspaceSider = container.querySelector("aside.app-workspace-sider");

    expect(workspaceLayout).toBeTruthy();
    expect(workspaceLayout?.classList.contains("ant-layout-has-sider")).toBe(
      true,
    );
    expect(workspaceSider).toBeTruthy();
    expect(container.querySelector(".ant-layout-sider")).toBeNull();
    expect(container.querySelector(".ant-layout-sider-children")).toBeNull();
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
    expect(cssRule(".app-workspace-mobile-actions")).toContain("padding: 8px");
    expect(cssRule(".app-workspace-user-summary__divider")).toContain(
      "height: 60%",
    );
    expect(
      cssRule(".app-notification-corner .app-notification-bell"),
    ).toContain("border: 0");
    expect(
      cssRule(".app-notification-corner .app-notification-bell"),
    ).not.toContain("box-shadow:");
    expect(
      cssRule(".app-notification-corner .app-notification-bell:hover"),
    ).toContain("background: transparent");
    expect(
      cssRule(".app-notification-corner .app-notification-bell:hover"),
    ).not.toContain("box-shadow:");
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
      const popover = panel?.closest(".app-profile-popover");
      const list = panel?.querySelector(".app-profile-popover-list");
      const item = list?.querySelector(".app-profile-popover-item");
      expect(panel).toBeTruthy();
      expect(popover).toBeTruthy();
      expect(panel?.closest(".app-notification-popover")).toBeTruthy();
      expect(
        panel?.classList.contains(workspaceShellStyles.profilePopoverPanel),
      ).toBe(true);
      expect(
        popover?.classList.contains(workspaceShellStyles.profilePopover),
      ).toBe(true);
      expect(
        list?.classList.contains(workspaceShellStyles.profilePopoverList),
      ).toBe(true);
      expect(
        item?.classList.contains(workspaceShellStyles.profilePopoverItem),
      ).toBe(true);
      expect(
        panel?.querySelector(".app-profile-popover-panel__header"),
      ).toBeNull();
      expect(panel?.querySelector(".app-profile-popover-list")).toBeTruthy();
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
    expect(profilePopoverModuleContractViolations(WORKSPACE_SHELL_CSS)).toEqual(
      [],
    );
    expect(
      globalProfileStructureOwnersInSources(GLOBAL_CSS_RUNTIME_SOURCES),
    ).toEqual([]);
    expect(GLOBAL_CSS_RUNTIME_SOURCES.map(({ path }) => path)).toContain(
      resolve(dirname(GLOBAL_CSS_PATH), "foundation.css"),
    );
    expect(cssRule(".app-profile-popover-actions")).toBe("");
    expect(cssRule(".app-profile-popover-panel__header")).toBe("");
    expect(cssRule(".app-profile-popover-action")).toContain(
      "padding: 8px 12px",
    );
    expect(cssRule(".app-profile-popover-action")).toContain("font-size: 14px");
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

  it("rejects grouped, high-specificity, nested, media, and duplicate profile module overrides", () => {
    const validRules = PROFILE_POPOVER_MODULE_RULES.map(
      ([selector, declarations]) => `${selector} { ${declarations} }`,
    ).join("\n");
    const reviewerCounterexamples = [
      ".profilePopoverPanel, .other { width: 999px; }",
      ".profilePopoverPanel.profilePopoverPanel { width: 999px; }",
      ".wrapper { .profilePopoverPanel { width: 999px; } }",
      "@media (max-width: 700px) { .profilePopoverPanel { width: 999px; } }",
      ".profilePopoverPanel { width: 240px; max-width: 72vw; font-size: 14px; }",
    ];

    for (const reviewerCounterexample of reviewerCounterexamples) {
      expect(
        profilePopoverModuleContractViolations(
          `${validRules}\n${reviewerCounterexample}`,
        ),
        reviewerCounterexample,
      ).not.toEqual([]);
    }
  });

  it("finds high-specificity, nested, attribute, and escaped global profile structure owners", () => {
    const reviewerCounterexampleSources = [
      {
        path: "global.css",
        source: `
          .app-profile-popover-panel.app-profile-popover-panel { width: 999px; }
          body { & .app-profile-popover-list { display: block; } }
        `,
      },
      {
        path: "imported.css",
        source: `
          [class~="app-profile-popover-item"] { list-style: square; }
          [class*="profile-popover-panel"] { width: 999px; }
          [class~="app-profile-popover-action"] { color: inherit; }
          .app\\2d profile\\2d popover { padding: 20px; }
        `,
      },
    ];

    expect(
      globalProfileStructureOwnersInSources(reviewerCounterexampleSources),
    ).toEqual([
      "global.css: app-profile-popover-panel",
      "global.css: app-profile-popover-list",
      "imported.css: app-profile-popover",
      "imported.css: app-profile-popover-panel",
      "imported.css: app-profile-popover-item",
    ]);
    expect(
      selectorContainsClass(
        '[class~="app-profile-popover-action"]',
        "app-profile-popover",
      ),
    ).toBe(false);
    expect(
      selectorContainsClass(
        '[class^="app-profile-"]',
        "app-profile-popover-panel",
      ),
    ).toBe(true);
    expect(
      selectorContainsClass(
        '[class$="popover-panel"]',
        "app-profile-popover-panel",
      ),
    ).toBe(true);
    expect(
      selectorContainsClass(
        '[class|="app-profile"]',
        "app-profile-popover-panel",
      ),
    ).toBe(true);
    expect(
      selectorContainsClass(
        '[class="APP-PROFILE-POPOVER-PANEL" i]',
        "app-profile-popover-panel",
      ),
    ).toBe(true);
  });

  it("clears eligible local recovery data before profile-menu sign-out", async () => {
    const nativeSubmit = vi
      .spyOn(HTMLFormElement.prototype, "submit")
      .mockImplementation(() => undefined);
    const { container } = renderWithIntl(
      <WorkspaceShell
        role="learner"
        userId="user-1"
        email="student@example.com"
        nickname="talkpik-chan"
      >
        <div>body</div>
      </WorkspaceShell>,
    );

    fireEvent.click(
      within(container).getByRole("button", {
        name: koMessages.app.userSummary,
      }),
    );
    const logout = await waitFor(() => {
      const item = Array.from(
        document.body.querySelectorAll(
          ".app-profile-popover-panel [role='menuitem']",
        ),
      ).find((candidate) =>
        candidate.textContent?.includes(koMessages.nav.logout),
      );
      expect(item).toBeTruthy();
      return item as HTMLElement;
    });
    fireEvent.click(logout);

    await waitFor(() =>
      expect(recoveryCleanupMock).toHaveBeenCalledWith("user-1"),
    );
    expect(nativeSubmit).toHaveBeenCalledOnce();
    nativeSubmit.mockRestore();
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
    expect(
      sidebarMenu?.querySelectorAll(".app-sidebar-icon.ant-menu-item-icon"),
    ).toHaveLength(6);

    const growthItem = Array.from(
      sidebarMenu?.querySelectorAll(
        ".ant-menu-item, .ant-menu-submenu-title",
      ) ?? [],
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
      sidebarMenu?.querySelector(
        '[data-sidebar-icon-name="ProgrammingArrows"]',
      ),
    ).toBeTruthy();
    expect(
      sidebarMenu?.querySelector(
        '[data-sidebar-icon-name="PresentationChart"]',
      ),
    ).toBeTruthy();
    expect(
      sidebarMenu?.querySelector('[data-sidebar-icon-name="DocumentText"]'),
    ).toBeTruthy();
  });

  it("does not mark writing practice leaves unavailable before availability resolves", () => {
    writingAvailabilityMock.value = {
      data: undefined,
      isLoading: true,
      error: null,
    };

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
    fireEvent.click(writingTitle as Element);

    expect(container.querySelector(".app-sidebar-lock-label")).toBeNull();
    expect(container.querySelector(".app-sidebar-lock-icon")).toBeNull();
    expect(container.querySelector(".app-sidebar-lock-tag")).toBeNull();
  });

  it("keeps unavailable writing practice leaves disabled without an unavailable tag", () => {
    writingAvailabilityMock.value = {
      data: {
        availableTypes: new Set([51, 52, 53]),
        lockedTypes: new Set([54]),
        hasAny: true,
      },
      isLoading: false,
      error: null,
    };

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

    const writing53 = sidebarMenuItemByLabel(
      container,
      koMessages.nav.writing53,
    );
    const writing54 = sidebarMenuItemByLabel(
      container,
      koMessages.nav.writing54,
    );

    expect(writing53).toBeTruthy();
    expect(writing53?.classList.contains("ant-menu-item-disabled")).toBe(false);
    expect(writing54).toBeTruthy();
    expect(writing54?.classList.contains("ant-menu-item-disabled")).toBe(true);
    expect(container.textContent).not.toContain(
      koMessages.nav.writingTypeLocked,
    );
    expect(container.querySelector(".app-sidebar-lock-label")).toBeNull();
    expect(container.querySelector(".app-sidebar-lock-icon")).toBeNull();
    expect(container.querySelector(".app-sidebar-lock-tag")).toBeNull();

    fireEvent.click(writing54 as Element);

    expect(navMock.routerPush).not.toHaveBeenCalledWith(
      "/writing/essay-writing-54",
    );
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

    fireEvent.click(screen.getAllByLabelText("DOTORE TOPIK")[0]);

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

    const brandButton =
      container.querySelector<HTMLButtonElement>(".app-sidebar-brand");
    const logoWrapper = brandButton?.querySelector(".app-sidebar-brand__logo");
    const logoImage = brandButton?.querySelector<HTMLImageElement>("img");

    expect(brandButton?.classList.contains("app-sidebar-brand")).toBe(true);
    expect(brandButton?.classList.length).toBe(2);
    expect(logoWrapper).toBeTruthy();
    expect(logoImage?.classList.contains("brand-logo__image")).toBe(true);
    expect(logoImage?.classList.length).toBe(2);
    expect(decodedImageSrc(logoImage ?? null)).toContain(LOGO_SRC);
    expect(logoImage?.getAttribute("loading")).toBe("eager");
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

  it.each([
    "/writing/short-answer-writing-51",
    "/writing/feedback/short/submission-1",
    "/writing/feedback/long/submission-1",
    "/writing/reports/report-1/compare",
    "/practice/next",
  ])("hides workspace navigation chrome on focus route %s", (pathname) => {
    navMock.pathname = pathname;

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
    expect(
      container
        .querySelector(".app-workspace-layout")
        ?.classList.contains("ant-layout-has-sider"),
    ).toBe(false);
    expect(container.querySelector(".app-sidebar-shell")).toBeNull();
    expect(
      container.querySelector(
        ".app-notification-corner, .app-workspace-mobile-actions",
      ),
    ).toBeNull();
    expect(container.querySelector(".app-workspace-drawer")).toBeNull();
  });

  it("keeps global floating actions on non-focus workspace routes", () => {
    navMock.pathname = "/dashboard";

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

    expect(
      container.querySelector(
        ".app-notification-corner, .app-workspace-mobile-actions",
      ),
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
    expect(contentRule).toContain("background: var(--app-color-bg-container);");
  });

  it("keeps workspace shell scaffolding ownership out of global CSS", () => {
    const { container: normalContainer } = renderWithIntl(
      <WorkspaceShell
        role="learner"
        userId="user-1"
        email="learner@example.com"
        planLabel="premium"
      >
        <div>body</div>
      </WorkspaceShell>,
    );

    navMock.pathname = "/writing/short-answer-writing-51";
    const { container: focusContainer } = renderWithIntl(
      <WorkspaceShell
        role="learner"
        userId="user-1"
        email="learner@example.com"
        planLabel="premium"
      >
        <div>body</div>
      </WorkspaceShell>,
    );

    for (const container of [normalContainer, focusContainer]) {
      expect(
        container.querySelector(".app-workspace-layout.ant-layout"),
      ).toBeTruthy();
      expect(
        container.querySelector(".app-workspace-main.ant-layout"),
      ).toBeTruthy();
    }
    expect(
      focusContainer.querySelector(".app-workspace-layout--exam.ant-layout"),
    ).toBeTruthy();

    const layoutRule = workspaceLayoutCssRule(
      ".app-workspace-layout.ant-layout",
    );
    const mainRule = workspaceLayoutCssRule(".app-workspace-main.ant-layout");

    expect(layoutRule).toContain("min-height: 100vh;");
    expect(layoutRule).toContain("min-height: max(100vh, 100dvh);");
    expect(layoutRule).toContain("background: var(--app-color-bg-layout);");
    expect(mainRule).toContain("min-width: 0;");
    expect(mainRule).toContain("min-height: 100vh;");
    expect(mainRule).toContain("min-height: max(100vh, 100dvh);");
    expect(mainRule).toContain("background: var(--app-color-bg-layout);");

    const globalSelectors = cssSelectorsFrom(GLOBAL_CSS);
    expect(globalSelectors).not.toContain(".app-workspace-layout");
    expect(globalSelectors).not.toContain(".app-workspace-main");
    expect(globalSelectors).not.toContain(
      ".app-workspace-layout--exam .app-workspace-main",
    );
  });

  it("keeps workspace content layout ownership out of global CSS", () => {
    const layoutRule = workspaceLayoutCssRule(
      ".app-workspace-layout.ant-layout",
    );
    const desktopContentRule = workspaceLayoutCssRule(
      ".app-workspace-content.ant-layout-content",
    );
    const mobileContentRule = workspaceLayoutCssRules(
      ".app-workspace-content.ant-layout-content",
    ).find((rule) => rule.includes("padding: 16px;"));
    const desktopExamRule = workspaceLayoutCssRule(
      ".app-workspace-content--exam.ant-layout-content",
    );
    const mobileExamRule = workspaceLayoutCssRules(
      ".app-workspace-content--exam.ant-layout-content",
    ).find((rule) => rule.includes("min-height: 100dvh;"));

    expect(layoutRule).toContain("--workspace-content-padding-block: 24px;");
    expect(desktopContentRule).toContain("min-height: 100vh;");
    expect(desktopContentRule).toContain("min-height: max(100vh, 100dvh);");
    expect(desktopContentRule).toContain(
      "background: var(--app-color-bg-container);",
    );
    expect(desktopContentRule).toContain(
      "padding: var(--workspace-content-padding-block) 24px;",
    );
    expect(mobileContentRule).toContain("padding: 16px;");
    expect(mobileContentRule).toContain(
      "calc(100vh - var(--workspace-mobile-bar-height))",
    );
    expect(mobileContentRule).toContain(
      "calc(100dvh - var(--workspace-mobile-bar-height))",
    );
    expect(desktopExamRule).toContain("min-height: 100vh;");
    expect(desktopExamRule).toContain("min-height: max(100vh, 100dvh);");
    expect(desktopExamRule).toContain(
      "background: var(--app-color-bg-layout);",
    );
    expect(desktopExamRule).toContain("padding: 0;");
    expect(mobileExamRule).toContain("min-height: 100vh;");
    expect(mobileExamRule).toContain("min-height: 100dvh;");
    expect(mobileExamRule).toContain("padding: 0;");
    const globalSelectors = cssSelectorsFrom(GLOBAL_CSS);
    expect(globalSelectors).not.toContain(".app-workspace-content");
    expect(globalSelectors).not.toContain(".app-workspace-content--exam");
  });

  it("finds workspace content selectors at every grouped and responsive position", () => {
    const selectors = cssSelectorsFrom(`
      .app-workspace-content, .other-first { color: red; }
      .other-last, .app-workspace-content--exam { color: blue; }
      @media (max-width: 768px) {
        .app-workspace-content { padding: 16px; }
      }
    `);

    expect(selectors).toContain(".app-workspace-content");
    expect(selectors).toContain(".app-workspace-content--exam");
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

  it("keeps global floating actions on non-focus workspace routes", () => {
    navMock.pathname = "/dashboard";

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

    expect(
      container.querySelector(
        ".app-notification-corner, .app-workspace-mobile-actions",
      ),
    ).toBeTruthy();
  });

  it("keeps the sidebar logo slot 68px tall and centered", () => {
    const brandRule = cssRuleFrom(SIDEBAR_NAV_CSS, ".brand");
    const logoRule = cssRuleFrom(SIDEBAR_NAV_CSS, ".brand .logoImage");

    expect(brandRule).toContain("height: 68px;");
    expect(brandRule).toContain("justify-content: center;");
    expect(brandRule).toContain("text-align: center;");
    expect(logoRule).toContain("width: auto;");
    expect(logoRule).toContain("height: 68px;");
  });

  it("scopes the sidebar brand styles to SidebarNav", () => {
    expect(SIDEBAR_NAV_SOURCE).toContain(
      'import styles from "./SidebarNav.module.css";',
    );
    expect(SIDEBAR_NAV_SOURCE).toContain(
      'className={["app-sidebar-brand", styles.brand].join(" ")}',
    );
    expect(SIDEBAR_NAV_SOURCE).toContain('className="app-sidebar-brand__logo"');
    expect(SIDEBAR_NAV_SOURCE).toContain(
      'imageClassName={[styles.logoImage].join(" ")}',
    );
    expect(cssRuleFrom(SIDEBAR_NAV_CSS, ".brand:hover")).toContain(
      "color: var(--app-color-text);",
    );
    expect(cssRuleFrom(SIDEBAR_NAV_CSS, ".brand:focus-visible")).toContain(
      "outline: 2px solid var(--app-color-primary);",
    );
    expect(GLOBAL_CSS).not.toMatch(/\.app-sidebar-brand\s*\{/u);
    expect(GLOBAL_CSS).not.toMatch(/\.app-sidebar-brand:hover\s*\{/u);
    expect(GLOBAL_CSS).not.toMatch(/\.app-sidebar-brand:focus-visible\s*\{/u);
    expect(GLOBAL_CSS).not.toMatch(
      /\.app-sidebar-brand__logo\s+\.brand-logo__image\s*\{/u,
    );
  });

  it("keeps sidebar base layout ownership out of global CSS", () => {
    const shellRule = workspaceLayoutCssRule(".app-sidebar-shell");
    const scrollRule = workspaceLayoutCssRule(".app-sidebar-menu-scroll");
    const globalSelectors = cssSelectorsFrom(GLOBAL_CSS);

    expect(shellRule).toContain("display: flex;");
    expect(shellRule).toContain("flex-direction: column;");
    expect(shellRule).toContain("height: 100%;");
    expect(shellRule).toContain("min-height: 0;");
    expect(shellRule).toContain("overflow: hidden;");
    expect(shellRule).toContain("padding: 18px 0;");
    expect(shellRule).toContain("background: var(--app-color-bg-container);");
    expect(scrollRule).toContain("flex: 1 1 auto;");
    expect(scrollRule).toContain("min-height: 0;");
    expect(scrollRule).toContain("overflow-x: hidden;");
    expect(scrollRule).toContain("overflow-y: auto;");
    expect(scrollRule).toContain("scrollbar-color: transparent transparent;");
    expect(scrollRule).toContain("scrollbar-gutter: stable;");
    expect(scrollRule).toContain("scrollbar-width: thin;");
    expect(globalSelectors).not.toContain(".app-sidebar-shell");
    expect(globalSelectors).not.toContain(".app-sidebar-menu-scroll");
  });

  it("scopes sidebar decoration styles to SidebarNav", () => {
    const globalSelectors = cssSelectorsFrom(GLOBAL_CSS);
    const formerGlobalSelectors = [
      ".app-sidebar-shell:hover .app-sidebar-menu-scroll",
      ".app-sidebar-menu-scroll::-webkit-scrollbar",
      ".app-sidebar-menu-scroll::-webkit-scrollbar-track",
      ".app-sidebar-menu-scroll::-webkit-scrollbar-thumb",
      ".app-sidebar-shell:hover .app-sidebar-menu-scroll::-webkit-scrollbar-thumb",
      ".app-sidebar-menu.ant-menu",
      ".app-sidebar-shell .app-sidebar-menu.ant-menu-root.ant-menu-inline",
      ".app-sidebar-icon",
    ];

    expect(SIDEBAR_NAV_SOURCE).toContain(
      'className={["app-sidebar-shell", styles.shell].join(" ")}',
    );
    expect(SIDEBAR_NAV_SOURCE).toContain(
      'className={["app-sidebar-menu-scroll", styles.menuScroll].join(" ")}',
    );
    expect(SIDEBAR_NAV_SOURCE).toContain(
      'className={["app-sidebar-menu", styles.menu].join(" ")}',
    );
    expect(SIDEBAR_NAV_SOURCE).toContain(
      'className={["app-sidebar-icon", styles.icon, className]',
    );

    for (const selector of formerGlobalSelectors) {
      expect(globalSelectors).not.toContain(selector);
    }

    expect(compactCssRule(SIDEBAR_NAV_CSS, ".shell:hover .menuScroll")).toBe(
      "scrollbar-color: color-mix( in srgb, var(--app-color-text-secondary) 58%, transparent ) transparent;",
    );
    expect(
      compactCssRule(SIDEBAR_NAV_CSS, ".menuScroll::-webkit-scrollbar"),
    ).toBe("width: 8px;");
    expect(
      compactCssRule(SIDEBAR_NAV_CSS, ".menuScroll::-webkit-scrollbar-track"),
    ).toBe("background: transparent;");
    expect(
      compactCssRule(SIDEBAR_NAV_CSS, ".menuScroll::-webkit-scrollbar-thumb"),
    ).toBe(
      "border: 2px solid transparent; border-radius: var(--app-radius); background-color: initial; background-clip: content-box;",
    );
    expect(
      compactCssRule(
        SIDEBAR_NAV_CSS,
        ".shell:hover .menuScroll::-webkit-scrollbar-thumb",
      ),
    ).toBe("background-color: var(--app-color-text-secondary); opacity: 0.58;");
    expect(compactCssRule(SIDEBAR_NAV_CSS, ".menu:global(.ant-menu)")).toBe(
      "border-inline-end: 0; background: transparent;",
    );
    expect(
      compactCssRule(
        SIDEBAR_NAV_CSS,
        ".shell .menu:global(.ant-menu-root):global(.ant-menu-inline)",
      ),
    ).toBe("border-inline-end: 0;");
    expect(compactCssRule(SIDEBAR_NAV_CSS, ".icon")).toBe(
      "display: inline-flex; flex-shrink: 0; width: 18px; height: 18px; align-items: center; justify-content: center;",
    );
  });

  it("sets sidebar icon spacing", () => {
    const appIconRule = cssRule(".app-sidebar-icon");

    expect(SIDEBAR_NAV_SOURCE).toContain("iconMarginInlineEnd: 8");
    expect(appIconRule).not.toContain("margin-inline-end:");
    expect(GLOBAL_CSS).not.toContain(
      ".app-sidebar-menu.ant-menu .ant-menu-item-icon",
    );
    expect(GLOBAL_CSS).not.toContain(
      ".app-sidebar-menu.ant-menu .ant-menu-title-content",
    );
    expect(GLOBAL_CSS).not.toContain("@keyframes app-sidebar-icon-hover");
  });

  it("owns the workspace sidebar layout without Ant Design Sider selectors", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/app/WorkspaceShell.tsx"),
      "utf8",
    );
    const layoutRule = workspaceLayoutCssRule(
      ".app-workspace-layout.ant-layout",
    );
    const siderRule = workspaceLayoutCssRule(".app-workspace-sider");
    const desktopSiderRule = workspaceLayoutCssRules(
      ".app-workspace-sider",
    ).find((body) => body.includes("position: sticky;"));
    const mobileSiderRule = workspaceLayoutCssRules(
      ".app-workspace-sider",
    ).find((body) => body.includes("display: none;"));

    expect(source).toContain("hasSider={!hidesWorkspaceChrome}");
    expect(source).toContain('<aside className="app-workspace-sider">');
    expect(source).toContain("size={300}");
    expect(layoutRule).toContain("--workspace-sider-width: 300px;");
    expect(siderRule).toContain("flex: 0 0 var(--workspace-sider-width);");
    expect(siderRule).toContain("width: var(--workspace-sider-width);");
    expect(siderRule).toContain("min-width: var(--workspace-sider-width);");
    expect(siderRule).toContain("max-width: var(--workspace-sider-width);");
    expect(siderRule).toContain("overflow: hidden;");
    expect(siderRule).toContain(
      "border-inline-end: 1px solid var(--app-color-border);",
    );
    expect(siderRule).toContain("background: var(--app-color-bg-container);");
    expect(desktopSiderRule).toContain("top: 0;");
    expect(desktopSiderRule).toContain("align-self: flex-start;");
    expect(desktopSiderRule).toContain("height: max(100vh, 100dvh);");
    expect(desktopSiderRule).toContain("max-height: max(100vh, 100dvh);");
    expect(mobileSiderRule).toContain("display: none;");
    expect(WORKSPACE_LAYOUT_CSS).not.toContain("ant-layout-sider");
    expect(GLOBAL_CSS).not.toContain("ant-layout-sider");
    expect(GLOBAL_CSS).not.toMatch(/\.app-workspace-sider\s*\{/u);
  });

  it("owns the workspace drawer body padding in its local CSS module", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/app/WorkspaceShell.tsx"),
      "utf8",
    );
    const drawerBodyRule = cssRuleFrom(
      WORKSPACE_SHELL_CSS,
      ".workspaceDrawer :global(.ant-drawer-body)",
    );

    expect(source).toMatch(
      /rootClassName=\{\[\s*"app-workspace-drawer",\s*styles\.workspaceDrawer,?\s*\]\.join\(\s*" "\s*,?\s*\)\}/u,
    );
    expect(source).not.toContain("styles={{ body: { padding: 0 } }}");
    expect(drawerBodyRule).toContain("padding: 0;");
    expect(GLOBAL_CSS).not.toContain(".app-workspace-drawer .ant-drawer-body");
  });

  it("keeps the responsive workspace logo 48px tall", () => {
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
    const source = readFileSync(
      join(process.cwd(), "src/components/app/WorkspaceShell.tsx"),
      "utf8",
    );
    const mobileBrandRule = cssRuleFrom(WORKSPACE_SHELL_CSS, ".mobileBrand");
    const mobileLogoRule = cssRuleFrom(
      WORKSPACE_SHELL_CSS,
      ".mobileBrand .mobileBrandImage",
    );
    const responsiveMobileBrandRule = cssRulesFrom(
      WORKSPACE_SHELL_CSS,
      ".mobileBrand",
    ).find((rule) => rule.includes("overflow: hidden;"));
    const mobileBrand = container.querySelector(".app-workspace-mobile-brand");
    const mobileLogo = mobileBrand?.querySelector(".brand-logo__image");
    const globalSelectors = cssSelectorsFrom(GLOBAL_CSS);

    expect(source).toContain(
      'import styles from "./WorkspaceShell.module.css";',
    );
    expect(source).toMatch(
      /className=\{\[\s*"app-workspace-mobile-brand",\s*styles\.mobileBrand,?\s*\]\.join\(" "\)\}/u,
    );
    expect(source).toContain(
      'imageClassName={[styles.mobileBrandImage].join(" ")}',
    );
    expect(mobileBrand?.classList.contains("app-workspace-mobile-brand")).toBe(
      true,
    );
    expect(mobileBrand?.classList.length).toBe(2);
    expect(mobileLogo?.classList.contains("brand-logo__image")).toBe(true);
    expect(mobileLogo?.classList.length).toBe(2);
    expect(mobileBrandRule).toContain("position: absolute;");
    expect(mobileBrandRule).toContain("left: 50%;");
    expect(mobileBrandRule).toContain("top: 50%;");
    expect(mobileBrandRule).toContain("transform: translate(-50%, -50%);");
    expect(mobileBrandRule).toContain("display: inline-flex;");
    expect(mobileBrandRule).toContain("align-items: center;");
    expect(mobileBrandRule).toContain("height: 48px;");
    expect(mobileBrandRule).toContain("justify-content: center;");
    expect(mobileBrandRule).toContain("min-width: 0;");
    expect(mobileBrandRule).toContain("max-width: 48vw;");
    expect(mobileBrandRule).toContain("line-height: 0;");
    expect(mobileLogoRule).toContain("width: auto;");
    expect(mobileLogoRule).toContain("height: 48px;");
    expect(responsiveMobileBrandRule).toContain("overflow: hidden;");
    expect(responsiveMobileBrandRule).toContain("max-width: 48vw;");
    expect(globalSelectors).not.toContain(".app-workspace-mobile-brand");
    expect(globalSelectors).not.toContain(
      ".app-workspace-mobile-brand .brand-logo__image",
    );
  });

  it("pins the mobile GNB to the top and aligns its icons to the content edge", () => {
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
    const source = readFileSync(
      join(process.cwd(), "src/components/app/WorkspaceShell.tsx"),
      "utf8",
    );
    const layoutRule = workspaceLayoutCssRule(
      ".app-workspace-layout.ant-layout",
    );
    const headerRule = workspaceLayoutCssRule(".app-workspace-mobile-bar");
    const stickyRule = workspaceLayoutCssRules(
      ".app-workspace-mobile-bar",
    ).find((body) => body.includes("position: sticky;"));
    const globalSelectors = cssSelectorsFrom(GLOBAL_CSS);

    expect(
      container.querySelector("header.app-workspace-mobile-bar"),
    ).toBeTruthy();
    expect(container.querySelector(".ant-layout-header")).toBeNull();
    expect(source).not.toContain("const { Header, Content } = Layout;");
    expect(source).toContain('<header className="app-workspace-mobile-bar">');
    expect(layoutRule).toContain("--workspace-mobile-bar-height: 64px;");
    expect(headerRule).toContain("display: flex;");
    expect(headerRule).toContain("flex: 0 0 auto;");
    expect(headerRule).toContain("min-height: 68px;");
    expect(headerRule).toContain("height: 68px;");
    expect(headerRule).toContain("align-items: center;");
    expect(headerRule).toContain("justify-content: space-between;");
    expect(headerRule).toContain(
      "border-bottom: 1px solid var(--app-color-border);",
    );
    expect(headerRule).toContain("background: var(--app-color-bg-container);");
    expect(headerRule).toContain("color: var(--app-color-text);");
    expect(headerRule).toContain("line-height: normal;");
    expect(headerRule).toContain("padding-block: 0;");
    expect(headerRule).toContain("padding-inline: 6px;");
    expect(stickyRule).toBeTruthy();
    expect(stickyRule).toContain("top: 0;");
    expect(stickyRule).toContain("z-index: 100;");
    expect(globalSelectors).not.toContain(".app-workspace-mobile-bar");
    expect(globalSelectors).not.toContain(
      ".app-workspace-mobile-bar.ant-layout-header",
    );
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

  it("omits the sidebar for nested writing feedback routes", () => {
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

    expect(container.querySelector(".app-workspace-sider")).toBeNull();
    expect(container.querySelector(".app-sidebar-menu")).toBeNull();
  });

  it.each([
    "/writing/feedback/short/submission-1",
    "/writing/feedback/long/submission-1",
    "/writing/reports/report-1/compare",
  ])("applies flush content chrome on report header routes: %s", (pathname) => {
    navMock.pathname = pathname;

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

  it("opens the phone number reminder modal on entry when phone is missing", async () => {
    navMock.pathname = "/dashboard";

    renderWithIntl(
      <WorkspaceShell
        role="learner"
        userId="user-1"
        email={null}
        planLabel={null}
        phoneNumber={null}
        phoneNumberPromptDismissedAt={null}
      >
        <div>body</div>
      </WorkspaceShell>,
    );

    expect(
      await screen.findByText(koMessages.app.phoneReminder.title),
    ).toBeTruthy();
  });

  it("does not open the reminder modal while phone profile fields are unavailable", () => {
    navMock.pathname = "/dashboard";

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

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not open the reminder modal once a phone number exists", () => {
    navMock.pathname = "/dashboard";

    renderWithIntl(
      <WorkspaceShell
        role="learner"
        userId="user-1"
        email={null}
        planLabel={null}
        phoneNumber="01012345678"
        phoneNumberPromptDismissedAt={null}
      >
        <div>body</div>
      </WorkspaceShell>,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not open the reminder modal on an immersive writing route", () => {
    navMock.pathname = "/writing/short-answer-writing-51";

    renderWithIntl(
      <WorkspaceShell
        role="learner"
        userId="user-1"
        email={null}
        planLabel={null}
        phoneNumber={null}
        phoneNumberPromptDismissedAt={null}
      >
        <div>body</div>
      </WorkspaceShell>,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
