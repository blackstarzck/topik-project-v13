import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const requireActiveSessionMock = vi.fn();
const backfillOAuthDisplayNameMock = vi.fn();
const getMissingRequiredConsentDocumentsMock = vi.fn();
const getRequiredConsentDocumentsMock = vi.fn();
const hasLearningGoalMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

// post-auth now gates withdrawn/blocked accounts via requireActiveSession
// (returns { user, profile }) before any mutation/backfill.
vi.mock("@/lib/auth/profile", () => ({
  requireActiveSession: () => requireActiveSessionMock(),
}));

vi.mock("@/lib/legal/consent", () => ({
  backfillOAuthDisplayName: (...args: unknown[]) =>
    backfillOAuthDisplayNameMock(...args),
  getMissingRequiredConsentDocuments: (...args: unknown[]) =>
    getMissingRequiredConsentDocumentsMock(...args),
  getRequiredConsentDocuments: (...args: unknown[]) =>
    getRequiredConsentDocumentsMock(...args),
}));

vi.mock("@/lib/learning/server", () => ({
  hasLearningGoal: (...args: unknown[]) => hasLearningGoalMock(...args),
}));

import PostAuthPage from "../../../src/app/auth/post-auth/page";

const termsDoc = {
  id: "terms-1",
  doc_type: "terms",
  version: "v1",
};

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
      user: { id: "user-1" },
      profile: { status: "active", ui_locale: "ko" },
    });
    backfillOAuthDisplayNameMock.mockReset();
    backfillOAuthDisplayNameMock.mockResolvedValue({
      id: "user-1",
      display_name: "Google User",
      ui_locale: "ko",
    });
    getRequiredConsentDocumentsMock.mockReset();
    getRequiredConsentDocumentsMock.mockResolvedValue([termsDoc]);
    getMissingRequiredConsentDocumentsMock.mockReset();
    getMissingRequiredConsentDocumentsMock.mockResolvedValue([]);
    hasLearningGoalMock.mockReset();
    hasLearningGoalMock.mockResolvedValue(true);
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

  it("sends users with missing required consent to the consent gate", async () => {
    getMissingRequiredConsentDocumentsMock.mockResolvedValueOnce([termsDoc]);

    await expect(renderPostAuth("sign-up")).rejects.toThrow(
      "NEXT_REDIRECT:/auth/consent?next=%2Fauth%2Fpost-auth%3Fintent%3Dsign-up",
    );
  });

  it("sends users without learning goals to onboarding after consent is complete", async () => {
    hasLearningGoalMock.mockResolvedValueOnce(false);

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
      user: { id: "user-1", identities: [{ provider: "google" }] },
      profile: { status: "active", ui_locale: "ko" },
    });
    getMissingRequiredConsentDocumentsMock.mockResolvedValueOnce([termsDoc]);

    await expect(renderPostAuth("sign-up")).rejects.toThrow(
      "NEXT_REDIRECT:/auth/consent?next=%2Fauth%2Fpost-auth%3Fintent%3Dsign-up",
    );
  });

  it("backfills the OAuth display name before routing", async () => {
    await expect(renderPostAuth()).rejects.toThrow("NEXT_REDIRECT:/dashboard");

    expect(backfillOAuthDisplayNameMock).toHaveBeenCalledWith({
      id: "user-1",
    });
  });
});
