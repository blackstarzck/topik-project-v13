import { writingFeedbackHref, writingProblemHref } from "../writing/routes";
import type {
  LibraryDashboardDimension,
  LibraryDashboardReviewReason,
  LibraryReviewCandidate,
  LibraryWeakItem,
} from "./types";

const REVIEW_CANDIDATE_LIMIT = 12;
const WEAK_ITEMS_LIMIT = 3;
const LOW_DIMENSION_THRESHOLD = 70;
const SHORT_ANSWER_CHAR_LIMIT = 30;

type LibraryDashboardReviewDimension = {
  id: string;
  dimension: LibraryDashboardDimension;
  score: number | null;
  scoreMax: number | null;
};

type LibraryDashboardReviewItem = {
  itemId: string;
  submissionId: string;
  problemId: string;
  questionNo: number | null;
  title: string;
  submittedAt: string;
  charCount: number;
  parentSubmissionId: string | null;
  problemDifficulty: number | null;
  submissionCountForProblem: number;
  feedback: {
    scoreTotal: number | null;
    scoreMax: number | null;
  } | null;
  dimensions: LibraryDashboardReviewDimension[];
};

type LibraryDashboardReviewInput = {
  items: LibraryDashboardReviewItem[];
  visibleProblemIds: string[] | null;
};

type LibraryDashboardReview = {
  reviewCandidates: LibraryReviewCandidate[];
  weakItems: LibraryWeakItem[];
  comparisonAvailableCount: number;
};

export function buildLibraryDashboardReview({
  items,
  visibleProblemIds,
}: LibraryDashboardReviewInput): LibraryDashboardReview {
  const visibleProblemIdSet = visibleProblemIds
    ? new Set(visibleProblemIds)
    : null;

  return {
    reviewCandidates: items
      .map((item) =>
        buildReviewCandidate(
          item,
          hasRewrite(item),
          canRetryProblem(item.problemId, visibleProblemIdSet),
        ),
      )
      .sort(sortCandidates)
      .slice(0, REVIEW_CANDIDATE_LIMIT),
    weakItems: buildWeakItems(items),
    comparisonAvailableCount: items.filter(hasRewrite).length,
  };
}

function buildReviewCandidate(
  item: LibraryDashboardReviewItem,
  rewrite: boolean,
  canRetry: boolean,
): LibraryReviewCandidate {
  const lengthTarget = lengthTargetStatus(item.questionNo, item.charCount);
  const lowestDimension = lowestDimensionScore(item.dimensions);
  const lowDimension =
    lowestDimension != null &&
    lowestDimension.normalizedScore < LOW_DIMENSION_THRESHOLD;
  const totalScore = normalizeTotalScore(item.feedback);
  const reasons = uniqueReasons([
    lengthTarget ? "length_off_target" : null,
    rewrite ? "comparison_available" : null,
    lowDimension ? "low_dimension" : null,
    isShortAnswerReason(item.questionNo, item.charCount)
      ? "short_answer"
      : null,
    "feedback_ready",
  ]);

  return {
    id: item.itemId,
    itemId: item.itemId,
    submissionId: item.submissionId,
    problemId: item.problemId,
    questionNo: item.questionNo,
    title: item.title,
    submittedAt: item.submittedAt,
    charCount: item.charCount,
    estimatedMinutes: estimatedMinutesForQuestion(item.questionNo),
    difficultyLevel: candidateDifficultyLevel(
      item.problemDifficulty,
      item.questionNo,
    ),
    scoreTotal: totalScore?.scoreTotal ?? null,
    scoreMax: totalScore?.scoreMax ?? null,
    scorePercent: totalScore?.scorePercent ?? null,
    feedbackHref: writingFeedbackHref({
      questionNo: item.questionNo,
      submissionId: item.submissionId,
    }),
    retryHref: canRetry
      ? writingProblemHref({
          questionNo: item.questionNo,
          problemId: item.problemId,
          fresh: true,
          returnTo: "/library",
          retrySubmissionId: item.submissionId,
        })
      : null,
    primaryReason: pickPrimaryReason(reasons),
    reasons,
    hasRewrite: rewrite,
    ...(lowestDimension ? { lowestDimension } : {}),
    ...(lengthTarget ? { lengthTarget } : {}),
  };
}

function buildWeakItems(
  items: LibraryDashboardReviewItem[],
): LibraryWeakItem[] {
  return items
    .flatMap((item) =>
      item.dimensions
        .map((dimension): LibraryWeakItem | null => {
          const normalized = normalizeDimensionScore(dimension);
          if (!normalized) return null;
          return {
            id: dimension.id,
            submissionId: item.submissionId,
            problemId: item.problemId,
            questionNo: item.questionNo,
            title: item.title,
            submittedAt: item.submittedAt,
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

function canRetryProblem(
  problemId: string,
  visibleProblemIds: Set<string> | null,
): boolean {
  return visibleProblemIds === null || visibleProblemIds.has(problemId);
}

function hasRewrite(item: LibraryDashboardReviewItem) {
  return item.submissionCountForProblem > 1 || item.parentSubmissionId != null;
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

function lowestDimensionScore(rows: LibraryDashboardReviewDimension[]) {
  const normalized = rows
    .map(normalizeDimensionScore)
    .filter((score): score is NonNullable<typeof score> => score !== null)
    .sort((a, b) => a.normalizedScore - b.normalizedScore);
  return normalized[0] ?? null;
}

function normalizeDimensionScore(row: LibraryDashboardReviewDimension) {
  if (row.score == null) return null;
  const scoreMax =
    row.scoreMax != null && row.scoreMax > 0 ? row.scoreMax : 100;
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

function normalizeTotalScore(feedback: LibraryDashboardReviewItem["feedback"]) {
  if (feedback?.scoreTotal == null) return null;
  const scoreMax =
    feedback.scoreMax != null && feedback.scoreMax > 0
      ? feedback.scoreMax
      : 100;
  const scorePercent = Math.max(
    0,
    Math.min(100, Math.round((feedback.scoreTotal / scoreMax) * 100)),
  );
  return {
    scoreTotal: feedback.scoreTotal,
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

function compareIsoDesc(a: string, b: string) {
  return new Date(b).getTime() - new Date(a).getTime();
}
