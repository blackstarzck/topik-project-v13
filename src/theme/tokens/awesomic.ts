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
  landingHero: {
    color: {
      outerCanvas: "#f7f3ef",
      mediaFallback: "#ccc2b7",
      headerSurface: "rgba(255, 255, 255, 0.72)",
      headerForeground: "#0c0c0d",
      headerHover: "#8b8b8e",
      foreground: "#ffffff",
      kicker: "rgba(255, 255, 255, 0.72)",
      body: "rgba(255, 255, 255, 0.82)",
    },
  },
  landingPortfolio: {
    color: {
      foreground: "#0c0c0d",
      headingAccent: "#a5a5aa",
      supporting: "#77777b",
      muted: "#8b8b8e",
      faint: "#b6b6b8",
      label: "#1c1c1f",
      footerHover: "#3c3c40",
      canvas: "#ffffff",
      darkSurface: "#0c0c0d",
      inverseForeground: "#ffffff",
      tagSurface: "rgba(255, 255, 255, 0.72)",
      cardSurface: "#fbfbfb",
      divider: "#b9b9b3",
      dividerSubtle: "#dededc",
      actionHover: "#1c1c1f",
    },
    background: {
      mediaPlaceholder:
        "repeating-linear-gradient(135deg, #e9e9e8 0 10px, #f1f1f0 10px 20px), #ececeb",
      mediaOverlay:
        "linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(0, 0, 0, 0.04))",
    },
    font: {
      display: '"Space Grotesk", var(--app-font-family), sans-serif',
      numeric: '"Montserrat", var(--app-font-family), sans-serif',
    },
    radius: {
      media: 4,
      round: "50%",
      tagPill: 999,
    },
  },
  authPrompt: {
    controlHeight: 50,
    focusOutline: "rgba(24, 24, 24, 0.08)",
    focusShadow: "0 0 0 2px rgba(24, 24, 24, 0.08)",
    loginFocusBorder: "#aab5ff",
    loginFocusShadow: "0 0 0 2px rgba(82, 102, 255, 0.1)",
    radius: 8,
  },
  authCharacter: {
    color: {
      purple: "#6c3ff5",
      charcoal: "#2d2d2d",
      coral: "#ff9b6b",
      yellow: "#e8d754",
      ink: "#25262d",
      eye: "#ffffff",
    },
    radius: {
      baseEdge: 0,
      bodyTop: 10,
      pill: 999,
    },
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
    floatingAction: "0 6px 18px rgba(42, 55, 89, 0.1)",
    popover:
      "0 16px 42px rgba(15, 23, 42, 0.16), 0 4px 14px rgba(15, 23, 42, 0.1)",
    message:
      "0 6px 16px 0 rgba(0, 0, 0, 0.1), 0 2px 6px -2px rgba(0, 0, 0, 0.08)",
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
    "--app-color-landing-hero-outer-canvas":
      awesomicThemeTokens.landingHero.color.outerCanvas,
    "--app-color-landing-hero-media-fallback":
      awesomicThemeTokens.landingHero.color.mediaFallback,
    "--app-color-landing-hero-header-surface":
      awesomicThemeTokens.landingHero.color.headerSurface,
    "--app-color-landing-hero-header-foreground":
      awesomicThemeTokens.landingHero.color.headerForeground,
    "--app-color-landing-hero-header-hover":
      awesomicThemeTokens.landingHero.color.headerHover,
    "--app-color-landing-hero-foreground":
      awesomicThemeTokens.landingHero.color.foreground,
    "--app-color-landing-hero-kicker":
      awesomicThemeTokens.landingHero.color.kicker,
    "--app-color-landing-hero-body": awesomicThemeTokens.landingHero.color.body,
    "--app-color-landing-portfolio-foreground":
      awesomicThemeTokens.landingPortfolio.color.foreground,
    "--app-color-landing-portfolio-heading-accent":
      awesomicThemeTokens.landingPortfolio.color.headingAccent,
    "--app-color-landing-portfolio-supporting":
      awesomicThemeTokens.landingPortfolio.color.supporting,
    "--app-color-landing-portfolio-muted":
      awesomicThemeTokens.landingPortfolio.color.muted,
    "--app-color-landing-portfolio-faint":
      awesomicThemeTokens.landingPortfolio.color.faint,
    "--app-color-landing-portfolio-label":
      awesomicThemeTokens.landingPortfolio.color.label,
    "--app-color-landing-portfolio-footer-hover":
      awesomicThemeTokens.landingPortfolio.color.footerHover,
    "--app-color-landing-portfolio-canvas":
      awesomicThemeTokens.landingPortfolio.color.canvas,
    "--app-color-landing-portfolio-dark-surface":
      awesomicThemeTokens.landingPortfolio.color.darkSurface,
    "--app-color-landing-portfolio-inverse-foreground":
      awesomicThemeTokens.landingPortfolio.color.inverseForeground,
    "--app-color-landing-portfolio-tag-surface":
      awesomicThemeTokens.landingPortfolio.color.tagSurface,
    "--app-color-landing-portfolio-card-surface":
      awesomicThemeTokens.landingPortfolio.color.cardSurface,
    "--app-color-landing-portfolio-divider":
      awesomicThemeTokens.landingPortfolio.color.divider,
    "--app-color-landing-portfolio-divider-subtle":
      awesomicThemeTokens.landingPortfolio.color.dividerSubtle,
    "--app-color-landing-portfolio-action-hover":
      awesomicThemeTokens.landingPortfolio.color.actionHover,
    "--app-background-landing-portfolio-media-placeholder":
      awesomicThemeTokens.landingPortfolio.background.mediaPlaceholder,
    "--app-background-landing-portfolio-media-overlay":
      awesomicThemeTokens.landingPortfolio.background.mediaOverlay,
    "--app-color-auth-prompt-focus-outline":
      awesomicThemeTokens.authPrompt.focusOutline,
    "--app-color-auth-prompt-login-focus-border":
      awesomicThemeTokens.authPrompt.loginFocusBorder,
    "--app-color-auth-character-purple":
      awesomicThemeTokens.authCharacter.color.purple,
    "--app-color-auth-character-charcoal":
      awesomicThemeTokens.authCharacter.color.charcoal,
    "--app-color-auth-character-coral":
      awesomicThemeTokens.authCharacter.color.coral,
    "--app-color-auth-character-yellow":
      awesomicThemeTokens.authCharacter.color.yellow,
    "--app-color-auth-character-ink":
      awesomicThemeTokens.authCharacter.color.ink,
    "--app-color-auth-character-eye":
      awesomicThemeTokens.authCharacter.color.eye,
    "--app-radius": `${awesomicThemeTokens.radius.base}px`,
    "--app-radius-card": `${awesomicThemeTokens.radius.card}px`,
    "--app-radius-pill": `${awesomicThemeTokens.radius.pill}px`,
    "--app-radius-indicator": `${awesomicThemeTokens.radius.indicator}px`,
    "--app-radius-landing-hero-cta": `${awesomicThemeTokens.radius.landingHeroCta}px`,
    "--app-radius-auth-prompt-control": `${awesomicThemeTokens.authPrompt.radius}px`,
    "--app-radius-auth-character-base-edge": `${awesomicThemeTokens.authCharacter.radius.baseEdge}px`,
    "--app-radius-auth-character-body-top": `${awesomicThemeTokens.authCharacter.radius.bodyTop}px`,
    "--app-radius-auth-character-pill": `${awesomicThemeTokens.authCharacter.radius.pill}px`,
    "--app-radius-landing-portfolio-media": `${awesomicThemeTokens.landingPortfolio.radius.media}px`,
    "--app-radius-landing-portfolio-round":
      awesomicThemeTokens.landingPortfolio.radius.round,
    "--app-radius-landing-portfolio-tag-pill": `${awesomicThemeTokens.landingPortfolio.radius.tagPill}px`,
    "--app-size-auth-prompt-control": `${awesomicThemeTokens.authPrompt.controlHeight}px`,
    "--app-font-family": awesomicThemeTokens.font.runtimeFamily,
    "--app-font-landing-portfolio-display":
      awesomicThemeTokens.landingPortfolio.font.display,
    "--app-font-landing-portfolio-numeric":
      awesomicThemeTokens.landingPortfolio.font.numeric,
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
    "--app-shadow-floating-action": awesomicThemeTokens.shadow.floatingAction,
    "--app-shadow-popover": awesomicThemeTokens.shadow.popover,
    "--app-shadow-message": awesomicThemeTokens.shadow.message,
    "--app-shadow-auth-prompt-focus":
      awesomicThemeTokens.authPrompt.focusShadow,
    "--app-shadow-auth-prompt-login-focus":
      awesomicThemeTokens.authPrompt.loginFocusShadow,
  } as const satisfies AppBridgeVars;
}

export const awesomicBridgeVarsByAppearance = {
  light: createAwesomicBridgeVars("light"),
  dark: createAwesomicBridgeVars("dark"),
} as const;

// Compatibility export for the light-only documented Awesomic source.
export const awesomicBridgeVars = awesomicBridgeVarsByAppearance.light;
