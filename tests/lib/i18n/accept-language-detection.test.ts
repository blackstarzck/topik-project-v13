import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  localeFromAcceptLanguage,
  localeFromRequestHints,
} from "../../../src/i18n/detection";

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

describe("Accept-Language locale detection", () => {
  it("uses the highest priority supported language", () => {
    expect(
      localeFromAcceptLanguage("fr-CA,vi-VN;q=0.9,en-US;q=0.8,ko;q=0.7"),
    ).toBe("vi");
  });

  it("matches supported base languages from region tags", () => {
    expect(localeFromAcceptLanguage("en-US,en;q=0.9")).toBe("en");
    expect(localeFromAcceptLanguage("vi-VN,vi;q=0.9")).toBe("vi");
  });

  it("ignores unsupported, wildcard, malformed, and q=0 values", () => {
    expect(localeFromAcceptLanguage("de-DE,*;q=0.5,en;q=0")).toBeNull();
    expect(localeFromAcceptLanguage("fr;q=oops,ko;q=0")).toBeNull();
    expect(localeFromAcceptLanguage("vi;q=9,en;q=0")).toBeNull();
    expect(localeFromAcceptLanguage(null)).toBeNull();
  });

  it("marks cookie hints as manual and header hints as auto", () => {
    expect(
      localeFromRequestHints({
        cookieLocale: "en",
        acceptLanguage: "vi-VN,vi;q=0.9",
      }),
    ).toEqual({ locale: "en", source: "manual" });
    expect(
      localeFromRequestHints({
        cookieLocale: undefined,
        acceptLanguage: "vi-VN,vi;q=0.9",
      }),
    ).toEqual({ locale: "vi", source: "auto" });
  });
});

describe("resolveLocale Accept-Language fallback", () => {
  beforeEach(() => {
    getCurrentProfileMock.mockReset();
    cookieGetMock.mockReset();
    headerGetMock.mockReset();
    cookieGetMock.mockReturnValue(undefined);
    headerGetMock.mockReturnValue(null);
  });

  afterEach(() => vi.clearAllMocks());

  it("falls back to Accept-Language when there is no profile or locale cookie", async () => {
    getCurrentProfileMock.mockResolvedValue(null);
    headerGetMock.mockReturnValue("vi-VN,vi;q=0.9,en-US;q=0.7");

    expect(await resolveLocale()).toBe("vi");
  });

  it("keeps the cookie above Accept-Language", async () => {
    getCurrentProfileMock.mockResolvedValue(null);
    cookieGetMock.mockReturnValue({ value: "en" });
    headerGetMock.mockReturnValue("vi-VN,vi;q=0.9");

    expect(await resolveLocale()).toBe("en");
  });

  it("falls back to Accept-Language when profile lookup throws and no cookie resolves", async () => {
    getCurrentProfileMock.mockRejectedValue(new Error("no session"));
    headerGetMock.mockReturnValue("en-US,en;q=0.9");

    expect(await resolveLocale()).toBe("en");
  });
});
