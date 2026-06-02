/**
 * Local typed wrappers for the Phase-conformance admin RPCs.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The generated Supabase types snapshot (`src/lib/supabase/types.ts`) is a
 * hand-aligned file that is *outside this cluster's write scope* and is
 * currently stale: it does not yet declare the new admin RPCs
 * (`get_admin_users`, `get_admin_user_stats`, `admin_set_user_status`,
 * `admin_update_problem`, `admin_delete_problem`, `admin_add_problem_asset`,
 * `admin_remove_problem_asset`, `get_admin_audit_logs`) nor the extended
 * `get_admin_org_dashboard` return shape, nor the org/assignment tables.
 *
 * Calling `supabase.rpc("get_admin_users", …)` against the strongly-typed
 * client therefore fails `tsc`. Until the snapshot is regenerated (tracked as a
 * coordinator-owned change to `src/lib/supabase/types.ts`), these helpers cast
 * the client to an untyped RPC/`from` surface at exactly one place and re-impose
 * strong types on the *result* via the row types declared below.
 *
 * Both server components and client hooks call these — the functions take an
 * already-constructed Supabase client so they stay client/server-agnostic and
 * carry no `"use client"` boundary themselves.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyClient = SupabaseClient<any, any, any>;

/** One place where the stale-types cast happens. */
function rpcSurface(client: unknown): {
  rpc: (name: string, args?: Record<string, unknown>) => any;
  from: (table: string) => any;
} {
  return client as unknown as {
    rpc: (name: string, args?: Record<string, unknown>) => any;
    from: (table: string) => any;
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Row shapes (mirror the migration RETURNS TABLE contracts).
// ---------------------------------------------------------------------------

export type AdminUserDirectoryRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  app_role: string;
  plan_label: string | null;
  status: string;
  submission_count: number;
  last_activity: string | null;
  last_sign_in_at: string | null;
  created_at: string;
  total_count: number;
};

export type AdminUserStats = {
  total_users: number;
  active_users: number;
  blocked_users: number;
  total_submissions: number;
};

export type AdminAuditLogRow = {
  id: string;
  admin_user_id: string;
  action: string;
  target_table: string;
  target_id: string;
  diff: unknown;
  payload: unknown;
  created_at: string;
};

export type AdminProblemAssetRow = {
  id: string;
  problem_id: string;
  storage_path: string;
  asset_type: "image" | "audio";
  sort_order: number;
};

export type AdminOrgPerUserRow = {
  learner_id: string;
  display_name: string | null;
  submission_count: number;
  avg_score: number | null;
  last_activity: string | null;
};

export type AdminOrgRecentEvent = {
  event_type: string;
  occurred_at: string;
  user_id: string | null;
  payload: unknown;
};

export type AdminOrgDashboardExtended = {
  learner_count: number;
  active_7d_count: number;
  submissions_7d_count: number;
  recent_events: AdminOrgRecentEvent[];
  avg_writing_score: number | null;
  per_user: AdminOrgPerUserRow[];
};

export type AdminAssignmentRow = {
  id: string;
  org_id: string;
  title: string;
  problem_id: string | null;
  due_at: string | null;
  created_at: string;
};

export type AdminOrganizationRow = {
  id: string;
  name: string;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Sort / filter option unions used by the UI.
// ---------------------------------------------------------------------------

export const USER_SORT_OPTIONS = ["activity", "created", "name"] as const;
export type UserSort = (typeof USER_SORT_OPTIONS)[number];

// ---------------------------------------------------------------------------
// X-10 — user directory + stats + status mutation
// ---------------------------------------------------------------------------

export async function fetchAdminUserDirectory(
  client: AnyClient,
  params: {
    search?: string | null;
    sort?: UserSort;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<AdminUserDirectoryRow[]> {
  const { data, error } = await rpcSurface(client).rpc("get_admin_users", {
    search: params.search ?? null,
    sort: params.sort ?? "activity",
    page: params.page ?? 1,
    page_size: params.pageSize ?? 20,
  });
  if (error) throw new Error(error.message ?? String(error));
  return (data ?? []) as AdminUserDirectoryRow[];
}

export async function fetchAdminUserStats(
  client: AnyClient,
): Promise<AdminUserStats> {
  const { data, error } = await rpcSurface(client).rpc("get_admin_user_stats");
  if (error) throw new Error(error.message ?? String(error));
  const row = Array.isArray(data) ? data[0] : data;
  return {
    total_users: Number(row?.total_users ?? 0),
    active_users: Number(row?.active_users ?? 0),
    blocked_users: Number(row?.blocked_users ?? 0),
    total_submissions: Number(row?.total_submissions ?? 0),
  };
}

export async function setUserStatus(
  client: AnyClient,
  targetId: string,
  newStatus: "active" | "blocked",
): Promise<void> {
  const { error } = await rpcSurface(client).rpc("admin_set_user_status", {
    target_id: targetId,
    new_status: newStatus,
  });
  if (error) throw new Error(error.message ?? String(error));
}

// ---------------------------------------------------------------------------
// H-01 — problem update / delete / assets
// ---------------------------------------------------------------------------

export async function updateProblem(
  client: AnyClient,
  problemId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await rpcSurface(client).rpc("admin_update_problem", {
    problem_id: problemId,
    patch,
  });
  if (error) throw new Error(error.message ?? String(error));
}

export async function deleteProblem(
  client: AnyClient,
  problemId: string,
): Promise<void> {
  const { error } = await rpcSurface(client).rpc("admin_delete_problem", {
    problem_id: problemId,
  });
  if (error) throw new Error(error.message ?? String(error));
}

export async function addProblemAsset(
  client: AnyClient,
  input: {
    problemId: string;
    storagePath: string;
    assetType: "image" | "audio";
    sortOrder?: number;
  },
): Promise<string> {
  const { data, error } = await rpcSurface(client).rpc(
    "admin_add_problem_asset",
    {
      problem_id: input.problemId,
      storage_path: input.storagePath,
      asset_type: input.assetType,
      sort_order: input.sortOrder ?? 0,
    },
  );
  if (error) throw new Error(error.message ?? String(error));
  return String(data ?? "");
}

export async function removeProblemAsset(
  client: AnyClient,
  assetId: string,
): Promise<void> {
  const { error } = await rpcSurface(client).rpc("admin_remove_problem_asset", {
    asset_id: assetId,
  });
  if (error) throw new Error(error.message ?? String(error));
}

export async function fetchProblemAssets(
  client: AnyClient,
  problemId: string,
): Promise<AdminProblemAssetRow[]> {
  const { data, error } = await rpcSurface(client)
    .from("problem_assets")
    .select("id, problem_id, storage_path, asset_type, sort_order")
    .eq("problem_id", problemId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message ?? String(error));
  return (data ?? []) as AdminProblemAssetRow[];
}

// ---------------------------------------------------------------------------
// Audit logs (H-01 / X-08 / X-10)
// ---------------------------------------------------------------------------

export async function fetchAuditLogs(
  client: AnyClient,
  params: { targetId?: string | null; rowLimit?: number } = {},
): Promise<AdminAuditLogRow[]> {
  const { data, error } = await rpcSurface(client).rpc("get_admin_audit_logs", {
    p_target_id: params.targetId ?? null,
    row_limit: params.rowLimit ?? 50,
  });
  if (error) throw new Error(error.message ?? String(error));
  return (data ?? []) as AdminAuditLogRow[];
}

// ---------------------------------------------------------------------------
// X-08 — extended org dashboard parser + assignments read
// ---------------------------------------------------------------------------

export function parseOrgDashboardExtended(
  data: unknown,
): AdminOrgDashboardExtended {
  const row = Array.isArray(data) ? data[0] : data;
  const r = (row ?? {}) as Record<string, unknown>;
  return {
    learner_count: Number(r.learner_count ?? 0),
    active_7d_count: Number(r.active_7d_count ?? 0),
    submissions_7d_count: Number(r.submissions_7d_count ?? 0),
    recent_events: Array.isArray(r.recent_events)
      ? (r.recent_events as AdminOrgRecentEvent[])
      : [],
    avg_writing_score:
      r.avg_writing_score == null ? null : Number(r.avg_writing_score),
    per_user: Array.isArray(r.per_user)
      ? (r.per_user as AdminOrgPerUserRow[])
      : [],
  };
}

export async function fetchOrgDashboardExtended(
  client: AnyClient,
): Promise<AdminOrgDashboardExtended> {
  const { data, error } = await rpcSurface(client).rpc(
    "get_admin_org_dashboard",
  );
  if (error) throw new Error(error.message ?? String(error));
  return parseOrgDashboardExtended(data);
}

export async function fetchOrgAssignments(
  client: AnyClient,
): Promise<AdminAssignmentRow[]> {
  const { data, error } = await rpcSurface(client)
    .from("assignments")
    .select("id, org_id, title, problem_id, due_at, created_at")
    .order("due_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message ?? String(error));
  return (data ?? []) as AdminAssignmentRow[];
}

export async function fetchOrganizations(
  client: AnyClient,
): Promise<AdminOrganizationRow[]> {
  const { data, error } = await rpcSurface(client)
    .from("organizations")
    .select("id, name, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message ?? String(error));
  return (data ?? []) as AdminOrganizationRow[];
}

export async function createAssignment(
  client: AnyClient,
  input: { orgId: string; title: string; problemId?: string | null; dueAt?: string | null },
): Promise<AdminAssignmentRow> {
  const { data, error } = await rpcSurface(client)
    .from("assignments")
    .insert({
      org_id: input.orgId,
      title: input.title,
      problem_id: input.problemId ?? null,
      due_at: input.dueAt ?? null,
    })
    .select("id, org_id, title, problem_id, due_at, created_at")
    .single();
  if (error) throw new Error(error.message ?? String(error));
  return data as AdminAssignmentRow;
}
