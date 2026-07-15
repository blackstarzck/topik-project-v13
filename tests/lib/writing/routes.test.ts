import { describe, expect, it } from "vitest";

import {
  resolveWritingReturnTo,
  writingProblemHref,
  writingQuestionHref,
} from "@/lib/writing/routes";

describe("writing route helpers", () => {
  it("builds a specific writing page URL for valid TOPIK writing question numbers", () => {
    expect(writingProblemHref({ questionNo: 53, problemId: "problem-1" })).toBe(
      "/writing/long-form-writing-53?problem=problem-1",
    );
  });

  it("falls back to the problem list when the problem cannot map to a writing page", () => {
    expect(
      writingProblemHref({ questionNo: null, problemId: "problem-1" }),
    ).toBe("/practice/problems");
    expect(writingProblemHref({ questionNo: 88, problemId: "problem-1" })).toBe(
      "/practice/problems",
    );
  });

  it("preserves the fresh retry flag", () => {
    expect(
      writingProblemHref({
        questionNo: 52,
        problemId: "problem-1",
        fresh: true,
      }),
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

  it("adds one encoded return target without losing other writing parameters", () => {
    const href = writingProblemHref({
      questionNo: 53,
      problemId: "problem/1",
      fresh: true,
      hint: true,
      retrySubmissionId: "submission/1",
      returnTo: "/practice/problems?type=long&page=2#results",
    });
    const url = new URL(href, "https://talkpik.test");

    expect(url.pathname).toBe("/writing/long-form-writing-53");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      problem: "problem/1",
      fresh: "1",
      hint: "1",
      retrySubmission: "submission/1",
      returnTo: "/practice/problems?type=long&page=2#results",
    });
    expect(url.searchParams.getAll("returnTo")).toHaveLength(1);
  });

  it("supports return targets on direct question links", () => {
    expect(
      writingQuestionHref(51, {
        returnTo: "/dashboard",
      }),
    ).toBe("/writing/short-answer-writing-51?returnTo=%2Fdashboard");
  });

  it.each([
    "/dashboard",
    "/practice/recommendations?type=short",
    "/practice/problems?q=51&sort=recent&page=3#results",
    "/practice/next",
    "/practice/weakness",
    "/library",
    "/library/problems",
    "/writing/feedback/short/submission-1",
    "/writing/feedback/long/submission-2?tab=sentences",
    "/writing/reports/report-1/compare#scores",
  ])("preserves an allowed writing return target: %s", (returnTo) => {
    expect(resolveWritingReturnTo(returnTo)).toBe(returnTo);
  });

  it.each([
    null,
    undefined,
    "",
    "dashboard",
    "https://evil.example/dashboard",
    "//evil.example/dashboard",
    "/\\evil.example/dashboard",
    "/api/export/pdf",
    "/auth/callback",
    "/login",
    "/settings/account",
    "/writing/short-answer-writing-51?problem=problem-1",
    "/practice/problems?returnTo=%2Fdashboard",
    "/practice%2Fproblems",
    "/writing/feedback/short/submission%252F1",
    ["/dashboard", "/library"],
  ])("falls back for an unsafe writing return target: %j", (returnTo) => {
    expect(resolveWritingReturnTo(returnTo)).toBe("/practice/problems");
  });

  it("omits invalid and default return targets from generated links", () => {
    expect(
      writingProblemHref({
        questionNo: 51,
        problemId: "problem-1",
        returnTo: "https://evil.example",
      }),
    ).toBe("/writing/short-answer-writing-51?problem=problem-1");
    expect(
      writingProblemHref({
        questionNo: 51,
        problemId: "problem-1",
        returnTo: "/practice/problems",
      }),
    ).toBe("/writing/short-answer-writing-51?problem=problem-1");
  });
});
