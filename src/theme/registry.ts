import { createThemeFamily } from "./create-theme";
import { defaultThemePreset } from "./presets/default";
import type { AppThemeName, BuiltAppTheme, ThemeAppearance } from "./types";

export const defaultThemeName = "default" satisfies AppThemeName;
export const defaultAppearance = "light" satisfies ThemeAppearance;

export const themePresets = {
  default: defaultThemePreset,
} satisfies Record<AppThemeName, typeof defaultThemePreset>;

export const themes = {
  default: createThemeFamily(defaultThemePreset),
} satisfies Record<AppThemeName, Record<ThemeAppearance, BuiltAppTheme>>;

export function getAppTheme(
  themeName: AppThemeName = defaultThemeName,
  appearance: ThemeAppearance = defaultAppearance,
): BuiltAppTheme {
  return themes[themeName][appearance];
}
