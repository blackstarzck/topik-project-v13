import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const requireActiveSessionMock = vi.fn();
const createSupabaseServerClientMock = vi.fn();
const getMissingRequiredConsentDocumentsMock = vi.fn();
const cookieGetMock = vi.fn();
const headerGetMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => cookieGetMock(name) }),
  headers: async () => ({ get: (name: string) => headerGetMock(name) }),
}));

vi.mock("@/lib/auth/profile", () => ({
  isActiveStatus: (status: string | null | undefined) => status === "active",
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
  gender: null,
  nationality_country_code: "KR",
  nickname: "talkpik-abc123",
  phone_number: null,
  status: "active",
  ui_locale: "ko",
  ui_locale_source: "manual",
};

function makeForm(
  entries: Record<string, string>,
  consentDocuments: Array<{ id: string; version: string }> = [],
) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  for (const document of consentDocuments) {
    formData.append("consent_document", JSON.stringify(document));
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
      user: {
        id: "user-1",
        email: "student@example.com",
        email_confirmed_at: "2026-06-29T00:00:00.000Z",
      },
      profile: completeProfile,
    });
    getMissingRequiredConsentDocumentsMock.mockReset();
    getMissingRequiredConsentDocumentsMock.mockResolvedValue([]);
    cookieGetMock.mockReset();
    cookieGetMock.mockReturnValue(undefined);
    headerGetMock.mockReset();
    headerGetMock.mockReturnValue(null);
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

  it("redirects active email-unverified users before reading documents or calling the RPC", async () => {
    requireActiveSessionMock.mockResolvedValueOnce({
      user: {
        id: "user-1",
        email: "student@example.com",
        email_confirmed_at: null,
      },
      profile: completeProfile,
    });

    await expect(
      completeAuthGateAction(makeForm({ next: "/dashboard" })),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/auth/verify-email?email=student%40example.com",
    );

    expect(getMissingRequiredConsentDocumentsMock).not.toHaveBeenCalled();
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
  });

  it("redirects with required when a missing profile field is not submitted", async () => {
    requireActiveSessionMock.mockResolvedValueOnce({
      user: {
        id: "user-1",
        email: "student@example.com",
        email_confirmed_at: "2026-06-29T00:00:00.000Z",
      },
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

  it("preserves the sign-up post-auth return path on required errors", async () => {
    requireActiveSessionMock.mockResolvedValueOnce({
      user: {
        id: "user-1",
        email: "student@example.com",
        email_confirmed_at: "2026-06-29T00:00:00.000Z",
      },
      profile: { ...completeProfile, nationality_country_code: null },
    });

    await expect(
      completeAuthGateAction(
        makeForm({
          next: "/auth/post-auth?intent=sign-up",
          nickname: "talkpik-abc123",
        }),
      ),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/auth/consent?next=%2Fauth%2Fpost-auth%3Fintent%3Dsign-up&error=required",
    );
  });

  it("calls the transactional RPC with normalized profile values and consent intent", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    createSupabaseServerClientMock.mockResolvedValueOnce({ rpc });
    requireActiveSessionMock.mockResolvedValueOnce({
      user: {
        id: "user-1",
        email: "student@example.com",
        email_confirmed_at: "2026-06-29T00:00:00.000Z",
      },
      profile: {
        ...completeProfile,
        display_name: null,
        nationality_country_code: null,
        nickname: null,
      },
    });
    getMissingRequiredConsentDocumentsMock.mockResolvedValueOnce([
      { id: "terms-1", version: "v1" },
    ]);

    await expect(
      completeAuthGateAction(
        makeForm(
          {
            accept: "on",
            display_name: "  민준  ",
            nationality_country_code: " kr ",
            next: "/dashboard",
            nickname: "  talkpik-min  ",
          },
          [{ id: "terms-1", version: "v1" }],
        ),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");

    expect(rpc).toHaveBeenCalledWith("complete_auth_gate", {
      p_accept_required_consents: true,
      p_consent_documents: [{ id: "terms-1", version: "v1" }],
      p_display_name: "민준",
      p_gender: null,
      p_nationality_country_code: "KR",
      p_nickname: "talkpik-min",
      p_phone_country_code: null,
      p_phone_number: null,
    });
  });

  it("passes optional profile fields to the completion RPC when supplied", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    createSupabaseServerClientMock.mockResolvedValueOnce({ rpc });
    getMissingRequiredConsentDocumentsMock.mockResolvedValueOnce([]);

    await expect(
      completeAuthGateAction(
        makeForm({
          gender: " female ",
          next: "/dashboard",
          phone_country_code: " kr ",
          phone_number: " 010-1234-5678 ",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");

    expect(rpc).toHaveBeenCalledWith("complete_auth_gate", {
      p_accept_required_consents: false,
      p_consent_documents: [],
      p_display_name: null,
      p_gender: "female",
      p_nationality_country_code: null,
      p_nickname: null,
      p_phone_country_code: "KR",
      p_phone_number: "01012345678",
    });
  });

  it("returns to sign-up post-auth after saving missing completion data", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    createSupabaseServerClientMock.mockResolvedValueOnce({ rpc });
    requireActiveSessionMock.mockResolvedValueOnce({
      user: {
        id: "user-1",
        email: "student@example.com",
        email_confirmed_at: "2026-06-29T00:00:00.000Z",
      },
      profile: {
        ...completeProfile,
        display_name: null,
        nationality_country_code: null,
        nickname: null,
      },
    });
    getMissingRequiredConsentDocumentsMock.mockResolvedValueOnce([
      { id: "terms-1", version: "v1" },
      { id: "privacy-1", version: "v1" },
    ]);

    await expect(
      completeAuthGateAction(
        makeForm(
          {
            accept: "on",
            display_name: "Minji",
            nationality_country_code: "kr",
            next: "/auth/post-auth?intent=sign-up",
            nickname: "talkpik-minji",
          },
          [
            { id: "terms-1", version: "v1" },
            { id: "privacy-1", version: "v1" },
          ],
        ),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/auth/post-auth?intent=sign-up");

    expect(rpc).toHaveBeenCalledWith("complete_auth_gate", {
      p_accept_required_consents: true,
      p_consent_documents: [
        { id: "privacy-1", version: "v1" },
        { id: "terms-1", version: "v1" },
      ],
      p_display_name: "Minji",
      p_gender: null,
      p_nationality_country_code: "KR",
      p_nickname: "talkpik-minji",
      p_phone_country_code: null,
      p_phone_number: null,
    });
  });

  it("seeds a default-source profile locale from Accept-Language before completing auth", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    createSupabaseServerClientMock.mockResolvedValueOnce({ rpc });
    requireActiveSessionMock.mockResolvedValueOnce({
      user: {
        id: "user-1",
        email: "student@example.com",
        email_confirmed_at: "2026-06-29T00:00:00.000Z",
      },
      profile: {
        ...completeProfile,
        ui_locale: "ko",
        ui_locale_source: "default",
      },
    });
    headerGetMock.mockReturnValue("vi-VN,vi;q=0.9,en-US;q=0.7");

    await expect(
      completeAuthGateAction(makeForm({ next: "/dashboard" })),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");

    expect(getMissingRequiredConsentDocumentsMock).toHaveBeenCalledWith(
      "user-1",
      "vi",
      expect.any(Function),
    );
    expect(rpc).toHaveBeenCalledWith("complete_auth_gate", {
      p_accept_required_consents: false,
      p_consent_documents: [],
      p_display_name: null,
      p_gender: null,
      p_nationality_country_code: null,
      p_nickname: null,
      p_phone_country_code: null,
      p_phone_number: null,
      p_ui_locale: "vi",
      p_ui_locale_source: "auto",
    });
  });

  it("validates a submitted nickname even when the profile already has one", async () => {
    requireActiveSessionMock.mockResolvedValueOnce({
      user: {
        id: "user-1",
        email: "student@example.com",
        email_confirmed_at: "2026-06-29T00:00:00.000Z",
      },
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
      user: {
        id: "user-1",
        email: "student@example.com",
        email_confirmed_at: "2026-06-29T00:00:00.000Z",
      },
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
            "Searched for the function public.complete_auth_gate with parameters p_accept_required_consents, p_display_name, p_gender, p_nationality_country_code, p_nickname, p_phone_country_code, p_phone_number",
          hint: "Try reloading the schema cache",
          message:
            "Could not find the function public.complete_auth_gate(...) in the schema cache",
        },
      }),
    });
    requireActiveSessionMock.mockResolvedValueOnce({
      user: {
        id: "user-1",
        email: "student@example.com",
        email_confirmed_at: "2026-06-29T00:00:00.000Z",
      },
      profile: { ...completeProfile, display_name: null },
    });
    getMissingRequiredConsentDocumentsMock.mockResolvedValueOnce([
      { id: "terms-1", version: "v1" },
      { id: "privacy-1", version: "v1" },
    ]);

    await expect(
      completeAuthGateAction(
        makeForm(
          {
            accept: "on",
            display_name: "Chan",
            next: "/dashboard",
          },
          [
            { id: "terms-1", version: "v1" },
            { id: "privacy-1", version: "v1" },
          ],
        ),
      ),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/auth/consent?next=%2Fdashboard&error=save-failed",
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith("auth_consent_rpc_failed", {
      category: "auth_completion_rpc_missing_or_stale",
      code: "PGRST202",
      missingConsentCount: 2,
      missingProfileFieldCount: 1,
      route: "/auth/consent",
    });
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain(
      "public.complete_auth_gate",
    );
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain(
      "schema cache",
    );
  });

  it("falls back unsafe next values before redirecting", async () => {
    await expect(
      completeAuthGateAction(makeForm({ next: "/login" })),
    ).rejects.toThrow("NEXT_REDIRECT:/auth/post-auth?intent=login");
  });

  it("refuses completion when required legal documents are unavailable", async () => {
    getMissingRequiredConsentDocumentsMock.mockRejectedValueOnce(
      new Error("permission denied SQL token=secret"),
    );

    await expect(
      completeAuthGateAction(makeForm({ next: "/dashboard" })),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/auth/consent?next=%2Fdashboard&error=save-failed",
    );

    const supabase =
      await createSupabaseServerClientMock.mock.results[0]?.value;
    expect(supabase?.rpc).not.toHaveBeenCalled();
  });

  it("refuses consent when the displayed document snapshot is stale", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    createSupabaseServerClientMock.mockResolvedValueOnce({ rpc });
    getMissingRequiredConsentDocumentsMock.mockResolvedValueOnce([
      { id: "terms-2", version: "v2" },
    ]);

    await expect(
      completeAuthGateAction(
        makeForm({ accept: "on", next: "/dashboard" }, [
          { id: "terms-1", version: "v1" },
        ]),
      ),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/auth/consent?next=%2Fdashboard&error=save-failed",
    );

    expect(rpc).not.toHaveBeenCalled();
  });
});
