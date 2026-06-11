"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { App as AntdApp, ConfigProvider } from "antd";
import { LucideProvider } from "lucide-react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { useState } from "react";

import { ThemeProvider, useTheme } from "@/contexts/theme-context";
import { DEFAULT_TIME_ZONE, type Locale } from "@/i18n/locales";
import { iconSettings } from "@/theme/config";
import type { ThemeAppearance } from "@/theme";

// ---------------------------------------------------------------------------
// Inner component: reads from ThemeContext, passes antd config to ConfigProvider.
// Must be a child of ThemeProvider so useTheme() is available.
// ---------------------------------------------------------------------------

function AntdConfiguredProviders({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <ConfigProvider theme={theme.antd}>
      <LucideProvider strokeWidth={iconSettings.lucide.strokeWidth}>
        <AntdApp>{children}</AntdApp>
      </LucideProvider>
    </ConfigProvider>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

interface AppProvidersProps {
  children: ReactNode;
  /**
   * Appearance resolved server-side from cookie.
   * Passed to ThemeProvider as the initial seed — client owns state after mount.
   */
  initialAppearance?: ThemeAppearance;
  /**
   * i18n (G-01): the active locale + its message catalog, both resolved
   * server-side (profiles.ui_locale → NEXT_LOCALE cookie → 'ko'). Wrapping the
   * tree in NextIntlClientProvider here — INSIDE the client AppProviders rather
   * than the root-layout RSC — keeps the layout JSX tree unchanged (the
   * layout-hydration test navigates html→body→AntdRegistry→AppProviders).
   */
  locale?: Locale;
  messages?: AbstractIntlMessages;
}

export function AppProviders({
  children,
  initialAppearance = "light",
  locale = "ko",
  messages,
}: AppProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      }),
  );

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone={DEFAULT_TIME_ZONE}
    >
      <QueryClientProvider client={queryClient}>
        <ThemeProvider initialAppearance={initialAppearance}>
          <AntdConfiguredProviders>{children}</AntdConfiguredProviders>
        </ThemeProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}
