import type { Metadata } from "next";
import Link from "next/link";

import { SignUpForm } from "@/components/auth/SignUpForm";

export const metadata: Metadata = { title: "회원가입 — TALKPIK" };

export default function SignUpPage() {
  return (
    <main style={{ padding: "2rem 1rem", maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ textAlign: "center", fontSize: 24 }}>회원가입</h1>
      <SignUpForm />
      <p style={{ textAlign: "center", marginTop: 16 }}>
        이미 계정이 있으신가요? <Link href="/login">로그인</Link>
      </p>
    </main>
  );
}
