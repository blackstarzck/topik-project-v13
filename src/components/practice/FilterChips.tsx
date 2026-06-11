"use client";

import { Button, Typography } from "antd";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ProblemFilter, ProblemSort } from "@/lib/practice/types";

const { Text } = Typography;

/** Maps a solveStatus value to its `practice.problems` translation key. */
const SOLVE_LABEL_KEYS: Record<string, string> = {
  unsolved: "solveUnsolved",
  inProgress: "solveInProgress",
  solved: "solveSolved",
};

/** Maps a sort value to its `practice.problems` translation key. */
const SORT_LABEL_KEYS: Record<ProblemSort, string> = {
  newest: "sortNewest",
  oldest: "sortOldest",
  "difficulty-asc": "sortDifficultyAsc",
  "difficulty-desc": "sortDifficultyDesc",
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
  const t = useTranslations("practice.problems");
  const tCommon = useTranslations("practice.common");
  const chips: Chip[] = [];

  if (filter.questionNo != null) {
    chips.push({
      key: "type",
      label: tCommon("questionNo", { no: filter.questionNo }),
      onClose: () => onFilterChange({ ...filter, questionNo: null }),
    });
  }
  if (filter.difficulty != null) {
    chips.push({
      key: "difficulty",
      label: tCommon("difficultyValue", { level: filter.difficulty }),
      onClose: () => onFilterChange({ ...filter, difficulty: null }),
    });
  }
  if (filter.solveStatus && filter.solveStatus !== "all") {
    chips.push({
      key: "solve",
      label: SOLVE_LABEL_KEYS[filter.solveStatus]
        ? t(SOLVE_LABEL_KEYS[filter.solveStatus] as Parameters<typeof t>[0])
        : filter.solveStatus,
      onClose: () => onFilterChange({ ...filter, solveStatus: "all" }),
    });
  }
  if (filter.recommended === true) {
    chips.push({
      key: "recommended",
      label: t("recommendedOnly"),
      onClose: () => onFilterChange({ ...filter, recommended: false }),
    });
  }
  if (filter.search && filter.search.trim().length > 0) {
    chips.push({
      key: "search",
      label: t("searchChip", { query: filter.search.trim() }),
      onClose: () => onFilterChange({ ...filter, search: "" }),
    });
  }
  if (sort !== "newest") {
    chips.push({
      key: "sort",
      label: t(SORT_LABEL_KEYS[sort] as Parameters<typeof t>[0]),
      onClose: () => onSortChange("newest"),
    });
  }

  if (chips.length === 0) return null;

  // §2 제약 — 칩은 5개 이하 표시. 초과분은 "+N" 으로 요약.
  const visible = chips.slice(0, 5);
  const overflow = chips.length - visible.length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Text type="secondary" className="!text-xs">
        {t("appliedFilters")}
      </Text>
      {visible.map((c) => (
        <button
          key={c.key}
          type="button"
          className="inline-flex min-h-8 items-center gap-1 rounded-full border border-border bg-surface px-3 text-xs font-semibold text-text-secondary"
          onClick={c.onClose}
        >
          <span>{c.label}</span>
          <X size={12} aria-hidden="true" />
        </button>
      ))}
      {overflow > 0 ? (
        <span className="inline-flex min-h-8 items-center rounded-full border border-border bg-surface px-3 text-xs font-semibold text-text-secondary">
          +{overflow}
        </span>
      ) : null}
      <Button size="small" type="link" onClick={onReset}>
        {t("resetAll")}
      </Button>
    </div>
  );
}
