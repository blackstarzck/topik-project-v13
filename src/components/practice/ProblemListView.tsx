"use client";

import { Alert, Empty, List, Space, Spin, Typography } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useUserProblemList } from "@/lib/practice/queries";
import {
  isValidQuestionNo,
  type ProblemFilter,
  type ProblemRowWithState,
  type ProblemSort,
  type QuestionNo,
  type SolveStatusFilter,
} from "@/lib/practice/types";
import { ProblemListControls } from "./ProblemListControls";
import { ProblemListPagination } from "./ProblemListPagination";
import { ProblemRow } from "./ProblemRow";
import { ProblemTypeTabs } from "./ProblemTypeTabs";
import { RetryModal } from "./RetryModal";

const { Title } = Typography;

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

type Props = {
  /** Server-fetched user id for solve-state join (Phase 7-D Task 12). */
  userId: string;
};

function parseSolveStatus(raw: string | null): SolveStatusFilter | undefined {
  if (!raw) return undefined;
  if (raw === "unsolved" || raw === "inProgress" || raw === "solved") return raw;
  return undefined;
}

export function ProblemListView({ userId }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [retryTarget, setRetryTarget] = useState<ProblemRowWithState | null>(
    null,
  );

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
    router.replace(`/practice/problems${next.size ? `?${next.toString()}` : ""}` as never);
  }

  function commitFilter(next: ProblemFilter) {
    const sp = new URLSearchParams();
    if (next.questionNo != null) sp.set("type", String(next.questionNo));
    if (next.difficulty != null) sp.set("difficulty", String(next.difficulty));
    if (next.search && next.search.length > 0) sp.set("q", next.search);
    if (next.recommended === true) sp.set("recommended", "1");
    if (next.solveStatus && next.solveStatus !== "all") sp.set("solve", next.solveStatus);
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

  const list = useUserProblemList(
    {
      filter,
      sort,
      page,
      pageSize: PAGE_SIZE,
    },
    userId,
  );

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Title level={3} style={{ marginBottom: 0 }}>
        문제 목록
      </Title>

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

      {list.isLoading ? (
        <Spin />
      ) : list.error ? (
        <Alert
          type="error"
          message="문제 목록을 불러오지 못했어요"
          description={list.error instanceof Error ? list.error.message : ""}
        />
      ) : list.data && list.data.rows.length > 0 ? (
        <>
          <List
            dataSource={list.data.rows}
            renderItem={(row) => (
              <ProblemRow
                key={row.id}
                row={row}
                solveState={row.solveState}
                onRetryClick={() => setRetryTarget(row)}
              />
            )}
          />
          <ProblemListPagination
            current={page}
            total={list.data.total}
            pageSize={PAGE_SIZE}
            onChange={commitPage}
          />
        </>
      ) : (
        <Empty description="조건에 맞는 문제가 없어요. 필터를 조정해보세요." />
      )}

      {retryTarget ? (
        <RetryModal
          open
          onClose={() => setRetryTarget(null)}
          problemId={retryTarget.id}
          questionNo={retryTarget.question_no}
          submissionId={retryTarget.latestSubmissionId ?? undefined}
          hasSubmission={retryTarget.solveState === "submitted"}
          hasAttempt={retryTarget.solveState === "attempted"}
        />
      ) : null}
    </Space>
  );
}
