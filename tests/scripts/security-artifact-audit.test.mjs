import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const temporaryRoots = [];
const cliPath = path.resolve("scripts/security-artifact-audit.mjs");
const canarySecret = "SECURITY_AUDIT_CANARY_SECRET_MUST_NOT_LEAK";

function run(command, args, { cwd, timeout = 10_000 } = {}) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    shell: false,
    timeout,
    windowsHide: true,
  });
}

function git(cwd, ...args) {
  const result = run("git", args, { cwd });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
}

function commit(cwd, ...args) {
  return git(
    cwd,
    "-c",
    "user.name=Security Audit Fixture",
    "-c",
    "user.email=security-audit@example.test",
    "commit",
    ...args,
  );
}

function write(rootDir, relativePath, content = "fixture\n") {
  const target = path.join(rootDir, ...relativePath.split("/"));
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function createRepository({
  withDeletedFinding = false,
  withEvidenceBypass = false,
  withEvidenceCandidate = false,
  withFindings = true,
  withNestedFindings = false,
} = {}) {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), "security-artifact-audit-"));
  temporaryRoots.push(fixtureRoot);
  const repoPath = path.join(fixtureRoot, "repository");
  mkdirSync(repoPath, { recursive: true });
  git(repoPath, "init", "--initial-branch=main");

  write(repoPath, "supabase/migrations/20260723000000_safe.sql", "select 1;\n");
  write(
    repoPath,
    "docs/qa/reports/2026-07-23-security-audit/screenshot.png",
    "approved QA evidence\n",
  );
  write(repoPath, "public/assets/screenshot.png", "public asset\n");
  write(repoPath, "src/assets/hero.webp", "source asset\n");
  if (withEvidenceCandidate) {
    write(
      repoPath,
      "docs/qa/reports/2026-07-23-security-audit/approved.png",
      "approved by exact path\n",
    );
  }
  if (withEvidenceBypass) {
    write(
      repoPath,
      "docs/qa/reports/2026-07-23-security-audit/.scratch/allowlisted.png",
      "must remain risky\n",
    );
  }

  if (withFindings) {
    write(repoPath, "brand.PNG", "explicitly allowed root image\n");
    write(repoPath, ".ScRaTcH/debug.log", canarySecret);
    write(repoPath, ".TmP/session.tmp", "temporary\n");
    write(repoPath, "Artifacts/result.json", "artifact\n");
    write(repoPath, "ROOT.LOG", "first version\n");
    write(repoPath, "capture.PNG", "unapproved screenshot\n");
  }
  if (withDeletedFinding) {
    write(repoPath, ".scratch/deleted-session.json", canarySecret);
  }
  if (withNestedFindings) {
    write(repoPath, "tools/cache.temp", "nested temporary file\n");
    write(repoPath, "tools/debug.log", "nested log\n");
    write(repoPath, "scripts/temp.sql", "select 'temporary';\n");
    write(repoPath, "config/.env", canarySecret);
    write(repoPath, "tools/screenshots/intermediate.png", "intermediate\n");
    write(
      repoPath,
      "docs/qa/reports/2026-07-23-security-audit/debug.log",
      "qa log\n",
    );
    write(
      repoPath,
      "docs/qa/reports/2026-07-23-security-audit/.env",
      canarySecret,
    );
    write(
      repoPath,
      "docs/qa/reports/2026-07-23-security-audit/debug.js",
      "temporary script\n",
    );
    write(repoPath, "public/assets/debug.log", "public log\n");
    write(repoPath, "public/assets/.env", canarySecret);
    write(repoPath, "src/assets/debug.log", "source log\n");
    write(repoPath, "src/assets/.env", canarySecret);
  }

  git(repoPath, "add", "--all");
  commit(repoPath, "-m", "fixture baseline");
  if (withFindings) {
    write(repoPath, "ROOT.LOG", "second version\n");
    git(repoPath, "add", "ROOT.LOG");
    commit(repoPath, "-m", "update root log");
  }
  if (withDeletedFinding) {
    unlinkSync(path.join(repoPath, ".scratch", "deleted-session.json"));
    git(repoPath, "add", "--all");
    commit(repoPath, "-m", "delete historical scratch artifact");
  }
  git(repoPath, "update-ref", "refs/remotes/origin/main", "HEAD");
  git(repoPath, "update-ref", "refs/remotes/collab/main", "HEAD");

  return { fixtureRoot, repoPath };
}

