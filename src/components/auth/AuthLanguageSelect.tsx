"use client";

import { Select } from "antd";
import { Globe2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  asLocale,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  type Locale,
} from "@/i18n/locales";

const LANGUAGE_OPTIONS: Array<{ value: Locale; label: string }> = [
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
  { value: "vi", label: "Tiếng Việt" },
];

export function AuthLanguageSelect() {
  const t = useTranslations("auth.languageSelect");
  const router = useRouter();
  const activeLocale = asLocale(useLocale()) ?? DEFAULT_LOCALE;
  const [isPending, startTransition] = useTransition();

  function handleChange(nextLocale: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${nextLocale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="auth-language-select" data-testid="auth-language-select">
      <Globe2
        className="auth-language-select__icon"
        size={16}
        aria-hidden="true"
      />
      <Select<Locale>
        aria-label={t("ariaLabel")}
        className="auth-language-select__control"
        data-testid="auth-language-select-control"
        disabled={isPending}
        options={LANGUAGE_OPTIONS}
        size="small"
        value={activeLocale}
        onChange={handleChange}
      />
    </div>
  );
}
