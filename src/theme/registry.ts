import { createThemeFamily } from "./create-theme";
import { themeSettings } from "./config";
import { awesomicThemePreset } from "./presets/awesomic";
import { defaultThemePreset } from "./presets/default";
import type { AppThemePreset, BuiltAppTheme, ThemeAppearance } from "./types";

export const themePresets = {
  default: defaultThemePreset,
  awesomic: awesomicThemePreset,
} satisfies Record<string, AppThemePreset>;

export type AppThemeName = keyof typeof themePresets;

export const defaultThemeName = themeSettings.main satisfies AppThemeName;
export const defaultAppearance =
  themeSettings.appearance satisfies ThemeAppearance;

export const themes = {
  default: createThemeFamily(defaultThemePreset),
  awesomic: createThemeFamily(awesomicThemePreset),
} satisfies Record<AppThemeName, Record<ThemeAppearance, BuiltAppTheme>>;

export function getAppTheme(
  themeName: AppThemeName = defaultThemeName,
  appearance: ThemeAppearance = defaultAppearance,
): BuiltAppTheme {
  return themes[themeName][appearance];
}
