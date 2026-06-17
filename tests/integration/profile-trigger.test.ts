import { describe, it } from "vitest";

/**
 * Integration test for the `on_auth_user_created` trigger added in
 * migration `20260521120000_auth_user_profile_bootstrap.sql`.
 *
 * Requires Supabase CLI local stack (docker). Skipped when
 * `SUPABASE_LOCAL_STACK !== "1"` because the host environment does not
 * provide docker or the supabase CLI by default.
 *
 * Enable locally with:
 *
 *     supabase start
 *     supabase db reset
 *     SUPABASE_LOCAL_STACK=1 pnpm test tests/integration/profile-trigger.test.ts
 */

const ENABLED = process.env.SUPABASE_LOCAL_STACK === "1";

describe.skipIf(!ENABLED)("profile trigger integration", () => {
  it("creates a profiles row when auth.users gets a new row", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const supabase = createClient(url, anonKey);

    const email = `trigger-test+${Date.now()}@example.com`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password: "p@ssw0rd-strong-1234",
      options: {
        data: {
          display_name: "Trigger User",
          nationality_country_code: "VN",
        },
      },
    });
    if (error) throw error;
    const userId = data.user?.id;
    if (!userId) throw new Error("signup did not return a user id");

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, app_role, status, nationality_country_code")
      .eq("id", userId)
      .single();

    if (profileError) throw profileError;
    if (!profile) throw new Error("trigger did not create profile row");
    if (profile.app_role !== "learner") {
      throw new Error(`unexpected app_role: ${profile.app_role}`);
    }
    if (profile.status !== "active") {
      throw new Error(`unexpected status: ${profile.status}`);
    }
    if (profile.nationality_country_code !== "VN") {
      throw new Error(
        `unexpected country code: ${profile.nationality_country_code}`,
      );
    }
  });
});
