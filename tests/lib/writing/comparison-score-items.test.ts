import { describe, expect, it } from "vitest";
import {
  buildBlankComparisonData,
  buildComparisonScoreItems,
  hasBlankScoreItems,
  scoreItemMap,
  toComparisonMetricScoreItems,
} from "../../../src/lib/writing/comparison-score-items";
import type {
  FeedbackBundle,
  WritingSubmissionRow,
} from "../../../src/lib/writing/types";

function bundle(rawAiResult: unknown): FeedbackBundle {
  return {
    feedback: {
      id: "feedback-1",
      submission_id: "submission-1",
      user_id: "user-1",
      status: "complete",
      score_total: 4,
      score_max: 10,
      overall_summary: "",
      raw_ai_result: rawAiResult,
      ai_model: "test",
      ai_model_version: "test",
      created_at: "2026-06-29T00:00:00.000Z",
      generated_at: "2026-06-29T00:00:00.000Z",
    },
    dimensions: [],
    sentences: [],
  } as unknown as FeedbackBundle;
}

function submission(
  overrides: Partial<WritingSubmissionRow>,
): WritingSubmissionRow {
  return {
    id: "submission-1",
    user_id: "user-1",
    problem_id: "problem-1",
    draft_id: null,
    parent_submission_id: null,
    question_no: 51,
    answer_text: "ㄱ: 현재 답안\nㄴ: 두 번째 답안",
    answer_json: {
      _v: "51.v1",
      blanks: { ㄱ: "현재 답안", ㄴ: "두 번째 답안" },
    },
    char_count: 12,
    feedback_status: "complete",
    submitted_at: "2026-06-29T00:00:00.000Z",
    ...overrides,
  } as WritingSubmissionRow;
}

describe("buildComparisonScoreItems", () => {
  it("reads Q51 blank trait scores as normalized comparison items", () => {
    const items = buildComparisonScoreItems(
      51,
      bundle({
        trait_scores: [
          {
            trait: "blank_2",
            score: 3,
            max_score: 5,
            feedback: "second feedback",
            strengths: ["kept context"],
            improvements: ["tighten ending"],
          },
          {
            trait: "blank_1",
            score: 2,
            max_score: 5,
            feedback: "first feedback",
          },
        ],
      }),
    );

    expect(items.map((item) => item.key)).toEqual(["blank_1", "blank_2"]);
    expect(items[0]).toMatchObject({
      kind: "blank",
      normalizedScore: 40,
      rawScore: 2,
      scoreMax: 5,
      summary: "first feedback",
    });
    expect(items[1]).toMatchObject({
      normalizedScore: 60,
      strengths: ["kept context"],
      improvements: ["tighten ending"],
    });
    expect(hasBlankScoreItems(items)).toBe(true);
    expect(scoreItemMap(items)).toEqual({ blank_1: 40, blank_2: 60 });
    expect(toComparisonMetricScoreItems(items)).toEqual([
      { key: "blank_1", score: 40, scoreMax: 100 },
      { key: "blank_2", score: 60, scoreMax: 100 },
    ]);
  });

  it("does not throw when raw trait scores are malformed", () => {
    const items = buildComparisonScoreItems(
      52,
      bundle({ trait_scores: [{ trait: "blank_1", score: "bad" }, null] }),
    );

    expect(items).toEqual([
      expect.objectContaining({
        key: "blank_1",
        normalizedScore: null,
        rawScore: null,
      }),
    ]);
  });
});

describe("buildBlankComparisonData", () => {
  it("prefers answer_json blanks and computes normalized and raw deltas", () => {
    const currentItems = buildComparisonScoreItems(
      51,
      bundle({
        trait_scores: [
          { trait: "blank_1", score: 4, max_score: 5 },
          { trait: "blank_2", score: 2, max_score: 5 },
        ],
      }),
    );
    const previousItems = buildComparisonScoreItems(
      51,
      bundle({
        trait_scores: [
          { trait: "blank_1", score: 2, max_score: 5 },
          { trait: "blank_2", score: 2, max_score: 5 },
        ],
      }),
    );

    const rows = buildBlankComparisonData({
      currentItems,
      previousItems,
      currentSubmission: submission({}),
      previousSubmission: submission({
        id: "previous",
        answer_text: "ㄱ: 이전 답안\nㄴ: 이전 두 번째",
        answer_json: {
          _v: "51.v1",
          blanks: { ㄱ: "이전 답안", ㄴ: "이전 두 번째" },
        },
      }),
    });

    expect(rows[0]).toMatchObject({
      key: "blank_1",
      delta: 40,
      rawDelta: 2,
      currentAnswer: "현재 답안",
      previousAnswer: "이전 답안",
    });
    expect(rows[1]).toMatchObject({
      key: "blank_2",
      delta: 0,
      rawDelta: 0,
    });
  });
});
