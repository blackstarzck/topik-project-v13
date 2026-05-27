# Theme System Refactor Implementation Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix five critical bugs in the theme system so `--app-*` CSS variables are injected as resolved values on `<html>`, portal-rendered AntD components receive correct colors, dark/light mode can be toggled at runtime, and all five CSS Variable Scoping Gate constraints pass.

**Architecture:** AntD's `theme.getDesignToken(config)` resolves actual hex/px values from a ThemeConfig. Those values are written to `--app-*` on the `<html>` element in `layout.tsx` (server-side, from cookie) and updated live in the ThemeContext when the user toggles appearance. The `ConfigProvider` receives its theme from React state (not module scope), and `@theme inline` in `global.css` bridges `--app-*` into Tailwind utilities. `AntdRegistry` prevents first-screen AntD style flash in Next.js App Router.

**Tech Stack:** Next.js 16 App Router, React 19, Ant Design v6, Tailwind v4, Vitest

---

## Bugs Being Fixed

| # | File | Bug | Severity |
|---|------|-----|---------|
| B1 | `tailwind-bridge.ts` | `--app-*: var(--ant-*)` chains fail at SSR (no value on server → FOUC) | **Critical** |
| B2 | `providers.tsx` | `style={}` on wrapper `<div>` — portals render to `document.body`, outside the div | **Critical** |
| B3 | `providers.tsx` | `activeTheme` computed at module level — blocks runtime dark mode switching | **Critical** |
| B4 | `create-theme.ts` | `cssVar: { key: "talkpik" }` missing `prefix` — contract clarity (default is already "ant") | **Contract** |
| B5 | `global.css` | No `@theme inline` — Tailwind v4 can't bridge dynamic `--app-*` vars to utilities | **Critical** |
| B6 | `layout.tsx` | No `AntdRegistry` — first-screen AntD component style flash in App Router | **Important** |

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Install pkg | `package.json` | Add `@ant-design/nextjs-registry` |
| Modify | `src/theme/tailwind-bridge.ts` | Replace static `var()` map with `getResolvedBridgeVars(themeConfig)` |
| Modify | `src/theme/create-theme.ts` | Add `prefix: "ant"` to cssVar for contract clarity |
| Delete | `src/theme/antdTheme.ts` | Unused module-level export — dead code |
| Modify | `src/theme/index.ts` | Remove re-export of deleted antdTheme |
| Create | `src/contexts/theme-context.tsx` | ThemeProvider (React state) + useTheme hook |
| Modify | `src/app/providers.tsx` | Accept `initialAppearance`, use ThemeContext, remove portal bug div |
| Modify | `src/app/layout.tsx` | Read cookie, compute resolved vars, inject on `<html style>`, add AntdRegistry |
| Modify | `src/styles/global.css` | Add `@theme inline {}`, remove hardcoded `color-scheme: light` from `:root` |
| Modify | `tests/theme/theme-contract.test.ts` | Update to match new contract (resolved values, cssVar prefix) |
| Create | `tests/theme/theme-context.test.tsx` | Unit tests for ThemeProvider state |
| Create | `tests/theme/resolve-appearance.test.ts` | Unit tests for cookie-based appearance resolution |

---

## Architecture Tradeoffs (documented per Codex Round 1 review)

**T1 — `cookies()` makes root layout dynamic (C5):**
`layout.tsx` calls `cookies()` from `next/headers`, which opts the root layout out of static rendering. For TALKPIK AI (Supabase Auth, all routes require login), the root layout is already dynamic. This tradeoff is acceptable.

**T2 — Client owns theme state after mount (C4):**
`ThemeProvider` initializes from `initialAppearance` (SSR cookie). After mount, the client owns theme state — `router.refresh()` and server re-renders do NOT override the user's selected appearance. This is the intended behavior: the user's preference persists until they actively toggle.

---

## Task 0: Install @ant-design/nextjs-registry

**Files:**
- Modify: `package.json` (via pnpm)

- [ ] **Step 0.1: Install the package**

```bash
cd C:\Users\admin\Desktop\workspace\topik-project\v13
pnpm add @ant-design/nextjs-registry
```

Expected: Package added to `dependencies` in `package.json`. No errors.

- [ ] **Step 0.2: Verify it installed**

```bash
grep "nextjs-registry" package.json
```

