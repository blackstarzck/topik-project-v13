import type { Metadata } from "next";
import { PaywallShell } from "@/components/settings/PaywallShell";

export const metadata: Metadata = { title: "구독 가입 — TALKPIK" };

export default function PaywallPage() {
  return <PaywallShell />;
}
