import type { Metadata } from "next";
import { Suspense } from "react";

import { VerifyEmailCard } from "@/components/auth/VerifyEmailCard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "이메일 인증 — TALKPIK" };

export default function VerifyEmailPage() {
  return (
    <main style={{ padding: "2.5rem 1rem", maxWidth: 640, margin: "0 auto" }}>
      <Suspense fallback={null}>
        <VerifyEmailCard />
      </Suspense>
    </main>
  );
}
