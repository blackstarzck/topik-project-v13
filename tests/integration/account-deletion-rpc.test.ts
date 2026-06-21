import { describe, expect, it } from "vitest";

/**
 * Integration test for the 회원 탈퇴 soft-delete RPC + protect-columns trigger
 * exception added in `20260622120000_account_deletion_soft_delete.sql`.
 *
 * Requires the Supabase CLI local stack (docker). Skipped when
 * `SUPABASE_LOCAL_STACK !== "1"`.
 *
 * Enable locally with:
 *
 *     supabase start
 *     supabase db reset
 *     SUPABASE_LOCAL_STACK=1 pnpm test tests/integration/account-deletion-rpc.test.ts
 */

const ENABLED = process.env.SUPABASE_LOCAL_STACK === "1";

describe.skipIf(!ENABLED)("account deletion RPC integration", () => {
  it("soft-deletes the caller, is idempotent, and blocks self-recovery", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const supabase = createClient(url, anonKey);

    const email = `delete-test+${Date.now()}@example.com`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password: "p@ssw0rd-strong-1234",
    });
    if (error) throw error;
    const userId = data.user?.id;
    if (!userId) throw new Error("signup did not return a user id");

    // 1) request_account_deletion → status=deleted, deleted_at set.
    const { error: rpcErr } = await supabase.rpc("request_account_deletion");
    if (rpcErr) throw rpcErr;

    const { data: p1, error: p1Err } = await supabase
      .from("profiles")
      .select("status, deleted_at")
      .eq("id", userId)
      .single();
    if (p1Err) throw p1Err;
    expect(p1?.status).toBe("deleted");
    expect(p1?.deleted_at).toBeTruthy();

    // 2) Idempotent: a second call must succeed and NOT re-stamp deleted_at
    //    (protects the 30-day clock against double-click / multi-tab).
    const firstDeletedAt = p1!.deleted_at;
    const { error: rpcErr2 } = await supabase.rpc("request_account_deletion");
    if (rpcErr2) throw rpcErr2;

    const { data: p2 } = await supabase
      .from("profiles")
      .select("status, deleted_at")
      .eq("id", userId)
      .single();
    expect(p2?.status).toBe("deleted");
    expect(p2?.deleted_at).toBe(firstDeletedAt);

    // 3) The user must NOT be able to self-recover (deleted → active) via a
    //    plain UPDATE — the protect-columns trigger only allows active→deleted.
    const { error: recoverErr } = await supabase
      .from("profiles")
      .update({ status: "active" })
      .eq("id", userId);
    expect(recoverErr).toBeTruthy();
  });
});
