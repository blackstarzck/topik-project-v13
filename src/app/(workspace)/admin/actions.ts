"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  requireContentAdmin,
  requireOrgAdmin,
  requirePlatformAdmin,
} from "@/lib/auth/admin-guard";
import {
  addProblemAsset,
  createAssignment,
  deleteProblem,
  removeProblemAsset,
  setUserStatus,
  updateProblem,
  type AdminAssignmentRow,
} from "@/components/admin/admin-rpc";

/**
 * Cluster-local server actions for the new admin RPCs.
 *
 * The pre-existing role/publish actions live in `@/lib/admin/server-actions`
 * (outside this cluster's write scope and not regenerated here). These actions
 * cover the new H-01/X-08/X-10 mutations and re-apply the same guard pattern:
 * `requireXAdmin()` redirects forbidden callers before the RPC fires; the RPC
 * itself re-checks the role (defense-in-depth) and writes `admin_audit_logs`.
 */

export type AdminActionResult = { ok: true };

// ---------------------------------------------------------------------------
// H-01 — problem edit / delete / assets (content_admin)
// ---------------------------------------------------------------------------

export async function updateProblemAction(
  problemId: string,
  patch: Record<string, unknown>,
): Promise<AdminActionResult> {
  await requireContentAdmin();
  if (!problemId) throw new Error("updateProblem: problemId required");
  if (!patch || typeof patch !== "object") {
    throw new Error("updateProblem: patch must be an object");
  }
  const supabase = await createSupabaseServerClient();
  await updateProblem(supabase, problemId, patch);
  return { ok: true };
}

export async function deleteProblemAction(
  problemId: string,
): Promise<AdminActionResult> {
  await requireContentAdmin();
  if (!problemId) throw new Error("deleteProblem: problemId required");
  const supabase = await createSupabaseServerClient();
  await deleteProblem(supabase, problemId);
  return { ok: true };
}

export async function addProblemAssetAction(input: {
  problemId: string;
  storagePath: string;
  assetType: "image" | "audio";
  sortOrder?: number;
}): Promise<{ ok: true; assetId: string }> {
  await requireContentAdmin();
  if (!input.problemId || !input.storagePath) {
    throw new Error("addProblemAsset: problemId and storagePath required");
  }
  if (input.assetType !== "image" && input.assetType !== "audio") {
    throw new Error("addProblemAsset: assetType must be image|audio");
  }
  const supabase = await createSupabaseServerClient();
  const assetId = await addProblemAsset(supabase, input);
  return { ok: true, assetId };
}

export async function removeProblemAssetAction(
  assetId: string,
): Promise<AdminActionResult> {
  await requireContentAdmin();
  if (!assetId) throw new Error("removeProblemAsset: assetId required");
  const supabase = await createSupabaseServerClient();
  await removeProblemAsset(supabase, assetId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// X-10 — user status (platform_admin)
// ---------------------------------------------------------------------------

export async function setUserStatusAction(
  targetId: string,
  newStatus: "active" | "blocked",
): Promise<AdminActionResult> {
  await requirePlatformAdmin();
  if (!targetId) throw new Error("setUserStatus: targetId required");
  if (newStatus !== "active" && newStatus !== "blocked") {
    throw new Error("setUserStatus: newStatus must be active|blocked");
  }
  const supabase = await createSupabaseServerClient();
  await setUserStatus(supabase, targetId, newStatus);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// X-08 — assignment create (org_admin)
//
// NOTE on the org bootstrap gap: there is no create-organization RPC yet, and
// org RLS blocks inserting the first organization. Assignment creation requires
// an existing org_id (chosen in the UI from organizations the admin can see).
// If the admin has no org, the UI surfaces honest "기관 없음" guidance instead.
// ---------------------------------------------------------------------------

export async function createAssignmentAction(input: {
  orgId: string;
  title: string;
  problemId?: string | null;
  dueAt?: string | null;
}): Promise<{ ok: true; assignment: AdminAssignmentRow }> {
  await requireOrgAdmin();
  if (!input.orgId) throw new Error("createAssignment: orgId required");
  if (!input.title || input.title.trim().length === 0) {
    throw new Error("createAssignment: title required");
  }
  const supabase = await createSupabaseServerClient();
  const assignment = await createAssignment(supabase, {
    orgId: input.orgId,
    title: input.title.trim(),
    problemId: input.problemId ?? null,
    dueAt: input.dueAt ?? null,
  });
  return { ok: true, assignment };
}