function runCli(
  repoPath,
  mode,
  refs = "origin/main,collab/main",
  baselineRef = null,
) {
  const args = [cliPath, "--repo", repoPath, "--mode", mode, "--refs", refs];
  if (baselineRef !== null) {
    args.push("--baseline-ref", baselineRef);
  }
  return run(
    process.execPath,
    args,
    { cwd: path.resolve(".") },
  );
}

async function loadLibrary() {
  return import("../../scripts/lib/security-artifact-audit.mjs");
}

async function loadCli() {
  return import("../../scripts/security-artifact-audit.mjs");
}

afterEach(() => {
  for (const rootDir of temporaryRoots.splice(0)) {
    rmSync(rootDir, { force: true, recursive: true });
  }
});

describe("security artifact audit policy", () => {
  it("exposes report and check package scripts without replacing artifact hygiene", () => {
    const packageJson = JSON.parse(readFileSync(path.resolve("package.json"), "utf8"));

    expect(packageJson.scripts["report:security-artifacts"]).toBe(
      "node scripts/security-artifact-audit.mjs --repo . --mode report",
    );
    expect(packageJson.scripts["check:security-artifacts"]).toBe(
      "node scripts/security-artifact-audit.mjs --repo . --mode check",
    );
    expect(packageJson.scripts["check:artifact-hygiene"]).toBe(
      "node scripts/check-artifact-hygiene.mjs --mode check",
    );
  });

  it("allows migration, approved QA, public/source assets, and an explicit root image allowlist", async () => {
    const fixture = createRepository({ withEvidenceCandidate: true });
    const { auditSecurityArtifacts } = await loadLibrary();

    const report = auditSecurityArtifacts({
      evidenceAllowlist: [
        "docs/qa/reports/2026-07-23-security-audit/approved.png",
      ],
      repoPath: fixture.repoPath,
      refs: ["origin/main", "collab/main"],
      rootImageAllowlist: ["brand.png"],
    });

    const findingPaths = new Set(report.findings.map((finding) => finding.path));
    expect(findingPaths).toEqual(
      new Set([
        ".ScRaTcH/debug.log",
        ".TmP/session.tmp",
        "Artifacts/result.json",
        "ROOT.LOG",
        "capture.PNG",
      ]),
    );
    expect(findingPaths).not.toContain(
      "supabase/migrations/20260723000000_safe.sql",
    );
    expect(findingPaths).not.toContain(
      "docs/qa/reports/2026-07-23-security-audit/screenshot.png",
    );
    expect(findingPaths).not.toContain("public/assets/screenshot.png");
    expect(findingPaths).not.toContain("src/assets/hero.webp");
    expect(findingPaths).not.toContain(
      "docs/qa/reports/2026-07-23-security-audit/approved.png",
    );
    expect(findingPaths).not.toContain("brand.PNG");
  });

  it("does not let evidence allowlists bypass risky paths or escape approved QA images", async () => {
    const fixture = createRepository({
      withEvidenceBypass: true,
      withFindings: false,
    });
    const { auditSecurityArtifacts } = await loadLibrary();
    const riskyEvidencePath =
      "docs/qa/reports/2026-07-23-security-audit/.scratch/allowlisted.png";

    const report = auditSecurityArtifacts({
      evidenceAllowlist: [riskyEvidencePath],
      repoPath: fixture.repoPath,
      refs: ["origin/main"],
    });

    expect(report.findings).toContainEqual(
      expect.objectContaining({
        path: riskyEvidencePath,
        rule: "TRACKED_SCRATCH_PATH",
      }),
    );
    expect(() =>
      auditSecurityArtifacts({
        evidenceAllowlist: ["docs/manual-evidence/approved.png"],
        repoPath: fixture.repoPath,
        refs: ["origin/main"],
      }),
    ).toThrow(expect.objectContaining({ code: "EVIDENCE_ALLOWLIST_INVALID" }));
    expect(() =>
      auditSecurityArtifacts({
        evidenceAllowlist: [
          "docs/qa/reports/2026-07-23-security-audit/debug.log",
        ],
        repoPath: fixture.repoPath,
        refs: ["origin/main"],
      }),
    ).toThrow(expect.objectContaining({ code: "EVIDENCE_ALLOWLIST_INVALID" }));
  });

  it("finds nested env, temporary, SQL, script, and screenshot paths inside otherwise safe trees", async () => {
    const fixture = createRepository({
      withEvidenceCandidate: true,
      withFindings: false,
      withNestedFindings: true,
    });
    const { auditSecurityArtifacts } = await loadLibrary();

    const report = auditSecurityArtifacts({
      evidenceAllowlist: [
        "docs/qa/reports/2026-07-23-security-audit/approved.png",
      ],
      repoPath: fixture.repoPath,
      refs: ["origin/main"],
    });

    const findingPaths = new Set(report.findings.map(({ path: findingPath }) => findingPath));
    expect(findingPaths).toEqual(
      new Set([
        "config/.env",
        "docs/qa/reports/2026-07-23-security-audit/.env",
        "docs/qa/reports/2026-07-23-security-audit/debug.js",
        "docs/qa/reports/2026-07-23-security-audit/debug.log",
        "public/assets/.env",
        "public/assets/debug.log",
        "scripts/temp.sql",
        "src/assets/.env",
        "src/assets/debug.log",
        "tools/cache.temp",
        "tools/debug.log",
        "tools/screenshots/intermediate.png",
      ]),
    );
    expect(findingPaths).not.toContain(
      "docs/qa/reports/2026-07-23-security-audit/screenshot.png",
    );
    expect(findingPaths).not.toContain("public/assets/screenshot.png");
    expect(findingPaths).not.toContain("src/assets/hero.webp");
    expect(findingPaths).not.toContain(
      "docs/qa/reports/2026-07-23-security-audit/approved.png",
    );
    expect(JSON.stringify(report)).not.toContain(canarySecret);
  });

  it("emits a deterministic secret-safe SecurityArtifactAuditV1 record with closed snapshots", async () => {
    const fixture = createRepository();
    const { auditSecurityArtifacts } = await loadLibrary();
    const options = {
      repoPath: fixture.repoPath,
      refs: ["collab/main", "origin/main"],
      rootImageAllowlist: ["brand.png"],
    };

    const first = auditSecurityArtifacts(options);
    const second = auditSecurityArtifacts(options);
    const rootLogFinding = first.findings.find(
      (finding) =>
        finding.ref === "origin/main" && finding.path === "ROOT.LOG",
    );
    const rootLogCommitHashes = git(
      fixture.repoPath,
      "log",
      "--format=%H",
      "origin/main",
      "--",
      "ROOT.LOG",
    )
      .split(/\r?\n/u)
      .filter(Boolean)
      .map((commitSha) =>
        createHash("sha256").update(commitSha).digest("hex"),
      )
      .sort();
    const commitShas = git(fixture.repoPath, "rev-list", "--all").split(/\r?\n/u);
    const expectedSnapshots = ["collab/main", "origin/main"].map((ref) => {
      const commitSha = git(fixture.repoPath, "rev-parse", `${ref}^{commit}`);
      return {
        ref,
        commitHash: createHash("sha256").update(commitSha).digest("hex"),
      };
    });

    expect(first).toEqual(second);
    expect(Object.keys(first)).toEqual([
      "schemaVersion",
      "recordType",
      "refs",
      "snapshots",
      "findings",
      "summary",
      "fingerprint",
    ]);
    expect(first).toMatchObject({
      schemaVersion: 1,
      recordType: "SecurityArtifactAuditV1",
      refs: ["collab/main", "origin/main"],
      snapshots: expectedSnapshots,
      summary: {
        refCount: 2,
        findingCount: 10,
      },
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(rootLogFinding).toEqual({
      ref: "origin/main",
      path: "ROOT.LOG",
      rule: "ROOT_TEMP_FILE",
      pathHash: createHash("sha256").update("ROOT.LOG").digest("hex"),
      historyCommitCount: 2,
      commitHashes: rootLogCommitHashes,
    });
    expect(Object.keys(rootLogFinding)).toEqual([
      "ref",
      "path",
      "rule",
      "historyCommitCount",
      "commitHashes",
      "pathHash",
    ]);
    expect(rootLogFinding.commitHashes).toHaveLength(
      rootLogFinding.historyCommitCount,
    );
    expect(rootLogFinding.commitHashes).toEqual(
      [...rootLogFinding.commitHashes].sort(),
    );
    expect(
      rootLogFinding.commitHashes.every((commitHash) =>
        /^[a-f0-9]{64}$/u.test(commitHash),
      ),
    ).toBe(true);
    expect(first.snapshots).toHaveLength(2);
    for (const snapshot of first.snapshots) {
      expect(Object.keys(snapshot)).toEqual(["ref", "commitHash"]);
      expect(snapshot.commitHash).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(JSON.stringify(first)).not.toContain(canarySecret);
    for (const commitSha of commitShas) {
      expect(JSON.stringify(first)).not.toContain(commitSha);
    }
  });

  it("changes the snapshot and fingerprint when a ref moves without changing risky paths", async () => {
    const fixture = createRepository();
    const { auditSecurityArtifacts } = await loadLibrary();
    const options = {
      repoPath: fixture.repoPath,
      refs: ["origin/main"],
      rootImageAllowlist: ["brand.png"],
    };

    const beforeCommitSha = git(
      fixture.repoPath,
      "rev-parse",
      "origin/main^{commit}",
    );
    const before = auditSecurityArtifacts(options);

    commit(fixture.repoPath, "--allow-empty", "-m", "move ref without changing paths");
    git(fixture.repoPath, "update-ref", "refs/remotes/origin/main", "HEAD");

    const afterCommitSha = git(
      fixture.repoPath,
      "rev-parse",
      "origin/main^{commit}",
    );
    const after = auditSecurityArtifacts(options);

    expect(afterCommitSha).not.toBe(beforeCommitSha);
    expect(after.refs).toEqual(before.refs);
    expect(after.findings).toEqual(before.findings);
    expect(after.summary).toEqual(before.summary);
    expect(after.snapshots).not.toEqual(before.snapshots);
    expect(after.fingerprint).not.toBe(before.fingerprint);
    expect(JSON.stringify(before)).not.toContain(beforeCommitSha);
    expect(JSON.stringify(after)).not.toContain(afterCommitSha);
  });

  it("matches risky paths and the root image allowlist case-insensitively", async () => {
    const fixture = createRepository();
    const { auditSecurityArtifacts } = await loadLibrary();

    const report = auditSecurityArtifacts({
      repoPath: fixture.repoPath,
      refs: ["origin/main"],
      rootImageAllowlist: ["BRAND.png"],
    });

    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ".ScRaTcH/debug.log",
          rule: "TRACKED_SCRATCH_PATH",
        }),
        expect.objectContaining({
          path: ".TmP/session.tmp",
          rule: "TRACKED_TMP_PATH",
        }),
        expect.objectContaining({
          path: "Artifacts/result.json",
          rule: "TRACKED_ARTIFACT_PATH",
        }),
        expect.objectContaining({ path: "ROOT.LOG", rule: "ROOT_TEMP_FILE" }),
        expect.objectContaining({
          path: "capture.PNG",
          rule: "ROOT_IMAGE_NOT_ALLOWLISTED",
        }),
      ]),
    );
    expect(report.findings.some(({ path: findingPath }) => findingPath === "brand.PNG")).toBe(
      false,
    );
  });
});

