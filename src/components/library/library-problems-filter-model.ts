/**
 * F-01 `/library/problems` 우측 필터 패널 — pure 필터/집계 로직.
 *
 * 필터는 4개 그룹으로 구성되고, 활성 그룹끼리는 AND로 결합한다
 * (빈 그룹 = 제약 없음):
 *   1. 문제 유형(51~54): 양쪽 kind 모두 question_no로 판정. 활성 시
 *      question_no가 null인 항목은 제외.
 *   2. 항목 유형 트리: 저장 답안 > 분석 상태 4종 / 저장 문제 > 가용성 2종.
 *      브랜치 합집합 의미론 — 하위 체크는 부모 브랜치를 암묵 선택한다.
 *        - submissionBranch = kinds.has("submission") || statuses.size > 0
 *        - problemBranch   = kinds.has("problem")    || availability.size > 0
 *        - 두 브랜치 모두 비활성이면 전체 통과.
 *        - truth table:
 *            `분석 완료`만 체크            → 완료 답안만
 *            `분석 완료` + `저장 문제`     → 완료 답안 ∪ 모든 저장 문제
 *            `저장 답안` + `분석 실패`     → 실패 답안만 (자식으로 좁힘)
 *   3. 날짜: saved_at 기준, from/to(경계 포함) epoch 비교. 프리셋은 클릭
 *      시점에 구체 from/to로 확정해 저장하므로 판정은 항상 from/to만 읽는다.
 *   4. 점수: scoreTotal/scoreMax 백분율(경계 포함). 점수 없는 항목(저장 문제,
 *      분석 전/실패, enrichment 미로딩)은 활성 시 제외. [0,100] 전체 범위는
 *      null(비활성)로 정규화한다.
 *
 * 패싯 카운트는 체크박스 12종(유형4+kind2+상태4+가용성2)에만 제공하며,
 * 기존 규칙 그대로 "검색 적용 후 · 패널 필터 적용 전" 집합을 넣는다.
 * Filter model tests가 facet 계산의 실행 계약을 고정한다.
 */

import dayjs, { type Dayjs } from "dayjs";

import type {
  LibraryDraftView,
  LibraryProblemView,
  LibrarySubmissionView,
} from "@/lib/library/types";

import type { SubmissionEnrichment } from "./library-enrich-data";

export const LIBRARY_PROBLEMS_QUESTION_NOS = [51, 52, 53, 54] as const;
export type LibraryProblemsQuestionNo =
  (typeof LIBRARY_PROBLEMS_QUESTION_NOS)[number];

export type LibraryProblemsKind = "submission" | "problem" | "draft";
export type LibraryProblemsStatus = SubmissionEnrichment["feedbackStatus"];
export type LibraryProblemsAvailability =
  | "soft_unavailable"
  | "hard_unavailable";

export const LIBRARY_PROBLEMS_STATUSES: readonly LibraryProblemsStatus[] = [
  "pending",
  "analyzing",
  "complete",
  "failed",
];

export const LIBRARY_PROBLEMS_AVAILABILITY: readonly LibraryProblemsAvailability[] =
  ["soft_unavailable", "hard_unavailable"];

export type LibraryProblemsDatePreset = "week" | "month" | "quarter";

export type LibraryProblemsDateFilter = {
  /** 직접 범위 선택 시 null — 필터 판정은 preset이 아니라 from/to만 읽는다. */
  preset: LibraryProblemsDatePreset | null;
  /** ISO datetime, inclusive 시작 경계(그 날의 startOf day). */
  from: string | null;
  /** ISO datetime, inclusive 종료 경계(그 날의 endOf day). */
  to: string | null;
};

export type LibraryProblemsFilterState = {
  questionNos: ReadonlySet<LibraryProblemsQuestionNo>;
  kinds: ReadonlySet<LibraryProblemsKind>;
  statuses: ReadonlySet<LibraryProblemsStatus>;
  availability: ReadonlySet<LibraryProblemsAvailability>;
  date: LibraryProblemsDateFilter | null;
  /** 백분율 [min, max] (경계 포함), null = 비활성. */
  scoreRange: readonly [number, number] | null;
};

