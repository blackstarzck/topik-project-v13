import dayjs from "dayjs";
import { describe, expect, it } from "vitest";
import {
  computeExamDaysLeft,
  computeStreakDays,
  getDashboardKpi,
} from "../../../src/lib/learning/kpi";

const TODAY = dayjs().startOf("day");

function isoDaysAgo(n: number): string {
  return TODAY.subtract(n, "day").add(10, "hour").toISOString();
}

describe("computeExamDaysLeft", () => {
  it("returns null when exam_date is null", () => {
    expect(computeExamDaysLeft(null)).toBe(null);
  });

  it("returns 0 when exam_date is today (KST)", () => {
    expect(computeExamDaysLeft(TODAY.format("YYYY-MM-DD"))).toBe(0);
  });

  it("returns the positive day diff in the future", () => {
    expect(
      computeExamDaysLeft(TODAY.add(30, "day").format("YYYY-MM-DD")),
    ).toBe(30);
  });

  it("returns null when exam_date is in the past", () => {
    expect(
      computeExamDaysLeft(TODAY.subtract(1, "day").format("YYYY-MM-DD")),
    ).toBe(null);
  });
});

describe("computeStreakDays", () => {
  it("returns 0 when there are no attempts", () => {
    expect(computeStreakDays([])).toBe(0);
  });

  it("returns 1 for a single attempt today", () => {
    expect(computeStreakDays([isoDaysAgo(0)])).toBe(1);
  });

  it("returns N for N consecutive days ending today", () => {
    expect(
      computeStreakDays([isoDaysAgo(0), isoDaysAgo(1), isoDaysAgo(2)]),
    ).toBe(3);
  });

  it("treats yesterday as the latest valid streak anchor", () => {
    expect(computeStreakDays([isoDaysAgo(1), isoDaysAgo(2)])).toBe(2);
  });

  it("returns 0 when the latest attempt is older than yesterday", () => {
    expect(computeStreakDays([isoDaysAgo(3)])).toBe(0);
  });

  it("stops counting at a gap", () => {
    expect(
      computeStreakDays([isoDaysAgo(0), isoDaysAgo(1), isoDaysAgo(3)]),
    ).toBe(2);
  });
});

describe("getDashboardKpi", () => {
  function makeSupabase(opts: {
    todayCount?: number | null;
    totalCount?: number | null;
    examDate?: string | null;
    streakRows?: { started_at: string }[];
    error?: string | null;
  }) {
    return {
      from: (table: string) => {
        if (table === "problem_attempts") {
          return {
            select: (
              _cols: string,
              options?: { count?: string; head?: boolean },
            ) => ({
              eq: () => ({
                gte: () => ({
                  lte: () =>
                    Promise.resolve({
                      count: opts.todayCount ?? 0,
                      error: opts.error
                        ? { message: opts.error }
                        : null,
                    }),
                }),
                order: () => ({
                  limit: () =>
                    Promise.resolve({
                      data: opts.streakRows ?? [],
                      error: null,
                    }),
                }),
                // bare .eq() chain for total-count path
                then: undefined,
                // fallback: returns count for total when head present
                count: opts.totalCount ?? 0,
                error: null,
                // hack: provide the resolved value for total-count chain
              }),
              count: opts.totalCount ?? 0,
              error: null,
              _isHeadCount: Boolean(options?.head),
            }),
          };
        }
        if (table === "learning_goals") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: opts.examDate
                      ? { exam_date: opts.examDate }
                      : null,
                    error: null,
                  }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table: ${table}`);
      },
    };
  }

  it("returns all four KPI values + recentFeedback null", async () => {
    const supabase = makeSupabase({
      todayCount: 3,
      totalCount: 17,
      examDate: TODAY.add(45, "day").format("YYYY-MM-DD"),
      streakRows: [
        { started_at: isoDaysAgo(0) },
        { started_at: isoDaysAgo(1) },
      ],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kpi = await getDashboardKpi("user-1", supabase as any);
    expect(kpi.todayAttempts).toBe(3);
    expect(kpi.totalAttempts).toBe(17);
    expect(kpi.examDaysLeft).toBe(45);
    expect(kpi.streakDays).toBe(2);
    expect(kpi.recentFeedback).toBe(null);
  });

  it("returns zeros / nulls for a brand-new user", async () => {
    const supabase = makeSupabase({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kpi = await getDashboardKpi("user-new", supabase as any);
    expect(kpi.todayAttempts).toBe(0);
    expect(kpi.totalAttempts).toBe(0);
    expect(kpi.examDaysLeft).toBe(null);
    expect(kpi.streakDays).toBe(0);
  });
});
