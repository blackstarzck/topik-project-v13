/**
 * 추천 사유 태그 색상 시퀀스.
 *
 * 추천 화면(`RecommendationsView`)과 문제 목록(`ProblemRow`)이 동일한 색상
 * 규칙을 공유하도록 한 곳에서 관리한다. 두 화면의 태그 디자인이 항상 같게
 * 유지되도록 색상 결정 로직을 여기서만 정의한다.
 */
export type ReasonTagColor =
  | "blue"
  | "cyan"
  | "geekblue"
  | "purple"
  | "green"
  | "gold";

const REASON_TAG_COLORS_BY_COUNT = {
  1: ["blue"],
  2: ["blue", "cyan"],
  3: ["blue", "cyan", "geekblue"],
} satisfies Record<1 | 2 | 3, readonly ReasonTagColor[]>;

const REASON_TAG_COLOR_SEQUENCE = [
  "blue",
  "cyan",
  "geekblue",
  "purple",
  "green",
  "gold",
] satisfies readonly ReasonTagColor[];

export function getReasonTagColor(index: number, total: number): ReasonTagColor {
  const colors =
    total === 1 || total === 2 || total === 3
      ? REASON_TAG_COLORS_BY_COUNT[total]
      : REASON_TAG_COLOR_SEQUENCE;

  return colors[index % colors.length];
}
