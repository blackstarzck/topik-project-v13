#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  realpathSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  advancePromotionRun,
  createApprovalPolicy,
  createPromotionRun,
  parseRepositoryIdentity,
  PROMOTION_PROFILES,
  persistPromotionTransition,
  promotionProfileFingerprint,
  readApprovalPolicy,
  readPromotionRun,
  reconcileApprovalPolicy,
  resetApprovalPolicy,
  validateSecurityAuditEvidence,
  writeApprovalPolicy,
  writePromotionRun,
} from "./lib/ai-release-promotion.mjs";
import { auditSecurityArtifacts } from "./lib/security-artifact-audit.mjs";

const COMMANDS = new Set(["start", "status", "resume"]);
const VALUE_FLAGS = new Set([
  "repo",
  "git-common-dir",
  "run-id",
  "now",
  "control-plane-ready",
  "stg-ready",
  "expected-revision",
  "expected-fingerprint",
  "event",
  "event-at",
  "approval",
  "vercel-project",
  "vercel-domain",
]);

function cliError(code) {
  return Object.assign(new Error(code), { code });
}

export function parseReleaseArguments(argv) {
  const [command, ...tokens] = argv;
  if (!COMMANDS.has(command)) throw cliError("RELEASE_COMMAND_REQUIRED");
  if (tokens.length % 2 !== 0) throw cliError("INVALID_RELEASE_ARGUMENTS");
  const values = {};
  for (let index = 0; index < tokens.length; index += 2) {
    const flag = tokens[index];
    const value = tokens[index + 1];
    if (!flag?.startsWith("--") || value?.startsWith("--")) {
      throw cliError("INVALID_RELEASE_ARGUMENTS");
    }
    const name = flag.slice(2);
    if (!VALUE_FLAGS.has(name) || Object.hasOwn(values, name)) {
      throw cliError("INVALID_RELEASE_ARGUMENTS");
    }
    values[name] = value;
  }
  if (!values.repo && !values["git-common-dir"]) {
    throw cliError("RELEASE_REPOSITORY_REQUIRED");
  }
  if (!values["run-id"]) throw cliError("PROMOTION_RUN_ID_REQUIRED");
  if (command === "start") {
    for (const name of [
      "vercel-project",
      "vercel-domain",
    ]) {
      if (!values[name]) throw cliError("RELEASE_START_INPUT_REQUIRED");
    }
  }
  if (command === "resume") {
    for (const name of [
      "expected-revision",
      "expected-fingerprint",
      "event",
      "event-at",
    ]) {
      if (!values[name]) throw cliError("RELEASE_RESUME_INPUT_REQUIRED");
    }
  }
  return { command, values };
}

export function executeReleaseGit(command, args, options) {
  return spawnSync(command, args, options);
}

function safeRepository(repoPath) {
  const resolved = path.resolve(repoPath);
  let physical;
  try {
    if (lstatSync(resolved).isSymbolicLink()) throw cliError("RELEASE_REPOSITORY_SYMLINK");
    physical = realpathSync.native(resolved);
  } catch (error) {
    if (error?.code === "RELEASE_REPOSITORY_SYMLINK") throw error;
    throw cliError("RELEASE_REPOSITORY_INVALID");
  }
  if (physical.toLowerCase() !== resolved.toLowerCase()) {
    throw cliError("RELEASE_REPOSITORY_SYMLINK");
  }
  return physical;
}

export function resolveGitCommonDir({
  repoPath,
  commandRunner = executeReleaseGit,
}) {
  const repository = safeRepository(repoPath);
  const result = commandRunner(
    "git",
    ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    {
      cwd: repository,
      encoding: "utf8",
      env: {},
      maxBuffer: 1024 * 1024,
      shell: false,
      timeout: 10_000,
      windowsHide: true,
    },
  );
  if (result?.status !== 0 || result.error || result.signal) {
    throw cliError("GIT_COMMON_DIR_LOOKUP_FAILED");
  }
  const commonDir = path.resolve(String(result.stdout ?? "").trim());
  if (!existsSync(commonDir)) throw cliError("GIT_COMMON_DIR_LOOKUP_FAILED");
  return commonDir;
}

