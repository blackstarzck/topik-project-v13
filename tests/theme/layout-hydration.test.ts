/**
 * Tests that layout.tsx correctly threads the cookie appearance through
 * BOTH <html style> (SSR vars) AND <AppProviders initialAppearance> (client seed).
 * It also keeps the next-intl provider in the server layout tree, where server
 * rendered client components can see the translation context during SSR.
 *
 * RootLayout is a React Server Component — an async function returning JSX.
 * We test it by calling it directly and inspecting the returned element tree.
 * This proves there is no hydration mismatch: the same appearance drives both paths.
 */
import { describe, expect, test, vi, beforeEach } from "vitest";
import React from "react";

import { collectUiSources } from "../../scripts/check-ui-contract.mjs";
import { scanUiContract } from "../../scripts/lib/ui-contract.mjs";
import { themeSettings } from "../../src/theme/config";
import { getResolvedBridgeVars } from "../../src/theme/tailwind-bridge";
import type { ThemeAppearance } from "../../src/theme/types";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("next/font/local", () => ({
  default: () => ({ className: "mock-font", variable: "mock-font-variable" }),
}));

// Mock @ant-design/nextjs-registry — not relevant to this test
vi.mock("@ant-design/nextjs-registry", () => ({
  AntdRegistry: ({ children }: { children: React.ReactNode }) => children,
}));

// i18n (G-01): the root layout resolves a locale and loads its message
// catalog. Mock both so this test stays a focused appearance/locale-threading
// check — locale resolution itself is covered by the i18n request-config tests.
const resolveLocaleMock = vi.fn();
vi.mock("../../src/i18n/request", () => ({
  resolveLocale: () => resolveLocaleMock(),
}));
vi.mock("next-intl/server", () => ({
  getMessages: vi.fn(async () => ({})),
}));
vi.mock("next-intl", () => ({
  NextIntlClientProvider: ({
    children,
  }: {
    children: React.ReactNode;
    locale?: string;
    messages?: Record<string, unknown>;
    timeZone?: string;
  }) => children,
}));

// Mock providers to capture initialAppearance without rendering.
vi.mock("../../src/app/providers", () => ({
  AppProviders: ({
    initialAppearance,
    children,
  }: {
    initialAppearance?: string;
    children: React.ReactNode;
  }) =>
    React.createElement(
      "div",
      { "data-initial-appearance": initialAppearance },
      children,
    ),
}));

import { cookies } from "next/headers";
import RootLayout, { metadata } from "../../src/app/layout";

type AnyElement = React.ReactElement<Record<string, unknown>>;

