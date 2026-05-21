import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "로그인 — TALKPIK",
};

export default function LoginPage() {
  return (
    <main style={{ padding: "2rem", maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>로그인</h1>
      <p>로그인 UI는 다음 단계(Phase 3)에서 제공됩니다.</p>
      <p style={{ marginTop: "1rem", color: "#666", fontSize: "0.875rem" }}>
        이 경로는 보호 라우트의 redirect 대상 placeholder로 동작합니다.
      </p>
    </main>
  );
}
