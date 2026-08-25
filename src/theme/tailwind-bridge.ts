import type { ThemeConfig } from "antd";

import { themeSettings } from "./config";
import type { ThemeAppearance } from "./types";
import type { AppBridgeVars } from "./bridge-contract";
import { awesomicBridgeVars } from "./tokens/awesomic";
import { appFontFamily } from "./global/shared-seed";

export type ResolvedBridgeVars = AppBridgeVars;

const DEFAULT_LIGHT_SHADOW_ELEVATED =
  "0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)";
const DEFAULT_DARK_SHADOW_ELEVATED =
  "0 6px 16px 0 rgba(255, 255, 255, 0.016), 0 3px 6px -4px rgba(255, 255, 255, 0.024), 0 9px 28px 8px rgba(255, 255, 255, 0.01)";

const DEFAULT_FONT_SIZE_BRIDGE_VARS = {
  "--app-font-size-caption": "10px",
  "--app-font-size-body": "14px",
  "--app-font-size-body-lg": "16px",
  "--app-font-size-subheading": "18px",
  "--app-font-size-heading-sm": "20px",
  "--app-font-size-heading": "32px",
  "--app-font-size-heading-lg": "40px",
  "--app-font-size-display-sm": "56px",
  "--app-font-size-display": "64px",
} as const;

const DEFAULT_BRIDGE_VARS = {
  light: {
    "--app-color-primary": "#1677ff",
    "--app-color-bg-layout": "#f5f5f5",
    "--app-color-bg-container": "#ffffff",
    "--app-color-text": "rgba(0, 0, 0, 0.88)",
    "--app-color-text-secondary": "rgba(0, 0, 0, 0.65)",
    "--app-color-link-secondary": "#3254F2",
    "--app-color-border": "#d9d9d9",
    "--app-radius": "6px",
    "--app-font-family": appFontFamily,
    ...DEFAULT_FONT_SIZE_BRIDGE_VARS,
    "--app-shadow-elevated": DEFAULT_LIGHT_SHADOW_ELEVATED,
  },
  dark: {
    "--app-color-primary": "#1668dc",
    "--app-color-bg-layout": "#000000",
    "--app-color-bg-container": "#141414",
    "--app-color-text": "rgba(255, 255, 255, 0.85)",
    "--app-color-text-secondary": "rgba(255, 255, 255, 0.65)",
    "--app-color-link-secondary": "#3254F2",
    "--app-color-border": "#424242",
    "--app-radius": "6px",
    "--app-font-family": appFontFamily,
    ...DEFAULT_FONT_SIZE_BRIDGE_VARS,
    "--app-shadow-elevated": DEFAULT_DARK_SHADOW_ELEVATED,
  },
} as const satisfies Record<ThemeAppearance, AppBridgeVars>;

const AWESOMIC_BRIDGE_VARS = {
  light: awesomicBridgeVars,
  // DESIGN/Awesomic is light-only today. Keep dark infrastructure callable, but
  // do not invent a second undocumented dark palette.
  dark: awesomicBridgeVars,
} as const satisfies Record<ThemeAppearance, AppBridgeVars>;

const BRIDGE_VARS_BY_THEME = {
  default: DEFAULT_BRIDGE_VARS,
  awesomic: AWESOMIC_BRIDGE_VARS,
} as const satisfies Record<string, Record<ThemeAppearance, AppBridgeVars>>;

export type BridgeThemeName = keyof typeof BRIDGE_VARS_BY_THEME;

export function getResolvedBridgeVars(
  themeName: BridgeThemeName = themeSettings.main,
  appearance: ThemeAppearance = themeSettings.appearance,
): ResolvedBridgeVars {
  return BRIDGE_VARS_BY_THEME[themeName][appearance];
}

export function getResolvedBridgeVarsByAppearance(
  appearance: ThemeAppearance,
): ResolvedBridgeVars {
  return getResolvedBridgeVars(themeSettings.main, appearance);
}

/**
 * @deprecated Use getResolvedBridgeVars(themeName, appearance). The ThemeConfig
 * parameter is ignored because server components must not evaluate AntD's theme
 * namespace in this project.
 */
export function getResolvedBridgeVarsFromThemeConfig(
  _themeConfig: ThemeConfig,
): ResolvedBridgeVars {
  void _themeConfig;
  return getResolvedBridgeVars();
}
