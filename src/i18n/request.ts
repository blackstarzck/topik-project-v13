import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { getCurrentProfile } from "@/lib/auth/profile";
import { localeFromAcceptLanguage, type UiLocaleSource } from "./detection";
import {
  asLocale,
  DEFAULT_LOCALE,
  DEFAULT_TIME_ZONE,
  LOCALE_COOKIE,
  type Locale,
} from "./locales";

type ProfileLocalePreference = {
  ui_locale?: string | null;
  ui_locale_source?: UiLocaleSource | null;
};

async function localeFromCookie(): Promise<Locale | null> {
  try {
    const cookieStore = await cookies();
    return asLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  } catch {
    return null;
  }
}

async function localeFromHeader(): Promise<Locale | null> {
  try {
    const headerStore = await headers();
    return localeFromAcceptLanguage(headerStore.get("accept-language"));
  } catch {
    return null;
  }
}

export async function resolveLocaleForProfile(
  profile: ProfileLocalePreference | null | undefined,
): Promise<Locale> {
  const fromProfile = asLocale(profile?.ui_locale);
  const profileSource = profile?.ui_locale_source ?? "legacy";

  if (fromProfile && profileSource !== "default") {
    return fromProfile;
  }

  const fromCookie = await localeFromCookie();
  if (fromCookie) return fromCookie;

  const fromHeader = await localeFromHeader();
  if (fromHeader) return fromHeader;

  return fromProfile ?? DEFAULT_LOCALE;
}

/**
 * Server-only locale resolution. Order:
 *
 *   1. authenticated profile locale, except `ui_locale_source='default'`
 *   2. `NEXT_LOCALE` cookie
 *   3. `Accept-Language` request header
 *   4. baseline `ko`
 *
 * A `default` profile is only a bootstrap placeholder, so request hints still
 * decide the first visible locale for newly-created OAuth profiles.
 */
export async function resolveLocale(): Promise<Locale> {
  try {
    const profile = await getCurrentProfile();
    return resolveLocaleForProfile(profile);
  } catch {
    return resolveLocaleForProfile(null);
  }
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const messages = (await import(`../../messages/${locale}.json`)).default;
  return { locale, messages, timeZone: DEFAULT_TIME_ZONE };
});
