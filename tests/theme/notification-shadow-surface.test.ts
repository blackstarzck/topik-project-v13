import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import postcss from "postcss";
import { describe, expect, test } from "vitest";

const globalCssPath = join(process.cwd(), "src", "styles", "global.css");
const css = readFileSync(globalCssPath, "utf8");
const notificationBell = readFileSync(
  join(
    process.cwd(),
    "src",
    "components",
    "notifications",
    "NotificationBell.tsx",
  ),
  "utf8",
);
const notificationBellStylesPath = join(
  process.cwd(),
  "src",
  "components",
  "notifications",
  "NotificationBell.module.css",
);
const notificationBellStylesSource = existsSync(notificationBellStylesPath)
  ? readFileSync(notificationBellStylesPath, "utf8")
  : "";
const institutionInvitationModal = readFileSync(
  join(
    process.cwd(),
    "src",
    "components",
    "notifications",
    "InstitutionInvitationModal.tsx",
  ),
  "utf8",
);
const appProviders = readFileSync(
  join(process.cwd(), "src", "app", "providers.tsx"),
  "utf8",
);
const dashboardAlertsCard = readFileSync(
  join(
    process.cwd(),
    "src",
    "components",
    "dashboard",
    "DashboardAlertsCard.tsx",
  ),
  "utf8",
);

type ParsedCssRule = {
  atRules: string[];
  declarations: string;
  depth: number;
  selector: string;
  selectors: string[];
};

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

function parseCssRules(source: string): ParsedCssRule[] {
  const rules: ParsedCssRule[] = [];
  const root = postcss.parse(source);

  root.walkRules((rule) => {
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

    const normalizedSelector = normalizeCssSelector(rule.selector);
    const declarations = (rule.nodes ?? [])
      .filter((node) => node.type === "decl")
      .map(
        (node) =>
          `${node.prop}: ${node.value}${node.important ? " !important" : ""};`,
      )
      .join(" ");
    rules.push({
      atRules,
      declarations,
      depth,
      selector: normalizedSelector,
      selectors: splitCssSelectors(normalizedSelector),
    });
  });

  return rules;
}

function countCssStructuralNodes(source: string) {
  let count = 0;
  postcss.parse(source).walk((node) => {
    if (node.type === "rule" || node.type === "atrule") count += 1;
  });
  return count;
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
          .trim()
          .replace(/\(\s+/gu, "(")
          .replace(/\s+\)/gu, ")")
          .replace(/\s*,\s*/gu, ", "),
      ] as const;
    })
    .sort(([leftName, leftValue], [rightName, rightValue]) =>
      `${leftName}:${leftValue}`.localeCompare(`${rightName}:${rightValue}`),
    );
}

