import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shared/PlaceholderPage";

export const metadata: Metadata = { title: "추천 문제 — TALKPIK" };

export default function PracticeRecommendationsPage() {
  return (
    <PlaceholderPage
      iaCode="C-01"
      title="문제 유형 추천"
      phaseHint="추천 알고리즘 결과 UI는 Phase 4에서 채워집니다."
    />
  );
}
