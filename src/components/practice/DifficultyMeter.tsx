"use client";

/**
 * 난이도(1~5)의 색, 라벨, 상태 아이콘 결정을 한 곳에서 관리한다.
 * 색은 상태 아이콘에만 입히고 의미는 항상 함께 표시되는 글자 라벨이 전달한다.
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

const DIFFICULTY_ICON_COLOR_CLASS: Record<DifficultyLevel, string> = {
  1: "bg-[#5e9e6f]",
  2: "bg-[#8aa04e]",
  3: "bg-[#cca63a]",
  4: "bg-[#cf833f]",
  5: "bg-[#c75d4f]",
};

type DifficultyIconBand = "low" | "middle" | "high";

const DIFFICULTY_STATE_ASSET: Record<DifficultyIconBand, string> = {
  low: "/assets/state/difficulty-low.svg",
  middle: "/assets/state/difficulty-middle.svg",
  high: "/assets/state/difficulty-high.svg",
};

const DIFFICULTY_ICON_MASK_CLASS: Record<DifficultyIconBand, string> = {
  low: "[mask:url(/assets/state/difficulty-low.svg)_center/contain_no-repeat] [-webkit-mask:url(/assets/state/difficulty-low.svg)_center/contain_no-repeat]",
  middle:
    "[mask:url(/assets/state/difficulty-middle.svg)_center/contain_no-repeat] [-webkit-mask:url(/assets/state/difficulty-middle.svg)_center/contain_no-repeat]",
  high: "[mask:url(/assets/state/difficulty-high.svg)_center/contain_no-repeat] [-webkit-mask:url(/assets/state/difficulty-high.svg)_center/contain_no-repeat]",
};

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
export function difficultyIconColorClass(level: number): string {
  return DIFFICULTY_ICON_COLOR_CLASS[clampDifficultyLevel(level)];
}

export function difficultyLabelKey(level: number): DifficultyLabelKey {
  return DIFFICULTY_LABEL_KEYS[clampDifficultyLevel(level) - 1];
}

function difficultyIconBand(level: number): DifficultyIconBand {
  const clamped = clampDifficultyLevel(level);
  if (clamped <= 2) return "low";
  if (clamped === 3) return "middle";
  return "high";
}

export function difficultyStateAsset(level: number): string {
  return DIFFICULTY_STATE_ASSET[difficultyIconBand(level)];
}

export function difficultyIconMaskClass(level: number): string {
  return DIFFICULTY_ICON_MASK_CLASS[difficultyIconBand(level)];
}

type DifficultyStateIconProps = {
  level: number;
  className?: string;
  sizeClassName?: string;
  testId?: string;
};

export function DifficultyStateIcon({
  level,
  className,
  sizeClassName = "size-4",
  testId,
}: DifficultyStateIconProps) {
  return (
    <span
      aria-hidden="true"
      data-testid={testId}
      data-difficulty-icon-src={difficultyStateAsset(level)}
      className={[
        "inline-block shrink-0",
        sizeClassName,
        difficultyIconColorClass(level),
        difficultyIconMaskClass(level),
        className ?? "",
      ].join(" ")}
    />
  );
}
