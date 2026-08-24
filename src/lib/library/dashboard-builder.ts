// Pure dashboard assembly rules. Keep this module free of server client imports.
import type { Tables } from "../supabase/types";
import { writingProblemHref } from "../writing/routes";
import { buildLibraryDashboardReview } from "./dashboard-review";
import { parseLibraryDashboardTimelineEvent } from "./dashboard-timeline";
import type {
  ComparisonReportDashboardRow,
  ExportFileDashboardRow,
  StudyEventDashboardRow,
  TimelineSubmissionRow,
} from "./dashboard-timeline";
import type {
  LibraryDashboardFeedbackWaitingStatus,
  LibraryDashboardView,
} from "./types";

/** @internal */
export type LibraryItemDashboardRow = Pick<
  Tables<"library_items">,
  "id" | "item_type" | "problem_id" | "saved_at" | "submission_id"
>;

/** @internal */
export type SubmissionDashboardRow = Pick<
  Tables<"writing_submissions">,
  | "id"
  | "problem_id"
  | "question_no"
  | "char_count"
  | "submitted_at"
  | "feedback_status"
  | "parent_submission_id"
> & { history_title?: string | null };

/** @internal */
export type FeedbackDashboardRow = Pick<
  Tables<"writing_feedback">,
  "submission_id" | "status" | "score_total" | "score_max" | "generated_at"
>;

/** @internal */
export type DimensionScoreDashboardRow = Pick<
  Tables<"feedback_dimension_scores">,
  | "id"
  | "submission_id"
  | "dimension"
  | "score"
  | "score_max"
  | "summary"
  | "weakness_level"
>;

/** @internal */
export type ProblemDashboardRow = Pick<
  Tables<"problems">,
  "id" | "question_no" | "title" | "difficulty"
>;

/** @internal */
export type NonWritingProblemDashboardRow = ProblemDashboardRow &
  Pick<
    Tables<"problems">,
    "publish_status" | "visibility" | "lifecycle_status"
  >;

/** @internal */
export type SubmissionProblemRow = Pick<
  Tables<"writing_submissions">,
  "id" | "problem_id" | "question_no" | "parent_submission_id"
>;

/** @internal */
export type WritingSubmissionHistoryRow = {
  submission_id: string;
  title: string | null;
};

export type LibraryDashboardRows = {
  libraryItems: LibraryItemDashboardRow[];
  submissions: SubmissionDashboardRow[];
  feedback: FeedbackDashboardRow[];
  dimensionScores: DimensionScoreDashboardRow[];
  problems: ProblemDashboardRow[];
  allSubmissions: SubmissionProblemRow[];
  timelineSubmissions?: TimelineSubmissionRow[];
  studyEvents: StudyEventDashboardRow[];
  comparisonReports?: ComparisonReportDashboardRow[];
  exportFiles?: ExportFileDashboardRow[];
  visibleProblemIds?: string[];
};

const FEEDBACK_WAITING_LIMIT = 2;
const TIMELINE_LIMIT = 4;

