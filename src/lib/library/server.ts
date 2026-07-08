// NOTE: This module is server-only by convention — only consumed by RSC /
// server actions / route handlers. We intentionally do not `import "server-only"`
// here because the `server-only` runtime guard is not a runtime dep of this
// project and vitest can't resolve it. Importers must keep the server-only
// boundary themselves (no "use client" file should import from this path).
import {
  createSupabaseServerClient,
  type SupabaseServerClient,
} from "../supabase/server";
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

type ClientFactory = () => Promise<SupabaseServerClient>;

type LibraryProblemRpcRow = {
  item_id: string;
  problem_id: string | null;
  title: string | null;
  question_no: number | null;
  tags: string[] | null;
  saved_at: string;
  availability_status: string | null;
  availability_reason: string | null;
  can_retry: boolean | null;
};

/**
 * Fetch the user's saved library items for one tab.
 *
 * Strategy: pull `library_items` filtered by `user_id` + `item_type`, then
 * load the underlying entities in a single follow-up query and join in JS.
 * We deliberately avoid Supabase nested select syntax — the FK names differ
 * per item_type, and a JS-side join keeps the policy ownership invariants
 * obvious + the query shape stable across tabs.
 *
 * RLS:
 *   - `library_items_owner_select` restricts to `user_id = auth.uid()`.
 *   - The underlying entity selects re-validate ownership via their own
 *     policies (writing_submissions owner, comparison_reports owner, etc.).
 *   - Problems table uses `publish_status='published'` access for non-authors.
 */
export async function listLibraryItems(
  userId: string,
  tab: LibraryTab,
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<LibraryItemView[]> {
  const supabase = await createClient();
  const itemType = TAB_TO_ITEM_TYPE[tab];

  const { data: items, error } = await supabase
    .from("library_items")
    .select("*")
    .eq("user_id", userId)
    .eq("item_type", itemType)
    .order("saved_at", { ascending: false });
  if (error) throw new Error(`listLibraryItems(${tab}): ${error.message}`);
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

export async function isSubmissionSavedToLibrary(
  userId: string,
  submissionId: string,
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("library_items")
    .select("id")
    .eq("user_id", userId)
    .eq("item_type", "submission")
    .eq("submission_id", submissionId)
    .maybeSingle();

  if (error) {
    throw new Error(`isSubmissionSavedToLibrary: ${error.message}`);
  }

  return Boolean(data);
}

async function joinSubmissions(
  supabase: SupabaseServerClient,
  items: LibraryItemRow[],
): Promise<LibrarySubmissionView[]> {
  const ids = uniqueIds(items.map((row) => row.submission_id));
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("writing_submissions")
    .select("id, problem_id, question_no, submitted_at, char_count")
    .in("id", ids);
  if (error) {
    throw new Error(`listLibraryItems(submissions) join: ${error.message}`);
  }

  const problemIds = uniqueIds((data ?? []).map((row) => row.problem_id));
  const { data: problems, error: problemError } = await supabase
    .from("problems")
    .select("id, title")
    .in("id", problemIds);
  if (problemError) {
    throw new Error(
      `listLibraryItems(submissions) problem join: ${problemError.message}`,
    );
  }

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
      saved_at: item.saved_at,
      tags: item.tags,
    });
  }
  return out;
}

async function joinReports(
  supabase: SupabaseServerClient,
  items: LibraryItemRow[],
): Promise<LibraryReportView[]> {
  const ids = uniqueIds(items.map((row) => row.report_id));
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("comparison_reports")
    .select("id, generated_at, narrative")
    .in("id", ids);
  if (error) {
    throw new Error(`listLibraryItems(reports) join: ${error.message}`);
  }

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
  supabase: SupabaseServerClient,
  items: LibraryItemRow[],
): Promise<LibraryProblemView[]> {
  const ids = uniqueIds(items.map((row) => row.problem_id));
  if (ids.length === 0) return [];

  const { data, error } = await supabase.rpc("list_user_library_problem_items");
  if (error) {
    throw new Error(`listLibraryItems(problems) join: ${error.message}`);
  }

  const rows = (data ?? []) as LibraryProblemRpcRow[];
  const out: LibraryProblemView[] = [];
  for (const row of rows) {
    const problemId = row.problem_id ?? row.item_id;
    out.push({
      kind: "problem",
      id: problemId,
      title: row.title ?? null,
      question_no: typeof row.question_no === "number" ? row.question_no : null,
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
  supabase: SupabaseServerClient,
  items: LibraryItemRow[],
): Promise<LibraryExportView[]> {
  const ids = uniqueIds(items.map((row) => row.export_id));
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("export_files")
    .select("id, source_type, source_id, storage_path, status, options")
    .in("id", ids);
  if (error) {
    throw new Error(`listLibraryItems(exports) join: ${error.message}`);
  }

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
