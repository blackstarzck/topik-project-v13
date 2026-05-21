import type { ThemeConfig } from "antd";

export type ThemeAppearance = "light" | "dark";

export type AppThemeName = "default";

export type AppearanceThemeConfig = Omit<ThemeConfig, "algorithm"> & {
  algorithm?: ThemeConfig["algorithm"];
};

export interface AppThemePreset<Name extends string = AppThemeName> {
  name: Name;
  label: string;
  description: string;
  appearances: Record<ThemeAppearance, AppearanceThemeConfig>;
}

export interface BuiltAppTheme<Name extends string = AppThemeName> {
  name: Name;
  label: string;
  description: string;
  appearance: ThemeAppearance;
  antd: ThemeConfig;
}