export const EMPTY_LIBRARY_PROBLEMS_FILTERS: LibraryProblemsFilterState = {
  questionNos: new Set(),
  kinds: new Set(),
  statuses: new Set(),
  availability: new Set(),
  date: null,
  scoreRange: null,
};

/** 리스트가 들고 있는 혼합 항목의 필터/정렬 판정에 필요한 최소 구조. */
export type LibraryProblemsFilterEntry =
  | {
      kind: "submission";
      item: Pick<LibrarySubmissionView, "id" | "question_no" | "saved_at">;
    }
  | {
      kind: "problem";
      item: Pick<
        LibraryProblemView,
        "availabilityStatus" | "question_no" | "saved_at"
      >;
    }
  | {
      kind: "draft";
      item: Pick<LibraryDraftView, "id" | "question_no" | "saved_at">;
    };

type EnrichmentMap = ReadonlyMap<string, SubmissionEnrichment>;

/** enrichment 로딩 전에는 행 배지와 동일하게 pending으로 간주한다. */
function submissionStatus(
  entry: Extract<LibraryProblemsFilterEntry, { kind: "submission" }>,
  enrich: EnrichmentMap,
): LibraryProblemsStatus {
  return enrich.get(entry.item.id)?.feedbackStatus ?? "pending";
}

export function isLibraryProblemsQuestionNo(
  value: number,
): value is LibraryProblemsQuestionNo {
  return (LIBRARY_PROBLEMS_QUESTION_NOS as readonly number[]).includes(value);
}

function isDateFilterActive(
  date: LibraryProblemsDateFilter | null,
): date is LibraryProblemsDateFilter {
  return date != null && (date.from != null || date.to != null);
}

export function isLibraryProblemsFilterStateEmpty(
  state: LibraryProblemsFilterState,
): boolean {
  return (
    state.questionNos.size === 0 &&
    state.kinds.size === 0 &&
    state.statuses.size === 0 &&
    state.availability.size === 0 &&
    !isDateFilterActive(state.date) &&
    state.scoreRange == null
  );
}

/** 모바일 필터 버튼 배지용 — 체크 개수 + 날짜/점수 그룹 각 1. */
export function countActiveLibraryProblemsFilters(
  state: LibraryProblemsFilterState,
): number {
  return (
    state.questionNos.size +
    state.kinds.size +
    state.statuses.size +
    state.availability.size +
    (isDateFilterActive(state.date) ? 1 : 0) +
    (state.scoreRange != null ? 1 : 0)
  );
}

/** scoreTotal/scoreMax 백분율. 점수 없거나 scoreMax<=0이면 null. */
export function scorePercent(
  meta: SubmissionEnrichment | undefined,
): number | null {
  if (!meta || meta.scoreTotal == null || meta.scoreMax == null) return null;
  if (meta.scoreMax <= 0) return null;
  return (meta.scoreTotal / meta.scoreMax) * 100;
}

/** [0,100] 전체 범위 = 비활성(null). 순서/경계도 함께 정돈한다. */
export function normalizeScoreRange(
  range: readonly [number, number] | null,
): readonly [number, number] | null {
  if (range == null) return null;
  const lo = Math.max(0, Math.min(range[0], range[1]));
  const hi = Math.min(100, Math.max(range[0], range[1]));
  if (lo <= 0 && hi >= 100) return null;
  return [lo, hi];
}

/**
 * 프리셋을 클릭 시점 now 기준의 구체 from/to로 확정한다.
 * (자정 경과로 인한 stale은 허용 — SOT 제안 문서에 기록)
 */
export function resolveDatePreset(
  preset: LibraryProblemsDatePreset,
  now: Dayjs = dayjs(),
): LibraryProblemsDateFilter {
  const from =
    preset === "week"
      ? now.subtract(1, "week")
      : preset === "month"
        ? now.subtract(1, "month")
        : now.subtract(3, "month");
  return {
    preset,
    from: from.startOf("day").toISOString(),
    to: now.endOf("day").toISOString(),
  };
}

