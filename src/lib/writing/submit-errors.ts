export const WRITING_PROBLEM_NOT_SUBMITTABLE_MESSAGE =
  "현재 제출할 수 없는 문제입니다. 다른 문제를 선택해 주세요.";
export const WRITING_SUBMISSION_BLOCKED_MESSAGE =
  "현재 시스템 전환 점검 중이라 작문을 제출할 수 없습니다. 작성한 답안은 임시저장되며, 제출이 재개된 뒤 다시 시도해 주세요.";
export const WRITING_SUBMISSION_AMBIGUOUS_MESSAGE =
  "제출 요청이 외부 채점 시스템에 전달됐는지 확인 중입니다. 중복 제출을 막기 위해 자동 재시도하지 않습니다. 잠시 후 제출 기록을 확인해 주세요.";
export const WRITING_SUBMISSION_DRAFT_REQUIRED_MESSAGE =
  "제출 전에 답안을 임시저장해야 합니다. 임시저장이 완료된 뒤 다시 제출해 주세요.";

export type SubmitWritingErrorKind =
  | "retryable"
  | "problem_unavailable"
  | "submission_blocked"
  | "submission_ambiguous";

export function toSubmitWritingErrorMessage(message: string) {
  if (
    [
      WRITING_PROBLEM_NOT_SUBMITTABLE_MESSAGE,
      WRITING_SUBMISSION_BLOCKED_MESSAGE,
      WRITING_SUBMISSION_AMBIGUOUS_MESSAGE,
      WRITING_SUBMISSION_DRAFT_REQUIRED_MESSAGE,
    ].includes(message)
  ) {
    return message;
  }
  if (message.includes("problem_not_submittable")) {
    return WRITING_PROBLEM_NOT_SUBMITTABLE_MESSAGE;
  }
  if (message.includes("writing_submission_temporarily_blocked")) {
    return WRITING_SUBMISSION_BLOCKED_MESSAGE;
  }
  if (message.includes("writing_submission_dispatch_ambiguous")) {
    return WRITING_SUBMISSION_AMBIGUOUS_MESSAGE;
  }
  if (message.includes("writing_submission_draft_required")) {
    return WRITING_SUBMISSION_DRAFT_REQUIRED_MESSAGE;
  }
  return `submitWriting failed: ${message}`;
}

export function classifySubmitWritingError(
  message: string | null | undefined,
): SubmitWritingErrorKind {
  if (message === WRITING_PROBLEM_NOT_SUBMITTABLE_MESSAGE) {
    return "problem_unavailable";
  }
  if (message === WRITING_SUBMISSION_BLOCKED_MESSAGE) {
    return "submission_blocked";
  }
  if (message === WRITING_SUBMISSION_AMBIGUOUS_MESSAGE) {
    return "submission_ambiguous";
  }
  return "retryable";
}
