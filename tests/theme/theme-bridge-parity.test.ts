// @vitest-environment jsdom
import { theme } from "antd";
import { describe, expect, test } from "vitest";

import {
  defaultThemeName,
  getAppTheme,
  getResolvedBridgeVars,
  getResolvedBridgeVarsByAppearance,
} from "../../src/theme";
import type { AppBridgeVarName } from "../../src/theme/bridge-contract";
import type { ThemeAppearance } from "../../src/theme/types";

type Formatter = (raw: unknown) => string;

const asString: Formatter = (raw) => String(raw);
const asPx: Formatter = (raw) => `${raw}px`;

const ANT_D_BACKED_BRIDGE_TOKEN_MAP: Partial<
  Record<AppBridgeVarName, { token: string; format: Formatter }>
> = {
  "--app-color-primary": { token: "colorPrimary", format: asString },
  "--app-color-bg-layout": { token: "colorBgLayout", format: asString },
  "--app-color-bg-container": { token: "colorBgContainer", format: asString },
  "--app-color-text": { token: "colorText", format: asString },
  "--app-color-text-secondary": {
    token: "colorTextSecondary",
    format: asString,
  },
  "--app-color-border": { token: "colorBorder", format: asString },
  "--app-color-status-error": { token: "colorError", format: asString },
  "--app-color-status-warning": { token: "colorWarning", format: asString },
  "--app-color-status-success": { token: "colorSuccess", format: asString },
  "--app-color-status-strong-success": {
    token: "colorSuccessActive",
    format: asString,
  },
  "--app-color-fill-secondary": {
    token: "colorFillSecondary",
    format: asString,
  },
  "--app-radius": { token: "borderRadius", format: asPx },
  "--app-radius-indicator": { token: "borderRadiusXS", format: asPx },
  "--app-font-family": { token: "fontFamily", format: asString },
  "--app-shadow-elevated": { token: "boxShadowSecondary", format: asString },
};

const STATUS_BRIDGE_TOKEN_MAP = Object.fromEntries(
  Object.entries(ANT_D_BACKED_BRIDGE_TOKEN_MAP).filter(([varName]) =>
    [
      "--app-color-status-error",
      "--app-color-status-warning",
      "--app-color-status-success",
      "--app-color-status-strong-success",
      "--app-color-fill-secondary",
      "--app-radius-indicator",
    ].includes(varName),
  ),
) as typeof ANT_D_BACKED_BRIDGE_TOKEN_MAP;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\d*\.?\d+/g, (n) => String(parseFloat(parseFloat(n).toFixed(6))));
}

function resolveTokens(
  appearance: ThemeAppearance,
): Record<string, unknown> | null {
  try {
    const config = getAppTheme(defaultThemeName, appearance).antd;
    const token = theme.getDesignToken(config);
    if (token && typeof token.colorPrimary === "string") {
      return token as unknown as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

describe("theme bridge ↔ AntD token parity (Awesomic selected theme)", () => {
  test("light bridge values match resolved AntD tokens", () => {
    const bridge = getResolvedBridgeVars(defaultThemeName, "light");
    const resolved = resolveTokens("light");

    expect(resolved).toBeTruthy();

    for (const [varName, { token, format }] of Object.entries(
      ANT_D_BACKED_BRIDGE_TOKEN_MAP,
    ) as Array<
      [
        AppBridgeVarName,
        NonNullable<(typeof ANT_D_BACKED_BRIDGE_TOKEN_MAP)[AppBridgeVarName]>,
      ]
    >) {
      const expected = format(resolved?.[token]);
      expect(bridge[varName]).toBeTruthy();
      expect(normalize(bridge[varName])).toBe(normalize(expected));
    }
  });

  test("dark semantic status bridge values match resolved AntD tokens", () => {
    const bridge = getResolvedBridgeVars(defaultThemeName, "dark");
    const resolved = resolveTokens("dark");

    expect(resolved).toBeTruthy();

    for (const [varName, { token, format }] of Object.entries(
      STATUS_BRIDGE_TOKEN_MAP,
    ) as Array<
      [
        AppBridgeVarName,
        NonNullable<(typeof STATUS_BRIDGE_TOKEN_MAP)[AppBridgeVarName]>,
      ]
    >) {
      expect(normalize(bridge[varName])).toBe(
        normalize(format(resolved?.[token])),
      );
    }
  });

  test("compatibility wrapper resolves the selected default theme", () => {
    expect(getResolvedBridgeVarsByAppearance("light")).toEqual(
      getResolvedBridgeVars(defaultThemeName, "light"),
    );
  });

  test("bridge values are resolved values, not AntD CSS variable chains", () => {
    const bridge = getResolvedBridgeVars(defaultThemeName, "light");

    Object.values(bridge).forEach((value) => {
      expect(value).toBeTruthy();
      expect(value).not.toMatch(/^var\(--ant-/);
    });
  });
});
