import { describe, expect, it } from "vitest";
import {
  applySort,
  pageRange,
  problemListQueryKey,
  problemRecommendationsKey,
} from "../../../src/lib/practice/queries";
import { isValidQuestionNo } from "../../../src/lib/practice/types";

describe("problem list query key", () => {
  it("returns stable shape", () => {
    const params = {
      filter: { questionNo: 51 as const },
      sort: "newest" as const,
      page: 1,
      pageSize: 10,
    };
    expect(problemListQueryKey(params)).toEqual(["problem-list", params]);
  });
});

describe("problem recommendations key", () => {
  it("uses question number when present", () => {
    expect(problemRecommendationsKey(51)).toEqual([
      "problem-recommendations",
      51,
    ]);
  });
  it("uses 'all' sentinel when null", () => {
    expect(problemRecommendationsKey(null)).toEqual([
      "problem-recommendations",
      "all",
    ]);
  });
});

describe("applySort", () => {
  it("maps newest to updated_at desc", () => {
    expect(applySort("newest")).toEqual({
      column: "updated_at",
      ascending: false,
    });
  });
  it("maps difficulty-asc correctly", () => {
    expect(applySort("difficulty-asc")).toEqual({
      column: "difficulty",
      ascending: true,
    });
  });
});

describe("pageRange", () => {
  it("returns 0-9 for page 1, size 10", () => {
    expect(pageRange(1, 10)).toEqual({ from: 0, to: 9 });
  });
  it("returns 10-19 for page 2, size 10", () => {
    expect(pageRange(2, 10)).toEqual({ from: 10, to: 19 });
  });
  it("clamps page < 1 to 1", () => {
    expect(pageRange(0, 10)).toEqual({ from: 0, to: 9 });
    expect(pageRange(-3, 10)).toEqual({ from: 0, to: 9 });
  });
  it("clamps size < 1 to 1", () => {
    expect(pageRange(1, 0)).toEqual({ from: 0, to: 0 });
  });
});

describe("isValidQuestionNo", () => {
  it("accepts 51/52/53/54", () => {
    expect(isValidQuestionNo(51)).toBe(true);
    expect(isValidQuestionNo(52)).toBe(true);
    expect(isValidQuestionNo(53)).toBe(true);
    expect(isValidQuestionNo(54)).toBe(true);
  });
  it("rejects strings and out-of-range numbers", () => {
    expect(isValidQuestionNo("51")).toBe(false);
    expect(isValidQuestionNo(50)).toBe(false);
    expect(isValidQuestionNo(null)).toBe(false);
    expect(isValidQuestionNo(undefined)).toBe(false);
  });
});
