"use client";

import { Input, Select, Space, Switch, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type {
  ProblemFilter,
  ProblemSort,
  SolveStatusFilter,
} from "@/lib/practice/types";
import { validateSearch, type SearchReasonKey } from "./problem-list-data";

const { Text } = Typography;

type Props = {
  filter: ProblemFilter;
  sort: ProblemSort;
  onFilterChange: (next: ProblemFilter) => void;
  onSortChange: (next: ProblemSort) => void;
};

export function ProblemListControls({
  filter,
  sort,
  onFilterChange,
  onSortChange,
}: Props) {
  const t = useTranslations("practice.problems");
  const [searchInput, setSearchInput] = useState(filter.search ?? "");
  // description.md §3 예외 — 금칙어/길이 오류는 검색창 하단에 안내.
  // i18n: validateSearch (data module) returns a stable reasonKey; resolve it
  // here against the practice.problems namespace.
  const [searchErrorKey, setSearchErrorKey] = useState<SearchReasonKey | null>(
    null,
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const result = validateSearch(searchInput);
      if (!result.ok) {
        // 유효하지 않은 검색어는 커밋하지 않고 하단 안내만 표시 (§3).
        setSearchErrorKey(result.reasonKey);
        return;
      }
      setSearchErrorKey(null);
      if ((filter.search ?? "") !== result.value) {
        onFilterChange({ ...filter, search: result.value });
      }
    }, 300);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  return (
    <Space wrap size="middle" style={{ width: "100%" }} align="start">
      <div>
        <Input.Search
          placeholder={t("searchPlaceholder")}
          allowClear
          status={searchErrorKey ? "error" : undefined}
          style={{ width: 240 }}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label={t("searchAria")}
        />
        {searchErrorKey ? (
          <Text
            type="danger"
            style={{ display: "block", fontSize: 12, marginTop: 4 }}
          >
            {t(searchErrorKey)}
          </Text>
        ) : null}
      </div>
      <Select
        value={filter.difficulty ?? "any"}
        style={{ width: 140 }}
        onChange={(value) =>
          onFilterChange({
            ...filter,
            difficulty: value === "any" ? null : Number(value),
          })
        }
        options={[
          { value: "any", label: t("difficultyAll") },
          ...Array.from({ length: 5 }, (_, i) => ({
            value: String(i + 1),
            label: t("difficultyLevel", { level: i + 1 }),
          })),
        ]}
      />
      <Select
        value={sort}
        style={{ width: 160 }}
        onChange={(value) => onSortChange(value as ProblemSort)}
        options={[
          { value: "newest", label: t("sortNewest") },
          { value: "oldest", label: t("sortOldest") },
          { value: "difficulty-asc", label: t("sortDifficultyAsc") },
          { value: "difficulty-desc", label: t("sortDifficultyDesc") },
        ]}
      />
      {/* Phase 7-D Task 12 (P1-8) — IA 4 filter 완전화 */}
      <Select
        value={filter.solveStatus ?? "all"}
        style={{ width: 140 }}
        aria-label={t("solveStatusAria")}
        onChange={(value) =>
          onFilterChange({
            ...filter,
            solveStatus: value as SolveStatusFilter,
          })
        }
        options={[
          { value: "all", label: t("solveAll") },
          { value: "unsolved", label: t("solveUnsolved") },
          { value: "inProgress", label: t("solveInProgress") },
          { value: "solved", label: t("solveSolved") },
        ]}
      />
      <Space size={6}>
        <Switch
          checked={filter.recommended === true}
          onChange={(checked) =>
            onFilterChange({ ...filter, recommended: checked })
          }
          aria-label={t("recommendedOnlyAria")}
        />
        <Text>{t("recommendedOnly")}</Text>
      </Space>
    </Space>
  );
}
