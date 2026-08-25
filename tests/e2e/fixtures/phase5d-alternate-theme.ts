import { createAppBridgeVars } from "../../../src/theme/bridge-contract";
import { createTheme } from "../../../src/theme/create-theme";
import type { AppThemePreset } from "../../../src/theme/types";

export const PHASE5D_ALTERNATE_THEME_MARKER =
  "phase5d-e2e-alternate-theme-9f42c7";

const alternateSource = {
  colorPrimary: "#8b2cff",
  colorBgLayout: "#d8fff4",
  colorBgContainer: "#fff3c4",
  colorMaskSubtle: "rgba(139, 44, 255, 0.31)",
  colorText: "#24104f",
  colorTextSecondary: "#006b61",
  colorLinkSecondary: "#d10068",
  colorBorder: "#008f7a",
  colorBorderSecondary: "#00c4a7",
  colorChartSeriesPrimary: "#ff6b00",
  colorChartAccent: "#e000c7",
  colorStatusError: "#b0006d",
  colorStatusWarning: "#7a5100",
  colorStatusSuccess: "#006b3c",
  colorStatusStrongSuccess: "#004b2a",
  colorFillSecondary: "rgba(36, 16, 79, 0.24)",
  colorLandingCtaPrimary: "#6f2cff",
  colorLandingCtaPrimaryHover: "#43158f",
  colorLandingCtaForeground: "#fff0d8",
  colorLandingCtaGhostSurface: "#eafcff",
  colorLandingCtaGhostText: "#28005d",
  colorLandingCtaGhostBorder: "#16a6a0",
  colorAuthPromptFocusOutline: "rgba(111, 44, 255, 0.29)",
  colorAuthPromptLoginFocusBorder: "#ff4bc7",
  radius: "19px",
  radiusNumber: 19,
  radiusCard: "23px",
  radiusCardNumber: 23,
  radiusPill: "12000px",
  radiusIndicator: "5px",
  radiusIndicatorNumber: 5,
  radiusLandingHeroCta: "17px",
  radiusAuthPromptControl: "25px",
  sizeAuthPromptControl: "58px",
  shadowElevated: "11px 13px 0 rgba(36, 16, 79, 0.42)",
  shadowAuthPromptFocus: "0 0 0 4px rgba(111, 44, 255, 0.29)",
  shadowAuthPromptLoginFocus: "0 0 0 5px rgba(255, 75, 199, 0.31)",
  fontFamily: '"Courier New", Courier, monospace',
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
const alternateToken = alternateThemesByAppearance.light.antd.token;

export const phase5dAlternateTheme = {
  appBridgeVars: createAppBridgeVars(alternateSource),
  antdRadiusByAppearance: Object.fromEntries(
    Object.entries(alternateThemesByAppearance).map(([appearance, value]) => [
      appearance,
      {
        card: `${String(value.antd.components?.Card?.borderRadiusLG)}px`,
        global: `${String(value.antd.token?.borderRadiusLG)}px`,
      },
    ]),
  ) as Record<"light" | "dark", { card: string; global: string }>,
  antdCssVars: {
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
  },
} as const;

// Built-artifact absence of PHASE5D_ALTERNATE_THEME_MARKER remains the single
// Phase checkpoint responsibility; this fixture is never registered by src/**.
