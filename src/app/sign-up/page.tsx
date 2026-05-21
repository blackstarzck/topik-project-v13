import type { Metadata } from "next";

export const metadata: Metadata = { title: "회원가입 — TALKPIK" };

export default function SignUpPage() {
  return (
    <main style={{ padding: "2rem", maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>회원가입</h1>
      <p>회원가입 폼은 다음 단계에서 제공됩니다.</p>
      <p style={{ marginTop: "1rem", color: "#666", fontSize: "0.875rem" }}>
        A-01 placeholder. 공개 라우트.
      </p>
    </main>
  );
}
