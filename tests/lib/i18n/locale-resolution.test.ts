import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  asLocale,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALES,
} from "../../../src/i18n/locales";

// Collaborators of resolveLocale(): the authenticated profile lookup and the
// request cookie store. Mock both so we can drive each branch of the
// resolution order (profile → cookie → default).
const getCurrentProfileMock = vi.fn();
vi.mock("../../../src/lib/auth/profile", () => ({
  getCurrentProfile: () => getCurrentProfileMock(),
}));

const cookieGetMock = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => cookieGetMock(name) }),
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
  });
  afterEach(() => vi.clearAllMocks());

  it("prefers the authenticated user's profiles.ui_locale", async () => {
    getCurrentProfileMock.mockResolvedValue({ ui_locale: "en" });
    cookieGetMock.mockReturnValue({ value: "vi" });
    expect(await resolveLocale()).toBe("en");
  });

  it("falls back to the NEXT_LOCALE cookie when there is no profile", async () => {
    getCurrentProfileMock.mockResolvedValue(null);
    cookieGetMock.mockReturnValue({ value: "vi" });
    expect(await resolveLocale()).toBe("vi");
  });

  it("falls back to the cookie when the profile lookup throws (no session/env)", async () => {
    getCurrentProfileMock.mockRejectedValue(new Error("no session"));
    cookieGetMock.mockReturnValue({ value: "en" });
    expect(await resolveLocale()).toBe("en");
  });

  it("falls back to the ko baseline when nothing resolves", async () => {
    getCurrentProfileMock.mockResolvedValue(null);
    cookieGetMock.mockReturnValue(undefined);
    expect(await resolveLocale()).toBe("ko");
  });

  it("ignores an unsupported cookie value and uses the baseline", async () => {
    getCurrentProfileMock.mockResolvedValue(null);
    cookieGetMock.mockReturnValue({ value: "de" });
    expect(await resolveLocale()).toBe("ko");
  });
});
