import { appFontFamily } from "../global/shared-seed";
import type { AppBridgeVars } from "../bridge-contract";

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
  fontSize: {
    caption: "10px",
    body: "14px",
    bodyLg: "16px",
    subheading: "18px",
    headingSm: "20px",
    heading: "32px",
    headingLg: "40px",
    displaySm: "56px",
    display: "64px",
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
  "--app-font-size-caption": awesomicThemeTokens.fontSize.caption,
  "--app-font-size-body": awesomicThemeTokens.fontSize.body,
  "--app-font-size-body-lg": awesomicThemeTokens.fontSize.bodyLg,
  "--app-font-size-subheading": awesomicThemeTokens.fontSize.subheading,
  "--app-font-size-heading-sm": awesomicThemeTokens.fontSize.headingSm,
  "--app-font-size-heading": awesomicThemeTokens.fontSize.heading,
  "--app-font-size-heading-lg": awesomicThemeTokens.fontSize.headingLg,
  "--app-font-size-display-sm": awesomicThemeTokens.fontSize.displaySm,
  "--app-font-size-display": awesomicThemeTokens.fontSize.display,
  "--app-shadow-elevated": awesomicThemeTokens.shadow.elevated,
} as const satisfies AppBridgeVars;