export function buildLibraryDashboardFromRows(
  rows: LibraryDashboardRows,
): LibraryDashboardView {
  const savedSubmissionItems = rows.libraryItems.filter(
    (item) => item.item_type === "submission" && Boolean(item.submission_id),
  );
  const submissionsById = new Map(rows.submissions.map((row) => [row.id, row]));
  const timelineSubmissionsById = new Map<string, TimelineSubmissionRow>();
  for (const row of rows.allSubmissions) {
    timelineSubmissionsById.set(row.id, row);
  }
  for (const row of rows.timelineSubmissions ?? []) {
    timelineSubmissionsById.set(row.id, row);
  }
  for (const row of rows.submissions) {
    timelineSubmissionsById.set(row.id, row);
  }
  const feedbackBySubmissionId = new Map(
    rows.feedback.map((row) => [row.submission_id, row]),
  );
  const problemsById = new Map(rows.problems.map((row) => [row.id, row]));
  const comparisonReportsById = new Map(
    (rows.comparisonReports ?? []).map((row) => [row.id, row]),
  );
  const exportFilesById = new Map(
    (rows.exportFiles ?? []).map((row) => [row.id, row]),
  );
  const visibleProblemIds = rows.visibleProblemIds
    ? new Set(rows.visibleProblemIds)
    : null;
  const dimensionsBySubmissionId = groupDimensions(rows.dimensionScores);
  const submissionProblemCounts = countSubmissionsByProblem(
    rows.allSubmissions.length > 0
      ? rows.allSubmissions
      : rows.submissions.map((row) => ({
          id: row.id,
          problem_id: row.problem_id,
          question_no: row.question_no,
          parent_submission_id: row.parent_submission_id,
        })),
  );

  const savedRows = savedSubmissionItems
    .map((item) => {
      const submission = item.submission_id
        ? submissionsById.get(item.submission_id)
        : undefined;
      if (!submission) return null;
      return {
        item,
        submission,
        feedback: feedbackBySubmissionId.get(submission.id) ?? null,
        problem: problemsById.get(submission.problem_id) ?? null,
        dimensions: dimensionsBySubmissionId.get(submission.id) ?? [],
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const completeSavedRows = savedRows.filter(
    (row) =>
      row.submission.feedback_status === "complete" &&
      row.feedback?.status === "complete",
  );

  const feedbackWaitingRows = savedRows.filter((row) =>
    isFeedbackWaiting(
      row.submission.feedback_status,
      row.feedback?.status ?? null,
    ),
  );

  const { reviewCandidates, weakItems, comparisonAvailableCount } =
    buildLibraryDashboardReview({
      items: completeSavedRows.map((row) => ({
        itemId: row.item.id,
        submissionId: row.submission.id,
        problemId: row.submission.problem_id,
        questionNo: row.submission.question_no,
        title: submissionTitle(row.submission, row.problem),
        submittedAt: row.submission.submitted_at,
        charCount: row.submission.char_count,
        parentSubmissionId: row.submission.parent_submission_id,
        problemDifficulty: row.problem?.difficulty ?? null,
        submissionCountForProblem:
          submissionProblemCounts.get(row.submission.problem_id) ?? 0,
        feedback: row.feedback
          ? {
              scoreTotal: row.feedback.score_total,
              scoreMax: row.feedback.score_max,
            }
          : null,
        dimensions: row.dimensions.map((dimension) => ({
          id: dimension.id,
          dimension: dimension.dimension,
          score: dimension.score,
          scoreMax: dimension.score_max,
        })),
      })),
      visibleProblemIds: rows.visibleProblemIds ?? null,
    });

  const sortedFeedbackWaiting = feedbackWaitingRows
    .map((row) => ({
      id: row.item.id,
      submissionId: row.submission.id,
      problemId: row.submission.problem_id,
      questionNo: row.submission.question_no,
      title: submissionTitle(row.submission, row.problem),
      submittedAt: row.submission.submitted_at,
      charCount: row.submission.char_count,
      status: feedbackWaitingStatus(
        row.submission.feedback_status,
        row.feedback?.status ?? null,
      ),
      retryHref:
        visibleProblemIds === null ||
        visibleProblemIds.has(row.submission.problem_id)
          ? writingProblemHref({
              questionNo: row.submission.question_no,
              problemId: row.submission.problem_id,
              fresh: true,
              returnTo: "/library",
              retrySubmissionId: row.submission.id,
            })
          : null,
    }))
    .sort((a, b) => compareIsoDesc(a.submittedAt, b.submittedAt));

  const feedbackWaiting = sortedFeedbackWaiting.slice(
    0,
    FEEDBACK_WAITING_LIMIT,
  );

  const feedbackWaitingSyncTargets = sortedFeedbackWaiting.flatMap((item) =>
    isInitialSyncTargetStatus(item.status)
      ? [
          {
            itemId: item.id,
            submissionId: item.submissionId,
            initialStatus: item.status,
          },
        ]
      : [],
  );

  const timeline = rows.studyEvents
    .map((event) => {
      const parsed = parseLibraryDashboardTimelineEvent(event, {
        comparisonReportsById,
        exportFilesById,
      });
      return parsed ? { event, parsed } : null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => compareIsoDesc(a.event.occurred_at, b.event.occurred_at))
    .slice(0, TIMELINE_LIMIT)
    .map(({ event, parsed }) => {
      const submissionId = parsed.submissionId;
      const submission = submissionId
        ? timelineSubmissionsById.get(submissionId)
        : undefined;
      const problemId =
        event.problem_id ??
        submission?.problem_id ??
        parsed.payloadProblemId ??
        null;
      const problem = problemId ? (problemsById.get(problemId) ?? null) : null;
      const questionNo =
        submission?.question_no ??
        problem?.question_no ??
        parsed.payloadQuestionNo ??
        null;
      return {
        id: event.id,
        eventType: parsed.eventType,
        occurredAt: event.occurred_at,
        problemId,
        submissionId,
        questionNo,
        title: submission?.history_title ?? problemTitle(problem, questionNo),
      };
    });

  return {
    kpis: {
      reviewableCount: completeSavedRows.length,
      feedbackWaitingCount: feedbackWaitingRows.length,
      comparisonAvailableCount,
      recentSubmissionDate: mostRecentIso(
        savedRows.map((row) => row.submission.submitted_at),
      ),
    },
    reviewCandidates,
    feedbackWaiting,
    feedbackWaitingSyncTargets,
    weakItems,
    timeline,
  };
}

function groupDimensions(rows: DimensionScoreDashboardRow[]) {
  const map = new Map<string, DimensionScoreDashboardRow[]>();
  for (const row of rows) {
    const list = map.get(row.submission_id) ?? [];
    list.push(row);
    map.set(row.submission_id, list);
  }
  return map;
}

function countSubmissionsByProblem(rows: SubmissionProblemRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.problem_id, (counts.get(row.problem_id) ?? 0) + 1);
  }
  return counts;
}

function isFeedbackWaiting(
  submissionStatus: SubmissionDashboardRow["feedback_status"],
  feedbackStatus: FeedbackDashboardRow["status"] | null,
) {
  return (
    submissionStatus === "pending" ||
    submissionStatus === "analyzing" ||
    submissionStatus === "failed" ||
    feedbackStatus === "failed"
  );
}

function feedbackWaitingStatus(
  submissionStatus: SubmissionDashboardRow["feedback_status"],
  feedbackStatus: FeedbackDashboardRow["status"] | null,
): LibraryDashboardFeedbackWaitingStatus {
  if (submissionStatus === "failed" || feedbackStatus === "failed") {
    return "failed";
  }
  if (submissionStatus === "analyzing") return "analyzing";
  return "pending";
}

function isInitialSyncTargetStatus(
  status: LibraryDashboardFeedbackWaitingStatus,
): status is "pending" | "analyzing" {
  return status === "pending" || status === "analyzing";
}

function problemTitle(
  problem: ProblemDashboardRow | null | undefined,
  questionNo: number | null | undefined,
) {
  if (problem?.title) return problem.title;
  return questionNo ? `${questionNo}번 문제` : "저장 답안";
}

function submissionTitle(
  submission: Pick<SubmissionDashboardRow, "question_no" | "history_title">,
  problem: ProblemDashboardRow | null | undefined,
) {
  return (
    submission.history_title ?? problemTitle(problem, submission.question_no)
  );
}

function mostRecentIso(values: string[]) {
  const sorted = values.filter(Boolean).sort(compareIsoDesc);
  return sorted[0] ?? null;
}

function compareIsoDesc(a: string, b: string) {
  return new Date(b).getTime() - new Date(a).getTime();
}
