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
  problem_title: string | null;
  question_no: number | null;
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

export type LibraryProblemAvailabilityStatus =
  | "available"
  | "soft_unavailable"
  | "hard_unavailable";

export type LibraryProblemView = {
  kind: "problem";
  /** Underlying `problems.id`. */
  id: string;
  title: string | null;
  question_no: number | null;
  item_id: string;
  tags: string[];
  availabilityStatus: LibraryProblemAvailabilityStatus;
  availabilityReason: string | null;
  canRetry: boolean;
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

export type LibraryDashboardReviewReason =
  | "length_off_target"
  | "comparison_available"
  | "low_dimension"
  | "feedback_ready"
  | "short_answer";

export type LibraryDashboardFeedbackWaitingStatus =
  | "pending"
  | "analyzing"
  | "failed";

export type LibraryDashboardTimelineEventType =
  | "submission_submitted"
  | "feedback_viewed"
  | "report_viewed"
  | "export_downloaded";

export type LibraryDashboardDimension =
  Tables<"feedback_dimension_scores">["dimension"];

export type LibraryDashboardKpis = {
  reviewableCount: number;
  feedbackWaitingCount: number;
  comparisonAvailableCount: number;
  recentSubmissionDate: string | null;
};

export type LibraryDashboardWeakDimension = {
  dimension: LibraryDashboardDimension;
  normalizedScore: number;
  score: number;
  scoreMax: number;
};

export type LibraryReviewCandidate = {
  id: string;
  itemId: string;
  submissionId: string;
  problemId: string;
  questionNo: number | null;
  title: string;
  submittedAt: string;
  charCount: number;
  feedbackHref: string;
  retryHref: string;
  primaryReason: LibraryDashboardReviewReason;
  reasons: LibraryDashboardReviewReason[];
  hasRewrite: boolean;
  lowestDimension?: LibraryDashboardWeakDimension;
  lengthTarget?: {
    min: number;
    max: number;
    status: "under" | "over";
  };
};

export type LibraryFeedbackWaitingItem = {
  id: string;
  submissionId: string;
  problemId: string;
  questionNo: number | null;
  title: string;
  submittedAt: string;
  charCount: number;
  status: LibraryDashboardFeedbackWaitingStatus;
  retryHref: string;
};

export type LibraryWeakItem = LibraryDashboardWeakDimension & {
  id: string;
  submissionId: string;
  problemId: string;
  questionNo: number | null;
  title: string;
  submittedAt: string;
};

export type LibraryTimelineItem = {
  id: string;
  eventType: LibraryDashboardTimelineEventType;
  occurredAt: string;
  problemId: string | null;
  submissionId: string | null;
  questionNo: number | null;
  title: string;
};

export type LibraryDashboardView = {
  kpis: LibraryDashboardKpis;
  reviewCandidates: LibraryReviewCandidate[];
  feedbackWaiting: LibraryFeedbackWaitingItem[];
  weakItems: LibraryWeakItem[];
  timeline: LibraryTimelineItem[];
};

/** Narrowing helper for excerpting comparison report narratives. */
export const REPORT_NARRATIVE_EXCERPT_LEN = 160;

export function excerptNarrative(narrative: string | null): string | null {
  if (!narrative) return null;
  if (narrative.length <= REPORT_NARRATIVE_EXCERPT_LEN) return narrative;
  return `${narrative.slice(0, REPORT_NARRATIVE_EXCERPT_LEN)}...`;
}

export function coerceLibraryProblemAvailabilityStatus(
  value: unknown,
): LibraryProblemAvailabilityStatus {
  if (
    value === "available" ||
    value === "soft_unavailable" ||
    value === "hard_unavailable"
  ) {
    return value;
  }
  return "hard_unavailable";
}
