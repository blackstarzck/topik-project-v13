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
  });

  test("runtime radius tokens are reduced from the raw rounded reference", () => {
    expect(awesomicThemeTokens.radius.base).toBe(6);
    expect(awesomicThemeTokens.radius.input).toBe(6);
    expect(awesomicThemeTokens.radius.button).toBe(6);
    expect(awesomicThemeTokens.radius.card).toBe(8);
    expect(awesomicThemeTokens.radius.compactCard).toBe(6);
    expect(awesomicThemeTokens.radius.badge).toBe(4);

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
