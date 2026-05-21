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

export type ProblemFilter = {
  questionNo?: QuestionNo | null;
  difficulty?: number | null;
  topikLevel?: 1 | 2 | null;
  search?: string;
};

export type ProblemListParams = {
  filter: ProblemFilter;
  sort: ProblemSort;
  page: number;
  pageSize: number;
};
