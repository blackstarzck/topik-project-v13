import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthMascot } from "@/components/auth/AuthMascot";
import { LoginForm } from "@/components/auth/LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "로그인 — TALKPIK" };

export default function LoginPage() {
  return (
    <main style={{ padding: "2rem 1rem", maxWidth: 480, margin: "0 auto" }}>
      {/* §1 환영/브랜드 영역 + §2 마스코트 안내 (이미지 실패 시 이모지 fallback) */}
      <section style={{ textAlign: "center", marginBottom: 24 }}>
        <AuthMascot
          alt="TALKPIK 학습 도우미 캐릭터"
          emoji="🐥"
          size={44}
          caption="다시 오신 걸 환영해요. 이어서 글쓰기를 연습해볼까요?"
        />
        <h1 style={{ fontSize: 24, margin: "8px 0 0" }}>다시 오신 걸 환영해요</h1>
      </section>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
      <p style={{ textAlign: "center", marginTop: 16 }}>
        계정이 없으신가요? <Link href="/sign-up">회원가입</Link>
      </p>
    </main>
  );
}
