import { appFontFamily } from "./global/shared-seed";

export const awesomicColors = {
  obsidian: "#09090b",
  ink: "#18181b",
  graphite: "#3f3f46",
  steel: "#71717a",
  pebble: "#d4d4d8",
  fog: "#ececee",
  mist: "#f4f4f5",
  snow: "#ffffff",
} as const;

export const awesomicRadii = {
  base: 14,
  card: 36,
  compactCard: 28,
  pill: 36,
  badge: 12,
  input: 14,
} as const;

export const awesomicPrimaryActionShadow =
  "rgba(255, 255, 255, 0.5) 0px 0.5px 0px 0px inset, rgba(117, 123, 133, 0.4) 0px 9px 14px -5px inset, rgb(44, 46, 52) 0px 0px 0px 1.5px, rgba(0, 0, 0, 0.14) 0px 4px 6px 0px";

export const awesomicElevatedShadow =
  "0 4px 12px 0 rgba(0, 0, 0, 0.04)";

export const awesomicThemeToken = {
  colorPrimary: awesomicColors.obsidian,
  colorText: awesomicColors.ink,
  colorTextSecondary: awesomicColors.steel,
  colorBorder: awesomicColors.pebble,
  colorBgLayout: awesomicColors.mist,
  colorBgContainer: awesomicColors.snow,
  colorLink: awesomicColors.graphite,
  colorLinkHover: awesomicColors.obsidian,
  colorLinkActive: awesomicColors.obsidian,
  borderRadius: awesomicRadii.base,
  boxShadowSecondary: awesomicElevatedShadow,
} as const;

export const awesomicBridgeVars = {
  "--app-color-primary": awesomicThemeToken.colorPrimary,
  "--app-color-bg-layout": awesomicThemeToken.colorBgLayout,
  "--app-color-bg-container": awesomicThemeToken.colorBgContainer,
  "--app-color-text": awesomicThemeToken.colorText,
  "--app-color-text-secondary": awesomicThemeToken.colorTextSecondary,
  "--app-color-border": awesomicThemeToken.colorBorder,
  "--app-radius": `${awesomicThemeToken.borderRadius}px`,
  "--app-font-family": appFontFamily,
  "--app-shadow-elevated": awesomicThemeToken.boxShadowSecondary,
} as const;
