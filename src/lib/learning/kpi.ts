import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import type { SupabaseServerClient } from "../supabase/server";

dayjs.extend(utc);
dayjs.extend(timezone);

const KST = "Asia/Seoul";

/**
 * Dashboard KPI summary. The four fetches are collapsed into a single
 * `get_dashboard_kpi()` RPC that runs the same KST day-boundary math in SQL
 * (see the latest dashboard KPI migration). The `userId`
 * parameter is retained for caller compatibility but is intentionally
 * ignored — the RPC derives identity from `auth.uid()` to avoid cross-user
 * leak (Codex Round 1 P1-1).
 *
 * The helper exports `computeExamDaysLeft` / `computeStreakDays` remain for
 * tests that exercise the dayjs-based math directly; they are no longer used
 * by `getDashboardKpi` itself.
 */
export type DashboardKpi = {
  todayAttempts: number;
  totalAttempts: number;
  /** Days until `learning_goals.exam_date`. Null when no exam date set or date is in the past. */
  examDaysLeft: number | null;
  /** Consecutive distinct KST dates with at least one study event, ending today or yesterday. */
  streakDays: number;
  /** Placeholder — populated when writing_feedback signals are surfaced on the dashboard. */
  recentFeedback: null;
};

export async function getDashboardKpi(
  _userId: string,
  supabase: SupabaseServerClient,
): Promise<DashboardKpi> {
  const { data, error } = await supabase.rpc("get_dashboard_kpi");
  if (error) throw new Error(`KPI rpc: ${error.message}`);

  // The RPC returns a single-row `setof record`. supabase-js shapes the
  // payload as `Array<{...}>` for `returns table (...)` functions.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return {
      todayAttempts: 0,
      totalAttempts: 0,
      examDaysLeft: null,
      streakDays: 0,
      recentFeedback: null,
    };
  }

  return {
    todayAttempts: row.today_attempts ?? 0,
    totalAttempts: row.total_attempts ?? 0,
    examDaysLeft: row.exam_days_left ?? null,
    streakDays: row.streak_days ?? 0,
    recentFeedback: null,
  };
}

function startOfTodayKst(): dayjs.Dayjs {
  return dayjs().tz(KST).startOf("day");
}

function dayKey(iso: string): string {
  return dayjs(iso).tz(KST).format("YYYY-MM-DD");
}

export function computeExamDaysLeft(examDate: string | null): number | null {
  if (!examDate) return null;
  const today = startOfTodayKst();
  const exam = dayjs.tz(examDate, KST).startOf("day");
  const diff = exam.diff(today, "day");
  return diff >= 0 ? diff : null;
}

export function computeStreakDays(startedAtIsoList: readonly string[]): number {
  if (startedAtIsoList.length === 0) return 0;
  const days = Array.from(new Set(startedAtIsoList.map(dayKey))).sort((a, b) =>
    a > b ? -1 : a < b ? 1 : 0,
  );
  const today = startOfTodayKst().format("YYYY-MM-DD");
  const yesterday = startOfTodayKst().subtract(1, "day").format("YYYY-MM-DD");
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
