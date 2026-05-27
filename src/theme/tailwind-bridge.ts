import { theme as antdTheme } from "antd";
import type { ThemeConfig } from "antd";

export type ResolvedBridgeVars = Record<string, string>;

/**
 * Resolves actual CSS values (hex, px, font string) from an AntD ThemeConfig.
 * Safe for SSR — values are computed from ThemeConfig, never from var(--ant-*) chains.
 * Inject the result onto <html style={...}> in layout.tsx.
 */
export function getResolvedBridgeVars(themeConfig: ThemeConfig): ResolvedBridgeVars {
  const token = antdTheme.getDesignToken(themeConfig);
  return {
    "--app-color-primary": token.colorPrimary,
    "--app-color-bg-layout": token.colorBgLayout,
    "--app-color-bg-container": token.colorBgContainer,
    "--app-color-text": token.colorText,
    "--app-color-text-secondary": token.colorTextSecondary,
    "--app-color-border": token.colorBorder,
    "--app-radius": `${token.borderRadius}px`,
    "--app-font-family": token.fontFamily,
    "--app-shadow-elevated": token.boxShadowSecondary,
  };
}
