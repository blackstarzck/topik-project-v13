import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const requireActiveSessionMock = vi.fn();
const createSupabaseServerClientMock = vi.fn();
const getMissingRequiredConsentDocumentsMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

vi.mock("@/lib/auth/profile", () => ({
  requireActiveSession: (...args: unknown[]) =>
    requireActiveSessionMock(...args),
}));

vi.mock("@/lib/legal/consent", () => ({
  getMissingRequiredConsentDocuments: (...args: unknown[]) =>
    getMissingRequiredConsentDocumentsMock(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => createSupabaseServerClientMock(),
}));

import { completeAuthGateAction } from "../../../src/app/auth/consent/actions";

const completeProfile = {
  display_name: "Chan",
  nationality_country_code: "KR",
  nickname: "talkpik-abc123",
  status: "active",
  ui_locale: "ko",
};

function makeForm(entries: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe("completeAuthGateAction", () => {
  const consoleErrorSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);

  beforeEach(() => {
    consoleErrorSpy.mockClear();
    redirectMock.mockClear();
    requireActiveSessionMock.mockReset();
    requireActiveSessionMock.mockResolvedValue({
      user: { id: "user-1" },
      profile: completeProfile,
    });
    getMissingRequiredConsentDocumentsMock.mockReset();
    getMissingRequiredConsentDocumentsMock.mockResolvedValue([]);
    createSupabaseServerClientMock.mockReset();
    createSupabaseServerClientMock.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
  });

  it("redirects inactive accounts before calling the RPC", async () => {
    requireActiveSessionMock.mockImplementationOnce(() =>
      redirectMock("/auth/account-inactive?status=blocked"),
    );

    await expect(completeAuthGateAction(makeForm({}))).rejects.toThrow(
      "NEXT_REDIRECT:/auth/account-inactive?status=blocked",
    );
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
  });

  it("redirects with required when a missing profile field is not submitted", async () => {
    requireActiveSessionMock.mockResolvedValueOnce({
      user: { id: "user-1" },
      profile: { ...completeProfile, display_name: null },
    });

    await expect(
      completeAuthGateAction(
        makeForm({ next: "/dashboard", nickname: "talkpik-abc123" }),
      ),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/auth/consent?next=%2Fdashboard&error=required",
    );
  });

  it("calls the transactional RPC with normalized profile values and consent intent", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    createSupabaseServerClientMock.mockResolvedValueOnce({ rpc });
    requireActiveSessionMock.mockResolvedValueOnce({
      user: { id: "user-1" },
      profile: {
        ...completeProfile,
        display_name: null,
        nationality_country_code: null,
        nickname: null,
      },
    });
    getMissingRequiredConsentDocumentsMock.mockResolvedValueOnce([
      { id: "terms-1" },
    ]);

    await expect(
      completeAuthGateAction(
        makeForm({
          accept: "on",
          display_name: "  민준  ",
          nationality_country_code: " kr ",
          next: "/dashboard",
          nickname: "  talkpik-min  ",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");

    expect(rpc).toHaveBeenCalledWith("complete_auth_gate", {
      p_accept_required_consents: true,
      p_display_name: "민준",
      p_nationality_country_code: "KR",
      p_nickname: "talkpik-min",
    });
  });

  it("validates a submitted nickname even when the profile already has one", async () => {
    requireActiveSessionMock.mockResolvedValueOnce({
      user: { id: "user-1" },
      profile: { ...completeProfile, display_name: null },
    });

    await expect(
      completeAuthGateAction(
        makeForm({
          display_name: "Chan",
          next: "/dashboard",
          nickname: "a",
        }),
      ),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/auth/consent?next=%2Fdashboard&error=required",
    );

    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
  });

  it("maps nickname unique conflicts to nickname-taken", async () => {
    createSupabaseServerClientMock.mockResolvedValueOnce({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "23505",
          message:
            'duplicate key value violates unique constraint "profiles_nickname_lower_uniq"',
        },
      }),
    });
    requireActiveSessionMock.mockResolvedValueOnce({
      user: { id: "user-1" },
      profile: { ...completeProfile, nickname: null },
    });

    await expect(
      completeAuthGateAction(
        makeForm({
          next: "/dashboard",
          nickname: "talkpik-abc123",
        }),
      ),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/auth/consent?next=%2Fdashboard&error=nickname-taken",
    );
  });

  it("logs sanitized RPC diagnostics when PostgREST cannot find the completion RPC", async () => {
    createSupabaseServerClientMock.mockResolvedValueOnce({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "PGRST202",
          details:
            "Searched for the function public.complete_auth_gate with parameters p_accept_required_consents, p_display_name, p_nationality_country_code, p_nickname",
          hint: "Try reloading the schema cache",
          message:
            "Could not find the function public.complete_auth_gate(...) in the schema cache",
        },
      }),
    });
    requireActiveSessionMock.mockResolvedValueOnce({
      user: { id: "user-1" },
      profile: { ...completeProfile, display_name: null },
    });
    getMissingRequiredConsentDocumentsMock.mockResolvedValueOnce([
      { id: "terms-1" },
      { id: "privacy-1" },
    ]);

    await expect(
      completeAuthGateAction(
        makeForm({
          accept: "on",
          display_name: "Chan",
          next: "/dashboard",
        }),
      ),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/auth/consent?next=%2Fdashboard&error=save-failed",
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "auth_consent_rpc_failed",
      expect.objectContaining({
        category: "auth_completion_rpc_missing_or_stale",
        code: "PGRST202",
        details:
          "Searched for the function public.complete_auth_gate with parameters p_accept_required_consents, p_display_name, p_nationality_country_code, p_nickname",
        hint: "Try reloading the schema cache",
        message:
          "Could not find the function public.complete_auth_gate(...) in the schema cache",
        missingConsentCount: 2,
        missingProfileFieldCount: 1,
        next: "/dashboard",
        route: "/auth/consent",
      }),
    );
  });

  it("falls back unsafe next values before redirecting", async () => {
    await expect(
      completeAuthGateAction(makeForm({ next: "/login" })),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/auth/post-auth?intent=login",
    );
  });
});
