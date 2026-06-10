import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Suspense } from "react";
import { ChartNoAxesCombined, Goal, MessageCircleHeart } from "lucide-react";

import { AuthMascot } from "@/components/auth/AuthMascot";
import { LoginForm } from "@/components/auth/LoginForm";
import { PageContainer } from "@/components/shared/PageContainer";
import { PublicShell } from "@/components/shared/PublicShell";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("metaTitle") };
}

const loginHighlights = [
  {
    icon: Goal,
    titleKey: "heroGoalTitle",
    bodyKey: "heroGoalBody",
  },
  {
    icon: MessageCircleHeart,
    titleKey: "heroFeedbackTitle",
    bodyKey: "heroFeedbackBody",
  },
  {
    icon: ChartNoAxesCombined,
    titleKey: "heroGrowthTitle",
    bodyKey: "heroGrowthBody",
  },
] as const;

export default async function LoginPage() {
  const t = await getTranslations("auth.login");
  const tSignUp = await getTranslations("auth.signUp");
  const tMascot = await getTranslations("auth.mascot");

  return (
    <PublicShell className="signup-public-shell">
      <PageContainer
        size="wide"
        className="signup-page"
        aria-label={t("pageHeading")}
      >
        <section className="signup-shell-card" aria-labelledby="login-title">
          <div className="signup-hero-panel">
            <Link href="/" className="signup-brand" aria-label="TALKPIK AI">
              <span className="signup-brand__mark" aria-hidden="true">
                T
              </span>
              <span>
                Talkpik <strong>AI</strong>
              </span>
            </Link>

            <div className="signup-hero-copy">
              <p className="signup-eyebrow">{t("heroEyebrow")}</p>
              <h2>{t("heroTitle")}</h2>
              <p>{t("heroBody")}</p>
            </div>

            <div className="signup-mascot-row">
              <div className="signup-mascot-figure">
                <AuthMascot alt={tMascot("loginAlt")} emoji="✏️" size={96} />
              </div>
              <div className="signup-mascot-note">
                <strong>{t("mascotTitle")}</strong>
                <p>{t("mascotBody")}</p>
              </div>
            </div>

            <div
              className="signup-benefit-strip"
              aria-label={t("benefitStripAria")}
            >
              {loginHighlights.map((item) => {
                const Icon = item.icon;
                return (
                  <div className="signup-benefit" key={item.titleKey}>
                    <span className="signup-benefit__icon" aria-hidden="true">
                      <Icon size={20} strokeWidth={2} />
                    </span>
                    <span>
                      <strong>{t(item.titleKey)}</strong>
                      <small>{t(item.bodyKey)}</small>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="signup-form-panel">
            <div className="signup-login-prompt">
              <span>{t("noAccountPrompt")}</span>
              <Link href="/sign-up">{tSignUp("pageHeading")}</Link>
            </div>

            <div className="signup-form-heading">
              <MessageCircleHeart size={34} aria-hidden="true" />
              <h1 id="login-title">{t("pageHeading")}</h1>
              <p>{t("formSubtitle")}</p>
            </div>

            <div className="signup-form-surface">
              <Suspense fallback={null}>
                <LoginForm />
              </Suspense>
            </div>
          </div>
        </section>
      </PageContainer>
    </PublicShell>
  );
}
