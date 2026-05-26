// Phase 7 Task 2 (P0-2) — TOPIK writing question 51~54 character limits.
// Codex Round 1 PROPOSE-BETTER: separate `hardMin/hardMax` (system-enforced)
// from `recommendedMin/recommendedMax` (학습자 self-guide).
//
// IA descriptions:
// - 51 (D-01): hard 10-120, recommended 10-120
// - 52 (D-02): hard 10-160, recommended 10-160
// - 53 (D-03): hard 120-300 (analyzable minimum), recommended 200-300
// - 54 (D-04): hard 300-700 (analyzable minimum), recommended 600-700

import type { QuestionNo } from "./types";

export type CharLimit = {
  hardMin: number;
  hardMax: number;
  recommendedMin: number;
  recommendedMax: number;
};

export const CHAR_LIMITS: Record<QuestionNo, CharLimit> = {
  51: { hardMin: 10, hardMax: 120, recommendedMin: 10, recommendedMax: 120 },
  52: { hardMin: 10, hardMax: 160, recommendedMin: 10, recommendedMax: 160 },
  53: { hardMin: 120, hardMax: 300, recommendedMin: 200, recommendedMax: 300 },
  54: { hardMin: 300, hardMax: 700, recommendedMin: 600, recommendedMax: 700 },
} as const;

export function getCharLimit(questionNo: QuestionNo): CharLimit {
  return CHAR_LIMITS[questionNo];
}

/** True when count is within hardMin..hardMax — submit enabled. */
export function isCountSubmittable(
  count: number,
  questionNo: QuestionNo,
): boolean {
  const limit = CHAR_LIMITS[questionNo];
  return count >= limit.hardMin && count <= limit.hardMax;
}

/** True when count is within recommendedMin..recommendedMax — show ✓ marker. */
export function isCountInRecommendedRange(
  count: number,
  questionNo: QuestionNo,
): boolean {
  const limit = CHAR_LIMITS[questionNo];
  return count >= limit.recommendedMin && count <= limit.recommendedMax;
}
