import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shared/PlaceholderPage";

export const metadata: Metadata = { title: "약점 보강 — TALKPIK" };

export default function PracticeWeaknessPage() {
  return (
    <PlaceholderPage
      iaCode="X-07"
      title="약점 보강"
      phaseHint="약점 기반 추천은 Phase 4에서 채워집니다."
    />
  );
}
