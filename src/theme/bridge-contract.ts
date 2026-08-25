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
  colorText: string;
  colorTextSecondary: string;
  colorLinkSecondary: string;
  colorBorder: string;
  radius: string;
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
    "--app-color-text": source.colorText,
    "--app-color-text-secondary": source.colorTextSecondary,
    "--app-color-link-secondary": source.colorLinkSecondary,
    "--app-color-border": source.colorBorder,
    "--app-radius": source.radius,
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