export function matchesLibraryProblemsFilters(
  entry: LibraryProblemsFilterEntry,
  state: LibraryProblemsFilterState,
  enrich: EnrichmentMap,
): boolean {
  // 그룹 1 — 문제 유형
  if (state.questionNos.size > 0) {
    const questionNo = entry.item.question_no;
    if (
      questionNo == null ||
      !isLibraryProblemsQuestionNo(questionNo) ||
      !state.questionNos.has(questionNo)
    ) {
      return false;
    }
  }

  // 그룹 2 — 항목 유형 트리 (브랜치 합집합)
  const submissionBranch =
    state.kinds.has("submission") || state.statuses.size > 0;
  const problemBranch =
    state.kinds.has("problem") || state.availability.size > 0;
  const draftBranch = state.kinds.has("draft");
  if (submissionBranch || problemBranch || draftBranch) {
    if (entry.kind === "submission") {
      if (!submissionBranch) return false;
      if (
        state.statuses.size > 0 &&
        !state.statuses.has(submissionStatus(entry, enrich))
      ) {
        return false;
      }
    } else if (entry.kind === "problem") {
      if (!problemBranch) return false;
      if (state.availability.size > 0) {
        const status = entry.item.availabilityStatus;
        if (
          status === "available" ||
          !state.availability.has(status as LibraryProblemsAvailability)
        ) {
          return false;
        }
      }
    } else if (!draftBranch) {
      return false;
    }
  }

  // 그룹 3 — 날짜 (saved_at, 경계 포함)
  if (isDateFilterActive(state.date)) {
    const savedAt = new Date(entry.item.saved_at).getTime();
    if (Number.isNaN(savedAt)) return false;
    if (
      state.date.from != null &&
      savedAt < new Date(state.date.from).getTime()
    ) {
      return false;
    }
    if (state.date.to != null && savedAt > new Date(state.date.to).getTime()) {
      return false;
    }
  }

  // 그룹 4 — 점수 백분율 (점수 없는 항목은 제외)
  if (state.scoreRange != null) {
    if (entry.kind !== "submission") return false;
    const percent = scorePercent(enrich.get(entry.item.id));
    if (percent == null) return false;
    const [min, max] = state.scoreRange;
    if (percent < min || percent > max) return false;
  }

  return true;
}

/** 필터 상태가 비어 있으면 원본 배열을 그대로 반환한다. */
export function applyLibraryProblemsFilters<
  T extends LibraryProblemsFilterEntry,
>(
  entries: readonly T[],
  state: LibraryProblemsFilterState,
  enrich: EnrichmentMap,
): readonly T[] {
  if (isLibraryProblemsFilterStateEmpty(state)) {
    return entries;
  }
  return entries.filter((entry) =>
    matchesLibraryProblemsFilters(entry, state, enrich),
  );
}

export type LibraryProblemsFacetCounts = {
  questionNos: Record<LibraryProblemsQuestionNo, number>;
  kinds: Record<LibraryProblemsKind, number>;
  statuses: Record<LibraryProblemsStatus, number>;
  availability: Record<LibraryProblemsAvailability, number>;
};

/**
 * 체크박스 12종의 패싯 카운트 — "검색 적용 후 · 패널 필터 적용 전" 집합을
 * 넣는다. 각 값은 해당 조건 단독 매칭 개수다(self-excluding 아님).
 */
export function countLibraryProblemsFacets(
  entries: readonly LibraryProblemsFilterEntry[],
  enrich: EnrichmentMap,
): LibraryProblemsFacetCounts {
  const counts: LibraryProblemsFacetCounts = {
    questionNos: { 51: 0, 52: 0, 53: 0, 54: 0 },
    kinds: { submission: 0, problem: 0, draft: 0 },
    statuses: { pending: 0, analyzing: 0, complete: 0, failed: 0 },
    availability: { soft_unavailable: 0, hard_unavailable: 0 },
  };

  for (const entry of entries) {
    const questionNo = entry.item.question_no;
    if (questionNo != null && isLibraryProblemsQuestionNo(questionNo)) {
      counts.questionNos[questionNo] += 1;
    }
    if (entry.kind === "submission") {
      counts.kinds.submission += 1;
      counts.statuses[submissionStatus(entry, enrich)] += 1;
    } else if (entry.kind === "problem") {
      counts.kinds.problem += 1;
      const status = entry.item.availabilityStatus;
      if (status !== "available") {
        counts.availability[status] += 1;
      }
    } else {
      counts.kinds.draft += 1;
    }
  }
  return counts;
}
