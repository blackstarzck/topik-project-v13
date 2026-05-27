import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { AntdRegistry } from "@ant-design/nextjs-registry";

import { AppProviders } from "./providers";
import {
  defaultThemeName,
  getAppTheme,
  getResolvedBridgeVars,
} from "@/theme";
import type { ThemeAppearance } from "@/theme";
import "../styles/global.css";

export const metadata: Metadata = {
  title: {
    default: "TALKPIK AI",
    template: "%s | TALKPIK AI",
  },
  description: "TOPIK learning workspace for practice, writing, and feedback.",
};

/**
 * Reads appearance from the theme-appearance cookie.
 * Returns "light" for any missing, invalid, or unexpected value.
 *
 * NOTE (T1): Using cookies() makes this layout dynamically rendered (no static
 * caching). For TALKPIK AI — which requires Supabase Auth on all routes — the
 * root layout is already dynamic, so this is an accepted tradeoff.
 */
export async function resolveInitialAppearance(): Promise<ThemeAppearance> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("theme-appearance")?.value;
  return raw === "dark" ? "dark" : "light";
}

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const appearance = await resolveInitialAppearance();
  const theme = getAppTheme(defaultThemeName, appearance);
  const cssVars = getResolvedBridgeVars(theme.antd);

  return (
    <html
      lang="ko"
      style={{ ...cssVars, colorScheme: appearance } as React.CSSProperties}
    >
      <body>
        {/*
         * AntdRegistry prevents first-screen AntD component style flash.
         * It extracts and injects AntD styles during SSR streaming.
         * See: https://ant.design/docs/react/use-with-next
         */}
        <AntdRegistry>
          <AppProviders initialAppearance={appearance}>{children}</AppProviders>
        </AntdRegistry>
      </body>
    </html>
  );
}
