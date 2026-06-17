import { describe, expect, it } from "vitest";

import {
  mapExternalEvaluationFeedback,
  toExternalTaskType,
} from "../../../src/lib/writing-api/evaluation";

describe("writing evaluation API adapter", () => {
  it("maps question numbers to OpenAPI task types", () => {
    expect(toExternalTaskType(51)).toBe("Q51");
    expect(toExternalTaskType(52)).toBe("Q52");
    expect(toExternalTaskType(53)).toBe("Q53");
    expect(toExternalTaskType(54)).toBe("Q54");
  });

  it("maps OpenAPI evaluation feedback into the internal feedback payload", () => {
    const payload = mapExternalEvaluationFeedback({
      submission_id: "sub-1",
      status: "graded",
      total_score: 82,
      max_score: 100,
      processing_time_seconds: 4.2,
      trait_scores: [
        {
          trait: "grammar",
          score: 80,
          max_score: 100,
          feedback: "문법이 안정적입니다.",
        },
        {
          trait: "topic_fit",
          score: 90,
          max_score: 100,
          feedback: "주제 적합성이 좋습니다.",
        },
      ],
      errors: [],
      annotations: [
        {
          start: 0,
          end: 4,
          original_text: "저는는",
          corrected_text: "저는",
          comment: "조사를 한 번만 사용하세요.",
        },
      ],
      ai_summary: "전체적으로 안정적인 답안입니다.",
      degraded: false,
      degraded_traits: [],
    });

    expect(payload.feedback).toMatchObject({
      status: "complete",
      score_total: 82,
      score_max: 100,
      overall_summary: "전체적으로 안정적인 답안입니다.",
      ai_model: "talkpik-writing-api",
    });
    expect(payload.dimensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dimension: "grammar",
          score: 80,
          summary: "문법이 안정적입니다.",
        }),
        expect.objectContaining({
          dimension: "topic_fit",
          score: 90,
          summary: "주제 적합성이 좋습니다.",
        }),
      ]),
    );
    expect(payload.sentences[0]).toMatchObject({
      sentence_index: 0,
      original_text: "저는는",
      corrected_text: "저는",
      comment: "조사를 한 번만 사용하세요.",
    });
  });
});
