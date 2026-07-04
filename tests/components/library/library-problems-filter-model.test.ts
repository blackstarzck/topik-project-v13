import dayjs from "dayjs";
import { describe, expect, it } from "vitest";

import type { SubmissionEnrichment } from "../../../src/components/library/library-enrich-data";
import {
  EMPTY_LIBRARY_PROBLEMS_FILTERS,
  applyLibraryProblemsFilters,
  countActiveLibraryProblemsFilters,
  countLibraryProblemsFacets,
  matchesLibraryProblemsFilters,
  normalizeScoreRange,
  resolveDatePreset,
  scorePercent,
  type LibraryProblemsFilterEntry,
  type LibraryProblemsFilterState,
} from "../../../src/components/library/library-problems-filter-model";

function submissionEntry(
  id: string,
  overrides: Partial<{ question_no: number | null; saved_at: string }> = {},
): LibraryProblemsFilterEntry {
  return {
    kind: "submission",
    item: {
      id,
      question_no:
        overrides.question_no === undefined ? 51 : overrides.question_no,
      saved_at: overrides.saved_at ?? "2026-07-01T10:00:00.000Z",
    },
  };
}

function problemEntry(
  availabilityStatus: "available" | "soft_unavailable" | "hard_unavailable",
  overrides: Partial<{ question_no: number | null; saved_at: string }> = {},
): LibraryProblemsFilterEntry {
  return {
    kind: "problem",
    item: {
      availabilityStatus,
      question_no:
        overrides.question_no === undefined ? 53 : overrides.question_no,
      saved_at: overrides.saved_at ?? "2026-07-01T10:00:00.000Z",
    },
  };
}

function enrichment(
  feedbackStatus: SubmissionEnrichment["feedbackStatus"],
  score: { total: number; max: number } | null = null,
): SubmissionEnrichment {
  return {
    feedbackStatus,
    scoreTotal: score?.total ?? null,
    scoreMax: score?.max ?? null,
    summary: null,
  };
}

const enrich = new Map<string, SubmissionEnrichment>([
  ["sub-complete", enrichment("complete", { total: 8, max: 10 })],
  ["sub-complete-low", enrichment("complete", { total: 6, max: 30 })],
  ["sub-failed", enrichment("failed")],
]);

function state(
  partial: Partial<LibraryProblemsFilterState>,
): LibraryProblemsFilterState {
  return { ...EMPTY_LIBRARY_PROBLEMS_FILTERS, ...partial };
}

describe("항목 유형 트리 — 브랜치 합집합 truth table", () => {
  const complete = submissionEntry("sub-complete");
  const failed = submissionEntry("sub-failed");
  const pendingUnknown = submissionEntry("sub-unknown");
  const availableProblem = problemEntry("available");
  const softProblem = problemEntry("soft_unavailable");

  it("모두 비활성이면 전체 통과", () => {
    const empty = state({});
    for (const entry of [complete, failed, availableProblem, softProblem]) {
      expect(matchesLibraryProblemsFilters(entry, empty, enrich)).toBe(true);
    }
  });

  it("`분석 완료`만 체크 → 완료 답안만", () => {
    const s = state({ statuses: new Set(["complete"]) });
    expect(matchesLibraryProblemsFilters(complete, s, enrich)).toBe(true);
    expect(matchesLibraryProblemsFilters(failed, s, enrich)).toBe(false);
    expect(matchesLibraryProblemsFilters(availableProblem, s, enrich)).toBe(
      false,
    );
  });

  it("`분석 완료` + `저장 문제` → 완료 답안 ∪ 모든 저장 문제", () => {
    const s = state({
      statuses: new Set(["complete"]),
      kinds: new Set(["problem"]),
    });
    expect(matchesLibraryProblemsFilters(complete, s, enrich)).toBe(true);
    expect(matchesLibraryProblemsFilters(failed, s, enrich)).toBe(false);
    expect(matchesLibraryProblemsFilters(availableProblem, s, enrich)).toBe(
      true,
    );
    expect(matchesLibraryProblemsFilters(softProblem, s, enrich)).toBe(true);
  });

  it("`분석 완료` + `제공 종료` → 완료 답안 ∪ 제공종료 문제", () => {
    const s = state({
      statuses: new Set(["complete"]),
      availability: new Set(["soft_unavailable"]),
    });
    expect(matchesLibraryProblemsFilters(complete, s, enrich)).toBe(true);
    expect(matchesLibraryProblemsFilters(softProblem, s, enrich)).toBe(true);
    expect(matchesLibraryProblemsFilters(availableProblem, s, enrich)).toBe(
      false,
    );
  });

  it("`저장 답안` + `분석 실패` → 실패 답안만 (자식으로 좁힘)", () => {
    const s = state({
      kinds: new Set(["submission"]),
      statuses: new Set(["failed"]),
    });
    expect(matchesLibraryProblemsFilters(failed, s, enrich)).toBe(true);
    expect(matchesLibraryProblemsFilters(complete, s, enrich)).toBe(false);
    expect(matchesLibraryProblemsFilters(softProblem, s, enrich)).toBe(false);
  });

  it("enrichment 미로딩 답안은 pending으로 판정", () => {
    const s = state({ statuses: new Set(["pending"]) });
    expect(matchesLibraryProblemsFilters(pendingUnknown, s, enrich)).toBe(true);
    expect(matchesLibraryProblemsFilters(complete, s, enrich)).toBe(false);
  });
});