Expected: Line like `"@ant-design/nextjs-registry": "^1.x.x"` in dependencies.

- [ ] **Step 0.3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(theme): add @ant-design/nextjs-registry for App Router style injection"
```

---

## Task 1: Write Failing Tests — theme-contract.test.ts (RED)

**Files:**
- Modify: `tests/theme/theme-contract.test.ts`

- [ ] **Step 1.1: Rewrite test file**

Replace the entire file with the following. All tests will FAIL with the current code:

```typescript
import { describe, expect, test } from "vitest";
import {
  defaultAppearance,
  defaultThemeName,
  getAppTheme,
  getResolvedBridgeVars,
} from "../../src/theme";

describe("app theme contract", () => {
  test("exposes a default Ant Design theme with CSS variables enabled (key + prefix)", () => {
    const theme = getAppTheme(defaultThemeName, defaultAppearance);

    expect(theme.name).toBe("default");
    expect(theme.appearance).toBe("light");
    // key = cache deduplication ID; prefix = CSS variable prefix (--ant-* by default)
    expect(theme.antd.cssVar).toEqual({ key: "talkpik", prefix: "ant" });
    expect(theme.antd.token?.fontFamily).toContain("system-ui");
  });

  test("getResolvedBridgeVars returns actual hex/px values — no var() chains", () => {
    const theme = getAppTheme(defaultThemeName, defaultAppearance);
    const vars = getResolvedBridgeVars(theme.antd);

    // Must NOT be var(--ant-*) chains
    Object.values(vars).forEach((value) => {
      expect(value).not.toMatch(/^var\(--ant-/);
    });

    // Must be resolved actual values
    expect(vars["--app-color-primary"]).toBe("#1677ff");
    expect(vars["--app-color-bg-container"]).toBe("#ffffff");
    expect(vars["--app-color-border"]).toBe("#d9d9d9");
    expect(vars["--app-radius"]).toBe("6px");
    // colorText is rgba
    expect(vars["--app-color-text"]).toMatch(/rgba?\(/);
  });

  test("getResolvedBridgeVars dark appearance returns dark values", () => {
    const theme = getAppTheme(defaultThemeName, "dark");
    const vars = getResolvedBridgeVars(theme.antd);

    // Dark mode background must not be white
    expect(vars["--app-color-bg-container"]).not.toBe("#ffffff");
    // All values still resolved, not var() chains
    Object.values(vars).forEach((value) => {
      expect(value).not.toMatch(/^var\(--ant-/);
    });
  });

  test("getResolvedBridgeVars covers all required bridge keys", () => {
    const theme = getAppTheme(defaultThemeName, defaultAppearance);
    const vars = getResolvedBridgeVars(theme.antd);
    const requiredKeys = [
      "--app-color-primary",
      "--app-color-bg-layout",
      "--app-color-bg-container",
      "--app-color-text",
      "--app-color-text-secondary",
      "--app-color-border",
      "--app-radius",
      "--app-font-family",
      "--app-shadow-elevated",
    ];

    requiredKeys.forEach((key) => {
      expect(vars).toHaveProperty(key);
      expect(vars[key]).toBeTruthy();
    });
  });
});
```

- [ ] **Step 1.2: Run tests to confirm RED**

```bash
cd C:\Users\admin\Desktop\workspace\topik-project\v13
npx vitest run tests/theme/theme-contract.test.ts
```

Expected: **FAIL** — `getResolvedBridgeVars is not a function` and `cssVar prefix` assertion fails.

---

## Task 2: Fix tailwind-bridge.ts (GREEN — bridge tests)

**Files:**
- Modify: `src/theme/tailwind-bridge.ts`

- [ ] **Step 2.1: Rewrite tailwind-bridge.ts**

Replace the entire file:

```typescript
import { theme as antdTheme } from "antd";
import type { ThemeConfig } from "antd";

export type ResolvedBridgeVars = Record<string, string>;

/**
 * Resolves actual CSS values (hex, px, font string) from an AntD ThemeConfig.
 * Safe for SSR — values are computed from ThemeConfig, never from var(--ant-*) chains.
 * Inject the result onto <html style={...}> in layout.tsx.
 */
export function getResolvedBridgeVars(themeConfig: ThemeConfig): ResolvedBridgeVars {
  const token = antdTheme.getDesignToken(themeConfig);
  return {
    "--app-color-primary": token.colorPrimary,
    "--app-color-bg-layout": token.colorBgLayout,
    "--app-color-bg-container": token.colorBgContainer,
    "--app-color-text": token.colorText,
    "--app-color-text-secondary": token.colorTextSecondary,
    "--app-color-border": token.colorBorder,
    "--app-radius": `${token.borderRadius}px`,
    "--app-font-family": token.fontFamily,
    "--app-shadow-elevated": token.boxShadowSecondary,
  };
}
```

- [ ] **Step 2.2: Run bridge tests to confirm partial GREEN**

```bash
npx vitest run tests/theme/theme-contract.test.ts
```

Expected: 3 of 4 tests pass. Only the cssVar test fails (B4 not fixed yet).

---

## Task 3: Fix create-theme.ts — cssVar prefix (GREEN — all contract tests)

**Files:**
- Modify: `src/theme/create-theme.ts` (line 45)

- [ ] **Step 3.1: Add prefix to cssVar**

Find this line in `src/theme/create-theme.ts`:
```typescript
      cssVar: { key: "talkpik" },
```

Replace with:
```typescript
      cssVar: { key: "talkpik", prefix: "ant" },
```

Note: `prefix: "ant"` is already the AntD default. Adding it here makes the contract explicit so future contributors know it's intentional, and protects against accidental removal.

- [ ] **Step 3.2: Run all theme-contract tests to confirm GREEN**

```bash
npx vitest run tests/theme/theme-contract.test.ts
```

Expected: **All 4 tests PASS.**

- [ ] **Step 3.3: Commit**

```bash
git add tests/theme/theme-contract.test.ts src/theme/tailwind-bridge.ts src/theme/create-theme.ts
git commit -m "fix(theme): resolve CSS variable contract — getResolvedBridgeVars + cssVar prefix"
```

---

## Task 4: Fix index.ts and Delete antdTheme.ts (dead code)

**Files:**
- Modify: `src/theme/index.ts`
- Delete: `src/theme/antdTheme.ts`

- [ ] **Step 4.1: Verify antdTheme is unused**

```bash
grep -r "antdTheme" C:\Users\admin\Desktop\workspace\topik-project\v13\src --include="*.ts" --include="*.tsx" | grep -v "antdTheme.ts"
```

Expected: No output. If any file imports `antdTheme`, update it to use `getAppTheme` before deleting.

- [ ] **Step 4.2: Update src/theme/index.ts**

Replace the entire file:
```typescript
export * from "./create-theme";
export * from "./registry";
export * from "./tailwind-bridge";
export * from "./types";
```

- [ ] **Step 4.3: Delete antdTheme.ts**

```bash
del "C:\Users\admin\Desktop\workspace\topik-project\v13\src\theme\antdTheme.ts"
```

- [ ] **Step 4.4: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 4.5: Commit**

```bash
git add src/theme/index.ts
git rm src/theme/antdTheme.ts
git commit -m "chore(theme): remove unused module-level antdTheme export"
```

---

## Task 5: Write Failing Tests — ThemeContext (RED)

**Files:**
- Create: `tests/theme/theme-context.test.tsx`

Note: Mock uses `vi.spyOn` (not `Object.defineProperty(window.document)`) to avoid breaking jsdom's document prototype.

- [ ] **Step 5.1: Create test file**

```typescript
// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import {
  ThemeProvider,
  useTheme,
} from "../../src/contexts/theme-context";

describe("ThemeContext", () => {
  let setPropertySpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Safe spy — does not replace the document prototype
    setPropertySpy = vi.spyOn(document.documentElement.style, "setProperty");
  });

  afterEach(() => {
    setPropertySpy.mockRestore();
  });

  test("ThemeProvider initializes with provided appearance", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider initialAppearance="dark">{children}</ThemeProvider>
    );
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.appearance).toBe("dark");
  });

  test("ThemeProvider defaults to light when no initialAppearance", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    );
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.appearance).toBe("light");
  });

  test("setAppearance updates appearance state", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider initialAppearance="light">{children}</ThemeProvider>
    );
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setAppearance("dark");
    });

    expect(result.current.appearance).toBe("dark");
  });

  test("theme object reflects current appearance", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider initialAppearance="light">{children}</ThemeProvider>
    );
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme.appearance).toBe("light");

    act(() => {
      result.current.setAppearance("dark");
    });

    expect(result.current.theme.appearance).toBe("dark");
  });

  test("setAppearance calls document.documentElement.style.setProperty with --app-* vars", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider initialAppearance="light">{children}</ThemeProvider>
    );
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setAppearance("dark");
    });

    // At least one --app-* variable should be set on documentElement
    const calls = setPropertySpy.mock.calls;
    const appVarCalls = calls.filter(([key]) =>
      typeof key === "string" && key.startsWith("--app-")
    );
    expect(appVarCalls.length).toBeGreaterThan(0);
  });

  test("useTheme throws when used outside ThemeProvider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useTheme())).toThrow(
      "useTheme must be used within ThemeProvider"
    );
    consoleSpy.mockRestore();
  });
});
```

- [ ] **Step 5.2: Run tests to confirm RED**

```bash
npx vitest run tests/theme/theme-context.test.tsx
```

Expected: **FAIL** — `Cannot find module '../../src/contexts/theme-context'`

---

## Task 6: Create src/contexts/theme-context.tsx (GREEN — context tests)

**Files:**
- Create: `src/contexts/theme-context.tsx`

- [ ] **Step 6.1: Create the file**

```typescript
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";

