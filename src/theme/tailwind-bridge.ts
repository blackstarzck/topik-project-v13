import type { ThemeConfig } from "antd";

import { themeSettings } from "./config";
import type { ThemeAppearance } from "./types";
import type { AppBridgeVars } from "./bridge-contract";
import { awesomicBridgeVarsByAppearance } from "./tokens/awesomic";
import { appFontFamily } from "./global/shared-seed";

export type ResolvedBridgeVars = AppBridgeVars;

const DEFAULT_LIGHT_SHADOW_ELEVATED =
  "0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)";
const DEFAULT_DARK_SHADOW_ELEVATED =
  "0 6px 16px 0 rgba(255, 255, 255, 0.016), 0 3px 6px -4px rgba(255, 255, 255, 0.024), 0 9px 28px 8px rgba(255, 255, 255, 0.01)";

const DEFAULT_SHARED_OVERLAY_SHADOW_BRIDGE_VARS = {
  "--app-shadow-floating-action": "0 6px 18px rgba(42, 55, 89, 0.1)",
  "--app-shadow-popover":
    "0 16px 42px rgba(15, 23, 42, 0.16), 0 4px 14px rgba(15, 23, 42, 0.1)",
  "--app-shadow-message":
    "0 6px 16px 0 rgba(0, 0, 0, 0.1), 0 2px 6px -2px rgba(0, 0, 0, 0.08)",
} as const;

const DEFAULT_NOTIFICATION_BRIDGE_VARS = {
  "--app-shadow-notification-channel-selected":
    "0 0 0 1px var(--app-color-primary)",
} as const;

const DEFAULT_SHARED_CARD_BRIDGE_VARS = {
  "--app-color-shared-card-subtle-outline":
    "color-mix(in srgb, var(--app-color-border) 25%, var(--app-color-bg-layout))",
} as const;

const DEFAULT_PRACTICE_FOUNDATION_BRIDGE_VARS = {
  "--app-color-library-review-score-track":
    "color-mix(in srgb, var(--app-color-border) 18%, var(--app-color-bg-container))",
  "--app-color-problem-new-badge-surface":
    "color-mix(in srgb, var(--app-color-text-secondary) 12%, transparent)",
  "--app-radius-practice-retry-summary": "10px",
  "--app-radius-practice-retry-mode-option": "12px",
  "--app-radius-problem-new-badge": "12px",
  "--app-font-question-number-display":
    '"Space Grotesk", var(--app-font-family), sans-serif',
  "--app-shadow-selectable-card-selected":
    "var(--app-shadow-elevated), 0 0 0 1.5px var(--app-color-primary) inset",
} as const;

const DEFAULT_ANALYSIS_FOUNDATION_BRIDGE_VARS = {
  "--app-color-analysis-handoff-overlay-surface":
    "color-mix(in srgb, var(--app-color-bg-container) 62%, transparent)",
  "--app-radius-analysis-failure-action": "10px",
} as const;

const DEFAULT_WRITING_EXAM_BRIDGE_VARS = {
  "--app-color-writing-exam-header-surface":
    "color-mix(in srgb, var(--app-color-bg-container) 92%, transparent)",
} as const;

const DEFAULT_WRITING_MATERIAL_BRIDGE_VARS = {
  "--app-color-writing-material-row-active-surface":
    "color-mix(in srgb, var(--app-color-primary) 8%, transparent)",
  "--app-radius-writing-material-compact-surface": "4px",
  "--app-shadow-writing-material-tooltip": "0 4px 12px rgb(0 0 0 / 6%)",
} as const;

const DEFAULT_WRITING_BLANK_BRIDGE_VARS = {
  "--app-color-writing-blank-active-surface":
    "color-mix(in srgb, var(--app-color-primary) 6%, var(--app-color-bg-container))",
  "--app-color-writing-blank-filled-border":
    "color-mix(in srgb, var(--app-color-primary) 42%, var(--app-color-border))",
  "--app-shadow-writing-blank-focus":
    "0 0 0 2px color-mix(in srgb, var(--app-color-primary) 18%, transparent)",
  "--app-shadow-writing-blank-active-inset":
    "inset 0 -2px 0 var(--app-color-primary)",
} as const;

