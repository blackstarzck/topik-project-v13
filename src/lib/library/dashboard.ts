// NOTE: Server-only by convention. The exported pure builder is intentionally
// testable without a Supabase client; RSC callers should use getLibraryDashboard.
import {
  createSupabaseServerClient,
  type SupabaseServerClient,
} from "../supabase/server";
import type { Tables } from "../supabase/types";
import { writingFeedbackHref, writingProblemHref } from "../writing/routes";
import type {
  LibraryDashboardFeedbackWaitingStatus,
  LibraryDashboardReviewReason,
  LibraryDashboardTimelineEventType,
  LibraryDashboardView,
  LibraryReviewCandidate,
  LibraryWeakItem,
} from "./types";

type LibraryItemDashboardRow = Pick<
  Tables<"library_items">,
  "id" | "item_type" | "problem_id" | "saved_at" | "submission_id"
>;

type SubmissionDashboardRow = Pick<
  Tables<"writing_submissions">,
  | "id"
  | "problem_id"
  | "question_no"
  | "char_count"
  | "submitted_at"
  | "feedback_status"
  | "parent_submission_id"
>;

type FeedbackDashboardRow = Pick<
  Tables<"writing_feedback">,
  "submission_id" | "status" | "score_total" | "score_max" | "generated_at"
>;

type DimensionScoreDashboardRow = Pick<
  Tables<"feedback_dimension_scores">,
  | "id"
  | "submission_id"
  | "dimension"
  | "score"
  | "score_max"
  | "summary"
  | "weakness_level"
>;

type ProblemDashboardRow = Pick<
  Tables<"problems">,
  "id" | "question_no" | "title" | "difficulty"
>;

type SubmissionProblemRow = Pick<
  Tables<"writing_submissions">,
  "id" | "problem_id" | "parent_submission_id"
>;

type StudyEventDashboardRow = Pick<
  Tables<"study_events">,
  "id" | "event_type" | "occurred_at" | "problem_id" | "submission_id"
>;

export type LibraryDashboardRows = {
  libraryItems: LibraryItemDashboardRow[];
  submissions: SubmissionDashboardRow[];
  feedback: FeedbackDashboardRow[];
  dimensionScores: DimensionScoreDashboardRow[];
  problems: ProblemDashboardRow[];
  allSubmissions: SubmissionProblemRow[];
  studyEvents: StudyEventDashboardRow[];
};

type ClientFactory = () => Promise<SupabaseServerClient>;

const REVIEW_CANDIDATE_LIMIT = 12;
const FEEDBACK_WAITING_LIMIT = 2;
const WEAK_ITEMS_LIMIT = 3;
const TIMELINE_LIMIT = 4;
const LOW_DIMENSION_THRESHOLD = 70;
const SHORT_ANSWER_CHAR_LIMIT = 30;

const TIMELINE_EVENT_TYPES = [
  "submission_submitted",
  "feedback_viewed",
  "report_viewed",
  "export_downloaded",
] as const satisfies readonly LibraryDashboardTimelineEventType[];

