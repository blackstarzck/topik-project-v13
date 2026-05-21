import { theme } from "antd";

import type { ThemeAppearance } from "../types";

export const appearanceAlgorithms = {
  light: theme.defaultAlgorithm,
  dark: theme.darkAlgorithm,
} satisfies Record<
  ThemeAppearance,
  NonNullable<Parameters<typeof theme.getDesignToken>[0]>["algorithm"]
>;