function bool(value, defaultValue = false) {
  if (value === undefined) return defaultValue;
  if (value === "true") return true;
  if (value === "false") return false;
  throw cliError("INVALID_RELEASE_BOOLEAN");
}

function gitCommonDir(values) {
  if (values["git-common-dir"]) return path.resolve(values["git-common-dir"]);
  return resolveGitCommonDir({ repoPath: values.repo });
}

function releaseGitText(repository, args, commandRunner) {
  const result = commandRunner("git", args, {
    cwd: repository,
    encoding: "utf8",
    env: { GIT_TERMINAL_PROMPT: "0" },
    maxBuffer: 1024 * 1024,
    shell: false,
    timeout: 20_000,
    windowsHide: true,
  });
  if (result?.status !== 0 || result.error || result.signal) {
    throw cliError("RELEASE_GIT_EVIDENCE_UNAVAILABLE");
  }
  const output = String(result.stdout ?? "").trim();
  if (output === "" || output.includes("\0") || /[\r\n]/u.test(output)) {
    throw cliError("RELEASE_GIT_EVIDENCE_UNAVAILABLE");
  }
  return output;
}

export function collectReleaseStartEvidence({
  repoPath,
  stgReady = false,
  commandRunner = executeReleaseGit,
  audit = auditSecurityArtifacts,
}) {
  const repository = safeRepository(repoPath);
  const originUrl = releaseGitText(
    repository,
    ["remote", "get-url", PROMOTION_PROFILES.black.remote],
    commandRunner,
  );
  const collabUrl = releaseGitText(
    repository,
    ["remote", "get-url", PROMOTION_PROFILES.keduall.remote],
    commandRunner,
  );
  if (
    parseRepositoryIdentity(originUrl).toLowerCase() !==
      PROMOTION_PROFILES.black.repositoryIdentity.toLowerCase() ||
    parseRepositoryIdentity(collabUrl).toLowerCase() !==
      PROMOTION_PROFILES.keduall.repositoryIdentity.toLowerCase()
  ) {
    throw cliError("REPOSITORY_IDENTITY_MISMATCH");
  }
  const sourceSha = releaseGitText(
    repository,
    ["rev-parse", "--verify", "origin/main^{commit}"],
    commandRunner,
  ).toLowerCase();
  const sourceTreeHash = releaseGitText(
    repository,
    ["rev-parse", "--verify", "origin/main^{tree}"],
    commandRunner,
  ).toLowerCase();
  const stgRef = stgReady ? "collab/stg" : "collab/main";
  const stgBaseSha = releaseGitText(
    repository,
    ["rev-parse", "--verify", `${stgRef}^{commit}`],
    commandRunner,
  ).toLowerCase();
  const expectedSecurityRefs = [
    "origin/main",
    "collab/main",
    ...(stgReady ? ["collab/stg"] : []),
  ].sort();
  const securityAudit = audit({
    repoPath: repository,
    refs: expectedSecurityRefs,
  });
  return {
    repository,
    sourceSha,
    sourceTreeHash,
    stgBaseSha,
    expectedSecurityRefs,
    securityAudit,
  };
}

export function assertPublicReleaseResumeEvent(values) {
  if (
    values?.event !== "PROD_APPROVAL_GRANTED" ||
    typeof values?.approval !== "string" ||
    values.approval.length === 0
  ) {
    throw cliError("RELEASE_TRUSTED_EXECUTOR_REQUIRED");
  }
  return true;
}

