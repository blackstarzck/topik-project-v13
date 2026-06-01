import type { Metadata } from "next";
import Link from "next/link";

import { SignUpForm } from "@/components/auth/SignUpForm";

export const metadata: Metadata = { title: "회원가입 — TALKPIK" };

// 혜택 칩 — description §2 제약: 3개 이하, 라벨 12자 이하.
const benefitChips = ["AI 첨삭 무료 체험", "TOPIK 51~54 실전", "약점 리포트"];

const chipStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 12px",
  borderRadius: 999,
  background: "#f0f5ff",
  color: "#1d39c4",
  fontSize: 13,
  margin: "0 6px 6px 0",
};

export default function SignUpPage() {
  return (
    <main style={{ padding: "2rem 1rem", maxWidth: 480, margin: "0 auto" }}>
      {/* description §1 브랜드 메시지 + §2 마스코트/혜택 영역. 이미지 대신
          텍스트 마스코트로 대체 — §2 예외(이미지 실패 시 기본 캐릭터)와 호환. */}
      <section style={{ textAlign: "center", marginBottom: 24 }}>
        <div aria-hidden="true" style={{ fontSize: 40, lineHeight: 1 }}>
          ✏️
        </div>
        <h1 style={{ fontSize: 24, margin: "8px 0 4px" }}>회원가입</h1>
        <p style={{ color: "#595959", margin: "0 0 12px", fontSize: 14 }}>
          TOPIK 글쓰기, AI 첨삭으로 더 빠르게. 부담 없이 무료로 시작해보세요.
        </p>
        <div>
          {benefitChips.map((chip) => (
            <span key={chip} style={chipStyle}>
              {chip}
            </span>
          ))}
        </div>
      </section>
      <SignUpForm />
      <p style={{ textAlign: "center", marginTop: 16 }}>
        이미 계정이 있으신가요? <Link href="/login">로그인</Link>
      </p>
    </main>
  );
}
