import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import {
  getWeakDimensions,
  getWeaknessRecommendations,
} from "@/lib/practice/weakness";
import { WeaknessView } from "@/components/practice/WeaknessView";

export const metadata: Metadata = { title: "약점 보강 — TALKPIK" };

export default async function PracticeWeaknessPage() {
  const user = await requireUser();
  const [dimSummaries, recs] = await Promise.all([
    getWeakDimensions(user.id),
    getWeaknessRecommendations(user.id),
  ]);
  return (
    <main style={{ padding: 24 }}>
      <h1>약점 보강</h1>
      <WeaknessView
        weakDimensions={dimSummaries.map((d) => ({
          dimension: d.dimension,
          averageScore: d.avgScore,
        }))}
        recommendations={recs.map((r) => ({
          problem_id: r.problemId,
          title: r.title,
          question_no: r.questionNo ?? 0,
          reason: r.reason,
          source: r.source,
        }))}
      />
    </main>
  );
}
