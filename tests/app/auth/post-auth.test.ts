import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const requireUserMock = vi.fn();
const backfillOAuthDisplayNameMock = vi.fn();
const getMissingRequiredConsentDocumentsMock = vi.fn();
const getRequiredConsentDocumentsMock = vi.fn();
const hasLearningGoalMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

vi.mock("@/lib/auth/session", () => ({
  requireUser: () => requireUserMock(),
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
    requireUserMock.mockReset();
    requireUserMock.mockResolvedValue({ id: "user-1" });
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
    requireUserMock.mockImplementationOnce(() => redirectMock("/login"));

    await expect(renderPostAuth()).rejects.toThrow("NEXT_REDIRECT:/login");
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

  it("backfills the OAuth display name before routing", async () => {
    await expect(renderPostAuth()).rejects.toThrow("NEXT_REDIRECT:/dashboard");

    expect(backfillOAuthDisplayNameMock).toHaveBeenCalledWith({
      id: "user-1",
    });
  });
});
