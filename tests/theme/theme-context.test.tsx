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
