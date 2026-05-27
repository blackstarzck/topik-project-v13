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

// Mock @ant-design/nextjs-registry — not relevant to this test
vi.mock("@ant-design/nextjs-registry", () => ({
  AntdRegistry: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock providers to capture the initialAppearance prop without rendering
vi.mock("../../src/app/providers", () => ({
  AppProviders: ({ initialAppearance, children }: { initialAppearance?: string; children: React.ReactNode }) =>
    React.createElement("div", { "data-initial-appearance": initialAppearance }, children),
}));

import { cookies } from "next/headers";
import RootLayout from "../../src/app/layout";

type AnyElement = React.ReactElement<Record<string, unknown>>;

describe("RootLayout hydration consistency", () => {
  beforeEach(() => vi.clearAllMocks());

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
    const element = await RootLayout({ children: React.createElement("span") }) as AnyElement;

    // Structure: <html style={...}><body>{...AppProviders mock...}</body></html>
    const htmlStyle = element.props.style as Record<string, string>;
    const colorScheme = htmlStyle.colorScheme as string;
    const bgContainer = htmlStyle["--app-color-bg-container"] as string;

    // Navigate: <html> → <body> → <AntdRegistry> → <AppProviders>
    // Components are NOT rendered when calling RootLayout directly, so each
    // child remains a JSX element. We read props.initialAppearance straight
    // off the AppProviders JSX element (mocks only matter on actual render).
    const body = element.props.children as AnyElement;
    const antdRegistryEl = body.props.children as AnyElement;
    const appProvidersEl = antdRegistryEl.props.children as AnyElement;
    const initialAppearance = appProvidersEl.props.initialAppearance as string;

    return { colorScheme, bgContainer, initialAppearance };
  }

  test("dark cookie → html colorScheme=dark AND AppProviders initialAppearance=dark", async () => {
    const { colorScheme, bgContainer, initialAppearance } =
      await getLayoutAndProviderProps("dark");

    expect(colorScheme).toBe("dark");
    expect(bgContainer).not.toBe("#ffffff"); // dark mode has dark bg
    expect(initialAppearance).toBe("dark");
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
});
