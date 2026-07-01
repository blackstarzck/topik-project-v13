import {
  computeComparisonMetrics,
  generateNarrative,
  type ComparisonMetrics,
} from "@/lib/writing/comparison-service";
import {
  buildBlankComparisonData,
  buildComparisonScoreItems,
  hasBlankScoreItems,
  scoreItemMap,
  toComparisonMetricScoreItems,
  type BlankComparisonDatum,
  type ComparisonScoreItem,
} from "@/lib/writing/comparison-score-items";
import { writingProblemHref } from "@/lib/writing/routes";
import {
  getComparisonReport,
  getComparisonTargetCandidates,
  getFeedbackBundle,
  getWritingProblemAvailability,
  getSubmission,
  type ComparisonTargetCandidate,
} from "@/lib/writing/server";
import { isShortAnswer, type QuestionNo } from "@/lib/writing/types";

export type ComparisonReportChartDatum = {
  dimension: string;
  previous: number | null;
  current: number | null;
};

export type ComparisonReportViewModel = {
  metrics: ComparisonMetrics;
  narrative: string | null;
  currentText: string;
  previousText: string | null;
  currentAnswerJson?: unknown;
  previousAnswerJson?: unknown;
  retryHref: string | null;
  reportId: string;
  currentScore: number | null;
  chartData: ComparisonReportChartDatum[];
  currentNorm: Record<string, number | null>;
  hasPrevious: boolean;
  currentSubmissionId: string;
  currentQuestionNo: number;
  currentSubmittedAt: string;
  selectedPreviousSubmissionId: string | null;
  comparisonTargets: ComparisonTargetCandidate[];
  showBlankComparison: boolean;
  hasBlankTraitData: boolean;
  blankComparisons: BlankComparisonDatum[];
};

function normalizedTotalScore(
  score: number | null | undefined,
  scoreMax: number | null | undefined,
): number | null {
  if (score === null || score === undefined) return null;
  const max = scoreMax && scoreMax > 0 ? scoreMax : 100;
  return Math.round((score / max) * 1000) / 10;
}

function toChartDatum(
  current: ComparisonScoreItem,
  previousByKey: Map<string, ComparisonScoreItem>,
  hasPrevious: boolean,
): ComparisonReportChartDatum {
  const previous = previousByKey.get(current.key);
  return {
    dimension: current.key,
    current: current.normalizedScore,
    previous: hasPrevious ? (previous?.normalizedScore ?? null) : null,
  };
}

export async function getComparisonReportViewModel(
  reportId: string,
): Promise<ComparisonReportViewModel | null> {
  const report = await getComparisonReport(reportId);
  if (!report) return null;

  const [current, previous] = await Promise.all([
    getSubmission(report.current_submission_id),
    report.previous_submission_id
      ? getSubmission(report.previous_submission_id)
      : Promise.resolve(null),
  ]);
  if (!current) return null;

  const [
    currentBundle,
    previousBundle,
    comparisonTargets,
    currentProblemAvailability,
  ] = await Promise.all([
    getFeedbackBundle(current.id),
    previous ? getFeedbackBundle(previous.id) : Promise.resolve(null),
    getComparisonTargetCandidates(current.id, report.previous_submission_id),
    getWritingProblemAvailability(current.problem_id),
  ]);

  const persistedMetrics = report.metrics as unknown as ComparisonMetrics;
  const currentQuestionNo = current.question_no as QuestionNo;
  const currentScoreItems = buildComparisonScoreItems(
    currentQuestionNo,
    currentBundle,
  );
  const previousScoreItems = previousBundle
    ? buildComparisonScoreItems(currentQuestionNo, previousBundle)
    : [];
  const displayMetrics = currentBundle
    ? computeComparisonMetrics({
        currentScore: currentBundle.feedback.score_total,
        currentScoreMax: currentBundle.feedback.score_max,
        previousScore: previousBundle?.feedback.score_total ?? null,
        previousScoreMax: previousBundle?.feedback.score_max ?? null,
        currentDims: currentBundle.dimensions,
        previousDims: previousBundle?.dimensions ?? null,
        currentScoreItems: toComparisonMetricScoreItems(currentScoreItems),
        previousScoreItems: previousBundle
          ? toComparisonMetricScoreItems(previousScoreItems)
          : null,
        currentChars: current.char_count,
        previousChars: previous?.char_count ?? null,
      })
    : persistedMetrics;
  const hasPrevious = !displayMetrics.no_previous && previous !== null;
  const isShortAnswerComparison = isShortAnswer(currentQuestionNo);
  const hasBlankTraitData =
    hasBlankScoreItems(currentScoreItems) ||
    hasBlankScoreItems(previousScoreItems);

  const currentNorm = scoreItemMap(currentScoreItems);
  const previousScoreByKey = new Map(
    previousScoreItems.map((item) => [item.key, item]),
  );
  const chartData: ComparisonReportChartDatum[] = isShortAnswerComparison
    ? []
    : currentScoreItems
        .map((item) => toChartDatum(item, previousScoreByKey, hasPrevious))
        .filter((datum) => datum.current !== null || datum.previous !== null);
  const blankComparisons = isShortAnswerComparison
    ? buildBlankComparisonData({
        currentItems: currentScoreItems,
        previousItems: previousScoreItems,
        currentSubmission: current,
        previousSubmission: previous,
      })
    : [];
  const narrative =
    isShortAnswerComparison && hasBlankTraitData
      ? generateNarrative(displayMetrics)
      : report.narrative;

  return {
    metrics: displayMetrics,
    narrative,
    currentText: current.answer_text,
    previousText: previous?.answer_text ?? null,
    currentAnswerJson: current.answer_json,
    previousAnswerJson: previous?.answer_json ?? null,
    retryHref: currentProblemAvailability.canStart
      ? writingProblemHref({
          questionNo: currentQuestionNo,
          problemId: current.problem_id,
        })
      : null,
    reportId: report.id,
    currentScore: normalizedTotalScore(
      currentBundle?.feedback.score_total,
      currentBundle?.feedback.score_max,
    ),
    chartData,
    currentNorm,
    hasPrevious,
    currentSubmissionId: current.id,
    currentQuestionNo,
    currentSubmittedAt: current.submitted_at,
    selectedPreviousSubmissionId: report.previous_submission_id,
    comparisonTargets,
    showBlankComparison: isShortAnswerComparison,
    hasBlankTraitData,
    blankComparisons,
  };
}
