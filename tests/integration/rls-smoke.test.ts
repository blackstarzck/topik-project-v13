import { describe, it } from "vitest";
import { assertLocalPublicMutationTarget } from "../../scripts/lib/supabase-target-safety.mjs";

/**
 * RLS smoke test against a Supabase CLI local stack.
 *
 * Skipped when `SUPABASE_LOCAL_STACK !== "1"`. Enable locally with:
 *
 *     supabase start
 *     supabase db reset
 *     SUPABASE_LOCAL_STACK=1 E2E_ALLOW_DEV_DB_MUTATION=1 pnpm test tests/integration/rls-smoke.test.ts
 *
 * Asserts the three core RLS contracts for Phase 2:
 *   1. Anon cannot read `problem_attempts` rows.
 *   2. Authenticated user A can read their own row in a user-owned table.
 *   3. Authenticated user B cannot read user A's row in the same table.
 */

const ENABLED = process.env.SUPABASE_LOCAL_STACK === "1";

if (ENABLED) {
  assertLocalPublicMutationTarget(process.env);
}

describe.skipIf(!ENABLED)("RLS smoke", () => {
  it("denies anon access to user-owned tables", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const anon = createClient(url, anonKey);

    const { data, error } = await anon
      .from("problem_attempts")
      .select("id")
      .limit(1);

    if (error && error.code !== "PGRST301") {
      // PGRST301 is acceptable (no policy matched); other errors fail loud.
      throw error;
    }
    if (data && data.length > 0) {
      throw new Error(
        "anon client unexpectedly read problem_attempts rows — RLS regression",
      );
    }
  });

  it("isolates rows between two authenticated users", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

    async function makeUser(label: string) {
      const supabase = createClient(url, anonKey);
      const { data, error } = await supabase.auth.signUp({
        email: `rls-${label}-${Date.now()}@example.com`,
        password: "p@ssw0rd-strong-1234",
      });
      if (error) throw error;
      const userId = data.user?.id;
      if (!userId) throw new Error("signup missing user id");
      return { supabase, userId };
    }

    const a = await makeUser("a");
    const b = await makeUser("b");

    // Each profile row should be visible to its owner only. profiles is the
    // simplest user-owned table to spot-check; deeper checks (attempts,
    // writing_drafts) belong in feature-specific tests.
    const { data: aSelf } = await a.supabase
      .from("profiles")
      .select("id")
      .eq("id", a.userId);
    if (!aSelf || aSelf.length !== 1) {
      throw new Error("user A cannot see own profile row");
    }

    const { data: aFromB } = await b.supabase
      .from("profiles")
      .select("id")
      .eq("id", a.userId);
    if (aFromB && aFromB.length > 0) {
      throw new Error("user B can see user A's profile row — RLS regression");
    }
  });
});