function hasExactRule(
  source: string,
  selector: string,
  expectedDeclarations: string,
  expectedAtRules: readonly string[] = [],
) {
  const normalizedSelector = normalizeCssSelector(selector);
  const normalizedAtRules = expectedAtRules.map(normalizeCssAtRule);
  const matches = parseCssRules(source).filter(
    (rule) =>
      rule.selectors.includes(normalizedSelector) &&
      JSON.stringify(rule.atRules) === JSON.stringify(normalizedAtRules),
  );

  return (
    matches.length === 1 &&
    matches[0].depth === normalizedAtRules.length &&
    matches[0].selectors.length === 1 &&
    matches[0].selector === normalizedSelector &&
    JSON.stringify(canonicalDeclarations(matches[0].declarations)) ===
      JSON.stringify(canonicalDeclarations(expectedDeclarations))
  );
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
    /\[\s*class\s*(?:[~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+))/giu;
  return Array.from(decodedSelector.matchAll(classAttributePattern)).some(
    (match) => {
      const value = match[1] ?? match[2] ?? match[3] ?? "";
      return (
        value.split(/\s+/u).includes(className) || value.includes(className)
      );
    },
  );
}

function blockFor(
  selector: string,
  source = css,
  expectedAtRules: readonly string[] = [],
): string {
  const normalizedSelector = normalizeCssSelector(selector);
  const normalizedAtRules = expectedAtRules.map(normalizeCssAtRule);
  return (
    parseCssRules(source).find(
      (rule) =>
        rule.selectors.includes(normalizedSelector) &&
        rule.depth === normalizedAtRules.length &&
        JSON.stringify(rule.atRules) === JSON.stringify(normalizedAtRules),
    )?.declarations ?? ""
  );
}

const notificationPanelModuleRules = [
  [".panel", "width: 320px; max-width: 78vw; font-size: 14px;", []],
  [".panel :global(.ant-typography)", "font-size: 14px;", []],
  [".panel :global(.ant-btn)", "font-size: 14px;", []],
  [
    ".header",
    "display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-bottom: 8px; margin-bottom: 6px;",
    [],
  ],
  [".markAll:global(.ant-btn)", "font-size: 14px;", []],
  [
    ".error",
    "display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 8px 0;",
    [],
  ],
  [
    ".panel",
    "max-width: calc(100vw - 48px);",
    ["@media (max-width: 767.98px)"],
  ],
] as const;
const componentOwnedNotificationPanelClasses = [
  "app-notification-panel",
  "app-notification-panel__header",
  "app-notification-panel__mark-all",
  "app-notification-panel__error",
] as const;
const allowedGlobalHeaderSelector = ".app-notification-panel__header";
const allowedGlobalHeaderDeclarations =
  "border-bottom: 1px solid var(--ant-color-border-secondary);";

function globalNotificationLayoutOwners(
  source: string,
  { allowHeaderBorder = false } = {},
) {
  return parseCssRules(source).flatMap((rule) =>
    rule.selectors.filter((selector) => {
      const ownsLayout = componentOwnedNotificationPanelClasses.some(
        (className) => selectorContainsClass(selector, className),
      );
      if (!ownsLayout) return false;

      const isAllowedHeaderBorder =
        allowHeaderBorder &&
        selector === allowedGlobalHeaderSelector &&
        rule.atRules.length === 0 &&
        rule.selectors.length === 1 &&
        rule.selector === allowedGlobalHeaderSelector &&
        JSON.stringify(canonicalDeclarations(rule.declarations)) ===
          JSON.stringify(
            canonicalDeclarations(allowedGlobalHeaderDeclarations),
          );
      return !isAllowedHeaderBorder;
    }),
  );
}

function globalNotificationLayoutOwnersInSources(
  sources: readonly CssRuntimeSource[],
  allowedHeaderPath: string,
) {
  return sources.flatMap(({ path, source }) =>
    globalNotificationLayoutOwners(source, {
      allowHeaderBorder: resolve(path) === resolve(allowedHeaderPath),
    }).map((selector) => `${path}: ${selector}`),
  );
}

const globalCssRuntimeSources = readGlobalCssRuntimeSources(globalCssPath);

describe("AntD Notification shadow surface", () => {
  test("AppProviders centralizes AntD notification placement and behavior", () => {
    expect(appProviders).toContain("const appNotificationConfig");
    expect(appProviders).toContain('placement: "topRight"');
    expect(appProviders).toContain("top: 88");
    expect(appProviders).toContain("duration: 3");
    expect(appProviders).toContain("maxCount: 3");
    expect(appProviders).toContain("showProgress: true");
    expect(appProviders).toContain("const appNotificationSurfaceConfig");
    expect(appProviders).toContain('className: "app-global-notification"');
    expect(appProviders).toContain(
      "notification={appNotificationSurfaceConfig}",
    );
    expect(appProviders).toContain(
      "<AntdApp notification={appNotificationConfig}>",
    );
  });

  test("AntD notification notice uses the shared elevated shadow token", () => {
    expect(
      blockFor(
        ".ant-notification .ant-notification-notice.ant-notification-notice",
      ),
    ).toContain("box-shadow: var(--app-shadow-elevated)");
  });

  test("global AntD notification notices use the shared surface hook", () => {
    const block = blockFor(
      ".ant-notification .app-global-notification.ant-notification-notice.ant-notification-notice",
    );

    expect(block).toContain("width: min(360px, calc(100vw - 32px))");
    expect(block).toContain(
      "border: 1px solid var(--ant-color-border-secondary, var(--app-color-border))",
    );
    expect(block).toContain("border-radius: var(--app-radius)");
    expect(block).toContain("box-shadow: var(--app-shadow-elevated)");
  });
});

describe("In-app notification inbox item styles", () => {
  test("keeps notification panel layout owned by the rendering component", () => {
    const missingContracts = [
      ...(!existsSync(notificationBellStylesPath)
        ? ["component stylesheet"]
        : []),
      ...(!hasExactRule(
        css,
        ".app-notification-panel__header",
        "border-bottom: 1px solid var(--ant-color-border-secondary);",
      )
        ? ["global header border rule"]
        : []),
      ...(countCssStructuralNodes(notificationBellStylesSource) !== 8
        ? ["exact module rule count"]
        : []),
      ...notificationPanelModuleRules
        .filter(
          ([selector, declarations, atRules]) =>
            !hasExactRule(
              notificationBellStylesSource,
              selector,
              declarations,
              atRules,
            ),
        )
        .map(
          ([selector, , atRules]) =>
            `module rule: ${[...atRules, selector].join(" > ")}`,
        ),
      ...globalNotificationLayoutOwnersInSources(
        globalCssRuntimeSources,
        globalCssPath,
      ).map((selector) => `global selector: ${selector}`),
    ];

    expect(missingContracts).toEqual([]);
  });

  test("distinguishes exact notification module rules from nested, duplicate, and grouped rules", () => {
    const expected = "display: flex; width: 320px;";

    expect(
      hasExactRule(
        `@media (max-width: 600px) { .panel { ${expected} } }`,
        ".panel",
        expected,
      ),
    ).toBe(false);
    expect(
      hasExactRule(
        `.panel { width: 320px; display: flex; }
        .panel { display: block; }`,
        ".panel",
        expected,
      ),
    ).toBe(false);
    expect(
      hasExactRule(
        `.panel { width: 320px; /* order is irrelevant */ display: flex; }`,
        ".panel",
        expected,
      ),
    ).toBe(true);
    expect(
      hasExactRule(
        `.panel, .other { width: 320px; display: flex; }`,
        ".panel",
        expected,
      ),
    ).toBe(false);
    expect(
      hasExactRule(
        `@import url("./foundation.css");
        @media(max-width: 767.98px) { .panel:is(.compact, .wide) { width: 320px; display: flex; max-width: calc( 100vw - 48px ); } }`,
        ".panel:is(.compact,.wide)",
        `${expected} max-width: calc(100vw - 48px);`,
        ["@media (max-width: 767.98px)"],
      ),
    ).toBe(true);
    expect(
      blockFor(
        ".panel",
        `@media (max-width: 767.98px) { .panel { ${expected} } }`,
      ),
    ).toBe("");
    expect(blockFor(".panel", `.never { .panel { ${expected} } }`)).toBe("");
    expect(
      blockFor(
        ".panel",
        `@media (max-width: 767.98px) { .panel { ${expected} } }`,
        ["@media(max-width: 767.98px)"],
      ),
    ).toContain("width: 320px");
    expect(
      globalNotificationLayoutOwners(
        `@import url("./foundation.css");
        .app-notification-panel.app-notification-panel { width: 1px; }
        :where(.app-notification-panel__error) { display: block; }
        .app-notification-panel__header { border-bottom: 1px solid var(--ant-color-border-secondary); }
        .app-notification-panel__header.app-notification-panel__header { display: block; }
        body { & .app-notification-panel__mark-all { font-size: 30px; } }
        [class~="app-notification-panel"][class~="app-notification-panel"] { width: 640px; }
        .app\\2d notification\\2d panel { width: 640px; }`,
        { allowHeaderBorder: true },
      ),
    ).toEqual([
      ".app-notification-panel.app-notification-panel",
      ":where(.app-notification-panel__error)",
      ".app-notification-panel__header.app-notification-panel__header",
      "& .app-notification-panel__mark-all",
      '[class~="app-notification-panel"][class~="app-notification-panel"]',
      ".app\\2d notification\\2d panel",
    ]);
    expect(localCssImportPath("url(./foundation.css)")).toBe(
      "./foundation.css",
    );
    expect(
      globalNotificationLayoutOwnersInSources(
        [
          { path: "/styles/global.css", source: '@import "./foundation.css";' },
          {
            path: "/styles/foundation.css",
            source:
              ".app-notification-panel.app-notification-panel { width: 640px; }",
          },
        ],
        "/styles/global.css",
      ),
    ).toEqual([
      "/styles/foundation.css: .app-notification-panel.app-notification-panel",
    ]);
    expect(
      countCssStructuralNodes(
        `.panel { width: 320px; }
        @layer notification;
        @property --notification-width { syntax: "<length>"; inherits: false; initial-value: 320px; }`,
      ),
    ).toBe(3);
    expect(
      hasExactRule(
        `@media (max-width: 767.98px) { .panel { width: 320px; display: flex; } }`,
        ".panel",
        expected,
        ["@media (max-width: 767.98px)"],
      ),
    ).toBe(true);
  });

  test("notification popover uses a darker floating shadow", () => {
    expect(notificationBell).toContain('root: "app-notification-popover"');
    expect(
      blockFor(
        ".app-notification-popover.app-notification-popover .ant-popover-container.ant-popover-container",
      ),
    ).toContain("box-shadow:");
    expect(
      blockFor(
        ".app-notification-popover.app-notification-popover .ant-popover-container.ant-popover-container",
      ),
    ).toContain("rgba(15, 23, 42, 0.16)");
  });

  test("notification popover keeps every text surface at 14px", () => {
    expect(notificationBell).toContain(
      'className="app-notification-item__time"',
    );
    expect(
      blockFor(".panel :global(.ant-typography)", notificationBellStylesSource),
    ).toContain("font-size: 14px");
    expect(
      blockFor(".panel :global(.ant-btn)", notificationBellStylesSource),
    ).toContain("font-size: 14px");
    expect(blockFor(".app-notification-item__button")).toContain(
      "font-size: 14px",
    );
    expect(blockFor(".app-notification-item__title.ant-typography")).toContain(
      "font-size: 14px",
    );
    expect(blockFor(".app-notification-item__body.ant-typography")).toContain(
      "font-size: 14px",
    );
    expect(blockFor(".app-notification-item__time.ant-typography")).toContain(
      "font-size: 14px",
    );
  });

  test("notification popover fixed header uses the AntD Card border color", () => {
    expect(blockFor(".app-notification-panel__header")).toContain(
      "border-bottom: 1px solid var(--ant-color-border-secondary)",
    );
  });

  test("notification rows remove outer horizontal padding and add transitioned hover feedback", () => {
    expect(blockFor(".app-notification-item")).toContain("padding-inline: 0");
    expect(blockFor(".app-notification-item__button")).toContain(
      "background: transparent",
    );
    expect(blockFor(".app-notification-item__button")).toContain(
      "position: relative",
    );
    expect(blockFor(".app-notification-item__button::before")).toContain(
      "background: var(--app-color-bg-layout)",
    );
    expect(blockFor(".app-notification-item__button::before")).toContain(
      "opacity: 0",
    );
    expect(blockFor(".app-notification-item__button::before")).toContain(
      "transition: opacity 160ms ease",
    );
    expect(blockFor(".app-notification-item__button:hover::before")).toContain(
      "opacity: 1",
    );
    expect(
      blockFor(".app-notification-item--unread .app-notification-item__button"),
    ).toContain("background: transparent");
    expect(
      blockFor(
        ".app-notification-item--unread .app-notification-item__button:hover::before",
      ),
    ).toContain("opacity: 1");
  });

  test("notification title and body use the requested typography hooks", () => {
    expect(notificationBell).toContain(
      'className="app-notification-item__title"',
    );
    expect(notificationBell).toContain(
      'className="app-notification-item__body !m-0"',
    );
    expect(blockFor(".app-notification-item__title.ant-typography")).toContain(
      "font-weight: 500",
    );
    expect(blockFor(".app-notification-item__body.ant-typography")).toContain(
      "font-size: 14px",
    );
  });

  test("institution invitation code uses a plain 26px display style", () => {
    expect(institutionInvitationModal).not.toContain(
      "institution-invitation-modal__body",
    );
    expect(institutionInvitationModal).toContain(
      'className="institution-invitation-modal__description"',
    );
    expect(institutionInvitationModal).toContain(
      'className="institution-invitation-modal__code"',
    );
    expect(blockFor(".institution-invitation-modal__body")).toBe("");
    expect(
      blockFor(".institution-invitation-modal__description.ant-typography"),
    ).toContain("word-break: keep-all");
    const codeBlock = blockFor(
      ".institution-invitation-modal__code.ant-typography",
    );
    expect(codeBlock).toContain("font-size: 26px");
    expect(codeBlock).toContain("margin-block: 20px 18px");
    expect(codeBlock).toContain("padding: 12px 14px");
    expect(codeBlock).toContain("background: var(--app-color-bg-layout)");
    expect(codeBlock).not.toContain("border:");
    expect(codeBlock).toContain("text-align: center");
  });

  test("unread dot and mark-all action match the notification badge affordance", () => {
    expect(notificationBell).toContain(
      'className="app-notification-item__unread-dot"',
    );
    expect(
      blockFor(".markAll:global(.ant-btn)", notificationBellStylesSource),
    ).toContain("font-size: 14px");
    expect(blockFor(".app-notification-item__unread-dot")).toContain(
      "background: var(--ant-color-error)",
    );
  });

  test("dashboard notice feed keeps rows transparent and regular weight", () => {
    expect(dashboardAlertsCard).toContain('className="dashboard-alerts-card"');
    expect(dashboardAlertsCard).not.toContain("  List,");
    expect(dashboardAlertsCard).not.toContain("<List");
    expect(dashboardAlertsCard).toContain(
      'className="app-notification-feed-item__title"',
    );
    expect(dashboardAlertsCard).toContain(
      'className="app-notification-feed-item__time"',
    );
    expect(dashboardAlertsCard).not.toContain(
      'className="app-notification-feed-item__tag"',
    );
    expect(dashboardAlertsCard).not.toContain("strong={unread}");
    expect(blockFor(".dashboard-alerts-card .ant-card-head-title")).toContain(
      "font-size: 14px",
    );
    expect(blockFor(".app-notification-feed-item")).toContain("padding: 0");
    expect(blockFor(".app-notification-feed-item__button")).toContain(
      "background: transparent",
    );
    expect(blockFor(".app-notification-feed-item__button")).toContain(
      "padding: 8px 0",
    );
    expect(blockFor(".app-notification-feed-item__button")).toContain(
      "font-size: 14px",
    );
    expect(blockFor(".app-notification-feed-item__button:hover")).toContain(
      "background: transparent",
    );
    expect(
      blockFor(
        ".app-notification-feed-item--unread .app-notification-feed-item__button",
      ),
    ).toContain("background: transparent");
    expect(
      blockFor(
        ".app-notification-feed-item--unread .app-notification-feed-item__button:hover",
      ),
    ).toContain("background: transparent");
    expect(
      blockFor(".app-notification-feed-item__title.ant-typography"),
    ).toContain("font-weight: 400");
    expect(
      blockFor(".app-notification-feed-item__title.ant-typography"),
    ).toContain("font-size: 14px");
    expect(
      blockFor(".app-notification-feed-item__title.ant-typography"),
    ).toContain("-webkit-line-clamp: 2");
    expect(
      blockFor(".app-notification-feed-item__title.ant-typography"),
    ).toContain("white-space: normal");
    expect(
      blockFor(".app-notification-feed-item__title.ant-typography"),
    ).toContain("overflow-wrap: anywhere");
    expect(
      blockFor(".app-notification-feed-item__time.ant-typography"),
    ).toContain("flex: 0 0 auto");
    expect(blockFor(".app-notification-feed-item__tag.ant-tag")).toBe("");
    expect(
      blockFor(".app-notification-feed-item__time.ant-typography"),
    ).toContain("font-size: 14px");
  });
});