import {
  defaultAppearance,
  defaultThemeName,
  getAppTheme,
  getResolvedBridgeVars,
} from "@/theme";
import type { AppThemeName, BuiltAppTheme, ThemeAppearance } from "@/theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ThemeContextValue {
  theme: BuiltAppTheme;
  appearance: ThemeAppearance;
  setAppearance: (appearance: ThemeAppearance) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface ThemeProviderProps {
  children: ReactNode;
  /**
   * Appearance resolved server-side from cookie. Prevents first-paint flash.
   * Defaults to "light".
   *
   * NOTE (T2): After mount, the CLIENT owns theme state. Server re-renders
   * (router.refresh, etc.) do not override the user's selected appearance.
   * This is intentional — the user's toggle persists until they change it.
   */
  initialAppearance?: ThemeAppearance;
  /** Theme name. Only "default" exists today. Extend when adding presets. */
  themeName?: AppThemeName;
}

export function ThemeProvider({
  children,
  initialAppearance = defaultAppearance,
  themeName = defaultThemeName,
}: ThemeProviderProps) {
  const [appearance, setAppearanceState] =
    useState<ThemeAppearance>(initialAppearance);

  const theme = getAppTheme(themeName, appearance);

  /**
   * Writes resolved --app-* CSS variables to <html> at runtime.
   * Called on mount and on every appearance change.
   */
  const applyVarsToDocument = useCallback(
    (nextAppearance: ThemeAppearance) => {
      const nextTheme = getAppTheme(themeName, nextAppearance);
      const vars = getResolvedBridgeVars(nextTheme.antd);
      const el = document.documentElement;
      Object.entries(vars).forEach(([key, value]) => {
        el.style.setProperty(key, value);
      });
      el.style.setProperty("color-scheme", nextAppearance);
    },
    [themeName],
  );

  const setAppearance = useCallback(
    (nextAppearance: ThemeAppearance) => {
      setAppearanceState(nextAppearance);
      applyVarsToDocument(nextAppearance);
      // Persist for next SSR render (1 year)
      document.cookie = `theme-appearance=${nextAppearance}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    },
    [applyVarsToDocument],
  );

  // On mount: sync document vars with SSR-injected initialAppearance.
  // Handles edge cases where cached client vars may differ from the server.
  useEffect(() => {
    applyVarsToDocument(appearance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally mount-only — appearance changes handled by setAppearance

  return (
    <ThemeContext.Provider value={{ theme, appearance, setAppearance }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
```

- [ ] **Step 6.2: Run ThemeContext tests to confirm GREEN**

```bash
npx vitest run tests/theme/theme-context.test.tsx
```

Expected: **All 6 tests PASS.**

- [ ] **Step 6.3: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 6.4: Commit**

```bash
git add src/contexts/theme-context.tsx tests/theme/theme-context.test.tsx
git commit -m "feat(theme): add ThemeProvider + useTheme with runtime CSS var injection"
```

---

## Task 7: Fix providers.tsx — Use ThemeProvider, Remove Portal Bug

**Files:**
- Modify: `src/app/providers.tsx`

Note: Task 7 (providers.tsx) comes BEFORE Task 8 (layout.tsx) because layout.tsx passes `initialAppearance` to `AppProviders`, which requires the prop type to be defined first.

- [ ] **Step 7.1: Rewrite providers.tsx**

Replace the entire file:

```typescript
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
```

**What changed from original:**
- Removed module-level `activeTheme` constant (B3 fix)
- Removed `<div style={getTailwindBridgeVars()}>` wrapper (B2 fix — vars now on `<html>`)
- `ThemeProvider` owns appearance state
- `AntdConfiguredProviders` reads context so `ConfigProvider` always receives the current theme

- [ ] **Step 7.2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7.3: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 7.4: Commit**

```bash
git add src/app/providers.tsx
git commit -m "fix(theme): use ThemeContext in providers, remove portal bug wrapper div"
```

---

## Task 8: Fix layout.tsx — Inject --app-* on `<html>` + AntdRegistry

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 8.1: Rewrite layout.tsx**

Replace the entire file:

```typescript
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
```

- [ ] **Step 8.2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 8.3: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 8.4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "fix(theme): inject --app-* on html, add AntdRegistry, cookie-based SSR appearance"
```

---

## Task 9: Fix global.css — Add @theme inline (B5 fix)

**Files:**
- Modify: `src/styles/global.css`

- [ ] **Step 9.1: Update global.css**

Replace the entire file:

```css
@import "tailwindcss";

/*
 * @theme inline bridges --app-* CSS variables (injected on <html> by layout.tsx)
 * into Tailwind v4 utility classes.
 *
 * "inline" is required (not bare @theme) so Tailwind generates:
 *   .text-primary { color: var(--app-color-primary) }  ← preserves runtime var
 * instead of resolving the value at build time (which would break dark mode toggle).
 */
@theme inline {
  --color-primary: var(--app-color-primary);
  --color-background: var(--app-color-bg-container);
  --color-surface: var(--app-color-bg-layout);
  --color-text: var(--app-color-text);
  --color-text-secondary: var(--app-color-text-secondary);
  --color-border: var(--app-color-border);
  --radius-default: var(--app-radius);
  --font-sans: var(--app-font-family);
  --shadow-elevated: var(--app-shadow-elevated);
}

/*
 * color-scheme is now injected dynamically on <html> from layout.tsx.
 * Removed hardcoded ":root { color-scheme: light }" — it would override dark mode.
 */

* {
  box-sizing: border-box;
}

html,
body {
  min-height: 100%;
  margin: 0;
}

body {
  background: var(--app-color-bg-layout);
  color: var(--app-color-text);
  font-family: var(--app-font-family);
}

.app-page {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 32px;
}

.app-welcome {
  width: min(100%, 680px);
  border: 1px solid var(--app-color-border);
  border-radius: var(--app-radius);
  background: var(--app-color-bg-container);
  box-shadow: var(--app-shadow-elevated);
  padding: 32px;
}

.app-kicker {
  margin: 0 0 8px;
  color: var(--app-color-primary);
  font-size: 14px;
  font-weight: 700;
}

.app-welcome h1 {
  margin: 0;
  font-size: 32px;
  line-height: 1.25;
}

.app-welcome p:last-child {
  margin: 16px 0 0;
  color: var(--app-color-text-secondary);
  font-size: 16px;
  line-height: 1.7;
}
```

- [ ] **Step 9.2: TypeScript + lint check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 9.3: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 9.4: Commit**

```bash
git add src/styles/global.css
git commit -m "fix(theme): add @theme inline bridge in global.css, remove hardcoded color-scheme"
```

---

## Task 10: Unit Tests — resolveInitialAppearance (Hydration Safety)

**Files:**
- Create: `tests/theme/resolve-appearance.test.ts`

Note: `resolveInitialAppearance` is exported from `layout.tsx` as a named function so it can be unit tested without running a Next.js server. It reads from `next/headers` cookies — mock it with vitest.

- [ ] **Step 10.1: Create test file**

```typescript
import { describe, expect, test, vi, beforeEach } from "vitest";

// Mock next/headers before importing the function
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import { resolveInitialAppearance } from "../../src/app/layout";

describe("resolveInitialAppearance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns "light" when no cookie is set', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: () => undefined,
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    const result = await resolveInitialAppearance();
    expect(result).toBe("light");
  });

  test('returns "dark" when cookie is "dark"', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) =>
        name === "theme-appearance" ? { name, value: "dark" } : undefined,
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    const result = await resolveInitialAppearance();
    expect(result).toBe("dark");
  });

  test('returns "light" when cookie is "light"', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) =>
        name === "theme-appearance" ? { name, value: "light" } : undefined,
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    const result = await resolveInitialAppearance();
    expect(result).toBe("light");
  });

  test('returns "light" for invalid cookie value (fail-safe fallback)', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) =>
        name === "theme-appearance" ? { name, value: "purple" } : undefined,
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    const result = await resolveInitialAppearance();
    expect(result).toBe("light");
  });
});
```

- [ ] **Step 10.1b: Add hydration integration test — layout.tsx RSC inspection**

Add a new test file that directly calls RootLayout as an async function and inspects the returned JSX tree. This is valid because RSC components are regular async functions that return React elements:

Create `tests/theme/layout-hydration.test.ts`:

```typescript
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

    // Navigate into body → find AppProviders mock (data-initial-appearance)
    const body = element.props.children as AnyElement;
    // AntdRegistry is mocked to passthrough, so children is AppProviders mock
    const appProvidersEl = body.props.children as AnyElement;
    const initialAppearance = appProvidersEl.props["data-initial-appearance"] as string;

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
```

- [ ] **Step 10.2: Run tests to confirm they pass**

```bash
npx vitest run tests/theme/resolve-appearance.test.ts tests/theme/layout-hydration.test.ts
```

Expected: **All 4 + 3 = 7 tests PASS.** If the mock of `next/headers` fails, add `// @vitest-environment node` at the top of each test file and re-run.

