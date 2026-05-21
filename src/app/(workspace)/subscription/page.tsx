import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shared/PlaceholderPage";

export const metadata: Metadata = { title: "구독 관리 — TALKPIK" };

export default function SubscriptionPage() {
  return (
    <PlaceholderPage
      iaCode="X-04"
      title="구독 관리"
      phaseHint="billing scope는 deferred-scope.md 기준으로 보류 상태입니다."
    />
  );
}
