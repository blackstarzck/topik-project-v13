"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "../supabase/browser";
import type {
  AdminProblemFilter,
  AdminProblemRow,
  AdminUserFilter,
  AdminUserRow,
} from "./types";

type BrowserClient = ReturnType<typeof createSupabaseBrowserClient>;
type ClientFactory = () => BrowserClient;

/**
 * Phase 6 admin query keys. Both keys normalize the filter shape so that
 * "no filter" → same key, and partial filters produce stable keys (omitting
 * undefined fields). Pages typically hydrate from server fetch; these
 * hooks refetch on mutation invalidation.
 */
function normalizeUserFilter(filter: AdminUserFilter): {
  search: string;
  role: string;
} {
  return {
    search: filter.search?.trim() ?? "",
    role: filter.role ?? "",
  };
}

function normalizeProblemFilter(filter: AdminProblemFilter): {
  status: string;
} {
  return {
    status: filter.status ?? "",
  };
}

export function adminUsersKey(filter: AdminUserFilter = {}) {
  return ["admin-users", normalizeUserFilter(filter)] as const;
}

export function adminProblemsKey(filter: AdminProblemFilter = {}) {
  return ["admin-problems", normalizeProblemFilter(filter)] as const;
}

export async function fetchAdminUsers(
  filter: AdminUserFilter = {},
  createClient: ClientFactory = createSupabaseBrowserClient,
): Promise<AdminUserRow[]> {
  const supabase = createClient();
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
  if (error) throw error;
  return data ?? [];
}

export async function fetchAdminProblems(
  filter: AdminProblemFilter = {},
  createClient: ClientFactory = createSupabaseBrowserClient,
): Promise<AdminProblemRow[]> {
  const supabase = createClient();
  let query = supabase
    .from("problems")
    .select("*")
    .order("updated_at", { ascending: false });

  if (filter.status) {
    query = query.eq("publish_status", filter.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export function useAdminUsers(filter: AdminUserFilter = {}) {
  return useQuery({
    queryKey: adminUsersKey(filter),
    queryFn: () => fetchAdminUsers(filter),
  });
}

export function useAdminProblems(filter: AdminProblemFilter = {}) {
  return useQuery({
    queryKey: adminProblemsKey(filter),
    queryFn: () => fetchAdminProblems(filter),
  });
}