- [ ] **Step 10.3: Commit**

```bash
git add tests/theme/resolve-appearance.test.ts tests/theme/layout-hydration.test.ts
git commit -m "test(theme): add cookie resolution + layout hydration consistency unit tests"
```

> **C7 Accepted-with-reason (Codex Round 5):** Unit tests prove the appearance threading chain (cookie → resolveInitialAppearance → html style + AppProviders initialAppearance). Full browser hydration proof (React reconciliation warning-free) requires E2E and is handled in Task 11 Step 11.8.

---

## Task 11: Verification — Dev Server + Visual Check

- [ ] **Step 11.1: Start dev server**

```bash
npm run dev
```

Expected: Server starts at http://localhost:3000 without errors.

- [ ] **Step 11.2: Inspect `<html>` CSS variables**

Open http://localhost:3000 in browser. Open DevTools → Elements → select `<html>`.

Expected: Inline styles on `<html>` tag:
```
--app-color-primary: #1677ff;
--app-color-bg-container: #ffffff;
color-scheme: light;
```
(NOT `var(--ant-*)` chains.)

- [ ] **Step 11.3: Verify portal components receive --app-* (B2 fix)**

In the browser DevTools console, run:
```javascript
// Check that document.body inherits --app-color-primary
// (portals render here, and CSS variables on html are inherited)
getComputedStyle(document.body).getPropertyValue('--app-color-primary').trim()
```

