import type { Metadata } from "next";

import { PasswordResetConfirmForm } from "@/components/auth/PasswordResetConfirmForm";

export const metadata: Metadata = { title: "새 비밀번호 설정 — TALKPIK" };

export default function PasswordResetConfirmPage() {
  return (
    <main style={{ padding: "2rem 1rem", maxWidth: 480, margin: "0 auto" }}>
      <PasswordResetConfirmForm />
    </main>
  );
}
