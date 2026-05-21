import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shared/PlaceholderPage";

export const metadata: Metadata = { title: "알림 설정 — TALKPIK" };

export default function NotificationsSettingsPage() {
  return (
    <PlaceholderPage
      iaCode="X-09"
      title="알림 설정"
      phaseHint="알림 채널 설정은 Phase 6에서 채워집니다."
    />
  );
}
