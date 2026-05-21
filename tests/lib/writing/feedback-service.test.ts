import { describe, expect, it } from "vitest";
import { generateMockFeedback } from "../../../src/lib/writing/feedback-service";

describe("generateMockFeedback (deterministic mock)", () => {
  it("short-answer (51) returns empty sentences", () => {
    const out = generateMockFeedback({
      question_no: 51,
      char_count: 80,
      answer_text: "단답입니다.",
    });
    expect(out.sentences).toHaveLength(0);
    expect(out.dimensions).toHaveLength(6);
    expect(out.feedback.ai_model).toBe("mock-v1");
    expect(out.feedback.ai_model_version).toBe("phase-5");
  });

  it("long-form (53) returns sentence list proportional to sentence splits", () => {
    const out = generateMockFeedback({
      question_no: 53,
      char_count: 700,
      answer_text:
        "이 글은 첫 번째 주장입니다. 두 번째 근거를 제시합니다. 세 번째로 정리합니다.",
    });
    expect(out.sentences.length).toBeGreaterThanOrEqual(3);
    expect(out.sentences[0].sentence_index).toBe(0);
  });

  it("dimensions cover all 6 keys", () => {
    const out = generateMockFeedback({
      question_no: 52,
      char_count: 100,
      answer_text: "x",
    });
    const dims = out.dimensions.map((d) => d.dimension).sort();
    expect(dims).toEqual([
      "content",
      "expression",
      "grammar",
      "structure",
      "topic_fit",
      "vocab",
    ]);
  });

  it("is deterministic — same input yields same score", () => {
    const a = generateMockFeedback({
      question_no: 51,
      char_count: 80,
      answer_text: "abc",
    });
    const b = generateMockFeedback({
      question_no: 51,
      char_count: 80,
      answer_text: "abc",
    });
    expect(a.feedback.score_total).toBe(b.feedback.score_total);
    expect(a.dimensions[0].score).toBe(b.dimensions[0].score);
  });
});
