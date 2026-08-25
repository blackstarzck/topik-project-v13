import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ExamGoalForm } from "@/components/profile/ExamGoalForm";
import { PageHeader } from "@/components/shared/PageHeader";
import { SettingsPageFrame } from "@/components/shared/SettingsPageFrame";
import { requireUser } from "@/lib/auth/session";
import { getLearningGoal } from "@/lib/learning/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.learning");
  return { title: t("metaTitle") };
}

export default async function LearningSettingsPage() {
  const t = await getTranslations("settings.learning");
  const user = await requireUser();
  const goal = await getLearningGoal(user.id);

  return (
    <SettingsPageFrame>
      <PageHeader title={t("pageHeading")} subtitle={t("pageSubtitle")} />
      <ExamGoalForm
        userId={user.id}
        goal={
          goal
            ? {
                topik_level: goal.topik_level,
                target_grade: goal.target_grade,
                exam_date: goal.exam_date,
                weekly_goal_minutes: goal.weekly_goal_minutes,
                weak_areas: goal.weak_areas,
              }
            : null
        }
      />
    </SettingsPageFrame>
  );
}
