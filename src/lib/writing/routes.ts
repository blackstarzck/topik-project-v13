import {
  APP_ROUTES,
  WRITING_ROUTE_PATHS_BY_QUESTION,
  WRITING_ROUTE_SEGMENTS_BY_QUESTION,
} from "@/lib/routes";
import { isQuestionNo, type QuestionNo } from "./types";

export const WRITING_ROUTE_SEGMENTS: Record<QuestionNo, string> =
  WRITING_ROUTE_SEGMENTS_BY_QUESTION;

export function writingQuestionHref(
  questionNo: number | null | undefined,
): string {
  if (!isQuestionNo(questionNo)) {
    return APP_ROUTES.practiceProblems;
  }

  return WRITING_ROUTE_PATHS_BY_QUESTION[questionNo];
}

export function writingProblemHref({
  questionNo,
  problemId,
  fresh = false,
  hint = false,
  retrySubmissionId,
}: {
  questionNo: number | null | undefined;
  problemId: string | null | undefined;
  fresh?: boolean;
  hint?: boolean;
  retrySubmissionId?: string | null;
}): string {
  if (!isQuestionNo(questionNo) || !problemId) {
    return APP_ROUTES.practiceProblems;
  }

  const freshParam = fresh ? "&fresh=1" : "";
  const hintParam = hint ? "&hint=1" : "";
  const retryParam = retrySubmissionId
    ? `&retrySubmission=${encodeURIComponent(retrySubmissionId)}`
    : "";
  return `${writingQuestionHref(questionNo)}?problem=${encodeURIComponent(problemId)}${freshParam}${hintParam}${retryParam}`;
}

export function writingFeedbackHref({
  questionNo,
  submissionId,
}: {
  questionNo: number | null | undefined;
  submissionId: string;
}): string {
  if (!submissionId) {
    return APP_ROUTES.library;
  }

  const feedbackKind =
    isQuestionNo(questionNo) && questionNo <= 52 ? "short" : "long";
  return `/writing/feedback/${feedbackKind}/${encodeURIComponent(submissionId)}`;
}
