import { describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const requireActiveSessionMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

vi.mock("@/lib/auth/profile", () => ({
  isActiveStatus: (status: string | null | undefined) => status === "active",
  requireActiveSession: (...args: unknown[]) =>
    requireActiveSessionMock(...args),
}));

import {
  buildVerifyEmailPath,
  getAuthAccessGateStatusForSession,
  isEmailVerified,
  requireVerifiedActiveSession,
} from "../../../src/lib/auth/access-gate";

describe("auth access gate", () => {
  it("detects email verification from Supabase email_confirmed_at", () => {
    expect(
      isEmailVerified({ email_confirmed_at: "2026-06-29T00:00:00.000Z" }),
    ).toBe(true);
    expect(isEmailVerified({ email_confirmed_at: null })).toBe(false);
    expect(isEmailVerified({ email_confirmed_at: undefined })).toBe(false);
  });

  it("builds verify-email paths without treating expired auth tokens as verify-email", () => {
    expect(buildVerifyEmailPath({ email: "student+gate@example.com" })).toBe(
      "/auth/verify-email?email=student%2Bgate%40example.com",
    );
    expect(buildVerifyEmailPath({ email: null })).toBe("/auth/verify-email");
    expect(buildVerifyEmailPath({ email: undefined })).toBe(
      "/auth/verify-email",
    );
  });

  it("classifies inactive, email-unverified, and verified active sessions", () => {
    expect(
      getAuthAccessGateStatusForSession({
        user: {
          email_confirmed_at: "2026-06-29T00:00:00.000Z",
        },
        profile: { status: "blocked" },
      }),
    ).toBe("inactive");
    expect(
      getAuthAccessGateStatusForSession({
        user: { email_confirmed_at: null },
        profile: { status: "active" },
      }),
    ).toBe("email-unverified");
    expect(
      getAuthAccessGateStatusForSession({
        user: {
          email_confirmed_at: "2026-06-29T00:00:00.000Z",
        },
        profile: { status: "active" },
      }),
    ).toBe("verified-active");
  });

  it("redirects active but email-unverified sessions before callers continue", async () => {
    requireActiveSessionMock.mockResolvedValueOnce({
      user: {
        id: "user-1",
        email: "student@example.com",
        email_confirmed_at: null,
      },
      profile: { status: "active" },
    });

    await expect(requireVerifiedActiveSession()).rejects.toThrow(
      "NEXT_REDIRECT:/auth/verify-email?email=student%40example.com",
    );
  });
});
