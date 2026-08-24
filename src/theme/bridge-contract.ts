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
    "--app-shadow-elevated": source.shadowElevated,
  };
}
