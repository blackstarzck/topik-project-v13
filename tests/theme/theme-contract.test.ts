import { describe, expect, test } from "vitest";
import {
  defaultAppearance,
  defaultThemeName,
  getAppTheme,
  getResolvedBridgeVars,
} from "../../src/theme";

describe("app theme contract", () => {
  test("exposes a default Ant Design theme with CSS variables enabled (key + prefix)", () => {
    const theme = getAppTheme(defaultThemeName, defaultAppearance);

    expect(theme.name).toBe("default");
    expect(theme.appearance).toBe("light");
    // key = cache deduplication ID; prefix = CSS variable prefix (--ant-* by default)
    expect(theme.antd.cssVar).toEqual({ key: "talkpik", prefix: "ant" });
    expect(theme.antd.token?.fontFamily).toContain("system-ui");
  });

  test("getResolvedBridgeVars returns actual hex/px values — no var() chains", () => {
    const theme = getAppTheme(defaultThemeName, defaultAppearance);
    const vars = getResolvedBridgeVars(theme.antd);

    // Must NOT be var(--ant-*) chains
    Object.values(vars).forEach((value) => {
      expect(value).not.toMatch(/^var\(--ant-/);
    });

    // Must be resolved actual values
    expect(vars["--app-color-primary"]).toBe("#1677ff");
    expect(vars["--app-color-bg-container"]).toBe("#ffffff");
    expect(vars["--app-color-border"]).toBe("#d9d9d9");
    expect(vars["--app-radius"]).toBe("6px");
    // colorText is rgba
    expect(vars["--app-color-text"]).toMatch(/rgba?\(/);
  });

  test("getResolvedBridgeVars dark appearance returns dark values", () => {
    const theme = getAppTheme(defaultThemeName, "dark");
    const vars = getResolvedBridgeVars(theme.antd);

    // Dark mode background must not be white
    expect(vars["--app-color-bg-container"]).not.toBe("#ffffff");
    // All values still resolved, not var() chains
    Object.values(vars).forEach((value) => {
      expect(value).not.toMatch(/^var\(--ant-/);
    });
  });

  test("getResolvedBridgeVars covers all required bridge keys", () => {
    const theme = getAppTheme(defaultThemeName, defaultAppearance);
    const vars = getResolvedBridgeVars(theme.antd);
    const requiredKeys = [
      "--app-color-primary",
      "--app-color-bg-layout",
      "--app-color-bg-container",
      "--app-color-text",
      "--app-color-text-secondary",
      "--app-color-border",
      "--app-radius",
      "--app-font-family",
      "--app-shadow-elevated",
    ];

    requiredKeys.forEach((key) => {
      expect(vars).toHaveProperty(key);
      expect(vars[key]).toBeTruthy();
    });
  });
});
