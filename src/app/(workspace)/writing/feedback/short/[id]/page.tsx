import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shared/PlaceholderPage";

export const metadata: Metadata = { title: "단답 피드백 — TALKPIK" };

export default async function ShortFeedbackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PlaceholderPage
      iaCode="E-01"
      title={`단답 피드백 (id=${id})`}
      phaseHint="피드백 데이터 fetch + id format validation은 Phase 5에서 채워집니다."
    />
  );
}
