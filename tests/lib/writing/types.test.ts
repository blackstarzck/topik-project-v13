import { describe, expect, it } from "vitest";
import {
  FEEDBACK_DIMENSIONS,
  isFeedbackComplete,
  isLongForm,
  isQuestionNo,
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
});
