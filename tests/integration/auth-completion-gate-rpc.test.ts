import { describe, expect, it } from "vitest";
import { assertLocalPrivilegedMutationTarget } from "../../scripts/lib/supabase-target-safety.mjs";

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
 *     SUPABASE_LOCAL_STACK=1 E2E_ALLOW_DEV_DB_MUTATION=1 \
 *       pnpm test tests/integration/auth-completion-gate-rpc.test.ts
 */

const ENABLED = process.env.SUPABASE_LOCAL_STACK === "1";

if (ENABLED) {
  assertLocalPrivilegedMutationTarget(process.env);
}

type SignedInUser = {
  supabase: Awaited<ReturnType<typeof createAnonClient>>;
  userId: string;
};

type ConsentDocumentSnapshot = { id: string; version: string };

let publishedSetSequence = 0;

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

async function publishOfficialDocumentSet(): Promise<
  ConsentDocumentSnapshot[]
> {
  const admin = await createAdminClient();
  publishedSetSequence += 1;
  const stamp = `${Date.now()}-${publishedSetSequence}`;
  const effectiveAt = new Date(
    Date.now() + publishedSetSequence * 1_000,
  ).toISOString();
  const { data, error } = await admin
    .from("legal_documents")
    .insert(
      (["privacy", "terms"] as const).map((docType) => ({
        body: `${docType} body ${stamp}`,
        doc_type: docType,
        effective_at: effectiveAt,
        is_placeholder: false,
        locale: "ko",
        requires_consent: true,
        source_policy_id: `auth-gate-${docType}-${stamp}`,
        status: "published",
        title: `${docType} ${stamp}`,
        version: `auth-gate-${stamp}`,
      })),
    )
    .select("id,version");
  if (error) throw error;
  return (data ?? [])
    .map(({ id, version }) => ({ id, version }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

describe.skipIf(!ENABLED)("auth completion gate RPC integration", () => {
  it("is callable by authenticated users and records missing required consents", async () => {
    const consentDocuments = await publishOfficialDocumentSet();
    const user = await createSignedInUser({
      displayName: "RPC User",
      nationalityCountryCode: "KR",
    });
    const { error } = await user.supabase.rpc("complete_auth_gate", {
      p_accept_required_consents: true,
      p_consent_documents: consentDocuments,
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
    const consentDocuments = await publishOfficialDocumentSet();
    const user = await createSignedInUser({ nationalityCountryCode: "KR" });

    const { error } = await user.supabase.rpc("complete_auth_gate", {
      p_accept_required_consents: false,
      p_consent_documents: consentDocuments,
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

  it("rejects a stale displayed snapshot and records no unseen consent", async () => {
    const displayedDocuments = await publishOfficialDocumentSet();
    const user = await createSignedInUser({ nationalityCountryCode: "KR" });
    await publishOfficialDocumentSet();

    const { error } = await user.supabase.rpc("complete_auth_gate", {
      p_accept_required_consents: true,
      p_consent_documents: displayedDocuments,
      p_display_name: "Stale Snapshot",
      p_nationality_country_code: "KR",
      p_nickname: null,
    });

    expect(error?.message).toContain(
      "auth_completion_stale: consent_documents",
    );

    const { data: profile, error: profileError } = await user.supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.userId)
      .single();
    if (profileError) throw profileError;
    expect(profile?.display_name).toBeNull();

    const { count, error: consentError } = await user.supabase
      .from("user_consents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.userId);
    if (consentError) throw consentError;
    expect(count).toBe(0);
  });

  it("does not expose the legacy boolean-only overload to authenticated users", async () => {
    await publishOfficialDocumentSet();
    const user = await createSignedInUser({
      displayName: "Legacy Caller",
      nationalityCountryCode: "KR",
    });
    const legacyRpc = user.supabase.rpc as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ error: { code?: string; message?: string } | null }>;

    const { error } = await legacyRpc("complete_auth_gate", {
      p_accept_required_consents: true,
      p_display_name: null,
      p_nationality_country_code: null,
      p_nickname: null,
    });

    expect(error).toBeTruthy();
    expect(`${error?.code ?? ""} ${error?.message ?? ""}`).toMatch(
      /42501|permission|schema cache|function/i,
    );
  });

  it.skipIf(!process.env.SUPABASE_SERVICE_ROLE_KEY)(
    "rejects duplicate nicknames submitted through the completion gate",
    async () => {
      const consentDocuments = await publishOfficialDocumentSet();
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
        p_consent_documents: consentDocuments,
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
