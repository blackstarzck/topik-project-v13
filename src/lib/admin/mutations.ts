"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  changeUserRoleAction,
  togglePublishAction,
  type AdminActionResult,
  type ChangeUserRoleInput,
  type TogglePublishInput,
} from "./server-actions";
import { adminProblemsKey, adminUsersKey } from "./queries";

/**
 * Wraps the `changeUserRoleAction` Server Action. On success, invalidates
 * every `admin-users` cache entry so any mounted `useAdminUsers(filter)`
 * refetches with the new role visible.
 */
export function useChangeUserRole() {
  const qc = useQueryClient();
  return useMutation<AdminActionResult, Error, ChangeUserRoleInput>({
    mutationFn: (input) => changeUserRoleAction(input),
    onSuccess: () => {
      // Invalidate ALL admin-users variants (search/role filters live in
      // the key tail). The matcher prefix matches every cached filter.
      qc.invalidateQueries({ queryKey: adminUsersKey() });
    },
  });
}

/**
 * Wraps the `togglePublishAction` Server Action. On success, invalidates
 * every `admin-problems` cache entry.
 */
export function useToggleProblemPublish() {
  const qc = useQueryClient();
  return useMutation<AdminActionResult, Error, TogglePublishInput>({
    mutationFn: (input) => togglePublishAction(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminProblemsKey() });
    },
  });
}
