"use client";

import { Button, Space, Tag, Typography } from "antd";
import type { ProblemFilter, ProblemSort } from "@/lib/practice/types";

const { Text } = Typography;

const SOLVE_LABELS: Record<string, string> = {
  unsolved: "안 풀음",
  inProgress: "진행 중",
  solved: "완료",
};

const SORT_LABELS: Record<ProblemSort, string> = {
  newest: "최신순",
  oldest: "오래된순",
  "difficulty-asc": "난이도 낮은순",
  "difficulty-desc": "난이도 높은순",
};

type Chip = { key: string; label: string; onClose: () => void };

type Props = {
  filter: ProblemFilter;
  sort: ProblemSort;
  onFilterChange: (next: ProblemFilter) => void;
  onSortChange: (next: ProblemSort) => void;
  onReset: () => void;
};

/**
 * C-02 §2 — 선택된 필터를 칩으로 노출(최대 5개) + 전체 초기화 CTA.
 * 칩 하나를 닫으면 해당 필터만 해제된다.
 */
export function FilterChips({
  filter,
  sort,
  onFilterChange,
  onSortChange,
  onReset,
}: Props) {
  const chips: Chip[] = [];

  if (filter.questionNo != null) {
    chips.push({
      key: "type",
      label: `${filter.questionNo}번`,
      onClose: () => onFilterChange({ ...filter, questionNo: null }),
    });
  }
  if (filter.difficulty != null) {
    chips.push({
      key: "difficulty",
      label: `난이도 ${filter.difficulty}`,
      onClose: () => onFilterChange({ ...filter, difficulty: null }),
    });
  }
  if (filter.solveStatus && filter.solveStatus !== "all") {
    chips.push({
      key: "solve",
      label: SOLVE_LABELS[filter.solveStatus] ?? filter.solveStatus,
      onClose: () => onFilterChange({ ...filter, solveStatus: "all" }),
    });
  }
  if (filter.recommended === true) {
    chips.push({
      key: "recommended",
      label: "추천만",
      onClose: () => onFilterChange({ ...filter, recommended: false }),
    });
  }
  if (filter.search && filter.search.trim().length > 0) {
    chips.push({
      key: "search",
      label: `검색: ${filter.search.trim()}`,
      onClose: () => onFilterChange({ ...filter, search: "" }),
    });
  }
  if (sort !== "newest") {
    chips.push({
      key: "sort",
      label: SORT_LABELS[sort],
      onClose: () => onSortChange("newest"),
    });
  }

  if (chips.length === 0) return null;

  // §2 제약 — 칩은 5개 이하 표시. 초과분은 "+N" 으로 요약.
  const visible = chips.slice(0, 5);
  const overflow = chips.length - visible.length;

  return (
    <Space wrap size={4} align="center">
      <Text type="secondary" style={{ fontSize: 12 }}>
        적용된 필터
      </Text>
      {visible.map((c) => (
        <Tag key={c.key} closable onClose={c.onClose} color="blue">
          {c.label}
        </Tag>
      ))}
      {overflow > 0 ? <Tag>+{overflow}</Tag> : null}
      <Button size="small" type="link" onClick={onReset}>
        전체 초기화
      </Button>
    </Space>
  );
}
