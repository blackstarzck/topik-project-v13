import type { Tables, TablesInsert, TablesUpdate } from "../supabase/types";

/**
 * Library domain — Phase 6.
 *
 * The `library_items` table is a polymorphic ledger: each row points to one
 * of `submission` / `report` / `problem` / `export` (and `attempt`, which is
 * not surfaced in Phase 6). The four tabs below mirror the four item_types
 * exposed in the Phase 6 UI.
 */

export type LibraryTab = "submissions" | "reports" | "problems" | "exports";

export const LIBRARY_TABS: readonly LibraryTab[] = [
  "submissions",
  "reports",
  "problems",
  "exports",
];

export type LibraryItemRow = Tables<"library_items">;
export type LibraryItemInsert = TablesInsert<"library_items">;
export type LibraryItemUpdate = TablesUpdate<"library_items">;

export type LibraryItemType = LibraryItemRow["item_type"];

/**
 * Map a UI tab to the underlying `library_items.item_type` value. Kept as a
 * narrow record so the compiler enforces full coverage.
 */
export const TAB_TO_ITEM_TYPE: Record<
  LibraryTab,
  Exclude<LibraryItemType, "attempt">
> = {
  submissions: "submission",
  reports: "report",
  problems: "problem",
  exports: "export",
};

export type LibrarySubmissionView = {
  kind: "submission";
  /** Underlying `writing_submissions.id`. */
  id: string;
  problem_id: string;
  submitted_at: string;
  char_count: number;
  /** `library_items.id` — the saved-ledger row, used for delete/tag mutations. */
  item_id: string;
  tags: string[];
};

export type LibraryReportView = {
  kind: "report";
  /** Underlying `comparison_reports.id`. */
  id: string;
  generated_at: string;
  /** First ~160 chars of `comparison_reports.narrative` for the row preview. */
  narrative_excerpt: string | null;
  item_id: string;
  tags: string[];
};

export type LibraryProblemView = {
  kind: "problem";
  /** Underlying `problems.id`. */
  id: string;
  title: string;
  item_id: string;
  tags: string[];
};

export type LibraryExportView = {
  kind: "export";
  /** Underlying `export_files.id`. */
  id: string;
  source_type: Tables<"export_files">["source_type"];
  storage_path: string;
  status: Tables<"export_files">["status"];
  options: Tables<"export_files">["options"];
  item_id: string;
  tags: string[];
};

export type LibraryItemView =
  | LibrarySubmissionView
  | LibraryReportView
  | LibraryProblemView
  | LibraryExportView;

/** Narrowing helper for excerpting comparison report narratives. */
export const REPORT_NARRATIVE_EXCERPT_LEN = 160;

export function excerptNarrative(narrative: string | null): string | null {
  if (!narrative) return null;
  if (narrative.length <= REPORT_NARRATIVE_EXCERPT_LEN) return narrative;
  return `${narrative.slice(0, REPORT_NARRATIVE_EXCERPT_LEN)}…`;
}
