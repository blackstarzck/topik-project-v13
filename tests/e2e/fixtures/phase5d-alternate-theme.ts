import { createAppBridgeVars } from "../../../src/theme/bridge-contract";
import { createTheme } from "../../../src/theme/create-theme";
import type { AppThemePreset } from "../../../src/theme/types";

export const PHASE5D_ALTERNATE_THEME_MARKER =
  "phase5d-e2e-alternate-theme-9f42c7";

const alternateErrorAliasesByAppearance = {
  light: {
    border: "#d667a0",
    surface: "#f0d8e3",
  },
  dark: {
    border: "#430e2f",
    surface: "#20111b",
  },
} as const;

const alternateSource = {
  colorPrimary: "#8b2cff",
  colorBgLayout: "#d8fff4",
  colorBgContainer: "#fff3c4",
  colorMaskSubtle: "rgba(139, 44, 255, 0.31)",
  colorText: "#24104f",
  colorTextSecondary: "#006b61",
  colorTextInverse: "#fff0a6",
  colorLinkSecondary: "#d10068",
  colorBorder: "#008f7a",
  colorBorderSecondary: "#00c4a7",
  colorChartSeriesPrimary: "#ff6b00",
  colorChartAccent: "#e000c7",
  colorStatusError: "#b0006d",
  colorStatusErrorBorder: alternateErrorAliasesByAppearance.light.border,
  colorStatusErrorSurface: alternateErrorAliasesByAppearance.light.surface,
  colorStatusWarning: "#7a5100",
  colorStatusSuccess: "#006b3c",
  colorStatusStrongSuccess: "#004b2a",
  colorFillSecondary: "rgba(36, 16, 79, 0.24)",
  colorWritingExamHeaderSurface: "rgba(255, 75, 199, 0.84)",
  colorWritingMaterialRowActiveSurface: "rgba(255, 111, 0, 0.23)",
  colorWritingBlankActiveSurface: "rgba(0, 165, 138, 0.34)",
  colorWritingBlankFilledBorder: "#ff3d8d",
  colorWritingManuscriptIntroSurface: "#fde2ff",
  colorWritingManuscriptIntroBorder: "#7d2eff",
  colorWritingManuscriptBodySurface: "#d8fff0",
  colorWritingManuscriptBodyBorder: "#00a884",
  colorWritingManuscriptConclusionSurface: "#fff0b5",
  colorWritingManuscriptConclusionBorder: "#c36a00",
  colorLandingCtaPrimary: "#6f2cff",
  colorLandingCtaPrimaryHover: "#43158f",
  colorLandingCtaForeground: "#fff0d8",
  colorLandingCtaGhostSurface: "#eafcff",
  colorLandingCtaGhostText: "#28005d",
  colorLandingCtaGhostBorder: "#16a6a0",
  colorLandingHeroOuterCanvas: "#f3e4ff",
  colorLandingHeroMediaFallback: "#7d5a50",
  colorLandingHeroHeaderSurface: "rgba(218, 255, 244, 0.68)",
  colorLandingHeroHeaderForeground: "#35105c",
  colorLandingHeroHeaderHover: "#a52d76",
  colorLandingHeroForeground: "#fff7c2",
  colorLandingHeroKicker: "rgba(255, 217, 102, 0.76)",
  colorLandingHeroBody: "rgba(192, 255, 236, 0.84)",
  colorLandingPortfolioForeground: "#20104f",
  colorLandingPortfolioHeadingAccent: "#6f5aa7",
  colorLandingPortfolioSupporting: "#2d6f68",
  colorLandingPortfolioMuted: "#8a2b63",
  colorLandingPortfolioFaint: "#b56a1f",
  colorLandingPortfolioLabel: "#0d4d63",
  colorLandingPortfolioFooterHover: "#be2f64",
  colorLandingPortfolioCanvas: "#fdf1b8",
  colorLandingPortfolioDarkSurface: "#2a0a52",
  colorLandingPortfolioInverseForeground: "#f5ffdb",
  colorLandingPortfolioTagSurface: "rgba(255, 80, 160, 0.64)",
  colorLandingPortfolioCardSurface: "#dff7ff",
  colorLandingPortfolioDivider: "#00a896",
  colorLandingPortfolioDividerSubtle: "#7c5cff",
  colorLandingPortfolioActionHover: "#bf1748",
  backgroundLandingPortfolioMediaPlaceholder:
    "repeating-linear-gradient(45deg, #ff8a00 0 7px, #6f2cff 7px 14px), #00c4a7",
  backgroundLandingPortfolioMediaOverlay:
    "linear-gradient(135deg, rgba(111, 44, 255, 0.44), rgba(0, 196, 167, 0.36))",
  colorAuthPromptCanvas: "#d7f8ff",
  backgroundAuthPromptHero: "linear-gradient(135deg, #3b1c73 0%, #0e5b69 100%)",
  colorAuthPromptFocusOutline: "rgba(111, 44, 255, 0.29)",
  colorAuthPromptLoginFocusBorder: "#ff4bc7",
  colorAuthConsentDocumentSurface: "#ffd6ef",
  colorAuthVerifyEmailCardBorder: "#ef42bd",
  colorAuthVerifyEmailSummarySurface: "#c8f7ff",
  colorSharedCardSubtleOutline: "#4b39d1",
  colorLibraryReviewScoreTrack: "#d9f7ff",
  colorProblemNewBadgeSurface: "rgba(239, 66, 189, 0.22)",
  colorAnalysisHandoffOverlaySurface: "rgba(239, 66, 189, 0.27)",
  colorAuthCharacterPurple: "#7b1fa2",
  colorAuthCharacterCharcoal: "#12313a",
  colorAuthCharacterCoral: "#ff4f81",
  colorAuthCharacterYellow: "#d18f00",
  colorAuthCharacterInk: "#1d1145",
  colorAuthCharacterEye: "#eafcff",
  radius: "19px",
  radiusNone: "0px",
  radiusNumber: 19,
  radiusCard: "23px",
  radiusCardNumber: 23,
  radiusPill: "12000px",
  radiusIndicator: "5px",
  radiusIndicatorNumber: 5,
  radiusLandingHeroCta: "17px",
  radiusAuthPromptControl: "25px",
  radiusAuthVerifyEmailCard: "31px",
  radiusAuthVerifyEmailCardCompact: "14px",
  radiusAuthCharacterBaseEdge: "2.375px",
  radiusAuthCharacterBodyTop: "11.375px",
  radiusAuthCharacterPill: "777px",
  radiusLandingPortfolioMedia: "6.25px",
  radiusLandingPortfolioRound: "47.375%",
  radiusLandingPortfolioTagPill: "887px",
  radiusWritingMaterialCompactSurface: "7.25px",
  radiusPracticeRetrySummary: "13.75px",
  radiusPracticeRetryModeOption: "17.25px",
  radiusProblemNewBadge: "15.5px",
  radiusAnalysisFailureAction: "18.5px",
  sizeAuthPromptControl: "58px",
  shadowElevated: "11px 13px 0 rgba(36, 16, 79, 0.42)",
  shadowFloatingAction: "0 9px 24px rgba(72, 18, 112, 0.22)",
  shadowPopover:
    "0 20px 52px rgba(51, 16, 91, 0.28), 0 5px 16px rgba(4, 120, 100, 0.18)",
  shadowMessage:
    "0 8px 20px 0 rgba(81, 24, 115, 0.2), 0 3px 8px -2px rgba(0, 140, 116, 0.15)",
  shadowNotificationChannelSelected: "0 0 0 3px #ff8a00",
  shadowSelectableCardSelected:
    "0 10px 26px rgba(72, 34, 145, 0.24), inset 0 0 0 3px #ef42bd",
  shadowWritingMaterialTooltip: "0 7px 19px rgb(73 12 117 / 24%)",
  shadowWritingBlankFocus: "0 0 0 5px rgba(0, 165, 138, 0.32)",
  shadowWritingBlankActiveInset: "inset 0 -4px 0 #d10068",
  shadowWritingManuscriptIntroInset: "inset 0 0 0 3px rgba(125, 46, 255, 0.41)",
  shadowWritingManuscriptBodyInset: "inset 0 0 0 4px rgba(0, 168, 132, 0.36)",
  shadowWritingManuscriptConclusionInset:
    "inset 0 0 0 5px rgba(195, 106, 0, 0.38)",
  shadowAuthPromptFocus: "0 0 0 4px rgba(111, 44, 255, 0.29)",
  shadowAuthPromptLoginFocus: "0 0 0 5px rgba(255, 75, 199, 0.31)",
  shadowAuthVerifyEmailCard: "13px 15px 0 rgba(36, 16, 79, 0.36)",
  fontFamily: '"Courier New", Courier, monospace',
  fontLandingPortfolioDisplay: '"Phase5D Display", serif',
  fontLandingPortfolioNumeric: '"Phase5D Numeric", monospace',
  fontWritingManuscriptMono: '"Phase5D Manuscript Mono", monospace',
  fontQuestionNumberDisplay:
    '"Phase5D Question Display", var(--app-font-family), sans-serif',
  fontSizeCaption: "11px",
  fontSizeBody: "13px",
  fontSizeBodyLg: "18px",
  fontSizeSubheading: "23px",
  fontSizeHeadingSm: "28px",
  fontSizeHeading: "35px",
  fontSizeHeadingLg: "45px",
  fontSizeDisplaySm: "59px",
  fontSizeDisplay: "73px",
} as const;

