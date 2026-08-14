import type { AppThemePreset } from "../types";

export const defaultThemePreset = {
  name: "default",
  label: "Default",
  description:
    "Stock Ant Design theme with DOTORE TOPIK shared app foundations.",
  appearances: {
    light: {},
    dark: {},
  },
} satisfies AppThemePreset<"default">;
