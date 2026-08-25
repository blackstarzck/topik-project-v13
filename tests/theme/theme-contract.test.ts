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
import { awesomicThemeTokens } from "../../src/theme/tokens/awesomic";
import type { AppBridgeVarName } from "../../src/theme/bridge-contract";

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
    expect(vars["--app-color-primary"]).toBe(
      awesomicThemeTokens.color.obsidian,
    );
    expect(vars["--app-color-bg-layout"]).toBe(awesomicThemeTokens.color.mist);
    expect(vars["--app-color-bg-container"]).toBe(
      awesomicThemeTokens.color.snow,
    );
    expect(vars["--app-color-border"]).toBe(awesomicThemeTokens.color.pebble);
    expect(vars["--app-color-border-secondary"]).toBe(
      awesomicThemeTokens.border.secondary.light,
    );
    expect(vars["--app-color-chart-accent"]).toBe(
      awesomicThemeTokens.chart.accent,
    );
    expect(vars["--app-color-chart-series-primary"]).toBe(
      awesomicThemeTokens.chart.seriesPrimary,
    );
    expect(vars["--app-color-landing-cta-primary"]).toBe(
      awesomicThemeTokens.landingCta.primary,
    );
    expect(vars["--app-color-landing-cta-primary-hover"]).toBe(
      awesomicThemeTokens.landingCta.primaryHover,
    );
    expect(vars["--app-radius-landing-hero-cta"]).toBe(
      `${awesomicThemeTokens.radius.landingHeroCta}px`,
    );
    expect(vars["--app-radius"]).toBe(`${awesomicThemeTokens.radius.base}px`);
    expect(vars["--app-radius-card"]).toBe(
      `${awesomicThemeTokens.radius.card}px`,
    );
    expect(vars["--app-radius-pill"]).toBe(
      `${awesomicThemeTokens.radius.pill}px`,
    );
    expect(vars["--app-color-text"]).toBe(awesomicThemeTokens.color.ink);
    expect(vars["--app-color-text-secondary"]).toBe(
      awesomicThemeTokens.color.steel,
    );
    expect(
      (awesomicThemeTokens.color as Record<string, string>).linkSecondary,
    ).toBe("#3254F2");
    expect((vars as Record<string, string>)["--app-color-link-secondary"]).toBe(
      "#3254F2",
    );
  });

  test("owns the auth character palette and preserves its current art in every production theme", () => {
    expect(awesomicThemeTokens).toHaveProperty("authCharacter", {
      color: {
        purple: "#6c3ff5",
        charcoal: "#2d2d2d",
        coral: "#ff9b6b",
        yellow: "#e8d754",
        ink: "#25262d",
        eye: "#ffffff",
      },
      radius: {
        baseEdge: 0,
        bodyTop: 10,
        pill: 999,
      },
    });

    const expectedBridge = {
      "--app-color-auth-character-purple":
        awesomicThemeTokens.authCharacter.color.purple,
      "--app-color-auth-character-charcoal":
        awesomicThemeTokens.authCharacter.color.charcoal,
      "--app-color-auth-character-coral":
        awesomicThemeTokens.authCharacter.color.coral,
      "--app-color-auth-character-yellow":
        awesomicThemeTokens.authCharacter.color.yellow,
      "--app-color-auth-character-ink":
        awesomicThemeTokens.authCharacter.color.ink,
      "--app-color-auth-character-eye":
        awesomicThemeTokens.authCharacter.color.eye,
      "--app-radius-auth-character-base-edge": `${awesomicThemeTokens.authCharacter.radius.baseEdge}px`,
      "--app-radius-auth-character-body-top": `${awesomicThemeTokens.authCharacter.radius.bodyTop}px`,
      "--app-radius-auth-character-pill": `${awesomicThemeTokens.authCharacter.radius.pill}px`,
    };

    for (const themeName of ["default", defaultThemeName] as const) {
      for (const appearance of ["light", "dark"] as const) {
        expect(getResolvedBridgeVars(themeName, appearance)).toMatchObject(
          expectedBridge,
        );
      }
    }
  });

  test("owns the portfolio landing foreground and typography in every production theme", () => {
    expect(awesomicThemeTokens).toHaveProperty("landingPortfolio", {
      color: {
        foreground: "#0c0c0d",
        headingAccent: "#a5a5aa",
        supporting: "#77777b",
        muted: "#8b8b8e",
        faint: "#b6b6b8",
        label: "#1c1c1f",
        footerHover: "#3c3c40",
      },
      font: {
        display: '"Space Grotesk", var(--app-font-family), sans-serif',
        numeric: '"Montserrat", var(--app-font-family), sans-serif',
      },
    });

    const expectedBridge = {
      "--app-color-landing-portfolio-foreground":
        awesomicThemeTokens.landingPortfolio.color.foreground,
      "--app-color-landing-portfolio-heading-accent":
        awesomicThemeTokens.landingPortfolio.color.headingAccent,
      "--app-color-landing-portfolio-supporting":
        awesomicThemeTokens.landingPortfolio.color.supporting,
      "--app-color-landing-portfolio-muted":
        awesomicThemeTokens.landingPortfolio.color.muted,
      "--app-color-landing-portfolio-faint":
        awesomicThemeTokens.landingPortfolio.color.faint,
      "--app-color-landing-portfolio-label":
        awesomicThemeTokens.landingPortfolio.color.label,
      "--app-color-landing-portfolio-footer-hover":
        awesomicThemeTokens.landingPortfolio.color.footerHover,
      "--app-font-landing-portfolio-display":
        awesomicThemeTokens.landingPortfolio.font.display,
      "--app-font-landing-portfolio-numeric":
        awesomicThemeTokens.landingPortfolio.font.numeric,
    };

    for (const themeName of ["default", defaultThemeName] as const) {
      for (const appearance of ["light", "dark"] as const) {
        expect(getResolvedBridgeVars(themeName, appearance)).toMatchObject(
          expectedBridge,
        );
      }
    }
  });

  test("getResolvedBridgeVars can resolve the stock AntD fallback theme", () => {
    const defaultVars = getResolvedBridgeVars("default", "light");

    expect(defaultVars["--app-color-primary"]).toBe("#1677ff");
    expect(defaultVars["--app-color-border"]).toBe("#d9d9d9");
    expect(defaultVars["--app-color-border-secondary"]).toBe("#f0f0f0");
    expect(defaultVars["--app-color-chart-series-primary"]).toBe("#1677ff");
    expect(defaultVars["--app-color-chart-accent"]).toBe("#13c2c2");
    expect(defaultVars["--app-radius"]).toBe("6px");
    expect(defaultVars["--app-radius-card"]).toBe("8px");
    expect(defaultVars["--app-radius-pill"]).toBe("10000px");
    expect(defaultVars["--app-color-landing-cta-primary"]).toBe("#070203");
    expect(defaultVars["--app-color-landing-cta-primary-hover"]).toBe(
      "#21080c",
    );
    expect(defaultVars["--app-radius-landing-hero-cta"]).toBe("0px");
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
      expect(
        getResolvedBridgeVars(defaultThemeName, appearance)[
          "--app-radius-card"
        ],
      ).toBe(`${built.antd.components?.Card?.borderRadiusLG}px`);
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
      "--app-color-link-secondary",
      "--app-color-border",
      "--app-color-border-secondary",
      "--app-color-chart-series-primary",
      "--app-color-chart-accent",
      "--app-color-landing-cta-primary",
      "--app-color-landing-cta-primary-hover",
      "--app-color-landing-cta-foreground",
      "--app-color-landing-cta-ghost-surface",
      "--app-color-landing-cta-ghost-text",
      "--app-color-landing-cta-ghost-border",
      "--app-radius",
      "--app-radius-card",
      "--app-radius-pill",
      "--app-radius-landing-hero-cta",
      "--app-font-family",
      "--app-shadow-elevated",
    ];

    requiredKeys.forEach((key) => {
      expect(vars).toHaveProperty(key);
      expect(vars[key]).toBeTruthy();
    });
  });

  test("applies global AntD form control scale through theme tokens", () => {
    for (const appearance of ["light", "dark"] as const) {
      const built = getAppTheme(defaultThemeName, appearance);

      expect(built.antd.token?.fontSize).toBe(16);
      expect(built.antd.token?.fontSizeLG).toBe(16);
      expect(built.antd.token?.controlHeight).toBe(40);
      expect(built.antd.token?.controlHeightLG).toBe(48);

      expect(built.antd.components?.Form?.labelFontSize).toBe(16);
      expect(built.antd.components?.Form?.itemMarginBottom).toBe(32);
      expect(built.antd.components?.Form?.verticalLabelPadding).toBe(
        "0 0 12px",
      );
      expect(built.antd.components?.Input?.inputFontSize).toBe(16);
      expect(built.antd.components?.Input?.inputFontSizeLG).toBe(16);
      expect(built.antd.components?.Select?.optionFontSize).toBe(16);
      expect(built.antd.components?.Select?.optionHeight).toBe(40);
    }
  });
});
