/**
 * Tests that layout.tsx correctly threads the cookie appearance through
 * BOTH <html style> (SSR vars) AND <AppProviders initialAppearance> (client seed).
 *
 * RootLayout is a React Server Component — an async function returning JSX.
 * We test it by calling it directly and inspecting the returned element tree.
 * This proves there is no hydration mismatch: the same appearance drives both paths.
 */
import { describe, expect, test, vi, beforeEach } from "vitest";
import React from "react";

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

// Mock providers to capture the initialAppearance + locale props without rendering
vi.mock("../../src/app/providers", () => ({
  AppProviders: ({
    initialAppearance,
    locale,
    children,
  }: {
    initialAppearance?: string;
    locale?: string;
    children: React.ReactNode;
  }) =>
    React.createElement(
      "div",
      { "data-initial-appearance": initialAppearance, "data-locale": locale },
      children,
    ),
}));

import { cookies } from "next/headers";
import RootLayout from "../../src/app/layout";

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

    // Structure: <html lang style={...}><body>{...AppProviders mock...}</body></html>
    const htmlStyle = element.props.style as Record<string, string>;
    const colorScheme = htmlStyle.colorScheme as string;
    const bgContainer = htmlStyle["--app-color-bg-container"] as string;
    const lang = element.props.lang as string;

    // Navigate: <html> → <body> → <AntdRegistry> → <AppProviders>
    // Components are NOT rendered when calling RootLayout directly, so each
    // child remains a JSX element. We read props.initialAppearance / locale
    // straight off the AppProviders JSX element (mocks only matter on render).
    const body = element.props.children as AnyElement;
    const bodyChildren = React.Children.toArray(
      body.props.children as React.ReactNode,
    ) as AnyElement[];
    const antdRegistryEl = bodyChildren[0];
    const appProvidersEl = antdRegistryEl.props.children as AnyElement;
    const initialAppearance = appProvidersEl.props.initialAppearance as string;
    const locale = appProvidersEl.props.locale as string;

    return { colorScheme, bgContainer, initialAppearance, lang, locale };
  }

  test("dark cookie is ignored while DESIGN/Awesomic is light-fixed", async () => {
    const { colorScheme, bgContainer, initialAppearance } =
      await getLayoutAndProviderProps("dark");

    expect(colorScheme).toBe("light");
    expect(bgContainer).toBe("#ffffff");
    expect(initialAppearance).toBe("light");
  });

  test("light cookie → html colorScheme=light AND AppProviders initialAppearance=light", async () => {
    const { colorScheme, bgContainer, initialAppearance } =
      await getLayoutAndProviderProps("light");

    expect(colorScheme).toBe("light");
    expect(bgContainer).toBe("#ffffff");
    expect(initialAppearance).toBe("light");
  });

  test("no cookie → defaults to light for both html and AppProviders", async () => {
    const { colorScheme, bgContainer, initialAppearance } =
      await getLayoutAndProviderProps(undefined);

    expect(colorScheme).toBe("light");
    expect(bgContainer).toBe("#ffffff");
    expect(initialAppearance).toBe("light");
  });

  // i18n (G-01): the resolved locale must drive BOTH <html lang> and the
  // client provider's locale prop, so SSR and hydration agree on the language.
  test("resolved locale → html lang AND AppProviders locale match", async () => {
    resolveLocaleMock.mockResolvedValue("en");
    const { lang, locale } = await getLayoutAndProviderProps(undefined);

    expect(lang).toBe("en");
    expect(locale).toBe("en");
  });

  test("baseline locale → html lang=ko", async () => {
    resolveLocaleMock.mockResolvedValue("ko");
    const { lang, locale } = await getLayoutAndProviderProps(undefined);

    expect(lang).toBe("ko");
    expect(locale).toBe("ko");
  });
});
