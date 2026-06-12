import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import localFont from "next/font/local";
import { getMessages } from "next-intl/server";
import { AntdRegistry } from "@ant-design/nextjs-registry";

import { resolveLocale } from "@/i18n/request";
import { AppProviders } from "./providers";
// antd v6.x 호환성: @/theme barrel은 create-theme → "use client" algorithms.ts를
// transitively pull한다. server layout은 server-safe 모듈만 직접 import.
import { themeSettings } from "@/theme/config";
import { getResolvedBridgeVars } from "@/theme/tailwind-bridge";
import type { ThemeAppearance } from "@/theme/types";
import "../styles/global.css";
import "../styles/workspace-layout.css";

const pretendard = localFont({
  src: "../../fonts/pretendard/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

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
  if (!themeSettings.allowAppearanceSwitching) {
    return themeSettings.appearance;
  }

  const cookieStore = await cookies();
  const raw = cookieStore.get("theme-appearance")?.value;
  return raw === "dark" ? "dark" : "light";
}

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const appearance = await resolveInitialAppearance();
  // i18n (G-01): resolve the active locale (profiles.ui_locale → NEXT_LOCALE
  // cookie → 'ko') and load its message catalog. Both <html lang> and the
  // client provider read the SAME resolved locale so SSR and hydration agree.
  // getMessages() reads the same getRequestConfig as the rest of next-intl.
  const locale = await resolveLocale();
  const messages = await getMessages();
  // antd v6.x 호환성: theme namespace는 client-only ("use client" + transitive
  // createContext)이므로 server layout에서 import 자체 금지. SSR cssVars는 appearance
  // 기반 hardcoded fallback만 사용. 동적 token은 client AppProviders → ThemeProvider →
  // ConfigProvider hierarchy에서 처리 (현재 brand override 없음).
  const cssVars = getResolvedBridgeVars(themeSettings.main, appearance);

  return (
    <html
      lang={locale}
      className={pretendard.variable}
      style={{ ...cssVars, colorScheme: appearance } as React.CSSProperties}
    >
      {/*
       * suppressHydrationWarning (body 1-level 한정): Demoway 같은 브라우저 확장은
       * SSR HTML을 받은 뒤 hydration 직전에 <body>에 data-* 속성
       * (예: data-demoway-document-id)을 주입한다. 우리 코드 밖의 변형이므로
       * React가 body "자체"의 속성 차이만 무시하게 한다. 자식 트리에는 전파되지
       * 않아 실제 마크업 mismatch는 그대로 검출된다.
       */}
      <body suppressHydrationWarning>
        {/*
         * AntdRegistry prevents first-screen AntD component style flash.
         * It extracts and injects AntD styles during SSR streaming.
         * See: https://ant.design/docs/react/use-with-next
         */}
        <AntdRegistry>
          <AppProviders
            initialAppearance={appearance}
            locale={locale}
            messages={messages}
          >
            {children}
          </AppProviders>
        </AntdRegistry>
      </body>
    </html>
  );
}
