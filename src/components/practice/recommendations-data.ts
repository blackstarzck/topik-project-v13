"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  RecommendationBundle as ServerRecommendationBundle,
  RecommendationItemCard,
  RecommendationRunSummary,
} from "@/lib/practice/recommendations";
import type { QuestionNo } from "@/lib/practice/types";

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

export type { RecommendationItemCard, RecommendationRunSummary };

export type RecommendationBundle = {
  run: RecommendationRunSummary | null;
  items: RecommendationItemCard[];
  /** question_no values that currently have at least one active recommendation. */
  availableTypes: Set<QuestionNo>;
};

type SerializableRecommendationBundle = Omit<
  ServerRecommendationBundle,
  "availableTypes"
> & {
  availableTypes: QuestionNo[];
};

export const RECOMMENDATION_REQUEST_TIMEOUT_MS = 8_000;

export class RecommendationRequestTimeoutError extends Error {
  constructor() {
    super("recommendation_request_timeout");
    this.name = "RecommendationRequestTimeoutError";
  }
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
): Promise<RecommendationBundle> {
  const search = questionNo == null ? "" : `?type=${questionNo}`;
  const response = await fetch(`/api/practice/recommendations${search}`, {
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error(`recommendations_request_failed:${response.status}`);
  }
  const raw = (await response.json()) as SerializableRecommendationBundle;

  return {
    ...raw,
    availableTypes: new Set(raw.availableTypes),
  };
}

export function fetchRecommendationBundle(
  questionNo: QuestionNo | null,
  timeoutMs = RECOMMENDATION_REQUEST_TIMEOUT_MS,
): Promise<RecommendationBundle> {
  return withTimeout(queryRecommendationBundle(questionNo), timeoutMs);
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
