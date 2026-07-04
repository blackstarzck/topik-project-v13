"use client";

/**
 * F-01 `/library/problems` 목록 상단 툴바.
 * 검색 + 결과 수 + 정렬 Select + 리스트/카드 뷰 Segmented + 모바일 필터
 * 버튼(Badge)을 한 줄로 배치한다. 정렬 Select는 practice 목록
 * (ProblemListControls)과 같은 패턴을 쓴다.
 */

import { Badge, Button, Input, Segmented, Select, Typography } from "antd";
import { useTranslations } from "next-intl";

import {
  AlignJustify,
  LayoutDashboard,
  ListFilter,
} from "@/components/shared/AppIcons";

import type { LibraryListTranslate } from "./library-problems-presenter";
import {
  LIBRARY_PROBLEMS_SORT_KEYS,
  type LibraryProblemsSortKey,
} from "./library-problems-sort";

const { Text } = Typography;

export type LibraryProblemsViewMode = "list" | "card";

type Props = {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  resultCount: number;
  /** 저장 항목이 없으면 정렬/뷰/필터 컨트롤을 숨긴다(검색만 유지). */
  showControls: boolean;
  sortKey: LibraryProblemsSortKey;
  onSortChange: (key: LibraryProblemsSortKey) => void;
  viewMode: LibraryProblemsViewMode;
  onViewModeChange: (mode: LibraryProblemsViewMode) => void;
  activeFilterCount: number;
  onOpenFilters: () => void;
};

const SORT_LABEL_KEYS: Record<LibraryProblemsSortKey, string> = {
  savedDesc: "sortSavedDesc",
  savedAsc: "sortSavedAsc",
  scoreDesc: "sortScoreDesc",
  scoreAsc: "sortScoreAsc",
  questionAsc: "sortQuestionAsc",
};

export function LibraryProblemsToolbar({
  searchTerm,
  onSearchChange,
  resultCount,
  showControls,
  sortKey,
  onSortChange,
  viewMode,
  onViewModeChange,
  activeFilterCount,
  onOpenFilters,
}: Props) {
  const t = useTranslations("library.problemsList") as LibraryListTranslate;
  const tSubmissions = useTranslations(
    "library.submissions",
  ) as LibraryListTranslate;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input.Search
        allowClear
        aria-label={t("searchAriaLabel")}
        className="w-full sm:max-w-sm"
        data-testid="library-problems-search"
        maxLength={40}
        placeholder={t("searchPlaceholder")}
        value={searchTerm}
        onChange={(event) => onSearchChange(event.target.value)}
        onSearch={(value) => onSearchChange(value)}
      />
      <Text data-testid="library-problems-result-count" type="secondary">
        {tSubmissions("resultCount", { count: resultCount })}
      </Text>
      {showControls ? (
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select<LibraryProblemsSortKey>
            aria-label={t("sortAriaLabel")}
            className="min-w-36"
            data-testid="library-problems-sort"
            value={sortKey}
            onChange={(value) => onSortChange(value)}
            options={LIBRARY_PROBLEMS_SORT_KEYS.map((key) => ({
              value: key,
              label: t(SORT_LABEL_KEYS[key]),
            }))}
          />
          <span data-testid="library-problems-view-toggle">
            <Segmented<LibraryProblemsViewMode>
              aria-label={t("viewAriaLabel")}
              value={viewMode}
              onChange={(value) => onViewModeChange(value)}
              options={[
                {
                  value: "list",
                  icon: <AlignJustify aria-hidden size={16} />,
                  title: t("viewList"),
                },
                {
                  value: "card",
                  icon: <LayoutDashboard aria-hidden size={16} />,
                  title: t("viewCard"),
                },
              ]}
            />
          </span>
          <span className="lg:hidden">
            <Badge
              count={activeFilterCount}
              size="small"
              data-testid="library-problems-filter-badge"
            >
              <Button
                data-testid="library-problems-filter-open"
                icon={<ListFilter size={16} />}
                onClick={onOpenFilters}
              >
                {t("filterButton")}
              </Button>
            </Badge>
          </span>
        </div>
      ) : null}
    </div>
  );
}
