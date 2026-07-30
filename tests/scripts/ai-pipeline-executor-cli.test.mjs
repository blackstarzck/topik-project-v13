import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const executorCli = path.join(projectRoot, "scripts", "ai-pipeline-executor.mjs");
const roots = [];
const RUN_ID = "promotion-20260723-11111111";
const SHA = {
  source: "1".repeat(40),
  tree: "2".repeat(40),
  stg: "3".repeat(40),
  candidate: "4".repeat(40),
  stgMerged: "7".repeat(40),
};

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function temporaryRoot() {
  const root = realpathSync.native(mkdtempSync(path.join(tmpdir(), "ai-pipeline-executor-")));
  roots.push(root);
  return root;
}

function git(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    shell: false,
    timeout: 20_000,
    windowsHide: true,
  });
  if (result.status !== 0) throw new Error(`git ${args[0]} failed in fixture`);
  return String(result.stdout ?? "").trim();
}

function securityAudit() {
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
    summary: { refCount: 3, scannedPathCount: 24, findingCount: 0 },
  };
  return { ...payload, fingerprint: digest(JSON.stringify(payload)) };
}

function migrationEvidence() {
  return {
    productionProjectIdentityHash: digest("production-project"),
    remoteTrackerDigest: digest("tracker"),
    trackerIsExactManifestPrefix: true,
    schemaRpcRlsGrantFingerprint: digest("schema-rpc-rls-grant"),
    appliedMigrationManifestDigest: digest("applied-migrations"),
    backupPitrEvidenceDigest: digest("backup-pitr"),
    pinnedToolchainDigest: digest("supabase-cli-action"),
    previousMaxTimestamp: "20260722000000",
    newMigrations: [
      {
        path: "supabase/migrations/20260723000000_forward_fix.sql",
        timestamp: "20260723000000",
        sha256: digest("forward migration"),
      },
    ],
    historicalChanges: [],
    dryRunDigest: digest("planned apply"),
    applyDigest: digest("planned apply"),
    destructiveSql: false,
    grantRevocation: false,
    compatibilityBreak: false,
    nMinusOneTopikDevPassed: true,
    nTopikDevPassed: true,
    autoApplyEnabled: false,
  };
}

async function awaitingApprovalRun() {
  const {
    advancePromotionRun,
    createApprovalPolicy,
    createPromotionRun,
  } = await import("../../scripts/lib/ai-release-promotion.mjs");
  let record = createPromotionRun({
    runId: RUN_ID,
    now: "2026-07-23T10:00:00.000Z",
    sourceSha: SHA.source,
    sourceTreeHash: SHA.tree,
    stgBaseSha: SHA.stg,
    securityAudit: securityAudit(),
    expectedSecurityRefs: ["collab/main", "collab/stg", "origin/main"],
    controlPlaneReady: true,
    stgReady: true,
    vercelDomain: "talkpik.example.com",
    vercelProject: "topik-project-v13",
  });
  let policy = createApprovalPolicy({
    contractFingerprint: record.contractFingerprint,
    profileFingerprint: record.profileFingerprint,
  });
  const advance = (event) => {
    const result = advancePromotionRun(record, {
      expectedRevision: record.revision,
      expectedFingerprint: record.fingerprint,
      policy,
      event,
    });
    record = result.record;
    policy = result.policy;
  };
  advance({
    type: "CANDIDATE_VERIFIED",
    at: "2026-07-23T10:01:00.000Z",
    candidateSha: SHA.candidate,
    branch: record.target.candidateBranch,
    baseSha: SHA.stg,
    sourceSha: SHA.source,
    actualParents: [SHA.stg, SHA.source],
    mergeMethod: "merge",
    noFastForward: true,
    targetBranch: "stg",
    directMainPush: false,
  });
  advance({
    type: "STG_PR_OPEN",
    at: "2026-07-23T10:02:00.000Z",
    targetBranch: "stg",
    headBranch: record.target.candidateBranch,
    headSha: SHA.candidate,
  });
  advance({
    type: "STG_READY",
    at: "2026-07-23T10:03:00.000Z",
    stgSha: SHA.stgMerged,
    mergeMethod: "merge",
    actualParents: [SHA.stg, SHA.candidate],
    directMainPush: false,
    previewEvidence: {
      deploymentId: "dpl_preview_001",
      commitSha: SHA.stgMerged,
      project: "topik-project-v13",
      state: "READY",
      target: "preview",
      branch: "stg",
      environmentScope: "topik-dev",
    },
  });
  advance({
    type: "DB_GATE_EVALUATED",
    at: "2026-07-23T10:04:00.000Z",
    migrationEvidence: migrationEvidence(),
  });
  return { record, policy };
}

