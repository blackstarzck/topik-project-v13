/**
 * X-02 성장 대시보드 area 5 — 인사이트 파생 로직.
 *
 * 제약 조건(description.md): 인사이트 3개 이하, 문장당 60자 이하, 실제 수치
 * 근거 포함. 예외: 생성 실패/데이터 부족 시 기본 학습 팁으로 대체.
 *
 * 외부 LLM 없이 이미 수집된 실제 수치(점수 추세, 풀이 수, 약점 영역)에서만
 * 결정론적으로 문장을 만든다 — 과대 해석/환각 방지(정직 우선). 따라서 이
 * 모듈은 "AI 해석" 이 아니라 규칙 기반 요약이며 그 사실을 UI 카피에 명시한다.
 */

export type InsightInputs = {
  /** 0~100 정규화 평균 점수, 데이터 없으면 null. */
  averageScore: number | null;
  /** 최근(예: 30일) 풀이 수. */
  recentVolume: number;
  /** 점수 추세 변화량(최근 절반 - 이전 절반), null이면 비교 불가. */
  scoreDeltaPct: number | null;
  /** 가장 약한 영역 한글 라벨, 없으면 null. */
  weakestDimensionLabel: string | null;
  /** 연속 학습일. */
  streakDays: number;
};

const MAX_INSIGHTS = 3;
const MAX_CHARS = 60;

function clamp(sentence: string): string {
  if (sentence.length <= MAX_CHARS) return sentence;
  return `${sentence.slice(0, MAX_CHARS - 1)}…`;
}

/**
 * 실제 수치를 근거로 최대 3개의 짧은 인사이트 문장을 만든다. 근거가 전혀 없으면
 * 기본 학습 팁 1개를 반환한다(예외 처리).
 */
export function buildGrowthInsights(inputs: InsightInputs): string[] {
  const out: string[] = [];

  if (inputs.scoreDeltaPct != null && Math.abs(inputs.scoreDeltaPct) >= 3) {
    const dir = inputs.scoreDeltaPct > 0 ? "올랐어요" : "내렸어요";
    const pct = Math.abs(Math.round(inputs.scoreDeltaPct));
    out.push(clamp(`최근 평균 점수가 이전보다 ${pct}% ${dir}.`));
  }

  if (inputs.weakestDimensionLabel) {
    out.push(
      clamp(`'${inputs.weakestDimensionLabel}' 영역 점수가 가장 낮아요.`),
    );
  }

  if (inputs.recentVolume > 0) {
    out.push(clamp(`최근 ${inputs.recentVolume}회 풀이 기록이 쌓였어요.`));
  } else if (inputs.averageScore != null) {
    out.push(
      clamp(`지금까지 평균 ${Math.round(inputs.averageScore)}점을 받았어요.`),
    );
  }

  if (out.length < MAX_INSIGHTS && inputs.streakDays >= 2) {
    out.push(clamp(`${inputs.streakDays}일 연속으로 학습하고 있어요.`));
  }

  if (out.length === 0) {
    // 예외: 근거 없음 → 기본 학습 팁.
    return ["짧게 자주 쓰는 연습이 점수 향상에 가장 도움이 됩니다."];
  }

  return out.slice(0, MAX_INSIGHTS);
}
