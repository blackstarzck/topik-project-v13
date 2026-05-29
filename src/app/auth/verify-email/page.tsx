import type { Metadata } from "next";
import { Suspense } from "react";

import { VerifyEmailCard } from "@/components/auth/VerifyEmailCard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "이메일 인증 — TALKPIK" };

const srOnlyStyle: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

export default function VerifyEmailPage() {
  return (
    <main style={{ padding: "2.5rem 1rem", maxWidth: 640, margin: "0 auto" }}>
      <h1 style={srOnlyStyle}>이메일 인증</h1>
      <Suspense fallback={null}>
        <VerifyEmailCard />
      </Suspense>
    </main>
  );
}
