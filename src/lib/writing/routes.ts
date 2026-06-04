import { isQuestionNo } from "./types";

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
  return `/writing/${questionNo}?problem=${encodeURIComponent(problemId)}${freshParam}`;
}
