"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "../supabase/browser";
import {
  type ProblemListParams,
  type ProblemRow,
  type ProblemRowWithState,
  type ProblemSort,
  type QuestionNo,
  type RecommendationCard,
  type SolveState,
} from "./types";

type BrowserClient = ReturnType<typeof createSupabaseBrowserClient>;
type ClientFactory = () => BrowserClient;

export function problemListQueryKey(params: ProblemListParams) {
  return ["problem-list", params] as const;
}

export function problemRecommendationsKey(questionNo: QuestionNo | null) {
  return ["problem-recommendations", questionNo ?? "all"] as const;
}

export function applySort<T extends { column: string; ascending?: boolean }>(
  sort: ProblemSort,
): T {
  switch (sort) {
    case "newest":
      return { column: "updated_at", ascending: false } as T;
    case "oldest":
      return { column: "updated_at", ascending: true } as T;
    case "difficulty-asc":
      return { column: "difficulty", ascending: true } as T;
    case "difficulty-desc":
      return { column: "difficulty", ascending: false } as T;
  }
}

export function pageRange(
  page: number,
  pageSize: number,
): {
  from: number;
  to: number;
} {
  // Supabase range() is inclusive on both ends, 0-indexed.
  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.max(1, Math.floor(pageSize));
  const from = (safePage - 1) * safeSize;
  const to = from + safeSize - 1;
  return { from, to };
}

// Phase 7-D Task 12 (P1-8) — user-side solve state + recommended map.
// Round 2 fix (Codex P1): submissions에 id + submitted_at 추가로 latestSubmissionId 결정.
async function fetchUserSolveMap(
  supabase: BrowserClient,
  userId: string,
): Promise<{
  solveStates: Map<string, SolveState>;
  recommended: Set<string>;
  latestSubmissionByProblem: Map<string, string>;
}> {
  const [drafts, subs, recs] = await Promise.all([
    supabase.from("writing_drafts").select("problem_id").eq("user_id", userId),
    // submitted_at desc → 첫 iteration이 최신. 동일 problem_id 후속 row는 무시.
    supabase
      .from("writing_submissions")
      .select("id, problem_id, submitted_at")
      .eq("user_id", userId)
      .order("submitted_at", { ascending: false }),
    supabase
      .from("recommendation_items")
      .select("problem_id")
      .eq("user_id", userId)
      .eq("status", "active"),
  ]);
  const solveStates = new Map<string, SolveState>();
  const latestSubmissionByProblem = new Map<string, string>();
  for (const r of drafts.data ?? []) solveStates.set(r.problem_id, "attempted");
  for (const r of subs.data ?? []) {
    solveStates.set(r.problem_id, "submitted"); // submission overrides attempted
    if (!latestSubmissionByProblem.has(r.problem_id)) {
      latestSubmissionByProblem.set(r.problem_id, r.id);
    }
  }
  const recommended = new Set((recs.data ?? []).map((r) => r.problem_id));
  return { solveStates, recommended, latestSubmissionByProblem };
}

