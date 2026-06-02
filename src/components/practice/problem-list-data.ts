"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  ProblemFilter,
  ProblemSort,
  SolveState,
} from "@/lib/practice/types";

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
 * The RPC is not yet in the generated Supabase types, so we call it through an
 * `as never` cast (same pattern as submit_writing_with_feedback in
 * src/lib/writing/server-actions.ts) and validate the row shape at runtime.
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
  /** Latest writing_submissions.id for solved rows → RetryModal deep-link. */
  latestSubmissionId: string | null;
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

function mapSort(sort: ProblemSort): "recent" | "difficulty" {
  // The RPC supports 'recent' | 'difficulty'. We map the four UI sorts onto the
  // two RPC sorts (asc/desc nuance for created_at is fixed desc in the RPC; the
  // UI 'oldest' degrades to 'recent' here — flagged as a minor follow-up).
  if (sort === "difficulty-asc" || sort === "difficulty-desc") {
    return "difficulty";
  }
  return "recent";
}

function buildFilterJson(filter: ProblemFilter): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  if (filter.questionNo != null) f.question_no = filter.questionNo;
  if (filter.difficulty != null) f.difficulty = filter.difficulty;
  if (filter.topikLevel != null) f.topik_level = filter.topikLevel;
  const status = mapStatusFilter(filter.solveStatus);
  if (status) f.status = status;
  if (filter.search && filter.search.trim().length > 0) {
    f.search = filter.search.trim();
  }
  return f;
}

function toSolveState(row: RpcRow): SolveState {
  if (row.is_solved) return "submitted";
  if ((row.attempt_count ?? 0) > 0) return "attempted";
  return "none";
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
  const { data, error } = await supabase.rpc("list_user_problems" as never, {
    filter: buildFilterJson(params.filter),
    sort: mapSort(params.sort),
    page: params.page,
    page_size: params.pageSize,
  } as never);
  if (error) throw error;

  const rpcRows = (data as unknown as RpcRow[]) ?? [];
  const total = rpcRows.length > 0 ? Number(rpcRows[0].total_count ?? 0) : 0;

  // RetryModal "결과 보기" deep-link 를 위해 solved row 의 최신 제출 id 를 한 번에 조회.
  const solvedIds = rpcRows
    .filter((r) => r.is_solved)
    .map((r) => r.problem_id);
  const latestSubmissionByProblem = new Map<string, string>();
  if (solvedIds.length > 0) {
    const { data: subs } = await supabase
      .from("writing_submissions")
      .select("id, problem_id, submitted_at")
      .in("problem_id", solvedIds)
      .order("submitted_at", { ascending: false });
    for (const s of subs ?? []) {
      if (!latestSubmissionByProblem.has(s.problem_id)) {
        latestSubmissionByProblem.set(s.problem_id, s.id);
      }
    }
  }

  const rows: UserProblemRow[] = rpcRows.map((r) => ({
    problemId: r.problem_id,
    title: r.title,
    domain: r.domain,
    topikLevel: r.topik_level,
    questionNo: r.question_no,
    difficulty: r.difficulty,
    tags: Array.isArray(r.tags) ? r.tags : [],
    attemptCount: r.attempt_count ?? 0,
    isSolved: Boolean(r.is_solved),
    lastAttemptAt: r.last_attempt_at,
    createdAt: r.created_at,
    solveState: toSolveState(r),
    latestSubmissionId: latestSubmissionByProblem.get(r.problem_id) ?? null,
  }));
  return { rows, total };
}

export function userProblemsRpcKey(params: {
  filter: ProblemFilter;
  sort: ProblemSort;
  page: number;
  pageSize: number;
  userId?: string;
}) {
  return ["list-user-problems-rpc", params] as const;
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
