import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shared/PlaceholderPage";

export const metadata: Metadata = { title: "성장 대시보드 — TALKPIK" };

export default function GrowthPage() {
  return (
    <PlaceholderPage
      iaCode="X-02"
      title="성장 대시보드"
      phaseHint="진척/성장 분석 차트는 Phase 4에서 채워집니다."
    />
  );
}
