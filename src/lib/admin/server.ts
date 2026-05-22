// NOTE: server-only by convention. We do not `import "server-only"` because
// the package is not a runtime dep and vitest cannot resolve it. Callers must
// keep the boundary (no "use client" file should import from this path).
import {
  createSupabaseServerClient,
  type SupabaseServerClient,
} from "../supabase/server";
import type {
  AdminProblemFilter,
  AdminProblemRow,
  AdminUserFilter,
  AdminUserRow,
} from "./types";

type ClientFactory = () => Promise<SupabaseServerClient>;

/**
 * RLS contract:
 * - `listAdminUsers` reads `profiles`. The Phase 6 `profiles_self_select`
 *   policy restricts admin-side SELECT to `private.is_platform_admin(uid)`.
 *   Caller MUST have passed `requirePlatformAdmin()` first.
 * - `listAdminProblems` reads `problems`. The existing admin RLS lane allows
 *   content_admin/platform_admin via `private.is_admin(uid)`. Caller MUST
 *   have passed `requireContentAdmin()` first.
 *
 * Both helpers use the regular RLS-bound server client — service role is
 * never used (architecture pass).
 */

export async function listAdminUsers(
  filter: AdminUserFilter = {},
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<AdminUserRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (filter.role) {
    query = query.eq("app_role", filter.role);
  }
  if (filter.search && filter.search.trim().length > 0) {
    const term = filter.search.trim();
    const escaped = term.replace(/[%_]/g, (m) => `\\${m}`);
    const pattern = `%${escaped}%`;
    query = query.or(
      `display_name.ilike.${pattern},nickname.ilike.${pattern}`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(`listAdminUsers: ${error.message}`);
  return data ?? [];
}

export async function listAdminProblems(
  filter: AdminProblemFilter = {},
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<AdminProblemRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("problems")
    .select("*")
    .order("updated_at", { ascending: false });

  if (filter.status) {
    query = query.eq("publish_status", filter.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(`listAdminProblems: ${error.message}`);
  return data ?? [];
}