describe("문제 유형(51~54) 그룹", () => {
  it("양쪽 kind에 question_no로 적용된다", () => {
    const s = state({ questionNos: new Set([53] as const) });
    expect(
      matchesLibraryProblemsFilters(
        submissionEntry("sub-complete", { question_no: 53 }),
        s,
        enrich,
      ),
    ).toBe(true);
    expect(
      matchesLibraryProblemsFilters(
        problemEntry("available", { question_no: 53 }),
        s,
        enrich,
      ),
    ).toBe(true);
    expect(
      matchesLibraryProblemsFilters(
        submissionEntry("sub-complete", { question_no: 51 }),
        s,
        enrich,
      ),
    ).toBe(false);
  });

  it("활성 시 question_no null 항목은 제외", () => {
    const s = state({ questionNos: new Set([51] as const) });
    expect(
      matchesLibraryProblemsFilters(
        submissionEntry("sub-complete", { question_no: null }),
        s,
        enrich,
      ),
    ).toBe(false);
  });
});

describe("점수 백분율 그룹", () => {
  it("경계 포함으로 백분율을 판정한다", () => {
    // sub-complete = 8/10 = 80%, sub-complete-low = 6/30 = 20%
    const s = state({ scoreRange: [20, 80] });
    expect(
      matchesLibraryProblemsFilters(submissionEntry("sub-complete"), s, enrich),
    ).toBe(true);
    expect(
      matchesLibraryProblemsFilters(
        submissionEntry("sub-complete-low"),
        s,
        enrich,
      ),
    ).toBe(true);
    const narrow = state({ scoreRange: [21, 79] });
    expect(
      matchesLibraryProblemsFilters(
        submissionEntry("sub-complete"),
        narrow,
        enrich,
      ),
    ).toBe(false);
  });

  it("점수 없는 항목(저장 문제, 미분석, enrichment 미로딩)은 제외", () => {
    const s = state({ scoreRange: [0, 50] });
    expect(
      matchesLibraryProblemsFilters(problemEntry("available"), s, enrich),
    ).toBe(false);
    expect(
      matchesLibraryProblemsFilters(submissionEntry("sub-failed"), s, enrich),
    ).toBe(false);
    expect(
      matchesLibraryProblemsFilters(submissionEntry("sub-unknown"), s, enrich),
    ).toBe(false);
  });

  it("scorePercent는 scoreMax<=0이나 결측이면 null", () => {
    expect(scorePercent(enrichment("complete", { total: 8, max: 10 }))).toBe(
      80,
    );
    expect(scorePercent(enrichment("complete", { total: 8, max: 0 }))).toBe(
      null,
    );
    expect(scorePercent(enrichment("complete"))).toBe(null);
    expect(scorePercent(undefined)).toBe(null);
  });

  it("normalizeScoreRange는 [0,100]을 null로, 역순/범위 밖을 정돈", () => {
    expect(normalizeScoreRange([0, 100])).toBe(null);
    expect(normalizeScoreRange(null)).toBe(null);
    expect(normalizeScoreRange([80, 20])).toEqual([20, 80]);
    expect(normalizeScoreRange([-10, 120])).toBe(null);
    expect(normalizeScoreRange([30, 100])).toEqual([30, 100]);
  });
});

