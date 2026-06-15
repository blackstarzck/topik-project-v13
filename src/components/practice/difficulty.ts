/**
 * 숫자 난이도(1~5) → `practice.common` 난이도 라벨 키 매핑.
 *
 * 추천 화면의 유형 카드(`TypeSelectCards`)와 동일한 난이도 어휘(보통 / 조금
 * 어려움 / 어려움 …)를 문제 목록(`ProblemTable`), 다음 문제(`NextProblemView`),
 * 대체 문제 카드(`AlternativeCardsGrid`)가 모두 공유하도록 한 곳에서 정의한다.
 * 난이도가 없으면(null/undefined) `null`을 돌려주고, 호출부는 표시를 생략한다.
 */
export function difficultyKey(
  difficulty: number | null | undefined,
): string | null {
  if (difficulty == null) return null;
  if (difficulty <= 1) return "difficultyVeryEasy";
  if (difficulty === 2) return "difficultyEasy";
  if (difficulty === 3) return "difficultyNormal";
  if (difficulty === 4) return "difficultyHardish";
  return "difficultyHard";
}

export type DifficultyBucket = "low" | "mid" | "high";

/**
 * User/admin shared display contract: `problems.difficulty` remains a 1-5
 * integer, while compact problem-list labels collapse it to low/mid/high.
 *
 * Source: docs/admin-integration-plan.md, D-G
 *   - low = 1-2
 *   - mid = 3
 *   - high = 4-5
 */
export function difficultyBucket(
  difficulty: number | null | undefined,
): DifficultyBucket | null {
  if (difficulty == null) return null;
  if (difficulty <= 2) return "low";
  if (difficulty === 3) return "mid";
  return "high";
}

export function difficultyBucketShortKey(
  bucket: DifficultyBucket,
): "difficultyShortLow" | "difficultyShortMid" | "difficultyShortHigh" {
  if (bucket === "low") return "difficultyShortLow";
  if (bucket === "mid") return "difficultyShortMid";
  return "difficultyShortHigh";
}

export function difficultyBucketLabelKey(
  bucket: DifficultyBucket,
): "difficultyEasy" | "difficultyNormal" | "difficultyHard" {
  if (bucket === "low") return "difficultyEasy";
  if (bucket === "mid") return "difficultyNormal";
  return "difficultyHard";
}
