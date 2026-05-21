"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "../supabase/browser";
import {
  type ProblemListParams,
  type ProblemRow,
  type ProblemSort,
  type QuestionNo,
  type RecommendationCard,
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

export function pageRange(page: number, pageSize: number): {
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
    const problems = normalizeJoined(
      (row as { problems: unknown }).problems,
    );
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
):
  | { title: string; domain: string; question_no: number | null }
  | null {
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
