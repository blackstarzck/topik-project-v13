import type { Metadata } from "next";
import { Space } from "antd";
import { LearningGoalForm } from "@/components/learning/LearningGoalForm";
import { getLearningGoal } from "@/lib/learning/server";
import { requireUser } from "@/lib/auth/session";
import { OnboardingSteps } from "./OnboardingSteps";

export const metadata: Metadata = { title: "학습 목표 설정 — TALKPIK" };

export default async function OnboardingLearningGoalPage() {
  const user = await requireUser();
  const goal = await getLearningGoal(user.id);
  return (
    <main style={{ maxWidth: 640, margin: "0 auto" }}>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {/* A-03 area 1 — onboarding step indicator (current/total, 1/3 fallback). */}
        <OnboardingSteps />
        <LearningGoalForm userId={user.id} defaultValues={goal} />
      </Space>
    </main>
  );
}
