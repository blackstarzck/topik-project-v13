"use client";

import { Alert, Button, Empty, Input, Spin, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  LIBRARY_PAGE_SIZE,
  LibraryPagination,
} from "@/components/library/LibraryPagination";
import {
  clampTitle,
  fetchSubmissionEnrichment,
  statusBadge,
  type SubmissionEnrichment,
} from "@/components/library/library-enrich-data";
import { useLibraryItems } from "@/lib/library/queries";
import type {
  LibraryItemView,
  LibraryProblemView,
  LibrarySubmissionView,
} from "@/lib/library/types";
import { APP_ROUTES } from "@/lib/routes";
import { writingFeedbackHref, writingProblemHref } from "@/lib/writing/routes";

import { LibraryItemRow } from "./LibraryItemRow";
import { LibraryProblemsFilterCards } from "./LibraryProblemsFilterCards";
import {
  applyLibraryProblemsFilters,
  countLibraryProblemsFilters,
  type LibraryProblemsFilterKey,
} from "./library-problems-filters";
import { matchesLibrarySearch } from "./library-tab-url";

const { Paragraph, Text } = Typography;

type LibraryListTranslate = (
  key: string,
  values?: Record<string, string | number | null | undefined>,
) => string;

type Props = {
  initialSubmissions: LibrarySubmissionView[];
  initialProblems: LibraryProblemView[];
};

type MixedLibraryProblemItem =
  | {
      kind: "submission";
      item: LibrarySubmissionView;
      savedAt: string;
    }
  | {
      kind: "problem";
      item: LibraryProblemView;
      savedAt: string;
    };

function isSubmission(item: LibraryItemView): item is LibrarySubmissionView {
  return item.kind === "submission";
}

function isProblem(item: LibraryItemView): item is LibraryProblemView {
  return item.kind === "problem";
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

function compareSavedDesc(
  a: MixedLibraryProblemItem,
  b: MixedLibraryProblemItem,
) {
  return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
}

function isAnalysisPendingStatus(
  status: SubmissionEnrichment["feedbackStatus"],
): boolean {
  return status === "pending" || status === "analyzing";
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
  const [enrich, setEnrich] = useState<Map<string, SubmissionEnrichment>>(
    new Map(),
  );
  const [checkedFilters, setCheckedFilters] = useState<
    ReadonlySet<LibraryProblemsFilterKey>
  >(new Set());

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
  }, [submissions.map((item) => item.id).join(",")]);

  const mixed = useMemo<MixedLibraryProblemItem[]>(
    () =>
      [
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
      ].sort(compareSavedDesc),
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

  // 카드 개수는 검색 적용 후 · 카드 필터 적용 전 집합 기준(패싯 카운트).
  const filterCounts = useMemo(
    () => countLibraryProblemsFilters(searchFiltered, enrich),
    [enrich, searchFiltered],
  );
  const filtered = useMemo(
    () => applyLibraryProblemsFilters(searchFiltered, checkedFilters, enrich),
    [checkedFilters, enrich, searchFiltered],
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / LIBRARY_PAGE_SIZE),
  );
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (safePage - 1) * LIBRARY_PAGE_SIZE,
    safePage * LIBRARY_PAGE_SIZE,
  );
  const searching = searchTerm.trim().length > 0;
  const filtering = checkedFilters.size > 0;
  const isLoading =
    submissionQuery.isLoading &&
    problemQuery.isLoading &&
    mixed.length === 0 &&
    initialSubmissions.length === 0 &&
    initialProblems.length === 0;
  const queryError = submissionQuery.error ?? problemQuery.error;

  if (isLoading) {
    return <Spin data-testid="library-problems-loading" />;
  }

  const toggleFilter = (key: LibraryProblemsFilterKey) => {
    setCheckedFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
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

  return (
    <div
      data-testid="library-problems-list"
      className="flex min-h-0 w-full flex-1 flex-col gap-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Input.Search
          allowClear
          aria-label={t("searchAriaLabel")}
          className="w-full sm:max-w-sm"
          data-testid="library-problems-search"
          maxLength={40}
          placeholder={t("searchPlaceholder")}
          value={searchTerm}
          onChange={(event) => {
            setSearchTerm(event.target.value);
            setPage(1);
          }}
          onSearch={(value) => {
            setSearchTerm(value);
            setPage(1);
          }}
        />
        <Text data-testid="library-problems-result-count" type="secondary">
          {tSubmissions("resultCount", { count: filtered.length })}
        </Text>
      </div>

      {mixed.length > 0 ? (
        <LibraryProblemsFilterCards
          checked={checkedFilters}
          counts={filterCounts}
          onToggle={toggleFilter}
        />
      ) : null}

      {pageItems.length === 0 ? (
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
                  setCheckedFilters(new Set());
                  setPage(1);
                }}
              >
                {t("resetSearch")}
              </Button>
            ) : filtering ? (
              <Button
                onClick={() => {
                  setCheckedFilters(new Set());
                  setPage(1);
                }}
              >
                {tSaved("resetFilter")}
              </Button>
            ) : (
              <Link href={APP_ROUTES.practiceProblems as never}>
                {tSubmissions("goToPractice")}
              </Link>
            )}
          </Empty>
        </div>
      ) : (
        <>
          <div data-testid="library-item-list" className="flex w-full flex-col">
            {pageItems.map((entry) => (
              <div
                key={entry.item.item_id}
                data-testid="library-problems-mixed-row"
                data-library-kind={entry.kind}
              >
                {entry.kind === "submission"
                  ? renderSubmissionRow(
                      entry.item,
                      enrich.get(entry.item.id),
                      t,
                      tSubmissions,
                    )
                  : renderProblemRow(entry.item, t, tSaved)}
              </div>
            ))}
          </div>

          <LibraryPagination
            current={safePage}
            total={filtered.length}
            onChange={(nextPage) => setPage(nextPage)}
          />
        </>
      )}
    </div>
  );
}

