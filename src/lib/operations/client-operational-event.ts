export const CLIENT_OPERATIONAL_EVENT_CODES = [
  "unavailable_shown",
  "retry_requested",
  "recovery_cleanup_finished",
  "operation_failed",
] as const;

export const CLIENT_OPERATIONAL_EVENT_FEATURES = [
  "legal_terms",
  "legal_privacy",
  "landing_profile",
  "practice_problem_list",
  "library_resource",
  "client_recovery",
  "notification_inbox",
  "profile_settings",
  "pdf_export",
] as const;

export const CLIENT_OPERATIONAL_EVENT_OPERATIONS = [
  "load",
  "retry",
  "clear_for_logout",
  "clear_for_account_deletion",
  "save",
  "delete",
  "download",
  "mark_read",
  "mark_all_read",
] as const;

export const CLIENT_OPERATIONAL_EVENT_RESULTS = [
  "success",
  "failure",
  "skipped",
] as const;

export type ClientOperationalEventCode =
  (typeof CLIENT_OPERATIONAL_EVENT_CODES)[number];
export type ClientOperationalEventFeature =
  (typeof CLIENT_OPERATIONAL_EVENT_FEATURES)[number];
export type ClientOperationalEventOperation =
  (typeof CLIENT_OPERATIONAL_EVENT_OPERATIONS)[number];
export type ClientOperationalEventResult =
  (typeof CLIENT_OPERATIONAL_EVENT_RESULTS)[number];

export type ClientOperationalEvent = Readonly<{
  code: ClientOperationalEventCode;
  feature: ClientOperationalEventFeature;
  operation: ClientOperationalEventOperation;
  result: ClientOperationalEventResult;
  correlationId: string;
  latencyMs?: number;
  count?: number;
  retryCount?: number;
  appVersion?: string;
}>;

export type ClientOperationalEventDraft = Omit<
  ClientOperationalEvent,
  "correlationId"
>;

export type ClientOperationalEventValidationResult =
  | { ok: true; event: ClientOperationalEvent }
  | { ok: false; reason: "invalid_event" };

export type ClientOperationalEventCreationResult =
  | { ok: true; event: ClientOperationalEvent }
  | {
      ok: false;
      reason: "invalid_event" | "correlation_unavailable";
    };

export type ClientOperationalEventEmissionResult =
  | { ok: true; status: "emitted" | "skipped" }
  | {
      ok: false;
      status: "rejected" | "failed";
      reason: "invalid_event" | "sink_failed";
    };

export type ClientOperationalEventSink = (
  event: ClientOperationalEvent,
) => void | Promise<void>;

const CODE_SET = new Set<string>(CLIENT_OPERATIONAL_EVENT_CODES);
const FEATURE_SET = new Set<string>(CLIENT_OPERATIONAL_EVENT_FEATURES);
const OPERATION_SET = new Set<string>(CLIENT_OPERATIONAL_EVENT_OPERATIONS);
const RESULT_SET = new Set<string>(CLIENT_OPERATIONAL_EVENT_RESULTS);

const EVENT_KEYS = new Set<PropertyKey>([
  "code",
  "feature",
  "operation",
  "result",
  "correlationId",
  "latencyMs",
  "count",
  "retryCount",
  "appVersion",
]);
const DRAFT_KEYS = new Set<PropertyKey>([
  "code",
  "feature",
  "operation",
  "result",
  "latencyMs",
  "count",
  "retryCount",
  "appVersion",
]);

const CORRELATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const APP_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/;
const JWT_PATTERN =
  /^eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}$/i;
const BLOCKED_APP_VERSION_TOKEN =
  /(?:^|[^a-z0-9])(?:answer|body|email|token|bearer|jwt|oauth|code[_-]?challenge|sql|database|error|exception|stack|select|insert|update|delete|drop|alter|create|grant|revoke|union|from|where|postgres|supabase)(?:$|[^a-z0-9])/i;

const MAX_LATENCY_MS = 86_400_000;
const MAX_COUNT = 1_000_000;
const MAX_RETRY_COUNT = 100;

export function sanitizeClientOperationalAppVersion(
  value: unknown,
): string | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  if (!APP_VERSION_PATTERN.test(normalized)) return null;
  if (JWT_PATTERN.test(normalized)) return null;
  if (BLOCKED_APP_VERSION_TOKEN.test(normalized)) return null;
  return normalized;
}

