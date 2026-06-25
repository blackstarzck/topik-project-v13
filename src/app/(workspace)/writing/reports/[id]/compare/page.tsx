import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { WorkspaceBody } from "@/components/app/WorkspaceBody";
import { ComparisonReportView } from "@/components/reports/ComparisonReportView";
import type { ChartDatum } from "@/components/reports/ScoreComparisonChart";
import { requireUser } from "@/lib/auth/session";
import {
  getComparisonReport,
  getFeedbackBundle,
  getSubmission,
} from "@/lib/writing/server";
import type { ComparisonMetrics } from "@/lib/writing/comparison-service";
import {
  FEEDBACK_DIMENSIONS,
  type FeedbackDimensionScoreRow,
} from "@/lib/writing/types";
import { writingProblemHref } from "@/lib/writing/routes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reports.page");
  return { title: t("metaTitle") };
}

/** dimension → 0..100 정규화 점수 맵. score_max 차이를 보정한다. */
function normalizedScores(
  dims: FeedbackDimensionScoreRow[],
): Record<string, number | null> {
  const map: Record<string, number | null> = {};
  for (const dim of FEEDBACK_DIMENSIONS) {
    const row = dims.find((d) => d.dimension === dim);
    if (!row || row.score === null) {
      map[dim] = null;
      continue;
    }
    const max = row.score_max && row.score_max > 0 ? row.score_max : 100;
    map[dim] = Math.round((row.score / max) * 100);
  }
  return map;
}

function normalizedTotalScore(
  score: number | null | undefined,
  scoreMax: number | null | undefined,
): number | null {
  if (score === null || score === undefined) return null;
  const max = scoreMax && scoreMax > 0 ? scoreMax : 100;
  return Math.round((score / max) * 1000) / 10;
}

export default async function CompareReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();
  const report = await getComparisonReport(id);
  if (!report) notFound();

  const [current, previous] = await Promise.all([
    getSubmission(report.current_submission_id),
    report.previous_submission_id
      ? getSubmission(report.previous_submission_id)
      : Promise.resolve(null),
  ]);
  if (!current) notFound();

  // 차트/항목 카드용 실제 점수 — 현재/이전 dimension bundle을 정규화한다.
  const [currentBundle, previousBundle] = await Promise.all([
    getFeedbackBundle(current.id),
    previous ? getFeedbackBundle(previous.id) : Promise.resolve(null),
  ]);

  const metrics = report.metrics as unknown as ComparisonMetrics;
  const hasPrevious = !metrics.no_previous && previous !== null;

  const currentNorm = normalizedScores(currentBundle?.dimensions ?? []);
  const previousNorm = normalizedScores(previousBundle?.dimensions ?? []);

  const chartData: ChartDatum[] = FEEDBACK_DIMENSIONS.map((dim) => ({
    dimension: dim,
    current: currentNorm[dim] ?? null,
    previous: hasPrevious ? (previousNorm[dim] ?? null) : null,
  })).filter((d) => d.current !== null || d.previous !== null);

  return (
    <WorkspaceBody>
      <ComparisonReportView
        metrics={metrics}
        narrative={report.narrative}
        currentText={current.answer_text}
        previousText={previous?.answer_text ?? null}
        retryHref={writingProblemHref({
          questionNo: current.question_no,
          problemId: current.problem_id,
        })}
        reportId={report.id}
        currentScore={normalizedTotalScore(
          currentBundle?.feedback.score_total,
          currentBundle?.feedback.score_max,
        )}
        chartData={chartData}
        currentNorm={currentNorm}
        hasPrevious={hasPrevious}
      />
    </WorkspaceBody>
  );
}
