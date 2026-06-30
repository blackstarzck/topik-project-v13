import { describe, expect, it } from "vitest";

import { writingProblemHref } from "@/lib/writing/routes";

describe("writing route helpers", () => {
  it("builds a specific writing page URL for valid TOPIK writing question numbers", () => {
    expect(writingProblemHref({ questionNo: 53, problemId: "problem-1" })).toBe(
      "/writing/long-form-writing-53?problem=problem-1",
    );
  });

  it("falls back to the problem list when the problem cannot map to a writing page", () => {
    expect(writingProblemHref({ questionNo: null, problemId: "problem-1" })).toBe(
      "/practice/problems",
    );
    expect(writingProblemHref({ questionNo: 88, problemId: "problem-1" })).toBe(
      "/practice/problems",
    );
  });

  it("preserves the fresh retry flag", () => {
    expect(
      writingProblemHref({ questionNo: 52, problemId: "problem-1", fresh: true }),
    ).toBe("/writing/answer-writing-52?problem=problem-1&fresh=1");
  });

  it("carries the source submission when retrying from feedback", () => {
    expect(
      writingProblemHref({
        questionNo: 54,
        problemId: "problem-1",
        fresh: true,
        retrySubmissionId: "submission-1",
      }),
    ).toBe(
      "/writing/essay-writing-54?problem=problem-1&fresh=1&retrySubmission=submission-1",
    );
  });
});
