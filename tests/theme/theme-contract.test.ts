import { describe, expect, test } from "vitest";
import {
  awesomicPrimaryActionShadow,
  defaultAppearance,
  defaultThemeName,
  getAppTheme,
  getResolvedBridgeVarsByAppearance,
} from "../../src/theme";

// antd v6.x compatibility fix:
// `theme` namespace에 "use client" marker + transitive createContext 평가 문제가
// 있어 server component에서 dynamic token 계산 불가. SSR fallback은 Awesomic
// light-fixed hardcoded values를 사용한다.

describe("app theme contract", () => {
  test("exposes the Awesomic default Ant Design theme with CSS variables enabled", () => {
    const theme = getAppTheme(defaultThemeName, defaultAppearance);

    expect(theme.name).toBe("default");
    expect(theme.appearance).toBe("light");
    // key = cache deduplication ID; prefix = CSS variable prefix (--ant-* by default)
    expect(theme.antd.cssVar).toEqual({ key: "talkpik", prefix: "ant" });
    expect(theme.antd.token?.fontFamily).toContain("--font-pretendard");
    expect(theme.antd.token?.fontFamily).toContain("system-ui");
    expect(theme.antd.token?.colorPrimary).toBe("#09090b");
    expect(theme.antd.token?.colorText).toBe("#18181b");
    expect(theme.antd.token?.colorTextSecondary).toBe("#71717a");
    expect(theme.antd.token?.colorBorder).toBe("#d4d4d8");
    expect(theme.antd.token?.colorBgLayout).toBe("#f4f4f5");
    expect(theme.antd.token?.borderRadius).toBe(14);
  });

  test("getResolvedBridgeVarsByAppearance returns actual hex/px values — no var() chains", () => {
    const vars = getResolvedBridgeVarsByAppearance(defaultAppearance);

    // Must NOT be var(--ant-*) chains
    Object.values(vars).forEach((value) => {
      expect(value).not.toMatch(/^var\(--ant-/);
    });

    // Must be resolved actual values (Awesomic light-fixed baseline)
    expect(vars["--app-color-primary"]).toBe("#09090b");
    expect(vars["--app-color-bg-container"]).toBe("#ffffff");
    expect(vars["--app-color-bg-layout"]).toBe("#f4f4f5");
    expect(vars["--app-color-border"]).toBe("#d4d4d8");
    expect(vars["--app-radius"]).toBe("14px");
    expect(vars["--app-color-text"]).toBe("#18181b");
  });

  test("getResolvedBridgeVarsByAppearance is light-fixed even for dark requests", () => {
    const darkVars = getResolvedBridgeVarsByAppearance("dark");
    const lightVars = getResolvedBridgeVarsByAppearance("light");

    expect(darkVars).toEqual(lightVars);
    // All values still resolved, not var() chains
    Object.values(darkVars).forEach((value) => {
      expect(value).not.toMatch(/^var\(--ant-/);
    });
  });

  test("binds Awesomic component tokens through shared component tokens", () => {
    for (const appearance of ["light", "dark"] as const) {
      const built = getAppTheme(defaultThemeName, appearance);
      expect(built.antd.components?.Button?.borderRadius).toBe(36);
      expect(built.antd.components?.Button?.primaryShadow).toBe(
        awesomicPrimaryActionShadow,
      );
      expect(built.antd.components?.Button?.defaultShadow).toBe("none");
      expect(built.antd.components?.Button?.dangerShadow).toBe("none");
      expect(built.antd.components?.Card?.borderRadiusLG).toBe(36);
      expect(built.antd.components?.Input?.borderRadius).toBe(14);
      expect(built.antd.components?.Tag?.borderRadiusSM).toBe(12);
    }
  });

  test("getResolvedBridgeVarsByAppearance covers all required bridge keys", () => {
    const vars = getResolvedBridgeVarsByAppearance(defaultAppearance);
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
