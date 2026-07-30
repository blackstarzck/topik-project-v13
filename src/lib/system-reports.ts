import { LOCALES } from "@/i18n/locales";

export const SYSTEM_REPORT_MAX_BODY_BYTES = 16 * 1024;
export const SYSTEM_REPORT_MAX_EMAIL_LENGTH = 254;
export const SYSTEM_REPORT_MAX_TITLE_LENGTH = 120;
export const SYSTEM_REPORT_MAX_MESSAGE_LENGTH = 4000;

export const SYSTEM_REPORT_CATEGORIES = [
  "bug",
  "question",
  "suggestion",
] as const;
export const SYSTEM_REPORT_BROWSERS = [
  "chrome",
  "safari",
  "firefox",
  "edge",
  "other",
] as const;
export const SYSTEM_REPORT_OPERATING_SYSTEMS = [
  "windows",
  "macos",
  "ios",
  "android",
  "linux",
  "other",
] as const;
export const SYSTEM_REPORT_DEVICE_TYPES = [
  "desktop",
  "tablet",
  "mobile",
  "unknown",
] as const;
export const SYSTEM_REPORT_LOCALES = LOCALES;

export type SystemReportCategory = (typeof SYSTEM_REPORT_CATEGORIES)[number];
export type SystemReportBrowser = (typeof SYSTEM_REPORT_BROWSERS)[number];
export type SystemReportOperatingSystem =
  (typeof SYSTEM_REPORT_OPERATING_SYSTEMS)[number];
export type SystemReportDeviceType =
  (typeof SYSTEM_REPORT_DEVICE_TYPES)[number];
export type SystemReportLocale = (typeof SYSTEM_REPORT_LOCALES)[number];

export type SystemReportDiagnostics = {
  pathname: string;
  browser: SystemReportBrowser;
  os: SystemReportOperatingSystem;
  deviceType: SystemReportDeviceType;
  viewportWidth: number;
  viewportHeight: number;
  locale: SystemReportLocale;
};

export type SystemReportRequest = {
  category: SystemReportCategory;
  email: string;
  title: string;
  message: string;
  context: SystemReportDiagnostics;
};

export type SystemReportResponse = {
  referenceCode: string;
  createdAt: string;
};

export type SystemReportValidationResult =
  | { ok: true; value: SystemReportRequest }
  | { ok: false };

export type SystemReportBodyParseResult =
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413 };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POSTGRES_INTEGER_MAX = 2_147_483_647;

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  const ownKeys = Reflect.ownKeys(value);
  return (
    ownKeys.length === allowedKeys.length &&
    ownKeys.every(
      (key) => typeof key === "string" && allowedKeys.includes(key),
    ) &&
    allowedKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

function isOneOf<T extends string>(
  value: unknown,
  options: readonly T[],
): value is T {
  return typeof value === "string" && options.includes(value as T);
}

function isViewportDimension(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= POSTGRES_INTEGER_MAX
  );
}

export function isSystemReportIdempotencyKey(value: string | null): boolean {
  return value != null && UUID_PATTERN.test(value);
}

export function validateSystemReportRequest(
  input: unknown,
): SystemReportValidationResult {
  if (
    !isRecord(input) ||
    !hasExactKeys(input, [
      "category",
      "email",
      "title",
      "message",
      "context",
    ]) ||
    !isOneOf(input.category, SYSTEM_REPORT_CATEGORIES) ||
    typeof input.email !== "string" ||
    typeof input.title !== "string" ||
    typeof input.message !== "string" ||
    !isRecord(input.context) ||
    !hasExactKeys(input.context, [
      "pathname",
      "browser",
      "os",
      "deviceType",
      "viewportWidth",
      "viewportHeight",
      "locale",
    ])
  ) {
    return { ok: false };
  }

  const email = input.email.trim();
  const title = input.title.trim();
  const message = input.message.trim();
  const context = input.context;

  if (
    email.length > SYSTEM_REPORT_MAX_EMAIL_LENGTH ||
    title.length > SYSTEM_REPORT_MAX_TITLE_LENGTH ||
    message.length > SYSTEM_REPORT_MAX_MESSAGE_LENGTH ||
    !EMAIL_PATTERN.test(email) ||
    title.length === 0 ||
    message.length === 0 ||
    typeof context.pathname !== "string" ||
    !context.pathname.startsWith("/") ||
    context.pathname.includes("?") ||
    context.pathname.includes("#") ||
    !isOneOf(context.browser, SYSTEM_REPORT_BROWSERS) ||
    !isOneOf(context.os, SYSTEM_REPORT_OPERATING_SYSTEMS) ||
    !isOneOf(context.deviceType, SYSTEM_REPORT_DEVICE_TYPES) ||
    !isViewportDimension(context.viewportWidth) ||
    !isViewportDimension(context.viewportHeight) ||
    !isOneOf(context.locale, SYSTEM_REPORT_LOCALES)
  ) {
    return { ok: false };
  }

  return {
    ok: true,
    value: {
      category: input.category,
      email,
      title,
      message,
      context: {
        pathname: context.pathname,
        browser: context.browser,
        os: context.os,
        deviceType: context.deviceType,
        viewportWidth: context.viewportWidth,
        viewportHeight: context.viewportHeight,
        locale: context.locale,
      },
    },
  };
}

export async function parseSystemReportRequestBody(
  request: Request,
): Promise<SystemReportBodyParseResult> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength != null) {
    if (!/^\d+$/.test(declaredLength)) return { ok: false, status: 400 };
    if (Number(declaredLength) > SYSTEM_REPORT_MAX_BODY_BYTES) {
      return { ok: false, status: 413 };
    }
  }

  if (!request.body) return { ok: false, status: 400 };

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let body = "";
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      byteLength += value.byteLength;
      if (byteLength > SYSTEM_REPORT_MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, status: 413 };
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
  } catch {
    return { ok: false, status: 400 };
  }

  try {
    return { ok: true, value: JSON.parse(body) as unknown };
  } catch {
    return { ok: false, status: 400 };
  }
}

export function isSameOriginSystemReportRequest(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") !== "same-origin") return false;

  const origin = request.headers.get("origin");
  if (!origin) return false;

  // `Host` is the authority the browser actually addressed, and is the only
  // trustworthy comparison target here. `request.url` must NOT be used: the
  // Next server pins its hostname to the server's own origin and ignores
  // `Host`, so comparing against it rejected genuinely same-origin submissions
  // from every other hostname — 127.0.0.1 or a LAN IP in development, and any
  // proxied host in production. `x-forwarded-*` stays ignored so a forwarded
  // header still cannot widen the accepted origin.
  const host = request.headers.get("host");
  if (!host) return false;

  try {
    // Scheme is intentionally not compared: `Host` carries none. A scheme
    // change is a different origin, so the `same-origin` Sec-Fetch-Site
    // requirement above already rejects it.
    return new URL(origin).host === host.trim().toLowerCase();
  } catch {
    return false;
  }
}
