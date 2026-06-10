"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "../supabase/browser";
import {
  TAB_TO_ITEM_TYPE,
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
    .select("id, problem_id, question_no, submitted_at, char_count")
    .in("id", ids);
  if (error) throw error;

  const problemIds = uniqueIds((data ?? []).map((row) => row.problem_id));
  const { data: problems, error: problemError } = await supabase
    .from("problems")
    .select("id, title")
    .in("id", problemIds);
  if (problemError) throw problemError;

  const byId = new Map((data ?? []).map((row) => [row.id, row]));
  const problemTitleById = new Map(
    (problems ?? []).map((row) => [row.id, row.title]),
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
      problem_title: problemTitleById.get(sub.problem_id) ?? null,
      question_no: typeof sub.question_no === "number" ? sub.question_no : null,
      submitted_at: sub.submitted_at,
      char_count: sub.char_count,
      item_id: item.id,
      tags: item.tags,
    });
  }
  return out;
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
  const { data, error } = await supabase
    .from("problems")
    .select("id, title, question_no")
    .in("id", ids);
  if (error) throw error;
  const byId = new Map((data ?? []).map((row) => [row.id, row]));
  const out: LibraryProblemView[] = [];
  for (const item of items) {
    if (!item.problem_id) continue;
    const prob = byId.get(item.problem_id);
    if (!prob) continue;
    out.push({
      kind: "problem",
      id: prob.id,
      title: prob.title,
      question_no: typeof prob.question_no === "number" ? prob.question_no : null,
      item_id: item.id,
      tags: item.tags,
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
    .select("id, source_type, storage_path, status, options")
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
