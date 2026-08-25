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
    textInverse: "#ffffff",
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
  sharedCard: {
    color: {
      subtleOutline:
        "color-mix(in srgb, var(--app-color-border) 25%, var(--app-color-bg-layout))",
    },
  },
  chart: {
    // AntD's blue and cyan seeds preserve the existing categorical chart
    // paints. The remaining chart colors reuse status roles exposed by the app.
    seriesPrimary: "#1677ff",
    accent: "#13c2c2",
  },
  writingExam: {
    color: {
      headerSurface:
        "color-mix(in srgb, var(--app-color-bg-container) 92%, transparent)",
    },
  },
  writingMaterial: {
    color: {
      rowActiveSurface:
        "color-mix(in srgb, var(--app-color-primary) 8%, transparent)",
    },
    radius: {
      compactSurface: 4,
    },
    shadow: {
      tooltip: "0 4px 12px rgb(0 0 0 / 6%)",
    },
  },
  writingBlank: {
    color: {
      activeSurface:
        "color-mix(in srgb, var(--app-color-primary) 6%, var(--app-color-bg-container))",
      filledBorder:
        "color-mix(in srgb, var(--app-color-primary) 42%, var(--app-color-border))",
    },
    shadow: {
      focus:
        "0 0 0 2px color-mix(in srgb, var(--app-color-primary) 18%, transparent)",
      activeInset: "inset 0 -2px 0 var(--app-color-primary)",
    },
  },
  writingManuscript: {
    font: {
      mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    },
    section: {
      intro: {
        surface:
          "color-mix(in srgb, var(--app-color-primary) 12%, var(--app-color-bg-container))",
        border:
          "color-mix(in srgb, var(--app-color-primary) 48%, var(--app-color-border))",
        inset:
          "inset 0 0 0 1px color-mix(in srgb, var(--app-color-primary) 30%, transparent)",
      },
      body: {
        surface: { light: "#f6ffed", dark: "#162312" },
        border:
          "color-mix(in srgb, var(--app-color-status-success) 48%, var(--app-color-border))",
        inset:
          "inset 0 0 0 1px color-mix(in srgb, var(--app-color-status-success) 30%, transparent)",
      },
      conclusion: {
        surface: { light: "#fffbe6", dark: "#2b2111" },
        border:
          "color-mix(in srgb, var(--app-color-status-warning) 48%, var(--app-color-border))",
        inset:
          "inset 0 0 0 1px color-mix(in srgb, var(--app-color-status-warning) 30%, transparent)",
      },
    },
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
    canvas: "#ffffff",
    heroBackground:
      "radial-gradient(circle at 48% 55%, rgba(255, 255, 255, 0.08), transparent 36%), radial-gradient(circle at 28% 78%, rgba(255, 255, 255, 0.05), transparent 30%), linear-gradient(145deg, #202020 0%, #191919 62%, #242424 100%)",
    controlHeight: 50,
    focusOutline: "rgba(24, 24, 24, 0.08)",
    focusShadow: "0 0 0 2px rgba(24, 24, 24, 0.08)",
    loginFocusBorder: "#aab5ff",
    loginFocusShadow: "0 0 0 2px rgba(82, 102, 255, 0.1)",
    radius: 8,
  },
  authConsent: {
    documentSurface:
      "color-mix(in srgb, var(--app-color-bg-container) 94%, var(--app-color-bg-layout))",
  },
  authVerifyEmail: {
    color: {
      cardBorder:
        "color-mix(in srgb, var(--app-color-border) 72%, transparent)",
      summarySurface:
        "color-mix(in srgb, var(--app-color-bg-layout) 56%, var(--app-color-bg-container))",
    },
    radius: {
      card: 28,
      compact: 12,
    },
    shadow: {
      card: "0 18px 44px color-mix(in srgb, var(--app-color-primary) 10%, transparent), var(--app-shadow-elevated)",
    },
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
    none: 0,
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
      errorBorder: "#ffccc7",
      errorSurface: "#fff2f0",
      warning: "#faad14",
      success: "#52c41a",
      strongSuccess: "#389e0d",
      fillSecondary: "rgba(0, 0, 0, 0.06)",
    },
    dark: {
      error: "#dc4446",
      errorBorder: "#5b2526",
      errorSurface: "#2c1618",
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
  notification: {
    shadow: {
      channelSelected: "0 0 0 1px var(--app-color-primary)",
    },
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
    "--app-color-text-inverse": awesomicThemeTokens.color.textInverse,
    "--app-color-link-secondary": awesomicThemeTokens.color.linkSecondary,
    "--app-color-border": awesomicThemeTokens.color.pebble,
    "--app-color-border-secondary":
      awesomicThemeTokens.border.secondary[appearance],
    "--app-color-shared-card-subtle-outline":
      awesomicThemeTokens.sharedCard.color.subtleOutline,
    "--app-color-chart-series-primary": awesomicThemeTokens.chart.seriesPrimary,
    "--app-color-chart-accent": awesomicThemeTokens.chart.accent,
    "--app-color-status-error": status.error,
    "--app-color-status-error-border": status.errorBorder,
    "--app-color-status-error-surface": status.errorSurface,
    "--app-color-status-warning": status.warning,
    "--app-color-status-success": status.success,
    "--app-color-status-strong-success": status.strongSuccess,
    "--app-color-fill-secondary": status.fillSecondary,
    "--app-color-writing-exam-header-surface":
      awesomicThemeTokens.writingExam.color.headerSurface,
    "--app-color-writing-material-row-active-surface":
      awesomicThemeTokens.writingMaterial.color.rowActiveSurface,
    "--app-color-writing-blank-active-surface":
      awesomicThemeTokens.writingBlank.color.activeSurface,
    "--app-color-writing-blank-filled-border":
      awesomicThemeTokens.writingBlank.color.filledBorder,
    "--app-color-writing-manuscript-intro-surface":
      awesomicThemeTokens.writingManuscript.section.intro.surface,
    "--app-color-writing-manuscript-intro-border":
      awesomicThemeTokens.writingManuscript.section.intro.border,
    "--app-color-writing-manuscript-body-surface":
      awesomicThemeTokens.writingManuscript.section.body.surface[appearance],
    "--app-color-writing-manuscript-body-border":
      awesomicThemeTokens.writingManuscript.section.body.border,
    "--app-color-writing-manuscript-conclusion-surface":
      awesomicThemeTokens.writingManuscript.section.conclusion.surface[
        appearance
      ],
    "--app-color-writing-manuscript-conclusion-border":
      awesomicThemeTokens.writingManuscript.section.conclusion.border,
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
    "--app-color-auth-prompt-canvas": awesomicThemeTokens.authPrompt.canvas,
    "--app-background-auth-prompt-hero":
      awesomicThemeTokens.authPrompt.heroBackground,
    "--app-color-auth-prompt-focus-outline":
      awesomicThemeTokens.authPrompt.focusOutline,
    "--app-color-auth-prompt-login-focus-border":
      awesomicThemeTokens.authPrompt.loginFocusBorder,
    "--app-color-auth-consent-document-surface":
      awesomicThemeTokens.authConsent.documentSurface,
    "--app-color-auth-verify-email-card-border":
      awesomicThemeTokens.authVerifyEmail.color.cardBorder,
    "--app-color-auth-verify-email-summary-surface":
      awesomicThemeTokens.authVerifyEmail.color.summarySurface,
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
    "--app-radius-none": `${awesomicThemeTokens.radius.none}px`,
    "--app-radius-card": `${awesomicThemeTokens.radius.card}px`,
    "--app-radius-pill": `${awesomicThemeTokens.radius.pill}px`,
    "--app-radius-indicator": `${awesomicThemeTokens.radius.indicator}px`,
    "--app-radius-landing-hero-cta": `${awesomicThemeTokens.radius.landingHeroCta}px`,
    "--app-radius-auth-prompt-control": `${awesomicThemeTokens.authPrompt.radius}px`,
    "--app-radius-auth-verify-email-card": `${awesomicThemeTokens.authVerifyEmail.radius.card}px`,
    "--app-radius-auth-verify-email-card-compact": `${awesomicThemeTokens.authVerifyEmail.radius.compact}px`,
    "--app-radius-auth-character-base-edge": `${awesomicThemeTokens.authCharacter.radius.baseEdge}px`,
    "--app-radius-auth-character-body-top": `${awesomicThemeTokens.authCharacter.radius.bodyTop}px`,
    "--app-radius-auth-character-pill": `${awesomicThemeTokens.authCharacter.radius.pill}px`,
    "--app-radius-landing-portfolio-media": `${awesomicThemeTokens.landingPortfolio.radius.media}px`,
    "--app-radius-landing-portfolio-round":
      awesomicThemeTokens.landingPortfolio.radius.round,
    "--app-radius-landing-portfolio-tag-pill": `${awesomicThemeTokens.landingPortfolio.radius.tagPill}px`,
    "--app-radius-writing-material-compact-surface": `${awesomicThemeTokens.writingMaterial.radius.compactSurface}px`,
    "--app-size-auth-prompt-control": `${awesomicThemeTokens.authPrompt.controlHeight}px`,
    "--app-font-family": awesomicThemeTokens.font.runtimeFamily,
    "--app-font-landing-portfolio-display":
      awesomicThemeTokens.landingPortfolio.font.display,
    "--app-font-landing-portfolio-numeric":
      awesomicThemeTokens.landingPortfolio.font.numeric,
    "--app-font-writing-manuscript-mono":
      awesomicThemeTokens.writingManuscript.font.mono,
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
    "--app-shadow-notification-channel-selected":
      awesomicThemeTokens.notification.shadow.channelSelected,
    "--app-shadow-writing-material-tooltip":
      awesomicThemeTokens.writingMaterial.shadow.tooltip,
    "--app-shadow-writing-blank-focus":
      awesomicThemeTokens.writingBlank.shadow.focus,
    "--app-shadow-writing-blank-active-inset":
      awesomicThemeTokens.writingBlank.shadow.activeInset,
    "--app-shadow-writing-manuscript-intro-inset":
      awesomicThemeTokens.writingManuscript.section.intro.inset,
    "--app-shadow-writing-manuscript-body-inset":
      awesomicThemeTokens.writingManuscript.section.body.inset,
    "--app-shadow-writing-manuscript-conclusion-inset":
      awesomicThemeTokens.writingManuscript.section.conclusion.inset,
    "--app-shadow-auth-prompt-focus":
      awesomicThemeTokens.authPrompt.focusShadow,
    "--app-shadow-auth-prompt-login-focus":
      awesomicThemeTokens.authPrompt.loginFocusShadow,
    "--app-shadow-auth-verify-email-card":
      awesomicThemeTokens.authVerifyEmail.shadow.card,
  } as const satisfies AppBridgeVars;
}

export const awesomicBridgeVarsByAppearance = {
  light: createAwesomicBridgeVars("light"),
  dark: createAwesomicBridgeVars("dark"),
} as const;

// Compatibility export for the light-only documented Awesomic source.
export const awesomicBridgeVars = awesomicBridgeVarsByAppearance.light;
