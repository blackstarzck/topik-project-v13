import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getDimensionTabSummaries,
  getWeakDimensions,
  getWeaknessRecommendations,
} from "@/lib/practice/weakness";
import { WeaknessView } from "@/components/practice/WeaknessView";
import { AppCard } from "@/components/shared/AppCard";
import { PageHeader } from "@/components/shared/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("practice.weakness");
  return { title: t("metaTitle") };
}

/** 유료에 해당하는 plan_label (growth 페이지와 동일 기준). */
const PAID_PLAN_LABELS = new Set([
  "premium",
  "pro",
  "team",
  "yearly",
  "quarterly",
  "monthly",
]);

function isLocked(planLabel: string | null): boolean {
  if (!planLabel) return true;
  return !PAID_PLAN_LABELS.has(planLabel.toLowerCase());
}

/**
 * X-07 약점 기반 추천 (`/practice/weakness`).
 *
 * description region 1 예외: 유료 잠금이면 추천 본문 대신 업그레이드 안내 표시.
 * 잠금 판정은 growth 페이지와 동일하게 profiles.plan_label 기준.
 */
export default async function PracticeWeaknessPage() {
  const t = await getTranslations("practice.weakness");
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_label")
    .eq("id", user.id)
    .maybeSingle();
  const planLabel = profile?.plan_label ?? null;

  // 유료 잠금 — 추천 본문 대신 업그레이드 안내(paywall gate).
  // NOTE: 이 분기는 server component이다. 공유 surface는 AppCard(plain antd Card
  // 래퍼, "use client" 없음 → RSC 안전, 로그인/공개 페이지에서 검증됨)로 쓰고, 안내
  // 본문은 복합 antd(Typography.Title 등) 없이 plain HTML + Link로 유지해 prod React
  // #130을 피한다.
  if (isLocked(planLabel)) {
    return (
      <div className="app-workspace-narrow" data-testid="weakness-locked-shell">
        <PageHeader title={t("pageTitle")} />
        <AppCard className="text-center" data-testid="weakness-locked-card">
          <span
            aria-hidden="true"
            className="inline-flex size-12 items-center justify-center rounded-full border border-border bg-surface text-text"
          >
            <LockKeyhole size={24} />
          </span>
          <h2 className="mt-2 text-xl font-semibold">{t("lockTitle")}</h2>
          <p className="text-text-secondary">
            {t("lockBody", { plan: planLabel ?? t("planFree") })}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link
              data-testid="weakness-upgrade-plan"
              href="/paywall"
              className="inline-flex min-h-8 items-center rounded-full border border-primary bg-primary px-4 text-sm font-medium text-background"
            >
              {t("upgradePlan")}
            </Link>
            <Link
              data-testid="weakness-view-problems"
              href="/practice/problems"
              className="inline-flex min-h-8 items-center rounded-full border border-border bg-background px-4 text-sm font-medium text-text"
            >
              {t("viewProblemList")}
            </Link>
          </div>
        </AppCard>
      </div>
    );
  }

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
    <>
      <PageHeader title={t("pageTitle")} />
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
          // 이 페이지는 region-1 예외로 무료 사용자를 통째로 차단하므로
          // 여기 도달한 사용자는 모두 유료다 → 개별 카드 잠금 없음.
          locked: false,
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
    </>
  );
}
