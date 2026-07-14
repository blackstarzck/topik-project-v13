export const GOOGLE_ANALYTICS_EVENT_NAMES = [
  "practice_started",
  "answer_submitted",
  "feedback_viewed",
  "comparison_report_viewed",
  "recommended_problem_clicked",
  "button_clicked",
  "api_request_finished",
] as const;

export type GoogleAnalyticsEventName =
  (typeof GOOGLE_ANALYTICS_EVENT_NAMES)[number];

export type GoogleAnalyticsParamValue = string | number | boolean | null;
export type GoogleAnalyticsUnsafeParams = Record<string, unknown>;
export type GoogleAnalyticsParams = Record<
  string,
  GoogleAnalyticsParamValue | undefined
>;

type Gtag = (
  command: "event",
  eventName: GoogleAnalyticsEventName,
  params?: GoogleAnalyticsParams,
) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

type StudyEventInput = {
  eventType: string;
  problemId?: string;
  submissionId?: string;
  attemptId?: string;
  sessionId?: string;
  payload?: GoogleAnalyticsUnsafeParams;
};

type ButtonClickInput = {
  buttonId: string;
  surface: string;
  questionNo?: number | null;
  problemId?: string | null;
};

type ApiRequestStatus = "success" | "error" | "network_error";

type ApiRequestResultInput = {
  apiName: string;
  status: ApiRequestStatus;
  statusCode?: number;
  durationMs?: number;
};

type FetchAnalyticsOptions = {
  apiName: string;
  fetchImpl?: typeof fetch;
};

const GA_EVENT_NAME_SET = new Set<string>(GOOGLE_ANALYTICS_EVENT_NAMES);
const GA_EVENT_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
const GA_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/i;
const MAX_PARAM_STRING_CHARS = 200;

const BLOCKED_PARAM_KEYS = new Set<string>([
  "answer",
  "answer_text",
  "attempt_id",
  "comment",
  "content",
  "corrected_text",
  "draft",
  "draft_text",
  "email",
  "first_name",
  "full_name",
  "last_name",
  "name",
  "narrative",
  "overall_summary",
  "phone",
  "phone_country_code",
  "phone_number",
  "report_id",
  "session_id",
  "sessionid",
  "submission_id",
  "summary",
  "text",
  "uid",
  "user_id",
  "userid",
]);

const BLOCKED_PARAM_PREFIXES = ["_", "firebase_", "ga_", "google_", "gtag."];

const STUDY_EVENT_TO_GA_EVENT: Record<string, GoogleAnalyticsEventName | null> =
  {
    practice_started: "practice_started",
    attempt_submitted: "answer_submitted",
    draft_autosaved: null,
    submission_submitted: "answer_submitted",
    feedback_viewed: "feedback_viewed",
    report_viewed: "comparison_report_viewed",
    recommendation_clicked: "recommended_problem_clicked",
    export_downloaded: null,
  };

export function normalizeGoogleAnalyticsMeasurementId(
  measurementId: string | undefined,
): string | null {
  const value = measurementId?.trim();
  if (!value) return null;
  return GA_MEASUREMENT_ID_PATTERN.test(value) ? value : null;
}

export function getGoogleAnalyticsMeasurementId(): string | null {
  return normalizeGoogleAnalyticsMeasurementId(
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  );
}

export function sanitizeGoogleAnalyticsParams(
  params: GoogleAnalyticsUnsafeParams | undefined,
): GoogleAnalyticsParams {
  if (!params) return {};

  const safe: GoogleAnalyticsParams = {};
  for (const [key, value] of Object.entries(params)) {
    const normalizedKey = key.toLowerCase();
    if (BLOCKED_PARAM_KEYS.has(normalizedKey)) continue;
    if (
      BLOCKED_PARAM_PREFIXES.some((prefix) => normalizedKey.startsWith(prefix))
    )
      continue;
    if (value === undefined) continue;
    if (value === null || typeof value === "boolean") {
      safe[key] = value;
      continue;
    }
    if (typeof value === "number") {
      if (Number.isFinite(value)) safe[key] = value;
      continue;
    }
    if (typeof value === "string") {
      if (value.length <= MAX_PARAM_STRING_CHARS) safe[key] = value;
      continue;
    }
  }
  return safe;
}

export function trackGoogleAnalyticsEvent(
  eventName: GoogleAnalyticsEventName,
  params?: GoogleAnalyticsUnsafeParams,
): void {
  if (!isValidEventName(eventName)) {
    const message = `invalid GA event name: ${eventName}`;
    if (isStrictRuntime()) throw new Error(message);
    console.warn(message);
    return;
  }

  if (!getGoogleAnalyticsMeasurementId()) return;
  const gtag = getBrowserGtag();
  if (!gtag) return;

  gtag("event", eventName, sanitizeGoogleAnalyticsParams(params));
}

export function trackStudyEventInGoogleAnalytics(input: StudyEventInput): void {
  const eventName = STUDY_EVENT_TO_GA_EVENT[input.eventType];
  if (!eventName) return;

  trackGoogleAnalyticsEvent(eventName, {
    problem_id: input.problemId,
    ...(input.payload ?? {}),
  });
}

export function trackButtonClick(input: ButtonClickInput): void {
  trackGoogleAnalyticsEvent("button_clicked", {
    button_id: input.buttonId,
    surface: input.surface,
    question_no: input.questionNo ?? undefined,
    problem_id: input.problemId ?? undefined,
  });
}

export function trackApiRequestResult(input: ApiRequestResultInput): void {
  trackGoogleAnalyticsEvent("api_request_finished", {
    api_name: input.apiName,
    api_status: input.status,
    http_status: input.statusCode,
    duration_ms:
      typeof input.durationMs === "number"
        ? Math.max(0, Math.round(input.durationMs))
        : undefined,
  });
}

export async function fetchWithGoogleAnalytics(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  options: FetchAnalyticsOptions,
): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const startedAt = now();

  try {
    const response = await fetchImpl(input, init);
    trackApiRequestResult({
      apiName: options.apiName,
      status: response.ok ? "success" : "error",
      statusCode: response.status,
      durationMs: now() - startedAt,
    });
    return response;
  } catch (error) {
    trackApiRequestResult({
      apiName: options.apiName,
      status: "network_error",
      durationMs: now() - startedAt,
    });
    throw error;
  }
}

function isValidEventName(eventName: string): boolean {
  return (
    GA_EVENT_NAME_PATTERN.test(eventName) && GA_EVENT_NAME_SET.has(eventName)
  );
}

function getBrowserGtag(): Gtag | null {
  if (typeof window === "undefined") return null;
  return typeof window.gtag === "function" ? window.gtag : null;
}

function isStrictRuntime(): boolean {
  return process.env.NODE_ENV !== "production";
}

function now(): number {
  if (
    typeof performance !== "undefined" &&
    typeof performance.now === "function"
  ) {
    return performance.now();
  }
  return Date.now();
}
