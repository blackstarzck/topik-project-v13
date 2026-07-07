/**
 * F-01 `/library/problems` 정렬 — pure 비교 로직.
 *
 * 5개 키: 최근 저장 순(기본)/오래된 순/점수 높은 순/점수 낮은 순/문제 유형 순.
 * 점수 정렬은 방향과 무관하게 점수 없는 항목(저장 문제, 분석 전/실패,
 * enrichment 미로딩)을 뒤로 보내고, 문제 유형 정렬은 question_no null을
 * 뒤로 보낸다. 동률 tie-break는 항상 최근 저장 순(saved_at desc)이라
 * enrichment 도착 전후에도 순서가 예측 가능하다.
 * (근거: docs/sot-change-proposals/2026-07-04-library-problems-filter-panel.md)
 */

import type { SubmissionEnrichment } from "./library-enrich-data";
import {
  scorePercent,
  type LibraryProblemsFilterEntry,
} from "./library-problems-filter-model";

export const LIBRARY_PROBLEMS_SORT_KEYS = [
  "savedDesc",
  "savedAsc",
  "scoreDesc",
  "scoreAsc",
  "questionAsc",
] as const;

export type LibraryProblemsSortKey =
  (typeof LIBRARY_PROBLEMS_SORT_KEYS)[number];

export const DEFAULT_LIBRARY_PROBLEMS_SORT: LibraryProblemsSortKey =
  "savedDesc";

type EnrichmentMap = ReadonlyMap<string, SubmissionEnrichment>;

function savedAtEpoch(entry: LibraryProblemsFilterEntry): number {
  const epoch = new Date(entry.item.saved_at).getTime();
  return Number.isNaN(epoch) ? 0 : epoch;
}

function compareSavedDesc(
  a: LibraryProblemsFilterEntry,
  b: LibraryProblemsFilterEntry,
): number {
  return savedAtEpoch(b) - savedAtEpoch(a);
}

function entryScorePercent(
  entry: LibraryProblemsFilterEntry,
  enrich: EnrichmentMap,
): number | null {
  if (entry.kind !== "submission") return null;
  return scorePercent(enrich.get(entry.item.id));
}

/** null(값 없음)을 방향과 무관하게 뒤로 보내는 비교기. */
function compareNullable(
  a: number | null,
  b: number | null,
  direction: "asc" | "desc",
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return direction === "asc" ? a - b : b - a;
}

export function sortLibraryProblems<T extends LibraryProblemsFilterEntry>(
  entries: readonly T[],
  key: LibraryProblemsSortKey,
  enrich: EnrichmentMap,
): readonly T[] {
  const sorted = [...entries];
  switch (key) {
    case "savedDesc":
      return sorted.sort(compareSavedDesc);
    case "savedAsc":
      return sorted.sort((a, b) => savedAtEpoch(a) - savedAtEpoch(b));
    case "scoreDesc":
    case "scoreAsc": {
      const direction = key === "scoreDesc" ? "desc" : "asc";
      return sorted.sort((a, b) => {
        const byScore = compareNullable(
          entryScorePercent(a, enrich),
          entryScorePercent(b, enrich),
          direction,
        );
        return byScore !== 0 ? byScore : compareSavedDesc(a, b);
      });
    }
    case "questionAsc":
      return sorted.sort((a, b) => {
        const byQuestion = compareNullable(
          a.item.question_no,
          b.item.question_no,
          "asc",
        );
        return byQuestion !== 0 ? byQuestion : compareSavedDesc(a, b);
      });
  }
}
