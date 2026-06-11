import type { ThemeAppearance } from "./types";

export const themeSettings = {
  main: "awesomic",
  appearance: "light",
  allowAppearanceSwitching: false,
} as const satisfies {
  main: string;
  appearance: ThemeAppearance;
  allowAppearanceSwitching: boolean;
};

export const iconSettings = {
  lucide: {
    strokeWidth: 1.2,
  },
} as const;
