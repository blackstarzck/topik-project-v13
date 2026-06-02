import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import {
  createSupabaseServerClient,
  type SupabaseServerClient,
} from "@/lib/supabase/server";
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
import type { GrowthTrendPoint } from "@/components/growth/GrowthTrendChart";

export const metadata: Metadata = { title: "성장 대시보드 — TALKPIK" };

const DAY_MS = 24 * 60 * 60 * 1000;

/** plan_label 이 유료에 해당하면 리포트 잠금 해제. */
const PAID_PLAN_LABELS = new Set(["premium", "pro", "team", "yearly", "quarterly", "monthly"]);

function isReportLocked(planLabel: string | null): boolean {
  if (!planLabel) return true;
  return !PAID_PLAN_LABELS.has(planLabel.toLowerCase());
}

function dayKey(iso: string): string {
  // KST(+9h) 기준 day bucket. 서버 TZ 의존 없이 오프셋 가산.
  const d = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

type FeedbackPoint = { generated_at: string; score_total: number | null };

/**
 * 일자별 시계열을 만든다.
 * - score: 해당 일자 writing_feedback.score_total 평균(0~100 정규화), 없으면 null.
 * - volume: 해당 일자 풀이/제출 study_events 수.
 */
function buildTrendPoints(
  feedbacks: FeedbackPoint[],
  events: { occurred_at: string; event_type: string }[],
): GrowthTrendPoint[] {
  const scoreBuckets = new Map<string, number[]>();
  for (const f of feedbacks) {
    if (f.score_total == null) continue;
    const key = dayKey(f.generated_at);
    const arr = scoreBuckets.get(key) ?? [];
    arr.push(f.score_total);
    scoreBuckets.set(key, arr);
  }

  const volumeBuckets = new Map<string, number>();
  const VOLUME_EVENTS = new Set(["attempt_submitted", "submission_submitted"]);
  for (const e of events) {
    if (!VOLUME_EVENTS.has(e.event_type)) continue;
    const key = dayKey(e.occurred_at);
    volumeBuckets.set(key, (volumeBuckets.get(key) ?? 0) + 1);
  }

  const allKeys = new Set<string>([...scoreBuckets.keys(), ...volumeBuckets.keys()]);
  const points: GrowthTrendPoint[] = Array.from(allKeys)
    .sort()
    .map((key) => {
      const scores = scoreBuckets.get(key);
      const avg =
        scores && scores.length > 0
          ? scores.reduce((a, b) => a + b, 0) / scores.length
          : null;
      return {
        date: key,
        score: avg != null ? Math.round(avg) : null,
        volume: volumeBuckets.get(key) ?? 0,
      };
    });
  return points;
}

/** 개선률(%) — 최근 절반 평균 vs 이전 절반 평균. */
function computeImprovementPct(feedbacks: FeedbackPoint[]): number | null {
  const scores = feedbacks
    .filter((f) => f.score_total != null)
    .map((f) => ({ at: new Date(f.generated_at).getTime(), s: f.score_total as number }))
    .sort((a, b) => a.at - b.at);
  if (scores.length < 4) return null;
  const mid = Math.floor(scores.length / 2);
  const earlier = scores.slice(0, mid);
  const later = scores.slice(mid);
  const avg = (arr: { s: number }[]) =>
    arr.reduce((a, b) => a + b.s, 0) / arr.length;
  const e = avg(earlier);
  const l = avg(later);
  if (e === 0) return null;
  return ((l - e) / e) * 100;
}

async function loadGrowthData(
  userId: string,
  supabase: SupabaseServerClient,
): Promise<GrowthDashboardProps | null> {
  try {
    const sinceIso = new Date(Date.now() - 90 * DAY_MS).toISOString();
    const recentVolumeSince = new Date(Date.now() - 30 * DAY_MS).toISOString();

    const goal = await getLearningGoal(userId);
    const [kpi, weak, recs, feedbackRes, eventsRes, recentRes, profileRes, recentVolRes] =
      await Promise.all([
        getDashboardKpi(userId, supabase),
        getWeakDimensions(userId),
        getWeaknessRecommendations(userId),
        supabase
          .from("writing_feedback")
          .select("generated_at, score_total")
          .eq("user_id", userId)
          .gte("generated_at", sinceIso)
          .order("generated_at", { ascending: true }),
        supabase
          .from("study_events")
          .select("occurred_at, event_type")
          .eq("user_id", userId)
          .gte("occurred_at", sinceIso),
        supabase
          .from("writing_feedback")
          .select(
            "submission_id, score_total, generated_at, writing_submissions!inner(question_no)",
          )
          .eq("user_id", userId)
          .order("generated_at", { ascending: false })
          .limit(5),
        supabase
          .from("profiles")
          .select("plan_label")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("study_events")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .in("event_type", ["attempt_submitted", "submission_submitted"])
          .gte("occurred_at", recentVolumeSince),
      ]);

    const feedbacks = (feedbackRes.data ?? []) as FeedbackPoint[];
    const events = (eventsRes.data ?? []) as {
      occurred_at: string;
      event_type: string;
    }[];

    // 평균 점수(0~100). score_max 없이도 score_total 은 100점 기준 가정.
    const scored = feedbacks
      .map((f) => f.score_total)
      .filter((s): s is number => typeof s === "number");
    const averageScore =
      scored.length > 0
        ? scored.reduce((a, b) => a + b, 0) / scored.length
        : null;

    // 목표 달성률 — 최근 평균 점수 / 목표 점수(목표 등급 * 가중치 추정).
    // 목표 등급은 1~6급이므로 등급별 통과 점수(대략 60점 기준)를 100% 로 본다.
    let goalAchievementPct: number | null = null;
    if (goal && averageScore != null) {
      const passingScore = 60; // 등급 통과 기준선(정직: 추정치)
      goalAchievementPct = Math.min(
        100,
        Math.round((averageScore / passingScore) * 100),
      );
    }

    const trendPoints = buildTrendPoints(feedbacks, events);
    const improvementPct = computeImprovementPct(feedbacks);

    const recentCompleted = (recentRes.data ?? []).map((f) => {
      const sub = (f as { writing_submissions: unknown }).writing_submissions;
      const subObj = Array.isArray(sub) ? sub[0] : sub;
      const questionNo =
        subObj && typeof subObj === "object" && "question_no" in subObj
          ? ((subObj as { question_no: number | null }).question_no ?? null)
          : null;
      return {
        submissionId: f.submission_id,
        questionNo,
        scoreTotal: f.score_total,
        generatedAt: f.generated_at,
      };
    });

    const planLabel = profileRes.data?.plan_label ?? null;

    return {
      hasGoal: Boolean(goal),
      reportLocked: isReportLocked(planLabel),
      planLabel,
      streakDays: kpi.streakDays,
      recentVolume: recentVolRes.count ?? 0,
      kpi: {
        averageScore,
        totalAttempts: kpi.totalAttempts,
        improvementPct,
        goalAchievementPct,
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
      trendPoints,
      recentCompleted,
    };
  } catch {
    // area 3 예외: 데이터/차트 로드 실패 시 재시도 동선을 제공한다.
    return null;
  }
}

export default async function GrowthPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const data = await loadGrowthData(user.id, supabase);

  if (!data) return <GrowthLoadError />;

  return <GrowthDashboard {...data} />;
}
