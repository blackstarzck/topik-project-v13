"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentProps, ReactNode } from "react";
import { App as AntdApp, ConfigProvider } from "antd";
import { useState } from "react";

import { SystemReportLauncher } from "@/components/shared/SystemReportLauncher";
import { ThemeProvider, useTheme } from "@/contexts/theme-context";
import type { ThemeAppearance } from "@/theme";

// ---------------------------------------------------------------------------
// Inner component: reads from ThemeContext, passes antd config to ConfigProvider.
// Must be a child of ThemeProvider so useTheme() is available.
// ---------------------------------------------------------------------------

const appNotificationConfig = {
  placement: "topRight",
  top: 88,
  duration: 3,
  maxCount: 3,
  showProgress: true,
} satisfies ComponentProps<typeof AntdApp>["notification"];

const appNotificationSurfaceConfig = {
  className: "app-global-notification",
} satisfies ComponentProps<typeof ConfigProvider>["notification"];

function AntdConfiguredProviders({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <ConfigProvider
      theme={theme.antd}
      notification={appNotificationSurfaceConfig}
    >
      <AntdApp notification={appNotificationConfig}>{children}</AntdApp>
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
        <AntdConfiguredProviders>
          {children}
          <SystemReportLauncher />
        </AntdConfiguredProviders>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