export async function getLibraryDashboard(
  userId: string,
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<LibraryDashboardView> {
  const supabase = await createClient();

  const { data: libraryItems, error: libraryError } = await supabase
    .from("library_items")
    .select("id, item_type, problem_id, saved_at, submission_id")
    .eq("user_id", userId)
    .order("saved_at", { ascending: false });
  if (libraryError) {
    throw new Error(`getLibraryDashboard(library_items): ${libraryError.message}`);
  }

  const savedSubmissionIds = uniqueIds(
    (libraryItems ?? [])
      .filter((item) => item.item_type === "submission")
      .map((item) => item.submission_id),
  );

  const [
    submissions,
    feedback,
    dimensionScores,
    allSubmissions,
    studyEvents,
  ] = await Promise.all([
    fetchSavedSubmissions(supabase, savedSubmissionIds),
    fetchFeedback(supabase, savedSubmissionIds),
    fetchDimensionScores(supabase, savedSubmissionIds),
    fetchAllSubmissionProblemRows(supabase, userId),
    fetchTimelineEvents(supabase, userId),
  ]);

  const problemIds = uniqueIds([
    ...submissions.map((row) => row.problem_id),
    ...(libraryItems ?? []).map((row) => row.problem_id),
    ...studyEvents.map((row) => row.problem_id),
  ]);
  const problems = await fetchProblems(supabase, problemIds);

  return buildLibraryDashboardFromRows({
    libraryItems: (libraryItems ?? []) as LibraryItemDashboardRow[],
    submissions,
    feedback,
    dimensionScores,
    problems,
    allSubmissions,
    studyEvents,
  });
}

export function buildLibraryDashboardFromRows(
  rows: LibraryDashboardRows,
): LibraryDashboardView {
  const savedSubmissionItems = rows.libraryItems.filter(
    (item) => item.item_type === "submission" && Boolean(item.submission_id),
  );
  const submissionsById = new Map(rows.submissions.map((row) => [row.id, row]));
  const feedbackBySubmissionId = new Map(
    rows.feedback.map((row) => [row.submission_id, row]),
  );
  const problemsById = new Map(rows.problems.map((row) => [row.id, row]));
  const dimensionsBySubmissionId = groupDimensions(rows.dimensionScores);
  const submissionProblemCounts = countSubmissionsByProblem(
    rows.allSubmissions.length > 0
      ? rows.allSubmissions
      : rows.submissions.map((row) => ({
          id: row.id,
          problem_id: row.problem_id,
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
    isFeedbackWaiting(row.submission.feedback_status, row.feedback?.status ?? null),
  );

  const reviewCandidates = completeSavedRows
    .map((row) =>
      buildReviewCandidate(
        row.item,
        row.submission,
        row.feedback,
        row.problem,
        row.dimensions,
        hasRewrite(row.submission, submissionProblemCounts),
      ),
    )
    .sort(sortCandidates)
    .slice(0, REVIEW_CANDIDATE_LIMIT);

  const feedbackWaiting = feedbackWaitingRows
    .map((row) => ({
      id: row.item.id,
      submissionId: row.submission.id,
      problemId: row.submission.problem_id,
      questionNo: row.submission.question_no,
      title: problemTitle(row.problem, row.submission.question_no),
      submittedAt: row.submission.submitted_at,
      charCount: row.submission.char_count,
      status: feedbackWaitingStatus(
        row.submission.feedback_status,
        row.feedback?.status ?? null,
      ),
      retryHref: writingProblemHref({
        questionNo: row.submission.question_no,
        problemId: row.submission.problem_id,
        fresh: true,
        retrySubmissionId: row.submission.id,
      }),
    }))
    .sort((a, b) => compareIsoDesc(a.submittedAt, b.submittedAt))
    .slice(0, FEEDBACK_WAITING_LIMIT);

  const weakItems = buildWeakItems(completeSavedRows);
  const timeline = rows.studyEvents
    .filter((event) => isTimelineEventType(event.event_type))
    .sort((a, b) => compareIsoDesc(a.occurred_at, b.occurred_at))
    .slice(0, TIMELINE_LIMIT)
    .map((event) => {
      const submission = event.submission_id
        ? submissionsById.get(event.submission_id)
        : undefined;
      const problemId = event.problem_id ?? submission?.problem_id ?? null;
      const problem = problemId ? problemsById.get(problemId) ?? null : null;
      return {
        id: event.id,
        eventType: event.event_type as LibraryDashboardTimelineEventType,
        occurredAt: event.occurred_at,
        problemId,
        submissionId: event.submission_id,
        questionNo: submission?.question_no ?? problem?.question_no ?? null,
        title: problemTitle(problem, submission?.question_no ?? problem?.question_no),
      };
    });

  return {
    kpis: {
      reviewableCount: completeSavedRows.length,
      feedbackWaitingCount: feedbackWaitingRows.length,
      comparisonAvailableCount: completeSavedRows.filter((row) =>
        hasRewrite(row.submission, submissionProblemCounts),
      ).length,
      recentSubmissionDate: mostRecentIso(
        savedRows.map((row) => row.submission.submitted_at),
      ),
    },
    reviewCandidates,
    feedbackWaiting,
    weakItems,
    timeline,
  };
}

async function fetchSavedSubmissions(
  supabase: SupabaseServerClient,
  ids: string[],
): Promise<SubmissionDashboardRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("writing_submissions")
    .select(
      "id, problem_id, question_no, char_count, submitted_at, feedback_status, parent_submission_id",
    )
    .in("id", ids);
  if (error) {
    throw new Error(`getLibraryDashboard(writing_submissions): ${error.message}`);
  }
  return (data ?? []) as SubmissionDashboardRow[];
}

async function fetchFeedback(
  supabase: SupabaseServerClient,
  ids: string[],
): Promise<FeedbackDashboardRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("writing_feedback")
    .select("submission_id, status, score_total, score_max, generated_at")
    .in("submission_id", ids);
  if (error) {
    throw new Error(`getLibraryDashboard(writing_feedback): ${error.message}`);
  }
  return (data ?? []) as FeedbackDashboardRow[];
}

async function fetchDimensionScores(
  supabase: SupabaseServerClient,
  ids: string[],
): Promise<DimensionScoreDashboardRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("feedback_dimension_scores")
    .select("id, submission_id, dimension, score, score_max, summary, weakness_level")
    .in("submission_id", ids);
  if (error) {
    throw new Error(
      `getLibraryDashboard(feedback_dimension_scores): ${error.message}`,
    );
  }
  return (data ?? []) as DimensionScoreDashboardRow[];
}

async function fetchAllSubmissionProblemRows(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<SubmissionProblemRow[]> {
  const { data, error } = await supabase
    .from("writing_submissions")
    .select("id, problem_id, parent_submission_id")
    .eq("user_id", userId)
    .order("submitted_at", { ascending: false })
    .limit(500);
  if (error) {
    throw new Error(
      `getLibraryDashboard(all writing_submissions): ${error.message}`,
    );
  }
  return (data ?? []) as SubmissionProblemRow[];
}

async function fetchTimelineEvents(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<StudyEventDashboardRow[]> {
  const { data, error } = await supabase
    .from("study_events")
    .select("id, event_type, occurred_at, problem_id, submission_id")
    .eq("user_id", userId)
    .in("event_type", [...TIMELINE_EVENT_TYPES])
    .order("occurred_at", { ascending: false })
    .limit(12);
  if (error) {
    throw new Error(`getLibraryDashboard(study_events): ${error.message}`);
  }
  return (data ?? []) as StudyEventDashboardRow[];
}

async function fetchProblems(
  supabase: SupabaseServerClient,
  ids: string[],
): Promise<ProblemDashboardRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("problems")
    .select("id, question_no, title, difficulty")
    .in("id", ids);
  if (error) {
    throw new Error(`getLibraryDashboard(problems): ${error.message}`);
  }
  return (data ?? []) as ProblemDashboardRow[];
}

function buildReviewCandidate(
  item: LibraryItemDashboardRow,
  submission: SubmissionDashboardRow,
  feedback: FeedbackDashboardRow | null,
  problem: ProblemDashboardRow | null,
  dimensions: DimensionScoreDashboardRow[],
  rewrite: boolean,
): LibraryReviewCandidate {
  const lengthTarget = lengthTargetStatus(
    submission.question_no,
    submission.char_count,
  );
  const lowestDimension = lowestDimensionScore(dimensions);
  const lowDimension =
    lowestDimension != null &&
    lowestDimension.normalizedScore < LOW_DIMENSION_THRESHOLD;
  const totalScore = normalizeTotalScore(feedback);
  const reasons = uniqueReasons([
    lengthTarget ? "length_off_target" : null,
    rewrite ? "comparison_available" : null,
    lowDimension ? "low_dimension" : null,
    isShortAnswerReason(submission.question_no, submission.char_count)
      ? "short_answer"
      : null,
    "feedback_ready",
  ]);

  return {
    id: item.id,
    itemId: item.id,
    submissionId: submission.id,
    problemId: submission.problem_id,
    questionNo: submission.question_no,
    title: problemTitle(problem, submission.question_no),
    submittedAt: submission.submitted_at,
    charCount: submission.char_count,
    estimatedMinutes: estimatedMinutesForQuestion(submission.question_no),
    difficultyLevel: candidateDifficultyLevel(
      problem?.difficulty ?? null,
      submission.question_no,
    ),
    scoreTotal: totalScore?.scoreTotal ?? null,
    scoreMax: totalScore?.scoreMax ?? null,
    scorePercent: totalScore?.scorePercent ?? null,
    feedbackHref: writingFeedbackHref({
      questionNo: submission.question_no,
      submissionId: submission.id,
    }),
    retryHref: writingProblemHref({
      questionNo: submission.question_no,
      problemId: submission.problem_id,
      fresh: true,
      retrySubmissionId: submission.id,
    }),
    primaryReason: pickPrimaryReason(reasons),
    reasons,
    hasRewrite: rewrite,
    ...(lowestDimension ? { lowestDimension } : {}),
    ...(lengthTarget ? { lengthTarget } : {}),
  };
}

function buildWeakItems(
  rows: Array<{
    item: LibraryItemDashboardRow;
    submission: SubmissionDashboardRow;
    problem: ProblemDashboardRow | null;
    dimensions: DimensionScoreDashboardRow[];
  }>,
): LibraryWeakItem[] {
  return rows
    .flatMap((row) =>
      row.dimensions
        .map((dimensionRow): LibraryWeakItem | null => {
          const normalized = normalizeDimensionScore(dimensionRow);
          if (!normalized) return null;
          return {
            id: dimensionRow.id,
            submissionId: row.submission.id,
            problemId: row.submission.problem_id,
            questionNo: row.submission.question_no,
            title: problemTitle(row.problem, row.submission.question_no),
            submittedAt: row.submission.submitted_at,
            ...normalized,
          };
        })
        .filter((item): item is LibraryWeakItem => item !== null),
    )
    .sort(
      (a, b) =>
        a.normalizedScore - b.normalizedScore ||
        compareIsoDesc(a.submittedAt, b.submittedAt),
    )
    .slice(0, WEAK_ITEMS_LIMIT);
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

function hasRewrite(
  submission: SubmissionDashboardRow,
  countsByProblem: Map<string, number>,
) {
  return (
    (countsByProblem.get(submission.problem_id) ?? 0) > 1 ||
    submission.parent_submission_id != null
  );
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

function lengthTargetStatus(questionNo: number | null, charCount: number) {
  const target =
    questionNo === 53
      ? { min: 200, max: 300 }
      : questionNo === 54
        ? { min: 600, max: 700 }
        : null;
  if (!target) return null;
  if (charCount < target.min) return { ...target, status: "under" as const };
  if (charCount > target.max) return { ...target, status: "over" as const };
  return null;
}

function estimatedMinutesForQuestion(questionNo: number | null) {
  if (questionNo === 51) return 15;
  if (questionNo === 52) return 25;
  if (questionNo === 53) return 30;
  if (questionNo === 54) return 50;
  return null;
}

function candidateDifficultyLevel(
  problemDifficulty: number | null,
  questionNo: number | null,
) {
  if (problemDifficulty != null) {
    return Math.max(1, Math.min(5, Math.round(problemDifficulty)));
  }
  if (questionNo === 51) return 3;
  if (questionNo === 52) return 4;
  if (questionNo === 53 || questionNo === 54) return 5;
  return null;
}

function isShortAnswerReason(questionNo: number | null, charCount: number) {
  return (
    (questionNo === 51 || questionNo === 52) &&
    charCount > 0 &&
    charCount <= SHORT_ANSWER_CHAR_LIMIT
  );
}

function lowestDimensionScore(rows: DimensionScoreDashboardRow[]) {
  const normalized = rows
    .map(normalizeDimensionScore)
    .filter((score): score is NonNullable<typeof score> => score !== null)
    .sort((a, b) => a.normalizedScore - b.normalizedScore);
  return normalized[0] ?? null;
}

function normalizeDimensionScore(row: DimensionScoreDashboardRow) {
  if (row.score == null) return null;
  const scoreMax = row.score_max != null && row.score_max > 0 ? row.score_max : 100;
  const normalizedScore = Math.max(
    0,
    Math.min(100, Math.round((row.score / scoreMax) * 100)),
  );
  return {
    dimension: row.dimension,
    normalizedScore,
    score: row.score,
    scoreMax,
  };
}

function normalizeTotalScore(feedback: FeedbackDashboardRow | null) {
  if (feedback?.score_total == null) return null;
  const scoreMax =
    feedback.score_max != null && feedback.score_max > 0
      ? feedback.score_max
      : 100;
  const scorePercent = Math.max(
    0,
    Math.min(100, Math.round((feedback.score_total / scoreMax) * 100)),
  );
  return {
    scoreTotal: feedback.score_total,
    scoreMax,
    scorePercent,
  };
}

function uniqueReasons(
  reasons: Array<LibraryDashboardReviewReason | null>,
): LibraryDashboardReviewReason[] {
  const out: LibraryDashboardReviewReason[] = [];
  for (const reason of reasons) {
    if (reason && !out.includes(reason)) out.push(reason);
  }
  return out;
}

function pickPrimaryReason(
  reasons: LibraryDashboardReviewReason[],
): LibraryDashboardReviewReason {
  return (
    reasons.find((reason) => reason === "length_off_target") ??
    reasons.find((reason) => reason === "comparison_available") ??
    reasons.find((reason) => reason === "low_dimension") ??
    reasons.find((reason) => reason === "short_answer") ??
    "feedback_ready"
  );
}

function sortCandidates(a: LibraryReviewCandidate, b: LibraryReviewCandidate) {
  return (
    candidatePriority(a) - candidatePriority(b) ||
    Number(b.hasRewrite) - Number(a.hasRewrite) ||
    Number(isLowDimensionCandidate(b)) - Number(isLowDimensionCandidate(a)) ||
    compareIsoDesc(a.submittedAt, b.submittedAt)
  );
}

function candidatePriority(candidate: LibraryReviewCandidate) {
  return candidate.primaryReason === "length_off_target" ? 0 : 1;
}

function isLowDimensionCandidate(candidate: LibraryReviewCandidate) {
  return candidate.reasons.includes("low_dimension");
}

function isTimelineEventType(
  eventType: string | null,
): eventType is LibraryDashboardTimelineEventType {
  return TIMELINE_EVENT_TYPES.includes(
    eventType as LibraryDashboardTimelineEventType,
  );
}

function problemTitle(
  problem: ProblemDashboardRow | null | undefined,
  questionNo: number | null | undefined,
) {
  if (problem?.title) return problem.title;
  return questionNo ? `${questionNo}번 문제` : "저장 답안";
}

function mostRecentIso(values: string[]) {
  const sorted = values.filter(Boolean).sort(compareIsoDesc);
  return sorted[0] ?? null;
}

function compareIsoDesc(a: string, b: string) {
  return new Date(b).getTime() - new Date(a).getTime();
}

function uniqueIds(values: Array<string | null>): string[] {
  const set = new Set<string>();
  for (const value of values) {
    if (value) set.add(value);
  }
  return Array.from(set);
}
