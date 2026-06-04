import { describe, expect, test } from "vitest";

// M5 — build hygiene preflight (PLAN.md §강제성 게이트 표; memory:
// project-pnpm-build-clobbers-dev-server). Running `pnpm build` while a dev
// server is alive corrupts `.next` → stale chunks → fake runtime errors. The
// preflight must REJECT the build when a dev server is detected, with an escape
// hatch (`--force`). The decision logic is a pure function so validate-the-
// validator can prove it FAILs on the real defect (dev alive → build attempted).
//
// The checker is a plain .mjs script with no type declarations (tsconfig
// allowJs:false), so TS cannot resolve a typed import. The runtime export is
// exercised by every assertion below.
// prettier-ignore
// @ts-expect-error -- .mjs script has no .d.ts; runtime contract verified here
import { evaluateBuildPreflight, normalizePort, resolveProbePorts } from "../../scripts/build-preflight.mjs";

// Cross-audit P0/P1: the preflight must probe the ports dev actually uses, not
// just 3000. The founding incident (2026-06-02) was on :3100; Next dev auto-
// retries 3001+ when 3000 is taken; verify scripts default to 3100. And a bad
// --port must not crash the gate.
describe("normalizePort — reject invalid ports (no crash)", () => {
  test("accepts a valid numeric string and number", () => {
    expect(normalizePort("3000")).toBe(3000);
    expect(normalizePort(3100)).toBe(3100);
  });
  test("rejects non-numeric, out-of-range, and zero/negative as null", () => {
    expect(normalizePort("abc")).toBeNull();
    expect(normalizePort("99999")).toBeNull();
    expect(normalizePort("0")).toBeNull();
    expect(normalizePort("-1")).toBeNull();
    expect(normalizePort(undefined)).toBeNull();
  });
});

describe("resolveProbePorts — which ports to probe", () => {
  test("defaults cover 3000, the auto-retry range, and the documented 3100", () => {
    const ports = resolveProbePorts([], {});
    expect(ports).toContain(3000);
    expect(ports).toContain(3001);
    expect(ports).toContain(3100);
  });
  test("an explicit --port narrows to just that port", () => {
    expect(resolveProbePorts(["--port", "3100"], {})).toEqual([3100]);
  });
  test("PORT env is included", () => {
    expect(resolveProbePorts([], { PORT: "4000" })).toContain(4000);
  });
  test("an invalid explicit --port falls back to defaults (no crash)", () => {
    const ports = resolveProbePorts(["--port", "abc"], {});
    expect(ports).toContain(3000);
  });
});

describe("evaluateBuildPreflight — block build while a dev server is alive", () => {
  // validate-the-validator: the exact defect (dev alive, no force) must be a
  // hard block with a non-zero exit code.
  test("BLOCKS with non-zero exit when a dev server is detected (the defect)", () => {
    const result = evaluateBuildPreflight({ devServerDetected: true, force: false });
    expect(result.block).toBe(true);
    expect(result.code).not.toBe(0);
  });

  test("allows the build (exit 0) when no dev server is detected", () => {
    const result = evaluateBuildPreflight({ devServerDetected: false, force: false });
    expect(result.block).toBe(false);
    expect(result.code).toBe(0);
  });

  // Escape hatch: --force lets the build proceed but must surface a warning so
  // the corruption risk is not silent.
  test("allows the build under --force even when a dev server is detected, but warns", () => {
    const result = evaluateBuildPreflight({ devServerDetected: true, force: true });
    expect(result.block).toBe(false);
    expect(result.code).toBe(0);
    expect(result.warn).toBe(true);
  });

  // The rejection message must point at the recovery path (stop dev → delete
  // .next) so a human reading the failed gate knows what to do.
  test("rejection message names the .next recovery path", () => {
    const result = evaluateBuildPreflight({ devServerDetected: true, force: false });
    expect(result.message).toMatch(/\.next/);
  });
});
