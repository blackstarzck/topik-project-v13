import type { Metadata } from "next";
import { Space } from "antd";
import { getTranslations } from "next-intl/server";
import { LearningGoalForm } from "@/components/learning/LearningGoalForm";
import { AppCard } from "@/components/shared/AppCard";
import { getLearningGoal } from "@/lib/learning/server";
import { requireUser } from "@/lib/auth/session";
import { OnboardingSteps } from "./OnboardingSteps";
import { OnboardingNavCta } from "./OnboardingNavCta";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding.page");
  return { title: t("metaTitle") };
}

export default async function OnboardingLearningGoalPage() {
  const user = await requireUser();
  const goal = await getLearningGoal(user.id);
  return (
    <div className="app-workspace-narrow">
      <Space orientation="vertical" size="large" style={{ width: "100%" }}>
        {/* A-03 area 1 — onboarding step indicator (current/total, 1/3 fallback). */}
        <OnboardingSteps />
        <AppCard>
          <LearningGoalForm userId={user.id} defaultValues={goal} />
        </AppCard>
        {/* A-03 area 4 — 이전/다음 CTA 보조 분기(이전 단계 수정 / 건너뛰기). */}
        <OnboardingNavCta userId={user.id} />
      </Space>
    </div>
  );
}
