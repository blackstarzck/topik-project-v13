export const WRITING_PROBLEM_NOT_SUBMITTABLE_MESSAGE =
  "현재 제출할 수 없는 문제입니다. 다른 문제를 선택해 주세요.";

export type SubmitWritingErrorKind = "retryable" | "problem_unavailable";

export function toSubmitWritingErrorMessage(message: string) {
  if (message.includes("problem_not_submittable")) {
    return WRITING_PROBLEM_NOT_SUBMITTABLE_MESSAGE;
  }
  return `submitWriting failed: ${message}`;
}

export function classifySubmitWritingError(
  message: string | null | undefined,
): SubmitWritingErrorKind {
  return message === WRITING_PROBLEM_NOT_SUBMITTABLE_MESSAGE
    ? "problem_unavailable"
    : "retryable";
}
