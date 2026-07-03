import { describe, expect, it } from "vitest";

/**
 * Integration tests for the auth completion RPC added in
 * `20260623103000_auth_completion_gate.sql`.
 *
 * Requires the Supabase CLI local stack. Skipped when
 * `SUPABASE_LOCAL_STACK !== "1"`.
 *
 * Enable locally with:
 *
 *     supabase start
 *     supabase db reset
 *     SUPABASE_LOCAL_STACK=1 pnpm test tests/integration/auth-completion-gate-rpc.test.ts
 */

const ENABLED = process.env.SUPABASE_LOCAL_STACK === "1";

type SignedInUser = {
  supabase: Awaited<ReturnType<typeof createAnonClient>>;
  userId: string;
};

async function loadSupabase() {
  return await import("@supabase/supabase-js");
}

async function createAnonClient() {
  const { createClient } = await loadSupabase();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  return createClient(url, anonKey);
}

async function createAdminClient() {
  const { createClient } = await loadSupabase();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

async function createSignedInUser({
  displayName,
  nationalityCountryCode = "VN",
}: {
  displayName?: string;
  nationalityCountryCode?: string;
} = {}): Promise<SignedInUser> {
  const supabase = await createAnonClient();
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const { data, error } = await supabase.auth.signUp({
    email: `auth-gate-rpc-${stamp}@example.com`,
    password: "p@ssw0rd-strong-1234",
    options: {
      data: {
        ...(displayName ? { display_name: displayName } : {}),
        nationality_country_code: nationalityCountryCode,
      },
    },
  });
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) throw new Error("signup did not return a user id");
  return { supabase, userId };
}

async function expectRequiredLegalDocuments(
  supabase: SignedInUser["supabase"],
) {
  const { count, error } = await supabase
    .from("legal_documents")
    .select("id", { count: "exact", head: true })
    .eq("status", "published")
    .eq("requires_consent", true);
  if (error) throw error;
  expect(count).toBeGreaterThan(0);
}

describe.skipIf(!ENABLED)("auth completion gate RPC integration", () => {
  it("is callable by authenticated users and records missing required consents", async () => {
    const user = await createSignedInUser({
      displayName: "RPC User",
      nationalityCountryCode: "KR",
    });
    await expectRequiredLegalDocuments(user.supabase);

    const { error } = await user.supabase.rpc("complete_auth_gate", {
      p_accept_required_consents: true,
      p_display_name: null,
      p_nationality_country_code: null,
      p_nickname: null,
    });
    if (error) throw error;

    const { data: profile, error: profileError } = await user.supabase
      .from("profiles")
      .select("display_name,nationality_country_code,nickname")
      .eq("id", user.userId)
      .single();
    if (profileError) throw profileError;
    expect(profile?.display_name).toBe("RPC User");
    expect(profile?.nationality_country_code).toBe("KR");
    expect(profile?.nickname).toMatch(/^talkpik-/);

    const { data: consents, error: consentError } = await user.supabase
      .from("user_consents")
      .select("source")
      .eq("user_id", user.userId);
    if (consentError) throw consentError;
    expect(consents?.length).toBeGreaterThan(0);
    expect(consents?.every((row) => row.source === "signup")).toBe(true);
  });

  it("rolls back profile changes when required consent is not accepted", async () => {
    const user = await createSignedInUser({ nationalityCountryCode: "KR" });
    await expectRequiredLegalDocuments(user.supabase);

    const { error } = await user.supabase.rpc("complete_auth_gate", {
      p_accept_required_consents: false,
      p_display_name: "Rollback User",
      p_nationality_country_code: "KR",
      p_nickname: null,
    });

    expect(error?.message).toContain("auth_completion_required: consent");

    const { data: profile, error: profileError } = await user.supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.userId)
      .single();
    if (profileError) throw profileError;
    expect(profile?.display_name).toBeNull();
  });

  it.skipIf(!process.env.SUPABASE_SERVICE_ROLE_KEY)(
    "rejects duplicate nicknames submitted through the completion gate",
    async () => {
      const first = await createSignedInUser({ displayName: "First User" });
      const second = await createSignedInUser({ nationalityCountryCode: "KR" });
      const admin = await createAdminClient();

      const { data: firstProfile, error: firstProfileError } =
        await first.supabase
          .from("profiles")
          .select("nickname")
          .eq("id", first.userId)
          .single();
      if (firstProfileError) throw firstProfileError;
      const duplicateNickname = firstProfile?.nickname;
      if (!duplicateNickname) throw new Error("first user nickname missing");

      const { error: resetError } = await admin
        .from("profiles")
        .update({ display_name: null, nickname: null })
        .eq("id", second.userId);
      if (resetError) throw resetError;

      const { error } = await second.supabase.rpc("complete_auth_gate", {
        p_accept_required_consents: true,
        p_display_name: "Second User",
        p_nationality_country_code: "KR",
        p_nickname: duplicateNickname,
      });

      expect(error).toBeTruthy();
      expect(`${error?.code ?? ""} ${error?.message ?? ""}`).toMatch(
        /23505|profiles_nickname_lower_uniq|duplicate/i,
      );
    },
  );
});