function runStart(values) {
  const repository = safeRepository(values.repo ?? values["git-common-dir"]);
  const commonDir = gitCommonDir(values);
  let collected;
  try {
    collected = collectReleaseStartEvidence({
      repoPath: repository,
      stgReady: bool(values["stg-ready"]),
    });
    const security = validateSecurityAuditEvidence(
      collected.securityAudit,
      collected.expectedSecurityRefs,
      {
      sourceSha: collected.sourceSha,
      stgBaseSha: collected.stgBaseSha,
      stgReady: bool(values["stg-ready"]),
      },
    );
    if (!security.ok) throw cliError("SECURITY_INCIDENT_BLOCKED");
  } catch {
    try {
      const existingPolicy = readApprovalPolicy({ gitCommonDir: commonDir });
      const reset = resetApprovalPolicy(existingPolicy, "SECURITY_INCIDENT");
      writeApprovalPolicy({
        gitCommonDir: commonDir,
        policy: reset,
        expectedFingerprint: existingPolicy.fingerprint,
      });
    } catch (policyError) {
      if (policyError?.code !== "APPROVAL_POLICY_NOT_FOUND") throw policyError;
    }
    throw cliError("SECURITY_INCIDENT_BLOCKED");
  }
  const profileFingerprint = promotionProfileFingerprint({
    vercelProject: values["vercel-project"],
    vercelDomain: values["vercel-domain"],
  });
  const record = createPromotionRun({
    runId: values["run-id"],
    now: values.now ?? new Date().toISOString(),
    sourceSha: collected.sourceSha,
    sourceTreeHash: collected.sourceTreeHash,
    stgBaseSha: collected.stgBaseSha,
    securityAudit: collected.securityAudit,
    expectedSecurityRefs: collected.expectedSecurityRefs,
    controlPlaneReady: bool(values["control-plane-ready"]),
    stgReady: bool(values["stg-ready"]),
    vercelProject: values["vercel-project"],
    vercelDomain: values["vercel-domain"],
  });
  try {
    const existing = readApprovalPolicy({ gitCommonDir: commonDir });
    const reconciled = reconcileApprovalPolicy(existing, {
      contractFingerprint: record.contractFingerprint,
      profileFingerprint,
    });
    if (reconciled !== existing) {
      writeApprovalPolicy({
        gitCommonDir: commonDir,
        policy: reconciled,
        expectedFingerprint: existing.fingerprint,
      });
    }
  } catch (error) {
    if (error?.code !== "APPROVAL_POLICY_NOT_FOUND") throw error;
    writeApprovalPolicy({
      gitCommonDir: commonDir,
      policy: createApprovalPolicy({
        contractFingerprint: record.contractFingerprint,
        profileFingerprint,
      }),
    });
  }
  writePromotionRun({ gitCommonDir: commonDir, record });
  return record;
}

function runStatus(values) {
  return readPromotionRun({
    gitCommonDir: gitCommonDir(values),
    runId: values["run-id"],
  });
}

function runResume(values) {
  assertPublicReleaseResumeEvent(values);
  const commonDir = gitCommonDir(values);
  const record = readPromotionRun({ gitCommonDir: commonDir, runId: values["run-id"] });
  const policy = readApprovalPolicy({ gitCommonDir: commonDir });
  const event = {
    type: values.event,
    at: values["event-at"],
  };
  if (values.approval) event.approvalFingerprint = values.approval;
  const result = advancePromotionRun(record, {
    expectedRevision: Number(values["expected-revision"]),
    expectedFingerprint: values["expected-fingerprint"],
    event,
    policy,
  });
  return persistPromotionTransition({
    currentRecord: record,
    currentPolicy: policy,
    result,
    writeRun: (next, expected) => writePromotionRun({
      gitCommonDir: commonDir,
      record: next,
      expectedFingerprint: expected,
    }),
    writePolicy: (next, expected) => writeApprovalPolicy({
      gitCommonDir: commonDir,
      policy: next,
      expectedFingerprint: expected,
    }),
  });
}

export function runReleaseCli(argv) {
  const { command, values } = parseReleaseArguments(argv);
  if (command === "start") return runStart(values);
  if (command === "status") return runStatus(values);
  return runResume(values);
}

export function main(argv = process.argv.slice(2)) {
  try {
    const result = runReleaseCli(argv);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ error: error?.code ?? "RELEASE_COMMAND_FAILED" })}\n`);
    return 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = main();
}
