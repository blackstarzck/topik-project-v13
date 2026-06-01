import type { Metadata } from "next";
import { SubscriptionShell } from "@/components/settings/SubscriptionShell";

export const metadata: Metadata = { title: "구독 관리 — TALKPIK" };

export default function SubscriptionPage() {
  return <SubscriptionShell />;
}
