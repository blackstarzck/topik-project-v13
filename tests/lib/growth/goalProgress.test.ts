import { describe, expect, it } from "vitest";
import {
  calculateGoalProgress,
  getTopikWritingTargetScore,
} from "../../../src/lib/growth/goalProgress";

describe("getTopikWritingTargetScore", () => {
  it("converts TOPIK II total grade cutoffs to a writing-section target", () => {
    expect(getTopikWritingTargetScore("TOPIK_II", 3)).toBe(40);
    expect(getTopikWritingTargetScore("TOPIK_II", 4)).toBe(50);
    expect(getTopikWritingTargetScore("TOPIK_II", 5)).toBeCloseTo(190 / 3, 5);
    expect(getTopikWritingTargetScore("TOPIK_II", 6)).toBeCloseTo(230 / 3, 5);
  });

  it("returns null for TOPIK I because this app has no TOPIK I writing score source", () => {
    expect(getTopikWritingTargetScore("TOPIK_I", 2)).toBe(null);
  });
});

describe("calculateGoalProgress", () => {
  it("uses score_total and score_max as DB source values before averaging", () => {
    const progress = calculateGoalProgress({
      goal: { topikLevel: "TOPIK_II", targetGrade: 4 },
      feedbacks: [
        { scoreTotal: 20, scoreMax: 50 },
        { scoreTotal: 40, scoreMax: 100 },
      ],
    });

    expect(progress).toBe(80);
  });

  it("treats a missing score_max as a 100-point score, matching feedback UI convention", () => {
    const progress = calculateGoalProgress({
      goal: { topikLevel: "TOPIK_II", targetGrade: 4 },
      feedbacks: [{ scoreTotal: 40, scoreMax: null }],
    });

    expect(progress).toBe(80);
  });

  it("does not treat 60 points as a universal passing score", () => {
    const progress = calculateGoalProgress({
      goal: { topikLevel: "TOPIK_II", targetGrade: 5 },
      feedbacks: [{ scoreTotal: 60, scoreMax: 100 }],
    });

    expect(progress).toBe(95);
  });

  it("caps progress at 100 once the target writing score is reached", () => {
    const progress = calculateGoalProgress({
      goal: { topikLevel: "TOPIK_II", targetGrade: 3 },
      feedbacks: [{ scoreTotal: 60, scoreMax: 100 }],
    });

    expect(progress).toBe(100);
  });

  it("returns null when there is no goal or no usable feedback score", () => {
    expect(
      calculateGoalProgress({
        goal: null,
        feedbacks: [{ scoreTotal: 80, scoreMax: 100 }],
      }),
    ).toBe(null);

    expect(
      calculateGoalProgress({
        goal: { topikLevel: "TOPIK_II", targetGrade: 4 },
        feedbacks: [
          { scoreTotal: null, scoreMax: 100 },
          { scoreTotal: 10, scoreMax: 0 },
        ],
      }),
    ).toBe(null);
  });
});
