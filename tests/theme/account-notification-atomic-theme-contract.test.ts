import { readFileSync } from "node:fs";
import path from "node:path";

import { theme } from "antd";
import postcss, { type Rule } from "postcss";
import { describe, expect, test } from "vitest";

import { allowedAppBridgeVars } from "../../src/theme/bridge-contract";
import { getResolvedBridgeVars } from "../../src/theme/tailwind-bridge";
import { awesomicThemeTokens } from "../../src/theme/tokens/awesomic";
import { phase5dAlternateTheme } from "../e2e/fixtures/phase5d-alternate-theme";

const globalCss = readFileSync(
  path.join(process.cwd(), "src", "styles", "global.css"),
  "utf8",
);
const designContract = readFileSync(
  path.join(process.cwd(), "DESIGN.md"),
  "utf8",
);
const alternateBrowserSpec = readFileSync(
  path.join(
    process.cwd(),
    "tests",
    "e2e",
    "screens",
    "phase5d-alternate-theme.spec.ts",
  ),
  "utf8",
);
const stylesheet = postcss.parse(globalCss, {
  from: "src/styles/global.css",
});

const sharedRoles = {
  "--app-shadow-notification-channel-selected":
    "0 0 0 1px var(--app-color-primary)",
} as const;

const productionRolesByAppearance = {
  light: {
    "--app-color-status-error-border": "#ffccc7",
    "--app-color-status-error-surface": "#fff2f0",
    ...sharedRoles,
  },
  dark: {
    "--app-color-status-error-border": "#5b2526",
    "--app-color-status-error-surface": "#2c1618",
    ...sharedRoles,
  },
} as const;

