"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { QUESTION_NOS, type QuestionNo } from "@/lib/practice/types";

/**
 * C-01 문제 유형 추천 — client-side data layer.
 *
 * NOTE: This module lives under components/practice/** (this cluster's write
 * path) instead of src/lib/** because the IA execution write-scope does not
 * include src/lib. It mirrors the conventions in src/lib/practice/queries.ts
 * (browser client + @tanstack/react-query) so neighboring code stays uniform.
 *
 * Surfaces three things the spec (description.md §3 + functional-spec DB
 * table recommendation_runs.reason_summary / recommendation_items.weakness_tags)
 * requires but the prior RecommendationsView did not show:
 *   1) recommendation_runs.reason_summary — run-level "왜 이걸 추천했나" 요약.
 *   2) recommendation_items.weakness_tags — 취약 태그 근거.
 *   3) 대표 추천(rank 1) vs 나머지 분리 — 화면에서 1개를 크게 노출.
 */

export type RecommendationRunSummary = {
  reasonSummary: string | null;
  sourceType: string;
  createdAt: string;
};

export type RecommendationItemCard = {
  itemId: string;
  problemId: string;
  rank: number;
  reason: string | null;
  estimatedMinutes: number | null;
  weaknessTags: string[];
  title: string;
  questionNo: QuestionNo | null;
};

export type RecommendationBundle = {
  run: RecommendationRunSummary | null;
  items: RecommendationItemCard[];
  /** question_no values that currently have at least one active recommendation. */
  availableTypes: Set<QuestionNo>;
};

export const RECOMMENDATION_REQUEST_TIMEOUT_MS = 8_000;

export class RecommendationRequestTimeoutError extends Error {
  constructor() {
    super("recommendation_request_timeout");
    this.name = "RecommendationRequestTimeoutError";
  }
}

function normalizeJoinedProblem(
  raw: unknown,
): { title: string; question_no: number | null } | null {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (!candidate || typeof candidate !== "object") return null;
  const obj = candidate as Record<string, unknown>;
  if (typeof obj.title !== "string") return null;
  const qn = obj.question_no;
  return { title: obj.title, question_no: typeof qn === "number" ? qn : null };
}

function toQuestionNo(value: number | null): QuestionNo | null {
  if (value == null) return null;
  return (QUESTION_NOS as readonly number[]).includes(value)
    ? (value as QuestionNo)
    : null;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return new Promise<T>((resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new RecommendationRequestTimeoutError());
    }, timeoutMs);

    promise.then(resolve, reject).finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
    });
  });
}

async function queryRecommendationBundle(
  questionNo: QuestionNo | null,
  createClient: () => ReturnType<
    typeof createSupabaseBrowserClient
  > = createSupabaseBrowserClient,
): Promise<RecommendationBundle> {
  const supabase = createClient();

  // Latest active run for this user (RLS scopes to auth.uid()).
  const { data: runData, error: runErr } = await supabase
    .from("recommendation_runs")
    .select("id, source_type, reason_summary, created_at, expires_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (runErr) throw runErr;

  let itemQuery = supabase
    .from("recommendation_items")
    .select(
      "id, problem_id, rank, reason, estimated_minutes, weakness_tags," +
        " problems!inner(title, question_no, publish_status)",
    )
    .eq("status", "active")
    .eq("problems.publish_status", "published")
    .order("rank", { ascending: true })
    .limit(8);
  if (questionNo != null) {
    itemQuery = itemQuery.eq("problems.question_no", questionNo);
  }
  const { data: itemData, error: itemErr } = await itemQuery;
  if (itemErr) throw itemErr;

  // PostgREST embeds widen the row type to a union with an error marker; treat
  // the rows opaquely and read each field defensively (same approach as the
  // normalizeJoined helper in src/lib/practice/queries.ts).
  type RawItem = {
    id: string;
    problem_id: string;
    rank: number;
    reason: string | null;
    estimated_minutes: number | null;
    weakness_tags: string[] | null;
    problems: unknown;
  };
  const rawItems = (itemData ?? []) as unknown as RawItem[];

  const items: RecommendationItemCard[] = [];
  const availableTypes = new Set<QuestionNo>();
  for (const row of rawItems) {
    const problem = normalizeJoinedProblem(row.problems);
    if (!problem) continue;
    const qn = toQuestionNo(problem.question_no);
    if (qn != null) availableTypes.add(qn);
    items.push({
      itemId: row.id,
      problemId: row.problem_id,
      rank: row.rank,
      reason: row.reason,
      estimatedMinutes: row.estimated_minutes,
      weaknessTags: Array.isArray(row.weakness_tags) ? row.weakness_tags : [],
      title: problem.title,
      questionNo: qn,
    });
  }

  return {
    run: runData
      ? {
          reasonSummary: runData.reason_summary,
          sourceType: runData.source_type,
          createdAt: runData.created_at,
        }
      : null,
    items,
    availableTypes,
  };
}

export function fetchRecommendationBundle(
  questionNo: QuestionNo | null,
  createClient: () => ReturnType<
    typeof createSupabaseBrowserClient
  > = createSupabaseBrowserClient,
  timeoutMs = RECOMMENDATION_REQUEST_TIMEOUT_MS,
): Promise<RecommendationBundle> {
  return withTimeout(
    queryRecommendationBundle(questionNo, createClient),
    timeoutMs,
  );
}

export function recommendationBundleKey(questionNo: QuestionNo | null) {
  return ["recommendation-bundle", questionNo ?? "all"] as const;
}

export function useRecommendationBundle(questionNo: QuestionNo | null) {
  return useQuery({
    queryKey: recommendationBundleKey(questionNo),
    queryFn: () => fetchRecommendationBundle(questionNo),
    retry: false,
  });
}

/**
 * i18n: question-type labels are no longer stored as Korean strings in this
 * data module. The detailed label for each question number lives in the
 * `practice.common.questionType{51|52|53|54}` catalog and is resolved by the
 * consuming components (e.g. TypeSelectCards) via `useTranslations`.
 */
