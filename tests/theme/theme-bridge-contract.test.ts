import { describe, expect, test } from "vitest";

import {
  allowedAppBridgeVars,
  createAppBridgeVars,
  themePresets,
} from "../../src/theme";
import {
  awesomicBridgeVars,
  awesomicThemeTokens,
} from "../../src/theme/tokens/awesomic";

describe("generic app theme bridge contract", () => {
  test("projects a test-only alternate theme through every semantic bridge axis", () => {
    const alternate = createAppBridgeVars({
      colorPrimary: "#123456",
      colorBgLayout: "#e8edf2",
      colorBgContainer: "#fefefe",
      colorText: "#102030",
      colorTextSecondary: "#506070",
      colorLinkSecondary: "#405de6",
      colorBorder: "#90a0b0",
      radius: "12px",
      fontFamily: '"Test Sans", sans-serif',
      shadowElevated: "0 8px 24px rgba(16, 32, 48, 0.16)",
    });

    expect(Object.keys(alternate)).toEqual(allowedAppBridgeVars);
    expect(alternate).toEqual({
      "--app-color-primary": "#123456",
      "--app-color-bg-layout": "#e8edf2",
      "--app-color-bg-container": "#fefefe",
      "--app-color-text": "#102030",
      "--app-color-text-secondary": "#506070",
      "--app-color-link-secondary": "#405de6",
      "--app-color-border": "#90a0b0",
      "--app-radius": "12px",
      "--app-font-family": '"Test Sans", sans-serif',
      "--app-shadow-elevated": "0 8px 24px rgba(16, 32, 48, 0.16)",
    });
  });

  test("keeps the alternate fixture out of the production theme registry", () => {
    expect(themePresets).not.toHaveProperty("test-alternate");
  });

  test("keeps the selected production theme equivalent to the generic projection", () => {
    expect(
      createAppBridgeVars({
        colorPrimary: awesomicThemeTokens.color.obsidian,
        colorBgLayout: awesomicThemeTokens.color.mist,
        colorBgContainer: awesomicThemeTokens.color.snow,
        colorText: awesomicThemeTokens.color.ink,
        colorTextSecondary: awesomicThemeTokens.color.steel,
        colorLinkSecondary: awesomicThemeTokens.color.linkSecondary,
        colorBorder: awesomicThemeTokens.color.pebble,
        radius: `${awesomicThemeTokens.radius.base}px`,
        fontFamily: awesomicThemeTokens.font.runtimeFamily,
        shadowElevated: awesomicThemeTokens.shadow.elevated,
      }),
    ).toEqual(awesomicBridgeVars);
  });
});
