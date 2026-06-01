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
          // getWeakDimensions returns avgScore normalized to 0..1 so different
          // score_max ranges compare fairly. The UI (DiagnosticCard / DimensionTabs)
          // renders this as "평균 점수 N점" and a Progress percent on a 0..100 scale,
          // so a raw 0..1 value would show as 0~1점 / a near-empty bar. Convert to
          // a 0..100 percentage here at the presentation boundary.
          averageScore: Math.round(d.avgScore * 100),
          sampleCount: d.sampleCount,
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
