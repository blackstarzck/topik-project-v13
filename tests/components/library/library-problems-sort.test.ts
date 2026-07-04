import { describe, expect, it } from "vitest";

import type { SubmissionEnrichment } from "../../../src/components/library/library-enrich-data";
import type { LibraryProblemsFilterEntry } from "../../../src/components/library/library-problems-filter-model";
import {
  DEFAULT_LIBRARY_PROBLEMS_SORT,
  sortLibraryProblems,
} from "../../../src/components/library/library-problems-sort";

function submissionEntry(
  id: string,
  savedAt: string,
  questionNo: number | null = 51,
): LibraryProblemsFilterEntry {
  return {
    kind: "submission",
    item: { id, question_no: questionNo, saved_at: savedAt },
  };
}

function problemEntry(
  savedAt: string,
  questionNo: number | null = 53,
): LibraryProblemsFilterEntry {
  return {
    kind: "problem",
    item: {
      availabilityStatus: "available",
      question_no: questionNo,
      saved_at: savedAt,
    },
  };
}

function enrichment(score: {
  total: number;
  max: number;
}): SubmissionEnrichment {
  return {
    feedbackStatus: "complete",
    scoreTotal: score.total,
    scoreMax: score.max,
    summary: null,
  };
}

const enrich = new Map<string, SubmissionEnrichment>([
  ["sub-80", enrichment({ total: 8, max: 10 })], // 80%
  ["sub-20", enrichment({ total: 6, max: 30 })], // 20%
]);

const ids = (entries: readonly LibraryProblemsFilterEntry[]) =>
  entries.map((entry) =>
    entry.kind === "submission"
      ? entry.item.id
      : `problem-${entry.item.saved_at}`,
  );

describe("sortLibraryProblems", () => {
  const older = submissionEntry("sub-20", "2026-06-01T10:00:00.000Z", 54);
  const newer = submissionEntry("sub-80", "2026-07-01T10:00:00.000Z", 52);
  const noScore = submissionEntry("sub-none", "2026-06-15T10:00:00.000Z", 51);
  const problem = problemEntry("2026-06-20T10:00:00.000Z", 53);

  it("기본 정렬은 최근 저장 순", () => {
    expect(DEFAULT_LIBRARY_PROBLEMS_SORT).toBe("savedDesc");
    const input = [older, newer, noScore];
    expect(ids(sortLibraryProblems(input, "savedDesc", enrich))).toEqual([
      "sub-80",
      "sub-none",
      "sub-20",
    ]);
    // 입력 배열은 변형하지 않는다.
    expect(ids(input)).toEqual(["sub-20", "sub-80", "sub-none"]);
  });

  it("오래된 순", () => {
    expect(
      ids(sortLibraryProblems([newer, older, noScore], "savedAsc", enrich)),
    ).toEqual(["sub-20", "sub-none", "sub-80"]);
  });

  it("점수 정렬은 방향과 무관하게 점수 없는 항목을 뒤로 보낸다", () => {
    const input = [noScore, older, problem, newer];
    expect(ids(sortLibraryProblems(input, "scoreDesc", enrich))).toEqual([
      "sub-80",
      "sub-20",
      "problem-2026-06-20T10:00:00.000Z",
      "sub-none",
    ]);
    expect(ids(sortLibraryProblems(input, "scoreAsc", enrich))).toEqual([
      "sub-20",
      "sub-80",
      "problem-2026-06-20T10:00:00.000Z",
      "sub-none",
    ]);
  });

  it("점수 없는 항목끼리는 최근 저장 순으로 tie-break", () => {
    const sorted = sortLibraryProblems([noScore, problem], "scoreDesc", enrich);
    // problem(6/20 저장)이 noScore(6/15 저장)보다 최근이므로 앞.
    expect(ids(sorted)).toEqual([
      "problem-2026-06-20T10:00:00.000Z",
      "sub-none",
    ]);
  });

  it("문제 유형 순은 question_no 오름차순, null은 뒤로", () => {
    const noQuestion = submissionEntry(
      "sub-no-question",
      "2026-07-02T10:00:00.000Z",
      null,
    );
    expect(
      ids(
        sortLibraryProblems(
          [noQuestion, older, problem, newer],
          "questionAsc",
          enrich,
        ),
      ),
    ).toEqual([
      "sub-80", // 52
      "problem-2026-06-20T10:00:00.000Z", // 53
      "sub-20", // 54
      "sub-no-question",
    ]);
  });

  it("문제 유형 동률은 최근 저장 순으로 tie-break", () => {
    const a = submissionEntry("sub-80", "2026-07-01T10:00:00.000Z", 51);
    const b = submissionEntry("sub-20", "2026-06-01T10:00:00.000Z", 51);
    expect(ids(sortLibraryProblems([b, a], "questionAsc", enrich))).toEqual([
      "sub-80",
      "sub-20",
    ]);
  });
});
