import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import {
  createSupabaseServerClient,
  type SupabaseServerClient,
} from "@/lib/supabase/server";
import { getDashboardKpi } from "@/lib/learning/kpi";
import { getLearningGoal } from "@/lib/learning/server";
import {
  calculateGoalProgress,
  normalizeFeedbackScoreTo100,
} from "@/lib/growth/goalProgress";
import { kstDayKey } from "@/lib/growth/kstDay";
import { throwIfQueryError } from "@/lib/supabase/query-error";
import {
  getWeakDimensions,
  getWeaknessRecommendations,
} from "@/lib/practice/weakness";
import {
  GrowthDashboard,
  type GrowthDashboardProps,
} from "@/components/growth/GrowthDashboard";
import { GrowthLoadError } from "@/components/growth/GrowthLoadError";
import { WorkspaceBody } from "@/components/app/WorkspaceBody";
import type { GrowthTrendPoint } from "@/components/growth/GrowthTrendChart";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("growth.page");
  return { title: t("metaTitle") };
}

const DAY_MS = 24 * 60 * 60 * 1000;

type FeedbackPoint = {
  generated_at: string;
  score_total: number | null;
  score_max: number | null;
};

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
    const score = normalizeFeedbackScoreTo100({
      scoreTotal: f.score_total,
      scoreMax: f.score_max,
    });
    if (score == null) continue;
    const key = kstDayKey(f.generated_at);
    const arr = scoreBuckets.get(key) ?? [];
    arr.push(score);
    scoreBuckets.set(key, arr);
  }

  const volumeBuckets = new Map<string, number>();
  const VOLUME_EVENTS = new Set(["attempt_submitted", "submission_submitted"]);
  for (const e of events) {
    if (!VOLUME_EVENTS.has(e.event_type)) continue;
    const key = kstDayKey(e.occurred_at);
    volumeBuckets.set(key, (volumeBuckets.get(key) ?? 0) + 1);
  }

  const allKeys = new Set<string>([
    ...scoreBuckets.keys(),
    ...volumeBuckets.keys(),
  ]);
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
    .map((f) => {
      const score = normalizeFeedbackScoreTo100({
        scoreTotal: f.score_total,
        scoreMax: f.score_max,
      });
      return score != null
        ? {
            at: new Date(f.generated_at).getTime(),
            s: score,
          }
        : null;
    })
    .filter((f): f is { at: number; s: number } => f != null)
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
  // goalLabel 문구 해석기. 컴포넌트가 아니므로 useTranslations 를 못 쓰고,
  // 서버 컴포넌트에서 받은 getTranslations("growth.page") 결과를 주입받는다.
  formatGoalLabel: (targetGrade: number | null) => string,
): Promise<GrowthDashboardProps | null> {
  try {
    const sinceIso = new Date(Date.now() - 90 * DAY_MS).toISOString();
    const recentVolumeSince = new Date(Date.now() - 30 * DAY_MS).toISOString();

    const goal = await getLearningGoal(userId);
    const [kpi, weak, recs, feedbackRes, eventsRes, recentRes, recentVolRes] =
      await Promise.all([
        getDashboardKpi(userId, supabase),
        getWeakDimensions(userId),
        getWeaknessRecommendations(userId),
        supabase
          .from("writing_feedback")
          .select("generated_at, score_total, score_max")
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
          // 분석 실패(failed) 행은 "최근 완료 문제"가 아니다. partial은 라이브러리와
          // 같은 의미(피드백 대기)로 남겨 점수 "대기" 라벨을 유지한다.
          .neq("status", "failed")
          .order("generated_at", { ascending: false })
          .limit(5),
        supabase
          .from("study_events")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .in("event_type", ["attempt_submitted", "submission_submitted"])
          .gte("occurred_at", recentVolumeSince),
      ]);

    // supabase-js는 쿼리 실패 시 throw하지 않고 error를 반환한다. 여기서 확인해
    // throw해야 아래 catch가 GrowthLoadError(재시도 화면)로 승격시킬 수 있다.
    throwIfQueryError("loadGrowthData(writing_feedback)", feedbackRes);
    throwIfQueryError("loadGrowthData(study_events)", eventsRes);
    throwIfQueryError("loadGrowthData(recent_feedback)", recentRes);
    throwIfQueryError("loadGrowthData(recent_volume)", recentVolRes);

    const feedbacks = (feedbackRes.data ?? []) as FeedbackPoint[];
    const events = (eventsRes.data ?? []) as {
      occurred_at: string;
      event_type: string;
    }[];

    // 평균 점수(0~100). writing_feedback.score_total/score_max 원천값으로 정규화한다.
    const scored = feedbacks
      .map((f) =>
        normalizeFeedbackScoreTo100({
          scoreTotal: f.score_total,
          scoreMax: f.score_max,
        }),
      )
      .filter((s): s is number => s != null);
    const averageScore =
      scored.length > 0
        ? scored.reduce((a, b) => a + b, 0) / scored.length
        : null;

    // 목표 달성률 — 목표 등급별 TOPIK II 총점 하한을 쓰기 100점 기준으로 환산한다.
    const goalAchievementPct = calculateGoalProgress({
      goal: goal
        ? { topikLevel: goal.topik_level, targetGrade: goal.target_grade }
        : null,
      feedbacks: feedbacks.map((f) => ({
        scoreTotal: f.score_total,
        scoreMax: f.score_max,
      })),
    });

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

    return {
      hasGoal: Boolean(goal),
      streakDays: kpi.streakDays,
      recentVolume: recentVolRes.count ?? 0,
      kpi: {
        averageScore,
        totalAttempts: kpi.totalAttempts,
        improvementPct,
        goalAchievementPct,
        goalLabel: formatGoalLabel(goal ? goal.target_grade : null),
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
  const t = await getTranslations("growth.page");
  // 목표 등급 라벨: 목표가 있으면 "N급", 없으면 "미설정". ICU 리프로 해석한다.
  const formatGoalLabel = (targetGrade: number | null) =>
    targetGrade != null
      ? t("goalGrade", { grade: targetGrade })
      : t("goalUnset");
  const data = await loadGrowthData(user.id, supabase, formatGoalLabel);

  if (!data) {
    return (
      <WorkspaceBody className="app-cards-bordered">
        <GrowthLoadError />
      </WorkspaceBody>
    );
  }

  return (
    <WorkspaceBody className="app-cards-bordered">
      <GrowthDashboard {...data} />
    </WorkspaceBody>
  );
}
