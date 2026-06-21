import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WorkspaceBody } from "@/components/app/WorkspaceBody";
import { ExamInfoCard } from "@/components/profile/ExamInfoCard";
import { PageHeader } from "@/components/shared/PageHeader";
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
    <WorkspaceBody>
      <div className="w-full max-w-[640px]">
        <PageHeader title={t("pageHeading")} subtitle={t("pageSubtitle")} />
        <ExamInfoCard
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
      </div>
    </WorkspaceBody>
  );
}
