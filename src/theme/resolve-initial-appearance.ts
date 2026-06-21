import { cookies } from "next/headers";

import { themeSettings } from "@/theme/config";
import type { ThemeAppearance } from "@/theme/types";

/**
 * Reads appearance from the theme-appearance cookie.
 * Returns "light" for any missing, invalid, or unexpected value.
 *
 * NOTE (T1): Using cookies() makes this layout dynamically rendered (no static
 * caching). For TALKPIK AI, which requires Supabase Auth on all workspace
 * routes, the root layout is already dynamic, so this is an accepted tradeoff.
 */
export async function resolveInitialAppearance(): Promise<ThemeAppearance> {
  if (!themeSettings.allowAppearanceSwitching) {
    return themeSettings.appearance;
  }

  const cookieStore = await cookies();
  const raw = cookieStore.get("theme-appearance")?.value;
  return raw === "dark" ? "dark" : "light";
}
