import type { FeedbackBundle } from "./types";

export type ComparisonMetrics = {
  score_delta: number | null;
  dimension_deltas: Record<string, number | null>;
  char_delta: number | null;
  no_previous: boolean;
};

type Input = {
  currentScore: number | null;
  currentScoreMax: number | null;
  previousScore: number | null;
  previousScoreMax: number | null;
  currentDims: FeedbackBundle["dimensions"];
  previousDims: FeedbackBundle["dimensions"] | null;
  currentChars: number;
  previousChars: number | null;
};

export function computeComparisonMetrics(input: Input): ComparisonMetrics {
  if (input.previousScore === null && input.previousDims === null) {
    return {
      score_delta: null,
      dimension_deltas: {},
      char_delta: null,
      no_previous: true,
    };
  }
  const currentNormalizedScore = normalizeScore(
    input.currentScore,
    input.currentScoreMax,
  );
  const previousNormalizedScore = normalizeScore(
    input.previousScore,
    input.previousScoreMax,
  );
  const scoreDelta =
    previousNormalizedScore !== null && currentNormalizedScore !== null
      ? round1(currentNormalizedScore - previousNormalizedScore)
      : null;
  const charDelta =
    input.previousChars !== null
      ? input.currentChars - input.previousChars
      : null;
  const dimDeltas: Record<string, number | null> = {};
  for (const cur of input.currentDims) {
    const prev = input.previousDims?.find((p) => p.dimension === cur.dimension);
    if (prev && cur.score !== null && prev.score !== null) {
      dimDeltas[cur.dimension] = round1(cur.score - prev.score);
    } else {
      dimDeltas[cur.dimension] = null;
    }
  }
  return {
    score_delta: scoreDelta,
    dimension_deltas: dimDeltas,
    char_delta: charDelta,
    no_previous: false,
  };
}

export function generateNarrative(metrics: ComparisonMetrics): string {
  if (metrics.no_previous) {
    return "이전 제출이 없어 비교 항목이 부족합니다. 다음 제출부터 변화 추이를 보여 드릴게요.";
  }
  const total =
    metrics.score_delta === null
      ? "총점 비교가 어려운 항목입니다."
      : metrics.score_delta >= 0
        ? `이번 답안의 총점이 ${metrics.score_delta}점 향상되었습니다.`
        : `이번 답안의 총점이 ${Math.abs(metrics.score_delta)}점 하락했습니다.`;
  const dims = Object.entries(metrics.dimension_deltas)
    .filter(
      (entry): entry is [string, number] =>
        entry[1] !== null && Math.abs(entry[1]) >= 2,
    )
    .slice(0, 2)
    .map(([k, v]) => `${k} 차원 ${v >= 0 ? "+" : ""}${v}점`)
    .join(", ");
  return dims ? `${total} 주요 변화: ${dims}.` : total;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function normalizeScore(
  score: number | null,
  scoreMax: number | null,
): number | null {
  if (score === null) return null;
  const max = scoreMax && scoreMax > 0 ? scoreMax : 100;
  return round1((score / max) * 100);
}
