import type { Metadata } from "next";

import { FeatureCard } from "@/components/landing/FeatureCard";
import { Hero } from "@/components/landing/Hero";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "TALKPIK AI · TOPIK 글쓰기 AI 학습",
};

// Plain CSS grid keeps this page a Server Component (no antd Row/Col import).
// See Codex P2-01 (Phase 7-B post-impl review 2026-05-26).
const featureGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 16,
  marginTop: 48,
};

export default async function HomePage() {
  // description §1/§3 exception: logged-in visitor gets a 대시보드 CTA.
  // Reading the session keeps the public default for anonymous visitors.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "0 16px 64px" }}>
      <Hero isAuthenticated={Boolean(user)} />
      {/* description §6: 4개 이하 카드 — AI 첨삭 / 실전 문제 / 성장 리포트 / 라이브러리 */}
      <div style={featureGridStyle}>
        <FeatureCard
          emoji="✍️"
          title="AI 첨삭"
          description="TOPIK 51~54번 글쓰기 환경 그대로. AI가 차원별 점수와 첨삭을 제공합니다."
        />
        <FeatureCard
          emoji="📝"
          title="실전 문제"
          description="51~54번 유형별 실전 문제로 시험과 같은 조건에서 글쓰기를 연습합니다."
        />
        <FeatureCard
          emoji="📈"
          title="성장 리포트"
          description="제출 답안을 비교해 점수 변화와 약점 영역을 한눈에 확인합니다."
        />
        <FeatureCard
          emoji="📚"
          title="라이브러리"
          description="저장한 문제, 제출 답안, 비교 보고서를 한 자리에서 관리합니다."
        />
      </div>
    </main>
  );
}
