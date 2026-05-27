import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Col, Row, Space } from "antd";
import { requireUser } from "@/lib/auth/session";
import { getProfileSettings } from "@/lib/settings/server";
import { getLearningGoal } from "@/lib/learning/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ExamInfoCard } from "@/components/profile/ExamInfoCard";
import { StatusHelpCard } from "@/components/profile/StatusHelpCard";

export const metadata: Metadata = { title: "프로필 — TALKPIK" };

export default async function ProfilePage() {
  const user = await requireUser();
  const settings = await getProfileSettings(user.id);
  if (!settings) notFound();

  // Phase 7-E Task 10 (P1-6) — exam info from learning_goals (reuse, no duplicate
  // state) + status meta from profiles row (created_at + app_role + plan_label).
  const goal = await getLearningGoal(user.id);
  const supabase = await createSupabaseServerClient();
  const { data: profileMeta } = await supabase
    .from("profiles")
    .select("created_at, app_role, plan_label")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <h1>프로필</h1>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={14}>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <ProfileForm
              userId={user.id}
              initialProfile={{
                display_name: settings.display_name,
                nickname: settings.nickname,
                bio: settings.bio,
              }}
            />
          </Space>
        </Col>
        <Col xs={24} md={10}>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <ExamInfoCard
              goal={
                goal
                  ? {
                      topik_level: goal.topik_level,
                      target_grade: goal.target_grade,
                      exam_date: goal.exam_date,
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
          </Space>
        </Col>
      </Row>
    </main>
  );
}
