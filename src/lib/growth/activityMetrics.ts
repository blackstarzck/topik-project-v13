type CountInput = number | null | undefined;

function toSafeCount(value: CountInput): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

export function mergeAttemptCounts({
  problemAttemptCount,
  studyEventCount,
}: {
  problemAttemptCount: CountInput;
  studyEventCount: CountInput;
}): number {
  return Math.max(toSafeCount(problemAttemptCount), toSafeCount(studyEventCount));
}
