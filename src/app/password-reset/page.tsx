import type { Metadata } from "next";

export const metadata: Metadata = { title: "비밀번호 재설정 — TALKPIK" };

export default function PasswordResetPage() {
  return (
    <main style={{ padding: "2rem", maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>비밀번호 재설정</h1>
      <p>비밀번호 재설정 폼은 다음 단계에서 제공됩니다.</p>
      <p style={{ marginTop: "1rem", color: "#666", fontSize: "0.875rem" }}>
        X-06 placeholder. 공개 라우트.
      </p>
    </main>
  );
}
