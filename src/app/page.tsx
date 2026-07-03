import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Hero } from "@/components/landing/Hero";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { PortfolioLandingLayout } from "@/components/landing/PortfolioLandingLayout";
import { PageContainer } from "@/components/shared/PageContainer";
import { PublicShell } from "@/components/shared/PublicShell";
import { getCurrentLandingAuthStatus } from "@/lib/auth/completion";

// The landing CTA branches on the visitor's auth status, which is read from the
// session cookie (getCurrentLandingAuthStatus -> cookies()). That makes this
// route inherently dynamic; declaring it explicitly documents the intent and
// silences the DYNAMIC_SERVER_USAGE build log instead of leaving Next to infer
// it. See docs/qa/plan/2026-07-03-qa-defect-remediation-plan.md (QA-20260702-08).
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing");
  return { title: t("metaTitle") };
}

export default async function HomePage() {
  const authStatus = await getCurrentLandingAuthStatus();

  return (
    <PublicShell className="landing-public-shell">
      <PageContainer size="wide" className="landing-page">
        <section id="top" className="landing-hero-stage">
          <video
            className="landing-hero-video"
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
          >
            <source src="/assets/landing-hero-video.mp4" type="video/mp4" />
          </video>
          <div className="landing-hero-shell">
            <LandingHeader authStatus={authStatus} />
            <Hero authStatus={authStatus} />
          </div>
        </section>

        <PortfolioLandingLayout authStatus={authStatus} />
      </PageContainer>
    </PublicShell>
  );
}
