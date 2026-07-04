"use client";

import { Alert, Button, Empty, Spin } from "antd";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  LIBRARY_PAGE_SIZE,
  LibraryPagination,
} from "@/components/library/LibraryPagination";
import {
  fetchSubmissionEnrichment,
  type SubmissionEnrichment,
} from "@/components/library/library-enrich-data";
import { AppDrawer } from "@/components/shared/AppDrawer";
import { useLibraryItems } from "@/lib/library/queries";
import type {
  LibraryItemView,
  LibraryProblemView,
  LibrarySubmissionView,
} from "@/lib/library/types";
import { APP_ROUTES } from "@/lib/routes";

import { LibraryProblemsFilterPanel } from "./LibraryProblemsFilterPanel";
import { LibraryProblemsItemCard } from "./LibraryProblemsItemCard";
import {
  LibraryProblemsProblemRow,
  LibraryProblemsSubmissionRow,
} from "./LibraryProblemsRows";
import {
  LibraryProblemsToolbar,
  type LibraryProblemsViewMode,
} from "./LibraryProblemsToolbar";
import {
  EMPTY_LIBRARY_PROBLEMS_FILTERS,
  applyLibraryProblemsFilters,
  countActiveLibraryProblemsFilters,
  countLibraryProblemsFacets,
  isLibraryProblemsFilterStateEmpty,
  type LibraryProblemsFilterState,
} from "./library-problems-filter-model";
import {
  submissionTitle,
  type LibraryListTranslate,
  type MixedLibraryProblemItem,
} from "./library-problems-presenter";
import {
  DEFAULT_LIBRARY_PROBLEMS_SORT,
  sortLibraryProblems,
  type LibraryProblemsSortKey,
} from "./library-problems-sort";
import { matchesLibrarySearch } from "./library-tab-url";

const EMPTY_ENRICHMENT: ReadonlyMap<string, SubmissionEnrichment> = new Map();

type Props = {
  initialSubmissions: LibrarySubmissionView[];
  initialProblems: LibraryProblemView[];
};

type EnrichmentResult = {
  map: ReadonlyMap<string, SubmissionEnrichment>;
  error: boolean;
};

function isSubmission(item: LibraryItemView): item is LibrarySubmissionView {
  return item.kind === "submission";
}

function isProblem(item: LibraryItemView): item is LibraryProblemView {
  return item.kind === "problem";
}

