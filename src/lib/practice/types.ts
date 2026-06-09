import type { Tables } from "../supabase/types";

/**
 * Phase 4 domain types for the practice (problem list + recommendations)
 * surface. UI components and queries import these — page-level pieces
 * import from `routes.ts` for path-level rules.
 */

export type ProblemRow = Pick<
  Tables<"problems">,
  | "id"
  | "domain"
  | "question_no"
  | "topik_level"
  | "difficulty"
  | "title"
  | "publish_status"
  | "review_status"
  | "lifecycle_status"
  | "lifecycle_reason"
  | "tags"
  | "updated_at"
>;

export type RecommendationCard = {
  itemId: Tables<"recommendation_items">["id"];
  problemId: Tables<"recommendation_items">["problem_id"];
  rank: Tables<"recommendation_items">["rank"];
  reason: Tables<"recommendation_items">["reason"];
  estimatedMinutes: Tables<"recommendation_items">["estimated_minutes"];
  title: Tables<"problems">["title"];
  domain: Tables<"problems">["domain"];
  questionNo: Tables<"problems">["question_no"];
};

export type QuestionNo = 51 | 52 | 53 | 54;
export const QUESTION_NOS: readonly QuestionNo[] = [51, 52, 53, 54];

export function isValidQuestionNo(value: unknown): value is QuestionNo {
  return (
    typeof value === "number" &&
    (QUESTION_NOS as readonly number[]).includes(value)
  );
}

export type ProblemSort = "newest" | "oldest" | "difficulty-asc" | "difficulty-desc";

// Phase 7-D Task 12 (P1-8) — IA spec 4 filters: type + difficulty + 추천 + 풀이 상태.
export type SolveStatusFilter = "all" | "unsolved" | "inProgress" | "solved";
export type SolveState = "none" | "attempted" | "submitted";

export type ProblemFilter = {
  questionNo?: QuestionNo | null;
  difficulty?: number | null;
  topikLevel?: 1 | 2 | null;
  search?: string;
  /** True → 추천 리스트(recommendation_items.status='active')만. */
  recommended?: boolean;
  /** Phase 7-D Task 12 — 사용자별 풀이 상태 필터. */
  solveStatus?: SolveStatusFilter;
};

/** Phase 7-D Task 12 — 사용자 상태가 결합된 row 타입 (ProblemRow + per-user state). */
export type ProblemRowWithState = ProblemRow & {
  solveState: SolveState;
  recommended: boolean;
  /**
   * Phase 7-D Task 5 Round 2 fix — submitted 문제의 최신 writing_submissions.id.
   * RetryModal "결과 보기" → /writing/feedback/{short|long}/[submissionId].
   * null = unsubmitted 또는 데이터 없음 (폴백 라우트).
   */
  latestSubmissionId: string | null;
};

export type ProblemListParams = {
  filter: ProblemFilter;
  sort: ProblemSort;
  page: number;
  pageSize: number;
};
