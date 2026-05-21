import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shared/PlaceholderPage";

export const metadata: Metadata = { title: "다음 문제 — TALKPIK" };

export default function PracticeNextPage() {
  return (
    <PlaceholderPage
      iaCode="R-02"
      title="다음 문제 추천"
      phaseHint="피드백 이후 다음 문제 흐름은 Phase 5에서 채워집니다."
    />
  );
}
