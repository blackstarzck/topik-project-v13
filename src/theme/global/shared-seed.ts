import type { ThemeConfig } from "antd";

export const appFontFamily =
  'var(--font-pretendard), system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

export const sharedSeedToken = {
  fontFamily: appFontFamily,
} satisfies ThemeConfig["token"];
