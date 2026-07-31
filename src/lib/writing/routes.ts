import {
  APP_ROUTES,
  WRITING_ROUTE_PATHS_BY_QUESTION,
  WRITING_ROUTE_SEGMENTS_BY_QUESTION,
} from "@/lib/routes";
import { resolveSafeInternalReturnTo } from "@/lib/navigation/return-to";
import { isQuestionNo, type QuestionNo } from "./types";

export const WRITING_ROUTE_SEGMENTS: Record<QuestionNo, string> =
  WRITING_ROUTE_SEGMENTS_BY_QUESTION;

export const WRITING_RETURN_FALLBACK = APP_ROUTES.practiceProblems;

const WRITING_STATIC_RETURN_PATHS = new Set<string>([
  APP_ROUTES.dashboard,
  APP_ROUTES.practiceRecommendations,
  APP_ROUTES.practiceProblems,
  APP_ROUTES.practiceNext,
  APP_ROUTES.practiceWeakness,
  APP_ROUTES.library,
  APP_ROUTES.libraryProblems,
]);

function isAllowedWritingReturnPath(pathname: string): boolean {
  return (
    WRITING_STATIC_RETURN_PATHS.has(pathname) ||
    /^\/writing\/feedback\/(short|long)\/[^/]+$/.test(pathname) ||
    /^\/writing\/reports\/[^/]+\/compare$/.test(pathname)
  );
}

function writingReturnPathname(value: string): string {
  return value.split(/[?#]/, 1)[0] ?? value;
}

function isDynamicWritingReturnPath(pathname: string): boolean {
  return (
    /^\/writing\/feedback\/(short|long)\/[^/]+$/.test(pathname) ||
    /^\/writing\/reports\/[^/]+\/compare$/.test(pathname)
  );
}

export function resolveWritingReturnTo(
  value: string | string[] | null | undefined,
  {
    allowedDynamicPathnames,
  }: { allowedDynamicPathnames?: readonly string[] } = {},
): string {
  const resolved = resolveSafeInternalReturnTo(value, {
    fallback: WRITING_RETURN_FALLBACK,
    isAllowedPathname: isAllowedWritingReturnPath,
  });
  const pathname = writingReturnPathname(resolved);

  if (
    allowedDynamicPathnames &&
    isDynamicWritingReturnPath(pathname) &&
    !allowedDynamicPathnames.includes(pathname)
  ) {
    return WRITING_RETURN_FALLBACK;
  }

  return resolved;
}

export function getWritingComparisonReturnReportId(
  value: string | string[] | null | undefined,
): string | null {
  if (typeof value !== "string" || value.includes("%")) return null;
  const pathname = writingReturnPathname(value);
  return /^\/writing\/reports\/([^/?#]+)\/compare$/.exec(pathname)?.[1] ?? null;
}

export function getWritingFeedbackReturnSubmissionId(
  value: string | string[] | null | undefined,
): string | null {
  if (typeof value !== "string" || value.includes("%")) return null;
  const pathname = writingReturnPathname(value);
  return (
    /^\/writing\/feedback\/(?:short|long)\/([^/?#]+)$/.exec(pathname)?.[1] ??
    null
  );
}

function writingReturnToParam(value: string | null | undefined): string | null {
  if (!value) return null;
  const resolved = resolveWritingReturnTo(value);
  return resolved === WRITING_RETURN_FALLBACK ? null : resolved;
}

export function writingQuestionHref(
  questionNo: number | null | undefined,
  options: { returnTo?: string | null } = {},
): string {
  if (!isQuestionNo(questionNo)) {
    return APP_ROUTES.practiceProblems;
  }

  const returnTo = writingReturnToParam(options.returnTo);
  if (!returnTo) return WRITING_ROUTE_PATHS_BY_QUESTION[questionNo];

  const searchParams = new URLSearchParams({ returnTo });
  return `${WRITING_ROUTE_PATHS_BY_QUESTION[questionNo]}?${searchParams.toString()}`;
}

export function writingProblemHref({
  questionNo,
  problemId,
  fresh = false,
  hint = false,
  retrySubmissionId,
  returnTo,
}: {
  questionNo: number | null | undefined;
  problemId: string | null | undefined;
  fresh?: boolean;
  hint?: boolean;
  retrySubmissionId?: string | null;
  returnTo?: string | null;
}): string {
  if (!isQuestionNo(questionNo) || !problemId) {
    return APP_ROUTES.practiceProblems;
  }

  const searchParams = new URLSearchParams({ problem: problemId });
  if (fresh) searchParams.set("fresh", "1");
  if (hint) searchParams.set("hint", "1");
  if (retrySubmissionId) {
    searchParams.set("retrySubmission", retrySubmissionId);
  }
  const resolvedReturnTo = writingReturnToParam(returnTo);
  if (resolvedReturnTo) searchParams.set("returnTo", resolvedReturnTo);

  return `${writingQuestionHref(questionNo)}?${searchParams.toString()}`;
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
