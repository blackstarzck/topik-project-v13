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
  colorTextInverse: "#fff6d6",
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
  colorWritingExamHeaderSurface: "rgba(91, 43, 196, 0.79)",
  colorWritingMaterialRowActiveSurface: "rgba(253, 126, 20, 0.21)",
  colorWritingBlankActiveSurface: "rgba(36, 158, 128, 0.29)",
  colorWritingBlankFilledBorder: "#df4b91",
  colorWritingManuscriptIntroSurface: "#f8ddff",
  colorWritingManuscriptIntroBorder: "#7135d1",
  colorWritingManuscriptBodySurface: "#dcfff0",
  colorWritingManuscriptBodyBorder: "#058d73",
  colorWritingManuscriptConclusionSurface: "#fff1b8",
  colorWritingManuscriptConclusionBorder: "#b96500",
  colorLandingCtaPrimary: "#5b2bc4",
  colorLandingCtaPrimaryHover: "#351474",
  colorLandingCtaForeground: "#fff2cf",
  colorLandingCtaGhostSurface: "#f1e7ff",
  colorLandingCtaGhostText: "#29104f",
  colorLandingCtaGhostBorder: "#51b9ad",
  colorLandingHeroOuterCanvas: "#f0ddff",
  colorLandingHeroMediaFallback: "#7b574a",
  colorLandingHeroHeaderSurface: "rgba(207, 249, 238, 0.66)",
  colorLandingHeroHeaderForeground: "#341057",
  colorLandingHeroHeaderHover: "#a12970",
  colorLandingHeroForeground: "#fff3b8",
  colorLandingHeroKicker: "rgba(252, 210, 91, 0.74)",
  colorLandingHeroBody: "rgba(185, 251, 232, 0.83)",
  colorLandingPortfolioForeground: "#27104f",
  colorLandingPortfolioHeadingAccent: "#7055a8",
  colorLandingPortfolioSupporting: "#286f65",
  colorLandingPortfolioMuted: "#8f2a61",
  colorLandingPortfolioFaint: "#b66c1e",
  colorLandingPortfolioLabel: "#124d68",
  colorLandingPortfolioFooterHover: "#c12e68",
  colorLandingPortfolioCanvas: "#fff4c2",
  colorLandingPortfolioDarkSurface: "#31105e",
  colorLandingPortfolioInverseForeground: "#f4ffe2",
  colorLandingPortfolioTagSurface: "rgba(248, 81, 162, 0.61)",
  colorLandingPortfolioCardSurface: "#e3f8ff",
  colorLandingPortfolioDivider: "#019b88",
  colorLandingPortfolioDividerSubtle: "#7950f2",
  colorLandingPortfolioActionHover: "#c2255c",
  backgroundLandingPortfolioMediaPlaceholder:
    "repeating-linear-gradient(45deg, #fd7e14 0 6px, #7048e8 6px 12px), #12b886",
  backgroundLandingPortfolioMediaOverlay:
    "linear-gradient(120deg, rgba(112, 72, 232, 0.41), rgba(18, 184, 134, 0.33))",
  colorAuthPromptFocusOutline: "rgba(91, 43, 196, 0.23)",
  colorAuthPromptLoginFocusBorder: "#e03f9f",
  colorAuthConsentDocumentSurface: "#f7c8ea",
  colorAuthCharacterPurple: "#7416a8",
  colorAuthCharacterCharcoal: "#17343c",
  colorAuthCharacterCoral: "#f94f78",
  colorAuthCharacterYellow: "#c98b00",
  colorAuthCharacterInk: "#221142",
  colorAuthCharacterEye: "#ecffff",
  radius: "12px",
  radiusNone: "0px",
  radiusNumber: 12,
  radiusCard: "18px",
  radiusCardNumber: 18,
  radiusPill: "10000px",
  radiusIndicator: "3px",
  radiusIndicatorNumber: 3,
  radiusLandingHeroCta: "13px",
  radiusAuthPromptControl: "20px",
  radiusAuthVerifyEmailCard: "29px",
  radiusAuthVerifyEmailCardCompact: "13px",
  radiusAuthCharacterBaseEdge: "2px",
  radiusAuthCharacterBodyTop: "11px",
  radiusAuthCharacterPill: "777px",
  radiusLandingPortfolioMedia: "6px",
  radiusLandingPortfolioRound: "46%",
  radiusLandingPortfolioTagPill: "889px",
  radiusWritingMaterialCompactSurface: "7px",
  sizeAuthPromptControl: "57px",
  fontFamily: '"Test Alternate Sans", sans-serif',
  fontLandingPortfolioDisplay: '"Bridge Display", serif',
  fontLandingPortfolioNumeric: '"Bridge Numeric", monospace',
  fontWritingManuscriptMono: '"Contract Manuscript Mono", monospace',
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
  shadowFloatingAction: "0 10px 26px rgba(54, 20, 96, 0.21)",
  shadowPopover:
    "0 22px 54px rgba(45, 13, 86, 0.27), 0 6px 18px rgba(2, 112, 94, 0.17)",
  shadowMessage:
    "0 9px 22px 0 rgba(74, 18, 106, 0.19), 0 4px 9px -2px rgba(0, 131, 109, 0.14)",
  shadowWritingMaterialTooltip: "0 8px 18px rgb(91 43 196 / 22%)",
  shadowWritingBlankFocus: "0 0 0 5px rgba(48, 160, 125, 0.31)",
  shadowWritingBlankActiveInset: "inset 0 -4px 0 #8f2a61",
  shadowWritingManuscriptIntroInset: "inset 0 0 0 3px rgba(113, 53, 209, 0.35)",
  shadowWritingManuscriptBodyInset: "inset 0 0 0 4px rgba(5, 141, 115, 0.33)",
  shadowWritingManuscriptConclusionInset:
    "inset 0 0 0 5px rgba(185, 101, 0, 0.37)",
  shadowAuthPromptFocus: "0 0 0 3px rgba(91, 43, 196, 0.23)",
  shadowAuthPromptLoginFocus: "0 0 0 4px rgba(224, 63, 159, 0.27)",
  shadowAuthVerifyEmailCard: "0 12px 30px rgba(91, 43, 196, 0.28)",
} as const;