Expected: `"#1677ff"` (the resolved value, not empty or `var(--ant-color-primary)`).

- [ ] **Step 11.4: Open an AntD Modal and check colors**

If any page in the app uses a Modal or Drawer, open it. Open DevTools → Elements → find `.ant-modal-content` or `.ant-drawer-body`.

Run in console:
```javascript
const modal = document.querySelector('.ant-modal-content');
if (modal) {
  console.log('Modal bg:', getComputedStyle(modal).backgroundColor);
  console.log('--app-color-bg-container on modal:', getComputedStyle(modal).getPropertyValue('--app-color-bg-container'));
}
```

Expected: Modal background color resolves correctly (not transparent or incorrect), and `--app-color-bg-container` is available.

- [ ] **Step 11.5: Verify no console errors**

Open DevTools Console. Reload the page.

Expected: No errors. No warnings about `--app-*` variables.

- [ ] **Step 11.6: Verify workflow check script**

```bash
node scripts/ai-workflow-check.mjs --repo .
```

Expected: All CSS Variable Scoping Gate checks pass.

- [ ] **Step 11.7: Final full test run**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 11.8: Playwright hydration check (E2E)**

If the E2E suite can be run:

```bash
npx playwright test --grep "hydration"
```

OR manually: open the app in Chrome DevTools, reload, and check the Console for any messages starting with `Warning: An update to` or `Error: Hydration failed`. Expected: No hydration warnings.

