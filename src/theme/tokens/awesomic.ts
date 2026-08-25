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
  border: {
    // Resolved AntD colorBorderSecondary values. These lock the existing row
    // separator paint while exposing the role to app-owned CSS consumers.
    secondary: {
      light: "#f0f0f0",
      dark: "#303030",
    },
  },
  chart: {
    // AntD's blue and cyan seeds preserve the existing categorical chart
    // paints. The remaining chart colors reuse status roles exposed by the app.
    seriesPrimary: "#1677ff",
    accent: "#13c2c2",
  },
  landingCta: {
    // The live landing page uses two deliberate color modes: a dark action on
    // video and a light ghost action on the translucent header. These values
    // preserve that existing paint while giving alternate themes one source.
    primary: "#070203",
    primaryHover: "#21080c",
    foreground: "#ffffff",
    ghostSurface: "#ffffff",
    ghostText: "#0c0c0d",
    ghostBorder: "#e7e7e6",
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
    indicator: 2,
    landingHeroCta: 0,
    pill: 10_000,
  },
  // AntD owns status semantics. These resolved light/dark values lock the
  // existing meter paint while allowing the same roles to reach Tailwind.
  status: {
    light: {
      error: "#ff4d4f",
      warning: "#faad14",
      success: "#52c41a",
      strongSuccess: "#389e0d",
      fillSecondary: "rgba(0, 0, 0, 0.06)",
    },
    dark: {
      error: "#dc4446",
      warning: "#d89614",
      success: "#49aa19",
      strongSuccess: "#3c8618",
      fillSecondary: "rgba(255, 255, 255, 0.12)",
    },
  },
  overlay: {
    // App-owned subtle overlay derived from Mist at 18% opacity. Keeping the
    // alpha in the token lets AntD retain ownership of Drawer fade opacity.
    maskSubtle: "rgba(244, 244, 245, 0.18)",
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

function createAwesomicBridgeVars(appearance: "light" | "dark") {
  const status = awesomicThemeTokens.status[appearance];

  return {
    "--app-color-primary": awesomicThemeTokens.color.obsidian,
    "--app-color-bg-layout": awesomicThemeTokens.color.mist,
    "--app-color-bg-container": awesomicThemeTokens.color.snow,
    "--app-color-mask-subtle": awesomicThemeTokens.overlay.maskSubtle,
    "--app-color-text": awesomicThemeTokens.color.ink,
    "--app-color-text-secondary": awesomicThemeTokens.color.steel,
    "--app-color-link-secondary": awesomicThemeTokens.color.linkSecondary,
    "--app-color-border": awesomicThemeTokens.color.pebble,
    "--app-color-border-secondary":
      awesomicThemeTokens.border.secondary[appearance],
    "--app-color-chart-series-primary": awesomicThemeTokens.chart.seriesPrimary,
    "--app-color-chart-accent": awesomicThemeTokens.chart.accent,
    "--app-color-status-error": status.error,
    "--app-color-status-warning": status.warning,
    "--app-color-status-success": status.success,
    "--app-color-status-strong-success": status.strongSuccess,
    "--app-color-fill-secondary": status.fillSecondary,
    "--app-color-landing-cta-primary": awesomicThemeTokens.landingCta.primary,
    "--app-color-landing-cta-primary-hover":
      awesomicThemeTokens.landingCta.primaryHover,
    "--app-color-landing-cta-foreground":
      awesomicThemeTokens.landingCta.foreground,
    "--app-color-landing-cta-ghost-surface":
      awesomicThemeTokens.landingCta.ghostSurface,
    "--app-color-landing-cta-ghost-text":
      awesomicThemeTokens.landingCta.ghostText,
    "--app-color-landing-cta-ghost-border":
      awesomicThemeTokens.landingCta.ghostBorder,
    "--app-radius": `${awesomicThemeTokens.radius.base}px`,
    "--app-radius-card": `${awesomicThemeTokens.radius.card}px`,
    "--app-radius-pill": `${awesomicThemeTokens.radius.pill}px`,
    "--app-radius-indicator": `${awesomicThemeTokens.radius.indicator}px`,
    "--app-radius-landing-hero-cta": `${awesomicThemeTokens.radius.landingHeroCta}px`,
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
}

export const awesomicBridgeVarsByAppearance = {
  light: createAwesomicBridgeVars("light"),
  dark: createAwesomicBridgeVars("dark"),
} as const;

// Compatibility export for the light-only documented Awesomic source.
export const awesomicBridgeVars = awesomicBridgeVarsByAppearance.light;
