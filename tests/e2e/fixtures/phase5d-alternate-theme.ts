import { createAppBridgeVars } from "../../../src/theme/bridge-contract";
import { createTheme } from "../../../src/theme/create-theme";
import type { AppThemePreset } from "../../../src/theme/types";

export const PHASE5D_ALTERNATE_THEME_MARKER =
  "phase5d-e2e-alternate-theme-9f42c7";

const alternateSource = {
  colorPrimary: "#8b2cff",
  colorBgLayout: "#d8fff4",
  colorBgContainer: "#fff3c4",
  colorText: "#24104f",
  colorTextSecondary: "#006b61",
  colorLinkSecondary: "#d10068",
  colorBorder: "#008f7a",
  radius: "19px",
  radiusNumber: 19,
  shadowElevated: "11px 13px 0 rgba(36, 16, 79, 0.42)",
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

const alternatePreset = {
  name: "phase5d-test-alternate",
  label: "Phase 5D test alternate",
  description: PHASE5D_ALTERNATE_THEME_MARKER,
  appearances: {
    light: {
      token: {
        colorPrimary: alternateSource.colorPrimary,
        colorBgLayout: alternateSource.colorBgLayout,
        colorBgContainer: alternateSource.colorBgContainer,
        colorText: alternateSource.colorText,
        colorTextSecondary: alternateSource.colorTextSecondary,
        colorBorder: alternateSource.colorBorder,
        colorBorderSecondary: alternateSource.colorBorder,
        borderRadius: alternateSource.radiusNumber,
        borderRadiusLG: alternateSource.radiusNumber,
        fontFamily: alternateSource.fontFamily,
        fontSize: Number.parseFloat(alternateSource.fontSizeBodyLg),
        boxShadow: alternateSource.shadowElevated,
        boxShadowSecondary: alternateSource.shadowElevated,
      },
    },
    dark: {},
  },
} satisfies AppThemePreset<"phase5d-test-alternate">;

const alternateTheme = createTheme(alternatePreset, "light");
const alternateToken = alternateTheme.antd.token;

export const phase5dAlternateTheme = {
  appBridgeVars: createAppBridgeVars(alternateSource),
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
    "--ant-border-radius": `${String(alternateToken?.borderRadius)}px`,
    "--ant-border-radius-lg": `${String(alternateToken?.borderRadiusLG)}px`,
    "--ant-font-family": String(alternateToken?.fontFamily),
    "--ant-font-size": `${String(alternateToken?.fontSize)}px`,
    "--ant-box-shadow": String(alternateToken?.boxShadow),
    "--ant-box-shadow-secondary": String(alternateToken?.boxShadowSecondary),
  },
} as const;

// Built-artifact absence of PHASE5D_ALTERNATE_THEME_MARKER remains the single
// Phase checkpoint responsibility; this fixture is never registered by src/**.
