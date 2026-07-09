import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { AntdRegistry } from "@ant-design/nextjs-registry";

import { GoogleAnalyticsTags } from "@/components/analytics/GoogleAnalyticsTags";
import { DEFAULT_TIME_ZONE } from "@/i18n/locales";
import { resolveLocale } from "@/i18n/request";
import { AppProviders } from "./providers";
// antd v6.x compatibility: avoid importing the client theme barrel here.
import { themeSettings } from "@/theme/config";
import { resolveInitialAppearance } from "@/theme/resolve-initial-appearance";
import { getResolvedBridgeVars } from "@/theme/tailwind-bridge";
import "../styles/global.css";
import "../styles/workspace-layout.css";

const pretendard = localFont({
  src: "../../fonts/pretendard/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://127.0.0.1:3000";
const siteDescription =
  "TOPIK learning workspace for practice, writing, and feedback.";
const socialPreviewImage = {
  url: "/assets/thumnail.png",
  width: 1672,
  height: 941,
  alt: "DOTORE TOPIK",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "DOTORE TOPIK",
    template: "%s | DOTORE TOPIK",
  },
  description: siteDescription,
  openGraph: {
    title: "DOTORE TOPIK",
    description: siteDescription,
    siteName: "DOTORE TOPIK",
    type: "website",
    images: [socialPreviewImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "DOTORE TOPIK",
    description: siteDescription,
    images: [
      {
        url: socialPreviewImage.url,
        alt: socialPreviewImage.alt,
      },
    ],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const appearance = await resolveInitialAppearance();
  // i18n (G-01): resolve the active locale (non-default profile locale →
  // NEXT_LOCALE cookie → Accept-Language → 'ko') and load its message catalog.
  // Both <html lang> and the client provider read the SAME resolved locale so
  // SSR and hydration agree.
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
        <NextIntlClientProvider
          locale={locale}
          messages={messages}
          timeZone={DEFAULT_TIME_ZONE}
        >
          <AntdRegistry>
            <AppProviders initialAppearance={appearance}>
              {children}
            </AppProviders>
          </AntdRegistry>
        </NextIntlClientProvider>
        <GoogleAnalyticsTags />
      </body>
    </html>
  );
}
