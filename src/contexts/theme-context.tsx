"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import {
  defaultAppearance,
  defaultThemeName,
  getAppTheme,
  getResolvedBridgeVarsByAppearance,
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

  const theme = useMemo(
    () => getAppTheme(themeName, appearance),
    [themeName, appearance],
  );

  /**
   * Writes resolved --app-* CSS variables to <html> at runtime.
   * Called on mount and on every appearance change.
   */
  const applyVarsToDocument = useCallback(
    (nextAppearance: ThemeAppearance) => {
      // antd v6.x 호환성: server-safe fallback. 동적 brand override가 생기면
      // client 측 theme.useToken() hook 결과로 추가 update 필요.
      const vars = getResolvedBridgeVarsByAppearance(nextAppearance);
      const el = document.documentElement;
      Object.entries(vars).forEach(([key, value]) => {
        el.style.setProperty(key, value);
      });
      el.style.setProperty("color-scheme", nextAppearance);
    },
    [],
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

  const value = useMemo(
    () => ({ theme, appearance, setAppearance }),
    [theme, appearance, setAppearance],
  );

  return (
    <ThemeContext.Provider value={value}>
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
