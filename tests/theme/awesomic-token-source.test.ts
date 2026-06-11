import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import designTokens from "../../DESIGN/tokens.json";
import {
  allowedAppBridgeVars,
  awesomicThemeTokens,
} from "../../src/theme/tokens/awesomic";
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
    expect(awesomicThemeTokens.radius.input).toBe(14);
    expect(awesomicThemeTokens.radius.card).toBe(36);
    expect(awesomicThemeTokens.radius.badge).toBe(12);
  });

  test("global.css uses only approved --app-* bridge variables", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/styles/global.css"),
      "utf8",
    );
    const usedVars = Array.from(css.matchAll(/--app-[a-z0-9-]+/g)).map(
      ([value]) => value,
    );
    const allowedVars = new Set<string>(allowedAppBridgeVars);
    const disallowed = usedVars.filter(
      (value) => !allowedVars.has(value),
    );

    expect([...new Set(disallowed)]).toEqual([]);
  });
});
