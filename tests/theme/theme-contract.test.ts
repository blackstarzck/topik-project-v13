import { describe, expect, test } from "vitest";
import {
  defaultAppearance,
  defaultThemeName,
  getAppTheme,
  getResolvedBridgeVarsByAppearance,
} from "../../src/theme";

// Phase 8 follow-up (2026-05-27) — antd v6.x compatibility fix:
// `theme` namespace에 "use client" marker + transitive createContext 평가 문제로
// server component에서 dynamic token 계산 불가. SSR fallback은 appearance 기반
// hardcoded values를 사용한다. 본 contract test는 새 API
// `getResolvedBridgeVarsByAppearance(appearance)`를 검증한다.

describe("app theme contract", () => {
  test("exposes a default Ant Design theme with CSS variables enabled (key + prefix)", () => {
    const theme = getAppTheme(defaultThemeName, defaultAppearance);

    expect(theme.name).toBe("default");
    expect(theme.appearance).toBe("light");
    // key = cache deduplication ID; prefix = CSS variable prefix (--ant-* by default)
    expect(theme.antd.cssVar).toEqual({ key: "talkpik", prefix: "ant" });
    expect(theme.antd.token?.fontFamily).toContain("system-ui");
  });

  test("getResolvedBridgeVarsByAppearance returns actual hex/px values — no var() chains", () => {
    const vars = getResolvedBridgeVarsByAppearance(defaultAppearance);

    // Must NOT be var(--ant-*) chains
    Object.values(vars).forEach((value) => {
      expect(value).not.toMatch(/^var\(--ant-/);
    });

    // Must be resolved actual values (antd v6.4.3 default seed token 기반)
    expect(vars["--app-color-primary"]).toBe("#1677ff");
    expect(vars["--app-color-bg-container"]).toBe("#ffffff");
    expect(vars["--app-color-border"]).toBe("#d9d9d9");
    expect(vars["--app-radius"]).toBe("6px");
    // colorText is rgba
    expect(vars["--app-color-text"]).toMatch(/rgba?\(/);
  });

  test("getResolvedBridgeVarsByAppearance dark appearance returns dark values", () => {
    const darkVars = getResolvedBridgeVarsByAppearance("dark");
    const lightVars = getResolvedBridgeVarsByAppearance("light");

    // Dark mode background must not be white
    expect(darkVars["--app-color-bg-container"]).not.toBe("#ffffff");
    // And must differ from light mode bg — catches "dark silently degraded to pale" regressions
    expect(darkVars["--app-color-bg-container"]).not.toBe(
      lightVars["--app-color-bg-container"],
    );
    // All values still resolved, not var() chains
    Object.values(darkVars).forEach((value) => {
      expect(value).not.toMatch(/^var\(--ant-/);
    });
  });

  test("flattens button drop shadows via shared component tokens (calm, not game-like)", () => {
    // DESIGN.md → Components: button-primary has no drop shadow. Branch 1 keeps
    // all 9 global tokens at AntD defaults; this is a component-scoped refinement
    // that must flow through createTheme into BOTH appearances.
    for (const appearance of ["light", "dark"] as const) {
      const built = getAppTheme(defaultThemeName, appearance);
      expect(built.antd.components?.Button?.primaryShadow).toBe("none");
      expect(built.antd.components?.Button?.defaultShadow).toBe("none");
      expect(built.antd.components?.Button?.dangerShadow).toBe("none");
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