const authCharacterBridgeVars = [
  "--app-color-auth-character-purple",
  "--app-color-auth-character-charcoal",
  "--app-color-auth-character-coral",
  "--app-color-auth-character-yellow",
  "--app-color-auth-character-ink",
  "--app-color-auth-character-eye",
  "--app-radius-auth-character-base-edge",
  "--app-radius-auth-character-body-top",
  "--app-radius-auth-character-pill",
] as const;

const landingHeroBridgeVars = [
  "--app-color-landing-hero-outer-canvas",
  "--app-color-landing-hero-media-fallback",
  "--app-color-landing-hero-header-surface",
  "--app-color-landing-hero-header-foreground",
  "--app-color-landing-hero-header-hover",
  "--app-color-landing-hero-foreground",
  "--app-color-landing-hero-kicker",
  "--app-color-landing-hero-body",
] as const;

const sharedOverlayShadowBridgeVars = [
  "--app-shadow-floating-action",
  "--app-shadow-popover",
  "--app-shadow-message",
] as const;

const landingPortfolioBridgeVars = [
  "--app-color-landing-portfolio-foreground",
  "--app-color-landing-portfolio-heading-accent",
  "--app-color-landing-portfolio-supporting",
  "--app-color-landing-portfolio-muted",
  "--app-color-landing-portfolio-faint",
  "--app-color-landing-portfolio-label",
  "--app-color-landing-portfolio-footer-hover",
  "--app-font-landing-portfolio-display",
  "--app-font-landing-portfolio-numeric",
  "--app-color-landing-portfolio-canvas",
  "--app-color-landing-portfolio-dark-surface",
  "--app-color-landing-portfolio-inverse-foreground",
  "--app-color-landing-portfolio-tag-surface",
  "--app-color-landing-portfolio-card-surface",
  "--app-color-landing-portfolio-divider",
  "--app-color-landing-portfolio-divider-subtle",
  "--app-color-landing-portfolio-action-hover",
  "--app-background-landing-portfolio-media-placeholder",
  "--app-background-landing-portfolio-media-overlay",
  "--app-radius-landing-portfolio-media",
  "--app-radius-landing-portfolio-round",
  "--app-radius-landing-portfolio-tag-pill",
] as const;

