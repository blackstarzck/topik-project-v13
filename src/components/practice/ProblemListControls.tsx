"use client";

import { Input, Select, Switch, Typography } from "antd";
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
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <div className="grid gap-2 xl:col-span-2">
        <Text className="!text-xs !font-semibold !text-text">
          {t("searchLabel")}
        </Text>
        <Input.Search
          className="w-full"
          size="large"
          placeholder={t("searchPlaceholder")}
          allowClear
          status={searchErrorKey ? "error" : undefined}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label={t("searchAria")}
        />
        {searchErrorKey ? (
          <Text type="danger" className="block !text-xs">
            {t(searchErrorKey)}
          </Text>
        ) : null}
      </div>
      <div className="grid gap-2">
        <Text className="!text-xs !font-semibold !text-text">
          {t("difficultyLabel")}
        </Text>
        <Select
          className="w-full"
          size="large"
          value={filter.difficulty ?? "any"}
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
      </div>
      <div className="grid gap-2">
        <Text className="!text-xs !font-semibold !text-text">
          {t("sortLabel")}
        </Text>
        <Select
          className="w-full"
          size="large"
          value={sort}
          onChange={(value) => onSortChange(value as ProblemSort)}
          options={[
            { value: "newest", label: t("sortNewest") },
            { value: "oldest", label: t("sortOldest") },
            { value: "difficulty-asc", label: t("sortDifficultyAsc") },
            { value: "difficulty-desc", label: t("sortDifficultyDesc") },
          ]}
        />
      </div>
      {/* Phase 7-D Task 12 (P1-8) — IA 4 filter 완전화 */}
      <div className="grid gap-2">
        <Text className="!text-xs !font-semibold !text-text">
          {t("solveStatusLabel")}
        </Text>
        <Select
          className="w-full"
          size="large"
          value={filter.solveStatus ?? "all"}
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
      </div>
      <div className="grid content-end md:col-span-2 xl:col-span-1">
        <div className="flex min-h-10 items-center gap-2">
          <Switch
            checked={filter.recommended === true}
            onChange={(checked) =>
              onFilterChange({ ...filter, recommended: checked })
            }
            aria-label={t("recommendedOnlyAria")}
          />
          <Text>{t("recommendedOnly")}</Text>
        </div>
      </div>
    </div>
  );
}
