import { describe, expect, test } from "vitest";

// M1 — dev-mode route smoke (PLAN.md §강제성 게이트 표 M1). The runner boots
// `next dev`, visits the C1-derived routes, and records console/runtime errors +
// screenshots. `classifyRouteResult` is the pure verdict: it turns one route's
// observations (status, console errors, page errors, redirect) into ok/fatal.
//
// validate-the-validator: a page error matching the #5 signature ("Element type
// is invalid" — the exact loading.tsx RSC crash) must be FATAL. A clean route
// must pass.
//
// .mjs has no .d.ts (tsconfig allowJs:false); runtime contract verified here.
// prettier-ignore
// @ts-expect-error -- .mjs script has no .d.ts
import { classifyRouteResult } from "../../scripts/dev-route-smoke.mjs";

describe("classifyRouteResult — per-route smoke verdict", () => {
  test("a clean route (200, no errors, no redirect) passes", () => {
    const r = classifyRouteResult({
      requestedPath: "/login",
      finalPath: "/login",
      status: 200,
      consoleErrors: [],
      pageErrors: [],
    });
    expect(r.ok).toBe(true);
    expect(r.fatal).toBe(false);
    expect(r.reasons).toEqual([]);
  });

  // validate-the-validator: the exact #5 defect must be fatal.
  test("a page error matching the #5 signature is FATAL", () => {
    const r = classifyRouteResult({
      requestedPath: "/dashboard",
      finalPath: "/dashboard",
      status: 200,
      consoleErrors: [],
      pageErrors: [
        "Element type is invalid: expected a string but got: undefined",
      ],
    });
    expect(r.fatal).toBe(true);
    expect(r.ok).toBe(false);
  });

  test("any console error fails the route (non-fatal)", () => {
    const r = classifyRouteResult({
      requestedPath: "/",
      finalPath: "/",
      status: 200,
      consoleErrors: ["TypeError: cannot read properties of null"],
      pageErrors: [],
    });
    expect(r.ok).toBe(false);
    expect(r.fatal).toBe(false);
  });

  test("an HTTP error status fails the route", () => {
    const r = classifyRouteResult({
      requestedPath: "/",
      finalPath: "/",
      status: 500,
      consoleErrors: [],
      pageErrors: [],
    });
    expect(r.ok).toBe(false);
  });

  // Dev-only HMR websocket noise is NOT an app error — the smoke gate must
  // ignore it, or every dev run fails on plumbing instead of real defects.
  test("ignores dev-only HMR websocket console noise", () => {
    const r = classifyRouteResult({
      requestedPath: "/login",
      finalPath: "/login",
      status: 200,
      consoleErrors: [
        "WebSocket connection to 'ws://127.0.0.1:3000/_next/webpack-hmr?id=abc' failed: Error during WebSocket handshake: net::ERR_INVALID_HTTP_RESPONSE",
      ],
      pageErrors: [],
    });
    expect(r.ok).toBe(true);
    expect(r.reasons).toEqual([]);
  });

  // But a real app console error alongside noise must still fail.
  test("still fails on a real console error even when noise is present", () => {
    const r = classifyRouteResult({
      requestedPath: "/",
      finalPath: "/",
      status: 200,
      consoleErrors: [
        "WebSocket connection to 'ws://x/_next/webpack-hmr' failed",
        "Uncaught TypeError: x is not a function",
      ],
      pageErrors: [],
    });
    expect(r.ok).toBe(false);
  });

  // Cross-audit P1: a Next dev error overlay (or error.tsx boundary fallback)
  // often flushes as HTTP 200 with no console/page error — a render crash that
  // slipped through. A detected overlay must be FATAL.
  test("a detected error overlay is FATAL even at status 200 with no errors", () => {
    const r = classifyRouteResult({
      requestedPath: "/dashboard",
      finalPath: "/dashboard",
      status: 200,
      consoleErrors: [],
      pageErrors: [],
      overlayText: "Unhandled Runtime Error: Element type is invalid",
    });
    expect(r.fatal).toBe(true);
    expect(r.ok).toBe(false);
  });

  // Cross-audit P2: the same antd compound × server-component defect surfaces as
  // "Minified React error #130" on some paths — must also be fatal.
  test("a Minified React error #130 is FATAL", () => {
    const r = classifyRouteResult({
      requestedPath: "/dashboard",
      finalPath: "/dashboard",
      status: 200,
      consoleErrors: [],
      pageErrors: ["Minified React error #130; visit https://react.dev/errors/130"],
    });
    expect(r.fatal).toBe(true);
  });

  // Cross-audit P2: the [Fast Refresh] noise filter was too broad — a real error
  // glued to a Fast Refresh line must still fail.
  test("does NOT filter a Fast Refresh line that carries a real error", () => {
    const r = classifyRouteResult({
      requestedPath: "/",
      finalPath: "/",
      status: 200,
      consoleErrors: ["[Fast Refresh] done because TypeError: undefined is not a function"],
      pageErrors: [],
    });
    expect(r.ok).toBe(false);
  });

  // A protected route with no valid session redirects to /login — not a code
  // defect (not fatal), but it means the route was NOT actually verified.
  test("a redirect to /login fails (not fatal) and is flagged as redirected", () => {
    const r = classifyRouteResult({
      requestedPath: "/dashboard",
      finalPath: "/login",
      status: 200,
      consoleErrors: [],
      pageErrors: [],
    });
    expect(r.ok).toBe(false);
    expect(r.fatal).toBe(false);
    expect(r.redirected).toBe(true);
  });
});
