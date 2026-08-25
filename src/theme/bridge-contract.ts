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
  "--app-color-status-error",
  "--app-color-status-warning",
  "--app-color-status-success",
  "--app-color-status-strong-success",
  "--app-color-fill-secondary",
  "--app-radius",
  "--app-radius-indicator",
  "--app-font-family",
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
  colorStatusError: string;
  colorStatusWarning: string;
  colorStatusSuccess: string;
  colorStatusStrongSuccess: string;
  colorFillSecondary: string;
  radius: string;
  radiusIndicator: string;
  fontFamily: string;
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
    "--app-color-status-error": source.colorStatusError,
    "--app-color-status-warning": source.colorStatusWarning,
    "--app-color-status-success": source.colorStatusSuccess,
    "--app-color-status-strong-success": source.colorStatusStrongSuccess,
    "--app-color-fill-secondary": source.colorFillSecondary,
    "--app-radius": source.radius,
    "--app-radius-indicator": source.radiusIndicator,
    "--app-font-family": source.fontFamily,
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
  };
}
