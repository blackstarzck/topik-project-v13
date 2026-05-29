import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthErrorCard } from "@/components/auth/AuthErrorCard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "인증 오류 — TALKPIK" };

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

export default function AuthErrorPage() {
  return (
    <main style={{ padding: "2.5rem 1rem", maxWidth: 640, margin: "0 auto" }}>
      <h1 style={srOnlyStyle}>인증 오류</h1>
      <Suspense fallback={null}>
        <AuthErrorCard />
      </Suspense>
    </main>
  );
}
