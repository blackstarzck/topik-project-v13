import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { FeatureCard } from "@/components/landing/FeatureCard";
import { Hero } from "@/components/landing/Hero";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { ProductPreview } from "@/components/landing/ProductPreview";
import { PageContainer } from "@/components/shared/PageContainer";
import { PublicShell } from "@/components/shared/PublicShell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing");
  return { title: t("metaTitle") };
}

const featureGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 16,
  marginTop: 48,
};

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const t = await getTranslations("landing.features");

  return (
    <PublicShell className="landing-public-shell">
      <PageContainer size="wide" className="landing-page">
        <section id="top" className="landing-hero-stage">
          <video
            className="landing-hero-video"
            src="/assets/landing-hero-video.mp4"
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
          />
          <div className="landing-hero-video-overlay" aria-hidden="true" />
          <div className="landing-hero-shell">
            <LandingHeader isAuthenticated={Boolean(user)} />
            <Hero isAuthenticated={Boolean(user)} />
          </div>
        </section>

        <div className="landing-content-shell">
          <section id="features" className="landing-section">
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
          <section className="landing-section">
            <ProductPreview />
          </section>
        </div>
      </PageContainer>
    </PublicShell>
  );
}
