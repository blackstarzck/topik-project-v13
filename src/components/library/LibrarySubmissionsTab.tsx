"use client";

import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  Empty,
  List,
  Pagination,
  Select,
  Space,
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
import { writingProblemHref } from "@/lib/writing/routes";

import { ExportPdfButton } from "./ExportPdfButton";
import { LibraryItemRow } from "./LibraryItemRow";
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

const PAGE_SIZE = 10;

type StatusFilter = "all" | "complete" | "analyzing" | "pending" | "failed";

type Props = {
  initialItems: LibrarySubmissionView[];
  searchTerm?: string;
  onResetSearch?: () => void;
  /** Lifts the current (filtered) selection to the parent actions bar. */
  onSelectionChange?: (items: ExportSelectionItem[]) => void;
};

function isSubmission(item: LibraryItemView): item is LibrarySubmissionView {
  return item.kind === "submission";
}

function formatDate(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
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
 *  - Selection checkboxes feed the parent's 내보내기/복습 세트 actions.
 */
export function LibrarySubmissionsTab({
  initialItems,
  searchTerm = "",
  onResetSearch,
  onSelectionChange,
}: Props) {
  const t = useTranslations("library.submissions");
  const query = useLibraryItems("submissions");
  const allItems: LibrarySubmissionView[] = (query.data ?? initialItems).filter(
    isSubmission,
  );

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
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
      if (
        !matchesLibrarySearch(searchTerm, [
          t("problemTitle", { id: i.problem_id.slice(0, 8) }),
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
        const t = new Date(i.submitted_at).getTime();
        if (range[0] && t < range[0].startOf("day").valueOf()) return false;
        if (range[1] && t > range[1].endOf("day").valueOf()) return false;
      }
      return true;
    });
  }, [allItems, searchTerm, statusFilter, range, enrich, t]);

  // Clamp the page when the filtered set shrinks.
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  // Lift selection (intersected with currently-filtered ids) to the parent.
  useEffect(() => {
    if (!onSelectionChange) return;
    const validIds = new Set(filtered.map((i) => i.item_id));
    const items: ExportSelectionItem[] = filtered
      .filter((i) => selected.has(i.item_id) && validIds.has(i.item_id))
      .map((i) => ({
        itemId: i.item_id,
        title: t("problemTitle", { id: i.problem_id.slice(0, 8) }),
      }));
    onSelectionChange(items);
  }, [selected, filtered, onSelectionChange, t]);

  function toggle(itemId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }

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
    <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
      {/* Region 1: 필터 (유형·상태·기간 동시) + 결과 수 상단 표시 */}
      <Space wrap>
        <Select<StatusFilter>
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
          style={{ minWidth: 140 }}
          aria-label={t("statusFilterAriaLabel")}
          options={[
            { value: "all", label: t("statusAll") },
            { value: "complete", label: t("statusComplete") },
            { value: "analyzing", label: t("statusAnalyzing") },
            { value: "pending", label: t("statusPending") },
            { value: "failed", label: t("statusFailed") },
          ]}
        />
        <RangePicker
          value={range ?? undefined}
          onChange={(v) => {
            setRange(v as [Dayjs | null, Dayjs | null] | null);
            setPage(1);
          }}
          aria-label={t("periodFilterAriaLabel")}
        />
        <Text type="secondary">{t("resultCount", { count: filtered.length })}</Text>
      </Space>

      {pageItems.length === 0 ? (
        <Empty
          description={searching ? t("emptySearch") : t("emptyNoItems")}
        >
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
      ) : (
        <>
          <List
            dataSource={pageItems}
            renderItem={(item) => {
              const meta = enrich.get(item.id);
              const badge = statusBadge(meta?.feedbackStatus ?? "pending");
              return (
                <LibraryItemRow
                  key={item.item_id}
                  itemId={item.item_id}
                  tab="submissions"
                  tags={item.tags}
                  trailingActions={[
                    <Checkbox
                      key="select"
                      checked={selected.has(item.item_id)}
                      onChange={(e) => toggle(item.item_id, e.target.checked)}
                      aria-label={t("selectForExportAriaLabel")}
                    />,
                    <ExportPdfButton
                      key="export"
                      sourceType="submission"
                      sourceId={item.id}
                    />,
                  ]}
                >
                  <Space orientation="vertical" size={2} style={{ width: "100%" }}>
                    <Space size="small" wrap>
                      <Link
                        href={
                          writingProblemHref({
                            questionNo: item.question_no,
                            problemId: item.problem_id,
                          }) as never
                        }
                      >
                        <Text strong>
                          {clampTitle(
                            t("problemTitle", {
                              id: item.problem_id.slice(0, 8),
                            }),
                          )}
                        </Text>
                      </Link>
                      <Tag color={badge.color}>
                        {t(badge.labelKey as Parameters<typeof t>[0])}
                      </Tag>
                      {meta?.scoreTotal != null ? (
                        <Tag color="geekblue">
                          {meta.scoreMax != null
                            ? t("scoreWithMax", {
                                total: meta.scoreTotal,
                                max: meta.scoreMax,
                              })
                            : t("scoreNoMax", { total: meta.scoreTotal })}
                        </Tag>
                      ) : null}
                    </Space>
                    {meta?.summary ? (
                      <Paragraph
                        style={{ marginBottom: 0 }}
                        ellipsis={{ rows: 2 }}
                        type="secondary"
                      >
                        {meta.summary}
                      </Paragraph>
                    ) : null}
                    <Space size="small" wrap>
                      <Tag>{t("charCount", { count: item.char_count })}</Tag>
                      <Text type="secondary">{formatDate(item.submitted_at)}</Text>
                    </Space>
                  </Space>
                </LibraryItemRow>
              );
            }}
          />

          {/* Region 5: 페이지 이동 (10/page, <=5 버튼, 총 건수 하단) */}
          <Space style={{ width: "100%", justifyContent: "center" }}>
            <Pagination
              current={safePage}
              pageSize={PAGE_SIZE}
              total={filtered.length}
              showSizeChanger={false}
              showTotal={(total) => t("totalCount", { count: total })}
              onChange={(p) => setPage(p)}
              responsive
            />
          </Space>
        </>
      )}
    </Space>
  );
}