describe("security artifact audit CLI", () => {
  it("passes baseline check when a PR adds no risky artifact changes", () => {
    const fixture = createRepository();
    write(fixture.repoPath, "docs/clean-change.md", "clean change\n");
    git(fixture.repoPath, "add", "docs/clean-change.md");
    commit(fixture.repoPath, "-m", "add clean change");

    const result = runCli(
      fixture.repoPath,
      "check",
      "HEAD",
      "origin/main",
    );
    const report = JSON.parse(result.stdout);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(report.recordType).toBe("SecurityArtifactDiffAuditV1");
    expect(report.baseline.ref).toBe("origin/main");
    expect(report.refs).toEqual(["HEAD"]);
    expect(report.findings).toEqual([]);
    expect(report.summary.findingCount).toBe(0);
  });

  it("fails baseline check when a PR adds or modifies a risky artifact", () => {
    const fixture = createRepository();
    write(fixture.repoPath, "ROOT.LOG", "changed risky artifact\n");
    write(fixture.repoPath, ".scratch/new-session.json", canarySecret);
    git(fixture.repoPath, "add", "--all");
    commit(fixture.repoPath, "-m", "change risky artifacts");

    const result = runCli(
      fixture.repoPath,
      "check",
      "HEAD",
      "origin/main",
    );
    const report = JSON.parse(result.stderr);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(report.recordType).toBe("SecurityArtifactDiffAuditV1");
    expect(report.findings).toEqual([
      expect.objectContaining({
        ref: "HEAD",
        path:
          process.platform === "win32"
            ? ".ScRaTcH/new-session.json"
            : ".scratch/new-session.json",
        rule: "TRACKED_SCRATCH_PATH",
      }),
      expect.objectContaining({
        ref: "HEAD",
        path: "ROOT.LOG",
        rule: "ROOT_TEMP_FILE",
      }),
    ]);
    expect(`${result.stdout}${result.stderr}`).not.toContain(canarySecret);
  });

  it("allows a pure deletion but catches a risky artifact added then deleted", () => {
    const fixture = createRepository();
    unlinkSync(path.join(fixture.repoPath, "capture.PNG"));
    git(fixture.repoPath, "add", "--all");
    commit(fixture.repoPath, "-m", "delete legacy capture");

    const deletionResult = runCli(
      fixture.repoPath,
      "check",
      "HEAD",
      "origin/main",
    );

    expect(deletionResult.status).toBe(0);
    expect(JSON.parse(deletionResult.stdout).findings).toEqual([]);

    write(fixture.repoPath, ".tmp/transient.log", canarySecret);
    git(fixture.repoPath, "add", "--all");
    commit(fixture.repoPath, "-m", "add transient risky artifact");
    unlinkSync(path.join(fixture.repoPath, ".tmp", "transient.log"));
    git(fixture.repoPath, "add", "--all");
    commit(fixture.repoPath, "-m", "delete transient risky artifact");

    const historyResult = runCli(
      fixture.repoPath,
      "check",
      "HEAD",
      "origin/main",
    );
    const historyReport = JSON.parse(historyResult.stderr);

    expect(historyResult.status).toBe(1);
    expect(historyReport.findings).toEqual([
      expect.objectContaining({
        ref: "HEAD",
        path:
          process.platform === "win32"
            ? ".TmP/transient.log"
            : ".tmp/transient.log",
        rule: "TRACKED_TMP_PATH",
      }),
    ]);
    expect(`${historyResult.stdout}${historyResult.stderr}`).not.toContain(
      canarySecret,
    );
  });

  it("prints JSON and exits zero in report mode even when findings exist", () => {
    const fixture = createRepository();

    const result = runCli(fixture.repoPath, "report");
    const report = JSON.parse(result.stdout);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(report.recordType).toBe("SecurityArtifactAuditV1");
    expect(report.summary.findingCount).toBeGreaterThan(0);
    expect(`${result.stdout}${result.stderr}`).not.toContain(canarySecret);
  });

  it("prints the secret-safe report to stderr and fails check mode when findings exist", () => {
    const fixture = createRepository();

    const result = runCli(fixture.repoPath, "check");
    const report = JSON.parse(result.stderr);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(report.recordType).toBe("SecurityArtifactAuditV1");
    expect(report.summary.findingCount).toBeGreaterThan(0);
    expect(`${result.stdout}${result.stderr}`).not.toContain(canarySecret);
  });

  it("passes check mode with JSON stdout when only allowlisted paths exist", () => {
    const fixture = createRepository({ withFindings: false });

    const result = runCli(fixture.repoPath, "check");
    const report = JSON.parse(result.stdout);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(report.summary.findingCount).toBe(0);
  });

  it("fails closed with a stable code when a ref cannot be read", () => {
    const fixture = createRepository();

    const result = runCli(fixture.repoPath, "report", "origin/missing");

    expect(result.status).toBe(3);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr)).toEqual({
      schemaVersion: 1,
      recordType: "SecurityArtifactAuditErrorV1",
      code: "REF_LOOKUP_FAILED",
    });
    expect(`${result.stdout}${result.stderr}`).not.toContain(canarySecret);
  });

  it("redacts timeout and maxBuffer command failures behind a stable error record", async () => {
    const fixture = createRepository({ withFindings: false });
    const { auditSecurityArtifacts, executeSecurityArtifactCommand } =
      await loadLibrary();
    const { runSecurityArtifactAuditCli } = await loadCli();

    for (const errorCode of ["ETIMEDOUT", "ENOBUFS"]) {
      let stdout = "";
      let stderr = "";
      const commandRunner = (command, args, options) => {
        if (args[0] === "rev-parse" && args[1] === "--verify") {
          return {
            error: Object.assign(new Error(canarySecret), { code: errorCode }),
            signal: errorCode === "ETIMEDOUT" ? "SIGTERM" : null,
            status: null,
            stderr: Buffer.from(canarySecret),
            stdout: Buffer.from(canarySecret),
          };
        }
        return executeSecurityArtifactCommand(command, args, options);
      };

      const exitCode = runSecurityArtifactAuditCli({
        argv: [
          "--repo",
          fixture.repoPath,
          "--mode",
          "report",
          "--refs",
          "origin/main",
        ],
        audit: (options) =>
          auditSecurityArtifacts({ ...options, commandRunner }),
        writeStderr: (value) => {
          stderr += value;
        },
        writeStdout: (value) => {
          stdout += value;
        },
      });

      expect(exitCode).toBe(3);
      expect(stdout).toBe("");
      expect(JSON.parse(stderr)).toEqual({
        schemaVersion: 1,
        recordType: "SecurityArtifactAuditErrorV1",
        code: "REF_LOOKUP_FAILED",
      });
      expect(stderr).not.toContain(canarySecret);
    }
  });

  it("reports a risky path deleted from both ref tips without leaking its content or commit SHAs", () => {
    const fixture = createRepository({
      withDeletedFinding: true,
      withFindings: false,
    });
    const commitShas = git(fixture.repoPath, "rev-list", "--all").split(/\r?\n/u);

    const reportResult = runCli(fixture.repoPath, "report");
    const report = JSON.parse(reportResult.stdout);
    const checkResult = runCli(fixture.repoPath, "check");
    const checkReport = JSON.parse(checkResult.stderr);

    expect(reportResult.status).toBe(0);
    expect(reportResult.stderr).toBe("");
    expect(report.findings).toEqual([
      expect.objectContaining({
        ref: "collab/main",
        path: ".scratch/deleted-session.json",
        rule: "TRACKED_SCRATCH_PATH",
        historyCommitCount: 2,
      }),
      expect.objectContaining({
        ref: "origin/main",
        path: ".scratch/deleted-session.json",
        rule: "TRACKED_SCRATCH_PATH",
        historyCommitCount: 2,
      }),
    ]);
    expect(checkResult.status).toBe(1);
    expect(checkResult.stdout).toBe("");
    expect(checkReport).toEqual(report);
    const expectedCommitHashes = git(
      fixture.repoPath,
      "log",
      "--format=%H",
      "origin/main",
      "--",
      ".scratch/deleted-session.json",
    )
      .split(/\r?\n/u)
      .filter(Boolean)
      .map((commitSha) =>
        createHash("sha256").update(commitSha).digest("hex"),
      )
      .sort();
    for (const finding of report.findings) {
      expect(finding.commitHashes).toEqual(expectedCommitHashes);
      expect(finding.commitHashes).toHaveLength(finding.historyCommitCount);
    }
    expect(
      `${reportResult.stdout}${reportResult.stderr}${checkResult.stdout}${checkResult.stderr}`,
    ).not.toContain(canarySecret);
    for (const commitSha of commitShas) {
      expect(JSON.stringify(report)).not.toContain(commitSha);
    }
  });

  it("rejects a symbolic or reparse repository path without invoking Git there", () => {
    const fixture = createRepository();
    const linkedPath = path.join(fixture.fixtureRoot, "repository-link");
    symlinkSync(
      fixture.repoPath,
      linkedPath,
      process.platform === "win32" ? "junction" : "dir",
    );

    const result = runCli(linkedPath, "report");

    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr)).toEqual({
      schemaVersion: 1,
      recordType: "SecurityArtifactAuditErrorV1",
      code: "REPOSITORY_PATH_SYMLINK",
    });
  });

  it("uses shell:false and a bounded timeout, and rejects escaped tree paths", async () => {
    const fixture = createRepository({ withFindings: false });
    const { auditSecurityArtifacts, executeSecurityArtifactCommand } =
      await loadLibrary();
    const commandOptions = [];
    const commandRunner = (command, args, options) => {
      commandOptions.push(options);
      if (args[0] === "ls-tree") {
        return {
          status: 0,
          stdout: Buffer.from("../escape.log\0"),
          stderr: Buffer.alloc(0),
        };
      }
      return executeSecurityArtifactCommand(command, args, options);
    };

    expect(() =>
      auditSecurityArtifacts({
        repoPath: fixture.repoPath,
        refs: ["origin/main"],
        commandRunner,
      }),
    ).toThrow(expect.objectContaining({ code: "TREE_PATH_INVALID" }));
    expect(commandOptions.length).toBeGreaterThan(0);
    expect(
      commandOptions.every(
        (options) =>
          options.shell === false &&
          Object.keys(options.env).length === 0 &&
          Number.isInteger(options.timeout) &&
          options.timeout > 0 &&
          options.timeout <= 30_000,
      ),
    ).toBe(true);
  });

  it("fails closed when a risky tip path has no commit evidence", async () => {
    const fixture = createRepository({ withFindings: false });
    const { auditSecurityArtifacts, executeSecurityArtifactCommand } =
      await loadLibrary();
    const commandRunner = (command, args, options) => {
      if (args[0] === "ls-tree") {
        return {
          status: 0,
          stdout: Buffer.from(".scratch/orphan.log\0"),
          stderr: Buffer.alloc(0),
        };
      }
      if (args[0] === "log") {
        return {
          status: 0,
          stdout: Buffer.alloc(0),
          stderr: Buffer.alloc(0),
        };
      }
      return executeSecurityArtifactCommand(command, args, options);
    };

    expect(() =>
      auditSecurityArtifacts({
        repoPath: fixture.repoPath,
        refs: ["origin/main"],
        commandRunner,
      }),
    ).toThrow(expect.objectContaining({ code: "HISTORY_PATH_INVALID" }));
  });

  it("resolves a mutable ref once and uses only that internal commit for tip and history", async () => {
    const fixture = createRepository({ withFindings: false });
    const { auditSecurityArtifacts, executeSecurityArtifactCommand } =
      await loadLibrary();
    const resolvedSha = "b".repeat(40);
    let resolveArgs = null;
    let historyArgs = null;
    const commandRunner = (command, args, options) => {
      if (args[0] === "rev-parse" && args[1] === "--verify") {
        resolveArgs = args;
        return {
          status: 0,
          stdout: Buffer.from(`${resolvedSha}\n`),
          stderr: Buffer.alloc(0),
        };
      }
      if (args[0] === "ls-tree") {
        expect(args.at(-1)).toBe(resolvedSha);
        return {
          status: 0,
          stdout: Buffer.from("root[*].log\0"),
          stderr: Buffer.alloc(0),
        };
      }
      if (args[0] === "log") {
        expect(args).not.toContain("origin/main");
        historyArgs = args;
        return {
          status: 0,
          stdout: Buffer.from(
            `COMMIT:${resolvedSha}\0\0\n:100644 100644 a b M\0root[*].log\0` +
              `COMMIT:${"c".repeat(40)}\0\0\n:100644 100644 b c M\0root[*].log\0`,
          ),
          stderr: Buffer.alloc(0),
        };
      }
      return executeSecurityArtifactCommand(command, args, options);
    };

    const report = auditSecurityArtifacts({
      repoPath: fixture.repoPath,
      refs: ["origin/main"],
      commandRunner,
    });

    expect(report.summary.findingCount).toBe(1);
    expect(resolveArgs).toEqual([
      "rev-parse",
      "--verify",
      "origin/main^{commit}",
    ]);
    expect(historyArgs).toEqual([
      "log",
      "--format=COMMIT:%H%x00",
      "--raw",
      "-z",
      "--no-renames",
      "--root",
      "-m",
      resolvedSha,
      "--",
    ]);
    expect(report.findings[0].historyCommitCount).toBe(2);
    expect(report.findings[0].commitHashes).toEqual(
      [resolvedSha, "c".repeat(40)]
        .map((commitSha) =>
          createHash("sha256").update(commitSha).digest("hex"),
        )
        .sort(),
    );
    expect(JSON.stringify(report)).not.toContain(resolvedSha);
  });
});
