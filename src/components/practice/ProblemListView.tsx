"use client";

import { Alert, Button, Empty, Spin, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { AppCard } from "@/components/shared/AppCard";
import { useLocationHash } from "@/hooks/useLocationHash";
import { useLibraryItems } from "@/lib/library/queries";
import {
  isValidQuestionNo,
  type ProblemFilter,
  type ProblemSort,
  type QuestionNo,
  type SolveStatusFilter,
} from "@/lib/practice/types";
import { useSingleFlightAction } from "@/lib/request-control/useSingleFlightAction";
import { FilterChips } from "./FilterChips";
import { ProblemListControls } from "./ProblemListControls";
import { ProblemListPagination } from "./ProblemListPagination";
import { ProblemTable } from "./ProblemTable";
import { ProblemTypeTabs } from "./ProblemTypeTabs";
import { RetryModal } from "./RetryModal";
import { useUserProblemsRpc, type UserProblemRow } from "./problem-list-data";

const { Text } = Typography;

const PAGE_SIZE = 10;
const VALID_SORTS: readonly ProblemSort[] = [
  "newest",
  "oldest",
  "difficulty-asc",
  "difficulty-desc",
];
const problemListCardClassNames = {
  body: "problem-list-card__body",
};

function parseQuestion(raw: string | null): QuestionNo | null {
  if (!raw) return null;
  const num = Number(raw);
  return isValidQuestionNo(num) ? num : null;
}

function parseDifficulty(raw: string | null): number | null {
  if (!raw) return null;
  const num = Number(raw);
  if (Number.isInteger(num) && num >= 1 && num <= 5) return num;
  return null;
}

function parseSort(raw: string | null): ProblemSort {
  if (raw && (VALID_SORTS as readonly string[]).includes(raw)) {
    return raw as ProblemSort;
  }
  return "newest";
}

function parseSolveStatus(raw: string | null): SolveStatusFilter | undefined {
  if (!raw) return undefined;
  if (raw === "unsolved" || raw === "inProgress" || raw === "solved")
    return raw;
  return undefined;
}

type ProblemListUrlState = {
  filter: ProblemFilter;
  sort: ProblemSort;
  page: number;
};

function parseUrlState(params: URLSearchParams): ProblemListUrlState {
  const p = Number(params.get("page") ?? "1");
  return {
    filter: {
      questionNo: parseQuestion(params.get("type")),
      difficulty: parseDifficulty(params.get("difficulty")),
      search: params.get("q") ?? "",
      topikLevel: null,
      recommended: params.get("recommended") === "1",
      reviewSetId: params.get("reviewSet"),
      solveStatus: parseSolveStatus(params.get("solve")),
    },
    sort: parseSort(params.get("sort")),
    page: Number.isInteger(p) && p > 0 ? p : 1,
  };
}

type Props = {
  /** Server-fetched user id (also resolved by the RPC via auth.uid()). */
  userId: string;
};

export function ProblemListView({ userId }: Props) {
  const t = useTranslations("practice.problems");
  const router = useRouter();
  const params = useSearchParams();
  const locationHash = useLocationHash();
  const [retryTarget, setRetryTarget] = useState<UserProblemRow | null>(null);
  const paramsKey = params.toString();
  const returnTo = `/practice/problems${paramsKey ? `?${paramsKey}` : ""}${locationHash}`;
  const urlState = useMemo(
    () => parseUrlState(new URLSearchParams(paramsKey)),
    [paramsKey],
  );
  const [viewState, setViewState] = useState(urlState);
  const [, startTransition] = useTransition();
  const { filter, sort, page } = viewState;

  useEffect(() => {
    startTransition(() => {
      setViewState(urlState);
    });
  }, [startTransition, urlState]);

  function pushParams(next: URLSearchParams) {
    router.replace(
      `/practice/problems${next.size ? `?${next.toString()}` : ""}` as never,
    );
  }

  function buildParams(
    nextFilter: ProblemFilter,
    nextSort: ProblemSort,
    nextPage: number,
  ) {
    const sp = new URLSearchParams();
    if (nextFilter.questionNo != null)
      sp.set("type", String(nextFilter.questionNo));
    if (nextFilter.difficulty != null)
      sp.set("difficulty", String(nextFilter.difficulty));
    if (nextFilter.search && nextFilter.search.length > 0)
      sp.set("q", nextFilter.search);
    if (nextFilter.recommended === true) sp.set("recommended", "1");
    if (nextFilter.reviewSetId) sp.set("reviewSet", nextFilter.reviewSetId);
    if (nextFilter.solveStatus && nextFilter.solveStatus !== "all")
      sp.set("solve", nextFilter.solveStatus);
    if (nextSort !== "newest") sp.set("sort", nextSort);
    sp.set("page", String(nextPage));
    return sp;
  }

  function commitFilter(next: ProblemFilter) {
    const nextState = { filter: next, sort, page: 1 };
    const sp = buildParams(next, sort, 1);
    setViewState(nextState);
    startTransition(() => {
      pushParams(sp);
    });
  }

  function commitSort(nextSort: ProblemSort) {
    const nextState = { filter, sort: nextSort, page: 1 };
    const sp = buildParams(filter, nextSort, 1);
    setViewState(nextState);
    startTransition(() => {
      pushParams(sp);
    });
  }

  function commitPage(nextPage: number) {
    const nextState = { filter, sort, page: nextPage };
    const sp = buildParams(filter, sort, nextPage);
    setViewState(nextState);
    startTransition(() => {
      pushParams(sp);
    });
  }

  function resetAll() {
    const nextState = parseUrlState(new URLSearchParams());
    setViewState(nextState);
    startTransition(() => {
      pushParams(new URLSearchParams());
    });
  }

  // C-02 §5 — list_user_problems RPC: 필터 적용 후 정확한 total_count + 페이지.
  // 추천만(recommended) 필터는 RPC가 직접 지원하지 않아 클라이언트에서 제외하지
  // 않는다(별도 추천 화면 C-01에서 다룸). 여기서는 RPC가 지원하는 필터만 적용.
  const rpcParams = useMemo(
    // userId is included for per-user react-query cache isolation; the RPC
    // itself scopes by auth.uid().
    () => ({ filter, sort, page, pageSize: PAGE_SIZE, userId }),
    [filter, sort, page, userId],
  );
  const list = useUserProblemsRpc(rpcParams);
  const savedProblems = useLibraryItems("problems");
  const retry = useSingleFlightAction(() => list.refetch());

  const total = list.data?.total ?? 0;
  const rows = list.data?.rows ?? [];
  const savedProblemIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of savedProblems.data ?? []) {
      if (item.kind === "problem") ids.add(item.id);
    }
    return ids;
  }, [savedProblems.data]);
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  const totalLabel =
    total > 0 ? (
      // §5 — 총 건수는 목록 상단/하단에 표시.
      <Text type="secondary">
        {t("totalRange", { total, start: rangeStart, end: rangeEnd })}
      </Text>
    ) : null;

  return (
    <div className="grid gap-6">
      <PageHeader title={t("heading")} subtitle={t("subtitle")} />

      <ProblemTypeTabs
        includeAll
        active={filter.questionNo ?? null}
        onChange={(next) => commitFilter({ ...filter, questionNo: next })}
      />

      <AppCard className="problem-filter-card">
        <div className="grid gap-4">
          <ProblemListControls
            filter={filter}
            sort={sort}
            onFilterChange={commitFilter}
            onSortChange={commitSort}
          />

          <FilterChips
            filter={filter}
            sort={sort}
            onFilterChange={commitFilter}
            onSortChange={commitSort}
            onReset={resetAll}
          />
        </div>
      </AppCard>

      {list.isLoading ? (
        <Spin>
          <div className="min-h-20" />
        </Spin>
      ) : list.error ? (
        // §예외 — 로딩 실패.
        <Alert
          type="error"
          showIcon
          title={t("loadErrorTitle")}
          description={list.error instanceof Error ? list.error.message : ""}
          action={
            <Button
              size="small"
              loading={retry.pending}
              disabled={retry.pending}
              onClick={() => void retry.run()}
            >
              {t("retry")}
            </Button>
          }
        />
      ) : rows.length > 0 ? (
        <>
          <AppCard
            className="problem-list-card overflow-hidden"
            classNames={problemListCardClassNames}
          >
            <ProblemTable
              rows={rows}
              userId={userId}
              returnTo={returnTo}
              savedProblemIds={savedProblemIds}
              savedProblemsLoading={savedProblems.isLoading}
              onRetryClick={setRetryTarget}
            />
          </AppCard>
          {/* §5 하단 총 건수 + 페이지 이동 */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {totalLabel}
            <ProblemListPagination
              current={page}
              total={total}
              pageSize={PAGE_SIZE}
              onChange={commitPage}
            />
          </div>
        </>
      ) : (
        // §2 예외 — 조합 결과 없음: 빈 결과 + 초기화 CTA.
        <Empty description={t("emptyDescription")}>
          <Button onClick={resetAll}>{t("resetFilters")}</Button>
        </Empty>
      )}

      {retryTarget ? (
        <RetryModal
          open
          onClose={() => setRetryTarget(null)}
          problemId={retryTarget.problemId}
          problemTitle={retryTarget.title}
          questionNo={retryTarget.questionNo}
          attemptCount={retryTarget.attemptCount}
          lastAttemptAt={retryTarget.lastAttemptAt}
          hasSubmission={retryTarget.solveState === "submitted"}
          hasAttempt={retryTarget.solveState === "attempted"}
          submissionId={retryTarget.latestSubmissionId ?? undefined}
          feedbackStatus={retryTarget.feedbackStatus}
          returnTo={returnTo}
        />
      ) : null}
    </div>
  );
}
