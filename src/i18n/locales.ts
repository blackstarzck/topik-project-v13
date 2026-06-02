/**
 * Supported UI locales for TALKPIK AI.
 *
 * `ko` is the baseline (source of truth for copy); `en` and `vi` are full
 * translations of whatever keys have been migrated so far. This list is the
 * single source of truth — `profiles.ui_locale` (DB enum) and the message
 * catalog filenames (`messages/{locale}.json`) MUST stay aligned with it.
 *
 * Client-safe: this module has no server-only imports, so both server
 * (`getRequestConfig`, root layout) and client (LanguageForm) can import it.
 */

export const LOCALES = ["ko", "en", "vi"] as const;

export type Locale = (typeof LOCALES)[number];

/** Baseline locale — used as the final fallback when nothing else resolves. */
export const DEFAULT_LOCALE: Locale = "ko";

/**
 * Global time zone for next-intl. REQUIRED: without it, next-intl throws
 * ENVIRONMENT_FALLBACK and time-aware formatting falls back to the runtime's
 * timezone, which differs server (UTC) vs client → hydration mismatch. Must be
 * passed to BOTH `getRequestConfig` (server) and `NextIntlClientProvider`
 * (client). KST is canonical for this Korea-centric TOPIK app.
 */
export const DEFAULT_TIME_ZONE = "Asia/Seoul";

/** Cookie name read by the locale resolver as the anonymous / just-saved fallback. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** One year, in seconds — matches the theme-appearance cookie lifetime. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Narrows an arbitrary string to a supported `Locale`, or `null` if unsupported. */
export function asLocale(value: string | null | undefined): Locale | null {
  return value != null && (LOCALES as readonly string[]).includes(value)
    ? (value as Locale)
    : null;
}
