import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
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
const BASELINE_SHA = "8".repeat(40);

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
    recordType: "SecurityArtifactDiffAuditV1",
    baseline: { ref: BASELINE_SHA, commitHash: digest(BASELINE_SHA) },
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
    expectedBaselineSha: BASELINE_SHA,
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

  it("skips exactly one leading -- separator and rejects any other stray --", async () => {
    const { parseExecutorArguments } = await import("../../scripts/ai-pipeline-executor.mjs");
    const tail = ["status", "--repo", "C:\\repo", "--run-id", RUN_ID];

    expect(parseExecutorArguments(["--", ...tail])).toEqual({
      command: "status",
      values: { repo: "C:\\repo", "run-id": RUN_ID },
    });
    expect(() => parseExecutorArguments(["--", "--", ...tail])).toThrowError(
      "INVALID_EXECUTOR_ARGUMENTS",
    );
    expect(() =>
      parseExecutorArguments(["status", "--repo", "C:\\repo", "--", "--run-id", RUN_ID]),
    ).toThrowError("INVALID_EXECUTOR_ARGUMENTS");
    expect(() => parseExecutorArguments(["--"])).toThrowError("EXECUTOR_COMMAND_REQUIRED");
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

  it("accepts --branch only for probe-vercel", async () => {
    const { parseExecutorArguments } = await import("../../scripts/ai-pipeline-executor.mjs");

    expect(
      parseExecutorArguments([
        "probe-vercel",
        "--repo",
        "C:\\repo",
        "--run-id",
        RUN_ID,
        "--branch",
        "stg",
      ]),
    ).toEqual({
      command: "probe-vercel",
      values: { repo: "C:\\repo", "run-id": RUN_ID, branch: "stg" },
    });
    for (const command of ["status", "next", "run"]) {
      expect(() =>
        parseExecutorArguments([command, "--repo", "C:\\repo", "--run-id", RUN_ID, "--branch", "stg"]),
      ).toThrowError("INVALID_EXECUTOR_ARGUMENTS");
    }
  });

  it("accepts --db-evidence and --dry-run only for next and run", async () => {
    const { parseExecutorArguments } = await import("../../scripts/ai-pipeline-executor.mjs");

    for (const command of ["next", "run"]) {
      expect(
        parseExecutorArguments([
          command,
          "--repo",
          "C:\\repo",
          "--run-id",
          RUN_ID,
          "--db-evidence",
          "C:\\evidence\\migration.json",
          "--dry-run",
        ]),
      ).toEqual({
        command,
        values: {
          repo: "C:\\repo",
          "run-id": RUN_ID,
          "db-evidence": "C:\\evidence\\migration.json",
          "dry-run": true,
        },
      });
      expect(() =>
        parseExecutorArguments([
          command,
          "--repo",
          "C:\\repo",
          "--run-id",
          RUN_ID,
          "--dry-run",
          "--dry-run",
        ]),
      ).toThrowError("INVALID_EXECUTOR_ARGUMENTS");
      expect(() =>
        parseExecutorArguments([
          command,
          "--repo",
          "C:\\repo",
          "--run-id",
          RUN_ID,
          "--db-evidence",
        ]),
      ).toThrowError("INVALID_EXECUTOR_ARGUMENTS");
    }
    for (const command of ["status", "probe-vercel"]) {
      for (const flag of [["--dry-run"], ["--db-evidence", "C:\\evidence\\migration.json"]]) {
        expect(() =>
          parseExecutorArguments([command, "--repo", "C:\\repo", "--run-id", RUN_ID, ...flag]),
        ).toThrowError("INVALID_EXECUTOR_ARGUMENTS");
      }
    }
  });
});

