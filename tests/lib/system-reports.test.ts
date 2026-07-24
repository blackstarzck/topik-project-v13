import { describe, expect, it } from "vitest";

import {
  SYSTEM_REPORT_MAX_BODY_BYTES,
  SYSTEM_REPORT_MAX_EMAIL_LENGTH,
  SYSTEM_REPORT_MAX_MESSAGE_LENGTH,
  SYSTEM_REPORT_MAX_TITLE_LENGTH,
  isSameOriginSystemReportRequest,
  parseSystemReportRequestBody,
  validateSystemReportRequest,
} from "@/lib/system-reports";

const validReport = {
  category: "bug",
  email: "learner@example.com",
  title: "Dashboard does not load",
  message: "The dashboard remains blank after I sign in.",
  context: {
    pathname: "/dashboard",
    browser: "chrome",
    os: "windows",
    deviceType: "desktop",
    viewportWidth: 1440,
    viewportHeight: 900,
    locale: "ko",
  },
} as const;

describe("system report validation", () => {
  it("accepts and normalizes the approved report and diagnostics fields", () => {
    const result = validateSystemReportRequest({
      ...validReport,
      email: " learner@example.com ",
      title: " Dashboard does not load ",
      message: " The dashboard remains blank after I sign in. ",
    });

    expect(result).toEqual({
      ok: true,
      value: validReport,
    });
  });

  it("applies field length limits after trimming surrounding whitespace", () => {
    const email = `${"a".repeat(
      SYSTEM_REPORT_MAX_EMAIL_LENGTH - "@example.com".length,
    )}@example.com`;
    const title = "t".repeat(SYSTEM_REPORT_MAX_TITLE_LENGTH);
    const message = "m".repeat(SYSTEM_REPORT_MAX_MESSAGE_LENGTH);

    expect(
      validateSystemReportRequest({
        ...validReport,
        email: ` ${email} `,
        title: ` ${title} `,
        message: ` ${message} `,
      }),
    ).toEqual({
      ok: true,
      value: {
        ...validReport,
        email,
        title,
        message,
      },
    });
  });

  it("accepts unknown as the coarse fallback device type", () => {
    const result = validateSystemReportRequest({
      ...validReport,
      context: { ...validReport.context, deviceType: "unknown" },
    });

    expect(result).toEqual({
      ok: true,
      value: {
        ...validReport,
        context: { ...validReport.context, deviceType: "unknown" },
      },
    });
  });

  it.each([
    ["category", { ...validReport, category: "security" }],
    ["email", { ...validReport, email: "not-an-email" }],
    [
      "email length",
      { ...validReport, email: `${"a".repeat(244)}@example.com` },
    ],
    ["blank title", { ...validReport, title: " \n " }],
    ["title length", { ...validReport, title: "a".repeat(121) }],
    ["blank message", { ...validReport, message: "\t" }],
    ["message length", { ...validReport, message: "a".repeat(4001) }],
    [
      "pathname query",
      {
        ...validReport,
        context: { ...validReport.context, pathname: "/dashboard?tab=all" },
      },
    ],
    [
      "pathname hash",
      {
        ...validReport,
        context: { ...validReport.context, pathname: "/dashboard#recent" },
      },
    ],
    [
      "relative pathname",
      {
        ...validReport,
        context: { ...validReport.context, pathname: "dashboard" },
      },
    ],
    [
      "browser enum",
      {
        ...validReport,
        context: { ...validReport.context, browser: "chrome-123" },
      },
    ],
    [
      "os enum",
      {
        ...validReport,
        context: { ...validReport.context, os: "windows-11" },
      },
    ],
    [
      "device type enum",
      {
        ...validReport,
        context: { ...validReport.context, deviceType: "other" },
      },
    ],
    [
      "locale enum",
      {
        ...validReport,
        context: { ...validReport.context, locale: "ko-KR" },
      },
    ],
    [
      "fractional viewport",
      {
        ...validReport,
        context: { ...validReport.context, viewportWidth: 390.5 },
      },
    ],
  ])("rejects invalid %s values", (_name, value) => {
    expect(validateSystemReportRequest(value)).toEqual({ ok: false });
  });

  it.each([
    ["user id", { ...validReport, userId: "user-controlled" }],
    [
      "top-level referrer",
      { ...validReport, referrer: "https://private.test" },
    ],
    [
      "raw user agent",
      {
        ...validReport,
        context: { ...validReport.context, userAgent: "private raw ua" },
      },
    ],
    [
      "query",
      {
        ...validReport,
        context: { ...validReport.context, query: "token=private" },
      },
    ],
    [
      "hash",
      {
        ...validReport,
        context: { ...validReport.context, hash: "private-fragment" },
      },
    ],
    [
      "ip address",
      {
        ...validReport,
        context: { ...validReport.context, ip: "203.0.113.1" },
      },
    ],
  ])("rejects non-allowlisted privacy field: %s", (_name, value) => {
    expect(validateSystemReportRequest(value)).toEqual({ ok: false });
  });
});

describe("system report same-origin enforcement", () => {
  it("does not widen the accepted origin from forwarded headers", () => {
    const request = new Request(
      "https://internal.example/api/system-reports",
      {
        headers: {
          origin: "https://public.example",
          "sec-fetch-site": "same-origin",
          "x-forwarded-host": "public.example",
          "x-forwarded-proto": "https",
        },
      },
    );

    expect(isSameOriginSystemReportRequest(request)).toBe(false);
  });
});

describe("system report request body parsing", () => {
  it("parses a JSON body at the byte limit", async () => {
    const messageLength =
      SYSTEM_REPORT_MAX_BODY_BYTES -
      new TextEncoder().encode(JSON.stringify({ ...validReport, message: "" }))
        .byteLength;
    const body = JSON.stringify({
      ...validReport,
      message: "a".repeat(messageLength),
    });

    const result = await parseSystemReportRequestBody(
      new Request("http://localhost/api/system-reports", {
        method: "POST",
        body,
      }),
    );

    expect(new TextEncoder().encode(body)).toHaveLength(
      SYSTEM_REPORT_MAX_BODY_BYTES,
    );
    expect(result.ok).toBe(true);
  });

  it("stops streaming and returns 413 above the byte limit", async () => {
    const result = await parseSystemReportRequestBody(
      new Request("http://localhost/api/system-reports", {
        method: "POST",
        body: "a".repeat(SYSTEM_REPORT_MAX_BODY_BYTES + 1),
      }),
    );

    expect(result).toEqual({ ok: false, status: 413 });
  });

  it("returns 400 for malformed JSON within the limit", async () => {
    const result = await parseSystemReportRequestBody(
      new Request("http://localhost/api/system-reports", {
        method: "POST",
        body: "{not-json",
      }),
    );

    expect(result).toEqual({ ok: false, status: 400 });
  });
});
