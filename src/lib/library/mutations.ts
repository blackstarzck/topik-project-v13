"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "../supabase/browser";
import { libraryItemsKey } from "./queries";
import {
  TAB_TO_ITEM_TYPE,
  type LibraryItemInsert,
  type LibraryItemRow,
  type LibraryTab,
} from "./types";

type BrowserClient = ReturnType<typeof createSupabaseBrowserClient>;
type ClientFactory = () => BrowserClient;

const DUPLICATE_LIBRARY_CONSTRAINTS = [
  "library_items_user_submission_uniq",
  "library_items_user_problem_uniq",
] as const;

type PostgrestErrorLike = {
  code?: string;
  constraint?: string | null;
  details?: string | null;
  hint?: string | null;
  message?: string | null;
};

export function isDuplicateLibrarySaveError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as PostgrestErrorLike;
  if (err.code !== "23505") return false;

  const text = [err.constraint, err.details, err.hint, err.message]
    .filter((value): value is string => Boolean(value))
    .join(" ");

  return DUPLICATE_LIBRARY_CONSTRAINTS.some((constraint) =>
    text.includes(constraint),
  );
}

/**
 * Direct insert into `library_items`. Phase 6 RLS
 * (`library_items_owner_insert`) verifies both `user_id = auth.uid()` and
 * the FK ownership of the referenced entity, so a malicious client trying
 * to save someone else's submission/report/export is rejected by the DB.
 *
 * The caller is responsible for setting exactly one of
 * `submission_id` / `report_id` / `problem_id` / `export_id` matching
 * `item_type`. The DB CHECK constraint on `library_items` also enforces this.
 */
export async function saveLibraryItem(
  input: LibraryItemInsert,
  createClient: ClientFactory = createSupabaseBrowserClient,
): Promise<LibraryItemRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("library_items")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  if (!data) throw new Error("saveLibraryItem: empty row");
  return data;
}

export async function deleteLibraryItem(
  itemId: string,
  createClient: ClientFactory = createSupabaseBrowserClient,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("library_items")
    .delete()
    .eq("id", itemId);
  if (error) throw error;
}

export type DeleteProblemLibraryItemInput = {
  user_id: string;
  problem_id: string;
};

export async function deleteProblemLibraryItem(
  input: DeleteProblemLibraryItemInput,
  createClient: ClientFactory = createSupabaseBrowserClient,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("library_items")
    .delete()
    .eq("user_id", input.user_id)
    .eq("item_type", "problem")
    .eq("problem_id", input.problem_id);
  if (error) throw error;
}

export async function updateItemTags(
  itemId: string,
  tags: string[],
  createClient: ClientFactory = createSupabaseBrowserClient,
): Promise<LibraryItemRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("library_items")
    .update({ tags })
    .eq("id", itemId)
    .select("*")
    .single();
  if (error) throw error;
  if (!data) throw new Error("updateItemTags: empty row");
  return data;
}

/**
 * Map a saved row back to the tab it belongs in, so mutation onSuccess
 * invalidates the right list. `attempt` is not exposed in Phase 6 — fall
 * back to invalidating all tabs in that case (defensive; UI never sends it).
 */
function tabsForItemType(itemType: LibraryItemRow["item_type"]): LibraryTab[] {
  for (const [tab, type] of Object.entries(TAB_TO_ITEM_TYPE) as Array<
    [LibraryTab, LibraryItemRow["item_type"]]
  >) {
    if (type === itemType) return [tab];
  }
  return ["submissions", "reports", "problems", "exports"];
}

export function useSaveLibraryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LibraryItemInsert) => saveLibraryItem(input),
    onSuccess: (row) => {
      for (const tab of tabsForItemType(row.item_type)) {
        qc.invalidateQueries({ queryKey: libraryItemsKey(tab) });
      }
    },
  });
}

export type DeleteLibraryItemInput = {
  itemId: string;
  /** Provide the tab so onSuccess invalidates the right list. */
  tab: LibraryTab;
};

export function useDeleteLibraryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId }: DeleteLibraryItemInput) =>
      deleteLibraryItem(itemId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: libraryItemsKey(variables.tab) });
    },
  });
}

export function useDeleteProblemLibraryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DeleteProblemLibraryItemInput) =>
      deleteProblemLibraryItem(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: libraryItemsKey("problems") });
    },
  });
}

export type UpdateItemTagsInput = {
  itemId: string;
  tags: string[];
  tab: LibraryTab;
};

export function useUpdateItemTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, tags }: UpdateItemTagsInput) =>
      updateItemTags(itemId, tags),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: libraryItemsKey(variables.tab) });
    },
  });
}