describe("promotion executor Vercel probe", () => {
  function probeRecorder() {
    const calls = [];
    const body = (url) => {
      if (url.pathname === "/v6/deployments" && url.searchParams.get("target") === "preview") {
        return {
          deployments: [
            {
              uid: "dpl_preview_001",
              state: "READY",
              target: "preview",
              meta: { githubCommitSha: SHA.stgMerged, githubCommitRef: "stg" },
            },
          ],
        };
      }
      if (url.pathname === "/v9/projects/topik-project-v13/env") {
        return {
          envs: [
            { key: "NEXT_PUBLIC_SUPABASE_URL", target: ["preview"], gitBranch: null },
          ],
        };
      }
      if (url.pathname === "/v4/aliases/talkpik.example.com") {
        return { deployment: { id: "dpl_production_001" } };
      }
      return null;
    };
    return {
      calls,
      implementation(target, init = {}) {
        const url = new URL(String(target));
        calls.push({ url, method: init.method ?? "GET", init });
        const payload = body(url);
        return Promise.resolve(
          payload === null
            ? { status: 404, ok: false, json: () => Promise.resolve({}) }
            : { status: 200, ok: true, json: () => Promise.resolve(payload) },
        );
      },
    };
  }

  it("reports the recorded preview deployment, environment scope, and alias without writing", async () => {
    const { runProbeVercel } = await import("../../scripts/ai-pipeline-executor.mjs");
    const { repository, runFile } = await fixtureRepository();
    const before = readFileSync(runFile, "utf8");
    const recorded = probeRecorder();

    const probe = await runProbeVercel(
      { repo: repository, "run-id": RUN_ID },
      {
        env: { VERCEL_TOKEN: "probe-token", VERCEL_TEAM_ID: "team_probe" },
        localAppData: path.join(temporaryRoot(), "missing-local-app-data"),
        fetchImplementation: recorded.implementation,
        baseUrl: "https://api.vercel.test",
      },
    );

    expect(probe).toEqual({
      schemaVersion: 1,
      recordType: "PromotionVercelProbeV1",
      runId: RUN_ID,
      state: "AWAITING_PROD_APPROVAL",
      readOnly: true,
      credentialSource: "env",
      project: "topik-project-v13",
      domain: "talkpik.example.com",
      branch: "stg",
      preview: {
        deploymentId: "dpl_preview_001",
        state: "READY",
        target: "preview",
        branch: "stg",
      },
      previewEnvironment: { environmentScope: "topik-dev" },
      production: null,
      alias: { deploymentId: "dpl_production_001" },
    });
    expect(recorded.calls.map((call) => call.method)).toEqual(["GET", "GET", "GET"]);
    for (const call of recorded.calls) {
      expect(call.init.body).toBeUndefined();
      expect(call.url.searchParams.get("teamId")).toBe("team_probe");
    }
    expect(readFileSync(runFile, "utf8")).toBe(before);
    expect(JSON.stringify(probe)).not.toContain("probe-token");
  });

  it("reports VERCEL_TOKEN_MISSING when no access credential is prepared", async () => {
    const { runProbeVercel } = await import("../../scripts/ai-pipeline-executor.mjs");
    const { repository } = await fixtureRepository();

    await expect(
      runProbeVercel(
        { repo: repository, "run-id": RUN_ID },
        {
          env: {},
          localAppData: path.join(temporaryRoot(), "missing-local-app-data"),
          fetchImplementation: () => {
            throw new Error("must not reach the network");
          },
        },
      ),
    ).rejects.toThrowError("VERCEL_TOKEN_MISSING");
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

const MAIN_SHA = Object.freeze({
  base: "8".repeat(40),
  merged: "5".repeat(40),
});
const CANDIDATE_BRANCH = "chore/promote-20260723-11111111";

async function promotionLib() {
  return import("../../scripts/lib/ai-release-promotion.mjs");
}

async function executorModule() {
  return import("../../scripts/ai-pipeline-executor.mjs");
}

function adapterError(code) {
  return Object.assign(new Error(code), { code });
}

async function promotionRunAt(stage) {
  const { advancePromotionRun, createApprovalPolicy, createPromotionRun } = await promotionLib();
  let record = createPromotionRun({
    runId: RUN_ID,
    now: "2026-07-23T10:00:00.000Z",
    sourceSha: SHA.source,
    sourceTreeHash: SHA.tree,
    stgBaseSha: SHA.stg,
    securityAudit: securityAudit(),
    expectedSecurityRefs: ["collab/main", "collab/stg", "origin/main"],
    expectedBaselineSha: BASELINE_SHA,
    controlPlaneReady: true,
    stgReady: true,
    vercelDomain: "talkpik.example.com",
    vercelProject: "topik-project-v13",
  });
  let policy = createApprovalPolicy({
    contractFingerprint: record.contractFingerprint,
    profileFingerprint: record.profileFingerprint,
  });
  if (stage === "PLANNED") return { record, policy };

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
  if (stage === "STG_PR_OPEN") return { record, policy };

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
  if (stage === "STG_READY") return { record, policy };

  advance({
    type: "DB_GATE_EVALUATED",
    at: "2026-07-23T10:04:00.000Z",
    migrationEvidence: migrationEvidence(),
  });
  if (stage === "AWAITING_PROD_APPROVAL") return { record, policy };

  advance({
    type: "PROD_APPROVAL_GRANTED",
    at: "2026-07-23T10:05:00.000Z",
    approvalFingerprint: record.approval.approvalFingerprint,
  });
  advance({
    type: "MAIN_PR_OPEN",
    at: "2026-07-23T10:06:00.000Z",
    targetBranch: "main",
    headBranch: "stg",
    headSha: record.target.stgSha,
    mergeMethod: "merge",
    directMainPush: false,
  });
  advance({
    type: "MAIN_MERGE_VERIFIED",
    at: "2026-07-23T10:07:00.000Z",
    mainBaseSha: MAIN_SHA.base,
    mainSha: MAIN_SHA.merged,
    headSha: record.target.stgSha,
    targetBranch: "main",
    mergeMethod: "merge",
    directMainPush: false,
    actualParents: [MAIN_SHA.base, record.target.stgSha],
  });
  if (stage !== "RELEASED") return { record, policy };

  advance({
    type: "PRODUCTION_EVALUATED",
    at: "2026-07-23T10:08:00.000Z",
    evidence: {
      deploymentId: "dpl_production_001",
      commitSha: MAIN_SHA.merged,
      project: "topik-project-v13",
      state: "READY",
      target: "production",
      alias: "talkpik.example.com",
      domain: "talkpik.example.com",
      smokeReadOnly: true,
      smokePassed: true,
      aliasSwitched: true,
      previousReadyDeploymentId: "dpl_production_previous",
      previousReadyState: "READY",
    },
  });
  return { record, policy };
}

async function stagedRepository(stage) {
  const repository = temporaryRoot();
  git(repository, ["init", "--initial-branch=main"]);
  git(repository, [
    "remote",
    "add",
    "origin",
    "https://github.com/blackstarzck/topik-project-v13.git",
  ]);
  git(repository, [
    "remote",
    "add",
    "collab",
    "https://github.com/keduall/topik-project-v13.git",
  ]);
  const { writeApprovalPolicy, writePromotionRun } = await promotionLib();
  const { record, policy } = await promotionRunAt(stage);
  const gitCommonDir = path.join(repository, ".git");
  writeApprovalPolicy({ gitCommonDir, policy });
  const runFile = writePromotionRun({ gitCommonDir, record });
  const policyFile = path.join(
    gitCommonDir,
    "ai-pipeline",
    "promotions",
    "v1",
    "approval-policy.json",
  );
  return { gitCommonDir, policyFile, record, repository, runFile };
}

const OPERATION_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/u;

function preservedOperationCode(error) {
  const systemError = error?.syscall !== undefined || typeof error?.errno === "number";
  return !systemError && typeof error?.code === "string" && OPERATION_CODE_PATTERN.test(error.code)
    ? error.code
    : null;
}

function fakeWorld({
  smokePassed = true,
  aliasSwitched = true,
  stage = "PLANNED",
  missingDeploymentCount = 0,
  aliasLagCount = 0,
  smokeFailureCount = 0,
} = {}) {
  const calls = [];
  let currentAccount = null;
  const note = (call) => calls.push({ call, account: currentAccount });

  const stgMergedAlready = stage !== "PLANNED";
  const commits = new Map([
    [SHA.stg, []],
    [MAIN_SHA.base, []],
  ]);
  const remotes = new Map([
    ["collab/stg", stgMergedAlready ? SHA.stgMerged : SHA.stg],
    ["collab/main", MAIN_SHA.base],
  ]);
  if (stgMergedAlready) {
    commits.set(SHA.candidate, [SHA.stg, SHA.source]);
    commits.set(SHA.stgMerged, [SHA.stg, SHA.candidate]);
    remotes.set(`collab/${CANDIDATE_BRANCH}`, SHA.candidate);
  }
  if (stage === "PRODUCTION_VERIFYING" || stage === "RELEASED") {
    commits.set(MAIN_SHA.merged, [MAIN_SHA.base, SHA.stgMerged]);
    remotes.set("collab/main", MAIN_SHA.merged);
  }
  if (stage === "RELEASED") remotes.set("collab/stg", MAIN_SHA.merged);
  const localBranches = new Map();
  const pullRequests = [];
  let nextNumber = 101;

  const gitAdapter = {
    fetchRemote({ remote }) {
      note(`fetch:${remote}`);
      return { ok: true };
    },
    remoteBranchSha({ remote, branch }) {
      return remotes.get(`${remote}/${branch}`) ?? null;
    },
    commitParents(sha) {
      if (!commits.has(sha)) throw adapterError("EXECUTOR_REF_LOOKUP_FAILED");
      return commits.get(sha);
    },
    resolveCommit(ref) {
      const sha = localBranches.get(ref);
      if (sha === undefined) throw adapterError("EXECUTOR_REF_LOOKUP_FAILED");
      return sha;
    },
    createCandidateMerge({ candidateBranch, baseSha, sourceSha }) {
      note(`candidate-merge:${candidateBranch}`);
      commits.set(SHA.candidate, [baseSha, sourceSha]);
      localBranches.set(candidateBranch, SHA.candidate);
      return {
        candidateSha: SHA.candidate,
        actualParents: [baseSha, sourceSha],
        cleanupFailed: false,
      };
    },
    pushBranch({ remote, branch, expectedSha }) {
      note(`push:${remote}/${branch}`);
      remotes.set(`${remote}/${branch}`, expectedSha);
      return { ok: true, remoteSha: expectedSha };
    },
    isFastForward() {
      return true;
    },
    fastForwardRemoteBranch({ remote, branch, expectedSha }) {
      const current = remotes.get(`${remote}/${branch}`) ?? null;
      if (current === expectedSha) return { ok: true, alreadySynced: true, remoteSha: current };
      note(`sync:${remote}/${branch}`);
      remotes.set(`${remote}/${branch}`, expectedSha);
      return { ok: true, alreadySynced: false, remoteSha: expectedSha };
    },
    deleteRemoteBranch({ remote, branch }) {
      note(`delete:${remote}/${branch}`);
      remotes.delete(`${remote}/${branch}`);
      return { ok: true };
    },
  };

  const findPullRequest = ({ base, head }) => {
    const found = pullRequests.find(
      (entry) => entry.base === base && entry.head === head && entry.state === "OPEN",
    );
    return found === undefined
      ? null
      : { number: found.number, headSha: found.headSha, state: found.state };
  };

  const githubAdapter = {
    findPullRequest,
    createPullRequest({ base, head }) {
      const existing = findPullRequest({ base, head });
      if (existing !== null) return { number: existing.number, headSha: existing.headSha };
      note(`open-pr:${base}<-${head}`);
      const entry = {
        number: nextNumber,
        base,
        head,
        headSha: remotes.get(`collab/${head}`) ?? null,
        state: "OPEN",
      };
      nextNumber += 1;
      pullRequests.push(entry);
      return { number: entry.number, headSha: entry.headSha };
    },
    mergePullRequest({ number, expectedHeadSha }) {
      const entry = pullRequests.find((candidate) => candidate.number === number);
      if (entry === undefined || entry.headSha !== expectedHeadSha) {
        throw adapterError("EXECUTOR_PR_MERGE_VERIFY_FAILED");
      }
      note(`merge-pr:${entry.base}<-${entry.head}`);
      entry.state = "MERGED";
      const mergeCommitSha = entry.base === "stg" ? SHA.stgMerged : MAIN_SHA.merged;
      commits.set(mergeCommitSha, [remotes.get(`collab/${entry.base}`), expectedHeadSha]);
      remotes.set(`collab/${entry.base}`, mergeCommitSha);
      return { mergeCommitSha };
    },
  };

  const deployments = new Map([
    [
      `preview:${SHA.stgMerged}`,
      { deploymentId: "dpl_preview_001", state: "READY", target: "preview", branch: "stg" },
    ],
    [
      `production:${MAIN_SHA.merged}`,
      { deploymentId: "dpl_production_001", state: "READY", target: "production", branch: "main" },
    ],
  ]);
  const aliases = new Map([
    ["talkpik.example.com", aliasSwitched ? "dpl_production_001" : "dpl_production_previous"],
  ]);

  let deploymentLookups = 0;
  let aliasReads = 0;
  const vercelAdapter = {
    findDeploymentByCommit({ commitSha, target }) {
      deploymentLookups += 1;
      if (deploymentLookups <= missingDeploymentCount) return Promise.resolve(null);
      return Promise.resolve(deployments.get(`${target}:${commitSha}`) ?? null);
    },
    waitForReady({ deploymentId }) {
      note(`ready:${deploymentId}`);
      return Promise.resolve({ state: "READY" });
    },
    verifyPreviewEnvironmentScope() {
      return Promise.resolve({ environmentScope: "topik-dev" });
    },
    findPreviousReadyProduction() {
      return Promise.resolve({ deploymentId: "dpl_production_previous", state: "READY" });
    },
    getAliasTarget({ domain }) {
      aliasReads += 1;
      if (aliasReads <= aliasLagCount) {
        return Promise.resolve({ deploymentId: "dpl_production_previous" });
      }
      const deploymentId = aliases.get(domain);
      return Promise.resolve(deploymentId === undefined ? null : { deploymentId });
    },
    assignAlias({ deploymentId, domain }) {
      note(`assign-alias:${deploymentId}`);
      aliases.set(domain, deploymentId);
      return Promise.resolve({ assigned: true });
    },
  };

  let smokeCalls = 0;
  const smoke = () => {
    smokeCalls += 1;
    const passed = smokePassed && smokeCalls > smokeFailureCount;
    return Promise.resolve({
      smokePassed: passed,
      smokeReadOnly: true,
      checkCount: 1,
      failedCheckCount: passed ? 0 : 1,
    });
  };

  const sleeps = [];
  const sleep = (milliseconds) => {
    sleeps.push(milliseconds);
    return Promise.resolve();
  };

  const authRunner = async ({ profile, operation }) => {
    const previous = currentAccount;
    currentAccount = profile.authLogin;
    try {
      return { result: "AUTHENTICATED", value: await operation() };
    } catch (error) {
      const operationCode = preservedOperationCode(error);
      return {
        result: "PRESERVED",
        blocker: "AUTH_OPERATION_FAILED",
        message: "The authenticated repository operation failed.",
        ...(operationCode === null ? {} : { operationCode }),
      };
    } finally {
      currentAccount = previous;
    }
  };

  let tick = 0;
  const now = () => {
    tick += 1;
    return new Date(Date.UTC(2026, 6, 24, 9, tick, 0)).toISOString();
  };

  return {
    aliases,
    calls,
    commits,
    git: gitAdapter,
    remotes,
    sleeps,
    options: {
      git: gitAdapter,
      github: githubAdapter,
      vercel: vercelAdapter,
      smoke,
      authRunner,
      sleep,
      now,
    },
    callNames: () => calls.map((entry) => entry.call),
    accountFor: (prefix) =>
      calls.filter((entry) => entry.call.startsWith(prefix)).map((entry) => entry.account),
  };
}

function migrationEvidenceFile(overrides = {}) {
  const localAppData = temporaryRoot();
  const allowed = path.join(localAppData, "TalkpikPipeline", "db-evidence");
  mkdirSync(allowed, { recursive: true });
  const file = path.join(allowed, "evidence.json");
  writeFileSync(file, `${JSON.stringify({ ...migrationEvidence(), ...overrides })}\n`, "utf8");
  return { localAppData, file };
}

async function grantProductionApproval(gitCommonDir) {
  const {
    advancePromotionRun,
    persistPromotionTransition,
    readApprovalPolicy,
    readPromotionRun,
    writeApprovalPolicy,
    writePromotionRun,
  } = await promotionLib();
  const record = readPromotionRun({ gitCommonDir, runId: RUN_ID });
  const policy = readApprovalPolicy({ gitCommonDir });
  const advanced = advancePromotionRun(record, {
    expectedRevision: record.revision,
    expectedFingerprint: record.fingerprint,
    policy,
    event: {
      type: "PROD_APPROVAL_GRANTED",
      at: "2026-07-24T10:00:00.000Z",
      approvalFingerprint: record.approval.approvalFingerprint,
    },
  });
  persistPromotionTransition({
    currentRecord: record,
    currentPolicy: policy,
    result: advanced,
    writeRun: (nextRecord, expectedFingerprint) =>
      writePromotionRun({ gitCommonDir, record: nextRecord, expectedFingerprint }),
    writePolicy: (nextPolicy, expectedFingerprint) =>
      writeApprovalPolicy({ gitCommonDir, policy: nextPolicy, expectedFingerprint }),
  });
  return advanced.record;
}

describe("promotion executor step execution", () => {
  it("walks PLANNED to CLEANED with run, stopping for the human approval and resuming", async () => {
    const { runSequence } = await executorModule();
    const { gitCommonDir, repository } = await stagedRepository("PLANNED");
    const world = fakeWorld();
    const evidence = migrationEvidenceFile();
    const values = { repo: repository, "run-id": RUN_ID, "db-evidence": evidence.file };
    const options = { ...world.options, localAppData: evidence.localAppData };

    const first = await runSequence(values, options);
    expect(first.recordType).toBe("PromotionExecutorRunV1");
    expect(first.iterationLimit).toBe(12);
    expect(first.stoppedBecause).toBe("HUMAN_APPROVAL_REQUIRED");
    expect(first.iterations.map((entry) => entry.state)).toEqual([
      "PLANNED",
      "CANDIDATE_VERIFIED",
      "STG_PR_OPEN",
      "STG_READY",
      "AWAITING_PROD_APPROVAL",
    ]);
    expect(first.iterations.map((entry) => entry.outcome)).toEqual([
      "ADVANCED",
      "ADVANCED",
      "ADVANCED",
      "ADVANCED",
      "HUMAN_APPROVAL_REQUIRED",
    ]);
    const approvalStep = first.iterations.at(-1);
    expect(approvalStep.humanApproval.required).toBe(true);
    expect(approvalStep.humanApproval.command).toContain("pnpm release:resume --");
    expect(approvalStep.humanApproval.command).toContain("--event PROD_APPROVAL_GRANTED");

    expect((await grantProductionApproval(gitCommonDir)).state).toBe("PROD_APPROVED");

    const second = await runSequence(values, options);
    expect(second.stoppedBecause).toBe("TERMINAL");
    expect(second.iterations.map((entry) => entry.state)).toEqual([
      "PROD_APPROVED",
      "MAIN_PR_OPEN",
      "PRODUCTION_VERIFYING",
      "RELEASED",
      "CLEANED",
    ]);
    expect(second.iterations.at(-2).result.state).toBe("CLEANED");

    expect(world.callNames().filter((name) => !name.startsWith("fetch:"))).toEqual([
      `candidate-merge:${CANDIDATE_BRANCH}`,
      `push:collab/${CANDIDATE_BRANCH}`,
      `open-pr:stg<-${CANDIDATE_BRANCH}`,
      `merge-pr:stg<-${CANDIDATE_BRANCH}`,
      "ready:dpl_preview_001",
      "open-pr:main<-stg",
      "merge-pr:main<-stg",
      "ready:dpl_production_001",
      "sync:collab/stg",
      `delete:collab/${CANDIDATE_BRANCH}`,
    ]);
    expect(world.accountFor("candidate-merge:")).toEqual(["blackstarzck"]);
    expect(world.accountFor("push:")).toEqual(["blackstarzck"]);
    expect(world.accountFor("open-pr:")).toEqual(["blackstarzck", "blackstarzck"]);
    expect(world.accountFor("merge-pr:")).toEqual([
      "guestkeduall-design",
      "guestkeduall-design",
    ]);
    expect(world.accountFor("ready:")).toEqual([null, null]);
    expect(world.accountFor("sync:")).toEqual(["guestkeduall-design"]);
    expect(world.accountFor("delete:")).toEqual(["guestkeduall-design"]);
    expect(world.remotes.get("collab/stg")).toBe(MAIN_SHA.merged);
    expect(world.remotes.has(`collab/${CANDIDATE_BRANCH}`)).toBe(false);

    const evidenceDirectory = path.join(
      gitCommonDir,
      "ai-pipeline",
      "promotions",
      "v1",
      "evidence",
      RUN_ID,
    );
    expect(readdirSync(evidenceDirectory).sort()).toEqual([
      "002-CANDIDATE_VERIFIED.json",
      "003-STG_PR_OPEN.json",
      "004-STG_READY.json",
      "005-DB_GATE_EVALUATED.json",
      "007-MAIN_PR_OPEN.json",
      "008-MAIN_MERGE_VERIFIED.json",
      "009-PRODUCTION_EVALUATED.json",
      "010-CLEANUP_VERIFIED.json",
    ]);
    const copy = JSON.parse(
      readFileSync(path.join(evidenceDirectory, "005-DB_GATE_EVALUATED.json"), "utf8"),
    );
    expect(copy.recordType).toBe("PromotionSubmittedEvidenceV1");
    expect(copy.event.migrationEvidence.autoApplyEnabled).toBe(false);
  });

  it("stops on a blocked DB gate and passes once the corrected evidence arrives", async () => {
    const { runNext, runSequence } = await executorModule();
    const { repository, runFile } = await stagedRepository("STG_READY");
    const world = fakeWorld({ stage: "STG_READY" });
    const blocked = migrationEvidenceFile({ destructiveSql: true });
    const passing = migrationEvidenceFile();
    const before = readFileSync(runFile, "utf8");

    const missing = await runNext({ repo: repository, "run-id": RUN_ID }, world.options);
    expect(missing.outcome).toBe("DB_EVIDENCE_REQUIRED");
    expect(missing.step).toBe("EVALUATE_DB_GATE");
    expect(missing.result).toBeNull();
    expect(world.callNames()).toEqual([]);
    expect(readFileSync(runFile, "utf8")).toBe(before);

    const blockedRun = await runSequence(
      { repo: repository, "run-id": RUN_ID, "db-evidence": blocked.file },
      { ...world.options, localAppData: blocked.localAppData },
    );
    expect(blockedRun.stoppedBecause).toBe("DB_GATE_BLOCKED");
    expect(blockedRun.iterationCount).toBe(1);
    expect(blockedRun.iterations[0].result).toMatchObject({
      state: "DB_GATE_BLOCKED",
      blocker: "DB_GATE_BLOCKED",
    });

    const retried = await runNext(
      { repo: repository, "run-id": RUN_ID, "db-evidence": blocked.file },
      { ...world.options, localAppData: blocked.localAppData },
    );
    expect(retried.state).toBe("DB_GATE_BLOCKED");
    expect(retried.step).toBe("EVALUATE_DB_GATE");
    expect(retried.result.state).toBe("DB_GATE_BLOCKED");

    const passed = await runNext(
      { repo: repository, "run-id": RUN_ID, "db-evidence": passing.file },
      { ...world.options, localAppData: passing.localAppData },
    );
    expect(passed.step).toBe("EVALUATE_DB_GATE");
    expect(passed.result).toMatchObject({ state: "AWAITING_PROD_APPROVAL", blocker: null });
    expect(world.callNames().filter((name) => !name.startsWith("fetch:"))).toEqual([]);
  });

  it("rolls the alias back to the previous READY deployment and preserves the run", async () => {
    const { runSequence } = await executorModule();
    const { repository } = await stagedRepository("PRODUCTION_VERIFYING");
    const world = fakeWorld({ smokePassed: false, stage: "PRODUCTION_VERIFYING" });

    const result = await runSequence({ repo: repository, "run-id": RUN_ID }, world.options);

    expect(result.iterations.map((entry) => entry.state)).toEqual([
      "PRODUCTION_VERIFYING",
      "ALIAS_ROLLBACK_REQUIRED",
      "PRESERVED",
    ]);
    expect(result.iterations[0].result).toMatchObject({
      state: "ALIAS_ROLLBACK_REQUIRED",
      blocker: "ALIAS_ROLLBACK_REQUIRED",
    });
    expect(result.iterations[1].result).toMatchObject({
      state: "PRESERVED",
      blocker: "PRODUCTION_SMOKE_FAILED_ALIAS_ROLLED_BACK",
    });
    expect(result.stoppedBecause).toBe("TERMINAL");
    expect(world.callNames()).toContain("assign-alias:dpl_production_previous");
    expect(world.aliases.get("talkpik.example.com")).toBe("dpl_production_previous");
    expect(world.callNames().filter((name) => name.startsWith("delete:"))).toEqual([]);
  });

  it("records PRODUCTION_FAILED and resets the approval policy when the alias never switched", async () => {
    const { runSequence } = await executorModule();
    const { gitCommonDir, repository } = await stagedRepository("PRODUCTION_VERIFYING");
    const world = fakeWorld({ aliasSwitched: false, stage: "PRODUCTION_VERIFYING" });

    const result = await runSequence({ repo: repository, "run-id": RUN_ID }, world.options);

    expect(result.iterations[0].result).toMatchObject({
      state: "PRODUCTION_FAILED",
      blocker: "PRODUCTION_FAILED_PREVIOUS_ALIAS_PRESERVED",
    });
    expect(result.iterations.at(-1).outcome).toBe("TERMINAL");
    expect(result.stoppedBecause).toBe("TERMINAL");
    expect(world.callNames()).not.toContain("assign-alias:dpl_production_previous");
    const { readApprovalPolicy } = await promotionLib();
    expect(readApprovalPolicy({ gitCommonDir })).toMatchObject({
      consecutiveSuccessCount: 0,
      lastResetReason: "DEPLOYMENT_FAILURE",
    });
  });

  it("changes neither the remote nor the registry on a dry run", async () => {
    const { runNext } = await executorModule();
    const { policyFile, repository, runFile } = await stagedRepository("PLANNED");
    const world = fakeWorld();
    const runBefore = readFileSync(runFile, "utf8");
    const policyBefore = readFileSync(policyFile, "utf8");

    const step = await runNext(
      { repo: repository, "run-id": RUN_ID, "dry-run": true },
      world.options,
    );

    expect(step.outcome).toBe("DRY_RUN");
    expect(step.dryRun).toBe(true);
    expect(step.result).toBeNull();
    expect(step.preflight).toEqual({ ok: true, blockers: [] });
    expect(step.intent).toMatchObject({
      step: "CREATE_CANDIDATE",
      operations: [
        { operation: "create", account: "blackstarzck" },
        { operation: "push", account: "blackstarzck" },
      ],
      targetRepository: "keduall/topik-project-v13",
      candidateBranch: CANDIDATE_BRANCH,
    });
    expect(world.callNames()).toEqual(["fetch:collab"]);
    expect(world.remotes.get("collab/stg")).toBe(SHA.stg);
    expect(world.remotes.has(`collab/${CANDIDATE_BRANCH}`)).toBe(false);
    expect(readFileSync(runFile, "utf8")).toBe(runBefore);
    expect(readFileSync(policyFile, "utf8")).toBe(policyBefore);
    expect(
      existsSync(path.join(repository, ".git", "ai-pipeline", "promotions", "v1", "evidence")),
    ).toBe(false);
  });

  it("repeats a step without a duplicate candidate push or duplicate pull request", async () => {
    const { runNext } = await executorModule();
    const { gitCommonDir, record, repository } = await stagedRepository("PLANNED");
    const { readPromotionRun, writePromotionRun } = await promotionLib();
    const world = fakeWorld();
    const values = { repo: repository, "run-id": RUN_ID };
    const rewindTo = (target) =>
      writePromotionRun({
        gitCommonDir,
        record: target,
        expectedFingerprint: readPromotionRun({ gitCommonDir, runId: RUN_ID }).fingerprint,
      });

    const first = await runNext(values, world.options);
    expect(first.result.state).toBe("CANDIDATE_VERIFIED");
    const candidateVerified = readPromotionRun({ gitCommonDir, runId: RUN_ID });

    rewindTo(record);
    const repeatedCandidate = await runNext(values, world.options);
    expect(repeatedCandidate.result.state).toBe("CANDIDATE_VERIFIED");
    expect(
      readPromotionRun({ gitCommonDir, runId: RUN_ID }).target.candidateSha,
    ).toBe(candidateVerified.target.candidateSha);
    expect(world.callNames().filter((name) => name.startsWith("candidate-merge:"))).toHaveLength(1);
    expect(world.callNames().filter((name) => name.startsWith("push:"))).toHaveLength(1);

    const opened = await runNext(values, world.options);
    expect(opened.result.state).toBe("STG_PR_OPEN");

    rewindTo(candidateVerified);
    const repeatedOpen = await runNext(values, world.options);
    expect(repeatedOpen.result.state).toBe("STG_PR_OPEN");
    expect(world.callNames().filter((name) => name.startsWith("open-pr:"))).toHaveLength(1);
    expect(world.remotes.get(`collab/${CANDIDATE_BRANCH}`)).toBe(SHA.candidate);
  });

  it("keeps a failed evidence copy from changing the advanced state", async () => {
    const { runNext } = await executorModule();
    const { gitCommonDir, repository } = await stagedRepository("PLANNED");
    const world = fakeWorld();

    const step = await runNext(
      { repo: repository, "run-id": RUN_ID },
      {
        ...world.options,
        writeEvidence: () => {
          throw new Error("evidence registry is unavailable");
        },
      },
    );

    expect(step.outcome).toBe("ADVANCED");
    expect(step.result.state).toBe("CANDIDATE_VERIFIED");
    expect(step.warnings).toEqual(["PROMOTION_EVIDENCE_RECORDING_WARNING"]);
    const { readPromotionRun } = await promotionLib();
    expect(readPromotionRun({ gitCommonDir, runId: RUN_ID })).toMatchObject({
      state: "CANDIDATE_VERIFIED",
      fingerprint: step.result.fingerprint,
    });
  });

  it("reports an orphan registry lock as a blocker and never removes it", async () => {
    const { runNext } = await executorModule();
    const { repository, runFile } = await stagedRepository("PLANNED");
    const world = fakeWorld();
    const lockPath = `${runFile}.lock`;
    writeFileSync(lockPath, "", { encoding: "utf8", flag: "wx", mode: 0o600 });

    const step = await runNext({ repo: repository, "run-id": RUN_ID }, world.options);
    expect(step.outcome).toBe("PREFLIGHT_BLOCKED");
    expect(step.preflight.blockers).toEqual(["PROMOTION_REGISTRY_LOCKED"]);
    expect(step.registryLock).toEqual({ present: true, removed: false, autoRemoval: false });
    expect(step.result).toBeNull();
    expect(world.callNames()).toEqual([]);
    expect(existsSync(lockPath)).toBe(true);

    const status = runCli(["status", "--repo", repository, "--run-id", RUN_ID]);
    expect(status.status).toBe(0);
    const parsed = JSON.parse(status.stdout);
    expect(parsed.preflight.blockers).toContain("PROMOTION_REGISTRY_LOCKED");
    expect(parsed.registryLock).toEqual({ present: true, removed: false, autoRemoval: false });
    expect(existsSync(lockPath)).toBe(true);
  });

  it("stops the run loop with an uppercase code when an adapter fails", async () => {
    const { runSequence } = await executorModule();
    const { repository } = await stagedRepository("PLANNED");
    const world = fakeWorld();

    const result = await runSequence(
      { repo: repository, "run-id": RUN_ID },
      {
        ...world.options,
        git: {
          ...world.git,
          pushBranch() {
            throw adapterError("EXECUTOR_PUSH_VERIFY_FAILED");
          },
        },
      },
    );

    expect(result.stoppedBecause).toBe("ADAPTER_ERROR");
    expect(result.iterations).toEqual([
      {
        recordType: "PromotionExecutorStepErrorV1",
        outcome: "ADAPTER_ERROR",
        attempt: 1,
        error: "EXECUTOR_PUSH_VERIFY_FAILED",
      },
    ]);
  });

  it("never submits a production approval event from the executor", async () => {
    const { runNext } = await executorModule();
    const { assertExecutorSubmittableEvent } = await import(
      "../../scripts/lib/ai-release-executor.mjs"
    );
    const { repository, runFile } = await stagedRepository("AWAITING_PROD_APPROVAL");
    const world = fakeWorld({ stage: "AWAITING_PROD_APPROVAL" });
    const before = readFileSync(runFile, "utf8");

    expect(() => assertExecutorSubmittableEvent({ type: "PROD_APPROVAL_GRANTED" })).toThrowError(
      "EXECUTOR_APPROVAL_EVENT_FORBIDDEN",
    );

    const step = await runNext({ repo: repository, "run-id": RUN_ID }, world.options);
    expect(step.outcome).toBe("HUMAN_APPROVAL_REQUIRED");
    expect(step.event).toBeNull();
    expect(step.plan.requiresHumanApproval).toBe(true);
    expect(step.result).toBeNull();
    expect(world.callNames()).toEqual([]);
    expect(readFileSync(runFile, "utf8")).toBe(before);
  });

  it("blocks a moved stg tip and an unverifiable account before performing any step", async () => {
    const { runNext } = await executorModule();
    const moved = await stagedRepository("PLANNED");
    const movedWorld = fakeWorld();
    movedWorld.remotes.set("collab/stg", SHA.candidate);
    const movedBefore = readFileSync(moved.runFile, "utf8");

    const movedStep = await runNext(
      { repo: moved.repository, "run-id": RUN_ID },
      movedWorld.options,
    );
    expect(movedStep.outcome).toBe("PREFLIGHT_BLOCKED");
    expect(movedStep.preflight.blockers).toContain("PROMOTION_BASE_MOVED");
    expect(movedStep.result).toBeNull();
    expect(movedWorld.callNames()).toEqual(["fetch:collab"]);
    expect(readFileSync(moved.runFile, "utf8")).toBe(movedBefore);

    const denied = await stagedRepository("PLANNED");
    const deniedWorld = fakeWorld();
    const deniedStep = await runNext(
      { repo: denied.repository, "run-id": RUN_ID },
      {
        ...deniedWorld.options,
        authRunner: () =>
          Promise.resolve({ result: "PRESERVED", blocker: "AUTH_PERMISSION_DENIED" }),
      },
    );
    expect(deniedStep.outcome).toBe("PREFLIGHT_BLOCKED");
    expect(deniedStep.preflight.blockers).toContain("EXECUTOR_ACCOUNT_UNAVAILABLE");
    expect(deniedStep.observed.verifiedAccounts).toEqual([]);
    expect(deniedWorld.callNames()).toEqual(["fetch:collab"]);
  });

  it("resumes when its own stg merge landed but the preview observation failed", async () => {
    const { runNext } = await executorModule();
    const { repository } = await stagedRepository("STG_PR_OPEN");
    const world = fakeWorld({ stage: "STG_PR_OPEN" });

    expect(world.remotes.get("collab/stg")).toBe(SHA.stgMerged);
    const step = await runNext({ repo: repository, "run-id": RUN_ID }, world.options);

    expect(step.preflight).toEqual({ ok: true, blockers: [] });
    expect(step.observed.stgParents).toEqual([SHA.stg, SHA.candidate]);
    expect(step.outcome).toBe("ADVANCED");
    expect(step.result.state).toBe("STG_READY");
    expect(world.callNames().filter((name) => name.startsWith("merge-pr:"))).toEqual([]);
  });

  it("still blocks a third-party stg move while the stg pull request is open", async () => {
    const { runNext } = await executorModule();
    const { repository, runFile } = await stagedRepository("STG_PR_OPEN");
    const world = fakeWorld({ stage: "STG_PR_OPEN" });
    const foreign = "9".repeat(40);
    world.commits.set(foreign, [SHA.stg, "a".repeat(40)]);
    world.remotes.set("collab/stg", foreign);
    const before = readFileSync(runFile, "utf8");

    const step = await runNext({ repo: repository, "run-id": RUN_ID }, world.options);

    expect(step.outcome).toBe("PREFLIGHT_BLOCKED");
    expect(step.preflight.blockers).toContain("PROMOTION_BASE_MOVED");
    expect(step.result).toBeNull();
    expect(readFileSync(runFile, "utf8")).toBe(before);
  });

  it("resumes cleanup when its own stg fast-forward landed but candidate removal failed", async () => {
    const { runNext } = await executorModule();
    const { repository } = await stagedRepository("RELEASED");
    const world = fakeWorld({ stage: "RELEASED" });

    expect(world.remotes.get("collab/stg")).toBe(MAIN_SHA.merged);
    const step = await runNext({ repo: repository, "run-id": RUN_ID }, world.options);

    expect(step.preflight).toEqual({ ok: true, blockers: [] });
    expect(step.outcome).toBe("ADVANCED");
    expect(step.result.state).toBe("CLEANED");
    expect(world.callNames().filter((name) => name.startsWith("sync:"))).toEqual([]);
    expect(world.callNames()).toContain(`delete:collab/${CANDIDATE_BRANCH}`);
    expect(world.remotes.has(`collab/${CANDIDATE_BRANCH}`)).toBe(false);
  });

  it("falls back to the authentication blocker when the adapter failure carries no code", async () => {
    const { runSequence } = await executorModule();
    const { repository } = await stagedRepository("PLANNED");
    const world = fakeWorld();

    const result = await runSequence(
      { repo: repository, "run-id": RUN_ID },
      {
        ...world.options,
        git: {
          ...world.git,
          pushBranch() {
            throw new Error("SENTINEL_PROVIDER_TRANSCRIPT");
          },
        },
      },
    );

    expect(result.stoppedBecause).toBe("ADAPTER_ERROR");
    expect(result.iterations.at(-1).error).toBe("EXECUTOR_AUTH_OPERATION_FAILED");
    expect(JSON.stringify(result)).not.toContain("SENTINEL_PROVIDER_TRANSCRIPT");
  });

  it("waits for a late production deployment record and fails once the attempts run out", async () => {
    const { runNext } = await executorModule();
    const late = await stagedRepository("PRODUCTION_VERIFYING");
    const lateWorld = fakeWorld({ stage: "PRODUCTION_VERIFYING", missingDeploymentCount: 2 });

    const step = await runNext(
      { repo: late.repository, "run-id": RUN_ID },
      { ...lateWorld.options, deploymentAttempts: 3, deploymentIntervalMs: 1234 },
    );
    expect(step.outcome).toBe("ADVANCED");
    expect(step.result.state).toBe("RELEASED");
    expect(lateWorld.sleeps).toEqual([1234, 1234]);

    const never = await stagedRepository("PRODUCTION_VERIFYING");
    const neverWorld = fakeWorld({ stage: "PRODUCTION_VERIFYING", missingDeploymentCount: 9 });
    await expect(
      runNext(
        { repo: never.repository, "run-id": RUN_ID },
        { ...neverWorld.options, deploymentAttempts: 2, deploymentIntervalMs: 7 },
      ),
    ).rejects.toThrowError("VERCEL_DEPLOYMENT_NOT_FOUND");
    expect(neverWorld.sleeps).toEqual([7]);
  });

  it("waits for the production alias to switch before recording PRODUCTION_FAILED", async () => {
    const { runNext } = await executorModule();
    const lagging = await stagedRepository("PRODUCTION_VERIFYING");
    const laggingWorld = fakeWorld({ stage: "PRODUCTION_VERIFYING", aliasLagCount: 2 });

    const switched = await runNext(
      { repo: lagging.repository, "run-id": RUN_ID },
      { ...laggingWorld.options, aliasAttempts: 3, aliasIntervalMs: 5 },
    );
    expect(switched.result.state).toBe("RELEASED");
    expect(laggingWorld.sleeps).toEqual([5, 5]);

    const stuck = await stagedRepository("PRODUCTION_VERIFYING");
    const stuckWorld = fakeWorld({ stage: "PRODUCTION_VERIFYING", aliasSwitched: false });
    const failed = await runNext(
      { repo: stuck.repository, "run-id": RUN_ID },
      { ...stuckWorld.options, aliasAttempts: 3, aliasIntervalMs: 5 },
    );
    expect(failed.result).toMatchObject({
      state: "PRODUCTION_FAILED",
      blocker: "PRODUCTION_FAILED_PREVIOUS_ALIAS_PRESERVED",
    });
    expect(stuckWorld.sleeps).toEqual([5, 5]);
  });

  it("retries the read-only smoke test before requiring an alias rollback", async () => {
    const { runNext } = await executorModule();
    const flaky = await stagedRepository("PRODUCTION_VERIFYING");
    const flakyWorld = fakeWorld({ stage: "PRODUCTION_VERIFYING", smokeFailureCount: 2 });

    const recovered = await runNext(
      { repo: flaky.repository, "run-id": RUN_ID },
      { ...flakyWorld.options, smokeAttempts: 3, smokeIntervalMs: 9 },
    );
    expect(recovered.result.state).toBe("RELEASED");
    expect(flakyWorld.sleeps).toEqual([9, 9]);

    const broken = await stagedRepository("PRODUCTION_VERIFYING");
    const brokenWorld = fakeWorld({ stage: "PRODUCTION_VERIFYING", smokePassed: false });
    const rollback = await runNext(
      { repo: broken.repository, "run-id": RUN_ID },
      { ...brokenWorld.options, smokeAttempts: 2, smokeIntervalMs: 9 },
    );
    expect(rollback.result).toMatchObject({
      state: "ALIAS_ROLLBACK_REQUIRED",
      blocker: "ALIAS_ROLLBACK_REQUIRED",
    });
    expect(brokenWorld.sleeps).toEqual([9]);
  });

  it("keeps the executor sources free of the remote database apply surface", () => {
    const forbidden = [
      ["", "database", "query"].join("/"),
      ["session", "replication", "role"].join("_"),
    ];
    for (const relativePath of [
      path.join("scripts", "ai-pipeline-executor.mjs"),
      path.join("scripts", "lib", "ai-release-executor.mjs"),
      path.join("scripts", "lib", "ai-release-git.mjs"),
      path.join("scripts", "lib", "ai-release-vercel.mjs"),
      path.join("scripts", "lib", "ai-release-promotion.mjs"),
    ]) {
      const source = readFileSync(path.join(projectRoot, relativePath), "utf8");
      for (const needle of forbidden) expect(source).not.toContain(needle);
    }
  });
});
