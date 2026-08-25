export const allowedAppBridgeVars = [
  "--app-color-primary",
  "--app-color-bg-layout",
  "--app-color-bg-container",
  "--app-color-mask-subtle",
  "--app-color-text",
  "--app-color-text-secondary",
  "--app-color-link-secondary",
  "--app-color-border",
  "--app-color-border-secondary",
  "--app-color-chart-series-primary",
  "--app-color-chart-accent",
  "--app-color-status-error",
  "--app-color-status-warning",
  "--app-color-status-success",
  "--app-color-status-strong-success",
  "--app-color-fill-secondary",
  "--app-color-landing-cta-primary",
  "--app-color-landing-cta-primary-hover",
  "--app-color-landing-cta-foreground",
  "--app-color-landing-cta-ghost-surface",
  "--app-color-landing-cta-ghost-text",
  "--app-color-landing-cta-ghost-border",
  "--app-color-landing-hero-outer-canvas",
  "--app-color-landing-hero-media-fallback",
  "--app-color-landing-hero-header-surface",
  "--app-color-landing-hero-header-foreground",
  "--app-color-landing-hero-header-hover",
  "--app-color-landing-hero-foreground",
  "--app-color-landing-hero-kicker",
  "--app-color-landing-hero-body",
  "--app-color-landing-portfolio-foreground",
  "--app-color-landing-portfolio-heading-accent",
  "--app-color-landing-portfolio-supporting",
  "--app-color-landing-portfolio-muted",
  "--app-color-landing-portfolio-faint",
  "--app-color-landing-portfolio-label",
  "--app-color-landing-portfolio-footer-hover",
  "--app-color-landing-portfolio-canvas",
  "--app-color-landing-portfolio-dark-surface",
  "--app-color-landing-portfolio-inverse-foreground",
  "--app-color-landing-portfolio-tag-surface",
  "--app-color-landing-portfolio-card-surface",
  "--app-color-landing-portfolio-divider",
  "--app-color-landing-portfolio-divider-subtle",
  "--app-color-landing-portfolio-action-hover",
  "--app-background-landing-portfolio-media-placeholder",
  "--app-background-landing-portfolio-media-overlay",
  "--app-color-auth-prompt-focus-outline",
  "--app-color-auth-prompt-login-focus-border",
  "--app-color-auth-character-purple",
  "--app-color-auth-character-charcoal",
  "--app-color-auth-character-coral",
  "--app-color-auth-character-yellow",
  "--app-color-auth-character-ink",
  "--app-color-auth-character-eye",
  "--app-radius",
  "--app-radius-card",
  "--app-radius-pill",
  "--app-radius-indicator",
  "--app-radius-landing-hero-cta",
  "--app-radius-auth-prompt-control",
  "--app-radius-auth-character-base-edge",
  "--app-radius-auth-character-body-top",
  "--app-radius-auth-character-pill",
  "--app-radius-landing-portfolio-media",
  "--app-radius-landing-portfolio-round",
  "--app-radius-landing-portfolio-tag-pill",
  "--app-size-auth-prompt-control",
  "--app-font-family",
  "--app-font-landing-portfolio-display",
  "--app-font-landing-portfolio-numeric",
  "--app-font-size-caption",
  "--app-font-size-body",
  "--app-font-size-body-lg",
  "--app-font-size-subheading",
  "--app-font-size-heading-sm",
  "--app-font-size-heading",
  "--app-font-size-heading-lg",
  "--app-font-size-display-sm",
  "--app-font-size-display",
  "--app-shadow-elevated",
  "--app-shadow-auth-prompt-focus",
  "--app-shadow-auth-prompt-login-focus",
] as const;

export type AppBridgeVarName = (typeof allowedAppBridgeVars)[number];
export type AppBridgeVars = Record<AppBridgeVarName, string>;