const alternateAppearance = {
  token: {
    colorPrimary: alternateSource.colorPrimary,
    colorBgLayout: alternateSource.colorBgLayout,
    colorBgContainer: alternateSource.colorBgContainer,
    colorText: alternateSource.colorText,
    colorTextSecondary: alternateSource.colorTextSecondary,
    colorBorder: alternateSource.colorBorder,
    colorBorderSecondary: alternateSource.colorBorderSecondary,
    blue: alternateSource.colorChartSeriesPrimary,
    cyan: alternateSource.colorChartAccent,
    colorError: alternateSource.colorStatusError,
    colorWarning: alternateSource.colorStatusWarning,
    colorSuccess: alternateSource.colorStatusSuccess,
    colorSuccessActive: alternateSource.colorStatusStrongSuccess,
    colorFillSecondary: alternateSource.colorFillSecondary,
    borderRadius: alternateSource.radiusNumber,
    borderRadiusLG: alternateSource.radiusCardNumber,
    borderRadiusXS: alternateSource.radiusIndicatorNumber,
    fontFamily: alternateSource.fontFamily,
    fontSize: Number.parseFloat(alternateSource.fontSizeBodyLg),
    boxShadow: alternateSource.shadowElevated,
    boxShadowSecondary: alternateSource.shadowElevated,
  },
  components: {
    Card: {
      borderRadiusLG: alternateSource.radiusCardNumber,
    },
  },
} as const;