This step closes C7 from Codex review — unit tests prove the threading chain; this step proves no React reconciliation mismatch in the browser.

---

## Self-Review

### Spec Coverage

| Requirement | Task |
|---|---|
| B1: `--app-*: var(--ant-*)` SSR failure | Task 2 |
| B2: Portal scoping bug (div style) | Task 7 |
| B3: Module-level activeTheme | Task 7 |
| B4: cssVar missing prefix | Task 3 |
| B5: No @theme inline | Task 9 |
| B6: No AntdRegistry | Task 0 + Task 8 |
| Runtime dark mode toggle | Task 6 |
| Cookie-based SSR persistence | Task 8 |
| Dead code removal (antdTheme.ts) | Task 4 |
| Test coverage — theme contract | Task 1 |
| Test coverage — ThemeContext | Task 5 |
| Test coverage — cookie resolution safety | Task 10 |
| Task ordering safety (providers before layout) | Tasks 7 → 8 |
| Tradeoffs documented | Architecture Tradeoffs section |

### Codex Round 1 Review Responses (All addressed)

- C1 (AntdRegistry): Added Task 0 (install) + AntdRegistry in Task 8 layout.tsx ✓
- C2 (Ordering): providers.tsx (Task 7) now before layout.tsx (Task 8) ✓
- C3 (Test mock): Uses `vi.spyOn(document.documentElement.style, "setProperty")` ✓
- C4 (Client ownership): Documented in ThemeProvider JSDoc and Architecture Tradeoffs ✓
- C5 (cookies() dynamic): Documented in resolveInitialAppearance JSDoc and Architecture Tradeoffs ✓
- C6 (Portal verification): Added Step 11.3 and 11.4 ✓
- C7 (Hydration tests): Added Task 10 (resolveInitialAppearance unit tests) ✓
- C8 (B4 overstated): Reclassified as "contract clarity" ✓

