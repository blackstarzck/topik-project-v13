import type { Metadata } from "next";
import Link from "next/link";

// Codex P4 D4 placeholder — codex 위임 결정으로 신설된 약관 페이지.
// 정식 법무 검토된 약관은 운영 진입 전에 별도 작업으로 게시. 현 페이지는
// 사용자가 가입 시 동의 체크박스 라벨에서 클릭했을 때 "동의 대상이 무엇인지"
// 최소 disclosure 를 제공하는 placeholder.

export const metadata: Metadata = { title: "이용약관 — TALKPIK" };

const sectionStyle: React.CSSProperties = {
  marginBottom: 24,
};

export default function TermsPage() {
  return (
    <main style={{ padding: "2.5rem 1rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>이용약관</h1>
      <section style={sectionStyle}>
        <p>
          본 페이지는 TALKPIK AI 서비스의 임시 이용약관 안내입니다. 정식
          이용약관은 운영 시작 전 별도 게시 예정이며, 그 시점에 본 페이지가
          공식 약관으로 갱신됩니다.
        </p>
      </section>
      <section style={sectionStyle}>
        <h2>임시 안내</h2>
        <ul>
          <li>본 서비스는 TOPIK 글쓰기 학습을 보조하는 도구입니다.</li>
          <li>학습 데이터는 학습 품질 개선 목적에만 사용됩니다.</li>
          <li>
            개인정보 처리 방식은{" "}
            <Link href="/privacy">개인정보처리방침</Link> 페이지를
            참고해주세요.
          </li>
          <li>
            정식 약관이 게시되면 가입 시 다시 동의를 받습니다. 현재 가입은
            본 임시 안내에 대한 동의로 처리됩니다.
          </li>
        </ul>
      </section>
      <section style={sectionStyle}>
        <p>
          문의: 정식 약관 게시 전까지는 운영 채널이 준비되지 않았습니다.
          가입 후 사용 중 문제가 발생하면 인증 오류 페이지의 도움말 링크를
          참고해주세요.
        </p>
      </section>
      <section style={sectionStyle}>
        <p>
          <Link href="/">홈으로</Link>
          {" · "}
          <Link href="/sign-up">가입으로 돌아가기</Link>
        </p>
      </section>
    </main>
  );
}
