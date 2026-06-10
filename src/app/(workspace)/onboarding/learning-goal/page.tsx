import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  BarChart3,
  CheckCircle2,
  GraduationCap,
  MessageSquareText,
  Sparkles,
  Target,
} from "lucide-react";
import { LearningGoalForm } from "@/components/learning/LearningGoalForm";
import { getLearningGoal } from "@/lib/learning/server";
import { requireUser } from "@/lib/auth/session";
import { OnboardingNavCta } from "./OnboardingNavCta";
import { OnboardingSteps } from "./OnboardingSteps";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding.page");
  return { title: t("metaTitle") };
}

export default async function OnboardingLearningGoalPage() {
  const t = await getTranslations("onboarding.page");
  const user = await requireUser();
  const goal = await getLearningGoal(user.id);

  return (
    <div className="onboarding-goal-workspace">
      <section className="onboarding-goal-shell" aria-label={t("heroTitle")}>
        <aside className="onboarding-goal-hero">
          <div className="onboarding-goal-brand">
            <span className="onboarding-goal-brand__mark" aria-hidden="true">
              <Sparkles size={20} />
            </span>
            <span>
              <strong>Talkpik AI</strong>
              <small>{t("brandSubtitle")}</small>
            </span>
          </div>

          <div className="onboarding-goal-speech">
            <strong>{t("mascotTitle")}</strong>
            <span>{t("mascotBody")}</span>
          </div>

          <div className="onboarding-goal-mascot" aria-hidden="true">
            <div className="onboarding-goal-mascot__badge">
              <Target size={70} strokeWidth={1.7} />
            </div>
            <div className="onboarding-goal-mascot__pencil" />
          </div>

          <div
            className="onboarding-goal-benefits"
            aria-label={t("benefitStripAria")}
          >
            <div className="onboarding-goal-benefit">
              <span className="onboarding-goal-benefit__icon is-mint">
                <CheckCircle2 size={22} />
              </span>
              <span>
                <strong>{t("benefitRecommendationTitle")}</strong>
                <small>{t("benefitRecommendationBody")}</small>
              </span>
            </div>
            <div className="onboarding-goal-benefit">
              <span className="onboarding-goal-benefit__icon is-blue">
                <MessageSquareText size={22} />
              </span>
              <span>
                <strong>{t("benefitFeedbackTitle")}</strong>
                <small>{t("benefitFeedbackBody")}</small>
              </span>
            </div>
            <div className="onboarding-goal-benefit">
              <span className="onboarding-goal-benefit__icon is-coral">
                <BarChart3 size={22} />
              </span>
              <span>
                <strong>{t("benefitReportTitle")}</strong>
                <small>{t("benefitReportBody")}</small>
              </span>
            </div>
          </div>
        </aside>

        <main className="onboarding-goal-main">
          <div className="onboarding-goal-steps">
            <OnboardingSteps />
          </div>

          <div className="onboarding-goal-heading">
            <GraduationCap size={30} aria-hidden="true" />
            <p>{t("heroEyebrow")}</p>
            <h1>{t("heroTitle")}</h1>
            <span>{t("heroBody")}</span>
          </div>

          <LearningGoalForm
            userId={user.id}
            defaultValues={goal}
            showIntro={false}
          />

          <OnboardingNavCta userId={user.id} />
        </main>
      </section>
    </div>
  );
}
