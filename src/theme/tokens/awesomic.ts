import { appFontFamily } from "../global/shared-seed";

export const allowedAppBridgeVars = [
  "--app-color-primary",
  "--app-color-bg-layout",
  "--app-color-bg-container",
  "--app-color-text",
  "--app-color-text-secondary",
  "--app-color-link-secondary",
  "--app-color-border",
  "--app-radius",
  "--app-font-family",
  "--app-shadow-elevated",
] as const;

export type AppBridgeVarName = (typeof allowedAppBridgeVars)[number];
export type AppBridgeVars = Record<AppBridgeVarName, string>;

export const awesomicThemeTokens = {
  color: {
    obsidian: "#09090b",
    ink: "#18181b",
    graphite: "#3f3f46",
    steel: "#71717a",
    pebble: "#d4d4d8",
    mist: "#f4f4f5",
    snow: "#ffffff",
    linkSecondary: "#3254F2",
  },
  radius: {
    // The raw Awesomic reference uses very soft 28-36px surfaces. DOTORE TOPIK's
    // workspace is denser, so runtime radii are intentionally toned down.
    base: 6,
    badge: 4,
    button: 6,
    card: 8,
    compactCard: 6,
    input: 6,
  },
  shadow: {
    elevated: "rgba(0, 0, 0, 0.04) 0px 4px 12px 0px",
    none: "none",
  },
  font: {
    documentedFamily: "Cosmica",
    runtimeFamily: appFontFamily,
  },
} as const;

export const awesomicBridgeVars = {
  "--app-color-primary": awesomicThemeTokens.color.obsidian,
  "--app-color-bg-layout": awesomicThemeTokens.color.mist,
  "--app-color-bg-container": awesomicThemeTokens.color.snow,
  "--app-color-text": awesomicThemeTokens.color.ink,
  "--app-color-text-secondary": awesomicThemeTokens.color.steel,
  "--app-color-link-secondary": awesomicThemeTokens.color.linkSecondary,
  "--app-color-border": awesomicThemeTokens.color.pebble,
  "--app-radius": `${awesomicThemeTokens.radius.base}px`,
  "--app-font-family": awesomicThemeTokens.font.runtimeFamily,
  "--app-shadow-elevated": awesomicThemeTokens.shadow.elevated,
} as const satisfies AppBridgeVars;
