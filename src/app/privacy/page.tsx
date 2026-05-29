import type { Metadata } from "next";
import Link from "next/link";

// Codex P4 D4 placeholder — codex 위임 결정으로 신설된 개인정보처리방침
// placeholder. 정식 처리방침은 법무 검토 후 운영 진입 전 별도 작업.

export const metadata: Metadata = { title: "개인정보처리방침 — TALKPIK" };

const sectionStyle: React.CSSProperties = {
  marginBottom: 24,
};

export default function PrivacyPage() {
  return (
    <main style={{ padding: "2.5rem 1rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>개인정보처리방침</h1>
      <section style={sectionStyle}>
        <p>
          본 페이지는 TALKPIK AI 의 임시 개인정보 처리 안내입니다. 정식
          개인정보처리방침은 한국 개인정보보호법 준수 사항을 반영해 운영
          시작 전 별도 게시 예정입니다.
        </p>
      </section>
      <section style={sectionStyle}>
        <h2>임시 안내</h2>
        <ul>
          <li>
            <strong>수집 항목:</strong> 이메일, 이름, 학습 활동 로그, 글쓰기
            제출물, 평가 결과.
          </li>
          <li>
            <strong>이용 목적:</strong> 계정 식별, 학습 진도 추적, AI
            피드백 품질 개선.
          </li>
          <li>
            <strong>보관 기간:</strong> 회원 탈퇴 시 즉시 파기. 학습 통계는
            식별 정보 제거 후 익명 형태로 보관 가능.
          </li>
          <li>
            <strong>제3자 제공:</strong> 없음. 단 AI 모델 호출 시 글쓰기
            제출 본문은 외부 LLM 제공자에게 일시 전송됨 (모델 응답 후 보관
            정책은 모델 제공자 약관 적용).
          </li>
          <li>
            정식 처리방침이 게시되면 본 페이지가 갱신되며, 변경 내용은
            가입 사용자에게 별도 안내됩니다.
          </li>
        </ul>
      </section>
      <section style={sectionStyle}>
        <p>
          관련:{" "}
          <Link href="/terms">이용약관</Link>
          {" · "}
          <Link href="/">홈</Link>
          {" · "}
          <Link href="/sign-up">가입</Link>
        </p>
      </section>
    </main>
  );
}
