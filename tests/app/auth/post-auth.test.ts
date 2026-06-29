import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const requireActiveSessionMock = vi.fn();
const backfillOAuthDisplayNameMock = vi.fn();
const getAuthCompletionStatusForSessionMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

// post-auth now gates withdrawn/blocked accounts via requireActiveSession
// (returns { user, profile }) before any mutation/backfill.
vi.mock("@/lib/auth/profile", () => ({
  isActiveStatus: (status: string | null | undefined) => status === "active",
  requireActiveSession: () => requireActiveSessionMock(),
}));

vi.mock("@/lib/legal/consent", () => ({
  backfillOAuthDisplayName: (...args: unknown[]) =>
    backfillOAuthDisplayNameMock(...args),
}));

vi.mock("@/lib/auth/completion", () => ({
  getAuthCompletionStatusForSession: (...args: unknown[]) =>
    getAuthCompletionStatusForSessionMock(...args),
}));

import PostAuthPage from "../../../src/app/auth/post-auth/page";

async function renderPostAuth(intent?: string) {
  return PostAuthPage({
    searchParams: Promise.resolve(intent ? { intent } : {}),
  });
}

describe("/auth/post-auth", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    requireActiveSessionMock.mockReset();
    requireActiveSessionMock.mockResolvedValue({
      user: {
        id: "user-1",
        email: "student@example.com",
        email_confirmed_at: "2026-06-29T00:00:00.000Z",
      },
      profile: {
        display_name: "Chan",
        nationality_country_code: "KR",
        nickname: "talkpik-abc123",
        status: "active",
        ui_locale: "ko",
      },
    });
    backfillOAuthDisplayNameMock.mockReset();
    backfillOAuthDisplayNameMock.mockResolvedValue({
      id: "user-1",
      display_name: "Google User",
      nationality_country_code: "KR",
      nickname: "talkpik-abc123",
      ui_locale: "ko",
    });
    getAuthCompletionStatusForSessionMock.mockReset();
    getAuthCompletionStatusForSessionMock.mockResolvedValue("ready");
  });

  it("redirects to login when there is no session", async () => {
    requireActiveSessionMock.mockImplementationOnce(() =>
      redirectMock("/login"),
    );

    await expect(renderPostAuth()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects withdrawn accounts away before any backfill mutation", async () => {
    requireActiveSessionMock.mockImplementationOnce(() =>
      redirectMock("/auth/account-inactive?status=deleted"),
    );

    await expect(renderPostAuth()).rejects.toThrow(
      "NEXT_REDIRECT:/auth/account-inactive?status=deleted",
    );
    expect(backfillOAuthDisplayNameMock).not.toHaveBeenCalled();
  });

  it("redirects active email-unverified users before any backfill or completion lookup", async () => {
    requireActiveSessionMock.mockResolvedValueOnce({
      user: {
        id: "user-1",
        email: "student@example.com",
        email_confirmed_at: null,
      },
      profile: {
        display_name: "Chan",
        nationality_country_code: "KR",
        nickname: "talkpik-abc123",
        status: "active",
        ui_locale: "ko",
      },
    });

    await expect(renderPostAuth()).rejects.toThrow(
      "NEXT_REDIRECT:/auth/verify-email?email=student%40example.com",
    );

    expect(backfillOAuthDisplayNameMock).not.toHaveBeenCalled();
    expect(getAuthCompletionStatusForSessionMock).not.toHaveBeenCalled();
  });

  it("sends users with incomplete auth completion to the consent gate", async () => {
    getAuthCompletionStatusForSessionMock.mockResolvedValueOnce(
      "pending-auth-completion",
    );

    await expect(renderPostAuth("sign-up")).rejects.toThrow(
      "NEXT_REDIRECT:/auth/consent?next=%2Fauth%2Fpost-auth%3Fintent%3Dsign-up",
    );
  });

  it("sends users without learning goals to onboarding after auth completion is complete", async () => {
    getAuthCompletionStatusForSessionMock.mockResolvedValueOnce(
      "pending-learning-goal",
    );

    await expect(renderPostAuth("login")).rejects.toThrow(
      "NEXT_REDIRECT:/onboarding/learning-goal",
    );
  });

  it("sends existing users with consent and learning goals to dashboard", async () => {
    await expect(renderPostAuth()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("adds a Google linked notice only to final authenticated destinations", async () => {
    requireActiveSessionMock.mockResolvedValueOnce({
      user: {
        id: "user-1",
        email: "student@example.com",
        email_confirmed_at: "2026-06-29T00:00:00.000Z",
        identities: [{ provider: "email" }, { provider: "google" }],
      },
      profile: { status: "active", ui_locale: "ko" },
    });

    await expect(renderPostAuth("sign-up")).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard?notice=google-linked",
    );
  });

  it("keeps the consent redirect free of the Google linked notice", async () => {
    requireActiveSessionMock.mockResolvedValueOnce({
      user: {
        id: "user-1",
        email: "student@example.com",
        email_confirmed_at: "2026-06-29T00:00:00.000Z",
        identities: [{ provider: "google" }],
      },
      profile: { status: "active", ui_locale: "ko" },
    });
    getAuthCompletionStatusForSessionMock.mockResolvedValueOnce(
      "pending-auth-completion",
    );

    await expect(renderPostAuth("sign-up")).rejects.toThrow(
      "NEXT_REDIRECT:/auth/consent?next=%2Fauth%2Fpost-auth%3Fintent%3Dsign-up",
    );
  });

  it("backfills the OAuth display name before routing", async () => {
    await expect(renderPostAuth()).rejects.toThrow("NEXT_REDIRECT:/dashboard");

    expect(backfillOAuthDisplayNameMock).toHaveBeenCalledWith({
      id: "user-1",
      email: "student@example.com",
      email_confirmed_at: "2026-06-29T00:00:00.000Z",
    });
  });
});