function normalize(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function findRule(selector: string): Rule | undefined {
  let match: Rule | undefined;
  stylesheet.walkRules((rule) => {
    if (!match && normalize(rule.selector) === selector) match = rule;
  });
  return match;
}

function declaration(rule: Rule | undefined, property: string) {
  let value: string | undefined;
  rule?.walkDecls(property, (item) => {
    value = normalize(item.value);
  });
  return value;
}

describe("account and notification atomic theme contract", () => {
  test("documents and allows the three semantic roles", () => {
    for (const role of Object.keys(productionRolesByAppearance.light)) {
      expect(designContract).toContain(`\`${role}\``);
      expect(allowedAppBridgeVars).toContain(role);
    }
  });

  test("preserves Ant Design error aliases and the selected channel ring in every production appearance", () => {
    const defaultAntdByAppearance = {
      light: theme.getDesignToken(),
      dark: theme.getDesignToken({ algorithm: theme.darkAlgorithm }),
    } as const;

    expect(awesomicThemeTokens.status.light).toMatchObject({
      errorBorder: "#ffccc7",
      errorSurface: "#fff2f0",
    });
    expect(awesomicThemeTokens.status.dark).toMatchObject({
      errorBorder: "#5b2526",
      errorSurface: "#2c1618",
    });
    expect(awesomicThemeTokens.notification.shadow.channelSelected).toBe(
      sharedRoles["--app-shadow-notification-channel-selected"],
    );

    for (const appearance of ["light", "dark"] as const) {
      expect(
        getResolvedBridgeVars("default", appearance)[
          "--app-color-status-error-border"
        ],
      ).toBe(defaultAntdByAppearance[appearance].colorErrorBorder);
      expect(
        getResolvedBridgeVars("default", appearance)[
          "--app-color-status-error-surface"
        ],
      ).toBe(defaultAntdByAppearance[appearance].colorErrorBg);
    }

    for (const themeName of ["default", "awesomic"] as const) {
      for (const appearance of ["light", "dark"] as const) {
        expect(getResolvedBridgeVars(themeName, appearance)).toMatchObject(
          productionRolesByAppearance[appearance],
        );
      }
    }
  });

  test("keeps alternate error aliases aligned with public Ant Design values in both appearances", () => {
    const resolvedAlternateByAppearance = {
      light: theme.getDesignToken({ token: { colorError: "#b0006d" } }),
      dark: theme.getDesignToken({
        algorithm: theme.darkAlgorithm,
        token: { colorError: "#b0006d" },
      }),
    } as const;
    const exactAliasesByAppearance = {
      light: { border: "#d667a0", surface: "#f0d8e3" },
      dark: { border: "#430e2f", surface: "#20111b" },
    } as const;

    for (const appearance of ["light", "dark"] as const) {
      const bridge = phase5dAlternateTheme.appBridgeVarsByAppearance[
        appearance
      ] as Record<string, string>;
      const antd = phase5dAlternateTheme.antdCssVarsByAppearance[
        appearance
      ] as Record<string, string>;
      const resolved = resolvedAlternateByAppearance[appearance];

      expect(bridge["--app-color-status-error-border"]).toBe(
        exactAliasesByAppearance[appearance].border,
      );
      expect(bridge["--app-color-status-error-surface"]).toBe(
        exactAliasesByAppearance[appearance].surface,
      );
      expect(bridge["--app-color-status-error-border"]).toBe(
        resolved.colorErrorBorder,
      );
      expect(bridge["--app-color-status-error-surface"]).toBe(
        resolved.colorErrorBg,
      );
      expect(antd["--ant-color-error-border"]).toBe(
        resolved.colorErrorBorder,
      );
      expect(antd["--ant-color-error-bg"]).toBe(resolved.colorErrorBg);
    }

    expect(phase5dAlternateTheme.appBridgeVars).toBe(
      phase5dAlternateTheme.appBridgeVarsByAppearance.light,
    );
    expect(phase5dAlternateTheme.antdCssVars).toBe(
      phase5dAlternateTheme.antdCssVarsByAppearance.light,
    );
  });

  test("keeps each alternate role set pairwise distinct from every light and dark production value", () => {
    const roles = Object.keys(productionRolesByAppearance.light);
    const productionValues = new Set(
      Object.values(productionRolesByAppearance).flatMap((values) =>
        Object.values(values),
      ),
    );

    for (const appearance of ["light", "dark"] as const) {
      const bridge = phase5dAlternateTheme.appBridgeVarsByAppearance[
        appearance
      ] as Record<string, string>;
      const alternateValues = roles.map((role) => bridge[role]);

      expect(alternateValues.every(Boolean)).toBe(true);
      expect(new Set(alternateValues).size).toBe(alternateValues.length);
      for (const value of alternateValues) {
        expect(productionValues).not.toContain(value);
      }
    }
  });

  test("selects the current appearance in the browser-only alternate injector", () => {
    expect(alternateBrowserSpec).toContain(
      "appBridgeVarsByAppearance[appearance]",
    );
    expect(alternateBrowserSpec).toContain(
      "antdCssVarsByAppearance[appearance]",
    );
  });

  test("consumes the semantic roles without changing selector specificity", () => {
    const accountRule = findRule(
      ".account-delete-card.app-card.app-surface",
    );
    const selectedChannelRule = findRule(
      '.notification-settings-channel-option[aria-pressed="true"]',
    );
    const notificationStateSelectors: string[] = [];
    stylesheet.walkRules((rule) => {
      const selector = normalize(rule.selector);
      if (
        selector.includes(".notification-settings-channel-option") &&
        selector.includes("[aria-pressed")
      ) {
        notificationStateSelectors.push(selector);
      }
    });

    expect(declaration(accountRule, "border")).toBe(
      "1px solid var(--app-color-status-error-border)",
    );
    expect(declaration(accountRule, "background")).toBe(
      "var(--app-color-status-error-surface)",
    );
    expect(declaration(selectedChannelRule, "border-color")).toBe(
      "var(--app-color-primary)",
    );
    expect(declaration(selectedChannelRule, "box-shadow")).toBe(
      "var(--app-shadow-notification-channel-selected)",
    );
    expect(notificationStateSelectors).toEqual([
      '.notification-settings-channel-option[aria-pressed="true"]',
    ]);
  });
});