async function fixtureRepository() {
  const repository = temporaryRoot();
  git(repository, ["init", "--initial-branch=main"]);
  const { writeApprovalPolicy, writePromotionRun } = await import(
    "../../scripts/lib/ai-release-promotion.mjs"
  );
  const { record, policy } = await awaitingApprovalRun();
  const gitCommonDir = path.join(repository, ".git");
  writeApprovalPolicy({ gitCommonDir, policy });
  const runFile = writePromotionRun({ gitCommonDir, record });
  return { gitCommonDir, record, repository, runFile };
}

function runCli(args) {
  const result = spawnSync(process.execPath, [executorCli, ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    shell: false,
    timeout: 60_000,
    windowsHide: true,
  });
  return {
    status: result.status,
    stderr: String(result.stderr ?? ""),
    stdout: String(result.stdout ?? ""),
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe("promotion executor CLI arguments", () => {
  it("rejects unknown commands, unlisted flags, duplicates, and odd token counts", async () => {
    const { parseExecutorArguments } = await import("../../scripts/ai-pipeline-executor.mjs");

    expect(() => parseExecutorArguments([])).toThrowError("EXECUTOR_COMMAND_REQUIRED");
    expect(() => parseExecutorArguments(["promote"])).toThrowError("EXECUTOR_COMMAND_REQUIRED");
    expect(() =>
      parseExecutorArguments(["status", "--repo", "C:\\repo", "--run-id"]),
    ).toThrowError("INVALID_EXECUTOR_ARGUMENTS");
    expect(() =>
      parseExecutorArguments(["status", "--repo", "C:\\repo", "--run-id", RUN_ID, "--force", "true"]),
    ).toThrowError("INVALID_EXECUTOR_ARGUMENTS");
    expect(() =>
      parseExecutorArguments(["status", "--repo", "C:\\repo", "--repo", "C:\\other", "--run-id", RUN_ID]),
    ).toThrowError("INVALID_EXECUTOR_ARGUMENTS");
    expect(() =>
      parseExecutorArguments(["status", "--repo", "--run-id", RUN_ID]),
    ).toThrowError("INVALID_EXECUTOR_ARGUMENTS");
    expect(() => parseExecutorArguments(["status", "--run-id", RUN_ID])).toThrowError(
      "EXECUTOR_REPOSITORY_REQUIRED",
    );
    expect(() => parseExecutorArguments(["status", "--repo", "C:\\repo"])).toThrowError(
      "PROMOTION_RUN_ID_REQUIRED",
    );
    expect(parseExecutorArguments(["status", "--repo", "C:\\repo", "--run-id", RUN_ID])).toEqual({
      command: "status",
      values: { repo: "C:\\repo", "run-id": RUN_ID },
    });
  });

  it("refuses a symbolic repository path", async () => {
    const { safeRepository } = await import("../../scripts/ai-pipeline-executor.mjs");
    const root = temporaryRoot();
    const linkPath = path.join(root, "link-repo");
    let linked = false;
    try {
      symlinkSync(root, linkPath, "junction");
      linked = true;
    } catch {
      // Windows may deny link creation outside developer mode.
    }
    if (linked) {
      expect(() => safeRepository(linkPath)).toThrowError(/EXECUTOR_REPOSITORY_SYMLINK/u);
    }
    expect(() => safeRepository(path.join(root, "missing"))).toThrowError(
      "EXECUTOR_REPOSITORY_INVALID",
    );
  });

  it("keeps next, run, and probe-vercel unimplemented in this step", async () => {
    const { runExecutorCli } = await import("../../scripts/ai-pipeline-executor.mjs");
    for (const command of ["next", "run", "probe-vercel"]) {
      expect(() =>
        runExecutorCli([command, "--repo", "C:\\repo", "--run-id", RUN_ID]),
      ).toThrowError("EXECUTOR_STEP_NOT_IMPLEMENTED");
    }
  });
});

describe("promotion executor status", () => {
  it("reports the planned step, preflight blockers, and the public approval command", async () => {
    const { repository, record } = await fixtureRepository();
    const result = runCli(["status", "--repo", repository, "--run-id", RUN_ID]);

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    const status = JSON.parse(result.stdout);
    expect(status).toMatchObject({
      recordType: "PromotionExecutorStatusV1",
      runId: RUN_ID,
      state: "AWAITING_PROD_APPROVAL",
      revision: record.revision,
      fingerprint: record.fingerprint,
    });
    expect(status.plan).toMatchObject({
      step: "AWAIT_PROD_APPROVAL",
      event: null,
      requiresHumanApproval: true,
      accountProfile: null,
      terminal: false,
    });
    expect(status.preflight.ok).toBe(false);
    expect(status.preflight.blockers).toContain("EXECUTOR_HUMAN_APPROVAL_REQUIRED");
    expect(status.humanApproval.required).toBe(true);
    expect(status.humanApproval.command).toContain("pnpm release:resume --");
    expect(status.humanApproval.command).toContain("--event PROD_APPROVAL_GRANTED");
    expect(status.humanApproval.command).toContain(
      `--approval ${record.approval.approvalFingerprint}`,
    );
    expect(status.humanApproval.command).toContain(`--expected-fingerprint ${record.fingerprint}`);
    expect(status.humanApproval.command).toContain(`--expected-revision ${record.revision}`);
    expect(status.humanApproval.command).toContain(`--repo '${repository}'`);
    expect(status.migration.autoApplyEnabled).toBe(false);
  });

  it("never writes to the registry while reporting status", async () => {
    const { repository, runFile } = await fixtureRepository();
    const before = readFileSync(runFile, "utf8");
    const policyFile = path.join(
      repository,
      ".git",
      "ai-pipeline",
      "promotions",
      "v1",
      "approval-policy.json",
    );
    const policyBefore = readFileSync(policyFile, "utf8");

    expect(runCli(["status", "--repo", repository, "--run-id", RUN_ID]).status).toBe(0);
    expect(runCli(["status", "--repo", repository, "--run-id", RUN_ID]).status).toBe(0);

    expect(readFileSync(runFile, "utf8")).toBe(before);
    expect(readFileSync(policyFile, "utf8")).toBe(policyBefore);
    expect(existsSync(`${runFile}.lock`)).toBe(false);
    expect(JSON.parse(before).fingerprint).toBe(JSON.parse(readFileSync(runFile, "utf8")).fingerprint);
  });

  it("emits only an uppercase failure code on stderr", async () => {
    const { repository } = await fixtureRepository();
    const missingRun = runCli([
      "status",
      "--repo",
      repository,
      "--run-id",
      "promotion-20260723-99999999",
    ]);
    expect(missingRun.status).toBe(1);
    expect(missingRun.stdout).toBe("");
    expect(missingRun.stderr.trim()).toBe(
      JSON.stringify({ error: "PROMOTION_RECORD_NOT_FOUND" }),
    );

    const badFlag = runCli([
      "status",
      "--repo",
      projectRoot,
      "--run-id",
      RUN_ID,
      "--unknown",
      "value",
    ]);
    expect(badFlag.status).toBe(1);
    expect(badFlag.stdout).toBe("");
    expect(badFlag.stderr.trim()).toBe(JSON.stringify({ error: "INVALID_EXECUTOR_ARGUMENTS" }));
  });
});
