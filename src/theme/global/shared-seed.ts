import type { ThemeConfig } from "antd";

export const appFontFamily =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const sharedSeedToken = {
  fontFamily: appFontFamily,
} satisfies ThemeConfig["token"];
