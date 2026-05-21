"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { CSSProperties, ReactNode } from "react";
import { App as AntdApp, ConfigProvider } from "antd";
import { useState } from "react";

import {
  defaultAppearance,
  defaultThemeName,
  getAppTheme,
  getTailwindBridgeVars,
} from "@/theme";

const activeTheme = getAppTheme(defaultThemeName, defaultAppearance);

export function AppProviders({ children }: { children: ReactNode }) {
  // One QueryClient per browser session (React 19 + Next.js 16 client component).
  // staleTime 30s keeps fetches modest; refetchOnWindowFocus surfaces fresh
  // data when users return to the tab. Adjust per-query as needed.
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
      <ConfigProvider theme={activeTheme.antd}>
        <AntdApp>
          <div
            className="app-theme-bridge"
            data-theme={activeTheme.name}
            data-appearance={activeTheme.appearance}
            style={getTailwindBridgeVars() as CSSProperties}
          >
            {children}
          </div>
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
