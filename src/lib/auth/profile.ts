import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import {
  createSupabaseServerClient,
  type SupabaseServerClient,
} from "../supabase/server";
import type { Tables } from "../supabase/types";
import { ADMIN_ROLES, type AppRole } from "./roles";
import { getCurrentUser } from "./session";

type ClientFactory = () => Promise<SupabaseServerClient>;

// Re-export client-safe role constants so existing imports from
// `@/lib/auth/profile` keep working. New client-only consumers should
// import from `@/lib/auth/roles` directly to avoid pulling the server-only
// supabase chain into a client bundle.
export { ADMIN_ROLES, type AppRole };

/**
 * Idempotent profile lookup.
 *
 * Contract: MUST be called from an authenticated server context, e.g. after
 * `requireUser()`. The SELECT is RLS-bound (`profiles_self_select` allows
 * only `id = auth.uid()`), so calling this helper unauthenticated or for
 * a different user id will return `null` even if the row exists — that is
 * not a trigger failure, it is just RLS hiding the row.
 *
 * The DB trigger `on_auth_user_created` (migration 20260521120000) creates
 * the `profiles` row on `auth.users` insert. This helper does NOT insert —
 * anon/authenticated clients cannot bypass RLS to write trusted columns.
 *
 * A null return therefore means one of:
 *   (a) the auth trigger failed (truly missing row), or
 *   (b) the caller is not the row's owner (RLS hides the row).
 *
 * The thrown error names both possibilities so callers can diagnose
 * without false-attributing every absence to trigger failure.
 */
export async function bootstrapProfile(
  userId: string,
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<Tables<"profiles">> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to read profile for user ${userId}: ${error.message}`,
    );
  }
  if (!data) {
    throw new Error(
      `Profile for user ${userId} is not visible. Either the auth trigger ` +
        "(on_auth_user_created) failed to create the row, or this call is " +
        "running from an unauthenticated server context where RLS hides it. " +
        "Confirm the caller has passed requireUser() and that `userId` " +
        "matches the authenticated user.",
    );
  }
  return data;
}

/**
 * Returns the current authenticated user's profile, or `null` if not signed in.
 * Server-only. The lookup is RLS-bound, so a returned `null` means there is
 * no authenticated session — not "row missing".
 */
export async function getCurrentProfile(
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<Tables<"profiles"> | null> {
  const user = await getCurrentUser(createClient);
  if (!user) return null;
  return bootstrapProfile(user.id, createClient);
}

/**
 * Asserts the current user holds one of `allowedRoles`. If the user is not
 * authenticated, or their `app_role` is not in the list, the function
 * `redirect('/dashboard')`s — the function never returns in that case.
 * Returns the profile when access is permitted.
 */
export async function requireRole(
  allowedRoles: readonly AppRole[],
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<Tables<"profiles">> {
  const profile = await getCurrentProfile(createClient);
  if (!profile || !allowedRoles.includes(profile.app_role)) {
    redirect("/dashboard");
  }
  return profile;
}

/**
 * Single round-trip helper: fetches the authenticated user AND their profile
 * row. Returns `null` if not signed in. Replaces the wasteful
 * `getCurrentUser()` + `getCurrentProfile()` (which internally re-fetches the
 * user) pattern in layouts and server actions.
 */
export async function getSessionAndProfile(
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<{ user: User; profile: Tables<"profiles"> } | null> {
  const user = await getCurrentUser(createClient);
  if (!user) return null;
  const profile = await bootstrapProfile(user.id, createClient);
  return { user, profile };
}
