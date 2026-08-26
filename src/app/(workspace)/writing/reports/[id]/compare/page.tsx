import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { WorkspaceBody } from "@/components/app/WorkspaceBody";
import { ComparisonReportView } from "@/components/reports/ComparisonReportView";
import { requireUser } from "@/lib/auth/session";
import { getComparisonReportViewModel } from "@/lib/writing/comparison-report-view-model";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reports.page");
  return { title: t("metaTitle") };
}

export default async function CompareReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();
  const viewModel = await getComparisonReportViewModel(id);
  if (!viewModel) notFound();

  return (
    <WorkspaceBody size="full">
      <ComparisonReportView key={viewModel.reportId} {...viewModel} />
    </WorkspaceBody>
  );
}