const DEFAULT_WRITING_MANUSCRIPT_SHARED_BRIDGE_VARS = {
  "--app-font-writing-manuscript-mono":
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  "--app-color-writing-manuscript-intro-surface":
    "color-mix(in srgb, var(--app-color-primary) 12%, var(--app-color-bg-container))",
  "--app-color-writing-manuscript-intro-border":
    "color-mix(in srgb, var(--app-color-primary) 48%, var(--app-color-border))",
  "--app-shadow-writing-manuscript-intro-inset":
    "inset 0 0 0 1px color-mix(in srgb, var(--app-color-primary) 30%, transparent)",
  "--app-color-writing-manuscript-body-border":
    "color-mix(in srgb, var(--app-color-status-success) 48%, var(--app-color-border))",
  "--app-shadow-writing-manuscript-body-inset":
    "inset 0 0 0 1px color-mix(in srgb, var(--app-color-status-success) 30%, transparent)",
  "--app-color-writing-manuscript-conclusion-border":
    "color-mix(in srgb, var(--app-color-status-warning) 48%, var(--app-color-border))",
  "--app-shadow-writing-manuscript-conclusion-inset":
    "inset 0 0 0 1px color-mix(in srgb, var(--app-color-status-warning) 30%, transparent)",
} as const;

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

const DEFAULT_AUTH_CHARACTER_COLOR_BRIDGE_VARS = {
  "--app-color-auth-character-purple": "#6c3ff5",
  "--app-color-auth-character-charcoal": "#2d2d2d",
  "--app-color-auth-character-coral": "#ff9b6b",
  "--app-color-auth-character-yellow": "#e8d754",
  "--app-color-auth-character-ink": "#25262d",
  "--app-color-auth-character-eye": "#ffffff",
} as const;

const DEFAULT_AUTH_CHARACTER_RADIUS_BRIDGE_VARS = {
  "--app-radius-auth-character-base-edge": "0px",
  "--app-radius-auth-character-body-top": "10px",
  "--app-radius-auth-character-pill": "999px",
} as const;

const DEFAULT_AUTH_PROMPT_BACKGROUND_BRIDGE_VARS = {
  "--app-color-auth-prompt-canvas": "#ffffff",
  "--app-background-auth-prompt-hero":
    "radial-gradient(circle at 48% 55%, rgba(255, 255, 255, 0.08), transparent 36%), radial-gradient(circle at 28% 78%, rgba(255, 255, 255, 0.05), transparent 30%), linear-gradient(145deg, #202020 0%, #191919 62%, #242424 100%)",
} as const;

const DEFAULT_AUTH_SURFACE_BRIDGE_VARS = {
  "--app-color-auth-consent-document-surface":
    "color-mix(in srgb, var(--app-color-bg-container) 94%, var(--app-color-bg-layout))",
  "--app-color-auth-verify-email-card-border":
    "color-mix(in srgb, var(--app-color-border) 72%, transparent)",
  "--app-color-auth-verify-email-summary-surface":
    "color-mix(in srgb, var(--app-color-bg-layout) 56%, var(--app-color-bg-container))",
  "--app-radius-auth-verify-email-card": "28px",
  "--app-radius-auth-verify-email-card-compact": "12px",
  "--app-shadow-auth-verify-email-card":
    "0 18px 44px color-mix(in srgb, var(--app-color-primary) 10%, transparent), var(--app-shadow-elevated)",
} as const;

const DEFAULT_LANDING_HERO_BRIDGE_VARS = {
  "--app-color-landing-hero-outer-canvas": "#f7f3ef",
  "--app-color-landing-hero-media-fallback": "#ccc2b7",
  "--app-color-landing-hero-header-surface": "rgba(255, 255, 255, 0.72)",
  "--app-color-landing-hero-header-foreground": "#0c0c0d",
  "--app-color-landing-hero-header-hover": "#8b8b8e",
  "--app-color-landing-hero-foreground": "#ffffff",
  "--app-color-landing-hero-kicker": "rgba(255, 255, 255, 0.72)",
  "--app-color-landing-hero-body": "rgba(255, 255, 255, 0.82)",
} as const;

const DEFAULT_LANDING_PORTFOLIO_BRIDGE_VARS = {
  "--app-color-landing-portfolio-foreground": "#0c0c0d",
  "--app-color-landing-portfolio-heading-accent": "#a5a5aa",
  "--app-color-landing-portfolio-supporting": "#77777b",
  "--app-color-landing-portfolio-muted": "#8b8b8e",
  "--app-color-landing-portfolio-faint": "#b6b6b8",
  "--app-color-landing-portfolio-label": "#1c1c1f",
  "--app-color-landing-portfolio-footer-hover": "#3c3c40",
  "--app-color-landing-portfolio-canvas": "#ffffff",
  "--app-color-landing-portfolio-dark-surface": "#0c0c0d",
  "--app-color-landing-portfolio-inverse-foreground": "#ffffff",
  "--app-color-landing-portfolio-tag-surface": "rgba(255, 255, 255, 0.72)",
  "--app-color-landing-portfolio-card-surface": "#fbfbfb",
  "--app-color-landing-portfolio-divider": "#b9b9b3",
  "--app-color-landing-portfolio-divider-subtle": "#dededc",
  "--app-color-landing-portfolio-action-hover": "#1c1c1f",
  "--app-background-landing-portfolio-media-placeholder":
    "repeating-linear-gradient(135deg, #e9e9e8 0 10px, #f1f1f0 10px 20px), #ececeb",
  "--app-background-landing-portfolio-media-overlay":
    "linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(0, 0, 0, 0.04))",
  "--app-font-landing-portfolio-display":
    '"Space Grotesk", var(--app-font-family), sans-serif',
  "--app-font-landing-portfolio-numeric":
    '"Montserrat", var(--app-font-family), sans-serif',
  "--app-radius-landing-portfolio-media": "4px",
  "--app-radius-landing-portfolio-round": "50%",
  "--app-radius-landing-portfolio-tag-pill": "999px",
} as const;

