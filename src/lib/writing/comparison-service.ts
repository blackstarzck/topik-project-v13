import type { FeedbackBundle } from "./types";

export type ComparisonMetricScoreItem = {
  key: string;
  score: number | null;
  scoreMax: number | null;
};

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
  currentScoreItems?: ComparisonMetricScoreItem[];
  previousScoreItems?: ComparisonMetricScoreItem[] | null;
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
  const dimensionDeltas =
    input.currentScoreItems && input.currentScoreItems.length > 0
      ? computeScoreItemDeltas(
          input.currentScoreItems,
          input.previousScoreItems ?? null,
        )
      : computeDimensionDeltas(input.currentDims, input.previousDims);

  return {
    score_delta: scoreDelta,
    dimension_deltas: dimensionDeltas,
    char_delta: charDelta,
    no_previous: false,
  };
}

export function generateNarrative(metrics: ComparisonMetrics): string {
  if (metrics.no_previous) {
    return "이전 제출이 없어 비교할 항목이 부족합니다. 다음 제출부터 변화 추이를 보여 드릴게요.";
  }

  const total =
    metrics.score_delta === null
      ? "총점 비교가 어려운 항목입니다."
      : metrics.score_delta >= 0
        ? `이번 답안의 총점이 ${formatPoint(metrics.score_delta)}점 향상되었습니다.`
        : `이번 답안의 총점이 ${formatPoint(Math.abs(metrics.score_delta))}점 하락했습니다.`;

  const dimensions = Object.entries(metrics.dimension_deltas)
    .filter(
      (entry): entry is [string, number] =>
        entry[1] !== null && Math.abs(entry[1]) >= 2,
    )
    .slice(0, 2)
    .map(
      ([key, value]) =>
        `${comparisonLabel(key)} ${value >= 0 ? "+" : ""}${formatPoint(value)}점`,
    )
    .join(", ");

  return dimensions ? `${total} 주요 변화: ${dimensions}.` : total;
}

function computeScoreItemDeltas(
  currentItems: ComparisonMetricScoreItem[],
  previousItems: ComparisonMetricScoreItem[] | null,
): Record<string, number | null> {
  const deltas: Record<string, number | null> = {};
  for (const current of currentItems) {
    const previous = previousItems?.find((item) => item.key === current.key);
    const currentScore = normalizeScore(current.score, current.scoreMax);
    const previousScore = normalizeScore(
      previous?.score ?? null,
      previous?.scoreMax ?? null,
    );
    deltas[current.key] =
      currentScore !== null && previousScore !== null
        ? round1(currentScore - previousScore)
        : null;
  }
  return deltas;
}

function computeDimensionDeltas(
  currentDims: FeedbackBundle["dimensions"],
  previousDims: FeedbackBundle["dimensions"] | null,
): Record<string, number | null> {
  const dimDeltas: Record<string, number | null> = {};
  for (const cur of currentDims) {
    const prev = previousDims?.find((p) => p.dimension === cur.dimension);
    if (prev && cur.score !== null && prev.score !== null) {
      dimDeltas[cur.dimension] = round1(cur.score - prev.score);
    } else {
      dimDeltas[cur.dimension] = null;
    }
  }
  return dimDeltas;
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

function comparisonLabel(key: string): string {
  const labels: Record<string, string> = {
    blank_1: "ㄱ 빈칸",
    blank_2: "ㄴ 빈칸",
    grammar: "문법",
    vocab: "어휘",
    structure: "구성",
    content: "내용",
    expression: "표현",
    topic_fit: "주제 적합성",
    language: "언어",
  };
  return labels[key] ?? key;
}

function formatPoint(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(1).replace(/\.0$/, "");
}
