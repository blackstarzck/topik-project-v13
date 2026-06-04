import { isQuestionNo, type QuestionNo } from "./types";

export const WRITING_ROUTE_SEGMENTS: Record<QuestionNo, string> = {
  51: "short-answer-writing-51",
  52: "answer-writing-52",
  53: "long-form-writing-53",
  54: "essay-writing-54",
};

export function writingQuestionHref(
  questionNo: number | null | undefined,
): string {
  if (!isQuestionNo(questionNo)) {
    return "/practice/problems";
  }

  return `/writing/${WRITING_ROUTE_SEGMENTS[questionNo]}`;
}

export function writingProblemHref({
  questionNo,
  problemId,
  fresh = false,
}: {
  questionNo: number | null | undefined;
  problemId: string | null | undefined;
  fresh?: boolean;
}): string {
  if (!isQuestionNo(questionNo) || !problemId) {
    return "/practice/problems";
  }

  const freshParam = fresh ? "&fresh=1" : "";
  return `${writingQuestionHref(questionNo)}?problem=${encodeURIComponent(problemId)}${freshParam}`;
}
