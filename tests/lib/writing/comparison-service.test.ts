import { describe, expect, it } from "vitest";
import {
  computeComparisonMetrics,
  generateNarrative,
} from "../../../src/lib/writing/comparison-service";
import type { FeedbackBundle } from "../../../src/lib/writing/types";

const blankDims: FeedbackBundle["dimensions"] = [];

function makeDim(
  dimension: FeedbackBundle["dimensions"][number]["dimension"],
  score: number,
): FeedbackBundle["dimensions"][number] {
  return {
    id: `${dimension}-id`,
    submission_id: "sub",
    user_id: "u",
    dimension,
    score,
    score_max: 100,
    summary: "",
    weakness_level: null,
  };
}

describe("computeComparisonMetrics", () => {
  it("returns no_previous when previousScore + previousDims are null", () => {
    const m = computeComparisonMetrics({
      currentScore: 80,
      currentScoreMax: 100,
      previousScore: null,
      previousScoreMax: null,
      currentDims: blankDims,
      previousDims: null,
      currentChars: 500,
      previousChars: null,
    });
    expect(m.no_previous).toBe(true);
    expect(m.score_delta).toBeNull();
  });

  it("computes score and dim deltas when both sides present", () => {
    const m = computeComparisonMetrics({
      currentScore: 85,
      currentScoreMax: 100,
      previousScore: 80,
      previousScoreMax: 100,
      currentDims: [makeDim("grammar", 85), makeDim("vocab", 70)],
      previousDims: [makeDim("grammar", 80), makeDim("vocab", 72)],
      currentChars: 600,
      previousChars: 500,
    });
    expect(m.score_delta).toBe(5);
    expect(m.char_delta).toBe(100);
    expect(m.dimension_deltas.grammar).toBe(5);
    expect(m.dimension_deltas.vocab).toBe(-2);
  });

  it("normalizes total score deltas to a 0..100 scale", () => {
    const m = computeComparisonMetrics({
      currentScore: 8,
      currentScoreMax: 10,
      previousScore: 70,
      previousScoreMax: 100,
      currentDims: blankDims,
      previousDims: blankDims,
      currentChars: 600,
      previousChars: 500,
    });

    expect(m.score_delta).toBe(10);
  });
});

describe("generateNarrative", () => {
  it("returns the no_previous notice when no comparison data", () => {
    const text = generateNarrative({
      score_delta: null,
      dimension_deltas: {},
      char_delta: null,
      no_previous: true,
    });
    expect(text).toMatch(/이전 제출/);
  });

  it("describes a positive total delta", () => {
    const text = generateNarrative({
      score_delta: 5,
      dimension_deltas: { grammar: 5 },
      char_delta: 100,
      no_previous: false,
    });
    expect(text).toMatch(/5점 향상/);
    expect(text).toMatch(/grammar/);
  });
});
