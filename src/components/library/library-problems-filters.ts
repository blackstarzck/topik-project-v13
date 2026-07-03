/**
 * F-01 `/library/problems` 유형·상태 필터 카드 — pure 필터/집계 로직.
 *
 * 카드 8종은 혼합 리스트의 두 축을 그대로 노출한다:
 *   - submission 축: 유형(저장 답안) + feedback_status 4종
 *   - problem 축: 유형(저장 문제) + availabilityStatus 2종(비가용만)
 * 체크된 카드는 합집합(OR)으로 결합한다. `저장 답안`/`저장 문제`는 각 축의
 * 상위 집합이라 상태 카드와 함께 체크해도 상위 집합이 우선 매치된다.
 * (근거: docs/sot-change-proposals/2026-07-04-library-problems-filter-cards.md)
 */

import type {
  LibraryProblemView,
  LibrarySubmissionView,
} from "@/lib/library/types";

import type { SubmissionEnrichment } from "./library-enrich-data";

export const LIBRARY_PROBLEMS_FILTER_KEYS = [
  "submissions",
  "statusPending",
  "statusAnalyzing",
  "statusComplete",
  "statusFailed",
  "problems",
  "providedEnded",
  "unavailable",
] as const;

export type LibraryProblemsFilterKey =
  (typeof LIBRARY_PROBLEMS_FILTER_KEYS)[number];

/** 리스트가 들고 있는 혼합 항목의 필터 판정에 필요한 최소 구조. */
export type LibraryProblemsFilterEntry =
  | { kind: "submission"; item: Pick<LibrarySubmissionView, "id"> }
  | { kind: "problem"; item: Pick<LibraryProblemView, "availabilityStatus"> };

type EnrichmentMap = ReadonlyMap<string, SubmissionEnrichment>;

/** enrichment 로딩 전에는 행 배지와 동일하게 pending으로 간주한다. */
function submissionStatus(
  entry: Extract<LibraryProblemsFilterEntry, { kind: "submission" }>,
  enrich: EnrichmentMap,
): SubmissionEnrichment["feedbackStatus"] {
  return enrich.get(entry.item.id)?.feedbackStatus ?? "pending";
}

export function matchesLibraryProblemsFilter(
  entry: LibraryProblemsFilterEntry,
  key: LibraryProblemsFilterKey,
  enrich: EnrichmentMap,
): boolean {
  if (entry.kind === "submission") {
    switch (key) {
      case "submissions":
        return true;
      case "statusPending":
        return submissionStatus(entry, enrich) === "pending";
      case "statusAnalyzing":
        return submissionStatus(entry, enrich) === "analyzing";
      case "statusComplete":
        return submissionStatus(entry, enrich) === "complete";
      case "statusFailed":
        return submissionStatus(entry, enrich) === "failed";
      default:
        return false;
    }
  }

  switch (key) {
    case "problems":
      return true;
    case "providedEnded":
      return entry.item.availabilityStatus === "soft_unavailable";
    case "unavailable":
      return entry.item.availabilityStatus === "hard_unavailable";
    default:
      return false;
  }
}

/** 카드 개수 집계 — 검색 적용 후, 카드 필터 적용 전 집합을 넣는다(패싯 카운트). */
export function countLibraryProblemsFilters<
  T extends LibraryProblemsFilterEntry,
>(entries: readonly T[], enrich: EnrichmentMap) {
  const counts = Object.fromEntries(
    LIBRARY_PROBLEMS_FILTER_KEYS.map((key) => [key, 0]),
  ) as Record<LibraryProblemsFilterKey, number>;

  for (const entry of entries) {
    for (const key of LIBRARY_PROBLEMS_FILTER_KEYS) {
      if (matchesLibraryProblemsFilter(entry, key, enrich)) {
        counts[key] += 1;
      }
    }
  }
  return counts;
}

/** 체크 없음 = 전체. 체크 있으면 합집합(OR)만 남긴다. */
export function applyLibraryProblemsFilters<
  T extends LibraryProblemsFilterEntry,
>(
  entries: readonly T[],
  checked: ReadonlySet<LibraryProblemsFilterKey>,
  enrich: EnrichmentMap,
): readonly T[] {
  if (checked.size === 0) {
    return entries;
  }
  return entries.filter((entry) => {
    for (const key of checked) {
      if (matchesLibraryProblemsFilter(entry, key, enrich)) {
        return true;
      }
    }
    return false;
  });
}
