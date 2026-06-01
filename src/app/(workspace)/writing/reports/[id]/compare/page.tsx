import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComparisonReportView } from "@/components/reports/ComparisonReportView";
import { requireUser } from "@/lib/auth/session";
import {
  getComparisonReport,
  getSubmission,
} from "@/lib/writing/server";
import type { ComparisonMetrics } from "@/lib/writing/comparison-service";

export const metadata: Metadata = { title: "비교 리포트 — TALKPIK" };

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
  return (
    <ComparisonReportView
      metrics={report.metrics as unknown as ComparisonMetrics}
      narrative={report.narrative}
      currentText={current.answer_text}
      previousText={previous?.answer_text ?? null}
      retryHref={`/writing/${current.question_no}?problem=${current.problem_id}`}
    />
  );
}
