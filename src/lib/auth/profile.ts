import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import {
  createSupabaseServerClient,
  type SupabaseServerClient,
} from "../supabase/server";
import type { Tables } from "../supabase/types";
import { ACCOUNT_INACTIVE_PATH } from "./completion-routes";
import { ADMIN_ROLES, type AppRole } from "./roles";
import { getCurrentUser } from "./session";

type ClientFactory = () => Promise<SupabaseServerClient>;

// Re-export client-safe role constants so existing imports from
// `@/lib/auth/profile` keep working. New client-only consumers should
// import from `@/lib/auth/roles` directly to avoid pulling the server-only
// supabase chain into a client bundle.
export { ADMIN_ROLES, type AppRole };

export type ProfileResolution =
  | { status: "available"; profile: Tables<"profiles"> }
  | { status: "unavailable" };

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
 * Read-only profile resolution for UI routing decisions.
 *
 * Missing rows, RLS-hidden rows, and transient query failures intentionally
 * collapse to the same unavailable state. Callers must not interpret that
 * state as a new account or start profile creation.
 */
export async function resolveProfile(
  userId: string,
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<ProfileResolution> {
  try {
    return {
      status: "available",
      profile: await bootstrapProfile(userId, createClient),
    };
  } catch {
    return { status: "unavailable" };
  }
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

/**
 * Reads the caller's own `profiles.status` via an RLS-bound SELECT.
 *
 * Used by `/api/*` route handlers (which bypass the proxy and are not under
 * the workspace layout) to reject withdrawn (`deleted`) or `blocked` accounts.
 * Returns `null` when the row is not visible (unauthenticated / RLS) — callers
 * MUST treat `null` as not-active. Pass the same request-bound supabase client
 * the route already created so the lookup runs in the caller's RLS scope.
 */
export async function fetchProfileStatus(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<Tables<"profiles">["status"] | null> {
  // Keep the caller ID in the public helper contract so call sites pair the
  // authenticated principal with this check. The RPC itself deliberately
  // accepts no ID and resolves only auth.uid(), preventing cross-user lookup.
  void userId;
  const { data, error } = await supabase.rpc("get_my_account_state");
  if (error) return null;
  return data === "active" || data === "blocked" || data === "deleted"
    ? data
    : null;
}

/**
 * Reads the authenticated principal and its minimal account state before any
 * private profile row is loaded. Deleted profiles are intentionally hidden by
 * RLS, so workspace routing must use this narrow RPC first.
 */
export async function getCurrentAccountState(
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<{
  user: User;
  status: Tables<"profiles">["status"] | null;
} | null> {
  const supabase = await createClient();
  const user = await getCurrentUser(async () => supabase);
  if (!user) return null;
  return {
    user,
    status: await fetchProfileStatus(supabase, user.id),
  };
}

/**
 * True only for `status === 'active'`. Withdrawn (`deleted`) and `blocked`
 * accounts are inactive and must be denied access everywhere.
 */
export function isActiveStatus(
  status: Tables<"profiles">["status"] | null | undefined,
): boolean {
  return status === "active";
}

/**
 * Server-component / server-action guard: returns the active session+profile,
 * or `redirect`s away — to `/login` when unauthenticated, or to the
 * cookie-clearing `/auth/account-inactive` route when the account is
 * withdrawn (`deleted`) or `blocked`. Use this on ALL authenticated surfaces
 * that read or mutate user data outside the workspace layout (auth-flow pages,
 * server actions), since the proxy only checks authentication, not status.
 */
export async function requireActiveSession(
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<{ user: User; profile: Tables<"profiles"> }> {
  const account = await getCurrentAccountState(createClient);
  if (!account) redirect("/login");
  if (!isActiveStatus(account.status)) {
    redirect(`${ACCOUNT_INACTIVE_PATH}?status=${account.status ?? "unknown"}`);
  }
  const session = await getSessionAndProfile(createClient);
  if (!session) redirect("/login");
  return session;
}
