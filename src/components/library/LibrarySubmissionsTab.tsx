"use client";

import {
  Alert,
  Button,
  DatePicker,
  Empty,
  Select,
  Spin,
  Tag,
  Typography,
} from "antd";
import type { Dayjs } from "dayjs";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useLibraryItems } from "@/lib/library/queries";
import type {
  LibraryItemView,
  LibrarySubmissionView,
} from "@/lib/library/types";
import { writingFeedbackHref } from "@/lib/writing/routes";

import { LibraryItemRow } from "./LibraryItemRow";
import { LIBRARY_PAGE_SIZE, LibraryPagination } from "./LibraryPagination";
import {
  clampTitle,
  fetchSubmissionEnrichment,
  statusBadge,
  type SubmissionEnrichment,
} from "./library-enrich-data";
import { matchesLibrarySearch } from "./library-tab-url";
import type { ExportSelectionItem } from "./PdfExportModal";

const { Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

type StatusFilter = "all" | "complete" | "analyzing" | "pending" | "failed";

type Props = {
  initialItems: LibrarySubmissionView[];
  searchTerm?: string;
  onResetSearch?: () => void;
  /** Clears row-level selection in the parent actions bar. */
  onSelectionChange?: (items: ExportSelectionItem[]) => void;
};

const EMPTY_EXPORT_SELECTION: ExportSelectionItem[] = [];

function isSubmission(item: LibraryItemView): item is LibrarySubmissionView {
  return item.kind === "submission";
}

function formatDate(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

function submissionTitle(
  item: LibrarySubmissionView,
  fallbackTitle: string,
): string {
  const title = item.problem_title ?? fallbackTitle;
  return item.question_no != null
    ? `No. ${item.question_no} - ${title}`
    : title;
}

function isAnalysisPendingStatus(
  status: SubmissionEnrichment["feedbackStatus"],
): boolean {
  return status === "pending" || status === "analyzing";
}

function isAnalysisFailedStatus(
  status: SubmissionEnrichment["feedbackStatus"],
): boolean {
  return status === "failed";
}

/**
 * F-01 저장 답안 목록 (region 3) + 검색/필터 (region 1) + 페이지 이동 (region 5).
 *
 *  - Row content: clamped title (<=32) / score / 2-line feedback preview /
 *    status badge.
 *  - Search count shown at top; status + period filters combine with search.
 *  - Pagination: 10/page, <=5 page buttons, total at bottom, first/last
 *    disabled at the ends (antd Pagination handles disabled ends + responsive
 *    prev/next).
 *  - Row-level selection/PDF/tag-edit controls are intentionally not rendered;
 *    parent actions stay empty until a selection surface returns.
 */
export function LibrarySubmissionsTab({
  initialItems,
  searchTerm = "",
  onResetSearch,
  onSelectionChange,
}: Props) {
  const t = useTranslations("library.submissions");
  const query = useLibraryItems("submissions");
  // Memoize so the reference is stable across renders. Recomputing `.filter`
  // inline produced a NEW array every render → the `filtered` useMemo (which
  // depends on `allItems`) and the parent-clear useEffect re-ran every render,
  // creating a setState loop ("Maximum update depth
  // exceeded"). It was masked while the dev-smoke could not hydrate (127.0.0.1
  // cross-origin block); see runs/2026/06/04/20260604-2130-…ledger.
  const allItems = useMemo<LibrarySubmissionView[]>(
    () => (query.data ?? initialItems).filter(isSubmission),
    [query.data, initialItems],
  );

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [page, setPage] = useState(1);
  const [enrich, setEnrich] = useState<Map<string, SubmissionEnrichment>>(
    new Map(),
  );

  // Enrich the listed submissions with score/status once we have ids.
  // 빈 목록일 때는 동기 setState를 하지 않는다. enrich 조회는 항상
  // 현재 allItems의 id로만 이뤄지므로(아래 lookup 참고), 남아있는 엔트리는
  // 무해하고 다음 fetch 결과로 교체된다.
  useEffect(() => {
    const ids = allItems.map((i) => i.id);
    if (ids.length === 0) return;
    let cancelled = false;
    fetchSubmissionEnrichment(ids)
      .then((map) => {
        if (!cancelled) setEnrich(map);
      })
      .catch(() => {
        if (!cancelled) setEnrich(new Map());
      });
    return () => {
      cancelled = true;
    };
    // depend on the id signature so we don't refetch on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allItems.map((i) => i.id).join(",")]);

  const filtered = useMemo(() => {
    return allItems.filter((i) => {
      const fallbackTitle = t("problemTitle", { id: i.problem_id.slice(0, 8) });
      if (
        !matchesLibrarySearch(searchTerm, [
          submissionTitle(i, fallbackTitle),
          i.problem_id,
          enrich.get(i.id)?.summary,
          ...i.tags,
        ])
      ) {
        return false;
      }
      if (statusFilter !== "all") {
        const status = enrich.get(i.id)?.feedbackStatus;
        if (status !== statusFilter) return false;
      }
      if (range && (range[0] || range[1])) {
        const submittedAt = new Date(i.submitted_at).getTime();
        if (range[0] && submittedAt < range[0].startOf("day").valueOf()) {
          return false;
        }
        if (range[1] && submittedAt > range[1].endOf("day").valueOf()) {
          return false;
        }
      }
      return true;
    });
  }, [allItems, searchTerm, statusFilter, range, enrich, t]);

  // Clamp the page when the filtered set shrinks.
  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / LIBRARY_PAGE_SIZE),
  );
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (safePage - 1) * LIBRARY_PAGE_SIZE,
    safePage * LIBRARY_PAGE_SIZE,
  );

  useEffect(() => {
    onSelectionChange?.(EMPTY_EXPORT_SELECTION);
  }, [onSelectionChange]);

  if (
    query.isLoading &&
    (query.data ?? []).length === 0 &&
    initialItems.length === 0
  ) {
    return <Spin />;
  }
  if (query.error) {
    return (
      <Alert
        type="error"
        title={t("loadError")}
        description={
          query.error instanceof Error ? query.error.message : undefined
        }
      />
    );
  }

  const searching =
    searchTerm.trim().length > 0 ||
    statusFilter !== "all" ||
    Boolean(range && (range[0] || range[1]));

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-4">
      {/* Region 1: 필터 (유형·상태·기간 동시) + 결과 수 상단 표시 */}
      <div className="flex flex-wrap items-center gap-2">
        <Select<StatusFilter>
          data-testid="library-status-filter"
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
          className="min-w-36"
          aria-label={t("statusFilterAriaLabel")}
          options={[
            { value: "all", label: t("statusAll") },
            { value: "complete", label: t("statusComplete") },
            { value: "analyzing", label: t("statusAnalyzing") },
            { value: "pending", label: t("statusPending") },
            { value: "failed", label: t("statusFailed") },
          ]}
        />
        <span data-testid="library-period-filter" className="w-full sm:w-auto">
          <RangePicker
            className="w-full"
            value={range ?? undefined}
            onChange={(v) => {
              setRange(v as [Dayjs | null, Dayjs | null] | null);
              setPage(1);
            }}
            aria-label={t("periodFilterAriaLabel")}
          />
        </span>
        <Text data-testid="library-result-count" type="secondary">
          {t("resultCount", { count: filtered.length })}
        </Text>
      </div>

      {pageItems.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <Empty description={searching ? t("emptySearch") : t("emptyNoItems")}>
            {searching ? (
              <Button
                onClick={() => {
                  setStatusFilter("all");
                  setRange(null);
                  onResetSearch?.();
                }}
              >
                {t("resetFilter")}
              </Button>
            ) : (
              <Link href="/practice/problems">{t("goToPractice")}</Link>
            )}
          </Empty>
        </div>
      ) : (
        <>
          <div data-testid="library-item-list" className="flex w-full flex-col">
            {pageItems.map((item) => {
              const meta = enrich.get(item.id);
              const feedbackStatus = meta?.feedbackStatus ?? "pending";
              const analysisPending = isAnalysisPendingStatus(feedbackStatus);
              const analysisFailed = isAnalysisFailedStatus(feedbackStatus);
              const badge = statusBadge(feedbackStatus);
              const fallbackTitle = t("problemTitle", {
                id: item.problem_id.slice(0, 8),
              });
              const title = submissionTitle(item, fallbackTitle);
              return (
                <LibraryItemRow
                  key={item.item_id}
                  itemId={item.item_id}
                  tab="submissions"
                  tags={item.tags}
                >
                  <div className="flex w-full flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {analysisPending ? (
                        <Text strong>{clampTitle(title)}</Text>
                      ) : (
                        <Link
                          href={
                            writingFeedbackHref({
                              questionNo: item.question_no,
                              submissionId: item.id,
                            }) as never
                          }
                        >
                          <Text strong>{clampTitle(title)}</Text>
                        </Link>
                      )}
                      <Tag color={badge.color}>
                        {t(badge.labelKey as Parameters<typeof t>[0])}
                      </Tag>
                      {meta?.scoreTotal != null ? (
                        <Tag>
                          {meta.scoreMax != null
                            ? t("scoreWithMax", {
                                total: meta.scoreTotal,
                                max: meta.scoreMax,
                              })
                            : t("scoreNoMax", { total: meta.scoreTotal })}
                        </Tag>
                      ) : null}
                    </div>
                    {meta?.summary ? (
                      <Paragraph
                        className="mb-0"
                        ellipsis={{ rows: 2 }}
                        type="secondary"
                      >
                        {meta.summary}
                      </Paragraph>
                    ) : analysisPending ? (
                      <Paragraph className="mb-0" type="secondary">
                        {t("analysisPendingHint")}
                      </Paragraph>
                    ) : analysisFailed ? (
                      <Paragraph className="mb-0" type="secondary">
                        {t("analysisFailedHint")}
                      </Paragraph>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                      <Tag>{t("charCount", { count: item.char_count })}</Tag>
                      <Text type="secondary">
                        {formatDate(item.submitted_at)}
                      </Text>
                    </div>
                  </div>
                </LibraryItemRow>
              );
            })}
          </div>

          {/* Region 5: 페이지 이동 (10/page, <=5 버튼, 총 건수 하단) */}
          <LibraryPagination
            current={safePage}
            total={filtered.length}
            onChange={(p) => setPage(p)}
          />
        </>
      )}
    </div>
  );
}
