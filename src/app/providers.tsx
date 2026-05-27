"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { App as AntdApp, ConfigProvider } from "antd";
import { useState } from "react";

import { ThemeProvider, useTheme } from "@/contexts/theme-context";
import type { ThemeAppearance } from "@/theme";

// ---------------------------------------------------------------------------
// Inner component: reads from ThemeContext, passes antd config to ConfigProvider.
// Must be a child of ThemeProvider so useTheme() is available.
// ---------------------------------------------------------------------------

function AntdConfiguredProviders({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <ConfigProvider theme={theme.antd}>
      <AntdApp>{children}</AntdApp>
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
}

export function AppProviders({
  children,
  initialAppearance = "light",
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
    <QueryClientProvider client={queryClient}>
      <ThemeProvider initialAppearance={initialAppearance}>
        <AntdConfiguredProviders>{children}</AntdConfiguredProviders>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
