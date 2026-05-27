import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { AntdRegistry } from "@ant-design/nextjs-registry";

import { AppProviders } from "./providers";
// antd v6.x 호환성: @/theme barrel은 create-theme → "use client" algorithms.ts를
// transitively pull한다. server layout은 server-safe 모듈만 직접 import.
import { getResolvedBridgeVarsByAppearance } from "@/theme/tailwind-bridge";
import type { ThemeAppearance } from "@/theme/types";
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
  // antd v6.x 호환성: theme namespace는 client-only ("use client" + transitive
  // createContext)이므로 server layout에서 import 자체 금지. SSR cssVars는 appearance
  // 기반 hardcoded fallback만 사용. 동적 token은 client AppProviders → ThemeProvider →
  // ConfigProvider hierarchy에서 처리 (현재 brand override 없음).
  const cssVars = getResolvedBridgeVarsByAppearance(appearance);

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
