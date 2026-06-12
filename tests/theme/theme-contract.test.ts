import { describe, expect, test } from "vitest";
import {
  defaultAppearance,
  defaultThemeName,
  getAppTheme,
  getResolvedBridgeVars,
  getResolvedBridgeVarsByAppearance,
  themePresets,
  themeSettings,
} from "../../src/theme";
import {
  awesomicThemeTokens,
  type AppBridgeVarName,
} from "../../src/theme/tokens/awesomic";

// Phase 8 follow-up (2026-05-27) — antd v6.x compatibility fix:
// `theme` namespace에 "use client" marker + transitive createContext 평가 문제로
// server component에서 dynamic token 계산 불가. SSR fallback은 appearance 기반
// hardcoded values를 사용한다. 본 contract test는 새 API
// `getResolvedBridgeVarsByAppearance(appearance)`를 검증한다.

describe("app theme contract", () => {
  test("exposes a default Ant Design theme with CSS variables enabled (key + prefix)", () => {
    const theme = getAppTheme(defaultThemeName, defaultAppearance);

    expect(themeSettings.main).toBe("awesomic");
    expect(themePresets).toHaveProperty(themeSettings.main);
    expect(theme.name).toBe("awesomic");
    expect(theme.appearance).toBe("light");
    // key = cache deduplication ID; prefix = CSS variable prefix (--ant-* by default)
    expect(theme.antd.cssVar).toEqual({ key: "talkpik", prefix: "ant" });
    expect(theme.antd.token?.fontFamily).toContain("--font-pretendard");
    expect(theme.antd.token?.fontFamily).toContain("system-ui");
  });

  test("getResolvedBridgeVarsByAppearance returns actual hex/px values — no var() chains", () => {
    const vars = getResolvedBridgeVarsByAppearance(defaultAppearance);

    // Must NOT be var(--ant-*) chains
    Object.values(vars).forEach((value) => {
      expect(value).not.toMatch(/^var\(--ant-/);
    });

    // Must be resolved actual values from DESIGN/Awesomic, not AntD defaults.
    expect(vars["--app-color-primary"]).toBe(awesomicThemeTokens.color.obsidian);
    expect(vars["--app-color-bg-layout"]).toBe(awesomicThemeTokens.color.mist);
    expect(vars["--app-color-bg-container"]).toBe(
      awesomicThemeTokens.color.snow,
    );
    expect(vars["--app-color-border"]).toBe(awesomicThemeTokens.color.pebble);
    expect(vars["--app-radius"]).toBe(
      `${awesomicThemeTokens.radius.base}px`,
    );
    expect(vars["--app-color-text"]).toBe(awesomicThemeTokens.color.ink);
    expect(vars["--app-color-text-secondary"]).toBe(
      awesomicThemeTokens.color.steel,
    );
  });

  test("getResolvedBridgeVars can resolve the stock AntD fallback theme", () => {
    const defaultVars = getResolvedBridgeVars("default", "light");

    expect(defaultVars["--app-color-primary"]).toBe("#1677ff");
    expect(defaultVars["--app-color-border"]).toBe("#d9d9d9");
    expect(defaultVars["--app-radius"]).toBe("6px");
  });

  test("applies Awesomic global and component tokens to both appearances", () => {
    for (const appearance of ["light", "dark"] as const) {
      const built = getAppTheme(defaultThemeName, appearance);
      expect(built.antd.token?.colorPrimary).toBe(
        awesomicThemeTokens.color.obsidian,
      );
      expect(built.antd.token?.colorText).toBe(awesomicThemeTokens.color.ink);
      expect(built.antd.token?.colorBgLayout).toBe(
        awesomicThemeTokens.color.mist,
      );
      expect(built.antd.token?.colorBgContainer).toBe(
        awesomicThemeTokens.color.snow,
      );
      expect(built.antd.token?.borderRadius).toBe(
        awesomicThemeTokens.radius.base,
      );
      expect(built.antd.token?.borderRadiusSM).toBe(
        awesomicThemeTokens.radius.badge,
      );
      expect(built.antd.token?.borderRadiusLG).toBe(
        awesomicThemeTokens.radius.base,
      );
      expect(built.antd.components?.Card?.borderRadiusLG).toBe(
        awesomicThemeTokens.radius.card,
      );
      expect(built.antd.components?.Input?.borderRadius).toBe(
        awesomicThemeTokens.radius.input,
      );
      expect(built.antd.components?.Tag?.borderRadiusSM).toBe(
        awesomicThemeTokens.radius.badge,
      );
      expect(built.antd.components?.Button?.borderRadius).toBe(
        awesomicThemeTokens.radius.button,
      );
      expect(built.antd.components?.Button?.primaryShadow).toBe("none");
      expect(built.antd.components?.Button?.defaultShadow).toBe("none");
      expect(built.antd.components?.Button?.dangerShadow).toBe("none");
    }
  });

  test("getResolvedBridgeVarsByAppearance covers all required bridge keys", () => {
    const vars = getResolvedBridgeVarsByAppearance(defaultAppearance);
    const requiredKeys: AppBridgeVarName[] = [
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