const alternatePreset = {
  name: "phase5d-test-alternate",
  label: "Phase 5D test alternate",
  description: PHASE5D_ALTERNATE_THEME_MARKER,
  appearances: {
    light: alternateAppearance,
    dark: alternateAppearance,
  },
} satisfies AppThemePreset<"phase5d-test-alternate">;

const alternateThemesByAppearance = {
  light: createTheme(alternatePreset, "light"),
  dark: createTheme(alternatePreset, "dark"),
} as const;

const alternateSourceByAppearance = {
  light: alternateSource,
  dark: {
    ...alternateSource,
    colorAuthPromptCanvas: "#160d2b",
    backgroundAuthPromptHero:
      "linear-gradient(135deg, #120823 0%, #00473d 100%)",
    colorStatusErrorBorder: alternateErrorAliasesByAppearance.dark.border,
    colorStatusErrorSurface: alternateErrorAliasesByAppearance.dark.surface,
    colorLibraryReviewScoreTrack: "#17354a",
    colorProblemNewBadgeSurface: "rgba(85, 230, 193, 0.24)",
    colorAnalysisHandoffOverlaySurface: "rgba(85, 230, 193, 0.29)",
    shadowSelectableCardSelected:
      "0 10px 26px rgba(0, 0, 0, 0.48), inset 0 0 0 3px #55e6c1",
  },
} as const;

