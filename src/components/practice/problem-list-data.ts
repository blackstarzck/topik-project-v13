"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { userProblemsRpcKey } from "@/lib/practice/problem-list-query-key";
import type {
  ProblemFilter,
  ProblemSort,
  SolveState,
} from "@/lib/practice/types";
import type { Json } from "@/lib/supabase/types";
import type { FeedbackStatus } from "@/lib/writing/types";

/**
 * C-02 문제 목록 — list_user_problems RPC client wrapper.
 *
 * Lives under components/practice/** (cluster write path), mirroring
 * src/lib/practice/queries.ts conventions (browser client + react-query).
 *
 * Why the RPC instead of the prior client-side post-filter?
 *   The old fetchUserProblemList applied solveStatus/recommended filters on the
 *   client AFTER paging, so `total` reflected the pre-filter count → wrong page
 *   numbers (description.md §5 총 건수/페이지). list_user_problems (SECURITY
 *   INVOKER, caller RLS) does status filtering + window total_count in SQL, so
 *   pagination is accurate for the filtered set.
 *
 * The local Supabase type mirror includes this RPC so the call stays typed;
 * row mapping still guards nullable legacy fields for compatibility.
 */

export type UserProblemRow = {
  problemId: string;
  title: string;
  domain: string;
  topikLevel: number | null;
  questionNo: number | null;
  difficulty: number | null;
  tags: string[];
  attemptCount: number;
  isSolved: boolean;
  lastAttemptAt: string | null;
  createdAt: string;
  solveState: SolveState;
  /** Latest writing_submissions.id for submitted rows → RetryModal deep-link. */
  latestSubmissionId: string | null;
  latestSubmissionAt: string | null;
  feedbackStatus: FeedbackStatus | null;
  completedSubmissionCount: number;
  submissionAttemptCount: number;
  /** 이전 점수: 본인 최신 제출의 writing_feedback.score_total. 없으면 null. */
  previousScore: number | null;
  lifecycleStatus: "active" | "inactive" | "expired";
  lifecycleReason: string | null;
  publishStatus: "draft" | "published" | "archived";
  reviewStatus: "pending" | "approved" | "rejected";
};

export type UserProblemListResult = {
  rows: UserProblemRow[];
  total: number;
};

type RpcRow = {
  problem_id: string;
  title: string;
  domain: string;
  topik_level: number | null;
  question_no: number | null;
  difficulty: number | null;
  tags: string[] | null;
  attempt_count: number | null;
  is_solved: boolean | null;
  last_attempt_at: string | null;
  created_at: string;
  total_count: number | string | null;
  solve_state?: string | null;
  has_draft?: boolean | null;
  draft_status?: string | null;
  writing_submission_count?: number | null;
  writing_submission_attempt_count?: number | null;
  latest_submission_id?: string | null;
  latest_submission_at?: string | null;
  writing_feedback_status?: string | null;
  lifecycle_status?: string | null;
  lifecycle_reason?: string | null;
  publish_status?: string | null;
  review_status?: string | null;
};

function mapStatusFilter(
  solveStatus: ProblemFilter["solveStatus"],
): string | undefined {
  switch (solveStatus) {
    case "solved":
      return "solved";
    case "inProgress":
      return "attempted";
    case "unsolved":
      return "unattempted";
    default:
      return undefined;
  }
}

function buildFilterJson(filter: ProblemFilter): Record<string, Json> {
  const f: Record<string, Json> = { exclude_seed: true };
  if (filter.questionNo != null) f.question_no = filter.questionNo;
  if (filter.difficulty != null) f.difficulty = filter.difficulty;
  if (filter.topikLevel != null) f.topik_level = filter.topikLevel;
  if (filter.recommended === true) f.recommended = true;
  if (filter.reviewSetId && filter.reviewSetId.trim().length > 0) {
    f.review_set_id = filter.reviewSetId.trim();
  }
  const status = mapStatusFilter(filter.solveStatus);
  if (status) f.status = status;
  if (filter.search && filter.search.trim().length > 0) {
    f.search = filter.search.trim();
  }
  return f;
}

function toSolveState(row: RpcRow): SolveState {
  if (row.solve_state === "submitted") return "submitted";
  if (row.solve_state === "attempted") return "attempted";
  if (row.solve_state === "none") return "none";
  if (row.is_solved) return "submitted";
  if ((row.attempt_count ?? 0) > 0) return "attempted";
  return "none";
}

function toLifecycleStatus(
  value: string | null | undefined,
): UserProblemRow["lifecycleStatus"] {
  if (value === "inactive" || value === "expired") return value;
  return "active";
}

function toPublishStatus(
  value: string | null | undefined,
): UserProblemRow["publishStatus"] {
  if (value === "draft" || value === "archived") return value;
  return "published";
}

function toReviewStatus(
  value: string | null | undefined,
): UserProblemRow["reviewStatus"] {
  if (value === "pending" || value === "rejected") return value;
  return "approved";
}

function toFeedbackStatus(
  value: string | null | undefined,
): FeedbackStatus | null {
  if (
    value === "pending" ||
    value === "analyzing" ||
    value === "complete" ||
    value === "failed"
  ) {
    return value;
  }
  return null;
}

function isSeedFixtureRow(row: RpcRow): boolean {
  return (
    Array.isArray(row.tags) && row.tags.some((tag) => tag.startsWith("seed:"))
  );
}

