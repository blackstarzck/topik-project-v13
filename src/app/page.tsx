import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { FeatureCard } from "@/components/landing/FeatureCard";
import { Hero } from "@/components/landing/Hero";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { ProductPreview } from "@/components/landing/ProductPreview";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing");
  return { title: t("metaTitle") };
}

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
  // §6 기능 카드 문구는 landing.features.* 카탈로그에서 서버측 getTranslations로
  // 해석해 FeatureCard(범용 컴포넌트)에 props로 전달한다.
  const t = await getTranslations("landing.features");

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "0 16px 64px" }}>
      {/* §1 헤더/내비 — 로고 + 메뉴(4개 이하) + auth-aware CTA */}
      <LandingHeader isAuthenticated={Boolean(user)} />
      {/* §2 히어로 카피 + §3 시작 CTA + §5 마스코트 */}
      <Hero isAuthenticated={Boolean(user)} />
      {/* §6: 4개 이하 카드 — AI 첨삭 / 실전 문제 / 성장 리포트 / 라이브러리 */}
      <section id="features">
        <div style={featureGridStyle}>
          <FeatureCard
            emoji="✍️"
            title={t("correctionTitle")}
            description={t("correctionDescription")}
          />
          <FeatureCard
            emoji="📝"
            title={t("practiceTitle")}
            description={t("practiceDescription")}
          />
          <FeatureCard
            emoji="📈"
            title={t("reportTitle")}
            description={t("reportDescription")}
          />
          <FeatureCard
            emoji="📚"
            title={t("libraryTitle")}
            description={t("libraryDescription")}
          />
        </div>
      </section>
      {/* §4 제품 프리뷰 — 3장 이하, 이미지 실패 시 요약 카드 fallback */}
      <ProductPreview />
    </main>
  );
}
