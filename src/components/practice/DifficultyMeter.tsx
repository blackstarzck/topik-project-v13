"use client";

/**
 * 난이도(1~5)를 오름차순 막대 5개 + 단계별 은은한 색으로 표현하는 공용 미니 미터.
 *
 * 색 결정을 한 곳에서만 정의해 난이도를 보여주는 모든 화면(문제 목록 `ProblemTable`,
 * 유형 선택 카드 `TypeSelectCards`)이 같은 색 언어를 공유하도록 한다 —
 * 추천 사유 태그의 `reason-tag-colors.ts`와 동일한 규칙.
 *
 * 색은 텍스트가 아니라 막대(장식)에만 입힌다. 의미는 항상 옆의 글자 라벨이
 * 전달하므로(색만으로 정보를 주지 않음) 대비/접근성 기준을 만족한다.
 */

export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

/** 난이도 라벨 키(`practice.common`). index 0 → 레벨 1 오름차순. */
export const DIFFICULTY_LABEL_KEYS = [
  "difficultyVeryEasy", // 1 쉬움
  "difficultyEasy", // 2 조금 쉬움
  "difficultyNormal", // 3 보통
  "difficultyHardish", // 4 조금 어려움
  "difficultyHard", // 5 어려움
] as const;

export type DifficultyLabelKey = (typeof DIFFICULTY_LABEL_KEYS)[number];

/**
 * 단계별 채움 색. 쉬움(초록) → 어려움(벽돌색)으로 가는 난색 그라데이션을
 * 채도를 낮춰 "너무 쨍하지 않게" 잡았다. 작은 막대라 라이트/다크 배경 모두에서
 * 보이도록 중간 명도를 쓴다(텍스트가 아니라 장식이라 대비 부담 없음).
 */
const DIFFICULTY_FILL_COLOR: Record<DifficultyLevel, string> = {
  1: "#5e9e6f", // 쉬움 — 차분한 초록
  2: "#8aa04e", // 조금 쉬움 — 올리브
  3: "#cca63a", // 보통 — 머스터드/엠버
  4: "#cf833f", // 조금 어려움 — 부드러운 주황
  5: "#c75d4f", // 어려움 — 벽돌색
};

const BAR_HEIGHTS = ["h-1.5", "h-2", "h-2.5", "h-3", "h-3.5"] as const;

/** 임의의 숫자를 1~5 정수 난이도로 보정한다. */
export function clampDifficultyLevel(value: number): DifficultyLevel {
  const rounded = Math.round(value);
  if (rounded <= 1) return 1;
  if (rounded >= 5) return 5;
  return rounded as DifficultyLevel;
}

/** 난이도 → 채움 색(hex). */
export function difficultyFillColor(level: number): string {
  return DIFFICULTY_FILL_COLOR[clampDifficultyLevel(level)];
}

/** 난이도 → `practice.common` 라벨 키. */
export function difficultyLabelKey(level: number): DifficultyLabelKey {
  return DIFFICULTY_LABEL_KEYS[clampDifficultyLevel(level) - 1];
}

type Props = {
  /** 1~5. 범위 밖 값은 보정한다. */
  level: number;
  className?: string;
};

/**
 * 난이도 막대 5개. 채워진 막대는 단계 색, 빈 막대는 토큰 테두리색(`bg-border`).
 * 의미 전달은 옆 글자 라벨이 하므로 미터 자체는 `aria-hidden`.
 */
export function DifficultyMeter({ level, className }: Props) {
  const filled = clampDifficultyLevel(level);
  const color = DIFFICULTY_FILL_COLOR[filled];
  return (
    <span
      className={["inline-flex items-end gap-0.5", className ?? ""].join(" ")}
      aria-hidden="true"
    >
      {BAR_HEIGHTS.map((height, index) => (
        <span
          key={height}
          className={["w-1 rounded-sm bg-border", height].join(" ")}
          style={index < filled ? { backgroundColor: color } : undefined}
        />
      ))}
    </span>
  );
}
