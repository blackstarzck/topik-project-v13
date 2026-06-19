import { describe, expect, it } from "vitest";
import {
  build51AnswerText,
  count51AnswerChars,
  FEEDBACK_DIMENSIONS,
  isFeedbackComplete,
  isLongForm,
  isQuestionNo,
  isShortAnswer51DraftJson,
  isShortAnswer,
} from "../../../src/lib/writing/types";

describe("writing/types narrowing", () => {
  it("isQuestionNo accepts 51-54, rejects others", () => {
    expect(isQuestionNo(51)).toBe(true);
    expect(isQuestionNo(54)).toBe(true);
    expect(isQuestionNo(50)).toBe(false);
    expect(isQuestionNo("51")).toBe(false);
    expect(isQuestionNo(null)).toBe(false);
  });

  it("isShortAnswer vs isLongForm cover the union", () => {
    expect(isShortAnswer(51)).toBe(true);
    expect(isShortAnswer(52)).toBe(true);
    expect(isShortAnswer(53)).toBe(false);
    expect(isLongForm(53)).toBe(true);
    expect(isLongForm(54)).toBe(true);
    expect(isLongForm(51)).toBe(false);
  });

  it("FEEDBACK_DIMENSIONS lists all 6 keys", () => {
    expect(FEEDBACK_DIMENSIONS).toEqual([
      "grammar",
      "vocab",
      "structure",
      "content",
      "expression",
      "topic_fit",
    ]);
  });

  it("isFeedbackComplete treats failed as terminal too", () => {
    expect(isFeedbackComplete("complete")).toBe(true);
    expect(isFeedbackComplete("failed")).toBe(true);
    expect(isFeedbackComplete("pending")).toBe(false);
    expect(isFeedbackComplete("analyzing")).toBe(false);
  });

  it("recognizes the 51 per-blank draft JSON shape", () => {
    expect(
      isShortAnswer51DraftJson({
        _v: "51.v1",
        blanks: { "ㄱ": "참가하고 싶은", "ㄴ": "문의해 주시기 바랍니다" },
      }),
    ).toBe(true);

    expect(isShortAnswer51DraftJson({ _v: "51.v1", blanks: null })).toBe(
      false,
    );
    expect(
      isShortAnswer51DraftJson({
        _v: "51.v1",
        blanks: { "ㄱ": "참가하고 싶은", "ㄴ": 42 },
      }),
    ).toBe(false);
    expect(
      isShortAnswer51DraftJson({
        _v: "52.v1",
        blanks: { "ㄱ": "참가하고 싶은" },
      }),
    ).toBe(false);
  });

  it("flattens 51 blank answers in the provided blank order", () => {
    const text = build51AnswerText(
      { "ㄴ": "문의해 주시기 바랍니다", "ㄱ": "참가하고 싶은" },
      [{ label: "ㄱ" }, { label: "ㄴ" }],
    );

    expect(text).toBe("ㄱ: 참가하고 싶은\nㄴ: 문의해 주시기 바랍니다");
  });

  it("counts only the learner-entered 51 answer characters", () => {
    expect(count51AnswerChars({ "ㄱ": "", "ㄴ": " 문의해 주세요 " })).toBe(7);
    expect(build51AnswerText({ "ㄱ": "", "ㄴ": "" }, [{ label: "ㄱ" }, { label: "ㄴ" }])).toBe("");
  });
});
