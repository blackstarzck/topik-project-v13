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

describe("getDashboardKpi (Phase 6 RPC)", () => {
  function makeSupabase(opts: {
    rpcData?: unknown;
    rpcError?: string | null;
  }) {
    let calledFn: string | null = null;
    return {
      rpc: (name: string) => {
        calledFn = name;
        return Promise.resolve({
          data: opts.rpcData ?? null,
          error: opts.rpcError ? { message: opts.rpcError } : null,
        });
      },
      __calledFn: () => calledFn,
    };
  }

  it("calls get_dashboard_kpi RPC and maps every field", async () => {
    const supabase = makeSupabase({
      rpcData: [
        {
          today_attempts: 3,
          total_attempts: 17,
          exam_days_left: 45,
          streak_days: 2,
        },
      ],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kpi = await getDashboardKpi("user-1", supabase as any);
    expect((supabase as unknown as { __calledFn: () => string }).__calledFn()).toBe(
      "get_dashboard_kpi",
    );
    expect(kpi.todayAttempts).toBe(3);
    expect(kpi.totalAttempts).toBe(17);
    expect(kpi.examDaysLeft).toBe(45);
    expect(kpi.streakDays).toBe(2);
    expect(kpi.recentFeedback).toBe(null);
  });

  it("returns zeros / nulls for a brand-new user (RPC returns null exam_days_left)", async () => {
    const supabase = makeSupabase({
      rpcData: [
        {
          today_attempts: 0,
          total_attempts: 0,
          exam_days_left: null,
          streak_days: 0,
        },
      ],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kpi = await getDashboardKpi("user-new", supabase as any);
    expect(kpi.todayAttempts).toBe(0);
    expect(kpi.totalAttempts).toBe(0);
    expect(kpi.examDaysLeft).toBe(null);
    expect(kpi.streakDays).toBe(0);
  });

  it("falls back to zeros when RPC returns null", async () => {
    const supabase = makeSupabase({ rpcData: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kpi = await getDashboardKpi("user-empty", supabase as any);
    expect(kpi.todayAttempts).toBe(0);
    expect(kpi.totalAttempts).toBe(0);
    expect(kpi.examDaysLeft).toBe(null);
    expect(kpi.streakDays).toBe(0);
    expect(kpi.recentFeedback).toBe(null);
  });

  it("throws on RPC error", async () => {
    const supabase = makeSupabase({ rpcError: "rpc broken" });
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getDashboardKpi("user-x", supabase as any),
    ).rejects.toThrow(/rpc broken/);
  });
});
