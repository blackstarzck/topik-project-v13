// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { App as AntdApp } from "antd";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";

import enMessages from "../../../messages/en.json";
import viMessages from "../../../messages/vi.json";
import koMessages from "../../../messages/ko.json";
import { AppError } from "../../../src/components/shared/AppError";
import { AppNotFound } from "../../../src/components/shared/AppNotFound";

/**
 * Locale-render smoke test (verification phase).
 *
 * The catalog-parity test proves ko/en/vi share the same KEY set with no empties.
 * This proves the next step: that next-intl actually RESOLVES and RENDERS the en
 * and vi catalogs (not the ko baseline) when the active locale changes — i.e. the
 * user-facing UI really does switch language. It is NOT a substitute for the
 * live-browser locale-switch check (router.refresh + <html lang> + hydration),
 * which still needs a running server; it is the closest unit-level proof.
 */
const CATALOGS = { ko: koMessages, en: enMessages, vi: viMessages } as const;

function renderAt(locale: keyof typeof CATALOGS, ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale={locale} messages={CATALOGS[locale]}>
      <AntdApp>{ui}</AntdApp>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  if (!(globalThis as Record<string, unknown>).ResizeObserver) {
    (globalThis as Record<string, unknown>).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (q: string) => ({
        matches: false,
        media: q,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  }
});

afterEach(cleanup);

describe("i18n locale rendering (en/vi actually resolve)", () => {
  it("renders AppError in English and NOT the ko baseline", () => {
    renderAt("en", <AppError />);
    expect(screen.getByText("Something went wrong")).toBeTruthy();
    expect(
      screen.getByText(
        "The service is temporarily unavailable. Please try again shortly.",
      ),
    ).toBeTruthy();
    // proves it switched away from the ko baseline, not a fallback
    expect(screen.queryByText("문제가 발생했어요")).toBeNull();
  });

  it("renders AppError in Vietnamese", () => {
    renderAt("vi", <AppError />);
    expect(screen.getByText("Đã xảy ra sự cố")).toBeTruthy();
    expect(
      screen.getByText(
        "Dịch vụ tạm thời không ổn định. Vui lòng thử lại sau ít phút.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("문제가 발생했어요")).toBeNull();
  });

  it("renders AppNotFound in English and Vietnamese", () => {
    renderAt("en", <AppNotFound />);
    expect(screen.getByText("Page not found")).toBeTruthy();
    expect(
      screen.getByText("The requested page does not exist or has been moved."),
    ).toBeTruthy();
    cleanup();
    renderAt("vi", <AppNotFound />);
    expect(screen.getByText("Không tìm thấy trang")).toBeTruthy();
  });

  it("still renders the ko baseline correctly (control)", () => {
    renderAt("ko", <AppError />);
    expect(screen.getByText("문제가 발생했어요")).toBeTruthy();
  });
});
