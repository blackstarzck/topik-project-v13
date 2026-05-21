import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import {
  computeExamDaysLeft,
  computeStreakDays,
} from "../../../src/lib/learning/kpi";

const REAL_DATE = Date;

function freezeUtc(iso: string) {
  const fixed = new REAL_DATE(iso);
  vi.spyOn(Date, "now").mockReturnValue(fixed.valueOf());
}

beforeAll(() => {
  freezeUtc("2026-05-20T22:30:00Z");
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe("KPI timezone — Asia/Seoul day boundary", () => {
  it("counts an attempt at 2026-05-21T00:30 KST as 'today' even when UTC is still 2026-05-20", () => {
    const startedAtJustAfterKstMidnight = "2026-05-20T15:30:00Z";
    const streak = computeStreakDays([startedAtJustAfterKstMidnight]);
    expect(streak).toBe(1);
  });

  it("computeExamDaysLeft uses KST day boundary, not UTC", () => {
    const examDateIso = "2026-05-22";
    const daysLeft = computeExamDaysLeft(examDateIso);
    expect(daysLeft).toBe(1);
  });

  it("computeStreakDays groups attempts by KST date string", () => {
    const todayKst = "2026-05-20T16:00:00Z";
    const yesterdayKst = "2026-05-19T16:00:00Z";
    const twoDaysAgoKst = "2026-05-18T16:00:00Z";
    expect(
      computeStreakDays([todayKst, yesterdayKst, twoDaysAgoKst]),
    ).toBe(3);
  });

  it("an attempt at 2026-05-20T08:00 KST (= 2026-05-19T23:00 UTC) bucketed as yesterday-KST", () => {
    const yesterdayKstMorning = "2026-05-19T23:00:00Z";
    const todayKstAfternoon = "2026-05-20T16:00:00Z";
    expect(
      computeStreakDays([todayKstAfternoon, yesterdayKstMorning]),
    ).toBe(2);
  });
});
