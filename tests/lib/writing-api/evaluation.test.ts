import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getTalkpikApiBaseUrl,
  mapExternalEvaluationFeedback,
  toExternalTaskType,
} from "../../../src/lib/writing-api/evaluation";

describe("writing evaluation API adapter", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env.TALKPIK_API_BASE_URL;
    delete process.env.TALKPIK_WRITING_API_BASE_URL;
  });

  it("normalizes the server-only Writing API base URL", () => {
    process.env.TALKPIK_API_BASE_URL = " https://api.example.test/ ";

    expect(getTalkpikApiBaseUrl()).toBe("https://api.example.test");
  });

  it("allows insecure Writing API base URLs outside production for local integration", () => {
    process.env.TALKPIK_API_BASE_URL = "http://58.236.187.135:9009";

    expect(getTalkpikApiBaseUrl()).toBe("http://58.236.187.135:9009");
  });

  it("keeps the legacy Writing API base URL env as a compatibility fallback", () => {
    process.env.TALKPIK_WRITING_API_BASE_URL = " https://legacy.example.test/ ";

    expect(getTalkpikApiBaseUrl()).toBe("https://legacy.example.test");
  });

  it("rejects insecure Writing API base URLs in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.TALKPIK_API_BASE_URL = "http://58.236.187.135:9009";

    expect(() => getTalkpikApiBaseUrl()).toThrow(/https/);
  });

  it("maps question numbers to OpenAPI task types", () => {
    expect(toExternalTaskType(51)).toBe("051");
    expect(toExternalTaskType(52)).toBe("052");
    expect(toExternalTaskType(53)).toBe("053");
    expect(toExternalTaskType(54)).toBe("054");
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

  it("maps Swagger inline annotations into sentence feedback rows", () => {
    const payload = mapExternalEvaluationFeedback({
      submission_id: "00000000-0000-0000-0000-000000000099",
      status: "graded",
      total_score: 88,
      max_score: 100,
      processing_time_seconds: 3.1,
      trait_scores: [],
      errors: [],
      annotations: [
        {
          start_offset: 0,
          end_offset: 5,
          text: "wrong",
          annotation_type: "grammar",
          category: "particle",
          comment: "Use the corrected form.",
          suggestion: "right",
        },
      ],
      ai_summary: "Good answer.",
      degraded: false,
      degraded_traits: [],
    });

    expect(payload.sentences).toEqual([
      {
        sentence_index: 0,
        original_text: "wrong",
        corrected_text: "right",
        comment: "Use the corrected form.",
      },
    ]);
  });
});