describe("날짜 그룹 (saved_at, 경계 포함)", () => {
  const early = submissionEntry("sub-complete", {
    saved_at: "2026-06-01T00:00:00.000Z",
  });
  const mid = submissionEntry("sub-complete", {
    saved_at: "2026-06-15T12:00:00.000Z",
  });
  const late = problemEntry("available", {
    saved_at: "2026-07-01T23:59:59.000Z",
  });

  it("from/to 경계를 포함해 판정한다", () => {
    const s = state({
      date: {
        preset: null,
        from: "2026-06-01T00:00:00.000Z",
        to: "2026-06-15T12:00:00.000Z",
      },
    });
    expect(matchesLibraryProblemsFilters(early, s, enrich)).toBe(true);
    expect(matchesLibraryProblemsFilters(mid, s, enrich)).toBe(true);
    expect(matchesLibraryProblemsFilters(late, s, enrich)).toBe(false);
  });

  it("from만 있어도 동작한다", () => {
    const s = state({
      date: { preset: null, from: "2026-06-10T00:00:00.000Z", to: null },
    });
    expect(matchesLibraryProblemsFilters(early, s, enrich)).toBe(false);
    expect(matchesLibraryProblemsFilters(late, s, enrich)).toBe(true);
  });

  it("resolveDatePreset은 주입한 now 기준으로 경계를 확정한다", () => {
    const now = dayjs("2026-07-04T15:30:00.000Z");
    const week = resolveDatePreset("week", now);
    expect(week.preset).toBe("week");
    expect(week.from).toBe(
      now.subtract(1, "week").startOf("day").toISOString(),
    );
    expect(week.to).toBe(now.endOf("day").toISOString());

    const quarter = resolveDatePreset("quarter", now);
    expect(quarter.from).toBe(
      now.subtract(3, "month").startOf("day").toISOString(),
    );
  });
});

describe("applyLibraryProblemsFilters", () => {
  const entries = [
    submissionEntry("sub-complete", { question_no: 51 }),
    submissionEntry("sub-failed", { question_no: 52 }),
    problemEntry("soft_unavailable", { question_no: 53 }),
  ];

  it("빈 상태면 원본 배열 참조를 그대로 반환한다", () => {
    expect(
      applyLibraryProblemsFilters(
        entries,
        EMPTY_LIBRARY_PROBLEMS_FILTERS,
        enrich,
      ),
    ).toBe(entries);
  });

  it("활성 그룹끼리는 AND로 결합한다", () => {
    const s = state({
      questionNos: new Set([51, 52] as const),
      statuses: new Set(["complete"]),
    });
    expect(applyLibraryProblemsFilters(entries, s, enrich)).toEqual([
      entries[0],
    ]);
  });
});

describe("countLibraryProblemsFacets", () => {
  it("체크박스 12종을 한 번에 집계한다", () => {
    const counts = countLibraryProblemsFacets(
      [
        submissionEntry("sub-complete", { question_no: 51 }),
        submissionEntry("sub-failed", { question_no: 52 }),
        submissionEntry("sub-unknown", { question_no: null }),
        problemEntry("available", { question_no: 53 }),
        problemEntry("soft_unavailable", { question_no: 54 }),
        problemEntry("hard_unavailable", { question_no: 53 }),
      ],
      enrich,
    );

    expect(counts).toEqual({
      questionNos: { 51: 1, 52: 1, 53: 2, 54: 1 },
      kinds: { submission: 3, problem: 3 },
      statuses: { pending: 1, analyzing: 0, complete: 1, failed: 1 },
      availability: { soft_unavailable: 1, hard_unavailable: 1 },
    });
  });
});

describe("countActiveLibraryProblemsFilters", () => {
  it("체크 개수 + 날짜/점수 그룹 각 1로 센다", () => {
    expect(
      countActiveLibraryProblemsFilters(EMPTY_LIBRARY_PROBLEMS_FILTERS),
    ).toBe(0);
    expect(
      countActiveLibraryProblemsFilters(
        state({
          questionNos: new Set([51, 53] as const),
          kinds: new Set(["submission"]),
          date: { preset: "week", from: "2026-06-27T00:00:00.000Z", to: null },
          scoreRange: [0, 50],
        }),
      ),
    ).toBe(5);
  });

  it("from/to 모두 없는 date는 비활성으로 취급", () => {
    expect(
      countActiveLibraryProblemsFilters(
        state({ date: { preset: null, from: null, to: null } }),
      ),
    ).toBe(0);
  });
});
