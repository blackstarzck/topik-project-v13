"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "../supabase/browser";
import {
  TAB_TO_ITEM_TYPE,
  coerceLibraryProblemAvailabilityStatus,
  excerptNarrative,
  type LibraryExportView,
  type LibraryItemRow,
  type LibraryItemView,
  type LibraryProblemView,
  type LibraryReportView,
  type LibrarySubmissionView,
  type LibraryTab,
} from "./types";

type BrowserClient = ReturnType<typeof createSupabaseBrowserClient>;
type ClientFactory = () => BrowserClient;

type LibraryProblemRpcRow = {
  item_id: string;
  problem_id: string | null;
  title: string | null;
  question_no: number | null;
  answer_text: string | null;
  tags: string[] | null;
  saved_at: string;
  availability_status: string | null;
  availability_reason: string | null;
  can_retry: boolean | null;
};

type WritingSubmissionHistoryRow = {
  submission_id: string;
  problem_id: string;
  question_no: number;
  title: string | null;
};

export function libraryItemsKey(tab: LibraryTab) {
  return ["library-items", tab] as const;
}

/**
 * Browser-side fetch — RLS-bound. Same join strategy as `listLibraryItems`
 * on the server (see server.ts) so the wire shape stays identical.
 */
export async function fetchLibraryItems(
  tab: LibraryTab,
  createClient: ClientFactory = createSupabaseBrowserClient,
): Promise<LibraryItemView[]> {
  const supabase = createClient();
  const itemType = TAB_TO_ITEM_TYPE[tab];

  const { data: items, error } = await supabase
    .from("library_items")
    .select("*")
    .eq("item_type", itemType)
    .order("saved_at", { ascending: false });
  if (error) throw error;
  if (!items || items.length === 0) return [];

  switch (tab) {
    case "submissions":
      return joinSubmissions(supabase, items);
    case "reports":
      return joinReports(supabase, items);
    case "problems":
      return joinProblems(supabase, items);
    case "exports":
      return joinExports(supabase, items);
    default: {
      const _exhaustive: never = tab;
      return _exhaustive;
    }
  }
}

async function joinSubmissions(
  supabase: BrowserClient,
  items: LibraryItemRow[],
): Promise<LibrarySubmissionView[]> {
  const ids = uniqueIds(items.map((row) => row.submission_id));
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("writing_submissions")
    .select(
      "id, problem_id, question_no, submitted_at, char_count, question_snapshot",
    )
    .in("id", ids);
  if (error) throw error;

  const { data: historyRows, error: historyError } = await supabase.rpc(
    "get_writing_submission_history_context",
    { p_submission_ids: ids },
  );
  if (historyError) throw historyError;

  const byId = new Map((data ?? []).map((row) => [row.id, row]));
  const historyTitleBySubmissionId = new Map(
    ((historyRows ?? []) as WritingSubmissionHistoryRow[]).map((row) => [
      row.submission_id,
      row.title,
    ]),
  );
  const out: LibrarySubmissionView[] = [];
  for (const item of items) {
    if (!item.submission_id) continue;
    const sub = byId.get(item.submission_id);
    if (!sub) continue;
    out.push({
      kind: "submission",
      id: sub.id,
      problem_id: sub.problem_id,
      problem_title:
        questionSnapshotTitle(sub.question_snapshot) ??
        historyTitleBySubmissionId.get(sub.id) ??
        null,
      question_no: typeof sub.question_no === "number" ? sub.question_no : null,
      submitted_at: sub.submitted_at,
      char_count: sub.char_count,
      item_id: item.id,
      saved_at: item.saved_at,
      tags: item.tags,
    });
  }
  return out;
}

function questionSnapshotTitle(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }
  const title = (snapshot as Record<string, unknown>).title;
  return typeof title === "string" && title.trim() ? title : null;
}

async function joinReports(
  supabase: BrowserClient,
  items: LibraryItemRow[],
): Promise<LibraryReportView[]> {
  const ids = uniqueIds(items.map((row) => row.report_id));
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("comparison_reports")
    .select("id, generated_at, narrative")
    .in("id", ids);
  if (error) throw error;
  const byId = new Map((data ?? []).map((row) => [row.id, row]));
  const out: LibraryReportView[] = [];
  for (const item of items) {
    if (!item.report_id) continue;
    const rep = byId.get(item.report_id);
    if (!rep) continue;
    out.push({
      kind: "report",
      id: rep.id,
      generated_at: rep.generated_at,
      narrative_excerpt: excerptNarrative(rep.narrative),
      item_id: item.id,
      tags: item.tags,
    });
  }
  return out;
}

async function joinProblems(
  supabase: BrowserClient,
  items: LibraryItemRow[],
): Promise<LibraryProblemView[]> {
  const ids = uniqueIds(items.map((row) => row.problem_id));
  if (ids.length === 0) return [];
  const { data, error } = await supabase.rpc("list_user_library_problem_items");
  if (error) throw error;
  const rows = (data ?? []) as LibraryProblemRpcRow[];
  const out: LibraryProblemView[] = [];
  for (const row of rows) {
    const problemId = row.problem_id ?? row.item_id;
    out.push({
      kind: "problem",
      id: problemId,
      title: row.title ?? null,
      question_no: typeof row.question_no === "number" ? row.question_no : null,
      answer_text: row.answer_text ?? null,
      item_id: row.item_id,
      saved_at: row.saved_at,
      tags: Array.isArray(row.tags) ? row.tags : [],
      availabilityStatus: coerceLibraryProblemAvailabilityStatus(
        row.availability_status,
      ),
      availabilityReason: row.availability_reason ?? null,
      canRetry: row.can_retry === true,
    });
  }
  return out;
}

async function joinExports(
  supabase: BrowserClient,
  items: LibraryItemRow[],
): Promise<LibraryExportView[]> {
  const ids = uniqueIds(items.map((row) => row.export_id));
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("export_files")
    .select("id, source_type, source_id, storage_path, status, options")
    .in("id", ids);
  if (error) throw error;
  const byId = new Map((data ?? []).map((row) => [row.id, row]));
  const out: LibraryExportView[] = [];
  for (const item of items) {
    if (!item.export_id) continue;
    const exp = byId.get(item.export_id);
    if (!exp) continue;
    out.push({
      kind: "export",
      id: exp.id,
      source_type: exp.source_type,
      source_id: exp.source_id,
      storage_path: exp.storage_path,
      status: exp.status,
      options: exp.options,
      item_id: item.id,
      tags: item.tags,
    });
  }
  return out;
}

function uniqueIds(values: Array<string | null>): string[] {
  const set = new Set<string>();
  for (const v of values) {
    if (v) set.add(v);
  }
  return Array.from(set);
}

export function useLibraryItems(tab: LibraryTab) {
  return useQuery({
    queryKey: libraryItemsKey(tab),
    queryFn: () => fetchLibraryItems(tab),
  });
}
