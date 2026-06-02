import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { getCurrentProfile } from "@/lib/auth/profile";
import {
  asLocale,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  type Locale,
} from "./locales";

/**
 * Server-only locale resolution. Order (per G-01 design):
 *
 *   1. authenticated user's `profiles.ui_locale`
 *   2. `NEXT_LOCALE` cookie  (anonymous visitors AND the just-saved value
 *      before the next auth round-trip sees the new DB row)
 *   3. `'ko'` baseline
 *
 * Resilience: the profile lookup hits Supabase (auth + RLS). On public pages
 * there may be no session, and during `pnpm build` prerender there may be no
 * Supabase env at all. Any failure degrades to the cookie → default chain
 * rather than throwing — locale must never break a render.
 *
 * Shared by `getRequestConfig` (below) AND the root layout's `<html lang>`,
 * so both always agree on the active locale.
 */
export async function resolveLocale(): Promise<Locale> {
  // 1. Authenticated user preference.
  try {
    const profile = await getCurrentProfile();
    const fromProfile = asLocale(profile?.ui_locale);
    if (fromProfile) return fromProfile;
  } catch {
    // No session / no env / RLS — fall through to the cookie.
  }

  // 2. Cookie (anonymous or just-saved).
  try {
    const cookieStore = await cookies();
    const fromCookie = asLocale(cookieStore.get(LOCALE_COOKIE)?.value);
    if (fromCookie) return fromCookie;
  } catch {
    // cookies() unavailable in some contexts — fall through.
  }

  // 3. Baseline.
  return DEFAULT_LOCALE;
}

/**
 * next-intl request config WITHOUT i18n routing. We do not use a `[locale]`
 * URL segment; instead the locale comes from the user preference / cookie via
 * `resolveLocale()`. Returning an explicit `locale` is required when routing
 * is not configured.
 */
export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const messages = (await import(`../../messages/${locale}.json`)).default;
  return { locale, messages };
});
