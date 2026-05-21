import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import type { SupabaseServerClient } from "../supabase/server";

dayjs.extend(utc);
dayjs.extend(timezone);

const KST = "Asia/Seoul";

/**
 * Dashboard KPI summary for Phase 4. Calculated entirely from tables that
 * Phase 4 already types: `learning_goals`, `problem_attempts`. Placeholders
 * for future writing/feedback signals are intentional and stay null until
 * Phase 5 wires them in.
 */
export type DashboardKpi = {
  todayAttempts: number;
  totalAttempts: number;
  /** Days until `learning_goals.exam_date`. Null when no exam date set or date is in the past. */
  examDaysLeft: number | null;
  /** Consecutive distinct dates with at least one attempt, ending today or yesterday. */
  streakDays: number;
  /** Placeholder — populated in Phase 5 when writing_feedback is typed. */
  recentFeedback: null;
};

// Phase 5 R-TZ resolution: all day math runs in Asia/Seoul. On Vercel UTC
// the bounds still represent KST midnight → midnight, so attempts in the
// 00:00–09:00 KST window are bucketed to the correct KST day.

function startOfToday(): dayjs.Dayjs {
  return dayjs().tz(KST).startOf("day");
}

function endOfToday(): dayjs.Dayjs {
  return dayjs().tz(KST).endOf("day");
}

function dayKey(iso: string): string {
  return dayjs(iso).tz(KST).format("YYYY-MM-DD");
}

export async function getDashboardKpi(
  userId: string,
  supabase: SupabaseServerClient,
): Promise<DashboardKpi> {
  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  const { count: todayCount, error: todayErr } = await supabase
    .from("problem_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("started_at", todayStart.toISOString())
    .lte("started_at", todayEnd.toISOString());
  if (todayErr) throw new Error(`KPI today attempts: ${todayErr.message}`);

  const { count: totalCount, error: totalErr } = await supabase
    .from("problem_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (totalErr) throw new Error(`KPI total attempts: ${totalErr.message}`);

  const { data: goal, error: goalErr } = await supabase
    .from("learning_goals")
    .select("exam_date")
    .eq("user_id", userId)
    .maybeSingle();
  if (goalErr) throw new Error(`KPI exam date: ${goalErr.message}`);

  const examDaysLeft = computeExamDaysLeft(goal?.exam_date ?? null);

  const { data: streakRows, error: streakErr } = await supabase
    .from("problem_attempts")
    .select("started_at")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(365);
  if (streakErr) throw new Error(`KPI streak: ${streakErr.message}`);

  const streakDays = computeStreakDays(
    (streakRows ?? []).map((r) => r.started_at),
  );

  return {
    todayAttempts: todayCount ?? 0,
    totalAttempts: totalCount ?? 0,
    examDaysLeft,
    streakDays,
    recentFeedback: null,
  };
}

export function computeExamDaysLeft(examDate: string | null): number | null {
  if (!examDate) return null;
  const today = startOfToday();
  const exam = dayjs.tz(examDate, KST).startOf("day");
  const diff = exam.diff(today, "day");
  return diff >= 0 ? diff : null;
}

export function computeStreakDays(startedAtIsoList: readonly string[]): number {
  if (startedAtIsoList.length === 0) return 0;
  const days = Array.from(new Set(startedAtIsoList.map(dayKey))).sort(
    (a, b) => (a > b ? -1 : a < b ? 1 : 0),
  );
  const today = startOfToday().format("YYYY-MM-DD");
  const yesterday = startOfToday().subtract(1, "day").format("YYYY-MM-DD");
  // Streak must end at today or yesterday — otherwise it's a stale streak.
  if (days[0] !== today && days[0] !== yesterday) return 0;
  let streak = 1;
  let cursor = dayjs(days[0]);
  for (let i = 1; i < days.length; i += 1) {
    const expected = cursor.subtract(1, "day").format("YYYY-MM-DD");
    if (days[i] !== expected) break;
    streak += 1;
    cursor = cursor.subtract(1, "day");
  }
  return streak;
}
