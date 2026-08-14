import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionAndProfileMock = vi.fn();
const resolveProfileMock = vi.fn();
const getCurrentUserMock = vi.fn();
const getMissingRequiredConsentDocumentsMock = vi.fn();
const hasLearningGoalMock = vi.fn();

vi.mock("@/lib/auth/profile", () => ({
  resolveProfile: (...args: unknown[]) => resolveProfileMock(...args),
  getSessionAndProfile: () => getSessionAndProfileMock(),
  isActiveStatus: (status: string | null | undefined) => status === "active",
  requireActiveSession: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: () => getCurrentUserMock(),
}));

vi.mock("@/lib/legal/consent", () => ({
  getMissingRequiredConsentDocuments: (...args: unknown[]) =>
    getMissingRequiredConsentDocumentsMock(...args),
}));

vi.mock("@/lib/learning/server", () => ({
  hasLearningGoal: (...args: unknown[]) => hasLearningGoalMock(...args),
}));

import {
  getAuthCompletionStatusForSession,
  getCurrentAuthCompletionStatus,
  getCurrentLandingAuthStatus,
  type AuthenticatedSession,
} from "../../../src/lib/auth/completion";

const session = {
  user: {
    id: "user-1",
    email: "student@example.com",
    email_confirmed_at: "2026-06-29T00:00:00.000Z",
  },
  profile: {
    ui_locale: "ko",
    display_name: "Chan",
    nickname: "talkpik-abc123",
    nationality_country_code: "KR",
  },
} as unknown as AuthenticatedSession;

describe("auth completion state", () => {
  beforeEach(() => {
    getSessionAndProfileMock.mockReset();
    getSessionAndProfileMock.mockResolvedValue(null);
    resolveProfileMock.mockReset();
    resolveProfileMock.mockResolvedValue({
      status: "available",
      profile: session.profile,
    });
    getCurrentUserMock.mockReset();
    getCurrentUserMock.mockResolvedValue(null);
    getMissingRequiredConsentDocumentsMock.mockReset();
    getMissingRequiredConsentDocumentsMock.mockResolvedValue([]);
    hasLearningGoalMock.mockReset();
    hasLearningGoalMock.mockResolvedValue(true);
  });

  it("returns anonymous when there is no current session", async () => {
    getSessionAndProfileMock.mockResolvedValue(null);

    await expect(getCurrentAuthCompletionStatus()).resolves.toBe("anonymous");

    expect(getMissingRequiredConsentDocumentsMock).not.toHaveBeenCalled();
  });

  it("returns anonymous for the landing when auth lookup fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    getCurrentUserMock.mockRejectedValueOnce(
      new Error("private auth provider response"),
    );

    await expect(getCurrentLandingAuthStatus()).resolves.toBe("anonymous");

    expect(resolveProfileMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith("landing_auth_user_lookup_failed", {
      name: "Error",
    });
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain(
      "private auth provider response",
    );
    warnSpy.mockRestore();
  });

  it("returns pending-consent when profile is complete but required consent is missing", async () => {
    getMissingRequiredConsentDocumentsMock.mockResolvedValueOnce([
      { id: "terms-1" },
    ]);

    await expect(getAuthCompletionStatusForSession(session)).resolves.toBe(
      "pending-consent",
    );

    expect(getMissingRequiredConsentDocumentsMock).toHaveBeenCalledWith(
      "user-1",
      "ko",
    );
    expect(hasLearningGoalMock).not.toHaveBeenCalled();
  });

  it("returns landing-only email-unverified without calculating completion", async () => {
    getCurrentUserMock.mockResolvedValueOnce({
      id: "user-1",
      email: "student@example.com",
      email_confirmed_at: null,
    });

    await expect(getCurrentLandingAuthStatus()).resolves.toBe(
      "email-unverified",
    );

    expect(resolveProfileMock).not.toHaveBeenCalled();
    expect(getMissingRequiredConsentDocumentsMock).not.toHaveBeenCalled();
  });

  it("returns pending-auth-completion when required profile fields are missing", async () => {
    await expect(
      getAuthCompletionStatusForSession({
        ...session,
        profile: {
          ...session.profile,
          display_name: null,
          nickname: "talkpik-abc123",
          nationality_country_code: "KR",
        },
      }),
    ).resolves.toBe("pending-auth-completion");

    expect(hasLearningGoalMock).not.toHaveBeenCalled();
  });

  it("returns pending-learning-goal after consent is complete", async () => {
    hasLearningGoalMock.mockResolvedValueOnce(false);

    await expect(getAuthCompletionStatusForSession(session)).resolves.toBe(
      "pending-learning-goal",
    );
  });

  it("returns ready when consent and learning goal are complete", async () => {
    await expect(getAuthCompletionStatusForSession(session)).resolves.toBe(
      "ready",
    );
  });

  it("returns profile-unavailable instead of restarting sign-up when the profile read fails", async () => {
    getCurrentUserMock.mockResolvedValueOnce(session.user);
    resolveProfileMock.mockResolvedValueOnce({ status: "unavailable" });

    await expect(getCurrentLandingAuthStatus()).resolves.toBe(
      "profile-unavailable",
    );

    expect(resolveProfileMock).toHaveBeenCalledWith("user-1");
    expect(getMissingRequiredConsentDocumentsMock).not.toHaveBeenCalled();
  });

  it("keeps other authenticated dependency failures in a retry-only recovery state", async () => {
    getCurrentUserMock.mockResolvedValueOnce(session.user);
    getMissingRequiredConsentDocumentsMock.mockRejectedValueOnce(
      new Error("legal documents unavailable"),
    );

    await expect(getCurrentLandingAuthStatus()).resolves.toBe(
      "authenticated-recovery",
    );
  });
});
