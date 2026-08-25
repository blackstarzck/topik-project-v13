import { readFileSync, readdirSync } from "node:fs";
import { extname, resolve } from "node:path";

import { describe, expect, test } from "vitest";

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
  colorText: "#102030",
  colorTextSecondary: "#506070",
  colorLinkSecondary: "#405de6",
  colorBorder: "#90a0b0",
  radius: "12px",
  radiusNumber: 12,
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
      "--app-color-text": "#102030",
      "--app-color-text-secondary": "#506070",
      "--app-color-link-secondary": "#405de6",
      "--app-color-border": "#90a0b0",
      "--app-radius": "12px",
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
            borderRadius: testAlternateSource.radiusNumber,
            fontFamily: testAlternateSource.fontFamily,
            fontSize: Number.parseFloat(testAlternateSource.fontSizeBodyLg),
            boxShadowSecondary: testAlternateSource.shadowElevated,
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
            borderRadius: testAlternateSource.radiusNumber,
            fontFamily: testAlternateSource.fontFamily,
            fontSize: Number.parseFloat(testAlternateSource.fontSizeBodyLg),
            boxShadowSecondary: testAlternateSource.shadowElevated,
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
      borderRadius: testAlternateSource.radiusNumber,
      fontFamily: testAlternateSource.fontFamily,
      fontSize: 17,
      boxShadowSecondary: testAlternateSource.shadowElevated,
    });
    expect(themeFamily.light.antd.token).toEqual(lightTheme.antd.token);
    expect(themeFamily.dark.antd.token).toMatchObject({
      fontFamily: testAlternateSource.fontFamily,
      fontSize: 17,
    });
    expect(themePresets).not.toHaveProperty("test-alternate");
  });

  test("enforces the alternate fixture production-source and dependency boundary", () => {
    const sourceDirectory = resolve(process.cwd(), "src");
    const productionSourceFiles = readdirSync(sourceDirectory, {
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
        colorText: awesomicThemeTokens.color.ink,
        colorTextSecondary: awesomicThemeTokens.color.steel,
        colorLinkSecondary: awesomicThemeTokens.color.linkSecondary,
        colorBorder: awesomicThemeTokens.color.pebble,
        radius: `${awesomicThemeTokens.radius.base}px`,
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

  test("keeps the default heading-sm bridge fallback at 20px", () => {
    expect(getResolvedBridgeVars("default", "light")).toMatchObject({
      "--app-font-size-heading-sm": "20px",
    });
    expect(getResolvedBridgeVars("default", "dark")).toMatchObject({
      "--app-font-size-heading-sm": "20px",
    });
  });
});
