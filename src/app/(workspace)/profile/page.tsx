import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shared/PlaceholderPage";

export const metadata: Metadata = { title: "프로필 — TALKPIK" };

export default function ProfilePage() {
  return (
    <PlaceholderPage
      iaCode="X-05"
      title="프로필"
      phaseHint="프로필 편집 UI는 Phase 6 하드닝에서 채워집니다."
    />
  );
}
