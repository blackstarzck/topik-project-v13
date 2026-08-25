import { readFileSync, readdirSync } from "node:fs";
import { extname, resolve } from "node:path";

import { describe, expect, test } from "vitest";

import {
  PHASE5D_ALTERNATE_THEME_MARKER,
  phase5dAlternateTheme,
} from "../e2e/fixtures/phase5d-alternate-theme";

import {
  allowedAppBridgeVars,
  createAppBridgeVars,
  createTheme,
  createThemeFamily,
  getResolvedBridgeVars,
  themePresets,
} from "../../src/theme";
import type { AppThemePreset } from "../../src/theme/types";
import {
  awesomicBridgeVars,
  awesomicThemeTokens,
} from "../../src/theme/tokens/awesomic";

const testAlternateSource = {
  marker: "test-alternate-bridge-fixture",
  colorPrimary: "#123456",
  colorBgLayout: "#e8edf2",
  colorBgContainer: "#fefefe",
  colorMaskSubtle: "rgba(31, 96, 168, 0.27)",
  colorText: "#102030",
  colorTextSecondary: "#506070",
  colorLinkSecondary: "#405de6",
  colorBorder: "#90a0b0",
  colorBorderSecondary: "#718293",
  colorChartSeriesPrimary: "#9c36b5",
  colorChartAccent: "#1971c2",
  colorStatusError: "#c21f52",
  colorStatusWarning: "#9a6700",
  colorStatusSuccess: "#087f5b",
  colorStatusStrongSuccess: "#005f45",
  colorFillSecondary: "rgba(18, 52, 86, 0.19)",
  radius: "12px",
  radiusNumber: 12,
  radiusCard: "18px",
  radiusCardNumber: 18,
  radiusPill: "10000px",
  radiusIndicator: "3px",
  radiusIndicatorNumber: 3,
  fontFamily: '"Test Alternate Sans", sans-serif',
  fontSizeCaption: "11px",
  fontSizeBody: "15px",
  fontSizeBodyLg: "17px",
  fontSizeSubheading: "19px",
  fontSizeHeadingSm: "21px",
  fontSizeHeading: "33px",
  fontSizeHeadingLg: "41px",
  fontSizeDisplaySm: "57px",
  fontSizeDisplay: "65px",
  shadowElevated: "0 9px 27px rgba(18, 52, 86, 0.17)",
} as const;

const productionSourceExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
  ".scss",
  ".sass",
  ".less",
]);

const generatedDirectoryNames = new Set([
  ".next",
  "build",
  "coverage",
  "dist",
  "generated",
  "__generated__",
]);

function isGeneratedArtifactPath(relativePath: string): boolean {
  return relativePath
    .replaceAll("\\", "/")
    .split("/")
    .some((segment) => generatedDirectoryNames.has(segment));
}

