import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthErrorCard } from "@/components/auth/AuthErrorCard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "인증 오류 — TALKPIK" };

export default function AuthErrorPage() {
  return (
    <main style={{ padding: "2.5rem 1rem", maxWidth: 640, margin: "0 auto" }}>
      <Suspense fallback={null}>
        <AuthErrorCard />
      </Suspense>
    </main>
  );
}
