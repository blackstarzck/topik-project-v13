import type { Tables } from "../supabase/types";
import type { AppRole } from "../auth/roles";

/**
 * Admin domain view types.
 *
 * `AdminUserRow` reuses the canonical `profiles` row shape (RLS allows
 * platform_admin to read every profile via the narrowed `profiles_self_select`
 * policy — see migration 20260521140000_phase_6_rpc_and_admin.sql §1b).
 *
 * `AdminProblemRow` reuses the canonical `problems` row shape; the admin RLS
 * lane is governed by `private.is_admin` (content/platform admin), and any
 * write goes through the `admin_toggle_problem_publish` RPC.
 *
 * `AuditLogRow` is deferred to OOS-8 (admin audit view UI) and intentionally
 * NOT exported here.
 */
export type AdminUserRow = Tables<"profiles">;
export type AdminProblemRow = Tables<"problems">;

export type AdminUserFilter = {
  search?: string;
  role?: AppRole;
};

export type AdminProblemFilter = {
  status?: AdminProblemRow["publish_status"];
};

export const ROLE_OPTIONS: readonly AppRole[] = [
  "learner",
  "content_admin",
  "org_admin",
  "platform_admin",
] as const;

export const PUBLISH_STATUS_OPTIONS: readonly AdminProblemRow["publish_status"][] = [
  "draft",
  "published",
  "archived",
] as const;

export function isAppRole(value: unknown): value is AppRole {
  return (
    typeof value === "string" &&
    (ROLE_OPTIONS as readonly string[]).includes(value)
  );
}

export function isPublishStatus(
  value: unknown,
): value is AdminProblemRow["publish_status"] {
  return (
    typeof value === "string" &&
    (PUBLISH_STATUS_OPTIONS as readonly string[]).includes(value)
  );
}
