import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "로그인 — TALKPIK" };

export default function LoginPage() {
  return (
    <main style={{ padding: "2rem 1rem", maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ textAlign: "center", fontSize: 24 }}>로그인</h1>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
      <p style={{ textAlign: "center", marginTop: 16 }}>
        계정이 없으신가요? <Link href="/sign-up">회원가입</Link>
      </p>
    </main>
  );
}
