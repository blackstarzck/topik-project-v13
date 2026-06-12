import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Col, Row } from "antd";
import { requireUser } from "@/lib/auth/session";
import { getProfileSettings } from "@/lib/settings/server";
import { getLearningGoal } from "@/lib/learning/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ExamInfoCard } from "@/components/profile/ExamInfoCard";
import { StatusHelpCard } from "@/components/profile/StatusHelpCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { WorkspaceBody } from "@/components/app/WorkspaceBody";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile.page");
  return { title: t("metaTitle") };
}

export default async function ProfilePage() {
  const t = await getTranslations("profile.page");
  const user = await requireUser();
  const settings = await getProfileSettings(user.id);
  if (!settings) notFound();

  // Phase 7-E Task 10 (P1-6) — exam info from learning_goals (reuse, no duplicate
  // state) + status meta from profiles row (created_at + app_role + plan_label).
  const goal = await getLearningGoal(user.id);
  const supabase = await createSupabaseServerClient();
  const { data: profileMeta } = await supabase
    .from("profiles")
    .select("created_at, app_role, plan_label, avatar_path")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <WorkspaceBody>
      <PageHeader title={t("heading")} />
      <Row gutter={[16, 16]}>
        <Col xs={24} md={14}>
          <div className="flex w-full flex-col gap-4">
            <ProfileForm
              userId={user.id}
              accountEmail={user.email ?? null}
              initialAvatarPath={profileMeta?.avatar_path ?? null}
              initialProfile={{
                display_name: settings.display_name,
                nickname: settings.nickname,
                bio: settings.bio,
              }}
            />
          </div>
        </Col>
        <Col xs={24} md={10}>
          <div className="flex w-full flex-col gap-4">
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
            {profileMeta ? (
              <StatusHelpCard
                joinedAt={profileMeta.created_at}
                appRole={profileMeta.app_role}
                planLabel={profileMeta.plan_label}
              />
            ) : null}
          </div>
        </Col>
      </Row>
    </WorkspaceBody>
  );
}
