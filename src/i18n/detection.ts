import { asLocale, type Locale } from "./locales";

export type UiLocaleSource = "legacy" | "default" | "auto" | "manual";
export type RequestLocaleSource = Extract<UiLocaleSource, "auto" | "manual">;

type ParsedLanguage = {
  tag: string;
  q: number;
  index: number;
};

function localeFromLanguageTag(tag: string): Locale | null {
  const normalized = tag.trim().toLowerCase();
  if (!normalized || normalized === "*") return null;

  const exact = asLocale(normalized);
  if (exact) return exact;

  const base = normalized.split("-")[0];
  return asLocale(base);
}

export function localeFromAcceptLanguage(
  header: string | null | undefined,
): Locale | null {
  if (!header) return null;

  return (
    header
      .split(",")
      .map((part, index): ParsedLanguage | null => {
        const [rawTag, ...params] = part
          .trim()
          .split(";")
          .map((value) => value.trim());
        if (!rawTag) return null;

        let q = 1;
        for (const param of params) {
          const [rawKey, rawValue] = param
            .split("=")
            .map((value) => value.trim());
          if (rawKey?.toLowerCase() !== "q") continue;
          const parsed = Number(rawValue);
          if (!Number.isFinite(parsed)) return null;
          q = parsed;
        }

        if (q <= 0 || q > 1) return null;
        return { tag: rawTag, q, index };
      })
      .filter((item): item is ParsedLanguage => item !== null)
      .sort((left, right) => right.q - left.q || left.index - right.index)
      .map(({ tag }) => localeFromLanguageTag(tag))
      .find((locale): locale is Locale => locale !== null) ?? null
  );
}

export function localeFromRequestHints({
  cookieLocale,
  acceptLanguage,
}: {
  cookieLocale?: string | null;
  acceptLanguage?: string | null;
}): { locale: Locale | null; source: RequestLocaleSource | null } {
  const fromCookie = asLocale(cookieLocale);
  if (fromCookie) {
    return { locale: fromCookie, source: "manual" };
  }

  const fromHeader = localeFromAcceptLanguage(acceptLanguage);
  if (fromHeader) {
    return { locale: fromHeader, source: "auto" };
  }

  return { locale: null, source: null };
}
