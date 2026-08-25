import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import designTokens from "../../DESIGN/tokens.json";
import { allowedAppBridgeVars } from "../../src/theme/bridge-contract";
import { awesomicThemeTokens } from "../../src/theme/tokens/awesomic";
import { themePresets, themeSettings } from "../../src/theme";

type DesignTokenLeaf = {
  $value: string | number | Record<string, unknown>;
};

function tokenValue(path: string): string | number | Record<string, unknown> {
  const value = path
    .split(".")
    .reduce<unknown>(
      (node, key) =>
        node && typeof node === "object"
          ? (node as Record<string, unknown>)[key]
          : undefined,
      designTokens,
    );

  return (value as DesignTokenLeaf).$value;
}

function tokenPx(path: string): number {
  const value = tokenValue(path);
  if (typeof value !== "string" || !value.endsWith("px")) {
    throw new Error(`Expected ${path} to be a px token`);
  }
  return Number.parseFloat(value);
}

function typographyFontSize(path: string): string {
  const value = tokenValue(path);
  if (
    !value ||
    typeof value !== "object" ||
    typeof value.fontSize !== "string"
  ) {
    throw new Error(`Expected ${path} to be a typography token`);
  }
  return value.fontSize;
}

const documentedFontSizeAliases = {
  caption: "--text-caption",
  body: "--text-body",
  bodyLg: "--text-body-lg",
  subheading: "--text-subheading",
  headingSm: "--text-heading-sm",
  heading: "--text-heading",
  headingLg: "--text-heading-lg",
  displaySm: "--text-display-sm",
  display: "--text-display",
} as const;

describe("Awesomic token source contract", () => {
  test("selected theme is registered", () => {
    expect(themeSettings.main).toBe("awesomic");
    expect(themePresets).toHaveProperty(themeSettings.main);
  });

  test("normalized Awesomic tokens match DESIGN/tokens.json source values", () => {
    expect(awesomicThemeTokens.color.obsidian).toBe(
      tokenValue("color.obsidian"),
    );
    expect(awesomicThemeTokens.color.ink).toBe(tokenValue("color.ink"));
    expect(awesomicThemeTokens.color.steel).toBe(tokenValue("color.steel"));
    expect(awesomicThemeTokens.color.pebble).toBe(tokenValue("color.pebble"));
    expect(awesomicThemeTokens.color.mist).toBe(tokenValue("color.mist"));
    expect(awesomicThemeTokens.color.snow).toBe(tokenValue("color.snow"));
    expect(awesomicThemeTokens.color.linkSecondary).toBe(
      tokenValue("color.link-secondary"),
    );
    expect(awesomicThemeTokens.status).toEqual({
      light: {
        error: "#ff4d4f",
        warning: "#faad14",
        success: "#52c41a",
        strongSuccess: "#389e0d",
        fillSecondary: "rgba(0, 0, 0, 0.06)",
      },
      dark: {
        error: "#dc4446",
        warning: "#d89614",
        success: "#49aa19",
        strongSuccess: "#3c8618",
        fillSecondary: "rgba(255, 255, 255, 0.12)",
      },
    });
    expect(awesomicThemeTokens.overlay.maskSubtle).toBe(
      "rgba(244, 244, 245, 0.18)",
    );
    expect(awesomicThemeTokens.border.secondary).toEqual({
      light: "#f0f0f0",
      dark: "#303030",
    });
    expect(awesomicThemeTokens.chart).toEqual({
      seriesPrimary: "#1677ff",
      accent: "#13c2c2",
    });
    expect(awesomicThemeTokens.landingCta).toEqual({
      primary: "#070203",
      primaryHover: "#21080c",
      foreground: "#ffffff",
      ghostSurface: "#ffffff",
      ghostText: "#0c0c0d",
      ghostBorder: "#e7e7e6",
    });
    expect(awesomicThemeTokens.authPrompt).toEqual({
      controlHeight: 50,
      focusOutline: "rgba(24, 24, 24, 0.08)",
      focusShadow: "0 0 0 2px rgba(24, 24, 24, 0.08)",
      loginFocusBorder: "#aab5ff",
      loginFocusShadow: "0 0 0 2px rgba(82, 102, 255, 0.1)",
      radius: 8,
    });
    expect(awesomicThemeTokens.fontSize).toEqual({
      caption: typographyFontSize("typography.xs"),
      body: typographyFontSize("typography.sm-9"),
      bodyLg: typographyFontSize("typography.base-7"),
      subheading: typographyFontSize("typography.lg"),
      headingSm: typographyFontSize("typography.xl"),
      heading: typographyFontSize("typography.3xl"),
      headingLg: typographyFontSize("typography.4xl"),
      displaySm: typographyFontSize("typography.5xl"),
      display: typographyFontSize("typography.5xl-2"),
    });
  });

  test("foundation CSS maps every documented text alias to the app bridge", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/styles/foundation.css"),
      "utf8",
    );

    Object.entries(documentedFontSizeAliases).forEach(([role, alias]) => {
      const bridgeRole = role.replace(
        /[A-Z]/g,
        (letter) => `-${letter.toLowerCase()}`,
      );

      expect(css).toContain(`${alias}: var(--app-font-size-${bridgeRole});`);
    });
  });

  test("notification settings heading consumes heading-sm without changing its default style", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/styles/global.css"),
      "utf8",
    );
    const headingRule = css.match(
      /\.notification-settings-section-heading\s*\{([^}]*)\}/,
    )?.[1];

    expect(headingRule).toContain(
      "font-size: var(--app-font-size-heading-sm);",
    );
    expect(headingRule).toContain("line-height: 1.35;");
  });

  test("runtime radius tokens are reduced from the raw rounded reference", () => {
    expect(awesomicThemeTokens.radius.base).toBe(6);
    expect(awesomicThemeTokens.radius.input).toBe(6);
    expect(awesomicThemeTokens.radius.button).toBe(6);
    expect(awesomicThemeTokens.radius.card).toBe(8);
    expect(awesomicThemeTokens.radius.compactCard).toBe(6);
    expect(awesomicThemeTokens.radius.badge).toBe(4);
    expect(awesomicThemeTokens.radius.indicator).toBe(2);
    expect(awesomicThemeTokens.radius.landingHeroCta).toBe(0);
    expect(awesomicThemeTokens.radius.pill).toBe(tokenPx("radius.full-6"));

    expect(awesomicThemeTokens.radius.card).toBeLessThan(
      tokenPx("radius.3xl-3"),
    );
    expect(awesomicThemeTokens.radius.button).toBeLessThan(
      tokenPx("radius.3xl-3"),
    );
    expect(awesomicThemeTokens.radius.badge).toBeLessThan(tokenPx("radius.xl"));
  });

  test("global and foundation CSS use only approved --app-* bridge variables", () => {
    const usedVars = ["global.css", "foundation.css"].flatMap((fileName) => {
      const css = readFileSync(
        resolve(process.cwd(), "src/styles", fileName),
        "utf8",
      );

      return Array.from(css.matchAll(/--app-[a-z0-9-]+/g)).map(
        ([value]) => value,
      );
    });
    const allowedVars = new Set<string>(allowedAppBridgeVars);
    const disallowed = usedVars.filter((value) => !allowedVars.has(value));

    expect([...new Set(disallowed)]).toEqual([]);
  });

  test("legal consent links consume the secondary link bridge token", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/styles/global.css"),
      "utf8",
    );

    expect(css).toContain(".auth-legal-link");
    expect(css).toContain("color: var(--app-color-link-secondary)");
  });
});