export function LibraryProblemsList({
  initialSubmissions,
  initialProblems,
}: Props) {
  const t = useTranslations("library.problemsList") as LibraryListTranslate;
  const tSubmissions = useTranslations(
    "library.submissions",
  ) as LibraryListTranslate;
  const tSaved = useTranslations("library.saved") as LibraryListTranslate;
  const submissionQuery = useLibraryItems("submissions");
  const problemQuery = useLibraryItems("problems");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [enrichResult, setEnrichResult] = useState<EnrichmentResult | null>(
    null,
  );
  const [filters, setFilters] = useState<LibraryProblemsFilterState>(
    EMPTY_LIBRARY_PROBLEMS_FILTERS,
  );
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [sortKey, setSortKey] = useState<LibraryProblemsSortKey>(
    DEFAULT_LIBRARY_PROBLEMS_SORT,
  );
  const [viewMode, setViewMode] = useState<LibraryProblemsViewMode>("list");

  const submissions = useMemo(
    () => (submissionQuery.data ?? initialSubmissions).filter(isSubmission),
    [initialSubmissions, submissionQuery.data],
  );
  const problems = useMemo(
    () => (problemQuery.data ?? initialProblems).filter(isProblem),
    [initialProblems, problemQuery.data],
  );

  useEffect(() => {
    const ids = submissions.map((item) => item.id);
    if (ids.length === 0) {
      return;
    }

    let cancelled = false;
    fetchSubmissionEnrichment(ids)
      .then((map) => {
        if (!cancelled) setEnrichResult({ map, error: false });
      })
      .catch(() => {
        if (!cancelled) setEnrichResult({ map: new Map(), error: true });
      });

    return () => {
      cancelled = true;
    };
    // depend on the id signature so we don't refetch on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissions.map((item) => item.id).join(",")]);

  const enrich = enrichResult?.map ?? EMPTY_ENRICHMENT;
  const enrichState: "loading" | "ready" | "error" =
    submissions.length === 0
      ? "ready"
      : enrichResult == null
        ? "loading"
        : enrichResult.error
          ? "error"
          : "ready";

  const mixed = useMemo<MixedLibraryProblemItem[]>(
    () => [
      ...submissions.map((item) => ({
        kind: "submission" as const,
        item,
        savedAt: item.saved_at,
      })),
      ...problems.map((item) => ({
        kind: "problem" as const,
        item,
        savedAt: item.saved_at,
      })),
    ],
    [problems, submissions],
  );

  const searchFiltered = useMemo(
    () =>
      mixed.filter((entry) => {
        if (entry.kind === "submission") {
          const item = entry.item;
          const fallbackTitle = tSubmissions("problemTitle", {
            id: item.problem_id.slice(0, 8),
          });
          return matchesLibrarySearch(searchTerm, [
            submissionTitle(item, fallbackTitle),
            item.problem_id,
            item.question_no != null ? `${item.question_no}` : null,
            item.question_no != null ? `${item.question_no}번` : null,
            enrich.get(item.id)?.summary,
            t("typeSubmission"),
            ...item.tags,
          ]);
        }

        const item = entry.item;
        return matchesLibrarySearch(searchTerm, [
          item.title,
          item.id,
          item.question_no != null ? `${item.question_no}` : null,
          item.question_no != null ? `${item.question_no}번` : null,
          item.availabilityReason,
          t("typeProblem"),
          ...item.tags,
        ]);
      }),
    [enrich, mixed, searchTerm, t, tSubmissions],
  );

  // 패싯 카운트는 검색 적용 후 · 패널 필터 적용 전 집합 기준.
  const facetCounts = useMemo(
    () => countLibraryProblemsFacets(searchFiltered, enrich),
    [enrich, searchFiltered],
  );
  const filtered = useMemo(
    () => applyLibraryProblemsFilters(searchFiltered, filters, enrich),
    [filters, enrich, searchFiltered],
  );
  const sorted = useMemo(
    () => sortLibraryProblems(filtered, sortKey, enrich),
    [enrich, filtered, sortKey],
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / LIBRARY_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = sorted.slice(
    (safePage - 1) * LIBRARY_PAGE_SIZE,
    safePage * LIBRARY_PAGE_SIZE,
  );
  const searching = searchTerm.trim().length > 0;
  const filtering = !isLibraryProblemsFilterStateEmpty(filters);
  const activeFilterCount = countActiveLibraryProblemsFilters(filters);
  const isLoading =
    submissionQuery.isLoading &&
    problemQuery.isLoading &&
    mixed.length === 0 &&
    initialSubmissions.length === 0 &&
    initialProblems.length === 0;
  const queryError = submissionQuery.error ?? problemQuery.error;
  // 분석 상태/점수 필터는 enrichment 도착 전에 0건 오탐이 나므로 로딩을 보여준다.
  const enrichSensitiveFilter =
    filters.statuses.size > 0 || filters.scoreRange != null;
  const showEnrichLoading =
    enrichState === "loading" &&
    enrichSensitiveFilter &&
    pageItems.length === 0;

  if (isLoading) {
    return <Spin data-testid="library-problems-loading" />;
  }

  const updateFilters = (partial: Partial<LibraryProblemsFilterState>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
    setPage(1);
  };

  const resetFilters = () => {
    setFilters(EMPTY_LIBRARY_PROBLEMS_FILTERS);
    setPage(1);
  };

  if (queryError) {
    return (
      <Alert
        type="error"
        title={t("loadError")}
        description={
          queryError instanceof Error ? queryError.message : undefined
        }
      />
    );
  }

  const filterPanel = (showHeader: boolean) => (
    <LibraryProblemsFilterPanel
      activeCount={activeFilterCount}
      counts={facetCounts}
      showHeader={showHeader}
      state={filters}
      onChange={updateFilters}
      onReset={resetFilters}
    />
  );

  return (
    <div
      data-testid="library-problems-list"
      className="flex min-h-0 w-full flex-1 flex-col gap-4"
    >
      <div className="flex min-h-0 w-full flex-1 items-start gap-6">
        <div
          data-testid="library-problems-results-column"
          className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 self-stretch"
        >
          <LibraryProblemsToolbar
            activeFilterCount={activeFilterCount}
            searchTerm={searchTerm}
            showControls={mixed.length > 0}
            sortKey={sortKey}
            viewMode={viewMode}
            onOpenFilters={() => setFilterDrawerOpen(true)}
            onSearchChange={(value) => {
              setSearchTerm(value);
              setPage(1);
            }}
            onSortChange={(key) => {
              setSortKey(key);
              setPage(1);
            }}
            onViewModeChange={setViewMode}
          />

          {pageItems.length === 0 ? (
            showEnrichLoading ? (
              <div
                data-testid="library-problems-enrich-loading"
                className="flex flex-1 items-center justify-center"
              >
                <Spin />
              </div>
            ) : (
              <div
                data-testid="library-problems-empty"
                className="flex flex-1 items-center justify-center"
              >
                <Empty
                  description={
                    searching
                      ? t("emptySearch")
                      : filtering
                        ? t("emptyFiltered")
                        : t("emptyNoItems")
                  }
                >
                  {searching ? (
                    <Button
                      onClick={() => {
                        setSearchTerm("");
                        resetFilters();
                      }}
                    >
                      {t("resetSearch")}
                    </Button>
                  ) : filtering ? (
                    <Button onClick={resetFilters}>
                      {tSaved("resetFilter")}
                    </Button>
                  ) : (
                    <Link href={APP_ROUTES.practiceProblems as never}>
                      {tSubmissions("goToPractice")}
                    </Link>
                  )}
                </Empty>
              </div>
            )
          ) : (
            <>
              {viewMode === "card" ? (
                <div
                  data-testid="library-problems-card-grid"
                  className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
                >
                  {pageItems.map((entry) => (
                    <div
                      key={entry.item.item_id}
                      className="h-full"
                      data-testid="library-problems-mixed-row"
                      data-library-kind={entry.kind}
                    >
                      <LibraryProblemsItemCard
                        entry={entry}
                        meta={
                          entry.kind === "submission"
                            ? enrich.get(entry.item.id)
                            : undefined
                        }
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  data-testid="library-item-list"
                  className="flex w-full flex-col"
                >
                  {pageItems.map((entry) => (
                    <div
                      key={entry.item.item_id}
                      data-testid="library-problems-mixed-row"
                      data-library-kind={entry.kind}
                    >
                      {entry.kind === "submission" ? (
                        <LibraryProblemsSubmissionRow
                          item={entry.item}
                          meta={enrich.get(entry.item.id)}
                        />
                      ) : (
                        <LibraryProblemsProblemRow item={entry.item} />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <LibraryPagination
                current={safePage}
                total={sorted.length}
                onChange={(nextPage) => setPage(nextPage)}
              />
            </>
          )}
        </div>

        {mixed.length > 0 ? (
          <aside
            data-testid="library-problems-filter-panel-desktop"
            className="hidden w-[22rem] shrink-0 self-start lg:sticky lg:top-6 lg:block lg:max-h-[calc(100vh-3rem)] lg:overflow-x-hidden lg:overflow-y-auto"
          >
            {filterPanel(true)}
          </aside>
        ) : null}
      </div>

      <AppDrawer
        open={filterDrawerOpen}
        placement="right"
        title={t("filterDrawerTitle")}
        onClose={() => setFilterDrawerOpen(false)}
        footer={
          <div className="flex items-center gap-2">
            <Button disabled={activeFilterCount === 0} onClick={resetFilters}>
              {tSaved("resetFilter")}
            </Button>
            <Button
              block
              data-testid="library-problems-filter-drawer-apply"
              type="primary"
              onClick={() => setFilterDrawerOpen(false)}
            >
              {t("showResults", { count: sorted.length })}
            </Button>
          </div>
        }
      >
        {filterPanel(false)}
      </AppDrawer>
    </div>
  );
}
