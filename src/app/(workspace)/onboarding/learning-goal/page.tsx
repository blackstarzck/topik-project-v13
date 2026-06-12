import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import {
  BarChart3,
  CheckCircle2,
  GraduationCap,
  MessageSquareText,
  Sparkles,
  Target,
} from "lucide-react";
import { WorkspaceBody } from "@/components/app/WorkspaceBody";
import { LearningGoalForm } from "@/components/learning/LearningGoalForm";
import { AppCard } from "@/components/shared/AppCard";
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
    <WorkspaceBody className="text-text">
      <section
        className="grid gap-6 lg:grid-cols-2"
        aria-label={t("heroTitle")}
      >
        <aside>
          <AppCard>
            <div className="grid gap-8">
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-default bg-primary text-background"
                  aria-hidden="true"
                >
                  <Sparkles size={18} />
                </span>
                <span className="grid gap-1">
                  <strong className="text-xl leading-none">Talkpik AI</strong>
                  <small className="text-xs font-semibold text-text-secondary">
                    {t("brandSubtitle")}
                  </small>
                </span>
              </div>

              <div className="grid gap-3">
                <p className="m-0 text-sm font-semibold text-text">
                  {t("mascotTitle")}
                </p>
                <p className="m-0 max-w-lg text-sm leading-6 text-text-secondary">
                  {t("mascotBody")}
                </p>
              </div>

              <div
                className="grid place-items-center rounded-3xl bg-surface p-8"
                aria-hidden="true"
              >
                <div className="flex aspect-square w-44 -rotate-6 items-center justify-center rounded-3xl border border-border bg-background">
                  <Target size={76} />
                </div>
              </div>

              <div className="grid gap-3" aria-label={t("benefitStripAria")}>
                <OnboardingBenefit
                  icon={<CheckCircle2 size={20} />}
                  title={t("benefitRecommendationTitle")}
                  body={t("benefitRecommendationBody")}
                />
                <OnboardingBenefit
                  icon={<MessageSquareText size={20} />}
                  title={t("benefitFeedbackTitle")}
                  body={t("benefitFeedbackBody")}
                />
                <OnboardingBenefit
                  icon={<BarChart3 size={20} />}
                  title={t("benefitReportTitle")}
                  body={t("benefitReportBody")}
                />
              </div>
            </div>
          </AppCard>
        </aside>

        <div>
          <AppCard>
            <div className="grid gap-8">
              <OnboardingSteps />

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

              <LearningGoalForm
                userId={user.id}
                defaultValues={goal}
                showIntro={false}
              />

              <OnboardingNavCta userId={user.id} />
            </div>
          </AppCard>
        </div>
      </section>
    </WorkspaceBody>
  );
}

function OnboardingBenefit({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-surface p-4">
      <span className="mt-0.5 inline-flex text-text" aria-hidden="true">
        {icon}
      </span>
      <span className="grid gap-1">
        <strong className="text-sm leading-5 text-text">{title}</strong>
        <small className="text-xs leading-5 text-text-secondary">{body}</small>
      </span>
    </div>
  );
}