export async function fetchProblemList(
  params: ProblemListParams,
  createClient: ClientFactory = createSupabaseBrowserClient,
): Promise<{ rows: ProblemRow[]; total: number }> {
  const supabase = createClient();
  const sortCfg = applySort(params.sort);
  const { from, to } = pageRange(params.page, params.pageSize);

  let query = supabase
    .from("problems")
    .select(
      "id, domain, question_no, topik_level, difficulty, title, publish_status, review_status, tags, updated_at",
      { count: "exact" },
    )
    .eq("publish_status", "published")
    .order(sortCfg.column, { ascending: sortCfg.ascending })
    .range(from, to);

  if (params.filter.questionNo != null) {
    query = query.eq("question_no", params.filter.questionNo);
  }
  if (params.filter.difficulty != null) {
    query = query.eq("difficulty", params.filter.difficulty);
  }
  if (params.filter.topikLevel != null) {
    query = query.eq("topik_level", params.filter.topikLevel);
  }
  if (params.filter.search && params.filter.search.trim().length > 0) {
    const term = params.filter.search.trim();
    query = query.ilike("title", `%${term}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: (data ?? []) as ProblemRow[], total: count ?? 0 };
}

export function useProblemList(params: ProblemListParams) {
  return useQuery({
    queryKey: problemListQueryKey(params),
    queryFn: () => fetchProblemList(params),
    placeholderData: (previous) => previous,
  });
}

// Phase 7-D Task 12 — Enriched list with user-side solveState + recommended.
// Client-side post-filter for solveStatus / recommended (server-side filter
// requires a SECURITY DEFINER RPC; deferred per Plan rev3 §10).
export async function fetchUserProblemList(
  params: ProblemListParams,
  userId: string,
  createClient: ClientFactory = createSupabaseBrowserClient,
): Promise<{ rows: ProblemRowWithState[]; total: number }> {
  const supabase = createClient();
  const [base, userMap] = await Promise.all([
    fetchProblemList(params, () => supabase),
    fetchUserSolveMap(supabase, userId),
  ]);
  const enriched: ProblemRowWithState[] = base.rows.map((row) => ({
    ...row,
    solveState: userMap.solveStates.get(row.id) ?? "none",
    recommended: userMap.recommended.has(row.id),
    latestSubmissionId: userMap.latestSubmissionByProblem.get(row.id) ?? null,
  }));

  let rows = enriched;
  if (params.filter.recommended === true) {
    rows = rows.filter((r) => r.recommended);
  }
  switch (params.filter.solveStatus) {
    case "unsolved":
      rows = rows.filter((r) => r.solveState === "none");
      break;
    case "inProgress":
      rows = rows.filter((r) => r.solveState === "attempted");
      break;
    case "solved":
      rows = rows.filter((r) => r.solveState === "submitted");
      break;
  }
  // total은 server-side total (post-filter total은 client만 적용된 수치)
  return { rows, total: base.total };
}

export function useUserProblemList(
  params: ProblemListParams,
  userId: string | null,
) {
  return useQuery({
    queryKey: ["user-problem-list", userId, params] as const,
    queryFn: () =>
      userId
        ? fetchUserProblemList(params, userId)
        : Promise.resolve({ rows: [], total: 0 }),
    enabled: userId !== null,
    placeholderData: (previous) => previous,
  });
}

export async function fetchProblemRecommendations(
  questionNo: QuestionNo | null,
  createClient: ClientFactory = createSupabaseBrowserClient,
): Promise<RecommendationCard[]> {
  const supabase = createClient();
  let query = supabase
    .from("recommendation_items")
    .select(
      "id, problem_id, rank, reason, estimated_minutes, problems!inner(title, domain, question_no)",
    )
    .eq("status", "active")
    .order("rank", { ascending: true })
    .limit(5);
  if (questionNo != null) {
    query = query.eq("problems.question_no", questionNo);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    const problems = normalizeJoined((row as { problems: unknown }).problems);
    if (!problems) return [];
    return [
      {
        itemId: row.id,
        problemId: row.problem_id,
        rank: row.rank,
        reason: row.reason,
        estimatedMinutes: row.estimated_minutes,
        title: problems.title,
        domain: problems.domain as RecommendationCard["domain"],
        questionNo: problems.question_no,
      },
    ];
  });
}

function normalizeJoined(
  raw: unknown,
): { title: string; domain: string; question_no: number | null } | null {
  // Supabase types nested embed loosely: PostgREST may return a single object
  // (1:1 relation) or an array. !inner guarantees a row exists, but the type
  // layer doesn't, so normalize both shapes and drop unexpected ones.
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (!candidate || typeof candidate !== "object") return null;
  const obj = candidate as Record<string, unknown>;
  if (typeof obj.title !== "string" || typeof obj.domain !== "string") {
    return null;
  }
  const qn = obj.question_no;
  return {
    title: obj.title,
    domain: obj.domain,
    question_no: typeof qn === "number" ? qn : null,
  };
}

export function useProblemRecommendations(questionNo: QuestionNo | null) {
  return useQuery({
    queryKey: problemRecommendationsKey(questionNo),
    queryFn: () => fetchProblemRecommendations(questionNo),
  });
}
