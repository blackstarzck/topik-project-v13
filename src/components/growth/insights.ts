/**
 * X-02 성장 대시보드 area 5 — 인사이트 파생 로직.
 *
 * 제약 조건(description.md): 인사이트 3개 이하, 문장당 60자 이하, 실제 수치
 * 근거 포함. 예외: 생성 실패/데이터 부족 시 기본 학습 팁으로 대체.
 *
 * 외부 LLM 없이 이미 수집된 실제 수치(점수 추세, 풀이 수, 약점 영역)에서만
 * 결정론적으로 문장을 만든다 — 과대 해석/환각 방지(정직 우선). 따라서 이
 * 모듈은 "AI 해석" 이 아니라 규칙 기반 요약이며 그 사실을 UI 카피에 명시한다.
 *
 * i18n: 이 모듈은 컴포넌트가 아니므로 useTranslations 를 호출할 수 없다(wave-2/3
 * 선례). 따라서 여기서는 인사이트 "키 + ICU 변수"만 만들고, 실제 문구는
 * 렌더링 컴포넌트(GrowthDashboard)가 t(`insights.${key}`)로 해석한다.
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

/**
 * 인사이트 1건의 해석 지시서. `key`는 growth.insights.* 카탈로그 키, `values`는
 * 해당 ICU 메시지에 주입할 변수다. 컴포넌트가 t(key, values)로 문구를 만든다.
 */
export type GrowthInsight = {
  key:
    | "scoreUp"
    | "scoreDown"
    | "weakestDimension"
    | "recentVolume"
    | "averageScore"
    | "streak"
    | "defaultTip";
  values?: Record<string, string | number>;
};

/**
 * 실제 수치를 근거로 최대 3개의 짧은 인사이트 지시서를 만든다. 근거가 전혀 없으면
 * 기본 학습 팁 1개를 반환한다(예외 처리). 문구 해석은 렌더 컴포넌트가 담당한다.
 */
export function buildGrowthInsights(inputs: InsightInputs): GrowthInsight[] {
  const out: GrowthInsight[] = [];

  if (inputs.scoreDeltaPct != null && Math.abs(inputs.scoreDeltaPct) >= 3) {
    const pct = Math.abs(Math.round(inputs.scoreDeltaPct));
    out.push({
      key: inputs.scoreDeltaPct > 0 ? "scoreUp" : "scoreDown",
      values: { pct },
    });
  }

  if (inputs.weakestDimensionLabel) {
    out.push({
      key: "weakestDimension",
      values: { dimension: inputs.weakestDimensionLabel },
    });
  }

  if (inputs.recentVolume > 0) {
    out.push({ key: "recentVolume", values: { count: inputs.recentVolume } });
  } else if (inputs.averageScore != null) {
    out.push({
      key: "averageScore",
      values: { score: Math.round(inputs.averageScore) },
    });
  }

  if (out.length < MAX_INSIGHTS && inputs.streakDays >= 2) {
    out.push({ key: "streak", values: { days: inputs.streakDays } });
  }

  if (out.length === 0) {
    // 예외: 근거 없음 → 기본 학습 팁.
    return [{ key: "defaultTip" }];
  }

  return out.slice(0, MAX_INSIGHTS);
}
