"use server";

import { createSupabaseServerClient } from "../supabase/server";
import {
  requireContentAdmin,
  requirePlatformAdmin,
} from "../auth/admin-guard";
import {
  isAppRole,
  isPublishStatus,
  type AdminProblemRow,
} from "./types";
import type { AppRole } from "../auth/roles";

export type ChangeUserRoleInput = {
  targetId: string;
  newRole: AppRole;
};

export type TogglePublishInput = {
  problemId: string;
  newStatus: AdminProblemRow["publish_status"];
};

export type AdminActionResult = { ok: true };

/**
 * Server action: change a user's `app_role` via the
 * `admin_change_user_role(target_id, new_role)` SECURITY DEFINER RPC.
 *
 * Guard: `requirePlatformAdmin()` redirects to `/dashboard?error=forbidden`
 * before the RPC fires. The RPC itself ALSO checks `is_platform_admin`
 * (defense-in-depth) and writes an `admin_audit_logs` row on success.
 */
export async function changeUserRoleAction(
  input: ChangeUserRoleInput,
): Promise<AdminActionResult> {
  await requirePlatformAdmin();

  if (!input.targetId || typeof input.targetId !== "string") {
    throw new Error("changeUserRole: targetId required");
  }
  if (!isAppRole(input.newRole)) {
    throw new Error(`changeUserRole: invalid role "${String(input.newRole)}"`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_change_user_role", {
    target_id: input.targetId,
    new_role: input.newRole,
  });
  if (error) {
    throw new Error(`changeUserRole rpc: ${error.message}`);
  }
  return { ok: true };
}

/**
 * Server action: toggle a problem's `publish_status` via the
 * `admin_toggle_problem_publish(problem_id, new_status)` SECURITY DEFINER
 * RPC.
 *
 * Guard: `requireContentAdmin()` (content_admin OR platform_admin).
 * The RPC additionally validates the status enum and writes an
 * `admin_audit_logs` row.
 */
export async function togglePublishAction(
  input: TogglePublishInput,
): Promise<AdminActionResult> {
  await requireContentAdmin();

  if (!input.problemId || typeof input.problemId !== "string") {
    throw new Error("togglePublish: problemId required");
  }
  if (!isPublishStatus(input.newStatus)) {
    throw new Error(
      `togglePublish: invalid status "${String(input.newStatus)}"`,
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_toggle_problem_publish", {
    problem_id: input.problemId,
    new_status: input.newStatus,
  });
  if (error) {
    throw new Error(`togglePublish rpc: ${error.message}`);
  }
  return { ok: true };
}
