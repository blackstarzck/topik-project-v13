import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  asLocale,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALES,
} from "../../../src/i18n/locales";

const getCurrentProfileMock = vi.fn();
vi.mock("../../../src/lib/auth/profile", () => ({
  getCurrentProfile: () => getCurrentProfileMock(),
}));

const cookieGetMock = vi.fn();
const headerGetMock = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => cookieGetMock(name) }),
  headers: async () => ({ get: (name: string) => headerGetMock(name) }),
}));

import { resolveLocale } from "../../../src/i18n/request";

describe("locales config", () => {
  it("exposes the three supported locales with ko as baseline", () => {
    expect([...LOCALES]).toEqual(["ko", "en", "vi"]);
    expect(DEFAULT_LOCALE).toBe("ko");
    expect(LOCALE_COOKIE).toBe("NEXT_LOCALE");
  });

  it("asLocale narrows supported values and rejects everything else", () => {
    expect(asLocale("ko")).toBe("ko");
    expect(asLocale("en")).toBe("en");
    expect(asLocale("vi")).toBe("vi");
    expect(asLocale("de")).toBeNull();
    expect(asLocale("")).toBeNull();
    expect(asLocale(null)).toBeNull();
    expect(asLocale(undefined)).toBeNull();
  });
});

describe("resolveLocale resolution order", () => {
  beforeEach(() => {
    getCurrentProfileMock.mockReset();
    cookieGetMock.mockReset();
    cookieGetMock.mockReturnValue(undefined);
    headerGetMock.mockReset();
    headerGetMock.mockReturnValue(null);
  });

  afterEach(() => vi.clearAllMocks());

  it("prefers a non-default authenticated user's profiles.ui_locale", async () => {
    getCurrentProfileMock.mockResolvedValue({
      ui_locale: "en",
      ui_locale_source: "manual",
    });
    cookieGetMock.mockReturnValue({ value: "vi" });
    headerGetMock.mockReturnValue("ko-KR,ko;q=0.9");

    expect(await resolveLocale()).toBe("en");
  });

  it("treats a default-source profile as unresolved and uses the locale cookie", async () => {
    getCurrentProfileMock.mockResolvedValue({
      ui_locale: "ko",
      ui_locale_source: "default",
    });
    cookieGetMock.mockReturnValue({ value: "en" });
    headerGetMock.mockReturnValue("vi-VN,vi;q=0.9");

    expect(await resolveLocale()).toBe("en");
  });

  it("treats a default-source profile as unresolved and uses Accept-Language", async () => {
    getCurrentProfileMock.mockResolvedValue({
      ui_locale: "ko",
      ui_locale_source: "default",
    });
    headerGetMock.mockReturnValue("vi-VN,vi;q=0.9,en-US;q=0.7");

    expect(await resolveLocale()).toBe("vi");
  });

  it("does not let request hints override auto or legacy profile locales", async () => {
    cookieGetMock.mockReturnValue({ value: "en" });
    headerGetMock.mockReturnValue("vi-VN,vi;q=0.9");

    getCurrentProfileMock.mockResolvedValueOnce({
      ui_locale: "ko",
      ui_locale_source: "auto",
    });
    await expect(resolveLocale()).resolves.toBe("ko");

    getCurrentProfileMock.mockResolvedValueOnce({
      ui_locale: "ko",
      ui_locale_source: "legacy",
    });
    await expect(resolveLocale()).resolves.toBe("ko");
  });

  it("falls back to the NEXT_LOCALE cookie when there is no profile", async () => {
    getCurrentProfileMock.mockResolvedValue(null);
    cookieGetMock.mockReturnValue({ value: "vi" });
    expect(await resolveLocale()).toBe("vi");
  });

  it("falls back to the cookie when the profile lookup throws", async () => {
    getCurrentProfileMock.mockRejectedValue(new Error("no session"));
    cookieGetMock.mockReturnValue({ value: "en" });
    expect(await resolveLocale()).toBe("en");
  });

  it("falls back to Accept-Language when there is no profile or cookie", async () => {
    getCurrentProfileMock.mockResolvedValue(null);
    headerGetMock.mockReturnValue("en-US,en;q=0.9");
    expect(await resolveLocale()).toBe("en");
  });

  it("falls back to the ko baseline when nothing resolves", async () => {
    getCurrentProfileMock.mockResolvedValue(null);
    expect(await resolveLocale()).toBe("ko");
  });

  it("ignores an unsupported cookie value and uses the baseline", async () => {
    getCurrentProfileMock.mockResolvedValue(null);
    cookieGetMock.mockReturnValue({ value: "de" });
    expect(await resolveLocale()).toBe("ko");
  });
});
