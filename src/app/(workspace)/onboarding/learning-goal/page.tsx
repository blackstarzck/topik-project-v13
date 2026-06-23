import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GraduationCap } from "@/components/shared/AppIcons";
import { WorkspaceBody } from "@/components/app/WorkspaceBody";
import { AuthIdentityNotice } from "@/components/auth/AuthIdentityNotice";
import { LearningGoalForm } from "@/components/learning/LearningGoalForm";
import { AppCard } from "@/components/shared/AppCard";
import { getLearningGoal } from "@/lib/learning/server";
import { requireUser } from "@/lib/auth/session";
import { OnboardingNavCta } from "./OnboardingNavCta";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding.page");
  return { title: t("metaTitle") };
}

export default async function OnboardingLearningGoalPage() {
  const t = await getTranslations("onboarding.page");
  const user = await requireUser();
  const goal = await getLearningGoal(user.id);

  return (
    <WorkspaceBody className="text-text">
      <div className="mb-4">
        <AuthIdentityNotice />
      </div>
      <section
        className="mx-auto w-full max-w-4xl"
        aria-label={t("heroTitle")}
      >
        <AppCard>
          <div className="onboarding-goal-shell grid gap-12 md:gap-14">
            <div className="mx-auto grid max-w-3xl justify-items-center gap-3 text-center">
              <GraduationCap size={30} aria-hidden="true" />
              <p className="m-0 text-xs font-semibold uppercase tracking-normal text-text-secondary">
                {t("heroEyebrow")}
              </p>
              <h1 className="m-0 text-3xl font-semibold leading-tight text-text">
                {t("heroTitle")}
              </h1>
              <span className="max-w-xl text-sm leading-6 text-text-secondary">
                {t("heroBody")}
              </span>
            </div>

            <div className="onboarding-goal-cta-flow mx-auto grid w-full max-w-3xl gap-1">
              <LearningGoalForm
                userId={user.id}
                defaultValues={goal}
                showIntro={false}
              />
              <OnboardingNavCta userId={user.id} />
            </div>
          </div>
        </AppCard>
      </section>
    </WorkspaceBody>
  );
}
