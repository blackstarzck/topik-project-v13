import type { AppThemePreset } from "../types";
import { awesomicThemeToken } from "../awesomic";

export const defaultThemePreset = {
  name: "default",
  label: "Awesomic",
  description: "Awesomic light-fixed theme bound through Ant Design tokens.",
  appearances: {
    light: {
      token: awesomicThemeToken,
    },
    // Dark infrastructure is kept for future work, but user-facing entry points
    // are light-fixed until a real Awesomic dark contract exists.
    dark: {
      token: awesomicThemeToken,
    },
  },
} satisfies AppThemePreset<"default">;
