import type { Metadata } from "next";
import Link from "next/link";

import { PasswordResetRequestForm } from "@/components/auth/PasswordResetRequestForm";

export const metadata: Metadata = { title: "비밀번호 재설정 — TALKPIK" };

export default function PasswordResetPage() {
  return (
    <main style={{ padding: "2rem 1rem", maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ textAlign: "center", fontSize: 24 }}>비밀번호 재설정</h1>
      <PasswordResetRequestForm />
      <p style={{ textAlign: "center", marginTop: 16 }}>
        <Link href="/login">로그인으로 돌아가기</Link>
      </p>
    </main>
  );
}
