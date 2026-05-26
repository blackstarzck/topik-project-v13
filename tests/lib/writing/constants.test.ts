import { describe, expect, it } from "vitest";
import {
  CHAR_LIMITS,
  getCharLimit,
  isCountInRecommendedRange,
  isCountSubmittable,
} from "../../../src/lib/writing/constants";

describe("CHAR_LIMITS canonical values", () => {
  it("matches IA descriptions for all four questions", () => {
    expect(CHAR_LIMITS[51]).toEqual({
      hardMin: 10,
      hardMax: 120,
      recommendedMin: 10,
      recommendedMax: 120,
    });
    expect(CHAR_LIMITS[52]).toEqual({
      hardMin: 10,
      hardMax: 160,
      recommendedMin: 10,
      recommendedMax: 160,
    });
    expect(CHAR_LIMITS[53]).toEqual({
      hardMin: 120,
      hardMax: 300,
      recommendedMin: 200,
      recommendedMax: 300,
    });
    expect(CHAR_LIMITS[54]).toEqual({
      hardMin: 300,
      hardMax: 700,
      recommendedMin: 600,
      recommendedMax: 700,
    });
  });
});

describe("isCountSubmittable", () => {
  it("rejects count below hardMin", () => {
    expect(isCountSubmittable(9, 51)).toBe(false);
    expect(isCountSubmittable(119, 53)).toBe(false); // 53 hardMin is 120
  });
  it("accepts count at hardMin boundary", () => {
    expect(isCountSubmittable(10, 51)).toBe(true);
    expect(isCountSubmittable(120, 53)).toBe(true);
    expect(isCountSubmittable(300, 54)).toBe(true);
  });
  it("rejects count above hardMax", () => {
    expect(isCountSubmittable(121, 51)).toBe(false);
    expect(isCountSubmittable(701, 54)).toBe(false);
  });
  it("accepts count at hardMax boundary", () => {
    expect(isCountSubmittable(120, 51)).toBe(true);
    expect(isCountSubmittable(700, 54)).toBe(true);
  });
});

describe("isCountInRecommendedRange", () => {
  it("false when below recommendedMin (53 between hardMin and recommendedMin)", () => {
    expect(isCountInRecommendedRange(150, 53)).toBe(false); // 53 recommended 200
    expect(isCountInRecommendedRange(199, 53)).toBe(false);
  });
  it("true when within recommended range", () => {
    expect(isCountInRecommendedRange(200, 53)).toBe(true);
    expect(isCountInRecommendedRange(300, 53)).toBe(true);
    expect(isCountInRecommendedRange(650, 54)).toBe(true);
  });
  it("false above recommendedMax (which equals hardMax)", () => {
    expect(isCountInRecommendedRange(701, 54)).toBe(false);
  });
  it("for 51/52 recommended == hard, so range matches isCountSubmittable", () => {
    expect(isCountInRecommendedRange(50, 51)).toBe(true);
    expect(isCountInRecommendedRange(80, 52)).toBe(true);
  });
});

describe("getCharLimit", () => {
  it("returns same object as CHAR_LIMITS[n]", () => {
    expect(getCharLimit(51)).toBe(CHAR_LIMITS[51]);
    expect(getCharLimit(54)).toBe(CHAR_LIMITS[54]);
  });
});
