export const WRITING_PROBLEM_NOT_SUBMITTABLE_MESSAGE =
  "problem_not_submittable";
export const WRITING_SUBMISSION_BLOCKED_MESSAGE =
  "writing_submission_temporarily_blocked";
export const WRITING_SUBMISSION_AMBIGUOUS_MESSAGE =
  "writing_submission_dispatch_ambiguous";
export const WRITING_SUBMISSION_DRAFT_REQUIRED_MESSAGE =
  "writing_submission_draft_required";
export const WRITING_SUBMISSION_RETRY_MESSAGE = "writing_submission_retryable";

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
  return WRITING_SUBMISSION_RETRY_MESSAGE;
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
