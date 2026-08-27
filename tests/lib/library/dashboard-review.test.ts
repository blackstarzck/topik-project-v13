import { describe, expect, it } from "vitest";
import { buildLibraryDashboardReview } from "../../../src/lib/library/dashboard-review";

type ReviewItemOverrides = Partial<{
  itemId: string;
  submissionId: string;
  problemId: string;
  questionNo: number | null;
  title: string;
  submittedAt: string;
  charCount: number;
  parentSubmissionId: string | null;
  problemDifficulty: number | null;
  submissionCountForProblem: number;
  feedback: { scoreTotal: number | null; scoreMax: number | null } | null;
  dimensions: Array<{
    id: string;
    dimension:
      | "grammar"
      | "vocab"
      | "structure"
      | "content"
      | "expression"
      | "topic_fit"
      | "language";
    score: number | null;
    scoreMax: number | null;
  }>;
}>;

function reviewItem(overrides: ReviewItemOverrides = {}) {
  const suffix = overrides.submissionId ?? "submission";
  return {
    itemId: `item-${suffix}`,
    submissionId: suffix,
    problemId: `problem-${suffix}`,
    questionNo: 53,
    title: `Title ${suffix}`,
    submittedAt: "2026-06-29T12:00:00.000Z",
    charCount: 250,
    parentSubmissionId: null,
    problemDifficulty: null,
    submissionCountForProblem: 1,
    feedback: { scoreTotal: 80, scoreMax: 100 },
    dimensions: [],
    ...overrides,
  };
}

function build(items: ReturnType<typeof reviewItem>[]) {
  return buildLibraryDashboardReview({ items, visibleProblemIds: null });
}

describe("buildLibraryDashboardReview", () => {
  it.each([
    [53, 199, "under"],
    [53, 200, null],
    [53, 300, null],
    [53, 301, "over"],
    [54, 599, "under"],
    [54, 600, null],
    [54, 700, null],
    [54, 701, "over"],
  ] as const)(
    "keeps Q%s length boundaries at %s characters",
    (questionNo, charCount, expectedStatus) => {
      const candidate = build([reviewItem({ questionNo, charCount })])
        .reviewCandidates[0];

      expect(candidate?.lengthTarget?.status ?? null).toBe(expectedStatus);
      expect(candidate?.reasons.includes("length_off_target")).toBe(
        expectedStatus !== null,
      );
    },
  );

  it.each([
    [51, 0, false],
    [51, 30, true],
    [51, 31, false],
    [52, 0, false],
    [52, 30, true],
    [52, 31, false],
  ] as const)(
    "keeps Q%s short-answer boundaries at %s characters",
    (questionNo, charCount, expected) => {
      const candidate = build([reviewItem({ questionNo, charCount })])
        .reviewCandidates[0];

      expect(candidate?.reasons.includes("short_answer")).toBe(expected);
    },
  );

  it.each([
    [69, true],
    [70, false],
  ] as const)(
    "keeps the low-dimension boundary at %s percent",
    (score, expected) => {
      const candidate = build([
        reviewItem({
          dimensions: [
            {
              id: `dimension-${score}`,
              dimension: "language",
              score,
              scoreMax: 100,
            },
          ],
        }),
      ]).reviewCandidates[0];

      expect(candidate?.reasons.includes("low_dimension")).toBe(expected);
    },
  );

  it("preserves null scores, fallback maxima, excluded dimensions, and percent clamps", () => {
    const result = build([
      reviewItem({
        submissionId: "null-total",
        feedback: { scoreTotal: null, scoreMax: 50 },
        dimensions: [
          {
            id: "null-dimension",
            dimension: "content",
            score: null,
            scoreMax: 10,
          },
        ],
      }),
      reviewItem({
        submissionId: "fallback-max",
        feedback: { scoreTotal: 150, scoreMax: 0 },
        dimensions: [
          {
            id: "fallback-dimension",
            dimension: "structure",
            score: 150,
            scoreMax: null,
          },
        ],
      }),
      reviewItem({
        submissionId: "lower-clamp",
        feedback: { scoreTotal: -10, scoreMax: 100 },
        dimensions: [
          {
            id: "lower-dimension",
            dimension: "language",
            score: -10,
            scoreMax: 0,
          },
        ],
      }),
    ]);

    expect(
      result.reviewCandidates.find(
        (candidate) => candidate.submissionId === "null-total",
      ),
    ).toMatchObject({
      scoreTotal: null,
      scoreMax: null,
      scorePercent: null,
    });
    expect(result.weakItems.map((item) => item.id)).not.toContain(
      "null-dimension",
    );
    expect(
      result.reviewCandidates.find(
        (candidate) => candidate.submissionId === "fallback-max",
      ),
    ).toMatchObject({ scoreTotal: 150, scoreMax: 100, scorePercent: 100 });
    expect(
      result.weakItems.find((item) => item.id === "fallback-dimension"),
    ).toMatchObject({ scoreMax: 100, normalizedScore: 100 });
    expect(
      result.reviewCandidates.find(
        (candidate) => candidate.submissionId === "lower-clamp",
      )?.scorePercent,
    ).toBe(0);
    expect(
      result.weakItems.find((item) => item.id === "lower-dimension")
        ?.normalizedScore,
    ).toBe(0);
  });

  it("prioritizes review reasons, then recency, and applies candidate and weak limits", () => {
    const ordinary = Array.from({ length: 10 }, (_, index) =>
      reviewItem({
        submissionId: `ordinary-${index}`,
        submittedAt: `2026-06-${String(10 + index).padStart(2, "0")}T12:00:00.000Z`,
        dimensions: [
          {
            id: `ordinary-dimension-${index}`,
            dimension: "content",
            score: 80,
            scoreMax: 100,
          },
        ],
      }),
    );
    const result = build([
      reviewItem({
        submissionId: "length",
        questionNo: 54,
        charCount: 599,
        submittedAt: "2026-06-01T12:00:00.000Z",
      }),
      reviewItem({
        submissionId: "comparison",
        submissionCountForProblem: 2,
        submittedAt: "2026-06-02T12:00:00.000Z",
      }),
      reviewItem({
        submissionId: "low",
        submittedAt: "2026-06-03T12:00:00.000Z",
        dimensions: [
          {
            id: "low-dimension",
            dimension: "language",
            score: 69,
            scoreMax: 100,
          },
        ],
      }),
      ...ordinary,
    ]);

    expect(result.reviewCandidates).toHaveLength(12);
    expect(
      result.reviewCandidates.slice(0, 3).map((item) => item.submissionId),
    ).toEqual(["length", "comparison", "low"]);
    expect(
      result.reviewCandidates.slice(3).map((item) => item.submissionId),
    ).toEqual([
      "ordinary-9",
      "ordinary-8",
      "ordinary-7",
      "ordinary-6",
      "ordinary-5",
      "ordinary-4",
      "ordinary-3",
      "ordinary-2",
      "ordinary-1",
    ]);
    expect(result.weakItems).toHaveLength(3);
    expect(result.weakItems.map((item) => item.id)).toEqual([
      "low-dimension",
      "ordinary-dimension-9",
      "ordinary-dimension-8",
    ]);
  });
});