const appBridgeVarsByAppearance = {
  light: createAppBridgeVars(alternateSourceByAppearance.light),
  dark: createAppBridgeVars(alternateSourceByAppearance.dark),
} as const;

function createAlternateAntdCssVars(appearance: "light" | "dark") {
  const alternateToken = alternateThemesByAppearance[appearance].antd.token;
  const errorAliases = alternateErrorAliasesByAppearance[appearance];

  return {
    "--ant-color-primary": String(alternateToken?.colorPrimary),
    "--ant-color-bg-layout": String(alternateToken?.colorBgLayout),
    "--ant-color-bg-container": String(alternateToken?.colorBgContainer),
    "--ant-color-text": String(alternateToken?.colorText),
    "--ant-color-text-secondary": String(alternateToken?.colorTextSecondary),
    "--ant-color-border": String(alternateToken?.colorBorder),
    "--ant-color-border-secondary": String(
      alternateToken?.colorBorderSecondary,
    ),
    "--ant-blue": String(alternateToken?.blue),
    "--ant-cyan": String(alternateToken?.cyan),
    "--ant-color-error": String(alternateToken?.colorError),
    "--ant-color-error-border": errorAliases.border,
    "--ant-color-error-bg": errorAliases.surface,
    "--ant-color-warning": String(alternateToken?.colorWarning),
    "--ant-color-success": String(alternateToken?.colorSuccess),
    "--ant-color-success-active": String(alternateToken?.colorSuccessActive),
    "--ant-color-fill-secondary": String(alternateToken?.colorFillSecondary),
    "--ant-border-radius": `${String(alternateToken?.borderRadius)}px`,
    "--ant-border-radius-lg": `${String(alternateToken?.borderRadiusLG)}px`,
    "--ant-border-radius-xs": `${String(alternateToken?.borderRadiusXS)}px`,
    "--ant-font-family": String(alternateToken?.fontFamily),
    "--ant-font-size": `${String(alternateToken?.fontSize)}px`,
    "--ant-box-shadow": String(alternateToken?.boxShadow),
    "--ant-box-shadow-secondary": String(alternateToken?.boxShadowSecondary),
  } as const;
}

const antdCssVarsByAppearance = {
  light: createAlternateAntdCssVars("light"),
  dark: createAlternateAntdCssVars("dark"),
} as const;

export const phase5dAlternateTheme = {
  appBridgeVars: appBridgeVarsByAppearance.light,
  appBridgeVarsByAppearance,
  antdRadiusByAppearance: Object.fromEntries(
    Object.entries(alternateThemesByAppearance).map(([appearance, value]) => [
      appearance,
      {
        card: `${String(value.antd.components?.Card?.borderRadiusLG)}px`,
        global: `${String(value.antd.token?.borderRadiusLG)}px`,
      },
    ]),
  ) as Record<"light" | "dark", { card: string; global: string }>,
  antdCssVars: antdCssVarsByAppearance.light,
  antdCssVarsByAppearance,
} as const;

// Built-artifact absence of PHASE5D_ALTERNATE_THEME_MARKER remains the single
// Phase checkpoint responsibility; this fixture is never registered by src/**.
