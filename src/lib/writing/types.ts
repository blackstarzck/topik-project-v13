import type { Tables, TablesInsert } from "../supabase/types";

export type QuestionNo = 51 | 52 | 53 | 54;
export const QUESTION_NOS: readonly QuestionNo[] = [51, 52, 53, 54];

export function isQuestionNo(value: unknown): value is QuestionNo {
  return (
    typeof value === "number" &&
    (QUESTION_NOS as readonly number[]).includes(value)
  );
}

export function isShortAnswer(n: QuestionNo): boolean {
  return n === 51 || n === 52;
}

export function isLongForm(n: QuestionNo): boolean {
  return n === 53 || n === 54;
}

export type AutosaveStatus = Tables<"writing_drafts">["autosave_status"];
export type FeedbackStatus = Tables<"writing_submissions">["feedback_status"];
export type FeedbackOverallStatus = Tables<"writing_feedback">["status"];
export type FeedbackDimensionKey =
  Tables<"feedback_dimension_scores">["dimension"];

export const FEEDBACK_DIMENSIONS: readonly FeedbackDimensionKey[] = [
  "grammar",
  "vocab",
  "structure",
  "content",
  "expression",
  "topic_fit",
];

export type WritingDraftRow = Tables<"writing_drafts">;
export type WritingSubmissionRow = Tables<"writing_submissions">;
export type WritingFeedbackRow = Tables<"writing_feedback">;
export type FeedbackDimensionScoreRow = Tables<"feedback_dimension_scores">;
export type SentenceFeedbackRow = Tables<"sentence_feedback">;
export type ComparisonReportRow = Tables<"comparison_reports">;

export type WritingDraftInsert = TablesInsert<"writing_drafts">;

export type FeedbackBundle = {
  feedback: WritingFeedbackRow;
  dimensions: FeedbackDimensionScoreRow[];
  sentences: SentenceFeedbackRow[];
};

export function isFeedbackComplete(status: FeedbackStatus): boolean {
  return status === "complete" || status === "failed";
}
