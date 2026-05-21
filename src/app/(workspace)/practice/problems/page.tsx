import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shared/PlaceholderPage";

export const metadata: Metadata = { title: "문제 목록 — TALKPIK" };

export default function PracticeProblemsPage() {
  return (
    <PlaceholderPage
      iaCode="C-02"
      title="문제 목록"
      phaseHint="문제 후보 + retry 모달은 Phase 4에서 채워집니다."
    />
  );
}
