import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import {
  BookOpenCheck,
  ChartNoAxesCombined,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";

import { AuthMascot } from "@/components/auth/AuthMascot";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { PageContainer } from "@/components/shared/PageContainer";
import { PublicShell } from "@/components/shared/PublicShell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signUp");
  return { title: t("metaTitle") };
}

// description region 2: benefit chips stay at three items or fewer.
const benefitChipKeys = [
  "benefitFreeTrial",
  "benefitRealExam",
  "benefitWeaknessReport",
] as const;

const heroHighlights = [
  {
    icon: ShieldCheck,
    titleKey: "heroAiFeedbackTitle",
    bodyKey: "heroAiFeedbackBody",
  },
  {
    icon: ChartNoAxesCombined,
    titleKey: "heroGrowthTitle",
    bodyKey: "heroGrowthBody",
  },
  {
    icon: FileCheck2,
    titleKey: "heroPracticeTitle",
    bodyKey: "heroPracticeBody",
  },
] as const;

export default async function SignUpPage() {
  const t = await getTranslations("auth.signUp");
  const tCommon = await getTranslations("common");
  const tMascot = await getTranslations("auth.mascot");

  return (
    <PublicShell className="signup-public-shell">
      <PageContainer
        size="wide"
        className="signup-page"
        aria-label={t("pageHeading")}
      >
        <section className="signup-shell-card" aria-labelledby="signup-title">
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
                <AuthMascot alt={tMascot("signUpAlt")} emoji="✏️" size={96} />
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
              {heroHighlights.map((item) => {
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
              <span>{t("haveAccountPrompt")}</span>
              <Link href="/login">{tCommon("login")}</Link>
            </div>

            <div className="signup-form-heading">
              <BookOpenCheck size={34} aria-hidden="true" />
              <h1 id="signup-title">{t("pageHeading")}</h1>
              <p>{t("formSubtitle")}</p>
              <div className="signup-chip-row">
                {benefitChipKeys.map((key) => (
                  <span key={key}>{t(key)}</span>
                ))}
              </div>
            </div>

            <div className="signup-form-surface">
              <SignUpForm />
            </div>
          </div>
        </section>
      </PageContainer>
    </PublicShell>
  );
}