function dependencySpecifiers(source: string): string[] {
  const dependencyPattern =
    /(?:\b(?:import|export)\s+(?:[^"'()]*?\s+from\s+)?|@import\s+(?:url\(\s*)?|\b(?:import|require)\s*\(\s*)["']([^"']+)["']/g;

  return Array.from(source.matchAll(dependencyPattern), (match) => match[1]);
}

function referencesTestOnlyPath(specifier: string): boolean {
  const normalizedSpecifier = specifier.replaceAll("\\", "/");

  return (
    /(^|\/)tests?(\/|$)/i.test(normalizedSpecifier) ||
    /(^|\/)__tests__(\/|$)/i.test(normalizedSpecifier) ||
    /(^|[/._-])test(?:-only)?[-_]?fixtures?([/._-]|$)/i.test(
      normalizedSpecifier,
    )
  );
}

describe("generic app theme bridge contract", () => {
  test("projects a test-only alternate theme through every semantic bridge axis", () => {
    const alternate = createAppBridgeVars(testAlternateSource);

    expect(Object.keys(alternate)).toEqual(allowedAppBridgeVars);
    expect(alternate).toEqual({
      "--app-color-primary": "#123456",
      "--app-color-bg-layout": "#e8edf2",
      "--app-color-bg-container": "#fefefe",
      "--app-color-mask-subtle": "rgba(31, 96, 168, 0.27)",
      "--app-color-text": "#102030",
      "--app-color-text-secondary": "#506070",
      "--app-color-link-secondary": "#405de6",
      "--app-color-border": "#90a0b0",
      "--app-color-border-secondary": "#718293",
      "--app-color-chart-series-primary": "#9c36b5",
      "--app-color-chart-accent": "#1971c2",
      "--app-color-status-error": "#c21f52",
      "--app-color-status-warning": "#9a6700",
      "--app-color-status-success": "#087f5b",
      "--app-color-status-strong-success": "#005f45",
      "--app-color-fill-secondary": "rgba(18, 52, 86, 0.19)",
      "--app-radius": "12px",
      "--app-radius-card": "18px",
      "--app-radius-pill": "10000px",
      "--app-radius-indicator": "3px",
      "--app-font-family": '"Test Alternate Sans", sans-serif',
      "--app-font-size-caption": "11px",
      "--app-font-size-body": "15px",
      "--app-font-size-body-lg": "17px",
      "--app-font-size-subheading": "19px",
      "--app-font-size-heading-sm": "21px",
      "--app-font-size-heading": "33px",
      "--app-font-size-heading-lg": "41px",
      "--app-font-size-display-sm": "57px",
      "--app-font-size-display": "65px",
      "--app-shadow-elevated": "0 9px 27px rgba(18, 52, 86, 0.17)",
    });
  });

  test("adapts the same test-only source to AntD without registering it", () => {
    const testAlternatePreset = {
      name: "test-alternate",
      label: "Test alternate",
      description: testAlternateSource.marker,
      appearances: {
        light: {
          token: {
            colorPrimary: testAlternateSource.colorPrimary,
            colorBgLayout: testAlternateSource.colorBgLayout,
            colorBgContainer: testAlternateSource.colorBgContainer,
            colorText: testAlternateSource.colorText,
            colorTextSecondary: testAlternateSource.colorTextSecondary,
            colorBorder: testAlternateSource.colorBorder,
            colorBorderSecondary: testAlternateSource.colorBorderSecondary,
            blue: testAlternateSource.colorChartSeriesPrimary,
            cyan: testAlternateSource.colorChartAccent,
            colorError: testAlternateSource.colorStatusError,
            colorWarning: testAlternateSource.colorStatusWarning,
            colorSuccess: testAlternateSource.colorStatusSuccess,
            colorSuccessActive: testAlternateSource.colorStatusStrongSuccess,
            colorFillSecondary: testAlternateSource.colorFillSecondary,
            borderRadius: testAlternateSource.radiusNumber,
            borderRadiusLG: testAlternateSource.radiusCardNumber,
            borderRadiusXS: testAlternateSource.radiusIndicatorNumber,
            fontFamily: testAlternateSource.fontFamily,
            fontSize: Number.parseFloat(testAlternateSource.fontSizeBodyLg),
            boxShadowSecondary: testAlternateSource.shadowElevated,
          },
          components: {
            Card: {
              borderRadiusLG: testAlternateSource.radiusCardNumber,
            },
          },
        },
        dark: {
          token: {
            colorPrimary: testAlternateSource.colorPrimary,
            colorBgLayout: testAlternateSource.colorBgLayout,
            colorBgContainer: testAlternateSource.colorBgContainer,
            colorText: testAlternateSource.colorText,
            colorTextSecondary: testAlternateSource.colorTextSecondary,
            colorBorder: testAlternateSource.colorBorder,
            colorBorderSecondary: testAlternateSource.colorBorderSecondary,
            blue: testAlternateSource.colorChartSeriesPrimary,
            cyan: testAlternateSource.colorChartAccent,
            colorError: testAlternateSource.colorStatusError,
            colorWarning: testAlternateSource.colorStatusWarning,
            colorSuccess: testAlternateSource.colorStatusSuccess,
            colorSuccessActive: testAlternateSource.colorStatusStrongSuccess,
            colorFillSecondary: testAlternateSource.colorFillSecondary,
            borderRadius: testAlternateSource.radiusNumber,
            borderRadiusLG: testAlternateSource.radiusCardNumber,
            borderRadiusXS: testAlternateSource.radiusIndicatorNumber,
            fontFamily: testAlternateSource.fontFamily,
            fontSize: Number.parseFloat(testAlternateSource.fontSizeBodyLg),
            boxShadowSecondary: testAlternateSource.shadowElevated,
          },
          components: {
            Card: {
              borderRadiusLG: testAlternateSource.radiusCardNumber,
            },
          },
        },
      },
    } satisfies AppThemePreset<"test-alternate">;

    const lightTheme = createTheme(testAlternatePreset, "light");
    const themeFamily = createThemeFamily(testAlternatePreset);

    expect(lightTheme.antd.token).toMatchObject({
      colorPrimary: testAlternateSource.colorPrimary,
      colorBgLayout: testAlternateSource.colorBgLayout,
      colorBgContainer: testAlternateSource.colorBgContainer,
      colorText: testAlternateSource.colorText,
      colorTextSecondary: testAlternateSource.colorTextSecondary,
      colorBorder: testAlternateSource.colorBorder,
      colorBorderSecondary: testAlternateSource.colorBorderSecondary,
      blue: testAlternateSource.colorChartSeriesPrimary,
      cyan: testAlternateSource.colorChartAccent,
      colorError: testAlternateSource.colorStatusError,
      colorWarning: testAlternateSource.colorStatusWarning,
      colorSuccess: testAlternateSource.colorStatusSuccess,
      colorSuccessActive: testAlternateSource.colorStatusStrongSuccess,
      colorFillSecondary: testAlternateSource.colorFillSecondary,
      borderRadius: testAlternateSource.radiusNumber,
      borderRadiusLG: testAlternateSource.radiusCardNumber,
      borderRadiusXS: testAlternateSource.radiusIndicatorNumber,
      fontFamily: testAlternateSource.fontFamily,
      fontSize: 17,
      boxShadowSecondary: testAlternateSource.shadowElevated,
    });
    expect(themeFamily.light.antd.token).toEqual(lightTheme.antd.token);
    expect(themeFamily.dark.antd.token).toMatchObject({
      borderRadiusLG: testAlternateSource.radiusCardNumber,
      fontFamily: testAlternateSource.fontFamily,
      fontSize: 17,
    });
    expect(lightTheme.antd.components?.Card?.borderRadiusLG).toBe(
      testAlternateSource.radiusCardNumber,
    );
    expect(themeFamily.dark.antd.components?.Card?.borderRadiusLG).toBe(
      testAlternateSource.radiusCardNumber,
    );
    expect(themePresets).not.toHaveProperty("test-alternate");
  });

  test("keeps the browser alternate fixture complete and visibly distinct", () => {
    expect(Object.keys(phase5dAlternateTheme.appBridgeVars)).toEqual(
      allowedAppBridgeVars,
    );
    expect(phase5dAlternateTheme.appBridgeVars["--app-color-mask-subtle"]).toBe(
      "rgba(139, 44, 255, 0.31)",
    );
    expect(
      phase5dAlternateTheme.appBridgeVars["--app-color-mask-subtle"],
    ).not.toBe(awesomicThemeTokens.overlay.maskSubtle);
    expect(
      phase5dAlternateTheme.appBridgeVars["--app-color-border-secondary"],
    ).not.toBe(awesomicThemeTokens.border.secondary.light);
    expect(
      phase5dAlternateTheme.appBridgeVars["--app-color-chart-accent"],
    ).not.toBe(awesomicThemeTokens.chart.accent);
    expect(
      phase5dAlternateTheme.appBridgeVars["--app-color-chart-series-primary"],
    ).not.toBe(awesomicThemeTokens.chart.seriesPrimary);
    expect(phase5dAlternateTheme.appBridgeVars["--app-radius-card"]).toBe(
      "23px",
    );
    expect(phase5dAlternateTheme.appBridgeVars["--app-radius-pill"]).toBe(
      "12000px",
    );
    expect(phase5dAlternateTheme.antdRadiusByAppearance).toEqual({
      light: { card: "23px", global: "23px" },
      dark: { card: "23px", global: "23px" },
    });
  });

  test("enforces the alternate fixture production-source and dependency boundary", () => {
    const sourceDirectory = resolve(process.cwd(), "src");
    const productionSourceFiles = readdirSync(sourceDirectory, {
      encoding: "utf8",
      recursive: true,
    })
      .filter(
        (relativePath) =>
          productionSourceExtensions.has(extname(relativePath)) &&
          !isGeneratedArtifactPath(relativePath),
      )
      .map((relativePath) => ({
        relativePath: relativePath.replaceAll("\\", "/"),
        source: readFileSync(resolve(sourceDirectory, relativePath), "utf8"),
      }));
    const testOnlyValues = [
      testAlternateSource.marker,
      testAlternateSource.fontFamily,
      testAlternateSource.shadowElevated,
      testAlternateSource.colorStatusError,
      testAlternateSource.colorStatusWarning,
      testAlternateSource.colorStatusSuccess,
      testAlternateSource.colorStatusStrongSuccess,
      testAlternateSource.colorFillSecondary,
      testAlternateSource.colorMaskSubtle,
      testAlternateSource.colorBorderSecondary,
      testAlternateSource.colorChartSeriesPrimary,
      testAlternateSource.colorChartAccent,
      PHASE5D_ALTERNATE_THEME_MARKER,
      phase5dAlternateTheme.appBridgeVars["--app-color-mask-subtle"],
      phase5dAlternateTheme.appBridgeVars["--app-color-border-secondary"],
      phase5dAlternateTheme.appBridgeVars["--app-color-chart-series-primary"],
      phase5dAlternateTheme.appBridgeVars["--app-color-chart-accent"],
      'radiusCard: "23px"',
      'radiusPill: "12000px"',
    ];
    const sourceValueViolations = productionSourceFiles.flatMap(
      ({ relativePath, source }) =>
        testOnlyValues
          .filter((value) => source.includes(value))
          .map((value) => ({ relativePath, value })),
    );
    const dependencyViolations = productionSourceFiles.flatMap(
      ({ relativePath, source }) =>
        dependencySpecifiers(source)
          .filter(referencesTestOnlyPath)
          .map((specifier) => ({ relativePath, specifier })),
    );

    // This proves the checked-in production source boundary only. Built-artifact
    // marker absence remains a Phase checkpoint responsibility.
    expect(sourceValueViolations).toEqual([]);
    expect(dependencyViolations).toEqual([]);
    expect(themePresets).not.toHaveProperty("test-alternate");
  });

  test("keeps the selected production theme equivalent to the generic projection", () => {
    expect(
      createAppBridgeVars({
        colorPrimary: awesomicThemeTokens.color.obsidian,
        colorBgLayout: awesomicThemeTokens.color.mist,
        colorBgContainer: awesomicThemeTokens.color.snow,
        colorMaskSubtle: awesomicThemeTokens.overlay.maskSubtle,
        colorText: awesomicThemeTokens.color.ink,
        colorTextSecondary: awesomicThemeTokens.color.steel,
        colorLinkSecondary: awesomicThemeTokens.color.linkSecondary,
        colorBorder: awesomicThemeTokens.color.pebble,
        colorBorderSecondary: awesomicThemeTokens.border.secondary.light,
        colorChartSeriesPrimary: awesomicThemeTokens.chart.seriesPrimary,
        colorChartAccent: awesomicThemeTokens.chart.accent,
        colorStatusError: awesomicThemeTokens.status.light.error,
        colorStatusWarning: awesomicThemeTokens.status.light.warning,
        colorStatusSuccess: awesomicThemeTokens.status.light.success,
        colorStatusStrongSuccess:
          awesomicThemeTokens.status.light.strongSuccess,
        colorFillSecondary: awesomicThemeTokens.status.light.fillSecondary,
        radius: `${awesomicThemeTokens.radius.base}px`,
        radiusCard: `${awesomicThemeTokens.radius.card}px`,
        radiusPill: `${awesomicThemeTokens.radius.pill}px`,
        radiusIndicator: `${awesomicThemeTokens.radius.indicator}px`,
        fontFamily: awesomicThemeTokens.font.runtimeFamily,
        fontSizeCaption: awesomicThemeTokens.fontSize.caption,
        fontSizeBody: awesomicThemeTokens.fontSize.body,
        fontSizeBodyLg: awesomicThemeTokens.fontSize.bodyLg,
        fontSizeSubheading: awesomicThemeTokens.fontSize.subheading,
        fontSizeHeadingSm: awesomicThemeTokens.fontSize.headingSm,
        fontSizeHeading: awesomicThemeTokens.fontSize.heading,
        fontSizeHeadingLg: awesomicThemeTokens.fontSize.headingLg,
        fontSizeDisplaySm: awesomicThemeTokens.fontSize.displaySm,
        fontSizeDisplay: awesomicThemeTokens.fontSize.display,
        shadowElevated: awesomicThemeTokens.shadow.elevated,
      }),
    ).toEqual(awesomicBridgeVars);
  });

  test("keeps the default light and dark bridge fallbacks complete", () => {
    expect(getResolvedBridgeVars("default", "light")).toMatchObject({
      "--app-font-size-heading-sm": "20px",
      "--app-color-status-error": "#ff4d4f",
      "--app-color-status-warning": "#faad14",
      "--app-color-status-success": "#52c41a",
      "--app-color-status-strong-success": "#389e0d",
      "--app-color-fill-secondary": "rgba(0, 0, 0, 0.06)",
      "--app-color-mask-subtle": "rgba(244, 244, 245, 0.18)",
      "--app-color-border-secondary": "#f0f0f0",
      "--app-color-chart-series-primary": "#1677ff",
      "--app-color-chart-accent": "#13c2c2",
      "--app-radius-indicator": "2px",
      "--app-radius-card": "8px",
      "--app-radius-pill": "10000px",
    });
    expect(getResolvedBridgeVars("default", "dark")).toMatchObject({
      "--app-font-size-heading-sm": "20px",
      "--app-color-status-error": "#dc4446",
      "--app-color-status-warning": "#d89614",
      "--app-color-status-success": "#49aa19",
      "--app-color-status-strong-success": "#3c8618",
      "--app-color-fill-secondary": "rgba(255, 255, 255, 0.12)",
      "--app-color-mask-subtle": "rgba(0, 0, 0, 0.18)",
      "--app-color-border-secondary": "#303030",
      "--app-color-chart-series-primary": "#1677ff",
      "--app-color-chart-accent": "#13c2c2",
      "--app-radius-indicator": "2px",
      "--app-radius-card": "8px",
      "--app-radius-pill": "10000px",
    });
  });
});