export async function fetchUserProblemsRpc(
  params: {
    filter: ProblemFilter;
    sort: ProblemSort;
    page: number;
    pageSize: number;
    /** Cache-isolation only; the RPC scopes rows by auth.uid(). */
    userId?: string;
  },
  createClient: () => ReturnType<
    typeof createSupabaseBrowserClient
  > = createSupabaseBrowserClient,
): Promise<UserProblemListResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("list_user_problems", {
    filter: buildFilterJson(params.filter),
    sort: params.sort,
    page: params.page,
    page_size: params.pageSize,
  });
  if (error) throw error;

  const rpcRows = (data as unknown as RpcRow[]) ?? [];
  const visibleRows = rpcRows.filter((row) => !isSeedFixtureRow(row));
  const total =
    visibleRows.length < rpcRows.length
      ? visibleRows.length
      : rpcRows.length > 0
        ? Number(rpcRows[0].total_count ?? 0)
        : 0;

  const rows: UserProblemRow[] = visibleRows.map((r) => {
    const solveState = toSolveState(r);
    return {
      problemId: r.problem_id,
      title: r.title,
      domain: r.domain,
      topikLevel: r.topik_level,
      questionNo: r.question_no,
      difficulty: r.difficulty,
      tags: Array.isArray(r.tags) ? r.tags : [],
      attemptCount: r.attempt_count ?? 0,
      isSolved: solveState === "submitted",
      lastAttemptAt: r.last_attempt_at,
      createdAt: r.created_at,
      solveState,
      latestSubmissionId: r.latest_submission_id ?? null,
      latestSubmissionAt: r.latest_submission_at ?? null,
      feedbackStatus: toFeedbackStatus(r.writing_feedback_status),
      completedSubmissionCount: r.writing_submission_count ?? 0,
      submissionAttemptCount:
        r.writing_submission_attempt_count ?? r.writing_submission_count ?? 0,
      previousScore: null,
      lifecycleStatus: toLifecycleStatus(r.lifecycle_status),
      lifecycleReason: r.lifecycle_reason ?? null,
      publishStatus: toPublishStatus(r.publish_status),
      reviewStatus: toReviewStatus(r.review_status),
    };
  });

  // 이전 점수(previousScore): list_user_problems는 점수를 반환하지 않으므로, 현재 페이지
  // 행들의 최신 제출(writing_submissions.id)에 대한 writing_feedback.score_total을 한 번의
  // 추가 조회로 채운다. writing_feedback은 owner RLS → 본인 점수만 조회됨. 미제출/미채점 → null.
  const submissionIds = rows
    .map((row) => row.latestSubmissionId)
    .filter((id): id is string => Boolean(id));
  if (submissionIds.length > 0) {
    const { data: feedbackRows } = await supabase
      .from("writing_feedback")
      .select("submission_id, score_total")
      .in("submission_id", submissionIds);
    if (feedbackRows && feedbackRows.length > 0) {
      const scoreBySubmission = new Map<string, number | null>(
        feedbackRows.map((f) => [
          f.submission_id as string,
          (f.score_total as number | null) ?? null,
        ]),
      );
      for (const row of rows) {
        if (
          row.latestSubmissionId &&
          scoreBySubmission.has(row.latestSubmissionId)
        ) {
          row.previousScore =
            scoreBySubmission.get(row.latestSubmissionId) ?? null;
        }
      }
    }
  }

  return { rows, total };
}

export function useUserProblemsRpc(params: {
  filter: ProblemFilter;
  sort: ProblemSort;
  page: number;
  pageSize: number;
  userId?: string;
}) {
  return useQuery({
    queryKey: userProblemsRpcKey(params),
    queryFn: () => fetchUserProblemsRpc(params),
    placeholderData: (previous) => previous,
  });
}

// ---------------------------------------------------------------------------
// Search validation — description.md §3 (검색어 2-40자, 금칙어 → 검색창 하단 안내).
// ---------------------------------------------------------------------------

const FORBIDDEN_SEARCH_PATTERNS: RegExp[] = [
  // SQL/script-ish 금칙어 — 사용자 입력 위생 + 의미 없는 검색 방지.
  /<\s*script/i,
  /;\s*drop\s+table/i,
  /--/,
  /[<>]/,
];

/**
 * i18n: this is a "use client" data/hook module, NOT a React component, so it
 * cannot call `useTranslations`. Instead of returning a localized string,
 * `validateSearch` returns a stable `reasonKey` that the consuming component
 * (ProblemListControls) resolves via `t(reasonKey)` against the
 * `practice.problems` namespace. The key set is fixed below.
 */
export type SearchReasonKey =
  | "searchTooShort"
  | "searchTooLong"
  | "searchForbidden";

export type SearchValidation =
  | { ok: true; value: string }
  | { ok: false; reasonKey: SearchReasonKey };

export function validateSearch(raw: string): SearchValidation {
  const value = raw.trim();
  if (value.length === 0) return { ok: true, value: "" };
  if (value.length < 2) {
    return { ok: false, reasonKey: "searchTooShort" };
  }
  if (value.length > 40) {
    return { ok: false, reasonKey: "searchTooLong" };
  }
  if (FORBIDDEN_SEARCH_PATTERNS.some((re) => re.test(value))) {
    return {
      ok: false,
      reasonKey: "searchForbidden",
    };
  }
  return { ok: true, value };
}
