// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import { theme } from "antd";

import {
  awesomicBridgeVars,
  defaultThemeName,
  getAppTheme,
  getResolvedBridgeVarsByAppearance,
} from "../../src/theme";
import { appFontFamily } from "../../src/theme/global/shared-seed";
import type { ThemeAppearance } from "../../src/theme/types";

// Theme bridge ↔ AntD token parity.
//
// Awesomic is the approved visual source of truth. This test guards that the
// hardcoded SSR bridge (src/theme/tailwind-bridge.ts) never silently drifts away
// from the AntD tokens generated from src/theme/presets/default.ts.
//
// Primary comparison: theme.getDesignToken(activeThemeConfig) per appearance.
// If getDesignToken cannot run in the test env, fall back to the documented
// AntD v6.4.3 static map. When getDesignToken IS available, the static map is
// itself cross-checked against the resolved tokens, so the fallback can never
// silently drift from real AntD output either.

type Formatter = (raw: unknown) => string;

const asString: Formatter = (raw) => String(raw);
const asPx: Formatter = (raw) => `${raw}px`;

// `--app-*` var ↔ { AntD GlobalToken key, formatter }. radius → `${n}px`.
const BRIDGE_TOKEN_MAP: Record<string, { token: string; format: Formatter }> = {
  "--app-color-primary": { token: "colorPrimary", format: asString },
  "--app-color-bg-layout": { token: "colorBgLayout", format: asString },
  "--app-color-bg-container": { token: "colorBgContainer", format: asString },
  "--app-color-text": { token: "colorText", format: asString },
  "--app-color-text-secondary": {
    token: "colorTextSecondary",
    format: asString,
  },
  "--app-color-border": { token: "colorBorder", format: asString },
  "--app-radius": { token: "borderRadius", format: asPx },
  // fontFamily is the project seed override (shared-seed.ts), not an AntD default.
  "--app-font-family": { token: "fontFamily", format: asString },
  "--app-shadow-elevated": { token: "boxShadowSecondary", format: asString },
};

// Documented Awesomic light-fixed baseline.
// fontFamily is the shared-seed override (single source for the app font stack).
const STATIC_ANTD_DEFAULTS: Record<
  ThemeAppearance,
  Record<string, string>
> = {
  light: {
    colorPrimary: "#09090b",
    colorBgLayout: "#f4f4f5",
    colorBgContainer: "#ffffff",
    colorText: "#18181b",
    colorTextSecondary: "#71717a",
    colorBorder: "#d4d4d8",
    borderRadius: "14",
    fontFamily: appFontFamily,
    boxShadowSecondary: "0 4px 12px 0 rgba(0,0,0,0.04)",
  },
  // Dark infra exists in src/theme, but user-facing bridge output is currently
  // light-fixed until a separate Awesomic dark contract is approved.
  dark: {
    colorPrimary: "#09090b",
    colorBgLayout: "#f4f4f5",
    colorBgContainer: "#ffffff",
    colorText: "#18181b",
    colorTextSecondary: "#71717a",
    colorBorder: "#d4d4d8",
    borderRadius: "14",
    fontFamily: appFontFamily,
    boxShadowSecondary: "0 4px 12px 0 rgba(0,0,0,0.04)",
  },
};

// Guard VALUES, not whitespace/case/float-noise. AntD FastColor emits
// "rgba(0,0,0,0.88)" while the bridge stores "rgba(0, 0, 0, 0.88)"; antd shadow
// tokens may carry newlines; and antd's resolved dark shadow alpha is a raw
// IEEE-754 product (0.05 × 0.2 = 0.010000000000000002) where the bridge stores
// the human value 0.01 (the same number). Strip whitespace, lowercase, and
// round every numeric literal to 6 decimals so the comparison catches real
// value drift but ignores formatting and float representation.
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

const APPEARANCES: ThemeAppearance[] = ["light"];

describe("theme bridge ↔ AntD token parity (Awesomic light-fixed)", () => {
  for (const appearance of APPEARANCES) {
    describe(`${appearance} appearance`, () => {
      const bridge = getResolvedBridgeVarsByAppearance(appearance);
      const resolved = resolveTokens(appearance);
      const source = resolved ?? STATIC_ANTD_DEFAULTS[appearance];

      for (const [varName, { token, format }] of Object.entries(
        BRIDGE_TOKEN_MAP,
      )) {
        test(`${varName} === resolved ${token}`, () => {
          const expected = format(source[token]);
          expect(bridge[varName]).toBeTruthy();
          expect(normalize(bridge[varName])).toBe(normalize(expected));
        });
      }
    });
  }

  test("dark bridge requests return the light-fixed Awesomic bridge", () => {
    expect(getResolvedBridgeVarsByAppearance("dark")).toEqual(
      getResolvedBridgeVarsByAppearance("light"),
    );
    expect(getResolvedBridgeVarsByAppearance("light")).toEqual(
      awesomicBridgeVars,
    );
  });

  // Teeth: when getDesignToken IS available, the documented static map must
  // itself match the resolved tokens, so the fallback can never silently drift.
  test("static Awesomic token map matches getDesignToken when available", () => {
    for (const appearance of APPEARANCES) {
      const resolved = resolveTokens(appearance);
      if (!resolved) continue; // getDesignToken blocked → nothing to cross-check
      const fallback = STATIC_ANTD_DEFAULTS[appearance];
      for (const { token } of Object.values(BRIDGE_TOKEN_MAP)) {
        expect(normalize(String(resolved[token]))).toBe(
          normalize(fallback[token]),
        );
      }
    }
  });
});
