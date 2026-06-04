"use client";

import { Alert, Button, Empty, List, Space, Spin, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  isValidQuestionNo,
  type ProblemFilter,
  type ProblemSort,
  type QuestionNo,
  type SolveStatusFilter,
} from "@/lib/practice/types";
import { FilterChips } from "./FilterChips";
import { ProblemListControls } from "./ProblemListControls";
import { ProblemListPagination } from "./ProblemListPagination";
import { ProblemRow } from "./ProblemRow";
import { ProblemTypeTabs } from "./ProblemTypeTabs";
import { RetryModal } from "./RetryModal";
import {
  useUserProblemsRpc,
  type UserProblemRow,
} from "./problem-list-data";

const { Text } = Typography;

const PAGE_SIZE = 10;
const VALID_SORTS: readonly ProblemSort[] = [
  "newest",
  "oldest",
  "difficulty-asc",
  "difficulty-desc",
];

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
  if (raw === "unsolved" || raw === "inProgress" || raw === "solved") return raw;
  return undefined;
}

type Props = {
  /** Server-fetched user id (also resolved by the RPC via auth.uid()). */
  userId: string;
};

export function ProblemListView({ userId }: Props) {
  const t = useTranslations("practice.problems");
  const router = useRouter();
  const params = useSearchParams();
  const [retryTarget, setRetryTarget] = useState<UserProblemRow | null>(null);

  const filter = useMemo<ProblemFilter>(
    () => ({
      questionNo: parseQuestion(params.get("type")),
      difficulty: parseDifficulty(params.get("difficulty")),
      search: params.get("q") ?? "",
      topikLevel: null,
      recommended: params.get("recommended") === "1",
      solveStatus: parseSolveStatus(params.get("solve")),
    }),
    [params],
  );
  const sort = useMemo(() => parseSort(params.get("sort")), [params]);
  const page = useMemo(() => {
    const p = Number(params.get("page") ?? "1");
    return Number.isInteger(p) && p > 0 ? p : 1;
  }, [params]);

  function pushParams(next: URLSearchParams) {
    router.replace(
      `/practice/problems${next.size ? `?${next.toString()}` : ""}` as never,
    );
  }

  function commitFilter(next: ProblemFilter) {
    const sp = new URLSearchParams();
    if (next.questionNo != null) sp.set("type", String(next.questionNo));
    if (next.difficulty != null) sp.set("difficulty", String(next.difficulty));
    if (next.search && next.search.length > 0) sp.set("q", next.search);
    if (next.recommended === true) sp.set("recommended", "1");
    if (next.solveStatus && next.solveStatus !== "all")
      sp.set("solve", next.solveStatus);
    if (sort !== "newest") sp.set("sort", sort);
    sp.set("page", "1");
    pushParams(sp);
  }

  function commitSort(nextSort: ProblemSort) {
    const sp = new URLSearchParams(params.toString());
    if (nextSort === "newest") sp.delete("sort");
    else sp.set("sort", nextSort);
    sp.set("page", "1");
    pushParams(sp);
  }

  function commitPage(nextPage: number) {
    const sp = new URLSearchParams(params.toString());
    sp.set("page", String(nextPage));
    pushParams(sp);
  }

  function resetAll() {
    pushParams(new URLSearchParams());
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

  const total = list.data?.total ?? 0;
  const rows = list.data?.rows ?? [];
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
    <Space orientation="vertical" size="large" style={{ width: "100%" }}>
      <PageHeader title={t("heading")} />

      <ProblemTypeTabs
        active={filter.questionNo ?? null}
        onChange={(next) => commitFilter({ ...filter, questionNo: next })}
      />

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

      {/* §5 상단 총 건수 */}
      {totalLabel}

      {list.isLoading ? (
        <Spin>
          <div style={{ minHeight: 80 }} />
        </Spin>
      ) : list.error ? (
        // §예외 — 로딩 실패.
        <Alert
          type="error"
          showIcon
          message={t("loadErrorTitle")}
          description={list.error instanceof Error ? list.error.message : ""}
          action={
            <Button size="small" onClick={() => list.refetch()}>
              {t("retry")}
            </Button>
          }
        />
      ) : rows.length > 0 ? (
        <>
          <List
            dataSource={rows}
            renderItem={(row) => (
              <ProblemRow
                key={row.problemId}
                row={{
                  id: row.problemId,
                  domain: row.domain as never,
                  question_no: row.questionNo,
                  topik_level: row.topikLevel ?? 0,
                  difficulty: row.difficulty,
                  title: row.title,
                  publish_status: "published",
                  review_status: "approved",
                  tags: row.tags,
                  updated_at: row.createdAt,
                }}
                solveState={row.solveState}
                attemptCount={row.attemptCount}
                lastAttemptAt={row.lastAttemptAt}
                onRetryClick={() => setRetryTarget(row)}
              />
            )}
          />
          {/* §5 하단 총 건수 + 페이지 이동 */}
          {totalLabel}
          <ProblemListPagination
            current={page}
            total={total}
            pageSize={PAGE_SIZE}
            onChange={commitPage}
          />
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
        />
      ) : null}
    </Space>
  );
}
