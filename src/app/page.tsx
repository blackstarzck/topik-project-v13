import type { Metadata } from "next";

import { FeatureCard } from "@/components/landing/FeatureCard";
import { Hero } from "@/components/landing/Hero";

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

export default function HomePage() {
  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "0 16px 64px" }}>
      <Hero />
      <div style={featureGridStyle}>
        <FeatureCard
          emoji="📊"
          title="학습 대시보드"
          description="목표 등급, 학습 시간, 약점 영역을 한 화면에서 확인합니다."
        />
        <FeatureCard
          emoji="✍️"
          title="AI 글쓰기 피드백"
          description="TOPIK 51~54번 글쓰기 환경 그대로. AI가 차원별 점수와 첨삭을 제공합니다."
        />
        <FeatureCard
          emoji="📚"
          title="자료실"
          description="저장한 문제, 제출 답안, 비교 보고서를 한 자리에서 관리합니다."
        />
      </div>
    </main>
  );
}