export function validateClientOperationalEvent(
  input: unknown,
): ClientOperationalEventValidationResult {
  try {
    if (!isPlainRecord(input) || !hasOnlyKeys(input, EVENT_KEYS)) {
      return invalidEvent();
    }

    if (
      !isAllowlistedString(input.code, CODE_SET) ||
      !isAllowlistedString(input.feature, FEATURE_SET) ||
      !isAllowlistedString(input.operation, OPERATION_SET) ||
      !isAllowlistedString(input.result, RESULT_SET) ||
      !isCorrelationId(input.correlationId) ||
      !isOptionalBoundedInteger(input.latencyMs, MAX_LATENCY_MS) ||
      !isOptionalBoundedInteger(input.count, MAX_COUNT) ||
      !isOptionalBoundedInteger(input.retryCount, MAX_RETRY_COUNT) ||
      !isCanonicalOptionalAppVersion(input.appVersion)
    ) {
      return invalidEvent();
    }

    const event: ClientOperationalEvent = Object.freeze({
      code: input.code as ClientOperationalEventCode,
      feature: input.feature as ClientOperationalEventFeature,
      operation: input.operation as ClientOperationalEventOperation,
      result: input.result as ClientOperationalEventResult,
      correlationId: input.correlationId as string,
      ...(input.latencyMs !== undefined
        ? { latencyMs: input.latencyMs as number }
        : {}),
      ...(input.count !== undefined ? { count: input.count as number } : {}),
      ...(input.retryCount !== undefined
        ? { retryCount: input.retryCount as number }
        : {}),
      ...(input.appVersion !== undefined
        ? { appVersion: input.appVersion as string }
        : {}),
    });

    return { ok: true, event };
  } catch {
    return invalidEvent();
  }
}

export function createClientOperationalEvent(
  draft: ClientOperationalEventDraft,
): ClientOperationalEventCreationResult {
  try {
    if (!isPlainRecord(draft) || !hasOnlyKeys(draft, DRAFT_KEYS)) {
      return invalidEvent();
    }

    const appVersion =
      draft.appVersion === undefined
        ? undefined
        : sanitizeClientOperationalAppVersion(draft.appVersion);
    if (draft.appVersion !== undefined && appVersion === null) {
      return invalidEvent();
    }

    const correlationId = createCorrelationId();
    if (!correlationId) {
      return { ok: false, reason: "correlation_unavailable" };
    }

    return validateClientOperationalEvent({
      code: draft.code,
      feature: draft.feature,
      operation: draft.operation,
      result: draft.result,
      correlationId,
      ...(draft.latencyMs !== undefined ? { latencyMs: draft.latencyMs } : {}),
      ...(draft.count !== undefined ? { count: draft.count } : {}),
      ...(draft.retryCount !== undefined
        ? { retryCount: draft.retryCount }
        : {}),
      ...(appVersion !== undefined && appVersion !== null
        ? { appVersion }
        : {}),
    });
  } catch {
    return invalidEvent();
  }
}

export async function emitClientOperationalEvent(
  event: ClientOperationalEvent,
  sink?: ClientOperationalEventSink,
): Promise<ClientOperationalEventEmissionResult> {
  const validation = validateClientOperationalEvent(event);
  if (!validation.ok) {
    return {
      ok: false,
      status: "rejected",
      reason: "invalid_event",
    };
  }

  try {
    await (sink ?? deliverClientOperationalEvent)(validation.event);
    return { ok: true, status: "emitted" };
  } catch {
    return {
      ok: false,
      status: "failed",
      reason: "sink_failed",
    };
  }
}

async function deliverClientOperationalEvent(event: ClientOperationalEvent) {
  const response = await fetch("/api/internal/client-operational-events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
    credentials: "same-origin",
    cache: "no-store",
    keepalive: true,
  });
  if (!response.ok) throw new Error("client_operational_event_delivery_failed");
}

function invalidEvent(): { ok: false; reason: "invalid_event" } {
  return { ok: false, reason: "invalid_event" };
}

function isPlainRecord(value: unknown): value is Record<PropertyKey, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(
  value: Record<PropertyKey, unknown>,
  allowedKeys: ReadonlySet<PropertyKey>,
): boolean {
  return Reflect.ownKeys(value).every((key) => allowedKeys.has(key));
}

function isAllowlistedString(
  value: unknown,
  allowedValues: ReadonlySet<string>,
): value is string {
  return typeof value === "string" && allowedValues.has(value);
}

function isCorrelationId(value: unknown): value is string {
  return typeof value === "string" && CORRELATION_ID_PATTERN.test(value);
}

function isOptionalBoundedInteger(value: unknown, maximum: number): boolean {
  return (
    value === undefined ||
    (typeof value === "number" &&
      Number.isFinite(value) &&
      Number.isInteger(value) &&
      value >= 0 &&
      value <= maximum)
  );
}

function isCanonicalOptionalAppVersion(value: unknown): boolean {
  if (value === undefined) return true;
  const sanitized = sanitizeClientOperationalAppVersion(value);
  return sanitized !== null && sanitized === value;
}

function createCorrelationId(): string | null {
  try {
    const value = globalThis.crypto?.randomUUID?.();
    return isCorrelationId(value) ? value : null;
  } catch {
    return null;
  }
}