describe("RootLayout hydration consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: locale resolves to the baseline unless a test overrides it.
    resolveLocaleMock.mockResolvedValue("ko");
  });

  function mockCookie(value: string | undefined) {
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) =>
        name === "theme-appearance" && value != null
          ? { name, value }
          : undefined,
    } as unknown as Awaited<ReturnType<typeof cookies>>);
  }

  async function getLayoutAndProviderProps(cookieValue: string | undefined) {
    mockCookie(cookieValue);
    const element = (await RootLayout({
      children: React.createElement("span"),
    })) as AnyElement;

    // Structure:
    // <html lang style>
    //   <body>
    //     <NextIntlClientProvider>
    //       <AntdRegistry>
    //         <AppProviders />
    //       </AntdRegistry>
    //     </NextIntlClientProvider>
    //   </body>
    // </html>
    const htmlStyle = element.props.style as Record<string, string>;
    const colorScheme = htmlStyle.colorScheme as ThemeAppearance;
    const lang = element.props.lang as string;
    const translate = element.props.translate as string | undefined;

    // Navigate: <html> → <body> → <NextIntlClientProvider> →
    // <AntdRegistry> → <AppProviders>
    // Components are NOT rendered when calling RootLayout directly, so each
    // child remains a JSX element. We read props.initialAppearance / locale
    // straight off the JSX elements (mocks only matter on render).
    const body = element.props.children as AnyElement;
    const bodyChildren = React.Children.toArray(
      body.props.children as React.ReactNode,
    ) as AnyElement[];
    const intlProviderEl = bodyChildren[0];
    const intlLocale = intlProviderEl.props.locale as string;
    const intlTimeZone = intlProviderEl.props.timeZone as string;
    const intlMessages = intlProviderEl.props.messages as Record<
      string,
      unknown
    >;
    const antdRegistryEl = intlProviderEl.props.children as AnyElement;
    const appProvidersEl = antdRegistryEl.props.children as AnyElement;
    const initialAppearance = appProvidersEl.props.initialAppearance as string;

    return {
      htmlStyle,
      colorScheme,
      initialAppearance,
      lang,
      translate,
      intlLocale,
      intlMessages,
      intlTimeZone,
    };
  }

  test("dark cookie is ignored while DESIGN/Awesomic is light-fixed", async () => {
    const { htmlStyle, colorScheme, initialAppearance } =
      await getLayoutAndProviderProps("dark");

    expect(colorScheme).toBe("light");
    expect(htmlStyle).toEqual({
      ...getResolvedBridgeVars(themeSettings.main, colorScheme),
      colorScheme,
    });
    expect(initialAppearance).toBe(colorScheme);
  });

  test("light cookie → html colorScheme=light AND AppProviders initialAppearance=light", async () => {
    const { htmlStyle, colorScheme, initialAppearance } =
      await getLayoutAndProviderProps("light");

    expect(colorScheme).toBe("light");
    expect(htmlStyle).toEqual({
      ...getResolvedBridgeVars(themeSettings.main, colorScheme),
      colorScheme,
    });
    expect(initialAppearance).toBe(colorScheme);
  });

  test("no cookie → defaults to light for both html and AppProviders", async () => {
    const { htmlStyle, colorScheme, initialAppearance } =
      await getLayoutAndProviderProps(undefined);

    expect(colorScheme).toBe("light");
    expect(htmlStyle).toEqual({
      ...getResolvedBridgeVars(themeSettings.main, colorScheme),
      colorScheme,
    });
    expect(initialAppearance).toBe(colorScheme);
  });

  test("keeps the approved SSR theme bridge inline style at its exact scanner fingerprint", async () => {
    const sources = await collectUiSources(process.cwd());
    const inlineStyles = scanUiContract(sources).violations.filter(
      ({ path, ruleId }) =>
        path === "src/app/layout.tsx" &&
        ruleId === "react.static-inline-style",
    );

    expect(
      inlineStyles.map(({ path, ruleId, fingerprint }) => ({
        path,
        ruleId,
        fingerprint,
      })),
    ).toEqual([
      {
        path: "src/app/layout.tsx",
        ruleId: "react.static-inline-style",
        fingerprint:
          "81b7d6f9316068a3dbab42f493957a376492121c916758edde08c55c5fe98edd",
      },
    ]);
  });

  // i18n (G-01): the resolved locale must drive BOTH <html lang> and the
  // root client provider's locale prop, so SSR and hydration agree on the
  // language.
  test("resolved locale → html lang AND NextIntlClientProvider locale match", async () => {
    resolveLocaleMock.mockResolvedValue("en");
    const { lang, intlLocale } = await getLayoutAndProviderProps(undefined);

    expect(lang).toBe("en");
    expect(intlLocale).toBe("en");
  });

  test("baseline locale → html lang=ko", async () => {
    resolveLocaleMock.mockResolvedValue("ko");
    const { lang, intlLocale } = await getLayoutAndProviderProps(undefined);

    expect(lang).toBe("ko");
    expect(intlLocale).toBe("ko");
  });

  test.each(["ko", "en", "vi"] as const)(
    "resolved locale %s keeps html, provider, and browser-translation control aligned",
    async (locale) => {
      resolveLocaleMock.mockResolvedValue(locale);
      const { lang, translate, intlLocale } =
        await getLayoutAndProviderProps(undefined);

      expect(lang).toBe(locale);
      expect(intlLocale).toBe(locale);
      expect(translate).toBe("no");
    },
  );

  test("metadata disables Chromium page translation", () => {
    expect(metadata.other).toEqual(
      expect.objectContaining({ google: "notranslate" }),
    );
  });

  test("NextIntlClientProvider receives messages and the canonical time zone", async () => {
    const { intlMessages, intlTimeZone } =
      await getLayoutAndProviderProps(undefined);

    expect(intlMessages).toEqual({});
    expect(intlTimeZone).toBe("Asia/Seoul");
  });
});
