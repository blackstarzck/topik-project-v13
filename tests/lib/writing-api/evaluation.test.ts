import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getTalkpikApiBaseUrl,
  mapExternalEvaluationFeedback,
  submitExternalWriting,
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
    expect(toExternalTaskType(51)).toBe("Q51");
    expect(toExternalTaskType(52)).toBe("Q52");
    expect(toExternalTaskType(53)).toBe("Q53");
    expect(toExternalTaskType(54)).toBe("Q54");
  });

  it("aborts an indeterminate provider submit at the configured timeout", async () => {
    const fetchImpl = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    ) as unknown as typeof fetch;

    await expect(
      submitExternalWriting({
        baseUrl: "https://api.example.test",
        accessToken: "access-token",
        payload: { task_type: "Q54", text: "answer" },
        timeoutMs: 5,
        fetchImpl,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("does not invent an unsupported provider idempotency header", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          submission_id: "provider-string-id",
          status: "processing",
          message: "accepted",
        }),
        { status: 200 },
      ),
    );

    await submitExternalWriting({
      baseUrl: "https://api.example.test",
      accessToken: "access-token",
      payload: { task_type: "Q54", text: "answer" },
      fetchImpl,
    });

    const request = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(request.headers).not.toHaveProperty("Idempotency-Key");
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
        {
          trait: "language",
          score: 76,
          max_score: 100,
          feedback: "언어 사용을 더 정확하게 다듬어야 합니다.",
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
        expect.objectContaining({
          dimension: "language",
          score: 76,
          summary: "언어 사용을 더 정확하게 다듬어야 합니다.",
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

  it("keeps two blank traits separate from three inline annotations", () => {
    const payload = mapExternalEvaluationFeedback({
      submission_id: "00000000-0000-0000-0000-000000000052",
      status: "graded",
      total_score: 8,
      max_score: 10,
      processing_time_seconds: 2.8,
      trait_scores: [
        {
          trait: "blank_1",
          score: 4,
          max_score: 5,
          feedback: "첫 번째 빈칸 피드백",
        },
        {
          trait: "blank_2",
          score: 4,
          max_score: 5,
          feedback: "두 번째 빈칸 피드백",
        },
      ],
      errors: [],
      annotations: [
        {
          original_text: "정리하지 않으면",
          corrected_text: "정리하지 않으면",
          comment: "첫 번째 빈칸 교정",
        },
        {
          original_text: "꼼꼼하게",
          corrected_text: "꼼꼼하게",
          comment: "두 번째 빈칸 교정 1",
        },
        {
          original_text: "좋다",
          corrected_text: "좋습니다",
          comment: "두 번째 빈칸 교정 2",
        },
      ],
      ai_summary: "두 빈칸을 분석했습니다.",
    });

    expect(payload.dimensions).toEqual([]);
    expect(payload.sentences).toEqual([
      {
        sentence_index: 0,
        original_text: "정리하지 않으면",
        corrected_text: "정리하지 않으면",
        comment: "첫 번째 빈칸 교정",
      },
      {
        sentence_index: 1,
        original_text: "꼼꼼하게",
        corrected_text: "꼼꼼하게",
        comment: "두 번째 빈칸 교정 1",
      },
      {
        sentence_index: 2,
        original_text: "좋다",
        corrected_text: "좋습니다",
        comment: "두 번째 빈칸 교정 2",
      },
    ]);
  });
});
