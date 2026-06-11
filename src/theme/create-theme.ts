import type { ThemeConfig } from "antd";

import { appearanceAlgorithms } from "./global/algorithms";
import { sharedSeedToken } from "./global/shared-seed";
import { sharedComponentTokens } from "./components/shared";
import type { AppThemePreset, BuiltAppTheme, ThemeAppearance } from "./types";

function mergeComponentTokens(
  base: ThemeConfig["components"] = {},
  overrides: ThemeConfig["components"] = {},
): ThemeConfig["components"] {
  const merged = new Map<string, Record<string, unknown>>();

  Object.entries(base).forEach(([componentName, componentTokens]) => {
    merged.set(componentName, { ...(componentTokens as Record<string, unknown>) });
  });

  Object.entries(overrides).forEach(([componentName, componentTokens]) => {
    merged.set(componentName, {
      ...(merged.get(componentName) ?? {}),
      ...(componentTokens as Record<string, unknown>),
    });
  });

  return Object.fromEntries(merged);
}

function normalizeAlgorithms(
  appearance: ThemeAppearance,
  presetAlgorithm: ThemeConfig["algorithm"],
): NonNullable<ThemeConfig["algorithm"]> {
  const baseAlgorithm = appearanceAlgorithms[appearance];

  if (!presetAlgorithm) {
    return baseAlgorithm;
  }

  return Array.isArray(presetAlgorithm)
    ? [baseAlgorithm, ...presetAlgorithm]
    : [baseAlgorithm, presetAlgorithm];
}

export function createThemeFamily<Name extends string>(
  preset: AppThemePreset<Name>,
): Record<ThemeAppearance, BuiltAppTheme<Name>> {
  return {
    light: createTheme(preset, "light"),
    dark: createTheme(preset, "dark"),
  };
}

export function createTheme<Name extends string>(
  preset: AppThemePreset<Name>,
  appearance: ThemeAppearance,
): BuiltAppTheme<Name> {
  const appearanceConfig = preset.appearances[appearance];

  return {
    name: preset.name,
    label: preset.label,
    description: preset.description,
    appearance,
    antd: {
      ...appearanceConfig,
      cssVar: { key: "talkpik", prefix: "ant" },
      algorithm: normalizeAlgorithms(appearance, appearanceConfig.algorithm),
      token: {
        ...sharedSeedToken,
        ...appearanceConfig.token,
      },
      components: mergeComponentTokens(
        sharedComponentTokens,
        appearanceConfig.components,
      ),
    },
  };
}
