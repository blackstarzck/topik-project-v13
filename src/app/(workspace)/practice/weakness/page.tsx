import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getDimensionTabSummaries,
  getWeakDimensions,
  getWeaknessRecommendations,
} from "@/lib/practice/weakness";
import { WorkspaceBody } from "@/components/app/WorkspaceBody";
import { WeaknessView } from "@/components/practice/WeaknessView";
import { PageHeader } from "@/components/shared/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("practice.weakness");
  return { title: t("metaTitle") };
}

/**
 * X-07 약점 기반 추천 (`/practice/weakness`).
 *
 * Billing is deferred, so this route must not gate by plan_label or link users
 * into checkout/paywall behavior. Data 부족 상태는 X-07 예외 상태로 화면 안에서
 * 처리하고, 사용자는 문제 목록으로 이어갈 수 있다.
 */
export default async function PracticeWeaknessPage() {
  const t = await getTranslations("practice.weakness");
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const [dimSummaries, tabSummaries, recs, lastFeedback] = await Promise.all([
    getWeakDimensions(user.id),
    // X-07 §2 — all four weakness tabs (incl. disabled under-sampled).
    getDimensionTabSummaries(user.id),
    getWeaknessRecommendations(user.id),
    // 진단 카드의 "최근 답안 날짜" (description region 3 제약).
    supabase
      .from("writing_feedback")
      .select("generated_at")
      .eq("user_id", user.id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <WorkspaceBody className="app-cards-bordered">
      <PageHeader title={t("pageTitle")} subtitle={t("subtitle")} />
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
          item_id: r.itemId ?? null,
          estimated_minutes: r.estimatedMinutes ?? null,
        }))}
        tabSummaries={tabSummaries.map((t) => ({
          dimension: t.dimension,
          avgScore: t.avgScore,
          sampleCount: t.sampleCount,
          ready: t.ready,
          neededAnswerCount: t.neededAnswerCount,
        }))}
        updatedAt={lastFeedback.data?.generated_at ?? null}
      />
    </WorkspaceBody>
  );
}
