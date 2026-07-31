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
  function originRequest(
    headers: Record<string, string>,
    url = "http://localhost:3001/api/system-reports",
  ) {
    return new Request(url, {
      method: "POST",
      headers: { "sec-fetch-site": "same-origin", ...headers },
    });
  }

  it("does not widen the accepted origin from forwarded headers", () => {
    const request = new Request("https://internal.example/api/system-reports", {
      headers: {
        origin: "https://public.example",
        "sec-fetch-site": "same-origin",
        "x-forwarded-host": "public.example",
        "x-forwarded-proto": "https",
      },
    });

    expect(isSameOriginSystemReportRequest(request)).toBe(false);
  });

  // Regression: the browser-addressed host is authoritative, NOT `request.url`.
  // Next pins `request.url`'s hostname to the server's own origin and ignores
  // `Host`, so comparing against it rejected every client that reached the app
  // under any other hostname (127.0.0.1 / LAN IP in dev, a proxied host in
  // production) even though those requests are genuinely same-origin.
  it.each([
    ["loopback IP while request.url says localhost", "127.0.0.1:3001"],
    ["a LAN IP used for device testing", "192.168.1.50:3001"],
    ["a proxied production host", "www.dotoretopik.com"],
  ])("accepts a same-origin request from %s", (_name, host) => {
    const request = originRequest({
      host,
      origin: `http://${host}`,
    });

    expect(isSameOriginSystemReportRequest(request)).toBe(true);
  });

  it("accepts an https origin whose host matches the addressed host", () => {
    const request = originRequest({
      host: "www.dotoretopik.com",
      origin: "https://www.dotoretopik.com",
    });

    expect(isSameOriginSystemReportRequest(request)).toBe(true);
  });

  // `new URL(origin).host` drops the scheme's default port, but the raw `Host`
  // header is not normalized. A proxy that forwards the redundant default port
  // would otherwise be rejected — the same false-rejection class this guard was
  // rewritten to remove.
  it.each([
    ["https with a redundant :443", "https://a.example", "a.example:443"],
    ["http with a redundant :80", "http://a.example", "a.example:80"],
    ["an IPv6 literal with a redundant :80", "http://[::1]", "[::1]:80"],
    ["an uppercased host header", "https://a.example", "A.Example:443"],
  ])("accepts %s in the host header", (_name, origin, host) => {
    expect(
      isSameOriginSystemReportRequest(originRequest({ host, origin })),
    ).toBe(true);
  });

  it.each([
    [
      "the origin host differs from the addressed host",
      { host: "www.dotoretopik.com", origin: "https://evil.example" },
    ],
    [
      "a non-default port is dropped from the origin",
      { host: "a.example:8443", origin: "https://a.example" },
    ],
    [
      "the default port belongs to the other scheme",
      { host: "a.example:80", origin: "https://a.example" },
    ],
    [
      "userinfo is smuggled into the host header",
      { host: "evil.example@a.example", origin: "https://a.example" },
    ],
    [
      "a path is smuggled into the host header",
      { host: "a.example/evil", origin: "https://a.example" },
    ],
    [
      "a sibling subdomain forges the origin",
      { host: "www.dotoretopik.com", origin: "https://evil.dotoretopik.com" },
    ],
    [
      "the port differs from the addressed port",
      { host: "localhost:3001", origin: "http://localhost:4000" },
    ],
    ["the origin header is absent", { host: "localhost:3001" }],
    ["the origin header is opaque", { host: "localhost:3001", origin: "null" }],
    [
      "the origin header is not a URL",
      { host: "localhost:3001", origin: "not-a-url" },
    ],
    ["the host header is absent", { origin: "http://localhost:3001" }],
  ])("rejects a request where %s", (_name, headers) => {
    expect(isSameOriginSystemReportRequest(originRequest(headers))).toBe(false);
  });

  it.each([["cross-site"], ["same-site"], ["none"]])(
    "rejects sec-fetch-site: %s even when origin matches the host",
    (secFetchSite) => {
      const request = originRequest({
        "sec-fetch-site": secFetchSite,
        host: "localhost:3001",
        origin: "http://localhost:3001",
      });

      expect(isSameOriginSystemReportRequest(request)).toBe(false);
    },
  );
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
