import { render } from "@testing-library/react";
import { App as AntdApp } from "antd";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";

import koMessages from "../../messages/ko.json";
import {
  DEFAULT_LOCALE,
  DEFAULT_TIME_ZONE,
  type Locale,
} from "../../src/i18n/locales";

/**
 * Shared render helper for i18n-migrated component tests.
 *
 * Any component that calls next-intl's `useTranslations` must render inside a
 * `NextIntlClientProvider`, or it throws "No intl context found". This wraps the
 * baseline (ko) catalog — the SAME Korean strings the assertions match — plus
 * antd's `App` (components use `App.useApp()` for the message API). Mirrors the
 * pattern that `tests/components/settings/LanguageForm.test.tsx` rolled locally,
 * so cluster tests can drop their bespoke wrapper and use this.
 *
 * jsdom note: component tests must declare `// @vitest-environment jsdom`;
 * matchMedia / ResizeObserver are polyfilled in `tests/setup.ts`.
 */
export function renderWithIntl(
  ui: ReactElement,
  { locale = DEFAULT_LOCALE }: { locale?: Locale } = {},
) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={koMessages}
      timeZone={DEFAULT_TIME_ZONE}
    >
      <AntdApp>{ui}</AntdApp>
    </NextIntlClientProvider>,
  );
}

/** Wrapper component form, for cases that need a custom `render` call. */
export function IntlAntdWrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider
      locale={DEFAULT_LOCALE}
      messages={koMessages}
      timeZone={DEFAULT_TIME_ZONE}
    >
      <AntdApp>{children}</AntdApp>
    </NextIntlClientProvider>
  );
}
