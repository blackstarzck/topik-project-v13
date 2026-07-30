#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, realpathSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { resolveGitCommonDir } from "./ai-release.mjs";
import {
  parseRepositoryIdentity,
  promotionRunLockPath,
  PROMOTION_PROFILES,
  readApprovalPolicy,
  readPromotionRun,
} from "./lib/ai-release-promotion.mjs";
import {
  buildHumanApprovalCommand,
  evaluatePreflight,
  planNextStep,
} from "./lib/ai-release-executor.mjs";

const COMMANDS = new Set(["status", "next", "run", "probe-vercel"]);
const VALUE_FLAGS = new Set(["repo", "run-id"]);
const CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/u;

function executorError(code) {
  return Object.assign(new Error(code), { code });
}

export function parseExecutorArguments(argv) {
  const [command, ...tokens] = argv;
  if (!COMMANDS.has(command)) throw executorError("EXECUTOR_COMMAND_REQUIRED");
  if (tokens.length % 2 !== 0) throw executorError("INVALID_EXECUTOR_ARGUMENTS");
  const values = {};
  for (let index = 0; index < tokens.length; index += 2) {
    const flag = tokens[index];
    const value = tokens[index + 1];
    if (!flag?.startsWith("--") || value?.startsWith("--")) {
      throw executorError("INVALID_EXECUTOR_ARGUMENTS");
    }
    const name = flag.slice(2);
    if (!VALUE_FLAGS.has(name) || Object.hasOwn(values, name)) {
      throw executorError("INVALID_EXECUTOR_ARGUMENTS");
    }
    values[name] = value;
  }
  if (!values.repo) throw executorError("EXECUTOR_REPOSITORY_REQUIRED");
  if (!values["run-id"]) throw executorError("PROMOTION_RUN_ID_REQUIRED");
  return { command, values };
}

export function executeExecutorGit(command, args, options) {
  return spawnSync(command, args, options);
}

export function safeRepository(repoPath) {
  const resolved = path.resolve(repoPath);
  let physical;
  try {
    if (lstatSync(resolved).isSymbolicLink()) throw executorError("EXECUTOR_REPOSITORY_SYMLINK");
    physical = realpathSync.native(resolved);
  } catch (error) {
    if (error?.code === "EXECUTOR_REPOSITORY_SYMLINK") throw error;
    throw executorError("EXECUTOR_REPOSITORY_INVALID");
  }
  if (physical.toLowerCase() !== resolved.toLowerCase()) {
    throw executorError("EXECUTOR_REPOSITORY_SYMLINK");
  }
  return physical;
}

function readOnlyGitText(repository, args, commandRunner) {
  const result = commandRunner("git", args, {
    cwd: repository,
    encoding: "utf8",
    env: {
      GIT_TERMINAL_PROMPT: "0",
      PATH: process.env.PATH ?? "",
      SystemRoot: process.env.SystemRoot ?? "",
      WINDIR: process.env.WINDIR ?? "",
    },
    maxBuffer: 1024 * 1024,
    shell: false,
    timeout: 20_000,
    windowsHide: true,
  });
  if (result?.status !== 0 || result.error || result.signal) return null;
  const output = String(result.stdout ?? "").trim();
  if (output === "" || output.includes("\0") || /[\r\n]/u.test(output)) return null;
  return output;
}

function repositoryIdentityOrNull(repository, remote, commandRunner) {
  const url = readOnlyGitText(repository, ["remote", "get-url", remote], commandRunner);
  if (url === null) return null;
  try {
    return parseRepositoryIdentity(url);
  } catch {
    return null;
  }
}

export function collectExecutorObservations({
  repository,
  gitCommonDir,
  runId,
  commandRunner = executeExecutorGit,
}) {
  const stgRef = `${PROMOTION_PROFILES.keduall.remote}/${PROMOTION_PROFILES.keduall.stgBranch}`;
  const stgSha = readOnlyGitText(
    repository,
    ["rev-parse", "--verify", `${stgRef}^{commit}`],
    commandRunner,
  );
  let registryLockPresent = null;
  try {
    registryLockPresent = existsSync(promotionRunLockPath({ gitCommonDir, runId }));
  } catch {
    registryLockPresent = null;
  }
  return {
    stgSha: stgSha === null ? null : stgSha.toLowerCase(),
    sourceRepositoryIdentity: repositoryIdentityOrNull(
      repository,
      PROMOTION_PROFILES.black.remote,
      commandRunner,
    ),
    targetRepositoryIdentity: repositoryIdentityOrNull(
      repository,
      PROMOTION_PROFILES.keduall.remote,
      commandRunner,
    ),
    registryLockPresent,
    verifiedAccounts: null,
  };
}

function runStatus(values, { now = new Date().toISOString() } = {}) {
  const repository = safeRepository(values.repo);
  const gitCommonDir = resolveGitCommonDir({ repoPath: repository });
  const runId = values["run-id"];
  const record = readPromotionRun({ gitCommonDir, runId });
  const policy = readApprovalPolicy({ gitCommonDir });
  const observed = collectExecutorObservations({ repository, gitCommonDir, runId });
  const plan = planNextStep(record);
  const preflight = evaluatePreflight({ record, observed });
  return {
    schemaVersion: 1,
    recordType: "PromotionExecutorStatusV1",
    runId: record.runId,
    contractVersion: record.contractVersion,
    state: record.state,
    revision: record.revision,
    fingerprint: record.fingerprint,
    blocker: record.blocker,
    approval: {
      mode: policy.mode,
      consecutiveSuccessCount: policy.consecutiveSuccessCount,
      policyFingerprint: policy.fingerprint,
      approvalFingerprint: record.approval.approvalFingerprint,
    },
    migration: { status: record.migration.status, autoApplyEnabled: record.migration.autoApplyEnabled },
    plan,
    observed,
    preflight,
    humanApproval: plan.requiresHumanApproval
      ? { required: true, command: buildHumanApprovalCommand({ repository, record, at: now }) }
      : { required: false, command: null },
  };
}

export function runExecutorCli(argv, options = {}) {
  const { command, values } = parseExecutorArguments(argv);
  if (command === "status") return runStatus(values, options);
  throw executorError("EXECUTOR_STEP_NOT_IMPLEMENTED");
}

export function main(argv = process.argv.slice(2)) {
  try {
    const result = runExecutorCli(argv);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  } catch (error) {
    const systemError = error?.syscall !== undefined || typeof error?.errno === "number";
    const code = !systemError && typeof error?.code === "string" && CODE_PATTERN.test(error.code)
      ? error.code
      : "EXECUTOR_COMMAND_FAILED";
    process.stderr.write(`${JSON.stringify({ error: code })}\n`);
    return 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = main();
}