const writingManuscriptBridgeVars = [
  "--app-font-writing-manuscript-mono",
  "--app-color-writing-manuscript-intro-surface",
  "--app-color-writing-manuscript-intro-border",
  "--app-shadow-writing-manuscript-intro-inset",
  "--app-color-writing-manuscript-body-surface",
  "--app-color-writing-manuscript-body-border",
  "--app-shadow-writing-manuscript-body-inset",
  "--app-color-writing-manuscript-conclusion-surface",
  "--app-color-writing-manuscript-conclusion-border",
  "--app-shadow-writing-manuscript-conclusion-inset",
] as const;

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
      "--app-color-text-inverse": "#fff6d6",
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
      "--app-color-writing-exam-header-surface": "rgba(91, 43, 196, 0.79)",
      "--app-color-writing-material-row-active-surface":
        "rgba(253, 126, 20, 0.21)",
      "--app-color-writing-blank-active-surface": "rgba(36, 158, 128, 0.29)",
      "--app-color-writing-blank-filled-border": "#df4b91",
      "--app-color-writing-manuscript-intro-surface": "#f8ddff",
      "--app-color-writing-manuscript-intro-border": "#7135d1",
      "--app-color-writing-manuscript-body-surface": "#dcfff0",
      "--app-color-writing-manuscript-body-border": "#058d73",
      "--app-color-writing-manuscript-conclusion-surface": "#fff1b8",
      "--app-color-writing-manuscript-conclusion-border": "#b96500",
      "--app-color-landing-cta-primary": "#5b2bc4",
      "--app-color-landing-cta-primary-hover": "#351474",
      "--app-color-landing-cta-foreground": "#fff2cf",
      "--app-color-landing-cta-ghost-surface": "#f1e7ff",
      "--app-color-landing-cta-ghost-text": "#29104f",
      "--app-color-landing-cta-ghost-border": "#51b9ad",
      "--app-color-landing-hero-outer-canvas": "#f0ddff",
      "--app-color-landing-hero-media-fallback": "#7b574a",
      "--app-color-landing-hero-header-surface": "rgba(207, 249, 238, 0.66)",
      "--app-color-landing-hero-header-foreground": "#341057",
      "--app-color-landing-hero-header-hover": "#a12970",
      "--app-color-landing-hero-foreground": "#fff3b8",
      "--app-color-landing-hero-kicker": "rgba(252, 210, 91, 0.74)",
      "--app-color-landing-hero-body": "rgba(185, 251, 232, 0.83)",
      "--app-color-landing-portfolio-foreground": "#27104f",
      "--app-color-landing-portfolio-heading-accent": "#7055a8",
      "--app-color-landing-portfolio-supporting": "#286f65",
      "--app-color-landing-portfolio-muted": "#8f2a61",
      "--app-color-landing-portfolio-faint": "#b66c1e",
      "--app-color-landing-portfolio-label": "#124d68",
      "--app-color-landing-portfolio-footer-hover": "#c12e68",
      "--app-color-landing-portfolio-canvas": "#fff4c2",
      "--app-color-landing-portfolio-dark-surface": "#31105e",
      "--app-color-landing-portfolio-inverse-foreground": "#f4ffe2",
      "--app-color-landing-portfolio-tag-surface": "rgba(248, 81, 162, 0.61)",
      "--app-color-landing-portfolio-card-surface": "#e3f8ff",
      "--app-color-landing-portfolio-divider": "#019b88",
      "--app-color-landing-portfolio-divider-subtle": "#7950f2",
      "--app-color-landing-portfolio-action-hover": "#c2255c",
      "--app-background-landing-portfolio-media-placeholder":
        "repeating-linear-gradient(45deg, #fd7e14 0 6px, #7048e8 6px 12px), #12b886",
      "--app-background-landing-portfolio-media-overlay":
        "linear-gradient(120deg, rgba(112, 72, 232, 0.41), rgba(18, 184, 134, 0.33))",
      "--app-color-auth-prompt-focus-outline": "rgba(91, 43, 196, 0.23)",
      "--app-color-auth-prompt-login-focus-border": "#e03f9f",
      "--app-color-auth-consent-document-surface": "#f7c8ea",
      "--app-color-auth-character-purple": "#7416a8",
      "--app-color-auth-character-charcoal": "#17343c",
      "--app-color-auth-character-coral": "#f94f78",
      "--app-color-auth-character-yellow": "#c98b00",
      "--app-color-auth-character-ink": "#221142",
      "--app-color-auth-character-eye": "#ecffff",
      "--app-radius": "12px",
      "--app-radius-none": "0px",
      "--app-radius-card": "18px",
      "--app-radius-pill": "10000px",
      "--app-radius-indicator": "3px",
      "--app-radius-landing-hero-cta": "13px",
      "--app-radius-auth-prompt-control": "20px",
      "--app-radius-auth-verify-email-card": "29px",
      "--app-radius-auth-verify-email-card-compact": "13px",
      "--app-radius-auth-character-base-edge": "2px",
      "--app-radius-auth-character-body-top": "11px",
      "--app-radius-auth-character-pill": "777px",
      "--app-radius-landing-portfolio-media": "6px",
      "--app-radius-landing-portfolio-round": "46%",
      "--app-radius-landing-portfolio-tag-pill": "889px",
      "--app-radius-writing-material-compact-surface": "7px",
      "--app-size-auth-prompt-control": "57px",
      "--app-font-family": '"Test Alternate Sans", sans-serif',
      "--app-font-landing-portfolio-display": '"Bridge Display", serif',
      "--app-font-landing-portfolio-numeric": '"Bridge Numeric", monospace',
      "--app-font-writing-manuscript-mono":
        '"Contract Manuscript Mono", monospace',
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
      "--app-shadow-floating-action": "0 10px 26px rgba(54, 20, 96, 0.21)",
      "--app-shadow-popover":
        "0 22px 54px rgba(45, 13, 86, 0.27), 0 6px 18px rgba(2, 112, 94, 0.17)",
      "--app-shadow-message":
        "0 9px 22px 0 rgba(74, 18, 106, 0.19), 0 4px 9px -2px rgba(0, 131, 109, 0.14)",
      "--app-shadow-writing-material-tooltip":
        "0 8px 18px rgb(91 43 196 / 22%)",
      "--app-shadow-writing-blank-focus": "0 0 0 5px rgba(48, 160, 125, 0.31)",
      "--app-shadow-writing-blank-active-inset": "inset 0 -4px 0 #8f2a61",
      "--app-shadow-writing-manuscript-intro-inset":
        "inset 0 0 0 3px rgba(113, 53, 209, 0.35)",
      "--app-shadow-writing-manuscript-body-inset":
        "inset 0 0 0 4px rgba(5, 141, 115, 0.33)",
      "--app-shadow-writing-manuscript-conclusion-inset":
        "inset 0 0 0 5px rgba(185, 101, 0, 0.37)",
      "--app-shadow-auth-prompt-focus": "0 0 0 3px rgba(91, 43, 196, 0.23)",
      "--app-shadow-auth-prompt-login-focus":
        "0 0 0 4px rgba(224, 63, 159, 0.27)",
      "--app-shadow-auth-verify-email-card":
        "0 12px 30px rgba(91, 43, 196, 0.28)",
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
    expect(
      phase5dAlternateTheme.appBridgeVars[
        "--app-color-writing-exam-header-surface"
      ],
    ).not.toBe(awesomicThemeTokens.writingExam.color.headerSurface);
    const writingMaterialBridgeVars = [
      "--app-color-writing-material-row-active-surface",
      "--app-radius-writing-material-compact-surface",
      "--app-shadow-writing-material-tooltip",
    ] as const;
    const productionWritingMaterialValues = [
      awesomicThemeTokens.writingMaterial.color.rowActiveSurface,
      `${awesomicThemeTokens.writingMaterial.radius.compactSurface}px`,
      awesomicThemeTokens.writingMaterial.shadow.tooltip,
    ];
    const alternateWritingMaterialValues = writingMaterialBridgeVars.map(
      (varName) => phase5dAlternateTheme.appBridgeVars[varName],
    );
    expect(new Set(alternateWritingMaterialValues)).toHaveLength(3);
    alternateWritingMaterialValues.forEach((value, index) => {
      expect(value).not.toBe(productionWritingMaterialValues[index]);
    });
    const writingBlankBridgeVars = [
      "--app-color-writing-blank-active-surface",
      "--app-color-writing-blank-filled-border",
      "--app-shadow-writing-blank-focus",
      "--app-shadow-writing-blank-active-inset",
      "--app-color-text-inverse",
    ] as const;
    const productionWritingBlankValues = [
      awesomicThemeTokens.writingBlank.color.activeSurface,
      awesomicThemeTokens.writingBlank.color.filledBorder,
      awesomicThemeTokens.writingBlank.shadow.focus,
      awesomicThemeTokens.writingBlank.shadow.activeInset,
      awesomicThemeTokens.color.textInverse,
    ];
    const alternateWritingBlankValues = writingBlankBridgeVars.map(
      (varName) => phase5dAlternateTheme.appBridgeVars[varName],
    );
    expect(new Set(alternateWritingBlankValues)).toHaveLength(5);
    alternateWritingBlankValues.forEach((value, index) => {
      expect(value).not.toBe(productionWritingBlankValues[index]);
    });
    const alternateWritingManuscriptValues = writingManuscriptBridgeVars.map(
      (varName) =>
        (phase5dAlternateTheme.appBridgeVars as Record<string, string>)[
          varName
        ],
    );
    expect(new Set(alternateWritingManuscriptValues)).toHaveLength(10);
    for (const appearance of ["light", "dark"] as const) {
      const production = getResolvedBridgeVars(
        "awesomic",
        appearance,
      ) as Record<string, string>;
      writingManuscriptBridgeVars.forEach((varName, index) => {
        expect(alternateWritingManuscriptValues[index]).toBeTruthy();
        expect(alternateWritingManuscriptValues[index]).not.toBe(
          production[varName],
        );
      });
    }
    expect(phase5dAlternateTheme.appBridgeVars["--app-radius-none"]).toBe(
      "0px",
    );
    expect(phase5dAlternateTheme.appBridgeVars["--app-radius-card"]).toBe(
      "23px",
    );
    expect(phase5dAlternateTheme.appBridgeVars["--app-radius-pill"]).toBe(
      "12000px",
    );
    expect(
      phase5dAlternateTheme.appBridgeVars["--app-color-landing-cta-primary"],
    ).not.toBe(awesomicThemeTokens.landingCta.primary);
    expect(
      phase5dAlternateTheme.appBridgeVars[
        "--app-color-landing-cta-primary-hover"
      ],
    ).not.toBe(awesomicThemeTokens.landingCta.primaryHover);
    expect(
      phase5dAlternateTheme.appBridgeVars["--app-radius-landing-hero-cta"],
    ).not.toBe(`${awesomicThemeTokens.radius.landingHeroCta}px`);
    expect(
      phase5dAlternateTheme.appBridgeVars[
        "--app-color-auth-prompt-login-focus-border"
      ],
    ).not.toBe(awesomicThemeTokens.authPrompt.loginFocusBorder);
    expect(
      phase5dAlternateTheme.appBridgeVars[
        "--app-shadow-auth-prompt-login-focus"
      ],
    ).not.toBe(awesomicThemeTokens.authPrompt.loginFocusShadow);
    expect(
      phase5dAlternateTheme.appBridgeVars["--app-radius-auth-prompt-control"],
    ).not.toBe(`${awesomicThemeTokens.authPrompt.radius}px`);
    expect(
      phase5dAlternateTheme.appBridgeVars["--app-size-auth-prompt-control"],
    ).not.toBe(`${awesomicThemeTokens.authPrompt.controlHeight}px`);
    expect(phase5dAlternateTheme.antdRadiusByAppearance).toEqual({
      light: { card: "23px", global: "23px" },
      dark: { card: "23px", global: "23px" },
    });

    const productionAuthCharacterValues = [
      ["--app-color-auth-character-purple", "#6c3ff5"],
      ["--app-color-auth-character-charcoal", "#2d2d2d"],
      ["--app-color-auth-character-coral", "#ff9b6b"],
      ["--app-color-auth-character-yellow", "#e8d754"],
      ["--app-color-auth-character-ink", "#25262d"],
      ["--app-color-auth-character-eye", "#ffffff"],
      ["--app-radius-auth-character-base-edge", "0px"],
      ["--app-radius-auth-character-body-top", "10px"],
      ["--app-radius-auth-character-pill", "999px"],
    ] as const;

    expect(productionAuthCharacterValues).toHaveLength(
      authCharacterBridgeVars.length,
    );
    for (const [varName, productionValue] of productionAuthCharacterValues) {
      expect(phase5dAlternateTheme.appBridgeVars[varName]).toBeTruthy();
      expect(phase5dAlternateTheme.appBridgeVars[varName]).not.toBe(
        productionValue,
      );
    }

    const productionSharedOverlayShadowValues = [
      ["--app-shadow-floating-action", "0 6px 18px rgba(42, 55, 89, 0.1)"],
      [
        "--app-shadow-popover",
        "0 16px 42px rgba(15, 23, 42, 0.16), 0 4px 14px rgba(15, 23, 42, 0.1)",
      ],
      [
        "--app-shadow-message",
        "0 6px 16px 0 rgba(0, 0, 0, 0.1), 0 2px 6px -2px rgba(0, 0, 0, 0.08)",
      ],
    ] as const;

    expect(productionSharedOverlayShadowValues).toHaveLength(
      sharedOverlayShadowBridgeVars.length,
    );
    expect(
      new Set(
        sharedOverlayShadowBridgeVars.map(
          (varName) => phase5dAlternateTheme.appBridgeVars[varName],
        ),
      ),
    ).toHaveLength(sharedOverlayShadowBridgeVars.length);
    for (const [
      varName,
      productionValue,
    ] of productionSharedOverlayShadowValues) {
      expect(phase5dAlternateTheme.appBridgeVars[varName]).toBeTruthy();
      expect(phase5dAlternateTheme.appBridgeVars[varName]).not.toBe(
        productionValue,
      );
    }

    const productionLandingHeroValues = [
      ["--app-color-landing-hero-outer-canvas", "#f7f3ef"],
      ["--app-color-landing-hero-media-fallback", "#ccc2b7"],
      ["--app-color-landing-hero-header-surface", "rgba(255, 255, 255, 0.72)"],
      ["--app-color-landing-hero-header-foreground", "#0c0c0d"],
      ["--app-color-landing-hero-header-hover", "#8b8b8e"],
      ["--app-color-landing-hero-foreground", "#ffffff"],
      ["--app-color-landing-hero-kicker", "rgba(255, 255, 255, 0.72)"],
      ["--app-color-landing-hero-body", "rgba(255, 255, 255, 0.82)"],
    ] as const;

    expect(productionLandingHeroValues).toHaveLength(
      landingHeroBridgeVars.length,
    );
    expect(
      new Set(
        landingHeroBridgeVars.map(
          (varName) => phase5dAlternateTheme.appBridgeVars[varName],
        ),
      ),
    ).toHaveLength(landingHeroBridgeVars.length);
    for (const [varName, productionValue] of productionLandingHeroValues) {
      expect(phase5dAlternateTheme.appBridgeVars[varName]).toBeTruthy();
      expect(phase5dAlternateTheme.appBridgeVars[varName]).not.toBe(
        productionValue,
      );
    }

    const productionLandingPortfolioValues = [
      ["--app-color-landing-portfolio-foreground", "#0c0c0d"],
      ["--app-color-landing-portfolio-heading-accent", "#a5a5aa"],
      ["--app-color-landing-portfolio-supporting", "#77777b"],
      ["--app-color-landing-portfolio-muted", "#8b8b8e"],
      ["--app-color-landing-portfolio-faint", "#b6b6b8"],
      ["--app-color-landing-portfolio-label", "#1c1c1f"],
      ["--app-color-landing-portfolio-footer-hover", "#3c3c40"],
      [
        "--app-font-landing-portfolio-display",
        '"Space Grotesk", var(--app-font-family), sans-serif',
      ],
      [
        "--app-font-landing-portfolio-numeric",
        '"Montserrat", var(--app-font-family), sans-serif',
      ],
      ["--app-color-landing-portfolio-canvas", "#ffffff"],
      ["--app-color-landing-portfolio-dark-surface", "#0c0c0d"],
      ["--app-color-landing-portfolio-inverse-foreground", "#ffffff"],
      [
        "--app-color-landing-portfolio-tag-surface",
        "rgba(255, 255, 255, 0.72)",
      ],
      ["--app-color-landing-portfolio-card-surface", "#fbfbfb"],
      ["--app-color-landing-portfolio-divider", "#b9b9b3"],
      ["--app-color-landing-portfolio-divider-subtle", "#dededc"],
      ["--app-color-landing-portfolio-action-hover", "#1c1c1f"],
      [
        "--app-background-landing-portfolio-media-placeholder",
        "repeating-linear-gradient(135deg, #e9e9e8 0 10px, #f1f1f0 10px 20px), #ececeb",
      ],
      [
        "--app-background-landing-portfolio-media-overlay",
        "linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(0, 0, 0, 0.04))",
      ],
      ["--app-radius-landing-portfolio-media", "4px"],
      ["--app-radius-landing-portfolio-round", "50%"],
      ["--app-radius-landing-portfolio-tag-pill", "999px"],
    ] as const;

    expect(productionLandingPortfolioValues).toHaveLength(
      landingPortfolioBridgeVars.length,
    );
    expect(
      new Set(
        landingPortfolioBridgeVars.map(
          (varName) => phase5dAlternateTheme.appBridgeVars[varName],
        ),
      ),
    ).toHaveLength(landingPortfolioBridgeVars.length);
    for (const [varName, productionValue] of productionLandingPortfolioValues) {
      expect(phase5dAlternateTheme.appBridgeVars[varName]).toBeTruthy();
      expect(phase5dAlternateTheme.appBridgeVars[varName]).not.toBe(
        productionValue,
      );
    }
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
      testAlternateSource.colorTextInverse,
      testAlternateSource.colorWritingBlankActiveSurface,
      testAlternateSource.colorWritingBlankFilledBorder,
      testAlternateSource.shadowWritingBlankFocus,
      testAlternateSource.shadowWritingBlankActiveInset,
      testAlternateSource.fontWritingManuscriptMono,
      testAlternateSource.colorWritingManuscriptIntroSurface,
      testAlternateSource.colorWritingManuscriptIntroBorder,
      testAlternateSource.shadowWritingManuscriptIntroInset,
      testAlternateSource.colorWritingManuscriptBodySurface,
      testAlternateSource.colorWritingManuscriptBodyBorder,
      testAlternateSource.shadowWritingManuscriptBodyInset,
      testAlternateSource.colorWritingManuscriptConclusionSurface,
      testAlternateSource.colorWritingManuscriptConclusionBorder,
      testAlternateSource.shadowWritingManuscriptConclusionInset,
      testAlternateSource.colorAuthConsentDocumentSurface,
      testAlternateSource.shadowAuthVerifyEmailCard,
      PHASE5D_ALTERNATE_THEME_MARKER,
      phase5dAlternateTheme.appBridgeVars["--app-color-mask-subtle"],
      phase5dAlternateTheme.appBridgeVars["--app-color-border-secondary"],
      phase5dAlternateTheme.appBridgeVars["--app-color-chart-series-primary"],
      phase5dAlternateTheme.appBridgeVars["--app-color-chart-accent"],
      phase5dAlternateTheme.appBridgeVars[
        "--app-color-writing-exam-header-surface"
      ],
      phase5dAlternateTheme.appBridgeVars[
        "--app-color-writing-material-row-active-surface"
      ],
      phase5dAlternateTheme.appBridgeVars[
        "--app-radius-writing-material-compact-surface"
      ],
      phase5dAlternateTheme.appBridgeVars[
        "--app-shadow-writing-material-tooltip"
      ],
      phase5dAlternateTheme.appBridgeVars["--app-color-text-inverse"],
      phase5dAlternateTheme.appBridgeVars[
        "--app-color-writing-blank-active-surface"
      ],
      phase5dAlternateTheme.appBridgeVars[
        "--app-color-writing-blank-filled-border"
      ],
      phase5dAlternateTheme.appBridgeVars["--app-shadow-writing-blank-focus"],
      phase5dAlternateTheme.appBridgeVars[
        "--app-shadow-writing-blank-active-inset"
      ],
      phase5dAlternateTheme.appBridgeVars["--app-color-landing-cta-primary"],
      phase5dAlternateTheme.appBridgeVars[
        "--app-color-landing-cta-primary-hover"
      ],
      phase5dAlternateTheme.appBridgeVars["--app-color-landing-cta-foreground"],
      phase5dAlternateTheme.appBridgeVars[
        "--app-color-landing-cta-ghost-surface"
      ],
      phase5dAlternateTheme.appBridgeVars["--app-color-landing-cta-ghost-text"],
      phase5dAlternateTheme.appBridgeVars[
        "--app-color-landing-cta-ghost-border"
      ],
      phase5dAlternateTheme.appBridgeVars[
        "--app-color-auth-prompt-focus-outline"
      ],
      phase5dAlternateTheme.appBridgeVars[
        "--app-color-auth-prompt-login-focus-border"
      ],
      phase5dAlternateTheme.appBridgeVars["--app-shadow-auth-prompt-focus"],
      phase5dAlternateTheme.appBridgeVars[
        "--app-shadow-auth-prompt-login-focus"
      ],
      phase5dAlternateTheme.appBridgeVars[
        "--app-color-auth-consent-document-surface"
      ],
      phase5dAlternateTheme.appBridgeVars[
        "--app-shadow-auth-verify-email-card"
      ],
      ...authCharacterBridgeVars.map(
        (varName) => phase5dAlternateTheme.appBridgeVars[varName],
      ),
      ...landingHeroBridgeVars.map(
        (varName) => phase5dAlternateTheme.appBridgeVars[varName],
      ),
      ...sharedOverlayShadowBridgeVars.map(
        (varName) => phase5dAlternateTheme.appBridgeVars[varName],
      ),
      ...landingPortfolioBridgeVars.map(
        (varName) => phase5dAlternateTheme.appBridgeVars[varName],
      ),
      ...writingManuscriptBridgeVars.map(
        (varName) => phase5dAlternateTheme.appBridgeVars[varName],
      ),
      'radiusCard: "23px"',
      'radiusPill: "12000px"',
      'radiusLandingHeroCta: "17px"',
      'radiusAuthPromptControl: "25px"',
      'radiusAuthVerifyEmailCard: "31px"',
      'radiusAuthVerifyEmailCardCompact: "14px"',
      'sizeAuthPromptControl: "58px"',
    ].filter((value): value is string => typeof value === "string");
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
        colorTextInverse: awesomicThemeTokens.color.textInverse,
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
        colorWritingExamHeaderSurface:
          awesomicThemeTokens.writingExam.color.headerSurface,
        colorWritingMaterialRowActiveSurface:
          awesomicThemeTokens.writingMaterial.color.rowActiveSurface,
        colorWritingBlankActiveSurface:
          awesomicThemeTokens.writingBlank.color.activeSurface,
        colorWritingBlankFilledBorder:
          awesomicThemeTokens.writingBlank.color.filledBorder,
        colorWritingManuscriptIntroSurface:
          awesomicThemeTokens.writingManuscript.section.intro.surface,
        colorWritingManuscriptIntroBorder:
          awesomicThemeTokens.writingManuscript.section.intro.border,
        colorWritingManuscriptBodySurface:
          awesomicThemeTokens.writingManuscript.section.body.surface.light,
        colorWritingManuscriptBodyBorder:
          awesomicThemeTokens.writingManuscript.section.body.border,
        colorWritingManuscriptConclusionSurface:
          awesomicThemeTokens.writingManuscript.section.conclusion.surface
            .light,
        colorWritingManuscriptConclusionBorder:
          awesomicThemeTokens.writingManuscript.section.conclusion.border,
        colorLandingCtaPrimary: awesomicThemeTokens.landingCta.primary,
        colorLandingCtaPrimaryHover:
          awesomicThemeTokens.landingCta.primaryHover,
        colorLandingCtaForeground: awesomicThemeTokens.landingCta.foreground,
        colorLandingCtaGhostSurface:
          awesomicThemeTokens.landingCta.ghostSurface,
        colorLandingCtaGhostText: awesomicThemeTokens.landingCta.ghostText,
        colorLandingCtaGhostBorder: awesomicThemeTokens.landingCta.ghostBorder,
        colorLandingHeroOuterCanvas:
          awesomicThemeTokens.landingHero.color.outerCanvas,
        colorLandingHeroMediaFallback:
          awesomicThemeTokens.landingHero.color.mediaFallback,
        colorLandingHeroHeaderSurface:
          awesomicThemeTokens.landingHero.color.headerSurface,
        colorLandingHeroHeaderForeground:
          awesomicThemeTokens.landingHero.color.headerForeground,
        colorLandingHeroHeaderHover:
          awesomicThemeTokens.landingHero.color.headerHover,
        colorLandingHeroForeground:
          awesomicThemeTokens.landingHero.color.foreground,
        colorLandingHeroKicker: awesomicThemeTokens.landingHero.color.kicker,
        colorLandingHeroBody: awesomicThemeTokens.landingHero.color.body,
        colorLandingPortfolioForeground:
          awesomicThemeTokens.landingPortfolio.color.foreground,
        colorLandingPortfolioHeadingAccent:
          awesomicThemeTokens.landingPortfolio.color.headingAccent,
        colorLandingPortfolioSupporting:
          awesomicThemeTokens.landingPortfolio.color.supporting,
        colorLandingPortfolioMuted:
          awesomicThemeTokens.landingPortfolio.color.muted,
        colorLandingPortfolioFaint:
          awesomicThemeTokens.landingPortfolio.color.faint,
        colorLandingPortfolioLabel:
          awesomicThemeTokens.landingPortfolio.color.label,
        colorLandingPortfolioFooterHover:
          awesomicThemeTokens.landingPortfolio.color.footerHover,
        colorLandingPortfolioCanvas:
          awesomicThemeTokens.landingPortfolio.color.canvas,
        colorLandingPortfolioDarkSurface:
          awesomicThemeTokens.landingPortfolio.color.darkSurface,
        colorLandingPortfolioInverseForeground:
          awesomicThemeTokens.landingPortfolio.color.inverseForeground,
        colorLandingPortfolioTagSurface:
          awesomicThemeTokens.landingPortfolio.color.tagSurface,
        colorLandingPortfolioCardSurface:
          awesomicThemeTokens.landingPortfolio.color.cardSurface,
        colorLandingPortfolioDivider:
          awesomicThemeTokens.landingPortfolio.color.divider,
        colorLandingPortfolioDividerSubtle:
          awesomicThemeTokens.landingPortfolio.color.dividerSubtle,
        colorLandingPortfolioActionHover:
          awesomicThemeTokens.landingPortfolio.color.actionHover,
        backgroundLandingPortfolioMediaPlaceholder:
          awesomicThemeTokens.landingPortfolio.background.mediaPlaceholder,
        backgroundLandingPortfolioMediaOverlay:
          awesomicThemeTokens.landingPortfolio.background.mediaOverlay,
        colorAuthPromptFocusOutline:
          awesomicThemeTokens.authPrompt.focusOutline,
        colorAuthPromptLoginFocusBorder:
          awesomicThemeTokens.authPrompt.loginFocusBorder,
        colorAuthConsentDocumentSurface:
          awesomicThemeTokens.authConsent.documentSurface,
        colorAuthCharacterPurple:
          awesomicThemeTokens.authCharacter.color.purple,
        colorAuthCharacterCharcoal:
          awesomicThemeTokens.authCharacter.color.charcoal,
        colorAuthCharacterCoral: awesomicThemeTokens.authCharacter.color.coral,
        colorAuthCharacterYellow:
          awesomicThemeTokens.authCharacter.color.yellow,
        colorAuthCharacterInk: awesomicThemeTokens.authCharacter.color.ink,
        colorAuthCharacterEye: awesomicThemeTokens.authCharacter.color.eye,
        radius: `${awesomicThemeTokens.radius.base}px`,
        radiusNone: `${awesomicThemeTokens.radius.none}px`,
        radiusCard: `${awesomicThemeTokens.radius.card}px`,
        radiusPill: `${awesomicThemeTokens.radius.pill}px`,
        radiusIndicator: `${awesomicThemeTokens.radius.indicator}px`,
        radiusLandingHeroCta: `${awesomicThemeTokens.radius.landingHeroCta}px`,
        radiusAuthPromptControl: `${awesomicThemeTokens.authPrompt.radius}px`,
        radiusAuthVerifyEmailCard: `${awesomicThemeTokens.authVerifyEmail.radius.card}px`,
        radiusAuthVerifyEmailCardCompact: `${awesomicThemeTokens.authVerifyEmail.radius.compact}px`,
        radiusAuthCharacterBaseEdge: `${awesomicThemeTokens.authCharacter.radius.baseEdge}px`,
        radiusAuthCharacterBodyTop: `${awesomicThemeTokens.authCharacter.radius.bodyTop}px`,
        radiusAuthCharacterPill: `${awesomicThemeTokens.authCharacter.radius.pill}px`,
        radiusLandingPortfolioMedia: `${awesomicThemeTokens.landingPortfolio.radius.media}px`,
        radiusLandingPortfolioRound:
          awesomicThemeTokens.landingPortfolio.radius.round,
        radiusLandingPortfolioTagPill: `${awesomicThemeTokens.landingPortfolio.radius.tagPill}px`,
        radiusWritingMaterialCompactSurface: `${awesomicThemeTokens.writingMaterial.radius.compactSurface}px`,
        sizeAuthPromptControl: `${awesomicThemeTokens.authPrompt.controlHeight}px`,
        fontFamily: awesomicThemeTokens.font.runtimeFamily,
        fontLandingPortfolioDisplay:
          awesomicThemeTokens.landingPortfolio.font.display,
        fontLandingPortfolioNumeric:
          awesomicThemeTokens.landingPortfolio.font.numeric,
        fontWritingManuscriptMono:
          awesomicThemeTokens.writingManuscript.font.mono,
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
        shadowFloatingAction: awesomicThemeTokens.shadow.floatingAction,
        shadowPopover: awesomicThemeTokens.shadow.popover,
        shadowMessage: awesomicThemeTokens.shadow.message,
        shadowWritingMaterialTooltip:
          awesomicThemeTokens.writingMaterial.shadow.tooltip,
        shadowWritingBlankFocus: awesomicThemeTokens.writingBlank.shadow.focus,
        shadowWritingBlankActiveInset:
          awesomicThemeTokens.writingBlank.shadow.activeInset,
        shadowWritingManuscriptIntroInset:
          awesomicThemeTokens.writingManuscript.section.intro.inset,
        shadowWritingManuscriptBodyInset:
          awesomicThemeTokens.writingManuscript.section.body.inset,
        shadowWritingManuscriptConclusionInset:
          awesomicThemeTokens.writingManuscript.section.conclusion.inset,
        shadowAuthPromptFocus: awesomicThemeTokens.authPrompt.focusShadow,
        shadowAuthPromptLoginFocus:
          awesomicThemeTokens.authPrompt.loginFocusShadow,
        shadowAuthVerifyEmailCard:
          awesomicThemeTokens.authVerifyEmail.shadow.card,
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
      "--app-color-text-inverse": "#ffffff",
      "--app-color-writing-blank-active-surface":
        "color-mix(in srgb, var(--app-color-primary) 6%, var(--app-color-bg-container))",
      "--app-color-writing-blank-filled-border":
        "color-mix(in srgb, var(--app-color-primary) 42%, var(--app-color-border))",
      "--app-font-writing-manuscript-mono":
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      "--app-color-writing-manuscript-intro-surface":
        "color-mix(in srgb, var(--app-color-primary) 12%, var(--app-color-bg-container))",
      "--app-color-writing-manuscript-intro-border":
        "color-mix(in srgb, var(--app-color-primary) 48%, var(--app-color-border))",
      "--app-shadow-writing-manuscript-intro-inset":
        "inset 0 0 0 1px color-mix(in srgb, var(--app-color-primary) 30%, transparent)",
      "--app-color-writing-manuscript-body-surface": "#f6ffed",
      "--app-color-writing-manuscript-body-border":
        "color-mix(in srgb, var(--app-color-status-success) 48%, var(--app-color-border))",
      "--app-shadow-writing-manuscript-body-inset":
        "inset 0 0 0 1px color-mix(in srgb, var(--app-color-status-success) 30%, transparent)",
      "--app-color-writing-manuscript-conclusion-surface": "#fffbe6",
      "--app-color-writing-manuscript-conclusion-border":
        "color-mix(in srgb, var(--app-color-status-warning) 48%, var(--app-color-border))",
      "--app-shadow-writing-manuscript-conclusion-inset":
        "inset 0 0 0 1px color-mix(in srgb, var(--app-color-status-warning) 30%, transparent)",
      "--app-radius-none": "0px",
      "--app-radius-indicator": "2px",
      "--app-radius-card": "8px",
      "--app-radius-pill": "10000px",
      "--app-color-writing-exam-header-surface":
        "color-mix(in srgb, var(--app-color-bg-container) 92%, transparent)",
      "--app-color-writing-material-row-active-surface":
        "color-mix(in srgb, var(--app-color-primary) 8%, transparent)",
      "--app-radius-writing-material-compact-surface": "4px",
      "--app-shadow-writing-material-tooltip": "0 4px 12px rgb(0 0 0 / 6%)",
      "--app-shadow-writing-blank-focus":
        "0 0 0 2px color-mix(in srgb, var(--app-color-primary) 18%, transparent)",
      "--app-shadow-writing-blank-active-inset":
        "inset 0 -2px 0 var(--app-color-primary)",
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
      "--app-color-text-inverse": "#ffffff",
      "--app-color-writing-blank-active-surface":
        "color-mix(in srgb, var(--app-color-primary) 6%, var(--app-color-bg-container))",
      "--app-color-writing-blank-filled-border":
        "color-mix(in srgb, var(--app-color-primary) 42%, var(--app-color-border))",
      "--app-font-writing-manuscript-mono":
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      "--app-color-writing-manuscript-intro-surface":
        "color-mix(in srgb, var(--app-color-primary) 12%, var(--app-color-bg-container))",
      "--app-color-writing-manuscript-intro-border":
        "color-mix(in srgb, var(--app-color-primary) 48%, var(--app-color-border))",
      "--app-shadow-writing-manuscript-intro-inset":
        "inset 0 0 0 1px color-mix(in srgb, var(--app-color-primary) 30%, transparent)",
      "--app-color-writing-manuscript-body-surface": "#162312",
      "--app-color-writing-manuscript-body-border":
        "color-mix(in srgb, var(--app-color-status-success) 48%, var(--app-color-border))",
      "--app-shadow-writing-manuscript-body-inset":
        "inset 0 0 0 1px color-mix(in srgb, var(--app-color-status-success) 30%, transparent)",
      "--app-color-writing-manuscript-conclusion-surface": "#2b2111",
      "--app-color-writing-manuscript-conclusion-border":
        "color-mix(in srgb, var(--app-color-status-warning) 48%, var(--app-color-border))",
      "--app-shadow-writing-manuscript-conclusion-inset":
        "inset 0 0 0 1px color-mix(in srgb, var(--app-color-status-warning) 30%, transparent)",
      "--app-radius-none": "0px",
      "--app-radius-indicator": "2px",
      "--app-radius-card": "8px",
      "--app-radius-pill": "10000px",
      "--app-color-writing-exam-header-surface":
        "color-mix(in srgb, var(--app-color-bg-container) 92%, transparent)",
      "--app-color-writing-material-row-active-surface":
        "color-mix(in srgb, var(--app-color-primary) 8%, transparent)",
      "--app-radius-writing-material-compact-surface": "4px",
      "--app-shadow-writing-material-tooltip": "0 4px 12px rgb(0 0 0 / 6%)",
      "--app-shadow-writing-blank-focus":
        "0 0 0 2px color-mix(in srgb, var(--app-color-primary) 18%, transparent)",
      "--app-shadow-writing-blank-active-inset":
        "inset 0 -2px 0 var(--app-color-primary)",
    });
  });
});
