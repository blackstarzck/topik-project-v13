import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shared/PlaceholderPage";

export const metadata: Metadata = { title: "내 라이브러리 — TALKPIK" };

export default function LibraryPage() {
  return (
    <PlaceholderPage
      iaCode="F-01"
      title="내 라이브러리"
      phaseHint="저장 글·피드백 기록은 Phase 5에서 채워집니다."
    />
  );
}