function renderSubmissionRow(
  item: LibrarySubmissionView,
  meta: SubmissionEnrichment | undefined,
  t: LibraryListTranslate,
  tSubmissions: LibraryListTranslate,
) {
  const feedbackStatus = meta?.feedbackStatus ?? "pending";
  const analysisPending = isAnalysisPendingStatus(feedbackStatus);
  const badge = statusBadge(feedbackStatus);
  const fallbackTitle = tSubmissions("problemTitle", {
    id: item.problem_id.slice(0, 8),
  });
  const title = submissionTitle(item, fallbackTitle);

  return (
    <LibraryItemRow itemId={item.item_id} tab="submissions" tags={item.tags}>
      <div className="flex w-full flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Tag data-testid="library-problems-type-badge">
            {t("typeSubmission")}
          </Tag>
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
          <Tag color={badge.color}>{tSubmissions(badge.labelKey)}</Tag>
          {meta?.scoreTotal != null ? (
            <Tag>
              {meta.scoreMax != null
                ? tSubmissions("scoreWithMax", {
                    total: meta.scoreTotal,
                    max: meta.scoreMax,
                  })
                : tSubmissions("scoreNoMax", { total: meta.scoreTotal })}
            </Tag>
          ) : null}
        </div>
        {meta?.summary ? (
          <Paragraph className="mb-0" ellipsis={{ rows: 2 }} type="secondary">
            {meta.summary}
          </Paragraph>
        ) : analysisPending ? (
          <Paragraph className="mb-0" type="secondary">
            {tSubmissions("analysisPendingHint")}
          </Paragraph>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Tag>{tSubmissions("charCount", { count: item.char_count })}</Tag>
          <Text type="secondary">{formatDate(item.submitted_at)}</Text>
        </div>
      </div>
    </LibraryItemRow>
  );
}

function renderProblemRow(
  item: LibraryProblemView,
  t: LibraryListTranslate,
  tSaved: LibraryListTranslate,
) {
  const unavailable = item.availabilityStatus !== "available";

  return (
    <LibraryItemRow
      className={unavailable ? "opacity-40" : undefined}
      itemId={item.item_id}
      tab="problems"
      tags={item.tags}
      trailingActions={[renderRetryAction(item, tSaved)]}
    >
      <div className="flex w-full min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Tag data-testid="library-problems-type-badge">
            {t("typeProblem")}
          </Tag>
          <Text strong>
            {item.title ?? tSaved("unavailablePlaceholderTitle")}
          </Text>
          {unavailable ? (
            <Tag data-testid="library-problem-unavailable-badge">
              {item.availabilityStatus === "soft_unavailable"
                ? tSaved("providedEnded")
                : tSaved("unavailable")}
            </Tag>
          ) : null}
        </div>
        {unavailable ? (
          <Text
            data-testid="library-problem-unavailable-reason"
            type="secondary"
          >
            {item.availabilityReason ?? tSaved("unavailableDefaultReason")}
          </Text>
        ) : null}
      </div>
    </LibraryItemRow>
  );
}

function renderRetryAction(
  item: LibraryProblemView,
  tSaved: LibraryListTranslate,
) {
  const canRetry = item.canRetry && item.question_no !== null;
  if (!canRetry) {
    return (
      <Button
        key="retry"
        type="primary"
        size="small"
        disabled
        aria-label={tSaved("retryUnavailable")}
        title={tSaved("retryUnavailable")}
      >
        {tSaved("retry")}
      </Button>
    );
  }

  return (
    <Link
      key="retry"
      href={
        writingProblemHref({
          questionNo: item.question_no,
          problemId: item.id,
        }) as never
      }
    >
      <Button type="primary" size="small">
        {tSaved("retry")}
      </Button>
    </Link>
  );
}