const DEFAULT_BRIDGE_VARS = {
  light: {
    "--app-color-primary": "#1677ff",
    "--app-color-bg-layout": "#f5f5f5",
    "--app-color-bg-container": "#ffffff",
    "--app-color-mask-subtle": "rgba(244, 244, 245, 0.18)",
    "--app-color-text": "rgba(0, 0, 0, 0.88)",
    "--app-color-text-secondary": "rgba(0, 0, 0, 0.65)",
    "--app-color-text-inverse": "#ffffff",
    "--app-color-link-secondary": "#3254F2",
    "--app-color-border": "#d9d9d9",
    "--app-color-border-secondary": "#f0f0f0",
    ...DEFAULT_SHARED_CARD_BRIDGE_VARS,
    ...DEFAULT_PRACTICE_FOUNDATION_BRIDGE_VARS,
    ...DEFAULT_ANALYSIS_FOUNDATION_BRIDGE_VARS,
    "--app-color-chart-series-primary": "#1677ff",
    "--app-color-chart-accent": "#13c2c2",
    "--app-color-status-error": "#ff4d4f",
    "--app-color-status-error-border": "#ffccc7",
    "--app-color-status-error-surface": "#fff2f0",
    "--app-color-status-warning": "#faad14",
    "--app-color-status-success": "#52c41a",
    "--app-color-status-strong-success": "#389e0d",
    "--app-color-fill-secondary": "rgba(0, 0, 0, 0.06)",
    ...DEFAULT_WRITING_EXAM_BRIDGE_VARS,
    ...DEFAULT_WRITING_MATERIAL_BRIDGE_VARS,
    ...DEFAULT_WRITING_BLANK_BRIDGE_VARS,
    ...DEFAULT_WRITING_MANUSCRIPT_SHARED_BRIDGE_VARS,
    "--app-color-writing-manuscript-body-surface": "#f6ffed",
    "--app-color-writing-manuscript-conclusion-surface": "#fffbe6",
    "--app-color-landing-cta-primary": "#070203",
    "--app-color-landing-cta-primary-hover": "#21080c",
    "--app-color-landing-cta-foreground": "#ffffff",
    "--app-color-landing-cta-ghost-surface": "#ffffff",
    "--app-color-landing-cta-ghost-text": "#0c0c0d",
    "--app-color-landing-cta-ghost-border": "#e7e7e6",
    ...DEFAULT_LANDING_HERO_BRIDGE_VARS,
    ...DEFAULT_LANDING_PORTFOLIO_BRIDGE_VARS,
    ...DEFAULT_AUTH_PROMPT_BACKGROUND_BRIDGE_VARS,
    "--app-color-auth-prompt-focus-outline": "rgba(24, 24, 24, 0.08)",
    "--app-color-auth-prompt-login-focus-border": "#aab5ff",
    ...DEFAULT_AUTH_SURFACE_BRIDGE_VARS,
    ...DEFAULT_AUTH_CHARACTER_COLOR_BRIDGE_VARS,
    "--app-radius": "6px",
    "--app-radius-none": "0px",
    "--app-radius-card": "8px",
    "--app-radius-pill": "10000px",
    "--app-radius-indicator": "2px",
    "--app-radius-landing-hero-cta": "0px",
    "--app-radius-auth-prompt-control": "8px",
    ...DEFAULT_AUTH_CHARACTER_RADIUS_BRIDGE_VARS,
    "--app-size-auth-prompt-control": "50px",
    "--app-font-family": appFontFamily,
    ...DEFAULT_FONT_SIZE_BRIDGE_VARS,
    "--app-shadow-elevated": DEFAULT_LIGHT_SHADOW_ELEVATED,
    ...DEFAULT_SHARED_OVERLAY_SHADOW_BRIDGE_VARS,
    ...DEFAULT_NOTIFICATION_BRIDGE_VARS,
    "--app-shadow-auth-prompt-focus": "0 0 0 2px rgba(24, 24, 24, 0.08)",
    "--app-shadow-auth-prompt-login-focus": "0 0 0 2px rgba(82, 102, 255, 0.1)",
  },
  dark: {
    "--app-color-primary": "#1668dc",
    "--app-color-bg-layout": "#000000",
    "--app-color-bg-container": "#141414",
    "--app-color-mask-subtle": "rgba(0, 0, 0, 0.18)",
    "--app-color-text": "rgba(255, 255, 255, 0.85)",
    "--app-color-text-secondary": "rgba(255, 255, 255, 0.65)",
    "--app-color-text-inverse": "#ffffff",
    "--app-color-link-secondary": "#3254F2",
    "--app-color-border": "#424242",
    "--app-color-border-secondary": "#303030",
    ...DEFAULT_SHARED_CARD_BRIDGE_VARS,
    ...DEFAULT_PRACTICE_FOUNDATION_BRIDGE_VARS,
    ...DEFAULT_ANALYSIS_FOUNDATION_BRIDGE_VARS,
    "--app-color-chart-series-primary": "#1677ff",
    "--app-color-chart-accent": "#13c2c2",
    "--app-color-status-error": "#dc4446",
    "--app-color-status-error-border": "#5b2526",
    "--app-color-status-error-surface": "#2c1618",
    "--app-color-status-warning": "#d89614",
    "--app-color-status-success": "#49aa19",
    "--app-color-status-strong-success": "#3c8618",
    "--app-color-fill-secondary": "rgba(255, 255, 255, 0.12)",
    ...DEFAULT_WRITING_EXAM_BRIDGE_VARS,
    ...DEFAULT_WRITING_MATERIAL_BRIDGE_VARS,
    ...DEFAULT_WRITING_BLANK_BRIDGE_VARS,
    ...DEFAULT_WRITING_MANUSCRIPT_SHARED_BRIDGE_VARS,
    "--app-color-writing-manuscript-body-surface": "#162312",
    "--app-color-writing-manuscript-conclusion-surface": "#2b2111",
    "--app-color-landing-cta-primary": "#070203",
    "--app-color-landing-cta-primary-hover": "#21080c",
    "--app-color-landing-cta-foreground": "#ffffff",
    "--app-color-landing-cta-ghost-surface": "#ffffff",
    "--app-color-landing-cta-ghost-text": "#0c0c0d",
    "--app-color-landing-cta-ghost-border": "#e7e7e6",
    ...DEFAULT_LANDING_HERO_BRIDGE_VARS,
    ...DEFAULT_LANDING_PORTFOLIO_BRIDGE_VARS,
    ...DEFAULT_AUTH_PROMPT_BACKGROUND_BRIDGE_VARS,
    "--app-color-auth-prompt-focus-outline": "rgba(24, 24, 24, 0.08)",
    "--app-color-auth-prompt-login-focus-border": "#aab5ff",
    ...DEFAULT_AUTH_SURFACE_BRIDGE_VARS,
    ...DEFAULT_AUTH_CHARACTER_COLOR_BRIDGE_VARS,
    "--app-radius": "6px",
    "--app-radius-none": "0px",
    "--app-radius-card": "8px",
    "--app-radius-pill": "10000px",
    "--app-radius-indicator": "2px",
    "--app-radius-landing-hero-cta": "0px",
    "--app-radius-auth-prompt-control": "8px",
    ...DEFAULT_AUTH_CHARACTER_RADIUS_BRIDGE_VARS,
    "--app-size-auth-prompt-control": "50px",
    "--app-font-family": appFontFamily,
    ...DEFAULT_FONT_SIZE_BRIDGE_VARS,
    "--app-shadow-elevated": DEFAULT_DARK_SHADOW_ELEVATED,
    ...DEFAULT_SHARED_OVERLAY_SHADOW_BRIDGE_VARS,
    ...DEFAULT_NOTIFICATION_BRIDGE_VARS,
    "--app-shadow-auth-prompt-focus": "0 0 0 2px rgba(24, 24, 24, 0.08)",
    "--app-shadow-auth-prompt-login-focus": "0 0 0 2px rgba(82, 102, 255, 0.1)",
  },
} as const satisfies Record<ThemeAppearance, AppBridgeVars>;

const AWESOMIC_BRIDGE_VARS = {
  light: awesomicBridgeVarsByAppearance.light,
  dark: awesomicBridgeVarsByAppearance.dark,
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
