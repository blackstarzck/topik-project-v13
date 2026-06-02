import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getWeakDimensions,
  getWeaknessRecommendations,
} from "@/lib/practice/weakness";
import { WeaknessView } from "@/components/practice/WeaknessView";

export const metadata: Metadata = { title: "약점 보강 — TALKPIK" };

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
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_label")
    .eq("id", user.id)
    .maybeSingle();
  const planLabel = profile?.plan_label ?? null;

  // 유료 잠금 — 추천 본문 대신 업그레이드 안내(paywall gate).
  // NOTE: 이 분기는 server component이므로 antd 복합 컴포넌트(Typography.Title 등)를
  // 직접 쓰면 prod React #130을 유발한다. 잠금 안내는 plain HTML + Link로만 구성한다.
  if (isLocked(planLabel)) {
    return (
      <main style={{ padding: 24, maxWidth: 560, margin: "0 auto" }}>
        <h1>약점 보강</h1>
        <div
          style={{
            border: "1px solid #f0f0f0",
            borderRadius: 8,
            padding: 24,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 40 }} aria-hidden>
            🔒
          </div>
          <h2 style={{ marginTop: 8 }}>
            약점 기반 맞춤 추천은 유료 플랜 전용이에요
          </h2>
          <p style={{ color: "rgba(0,0,0,0.45)" }}>
            현재 플랜: {planLabel ?? "무료"}. 이 플랜에서는 약점 진단과 맞춤
            추천이 잠겨 있어요. 업그레이드하면 영역별 진단과 추천 문제가 모두
            열립니다.
          </p>
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "center",
              flexWrap: "wrap",
              marginTop: 16,
            }}
          >
            <Link
              href="/paywall"
              style={{
                background: "#1677ff",
                color: "#fff",
                padding: "6px 16px",
                borderRadius: 6,
              }}
            >
              플랜 업그레이드
            </Link>
            <Link
              href="/practice/problems"
              style={{
                border: "1px solid #d9d9d9",
                padding: "6px 16px",
                borderRadius: 6,
              }}
            >
              문제 목록 보기
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const [dimSummaries, recs, lastFeedback] = await Promise.all([
    getWeakDimensions(user.id),
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
        updatedAt={lastFeedback.data?.generated_at ?? null}
      />
    </main>
  );
}