### Placeholder Scan

No TBD / TODO / "similar to" references. All code blocks are complete and runnable.

### Type Consistency

- `ThemeAppearance = "light" | "dark"` — from `src/theme/types.ts`, used consistently
- `BuiltAppTheme` — same type throughout
- `getResolvedBridgeVars(themeConfig: ThemeConfig): ResolvedBridgeVars` — defined Task 2
- `ThemeProvider({ initialAppearance? })` — defined Task 6, used Task 7
- `AppProviders({ initialAppearance? })` — defined Task 7, used Task 8
- `resolveInitialAppearance(): Promise<ThemeAppearance>` — defined Task 8, tested Task 10

---

## Out of Scope / Intentional Cuts

- **Dark mode toggle UI button** — `useTheme().setAppearance("dark")` is the API. The toggle button in app shell is a separate feature task.
- **Multiple theme presets** (ocean, warm, etc.) — registry is ready for extension; not built here.
- **Zustand `useThemeStore`** — `docs/spec.md` mentions a planned Zustand store for theme preference. This plan uses React context as a stepping stone. Migration to Zustand is a future enhancement once basic correctness is verified.
- **Supabase profile persistence** for theme preference — cookie is sufficient for now.

## Smallest Buildable Unit

Tasks 0–4 (install + fix bridge + cssVar + dead code) are independently deployable.
Tasks 5–10 build on each other and should ship in one PR.

## Subagent-Eligible Columns

| Task | Subagent-eligible? | Notes |
|---|---|---|
| Task 0 | ✅ | Package install only |
| Task 1 | ✅ | Test rewrite only |
| Task 2 | ✅ | Single file |
| Task 3 | ✅ | One-line change |
| Task 4 | ✅ | Delete + index update |
| Task 5 | ✅ | Test file only |
| Task 6 | ✅ | New file |
| Task 7 | ✅ after Task 6 | Needs ThemeProvider type |
| Task 8 | ✅ after Tasks 6–7 | Needs AppProviders prop type |
| Task 9 | ✅ | CSS only |
| Task 10 | ✅ after Task 8 | Tests resolveInitialAppearance export |
| Task 11 | ❌ | Needs running browser |