export type AppBridgeTokenSource = {
  colorPrimary: string;
  colorBgLayout: string;
  colorBgContainer: string;
  colorMaskSubtle: string;
  colorText: string;
  colorTextSecondary: string;
  colorLinkSecondary: string;
  colorBorder: string;
  colorBorderSecondary: string;
  colorChartSeriesPrimary: string;
  colorChartAccent: string;
  colorStatusError: string;
  colorStatusWarning: string;
  colorStatusSuccess: string;
  colorStatusStrongSuccess: string;
  colorFillSecondary: string;
  colorLandingCtaPrimary: string;
  colorLandingCtaPrimaryHover: string;
  colorLandingCtaForeground: string;
  colorLandingCtaGhostSurface: string;
  colorLandingCtaGhostText: string;
  colorLandingCtaGhostBorder: string;
  colorLandingHeroOuterCanvas: string;
  colorLandingHeroMediaFallback: string;
  colorLandingHeroHeaderSurface: string;
  colorLandingHeroHeaderForeground: string;
  colorLandingHeroHeaderHover: string;
  colorLandingHeroForeground: string;
  colorLandingHeroKicker: string;
  colorLandingHeroBody: string;
  colorLandingPortfolioForeground: string;
  colorLandingPortfolioHeadingAccent: string;
  colorLandingPortfolioSupporting: string;
  colorLandingPortfolioMuted: string;
  colorLandingPortfolioFaint: string;
  colorLandingPortfolioLabel: string;
  colorLandingPortfolioFooterHover: string;
  colorLandingPortfolioCanvas: string;
  colorLandingPortfolioDarkSurface: string;
  colorLandingPortfolioInverseForeground: string;
  colorLandingPortfolioTagSurface: string;
  colorLandingPortfolioCardSurface: string;
  colorLandingPortfolioDivider: string;
  colorLandingPortfolioDividerSubtle: string;
  colorLandingPortfolioActionHover: string;
  backgroundLandingPortfolioMediaPlaceholder: string;
  backgroundLandingPortfolioMediaOverlay: string;
  colorAuthPromptFocusOutline: string;
  colorAuthPromptLoginFocusBorder: string;
  colorAuthCharacterPurple: string;
  colorAuthCharacterCharcoal: string;
  colorAuthCharacterCoral: string;
  colorAuthCharacterYellow: string;
  colorAuthCharacterInk: string;
  colorAuthCharacterEye: string;
  radius: string;
  radiusCard: string;
  radiusPill: string;
  radiusIndicator: string;
  radiusLandingHeroCta: string;
  radiusAuthPromptControl: string;
  radiusAuthCharacterBaseEdge: string;
  radiusAuthCharacterBodyTop: string;
  radiusAuthCharacterPill: string;
  radiusLandingPortfolioMedia: string;
  radiusLandingPortfolioRound: string;
  radiusLandingPortfolioTagPill: string;
  sizeAuthPromptControl: string;
  fontFamily: string;
  fontLandingPortfolioDisplay: string;
  fontLandingPortfolioNumeric: string;
  fontSizeCaption: string;
  fontSizeBody: string;
  fontSizeBodyLg: string;
  fontSizeSubheading: string;
  fontSizeHeadingSm: string;
  fontSizeHeading: string;
  fontSizeHeadingLg: string;
  fontSizeDisplaySm: string;
  fontSizeDisplay: string;
  shadowElevated: string;
  shadowAuthPromptFocus: string;
  shadowAuthPromptLoginFocus: string;
};

