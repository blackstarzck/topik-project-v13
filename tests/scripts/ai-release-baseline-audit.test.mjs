import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const temporaryRoots = [];
const BASELINE_SHA = "e91e4aa3acfb8610d0ec413c3dfc206408d1f4ad";
const OTHER_SHA = "b".repeat(40);
const SHA = { source: "1".repeat(40), stg: "3".repeat(40) };

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    shell: false,
    timeout: 20_000,
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args[0]} failed`);
  }
  return result.stdout.trim();
}

function commit(cwd, message) {
  run("git", ["add", "-A"], cwd);
  run(
    "git",
    [
      "-c",
      "user.name=Baseline Audit Fixture",
      "-c",
      "user.email=baseline-audit@example.test",
      "commit",
      "-m",
      message,
    ],
    cwd,
  );
  return run("git", ["rev-parse", "HEAD"], cwd);
}

function write(rootDir, relativePath, content = "fixture\n") {
  const target = path.join(rootDir, ...relativePath.split("/"));
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function temporaryRoot(prefix) {
  const root = realpathSync.native(mkdtempSync(path.join(tmpdir(), prefix)));
  temporaryRoots.push(root);
  return root;
}

function createFixtureRepository() {
  const repoPath = path.join(temporaryRoot("ai-release-baseline-"), "repository");
  mkdirSync(repoPath, { recursive: true });
  run("git", ["init", "--initial-branch=main"], repoPath);
  write(repoPath, "supabase/migrations/20260723000000_safe.sql", "select 1;\n");
  const baselineSha = commit(repoPath, "baseline");

  write(repoPath, ".env.example", "PUBLIC_PLACEHOLDER=\n");
  write(repoPath, "supabase/migrations/down/rollback.sql", "drop view v;\n");
  write(repoPath, "tools/debug.sql", "select 'diagnostic';\n");
  write(repoPath, "tools/Rollback.SQL", "drop table t;\n");
  write(repoPath, ".scratch/notes.md", "scratch note\n");
  commit(repoPath, "add audited paths");

  return { repoPath, baselineSha };
}

function diffAudit(overrides = {}) {
  const payload = {
    schemaVersion: 1,
    recordType: "SecurityArtifactDiffAuditV1",
    baseline: { ref: BASELINE_SHA, commitHash: digest(BASELINE_SHA) },
    refs: ["collab/main", "collab/stg", "origin/main"],
    snapshots: [
      { ref: "collab/main", commitHash: digest(SHA.stg) },
      { ref: "collab/stg", commitHash: digest(SHA.stg) },
      { ref: "origin/main", commitHash: digest(SHA.source) },
    ],
    findings: [],
    summary: { refCount: 3, scannedPathCount: 12, findingCount: 0 },
    ...overrides,
  };
  return { ...payload, fingerprint: digest(JSON.stringify(payload)) };
}

function fullAudit(overrides = {}) {
  const payload = {
    schemaVersion: 1,
    recordType: "SecurityArtifactAuditV1",
    refs: ["collab/main", "collab/stg", "origin/main"],
    snapshots: [
      { ref: "collab/main", commitHash: digest(SHA.stg) },
      { ref: "collab/stg", commitHash: digest(SHA.stg) },
      { ref: "origin/main", commitHash: digest(SHA.source) },
    ],
    findings: [],
    summary: { refCount: 3, scannedPathCount: 12, findingCount: 0 },
    ...overrides,
  };
  return { ...payload, fingerprint: digest(JSON.stringify(payload)) };
}

function ruleByPath(audit) {
  return Object.fromEntries(audit.findings.map((finding) => [finding.path, finding.rule]));
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("approved path allowlist", () => {
  it("exempts only an exact path and rule pair", async () => {
    const { auditSecurityArtifactChanges } = await import(
      "../../scripts/lib/security-artifact-audit.mjs"
    );
    const { repoPath, baselineSha } = createFixtureRepository();

    const unfiltered = auditSecurityArtifactChanges({
      baselineRef: baselineSha,
      repoPath,
      refs: ["main"],
    });
    expect(ruleByPath(unfiltered)).toEqual({
      ".env.example": "TRACKED_ENV_FILE",
      ".scratch/notes.md": "TRACKED_SCRATCH_PATH",
      "supabase/migrations/down/rollback.sql": "UNAPPROVED_SQL_PATH",
      "tools/debug.sql": "UNAPPROVED_SQL_PATH",
      "tools/Rollback.SQL": "UNAPPROVED_SQL_PATH",
    });

    const filtered = auditSecurityArtifactChanges({
      approvedPathAllowlist: [
        { path: ".env.example", rule: "TRACKED_ENV_FILE" },
        { path: "supabase/migrations/down/rollback.sql", rule: "UNAPPROVED_SQL_PATH" },
        { path: "tools/rollback.sql", rule: "UNAPPROVED_SQL_PATH" },
        { path: "tools/debug.sql", rule: "TEMPORARY_SCRIPT_PATH" },
      ],
      baselineRef: baselineSha,
      repoPath,
      refs: ["main"],
    });
    expect(ruleByPath(filtered)).toEqual({
      ".scratch/notes.md": "TRACKED_SCRATCH_PATH",
      "tools/debug.sql": "UNAPPROVED_SQL_PATH",
      "tools/Rollback.SQL": "UNAPPROVED_SQL_PATH",
    });
    expect(filtered.summary.findingCount).toBe(3);
  });

  it("keeps a path whose letter case differs from the exception blocked", async () => {
    const { auditSecurityArtifactChanges, auditSecurityArtifacts } = await import(
      "../../scripts/lib/security-artifact-audit.mjs"
    );
    const { repoPath, baselineSha } = createFixtureRepository();

    const wrongCasing = [{ path: "tools/rollback.sql", rule: "UNAPPROVED_SQL_PATH" }];
    const exactCasing = [{ path: "tools/Rollback.SQL", rule: "UNAPPROVED_SQL_PATH" }];

    expect(
      ruleByPath(
        auditSecurityArtifactChanges({
          approvedPathAllowlist: wrongCasing,
          baselineRef: baselineSha,
          repoPath,
          refs: ["main"],
        }),
      )["tools/Rollback.SQL"],
    ).toBe("UNAPPROVED_SQL_PATH");
    expect(
      ruleByPath(auditSecurityArtifacts({ approvedPathAllowlist: wrongCasing, repoPath, refs: ["main"] }))[
        "tools/Rollback.SQL"
      ],
    ).toBe("UNAPPROVED_SQL_PATH");
    expect(
      ruleByPath(
        auditSecurityArtifactChanges({
          approvedPathAllowlist: exactCasing,
          baselineRef: baselineSha,
          repoPath,
          refs: ["main"],
        }),
      )["tools/Rollback.SQL"],
    ).toBeUndefined();
    expect(
      ruleByPath(auditSecurityArtifacts({ approvedPathAllowlist: exactCasing, repoPath, refs: ["main"] }))[
        "tools/Rollback.SQL"
      ],
    ).toBeUndefined();
  });

  it("accepts two exceptions that differ only in letter case as separate files", async () => {
    const { auditSecurityArtifactChanges } = await import(
      "../../scripts/lib/security-artifact-audit.mjs"
    );
    const { repoPath, baselineSha } = createFixtureRepository();

    const report = auditSecurityArtifactChanges({
      approvedPathAllowlist: [
        { path: "tools/rollback.sql", rule: "UNAPPROVED_SQL_PATH" },
        { path: "tools/Rollback.SQL", rule: "UNAPPROVED_SQL_PATH" },
      ],
      baselineRef: baselineSha,
      repoPath,
      refs: ["main"],
    });
    expect(ruleByPath(report)["tools/Rollback.SQL"]).toBeUndefined();
  });

  it("keeps a different rule on an allowlisted path blocked in the full-history audit", async () => {
    const { auditSecurityArtifacts } = await import(
      "../../scripts/lib/security-artifact-audit.mjs"
    );
    const { repoPath } = createFixtureRepository();

    const unfiltered = auditSecurityArtifacts({ repoPath, refs: ["main"] });
    expect(ruleByPath(unfiltered)["tools/debug.sql"]).toBe("UNAPPROVED_SQL_PATH");

    const wrongRule = auditSecurityArtifacts({
      approvedPathAllowlist: [{ path: "tools/debug.sql", rule: "TRACKED_TMP_PATH" }],
      repoPath,
      refs: ["main"],
    });
    expect(ruleByPath(wrongRule)["tools/debug.sql"]).toBe("UNAPPROVED_SQL_PATH");

    const exactRule = auditSecurityArtifacts({
      approvedPathAllowlist: [{ path: "tools/debug.sql", rule: "UNAPPROVED_SQL_PATH" }],
      repoPath,
      refs: ["main"],
    });
    expect(ruleByPath(exactRule)["tools/debug.sql"]).toBeUndefined();
  });

  it("rejects malformed allowlist entries", async () => {
    const { auditSecurityArtifactChanges, auditSecurityArtifacts } = await import(
      "../../scripts/lib/security-artifact-audit.mjs"
    );
    const { repoPath, baselineSha } = createFixtureRepository();

    for (const approvedPathAllowlist of [
      "not-an-array",
      [{ path: "tools/debug.sql" }],
      [{ path: "tools/debug.sql", rule: "UNAPPROVED_SQL_PATH", reason: "extra" }],
      [{ path: "../outside.sql", rule: "UNAPPROVED_SQL_PATH" }],
      [{ path: "tools\\debug.sql", rule: "UNAPPROVED_SQL_PATH" }],
      [{ path: "/tools/debug.sql", rule: "UNAPPROVED_SQL_PATH" }],
      [{ path: "tools/./debug.sql", rule: "UNAPPROVED_SQL_PATH" }],
      [{ path: "tools/debug.sql", rule: "NOT_A_REAL_RULE" }],
      [{ path: "tools/debug.sql", rule: "unapproved_sql_path" }],
      [
        { path: "tools/debug.sql", rule: "UNAPPROVED_SQL_PATH" },
        { path: "tools/debug.sql", rule: "UNAPPROVED_SQL_PATH" },
      ],
    ]) {
      expect(() =>
        auditSecurityArtifactChanges({
          approvedPathAllowlist,
          baselineRef: baselineSha,
          repoPath,
          refs: ["main"],
        }),
      ).toThrowError("APPROVED_PATH_ALLOWLIST_INVALID");
      expect(() =>
        auditSecurityArtifacts({ approvedPathAllowlist, repoPath, refs: ["main"] }),
      ).toThrowError("APPROVED_PATH_ALLOWLIST_INVALID");
    }
  });
});

describe("baseline diff audit evidence", () => {
  it("accepts a diff audit bound to the expected baseline SHA", async () => {
    const { validateSecurityAuditEvidence } = await import(
      "../../scripts/lib/ai-release-promotion.mjs"
    );

    expect(
      validateSecurityAuditEvidence(
        diffAudit(),
        ["collab/main", "collab/stg", "origin/main"],
        {
          sourceSha: SHA.source,
          stgBaseSha: SHA.stg,
          stgReady: true,
          expectedBaselineSha: BASELINE_SHA,
        },
      ),
    ).toEqual({ ok: true, code: "SECURITY_AUDIT_CLEAR" });
  });

  it("blocks a diff audit whose baseline does not match the approved SHA", async () => {
    const { validateSecurityAuditEvidence } = await import(
      "../../scripts/lib/ai-release-promotion.mjs"
    );
    const refs = ["collab/main", "collab/stg", "origin/main"];

    expect(
      validateSecurityAuditEvidence(diffAudit(), refs, {
        expectedBaselineSha: OTHER_SHA,
      }),
    ).toEqual({ ok: false, code: "SECURITY_AUDIT_BASELINE_MISMATCH" });
    expect(
      validateSecurityAuditEvidence(
        diffAudit({ baseline: { ref: BASELINE_SHA, commitHash: digest(OTHER_SHA) } }),
        refs,
        { expectedBaselineSha: BASELINE_SHA },
      ),
    ).toEqual({ ok: false, code: "SECURITY_AUDIT_BASELINE_MISMATCH" });
  });

  it("blocks a diff audit whose baseline ref is not the approved baseline", async () => {
    const { validateSecurityAuditEvidence } = await import(
      "../../scripts/lib/ai-release-promotion.mjs"
    );
    const refs = ["collab/main", "collab/stg", "origin/main"];

    for (const ref of [OTHER_SHA, "refs/heads/other", BASELINE_SHA.toUpperCase()]) {
      expect(
        validateSecurityAuditEvidence(
          diffAudit({ baseline: { ref, commitHash: digest(BASELINE_SHA) } }),
          refs,
          { expectedBaselineSha: BASELINE_SHA },
        ),
      ).toEqual({ ok: false, code: "SECURITY_AUDIT_BASELINE_MISMATCH" });
    }
    expect(
      validateSecurityAuditEvidence(diffAudit(), refs, {
        expectedBaselineSha: BASELINE_SHA,
        expectedBaselineRef: "origin/main-mirror",
      }),
    ).toEqual({ ok: false, code: "SECURITY_AUDIT_BASELINE_MISMATCH" });
  });

  it("requires an expected baseline SHA for a diff audit", async () => {
    const { validateSecurityAuditEvidence } = await import(
      "../../scripts/lib/ai-release-promotion.mjs"
    );
    const refs = ["collab/main", "collab/stg", "origin/main"];

    expect(validateSecurityAuditEvidence(diffAudit(), refs)).toEqual({
      ok: false,
      code: "SECURITY_AUDIT_BASELINE_REQUIRED",
    });
    expect(
      validateSecurityAuditEvidence(diffAudit(), refs, { expectedBaselineSha: "short" }),
    ).toEqual({ ok: false, code: "SECURITY_AUDIT_BASELINE_REQUIRED" });
  });

  it("rejects a diff audit with a malformed or self-referential baseline block", async () => {
    const { validateSecurityAuditEvidence } = await import(
      "../../scripts/lib/ai-release-promotion.mjs"
    );
    const refs = ["collab/main", "collab/stg", "origin/main"];

    for (const baseline of [
      { ref: BASELINE_SHA },
      { ref: BASELINE_SHA, commitHash: digest(BASELINE_SHA), extra: "no" },
      { ref: "", commitHash: digest(BASELINE_SHA) },
      { ref: "origin/main", commitHash: digest(BASELINE_SHA) },
    ]) {
      expect(
        validateSecurityAuditEvidence(diffAudit({ baseline }), refs, {
          expectedBaselineSha: BASELINE_SHA,
        }),
      ).toEqual({ ok: false, code: "SECURITY_AUDIT_SCHEMA_INVALID" });
    }
  });

  it("still blocks a diff audit that carries any finding", async () => {
    const { createPromotionRun, validateSecurityAuditEvidence } = await import(
      "../../scripts/lib/ai-release-promotion.mjs"
    );
    const audit = diffAudit({
      findings: [
        {
          ref: "origin/main",
          path: ".scratch/session.json",
          rule: "TRACKED_SCRATCH_PATH",
          historyCommitCount: 1,
          commitHashes: [digest("commit")],
          pathHash: digest(".scratch/session.json"),
        },
      ],
      summary: { refCount: 3, scannedPathCount: 12, findingCount: 1 },
    });

    expect(
      validateSecurityAuditEvidence(audit, ["collab/main", "collab/stg", "origin/main"], {
        expectedBaselineSha: BASELINE_SHA,
      }),
    ).toEqual({ ok: false, code: "SECURITY_INCIDENT_BLOCKED" });
    expect(() =>
      createPromotionRun({
        runId: "promotion-20260730-11111111",
        now: "2026-07-30T01:00:00.000Z",
        sourceSha: SHA.source,
        sourceTreeHash: "2".repeat(40),
        stgBaseSha: SHA.stg,
        securityAudit: audit,
        expectedSecurityRefs: ["collab/main", "collab/stg", "origin/main"],
        expectedBaselineSha: BASELINE_SHA,
        controlPlaneReady: true,
        stgReady: true,
        vercelProject: "topik-project-v13",
        vercelDomain: "talkpik.example.com",
      }),
    ).toThrowError("SECURITY_INCIDENT_BLOCKED");
  });

  it("keeps the legacy full-history audit record accepted without a baseline", async () => {
    const { validateSecurityAuditEvidence } = await import(
      "../../scripts/lib/ai-release-promotion.mjs"
    );
    const refs = ["collab/main", "collab/stg", "origin/main"];

    expect(
      validateSecurityAuditEvidence(fullAudit(), refs, {
        sourceSha: SHA.source,
        stgBaseSha: SHA.stg,
        stgReady: true,
      }),
    ).toEqual({ ok: true, code: "SECURITY_AUDIT_CLEAR" });
    expect(
      validateSecurityAuditEvidence(
        fullAudit({
          baseline: { ref: BASELINE_SHA, commitHash: digest(BASELINE_SHA) },
        }),
        refs,
        { expectedBaselineSha: BASELINE_SHA },
      ),
    ).toEqual({ ok: false, code: "SECURITY_AUDIT_SCHEMA_INVALID" });
  });
});

describe("approved baseline configuration", () => {
  it("registers the measured exception inventory under a closed fingerprinted schema", async () => {
    const { SECURITY_ARTIFACT_RULE_NAMES } = await import(
      "../../scripts/lib/security-artifact-audit.mjs"
    );
    const { stableFingerprint } = await import(
      "../../scripts/lib/ai-release-promotion.mjs"
    );
    const config = JSON.parse(
      readFileSync(path.resolve("config/security-audit-baseline.json"), "utf8"),
    );

    expect(Object.keys(config).sort()).toEqual([
      "approvedAt",
      "baselineSha",
      "exceptions",
      "fingerprint",
      "recordType",
      "refs",
      "schemaVersion",
    ]);
    expect(config.schemaVersion).toBe(1);
    expect(config.recordType).toBe("SecurityAuditBaselineV1");
    expect(config.baselineSha).toBe(BASELINE_SHA);
    expect(config.refs).toEqual(["collab/main", "collab/stg", "origin/main"]);
    expect(config.exceptions).toHaveLength(205);
    for (const exception of config.exceptions) {
      expect(Object.keys(exception).sort()).toEqual(["path", "reason", "rule"]);
      expect(SECURITY_ARTIFACT_RULE_NAMES).toContain(exception.rule);
      expect(exception.path).not.toMatch(/\\|^\/|(?:^|\/)\.\.(?:\/|$)/u);
      expect(exception.reason.trim().length).toBeGreaterThan(0);
    }
    expect(
      new Set(config.exceptions.map((entry) => `${entry.path} ${entry.rule}`)).size,
    ).toBe(205);

    const payload = structuredClone(config);
    delete payload.fingerprint;
    expect(config.fingerprint).toBe(stableFingerprint(payload));
  });

  it("loads and validates the approved baseline configuration", async () => {
    const { loadSecurityAuditBaseline, validateSecurityBaselineConfig } = await import(
      "../../scripts/ai-release.mjs"
    );

    expect(loadSecurityAuditBaseline().baselineSha).toBe(BASELINE_SHA);

    const root = temporaryRoot("ai-release-baseline-config-");
    const configPath = path.join(root, "security-audit-baseline.json");
    const valid = JSON.parse(
      readFileSync(path.resolve("config/security-audit-baseline.json"), "utf8"),
    );
    writeFileSync(configPath, JSON.stringify(valid));
    expect(
      loadSecurityAuditBaseline({ configPath, allowedRoot: root }).baselineSha,
    ).toBe(BASELINE_SHA);

    for (const broken of [
      "{ not json",
      JSON.stringify({ ...valid, fingerprint: digest("tampered") }),
      JSON.stringify({ ...valid, baselineSha: "not-a-sha" }),
      JSON.stringify({ ...valid, extraField: 1 }),
      JSON.stringify({
        ...valid,
        exceptions: [{ path: "a.sql", rule: "NOT_A_REAL_RULE", reason: "x" }],
      }),
      JSON.stringify({
        ...valid,
        exceptions: [{ path: "../a.sql", rule: "UNAPPROVED_SQL_PATH", reason: "x" }],
      }),
      JSON.stringify({ ...valid, refs: ["origin/main", "collab/main"] }),
      JSON.stringify({ ...valid, approvedAt: "not-a-timestamp" }),
      JSON.stringify({ ...valid, approvedAt: "2026-13-40T99:00:00.000Z" }),
      JSON.stringify({ ...valid, approvedAt: "2026-07-30T01:00:00Z" }),
    ]) {
      writeFileSync(configPath, broken);
      expect(() => loadSecurityAuditBaseline({ configPath, allowedRoot: root })).toThrowError(
        "SECURITY_BASELINE_CONFIG_INVALID",
      );
    }
    expect(() =>
      loadSecurityAuditBaseline({
        configPath: path.join(root, "missing.json"),
        allowedRoot: root,
      }),
    ).toThrowError("SECURITY_BASELINE_CONFIG_INVALID");
    expect(() => validateSecurityBaselineConfig(null)).toThrowError(
      "SECURITY_BASELINE_CONFIG_INVALID",
    );
  });
});

describe("release start baseline binding", () => {
  it("audits only the approved baseline diff with the approved exceptions", async () => {
    const { collectReleaseStartEvidence } = await import("../../scripts/ai-release.mjs");
    const config = JSON.parse(
      readFileSync(path.resolve("config/security-audit-baseline.json"), "utf8"),
    );
    const repository = temporaryRoot("ai-release-start-");
    const audit = vi.fn(() =>
      diffAudit({
        refs: ["collab/main", "origin/main"],
        snapshots: [
          { ref: "collab/main", commitHash: digest(SHA.stg) },
          { ref: "origin/main", commitHash: digest(SHA.source) },
        ],
        summary: { refCount: 2, scannedPathCount: 8, findingCount: 0 },
      }),
    );
    const evidence = collectReleaseStartEvidence({
      repoPath: repository,
      stgReady: false,
      commandRunner(command, args) {
        const stdout = new Map([
          ["remote get-url origin", "https://github.com/blackstarzck/topik-project-v13.git\n"],
          ["remote get-url collab", "https://github.com/keduall/topik-project-v13.git\n"],
          ["rev-parse --verify origin/main^{commit}", `${SHA.source}\n`],
          ["rev-parse --verify origin/main^{tree}", `${"2".repeat(40)}\n`],
          ["rev-parse --verify collab/main^{commit}", `${SHA.stg}\n`],
        ]).get(args.join(" "));
        return stdout === undefined
          ? { status: 1, stdout: "", stderr: "" }
          : { status: 0, stdout, stderr: "" };
      },
      audit,
    });

    expect(evidence.baselineSha).toBe(BASELINE_SHA);
    expect(audit).toHaveBeenCalledOnce();
    const [auditInput] = audit.mock.calls[0];
    expect(auditInput.baselineRef).toBe(BASELINE_SHA);
    expect(auditInput.refs).toEqual(["collab/main", "origin/main"]);
    expect(auditInput.approvedPathAllowlist).toEqual(
      config.exceptions.map(({ path: entryPath, rule }) => ({ path: entryPath, rule })),
    );
    expect(
      auditInput.approvedPathAllowlist.every(
        (entry) => Object.keys(entry).sort().join(",") === "path,rule",
      ),
    ).toBe(true);
  });

  it("fails closed instead of silently auditing the full history", async () => {
    const { collectReleaseStartEvidence } = await import("../../scripts/ai-release.mjs");
    const root = temporaryRoot("ai-release-start-broken-");
    const configPath = path.join(root, "security-audit-baseline.json");
    writeFileSync(configPath, JSON.stringify({ schemaVersion: 1 }));
    const audit = vi.fn();
    const commandRunner = vi.fn();

    expect(() =>
      collectReleaseStartEvidence({
        repoPath: root,
        baselineConfigPath: configPath,
        audit,
        commandRunner,
      }),
    ).toThrowError("SECURITY_BASELINE_CONFIG_INVALID");
    expect(audit).not.toHaveBeenCalled();
    expect(commandRunner).not.toHaveBeenCalled();
  });
});
