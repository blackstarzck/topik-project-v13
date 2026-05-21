import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shared/PlaceholderPage";

export const metadata: Metadata = { title: "학습 목표 설정 — TALKPIK" };

export default function OnboardingLearningGoalPage() {
  return (
    <PlaceholderPage
      iaCode="A-03"
      title="학습 목표 설정"
      phaseHint="첫 실행 온보딩 폼은 Phase 4에서 채워집니다."
    />
  );
}
