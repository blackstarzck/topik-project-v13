import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDashboardKpi } from "@/lib/learning/kpi";
import { getLearningGoal } from "@/lib/learning/server";
import {
  getWeakDimensions,
  getWeaknessRecommendations,
} from "@/lib/practice/weakness";
import {
  GrowthDashboard,
  type GrowthDashboardProps,
} from "@/components/growth/GrowthDashboard";
import { GrowthLoadError } from "@/components/growth/GrowthLoadError";

export const metadata: Metadata = { title: "성장 대시보드 — TALKPIK" };

async function loadGrowthData(
  userId: string,
): Promise<GrowthDashboardProps | null> {
  try {
    const goal = await getLearningGoal(userId);
    const supabase = await createSupabaseServerClient();
    const [kpi, weak, recs, feedbackCount] = await Promise.all([
      getDashboardKpi(userId, supabase),
      getWeakDimensions(userId),
      getWeaknessRecommendations(userId),
      supabase
        .from("writing_feedback")
        .select("submission_id", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);

    return {
      hasGoal: Boolean(goal),
      kpi: {
        totalAttempts: kpi.totalAttempts,
        totalFeedback: feedbackCount.count ?? 0,
        goalAchieved: false,
        goalLabel: goal ? `${goal.target_grade}급` : "미설정",
      },
      weakDimensions: weak.map((w) => ({
        dimension: w.dimension,
        avgScore: w.avgScore,
        sampleCount: w.sampleCount,
      })),
      recommendations: recs.map((r) => ({
        problemId: r.problemId,
        title: r.title,
        questionNo: r.questionNo,
      })),
    };
  } catch {
    // area 2/3 예외: 데이터/차트 로드 실패 시 재시도 동선을 제공한다.
    return null;
  }
}

export default async function GrowthPage() {
  const user = await requireUser();
  const data = await loadGrowthData(user.id);

  if (!data) return <GrowthLoadError />;

  return (
    <GrowthDashboard
      hasGoal={data.hasGoal}
      kpi={data.kpi}
      weakDimensions={data.weakDimensions}
      recommendations={data.recommendations}
    />
  );
}
