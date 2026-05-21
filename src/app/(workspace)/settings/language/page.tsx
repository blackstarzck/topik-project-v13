import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shared/PlaceholderPage";

export const metadata: Metadata = { title: "언어 설정 — TALKPIK" };

export default function LanguageSettingsPage() {
  return (
    <PlaceholderPage
      iaCode="G-01"
      title="언어 설정"
      phaseHint="언어 전환 UI는 Phase 6에서 채워집니다."
    />
  );
}
