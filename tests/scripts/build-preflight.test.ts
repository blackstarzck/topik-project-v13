import fs, { type PathLike } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

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
import { evaluateBuildPreflight, evaluateSupabaseRemoteApplyBoundary, hasIsolatedDevBuildOptOut, inspectSupabaseTempBoundary, normalizePort, resolveProbePorts, supportsIsolatedDevBuild } from "../../scripts/build-preflight.mjs";

const temporaryRoots: string[] = [];

function createTemporaryRoot() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "talkpik-build-preflight-"));
  fs.mkdirSync(path.join(rootDir, "supabase"), { recursive: true });
  temporaryRoots.push(rootDir);
  return rootDir;
}

function inspectAndEvaluate(rootDir: string, fsApi: object = fs) {
  return evaluateSupabaseRemoteApplyBoundary({
    env: {},
    tempInspection: inspectSupabaseTempBoundary({ rootDir, fsApi }),
  });
}

afterEach(() => {
  for (const rootDir of temporaryRoots.splice(0)) {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

describe("supportsIsolatedDevBuild — gate framework capability", () => {
  test("accepts the verified Next 16 contract", () => {
    expect(supportsIsolatedDevBuild("16.2.6")).toBe(true);
  });

  test("fails closed for legacy, future, or invalid versions", () => {
    expect(supportsIsolatedDevBuild("15.5.0")).toBe(false);
    expect(supportsIsolatedDevBuild("17.0.0-canary.1")).toBe(false);
    expect(supportsIsolatedDevBuild("unknown")).toBe(false);
    expect(supportsIsolatedDevBuild(undefined)).toBe(false);
  });

  test("detects an explicit isolatedDevBuild opt-out", () => {
    expect(
      hasIsolatedDevBuildOptOut(`experimental: { isolatedDevBuild: false }`),
    ).toBe(true);
    expect(
      hasIsolatedDevBuildOptOut(`experimental: { "isolatedDevBuild": false }`),
    ).toBe(true);
    expect(
      hasIsolatedDevBuildOptOut(
        `experimental: { isolatedDevBuild: process.env.ISOLATED === "1" }`,
      ),
    ).toBe(true);
    expect(
      hasIsolatedDevBuildOptOut(`experimental: { isolatedDevBuild: true }`),
    ).toBe(false);
    expect(hasIsolatedDevBuildOptOut(`const nextConfig = {}`)).toBe(false);
    expect(hasIsolatedDevBuildOptOut(undefined)).toBe(true);
  });
});

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

  test("allows the build when Next isolated dev output is explicitly enabled", () => {
    const result = evaluateBuildPreflight({
      devServerDetected: true,
      isolatedDevBuild: true,
      force: false,
    });

    expect(result.block).toBe(false);
    expect(result.code).toBe(0);
    expect(result.warn).toBe(true);
    expect(result.message).toMatch(/\.next\/dev/);
  });

  // The rejection message must point at the recovery path (stop dev → delete
  // .next) so a human reading the failed gate knows what to do.
  test("rejection message names the .next recovery path", () => {
    const result = evaluateBuildPreflight({ devServerDetected: true, force: false });
    expect(result.message).toMatch(/\.next/);
  });
});

describe("Supabase remote-apply build boundary", () => {
  test.each(["absent", "empty"])("allows an %s supabase/.temp directory", (state) => {
    const rootDir = createTemporaryRoot();
    if (state === "empty") {
      fs.mkdirSync(path.join(rootDir, "supabase", ".temp"));
    }

    const result = inspectAndEvaluate(rootDir);

    expect(result.block).toBe(false);
    expect(result.code).toBe(0);
  });

  test("allows only a regular cli-latest marker without reading its content", () => {
    const rootDir = createTemporaryRoot();
    const tempDir = path.join(rootDir, "supabase", ".temp");
    fs.mkdirSync(tempDir);
    fs.writeFileSync(path.join(tempDir, "cli-latest"), "SECRET_FILE_CONTENT");
    const noContentReads = {
      ...fs,
      readFileSync() {
        throw new Error("file content must not be read");
      },
    };

    const result = inspectAndEvaluate(rootDir, noContentReads);

    expect(result.block).toBe(false);
    expect(result.message).not.toContain("SECRET_FILE_CONTENT");
  });

  test("blocks project-ref because it identifies a linked hosted project", () => {
    const rootDir = createTemporaryRoot();
    const tempDir = path.join(rootDir, "supabase", ".temp");
    fs.mkdirSync(tempDir);
    fs.writeFileSync(path.join(tempDir, "project-ref"), "SECRET_PROJECT_REF");

    const result = inspectAndEvaluate(rootDir);

    expect(result.block).toBe(true);
    expect(result.message).toContain("supabase/.temp/project-ref");
    expect(result.message).not.toContain("SECRET_PROJECT_REF");
  });

  test("fails closed for an unknown temp entry", () => {
    const rootDir = createTemporaryRoot();
    const tempDir = path.join(rootDir, "supabase", ".temp");
    fs.mkdirSync(tempDir);
    fs.writeFileSync(path.join(tempDir, "unknown-marker"), "SECRET_UNKNOWN_CONTENT");

    const result = inspectAndEvaluate(rootDir);

    expect(result.block).toBe(true);
    expect(result.message).toContain("supabase/.temp/unknown-marker");
    expect(result.message).not.toContain("SECRET_UNKNOWN_CONTENT");
  });

  test("blocks a junction used as the temp root", () => {
    const rootDir = createTemporaryRoot();
    const junctionTarget = path.join(rootDir, "junction-target");
    fs.mkdirSync(junctionTarget);
    fs.symlinkSync(
      junctionTarget,
      path.join(rootDir, "supabase", ".temp"),
      "junction",
    );

    const result = inspectAndEvaluate(rootDir);

    expect(result.block).toBe(true);
    expect(result.message).toContain("supabase/.temp");
  });

  test("blocks a non-directory temp root without reading or exposing its content", () => {
    const rootDir = createTemporaryRoot();
    fs.writeFileSync(
      path.join(rootDir, "supabase", ".temp"),
      "SECRET_ROOT_FILE_CONTENT",
    );

    const result = inspectAndEvaluate(rootDir);

    expect(result.block).toBe(true);
    expect(result.message).toContain("supabase/.temp");
    expect(result.message).not.toContain(rootDir);
    expect(result.message).not.toContain("SECRET_ROOT_FILE_CONTENT");
  });

  test("fails closed and sanitizes a temp-root lstat error", () => {
    const rootDir = createTemporaryRoot();
    const failingFs = {
      ...fs,
      lstatSync() {
        throw new Error(`SECRET_ROOT_LSTAT_ERROR ${rootDir}`);
      },
    };

    const result = inspectAndEvaluate(rootDir, failingFs);

    expect(result.block).toBe(true);
    expect(result.message).toContain("supabase/.temp");
    expect(result.message).not.toContain(rootDir);
    expect(result.message).not.toContain("SECRET_ROOT_LSTAT_ERROR");
  });

  test("fails closed and sanitizes a temp-root realpath error", () => {
    const rootDir = createTemporaryRoot();
    fs.mkdirSync(path.join(rootDir, "supabase", ".temp"));
    const failingFs = {
      ...fs,
      realpathSync() {
        throw new Error(`SECRET_ROOT_REALPATH_ERROR ${rootDir}`);
      },
    };

    const result = inspectAndEvaluate(rootDir, failingFs);

    expect(result.block).toBe(true);
    expect(result.message).toContain("supabase/.temp");
    expect(result.message).not.toContain(rootDir);
    expect(result.message).not.toContain("SECRET_ROOT_REALPATH_ERROR");
  });

  test("blocks a symlink or junction child", () => {
    const rootDir = createTemporaryRoot();
    const tempDir = path.join(rootDir, "supabase", ".temp");
    const junctionTarget = path.join(rootDir, "junction-target");
    fs.mkdirSync(tempDir);
    fs.mkdirSync(junctionTarget);
    fs.symlinkSync(junctionTarget, path.join(tempDir, "cli-latest"), "junction");

    const result = inspectAndEvaluate(rootDir);

    expect(result.block).toBe(true);
    expect(result.message).toContain("supabase/.temp/cli-latest");
  });

  test("blocks a non-regular cli-latest entry", () => {
    const rootDir = createTemporaryRoot();
    const tempDir = path.join(rootDir, "supabase", ".temp");
    fs.mkdirSync(path.join(tempDir, "cli-latest"), { recursive: true });

    const result = inspectAndEvaluate(rootDir);

    expect(result.block).toBe(true);
    expect(result.message).toContain("supabase/.temp/cli-latest");
  });

  test("fails closed and sanitizes a cli-latest lstat error", () => {
    const rootDir = createTemporaryRoot();
    const tempDir = path.join(rootDir, "supabase", ".temp");
    fs.mkdirSync(tempDir);
    fs.writeFileSync(path.join(tempDir, "cli-latest"), "SECRET_CHILD_CONTENT");
    const failingFs = {
      ...fs,
      lstatSync(target: PathLike) {
        if (path.basename(target.toString()) === "cli-latest") {
          throw new Error(`SECRET_CHILD_LSTAT_ERROR ${rootDir}`);
        }
        return fs.lstatSync(target);
      },
    };

    const result = inspectAndEvaluate(rootDir, failingFs);

    expect(result.block).toBe(true);
    expect(result.message).toContain("supabase/.temp/cli-latest");
    expect(result.message).not.toContain(rootDir);
    expect(result.message).not.toContain("SECRET_CHILD_LSTAT_ERROR");
    expect(result.message).not.toContain("SECRET_CHILD_CONTENT");
  });

  test("fails closed and sanitizes a cli-latest realpath error", () => {
    const rootDir = createTemporaryRoot();
    const tempDir = path.join(rootDir, "supabase", ".temp");
    fs.mkdirSync(tempDir);
    fs.writeFileSync(path.join(tempDir, "cli-latest"), "SECRET_CHILD_CONTENT");
    const failingFs = {
      ...fs,
      realpathSync(target: PathLike) {
        if (path.basename(target.toString()) === "cli-latest") {
          throw new Error(`SECRET_CHILD_REALPATH_ERROR ${rootDir}`);
        }
        return fs.realpathSync(target);
      },
    };

    const result = inspectAndEvaluate(rootDir, failingFs);

    expect(result.block).toBe(true);
    expect(result.message).toContain("supabase/.temp/cli-latest");
    expect(result.message).not.toContain(rootDir);
    expect(result.message).not.toContain("SECRET_CHILD_REALPATH_ERROR");
    expect(result.message).not.toContain("SECRET_CHILD_CONTENT");
  });

  test("fails closed with a sanitized message when directory enumeration fails", () => {
    const rootDir = createTemporaryRoot();
    fs.mkdirSync(path.join(rootDir, "supabase", ".temp"));
    const failingFs = {
      ...fs,
      readdirSync() {
        throw new Error("SECRET_ENUMERATION_ERROR");
      },
    };

    const result = inspectAndEvaluate(rootDir, failingFs);

    expect(result.block).toBe(true);
    expect(result.message).toContain("supabase/.temp");
    expect(result.message).not.toContain("SECRET_ENUMERATION_ERROR");
  });

  test("blocks a management token regardless of safe temp inspection", () => {
    const result = evaluateSupabaseRemoteApplyBoundary({
      env: { SUPABASE_ACCESS_TOKEN: "SECRET_MANAGEMENT_TOKEN" },
      tempInspection: { violations: [] },
    });

    expect(result.block).toBe(true);
    expect(result.code).not.toBe(0);
    expect(result.message).toMatch(/SUPABASE_ACCESS_TOKEN/);
    expect(result.message).not.toContain("SECRET_MANAGEMENT_TOKEN");
  });

  test("messages expose only safe paths and names, never token or file content", () => {
    const rootDir = createTemporaryRoot();
    const tempDir = path.join(rootDir, "supabase", ".temp");
    fs.mkdirSync(tempDir);
    fs.writeFileSync(path.join(tempDir, "project-ref"), "SECRET_PROJECT_REF");
    const result = evaluateSupabaseRemoteApplyBoundary({
      env: { SUPABASE_ACCESS_TOKEN: "SECRET_MANAGEMENT_TOKEN" },
      tempInspection: inspectSupabaseTempBoundary({ rootDir }),
    });

    expect(result.block).toBe(true);
    expect(result.message).toContain("SUPABASE_ACCESS_TOKEN");
    expect(result.message).toContain("supabase/.temp/project-ref");
    expect(result.message).not.toContain("SECRET_MANAGEMENT_TOKEN");
    expect(result.message).not.toContain("SECRET_PROJECT_REF");
  });
});
