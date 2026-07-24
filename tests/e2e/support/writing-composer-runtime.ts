export type WritingComposerQuestionNo = 51 | 52 | 53 | 54;

export type WritingComposerRuntimeOrigins = {
  appOrigin: string;
  supabaseOrigin: string;
};

export type SupabaseRestRequestClassification =
  | "continue"
  | "fulfill-expected-analytics"
  | "block-unexpected-mutation";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const AVAILABLE_WRITING_QUESTIONS_RPC_PATH =
  "/rest/v1/rpc/get_available_writing_questions";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function parseOrigin(value: string): string | null {
  return parseUrl(value)?.origin ?? null;
}

export function selectCanonicalProblemId(
  rows: unknown,
  questionNo: WritingComposerQuestionNo,
): string {
  const row = Array.isArray(rows)
    ? rows.find(
        (candidate) =>
          isRecord(candidate) && candidate.item_number === questionNo,
      )
    : undefined;

  if (!isRecord(row)) {
    throw new Error(`Canonical Q${questionNo} writing sample is missing.`);
  }

  if (typeof row.problem_id !== "string" || row.problem_id.trim() === "") {
    throw new Error(
      `Canonical Q${questionNo} writing sample is missing problem_id.`,
    );
  }

  const problemId = row.problem_id.trim();
  if (!UUID_PATTERN.test(problemId)) {
    throw new Error(
      `Canonical Q${questionNo} writing sample problem_id must be a UUID.`,
    );
  }

  return problemId;
}

export function isTrackedRuntimeUrl(
  url: string,
  origins: WritingComposerRuntimeOrigins,
): boolean {
  const requestOrigin = parseOrigin(url);
  const appOrigin = parseOrigin(origins.appOrigin);
  const supabaseOrigin = parseOrigin(origins.supabaseOrigin);

  return (
    requestOrigin !== null &&
    (requestOrigin === appOrigin || requestOrigin === supabaseOrigin)
  );
}

export function isUnexpectedTrackedResponse(
  url: string,
  status: number,
  origins: WritingComposerRuntimeOrigins,
): boolean {
  return status >= 400 && isTrackedRuntimeUrl(url, origins);
}

export function shouldCollectRuntimeConsoleError(
  locationUrl: string,
  origins: WritingComposerRuntimeOrigins,
): boolean {
  return locationUrl.trim() === "" || isTrackedRuntimeUrl(locationUrl, origins);
}

export function classifySupabaseRestRequest(
  url: string,
  method: string,
  supabaseOrigin: string,
): SupabaseRestRequestClassification {
  const requestUrl = parseUrl(url);
  const configuredOrigin = parseOrigin(supabaseOrigin);
  if (
    !requestUrl ||
    requestUrl.origin !== configuredOrigin ||
    !requestUrl.pathname.startsWith("/rest/v1/")
  ) {
    return "continue";
  }

  const normalizedMethod = method.toUpperCase();
  if (READ_METHODS.has(normalizedMethod)) {
    return "continue";
  }
  if (
    normalizedMethod === "POST" &&
    requestUrl.pathname === AVAILABLE_WRITING_QUESTIONS_RPC_PATH
  ) {
    return "continue";
  }
  if (
    normalizedMethod === "POST" &&
    requestUrl.pathname === "/rest/v1/study_events"
  ) {
    return "fulfill-expected-analytics";
  }

  return "block-unexpected-mutation";
}

export function hasTrackedRequestsSettled(
  pendingRequestCount: number,
  lastActivityAt: number,
  now: number,
  quietWindowMs = 300,
): boolean {
  return pendingRequestCount === 0 && now - lastActivityAt >= quietWindowMs;
}
