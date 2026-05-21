import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shared/PlaceholderPage";

export const metadata: Metadata = { title: "구독 가입 — TALKPIK" };

export default function PaywallPage() {
  return (
    <PlaceholderPage
      iaCode="X-03"
      title="구독 가입"
      phaseHint="billing scope는 deferred-scope.md 기준으로 보류 상태입니다."
    />
  );
}
