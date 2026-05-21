import { describe, expect, test } from "vitest";
import {
  defaultAppearance,
  defaultThemeName,
  getAppTheme,
  getTailwindBridgeVars,
} from "../../src/theme";

describe("app theme contract", () => {
  test("exposes a default Ant Design theme with CSS variables enabled", () => {
    const theme = getAppTheme(defaultThemeName, defaultAppearance);

    expect(theme.name).toBe("default");
    expect(theme.appearance).toBe("light");
    expect(theme.antd.cssVar).toEqual({ key: "talkpik" });
    expect(theme.antd.token?.fontFamily).toContain("system-ui");
  });

  test("maps the approved Tailwind bridge variables to Ant Design CSS variables", () => {
    expect(getTailwindBridgeVars()).toEqual({
      "--app-color-primary": "var(--ant-color-primary)",
      "--app-color-bg-layout": "var(--ant-color-bg-layout)",
      "--app-color-bg-container": "var(--ant-color-bg-container)",
      "--app-color-text": "var(--ant-color-text)",
      "--app-color-text-secondary": "var(--ant-color-text-secondary)",
      "--app-color-border": "var(--ant-color-border)",
      "--app-radius": "var(--ant-border-radius)",
      "--app-font-family": "var(--ant-font-family)",
      "--app-shadow-elevated": "var(--ant-box-shadow-secondary)",
    });
  });
});