export function createAppBridgeVars(
  source: AppBridgeTokenSource,
): AppBridgeVars {
  return {
    "--app-color-primary": source.colorPrimary,
    "--app-color-bg-layout": source.colorBgLayout,
    "--app-color-bg-container": source.colorBgContainer,
    "--app-color-mask-subtle": source.colorMaskSubtle,
    "--app-color-text": source.colorText,
    "--app-color-text-secondary": source.colorTextSecondary,
    "--app-color-link-secondary": source.colorLinkSecondary,
    "--app-color-border": source.colorBorder,
    "--app-color-border-secondary": source.colorBorderSecondary,
    "--app-color-chart-series-primary": source.colorChartSeriesPrimary,
    "--app-color-chart-accent": source.colorChartAccent,
    "--app-color-status-error": source.colorStatusError,
    "--app-color-status-warning": source.colorStatusWarning,
    "--app-color-status-success": source.colorStatusSuccess,
    "--app-color-status-strong-success": source.colorStatusStrongSuccess,
    "--app-color-fill-secondary": source.colorFillSecondary,
    "--app-color-landing-cta-primary": source.colorLandingCtaPrimary,
    "--app-color-landing-cta-primary-hover": source.colorLandingCtaPrimaryHover,
    "--app-color-landing-cta-foreground": source.colorLandingCtaForeground,
    "--app-color-landing-cta-ghost-surface": source.colorLandingCtaGhostSurface,
    "--app-color-landing-cta-ghost-text": source.colorLandingCtaGhostText,
    "--app-color-landing-cta-ghost-border": source.colorLandingCtaGhostBorder,
    "--app-color-landing-hero-outer-canvas": source.colorLandingHeroOuterCanvas,
    "--app-color-landing-hero-media-fallback":
      source.colorLandingHeroMediaFallback,
    "--app-color-landing-hero-header-surface":
      source.colorLandingHeroHeaderSurface,
    "--app-color-landing-hero-header-foreground":
      source.colorLandingHeroHeaderForeground,
    "--app-color-landing-hero-header-hover": source.colorLandingHeroHeaderHover,
    "--app-color-landing-hero-foreground": source.colorLandingHeroForeground,
    "--app-color-landing-hero-kicker": source.colorLandingHeroKicker,
    "--app-color-landing-hero-body": source.colorLandingHeroBody,
    "--app-color-landing-portfolio-foreground":
      source.colorLandingPortfolioForeground,
    "--app-color-landing-portfolio-heading-accent":
      source.colorLandingPortfolioHeadingAccent,
    "--app-color-landing-portfolio-supporting":
      source.colorLandingPortfolioSupporting,
    "--app-color-landing-portfolio-muted": source.colorLandingPortfolioMuted,
    "--app-color-landing-portfolio-faint": source.colorLandingPortfolioFaint,
    "--app-color-landing-portfolio-label": source.colorLandingPortfolioLabel,
    "--app-color-landing-portfolio-footer-hover":
      source.colorLandingPortfolioFooterHover,
    "--app-color-landing-portfolio-canvas": source.colorLandingPortfolioCanvas,
    "--app-color-landing-portfolio-dark-surface":
      source.colorLandingPortfolioDarkSurface,
    "--app-color-landing-portfolio-inverse-foreground":
      source.colorLandingPortfolioInverseForeground,
    "--app-color-landing-portfolio-tag-surface":
      source.colorLandingPortfolioTagSurface,
    "--app-color-landing-portfolio-card-surface":
      source.colorLandingPortfolioCardSurface,
    "--app-color-landing-portfolio-divider":
      source.colorLandingPortfolioDivider,
    "--app-color-landing-portfolio-divider-subtle":
      source.colorLandingPortfolioDividerSubtle,
    "--app-color-landing-portfolio-action-hover":
      source.colorLandingPortfolioActionHover,
    "--app-background-landing-portfolio-media-placeholder":
      source.backgroundLandingPortfolioMediaPlaceholder,
    "--app-background-landing-portfolio-media-overlay":
      source.backgroundLandingPortfolioMediaOverlay,
    "--app-color-auth-prompt-focus-outline": source.colorAuthPromptFocusOutline,
    "--app-color-auth-prompt-login-focus-border":
      source.colorAuthPromptLoginFocusBorder,
    "--app-color-auth-character-purple": source.colorAuthCharacterPurple,
    "--app-color-auth-character-charcoal": source.colorAuthCharacterCharcoal,
    "--app-color-auth-character-coral": source.colorAuthCharacterCoral,
    "--app-color-auth-character-yellow": source.colorAuthCharacterYellow,
    "--app-color-auth-character-ink": source.colorAuthCharacterInk,
    "--app-color-auth-character-eye": source.colorAuthCharacterEye,
    "--app-radius": source.radius,
    "--app-radius-card": source.radiusCard,
    "--app-radius-pill": source.radiusPill,
    "--app-radius-indicator": source.radiusIndicator,
    "--app-radius-landing-hero-cta": source.radiusLandingHeroCta,
    "--app-radius-auth-prompt-control": source.radiusAuthPromptControl,
    "--app-radius-auth-character-base-edge": source.radiusAuthCharacterBaseEdge,
    "--app-radius-auth-character-body-top": source.radiusAuthCharacterBodyTop,
    "--app-radius-auth-character-pill": source.radiusAuthCharacterPill,
    "--app-radius-landing-portfolio-media": source.radiusLandingPortfolioMedia,
    "--app-radius-landing-portfolio-round": source.radiusLandingPortfolioRound,
    "--app-radius-landing-portfolio-tag-pill":
      source.radiusLandingPortfolioTagPill,
    "--app-size-auth-prompt-control": source.sizeAuthPromptControl,
    "--app-font-family": source.fontFamily,
    "--app-font-landing-portfolio-display": source.fontLandingPortfolioDisplay,
    "--app-font-landing-portfolio-numeric": source.fontLandingPortfolioNumeric,
    "--app-font-size-caption": source.fontSizeCaption,
    "--app-font-size-body": source.fontSizeBody,
    "--app-font-size-body-lg": source.fontSizeBodyLg,
    "--app-font-size-subheading": source.fontSizeSubheading,
    "--app-font-size-heading-sm": source.fontSizeHeadingSm,
    "--app-font-size-heading": source.fontSizeHeading,
    "--app-font-size-heading-lg": source.fontSizeHeadingLg,
    "--app-font-size-display-sm": source.fontSizeDisplaySm,
    "--app-font-size-display": source.fontSizeDisplay,
    "--app-shadow-elevated": source.shadowElevated,
    "--app-shadow-auth-prompt-focus": source.shadowAuthPromptFocus,
    "--app-shadow-auth-prompt-login-focus": source.shadowAuthPromptLoginFocus,
  };
}
