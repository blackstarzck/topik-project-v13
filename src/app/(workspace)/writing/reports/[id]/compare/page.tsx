import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shared/PlaceholderPage";

export const metadata: Metadata = { title: "비교 리포트 — TALKPIK" };

export default async function CompareReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PlaceholderPage
      iaCode="R-01"
      title={`비교 리포트 (id=${id})`}
      phaseHint="이전/현재 결과 비교는 Phase 5에서 채워집니다."
    />
  );
}
