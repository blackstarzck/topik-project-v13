#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { resolveGitCommonDir } from "./ai-release.mjs";
import {
  advancePromotionRun,
  parseRepositoryIdentity,
  persistPromotionTransition,
  promotionRunLockPath,
  PROMOTION_PROFILES,
  readApprovalPolicy,
  readPromotionRun,
  writeApprovalPolicy,
  writePromotionRun,
} from "./lib/ai-release-promotion.mjs";
import {
  accountForStep,
  assertExecutorSubmittableEvent,
  buildAliasRollbackVerifiedEvent,
  buildCandidateVerifiedEvent,
  buildCleanupVerifiedEvent,
  buildDbGateEvaluatedEvent,
  buildHumanApprovalCommand,
  buildMainMergeVerifiedEvent,
  buildMainPrOpenEvent,
  buildProductionEvaluatedEvent,
  buildStgPrOpenEvent,
  buildStgReadyEvent,
  evaluatePreflight,
  loadMigrationEvidenceFile,
  planNextStep,
  writeSubmittedEvidence,
} from "./lib/ai-release-executor.mjs";
import {
  candidateMergeObservation,
  cleanupObservation,
  createGitAdapter,
  createGitHubAdapter,
  mainMergeObservation,
  mainPullRequestObservation,
  stgPullRequestObservation,
  stgReadyObservation,
} from "./lib/ai-release-git.mjs";
import {
  createVercelAdapter,
  createVercelCredentialProvider,
  previewObservation,
  productionObservation,
  rollbackObservation,
  runReadOnlySmoke,
} from "./lib/ai-release-vercel.mjs";
import {
  PIPELINE_REPOSITORY_PROFILES,
  withRepositoryAuth,
} from "./lib/ai-task-sweep.mjs";

const COMMANDS = new Set(["status", "next", "run", "probe-vercel"]);
const VALUE_FLAGS = new Set(["repo", "run-id", "branch", "db-evidence"]);
const BOOLEAN_FLAGS = new Set(["dry-run"]);
const COMMAND_FLAGS = new Map([
  ["status", new Set(["repo", "run-id"])],
  ["next", new Set(["repo", "run-id", "db-evidence", "dry-run"])],
  ["run", new Set(["repo", "run-id", "db-evidence", "dry-run"])],
  ["probe-vercel", new Set(["repo", "run-id", "branch"])],
]);
const DEFAULT_PREVIEW_BRANCH = "stg";
const CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/u;
const SHA_PATTERN = /^[a-f0-9]{40}$/u;

const KEDUALL = PROMOTION_PROFILES.keduall;
const BLACK_ACCOUNT = PROMOTION_PROFILES.black.authLogin;
const KEDUALL_ACCOUNT = KEDUALL.authLogin;
const ACCOUNT_REPOSITORY_PROFILES = new Map([
  [BLACK_ACCOUNT, PIPELINE_REPOSITORY_PROFILES.collabSource],
  [KEDUALL_ACCOUNT, PIPELINE_REPOSITORY_PROFILES.collab],
]);

const EXECUTOR_MAX_RUN_ITERATIONS = 12;
const DB_RETRY_STATES = new Set(["DB_BASELINE_REQUIRED", "DB_GATE_BLOCKED"]);
const DEFAULT_READY_ATTEMPTS = 30;
const DEFAULT_READY_INTERVAL_MS = 10_000;
const DEFAULT_DEPLOYMENT_ATTEMPTS = 20;
const DEFAULT_DEPLOYMENT_INTERVAL_MS = 15_000;
const DEFAULT_ALIAS_ATTEMPTS = 20;
const DEFAULT_ALIAS_INTERVAL_MS = 15_000;
const DEFAULT_SMOKE_ATTEMPTS = 5;
const DEFAULT_SMOKE_INTERVAL_MS = 15_000;
const DEFAULT_SMOKE_CHECKS = Object.freeze([
  Object.freeze({ path: "/", expectedStatus: 200 }),
]);
const DB_EVIDENCE_SEGMENTS = Object.freeze(["TalkpikPipeline", "db-evidence"]);
const NO_HUMAN_APPROVAL = Object.freeze({ required: false, command: null });

function executorError(code) {
  return Object.assign(new Error(code), { code });
}

export function safeExecutorCode(error) {
  const systemError = error?.syscall !== undefined || typeof error?.errno === "number";
  return !systemError && typeof error?.code === "string" && CODE_PATTERN.test(error.code)
    ? error.code
    : "EXECUTOR_COMMAND_FAILED";
}

export function parseExecutorArguments(argv) {
  const input = Array.isArray(argv) ? argv : [];
  const rest = input[0] === "--" ? input.slice(1) : input;
  if (rest[0] === "--") throw executorError("INVALID_EXECUTOR_ARGUMENTS");
  const [command, ...tokens] = rest;
  if (!COMMANDS.has(command)) throw executorError("EXECUTOR_COMMAND_REQUIRED");
  const allowed = COMMAND_FLAGS.get(command);
  const values = {};
  let index = 0;
  while (index < tokens.length) {
    const flag = tokens[index];
    if (typeof flag !== "string" || !flag.startsWith("--")) {
      throw executorError("INVALID_EXECUTOR_ARGUMENTS");
    }
    const name = flag.slice(2);
    if (!allowed.has(name) || Object.hasOwn(values, name)) {
      throw executorError("INVALID_EXECUTOR_ARGUMENTS");
    }
    if (BOOLEAN_FLAGS.has(name)) {
      values[name] = true;
      index += 1;
      continue;
    }
    if (!VALUE_FLAGS.has(name)) throw executorError("INVALID_EXECUTOR_ARGUMENTS");
    const value = tokens[index + 1];
    if (typeof value !== "string" || value.startsWith("--")) {
      throw executorError("INVALID_EXECUTOR_ARGUMENTS");
    }
    values[name] = value;
    index += 2;
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

function readOnlyCommitParents(repository, sha, commandRunner) {
  const output = readOnlyGitText(
    repository,
    ["rev-list", "--parents", "-n", "1", sha],
    commandRunner,
  );
  if (output === null) return null;
  const tokens = output.split(/\s+/u).map((entry) => entry.toLowerCase());
  if (tokens[0] !== sha) return null;
  const parents = tokens.slice(1);
  return parents.every((entry) => SHA_PATTERN.test(entry)) ? parents : null;
}

function adapterCommitParents(git, sha) {
  try {
    return git.commitParents(sha);
  } catch {
    return null;
  }
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
  const stgRef = `${KEDUALL.remote}/${KEDUALL.stgBranch}`;
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
  const normalizedStgSha = stgSha === null ? null : stgSha.toLowerCase();
  return {
    stgSha: normalizedStgSha,
    stgParents:
      normalizedStgSha === null
        ? null
        : readOnlyCommitParents(repository, normalizedStgSha, commandRunner),
    sourceRepositoryIdentity: repositoryIdentityOrNull(
      repository,
      PROMOTION_PROFILES.black.remote,
      commandRunner,
    ),
    targetRepositoryIdentity: repositoryIdentityOrNull(
      repository,
      KEDUALL.remote,
      commandRunner,
    ),
    registryLockPresent,
    verifiedAccounts: null,
  };
}

function registryLockReport(gitCommonDir, runId) {
  let present = null;
  try {
    present = existsSync(promotionRunLockPath({ gitCommonDir, runId }));
  } catch {
    present = null;
  }
  return { present, removed: false, autoRemoval: false };
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
    registryLock: registryLockReport(gitCommonDir, runId),
    humanApproval: plan.requiresHumanApproval
      ? { required: true, command: buildHumanApprovalCommand({ repository, record, at: now }) }
      : NO_HUMAN_APPROVAL,
  };
}

export async function runProbeVercel(values, options = {}) {
  const repository = safeRepository(values.repo);
  const gitCommonDir = resolveGitCommonDir({ repoPath: repository });
  const record = readPromotionRun({ gitCommonDir, runId: values["run-id"] });
  const branch = values.branch ?? DEFAULT_PREVIEW_BRANCH;
  const credentialProvider = createVercelCredentialProvider({
    localAppData: options.localAppData ?? process.env.LOCALAPPDATA,
    env: options.env ?? process.env,
  });
  const vercel = createVercelAdapter({
    credentialProvider,
    fetchImplementation: options.fetchImplementation ?? globalThis.fetch,
    ...(options.baseUrl === undefined ? {} : { baseUrl: options.baseUrl }),
  });
  const project = record.vercel.project;
  const domain = record.vercel.domain;
  const previewSha = record.target.stgSha;
  const productionSha = record.target.mainSha;

  return {
    schemaVersion: 1,
    recordType: "PromotionVercelProbeV1",
    runId: record.runId,
    state: record.state,
    readOnly: true,
    credentialSource: credentialProvider.source(),
    project,
    domain,
    branch,
    preview:
      previewSha === null
        ? null
        : await vercel.findDeploymentByCommit({
            projectId: project,
            commitSha: previewSha,
            target: "preview",
          }),
    previewEnvironment: await vercel.verifyPreviewEnvironmentScope({ projectId: project, branch }),
    production:
      productionSha === null
        ? null
        : await vercel.findDeploymentByCommit({
            projectId: project,
            commitSha: productionSha,
            target: "production",
          }),
    alias: await vercel.getAliasTarget({ domain }),
  };
}

async function executorAuthCommand(command, args, commandOptions) {
  const result = spawnSync(command, args, {
    ...commandOptions,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  return {
    stdout: String(result?.stdout ?? ""),
    stderr: "",
    exitCode: typeof result?.status === "number" ? result.status : 1,
  };
}

function migrationEvidenceRoot(options) {
  const localAppData = options.localAppData ?? process.env.LOCALAPPDATA;
  if (typeof localAppData !== "string" || localAppData.trim() === "" ||
      !path.isAbsolute(localAppData)) {
    throw executorError("DB_EVIDENCE_ROOT_UNAVAILABLE");
  }
  return path.join(localAppData, ...DB_EVIDENCE_SEGMENTS);
}

function defaultSleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function attemptLimit(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : 1;
}

async function pollForValue({ attempts, intervalMs, sleep, probe }) {
  const limit = attemptLimit(attempts);
  for (let attempt = 1; attempt <= limit; attempt += 1) {
    const value = await probe();
    if (value !== null) return value;
    if (attempt === limit) break;
    await sleep(intervalMs);
  }
  return null;
}

function awaitDeployment(context, vercel, target) {
  return pollForValue({
    attempts: context.deploymentAttempts,
    intervalMs: context.deploymentIntervalMs,
    sleep: context.sleep,
    probe: () => vercel.findDeploymentByCommit(target),
  });
}

async function awaitAliasSwitch(context, vercel, { domain, deploymentId }) {
  const matched = await pollForValue({
    attempts: context.aliasAttempts,
    intervalMs: context.aliasIntervalMs,
    sleep: context.sleep,
    probe: async () => {
      const current = await vercel.getAliasTarget({ domain });
      return current !== null && current.deploymentId === deploymentId ? true : null;
    },
  });
  return matched === true;
}

async function awaitReadOnlySmoke(context, baseUrl) {
  const limit = attemptLimit(context.smokeAttempts);
  let observed = null;
  for (let attempt = 1; attempt <= limit; attempt += 1) {
    observed = await context.smoke({
      baseUrl,
      checks: context.smokeChecks,
      fetchImplementation: context.smokeFetch,
    });
    if (observed?.smokePassed === true || attempt === limit) break;
    await context.sleep(context.smokeIntervalMs);
  }
  return observed;
}

function lazily(factory) {
  let value;
  let created = false;
  return () => {
    if (!created) {
      value = factory();
      created = true;
    }
    return value;
  };
}

function buildStepContext({ repository, options, migrationEvidence, warnings }) {
  const localAppData = options.localAppData ?? process.env.LOCALAPPDATA;
  return {
    repository,
    warnings,
    migrationEvidence,
    git: options.git ?? createGitAdapter({ repoPath: repository }),
    github: options.github ?? createGitHubAdapter({ cwd: repository }),
    vercel:
      options.vercel === undefined
        ? lazily(() =>
            createVercelAdapter({
              credentialProvider: createVercelCredentialProvider({
                localAppData,
                env: options.env ?? process.env,
              }),
              fetchImplementation: options.fetchImplementation ?? globalThis.fetch,
              ...(options.baseUrl === undefined ? {} : { baseUrl: options.baseUrl }),
            }),
          )
        : () => options.vercel,
    smoke: options.smoke ?? runReadOnlySmoke,
    smokeChecks: options.smokeChecks ?? DEFAULT_SMOKE_CHECKS,
    smokeFetch: options.smokeFetch ?? options.fetchImplementation ?? globalThis.fetch,
    readyAttempts: options.readyAttempts ?? DEFAULT_READY_ATTEMPTS,
    readyIntervalMs: options.readyIntervalMs ?? DEFAULT_READY_INTERVAL_MS,
    sleep: options.sleep ?? defaultSleep,
    deploymentAttempts: options.deploymentAttempts ?? DEFAULT_DEPLOYMENT_ATTEMPTS,
    deploymentIntervalMs: options.deploymentIntervalMs ?? DEFAULT_DEPLOYMENT_INTERVAL_MS,
    aliasAttempts: options.aliasAttempts ?? DEFAULT_ALIAS_ATTEMPTS,
    aliasIntervalMs: options.aliasIntervalMs ?? DEFAULT_ALIAS_INTERVAL_MS,
    smokeAttempts: options.smokeAttempts ?? DEFAULT_SMOKE_ATTEMPTS,
    smokeIntervalMs: options.smokeIntervalMs ?? DEFAULT_SMOKE_INTERVAL_MS,
    worktreeRoot: options.worktreeRoot ?? path.join(tmpdir(), "talkpik-promotion-candidate"),
    writeEvidence: options.writeEvidence ?? writeSubmittedEvidence,
    authRunner:
      options.authRunner ??
      (({ profile, operation }) =>
        withRepositoryAuth({
          profile,
          localAppData,
          runCommand: executorAuthCommand,
          operation,
        })),
  };
}

function authBlockerCode(blocker) {
  return typeof blocker === "string" && CODE_PATTERN.test(blocker)
    ? `EXECUTOR_${blocker}`
    : "EXECUTOR_ACCOUNT_UNAVAILABLE";
}

function repositoryProfileFor(account) {
  const profile = ACCOUNT_REPOSITORY_PROFILES.get(account);
  if (profile === undefined) throw executorError("EXECUTOR_ACCOUNT_PROFILE_UNKNOWN");
  return profile;
}

async function withAccount(context, account, operation) {
  if (account === null) return operation();
  const outcome = await context.authRunner({
    profile: repositoryProfileFor(account),
    operation,
  });
  if (outcome?.result !== "AUTHENTICATED") {
    throw executorError(
      typeof outcome?.operationCode === "string" && CODE_PATTERN.test(outcome.operationCode)
        ? outcome.operationCode
        : authBlockerCode(outcome?.blocker),
    );
  }
  return outcome.value;
}

async function verifiedAccountsFor(context, accounts) {
  const verified = [];
  for (const account of accounts) {
    const outcome = await context.authRunner({
      profile: repositoryProfileFor(account),
      operation: () => account,
    });
    if (outcome?.result === "AUTHENTICATED" && outcome.value === account) verified.push(account);
  }
  return verified;
}

async function runStepOperations({ step, context, handlers }) {
  const scratch = {};
  for (const entry of accountForStep(step).operations) {
    const handler = handlers[entry.operation];
    if (typeof handler !== "function") throw executorError("EXECUTOR_STEP_OPERATION_MISSING");
    await withAccount(context, entry.account, () => handler(scratch));
  }
  return scratch;
}

function localBranchShaOrNull(git, branch) {
  try {
    return git.resolveCommit(branch);
  } catch {
    return null;
  }
}

function sameShaList(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function candidateHandlers(record, context) {
  const remote = KEDUALL.remote;
  const branch = record.target.candidateBranch;
  return {
    create(scratch) {
      const published = context.git.remoteBranchSha({ remote, branch });
      if (published !== null) {
        scratch.candidateSha = published;
        scratch.published = true;
        return;
      }
      const local = localBranchShaOrNull(context.git, branch);
      if (local !== null) {
        scratch.candidateSha = local;
        scratch.published = false;
        return;
      }
      const merged = context.git.createCandidateMerge({
        candidateBranch: branch,
        baseSha: record.target.stgBaseSha,
        sourceSha: record.source.sha,
        worktreeRoot: context.worktreeRoot,
      });
      if (merged.cleanupFailed === true) {
        context.warnings.push("EXECUTOR_CANDIDATE_WORKTREE_CLEANUP_WARNING");
      }
      scratch.candidateSha = merged.candidateSha;
      scratch.published = false;
    },
    push(scratch) {
      if (scratch.published !== true) {
        context.git.pushBranch({ remote, branch, expectedSha: scratch.candidateSha });
      }
      scratch.parents = context.git.commitParents(scratch.candidateSha);
    },
  };
}

function stgPullRequestHandlers(record, context) {
  return {
    create(scratch) {
      const pullRequest = context.github.createPullRequest({
        ownerRepo: KEDUALL.repositoryIdentity,
        base: KEDUALL.stgBranch,
        head: record.target.candidateBranch,
        title: `chore: promote ${record.source.sha} to stg`,
        body: `Promotion run ${record.runId}. Black source SHA ${record.source.sha}.`,
      });
      scratch.headSha = pullRequest.headSha;
      scratch.number = pullRequest.number;
    },
  };
}

function stgMergeHandlers(record, context) {
  const remote = KEDUALL.remote;
  const branch = KEDUALL.stgBranch;
  const expectedParents = [record.target.stgBaseSha, record.target.candidateSha];
  return {
    merge(scratch) {
      context.git.fetchRemote({ remote });
      const tip = context.git.remoteBranchSha({ remote, branch });
      if (tip === null) throw executorError("EXECUTOR_STG_TIP_UNVERIFIED");
      if (sameShaList(context.git.commitParents(tip), expectedParents)) {
        scratch.stgSha = tip;
        scratch.parents = expectedParents;
        scratch.reusedMerge = true;
        return;
      }
      const pullRequest = context.github.findPullRequest({
        ownerRepo: KEDUALL.repositoryIdentity,
        base: branch,
        head: record.target.candidateBranch,
      });
      if (pullRequest === null) throw executorError("EXECUTOR_PR_NOT_FOUND");
      const merged = context.github.mergePullRequest({
        ownerRepo: KEDUALL.repositoryIdentity,
        number: pullRequest.number,
        expectedHeadSha: record.target.candidateSha,
      });
      context.git.fetchRemote({ remote });
      scratch.stgSha = merged.mergeCommitSha;
      scratch.parents = context.git.commitParents(merged.mergeCommitSha);
      scratch.reusedMerge = false;
    },
    async verify(scratch) {
      const vercel = context.vercel();
      const deployment = await awaitDeployment(context, vercel, {
        projectId: record.vercel.project,
        commitSha: scratch.stgSha,
        target: "preview",
      });
      if (deployment === null) throw executorError("VERCEL_DEPLOYMENT_NOT_FOUND");
      const ready = await vercel.waitForReady({
        deploymentId: deployment.deploymentId,
        maxAttempts: context.readyAttempts,
        intervalMs: context.readyIntervalMs,
      });
      const scope = await vercel.verifyPreviewEnvironmentScope({
        projectId: record.vercel.project,
        branch,
      });
      scratch.preview = previewObservation({
        deployment: { ...deployment, state: ready.state },
        project: record.vercel.project,
        expectedStgSha: scratch.stgSha,
        environmentScope: scope.environmentScope,
      });
    },
  };
}

function dbGateHandlers(record, context) {
  return {
    verify(scratch) {
      if (context.migrationEvidence === null) throw executorError("EXECUTOR_DB_EVIDENCE_REQUIRED");
      scratch.migrationEvidence = context.migrationEvidence;
    },
  };
}

function mainPullRequestHandlers(record, context) {
  return {
    create(scratch) {
      const pullRequest = context.github.createPullRequest({
        ownerRepo: KEDUALL.repositoryIdentity,
        base: KEDUALL.mainBranch,
        head: KEDUALL.stgBranch,
        title: `chore: promote stg ${record.target.stgSha} to main`,
        body: `Promotion run ${record.runId}. Keduall stg SHA ${record.target.stgSha}.`,
      });
      scratch.headSha = pullRequest.headSha;
      scratch.number = pullRequest.number;
    },
  };
}

function mainMergeHandlers(record, context) {
  const remote = KEDUALL.remote;
  const branch = KEDUALL.mainBranch;
  return {
    merge(scratch) {
      context.git.fetchRemote({ remote });
      const tip = context.git.remoteBranchSha({ remote, branch });
      if (tip === null) throw executorError("EXECUTOR_MAIN_TIP_UNVERIFIED");
      const parents = context.git.commitParents(tip);
      if (parents.length === 2 && parents[1] === record.target.stgSha) {
        scratch.mainBaseSha = parents[0];
        scratch.mainSha = tip;
        scratch.parents = parents;
        scratch.reusedMerge = true;
        return;
      }
      const pullRequest = context.github.findPullRequest({
        ownerRepo: KEDUALL.repositoryIdentity,
        base: branch,
        head: KEDUALL.stgBranch,
      });
      if (pullRequest === null) throw executorError("EXECUTOR_PR_NOT_FOUND");
      const merged = context.github.mergePullRequest({
        ownerRepo: KEDUALL.repositoryIdentity,
        number: pullRequest.number,
        expectedHeadSha: record.target.stgSha,
      });
      scratch.mainBaseSha = tip;
      scratch.mainSha = merged.mergeCommitSha;
      scratch.reusedMerge = false;
    },
    verify(scratch) {
      if (scratch.reusedMerge === true) return;
      context.git.fetchRemote({ remote });
      scratch.parents = context.git.commitParents(scratch.mainSha);
    },
  };
}

function productionHandlers(record, context) {
  return {
    async verify(scratch) {
      const vercel = context.vercel();
      const deployment = await awaitDeployment(context, vercel, {
        projectId: record.vercel.project,
        commitSha: record.target.mainSha,
        target: "production",
      });
      if (deployment === null) throw executorError("VERCEL_DEPLOYMENT_NOT_FOUND");
      const ready = await vercel.waitForReady({
        deploymentId: deployment.deploymentId,
        maxAttempts: context.readyAttempts,
        intervalMs: context.readyIntervalMs,
      });
      const previousReady = await vercel.findPreviousReadyProduction({
        projectId: record.vercel.project,
        beforeDeploymentId: deployment.deploymentId,
      });
      const aliasSwitched = await awaitAliasSwitch(context, vercel, {
        domain: record.vercel.domain,
        deploymentId: deployment.deploymentId,
      });
      const smoke = await awaitReadOnlySmoke(context, `https://${record.vercel.domain}`);
      scratch.evidence = productionObservation({
        deployment: {
          deploymentId: deployment.deploymentId,
          commitSha: record.target.mainSha,
          state: ready.state,
          target: "production",
        },
        project: record.vercel.project,
        domain: record.vercel.domain,
        alias: record.vercel.domain,
        aliasSwitched,
        smoke,
        previousReady,
      });
    },
  };
}

function rollbackHandlers(record, context) {
  return {
    async rollback(scratch) {
      const vercel = context.vercel();
      const target = record.vercel.rollbackDeploymentId;
      const current = await vercel.getAliasTarget({ domain: record.vercel.domain });
      scratch.reusedAlias = current !== null && current.deploymentId === target;
      if (!scratch.reusedAlias) {
        await vercel.assignAlias({ deploymentId: target, domain: record.vercel.domain });
      }
      const ready = await vercel.waitForReady({
        deploymentId: target,
        maxAttempts: 1,
        intervalMs: context.readyIntervalMs,
      });
      scratch.rollback = rollbackObservation({
        deployment: { deploymentId: target, state: ready.state },
        alias: record.vercel.domain,
      });
    },
  };
}

function cleanupHandlers(record, context) {
  const remote = KEDUALL.remote;
  return {
    cleanup(scratch) {
      context.git.fetchRemote({ remote });
      const sync = context.git.fastForwardRemoteBranch({
        remote,
        branch: KEDUALL.stgBranch,
        expectedSha: record.target.mainSha,
      });
      scratch.stgFastForwardedToMain = sync.ok === true;
      scratch.reusedSync = sync.alreadySynced === true;
      const candidateSha = context.git.remoteBranchSha({
        remote,
        branch: record.target.candidateBranch,
      });
      scratch.candidateRemoved = candidateSha === null;
      if (candidateSha !== null) {
        context.git.deleteRemoteBranch({ remote, branch: record.target.candidateBranch });
        scratch.candidateRemoved = true;
      }
    },
  };
}

const STEP_HANDLERS = new Map([
  ["CREATE_CANDIDATE", candidateHandlers],
  ["OPEN_STG_PR", stgPullRequestHandlers],
  ["MERGE_STG_PR", stgMergeHandlers],
  ["EVALUATE_DB_GATE", dbGateHandlers],
  ["OPEN_MAIN_PR", mainPullRequestHandlers],
  ["MERGE_MAIN_PR", mainMergeHandlers],
  ["VERIFY_PRODUCTION", productionHandlers],
  ["ROLLBACK_ALIAS", rollbackHandlers],
  ["CLEANUP_PROMOTION", cleanupHandlers],
]);

function assembleStepEvent({ step, record, scratch, at }) {
  if (step === "CREATE_CANDIDATE") {
    return buildCandidateVerifiedEvent({
      at,
      record,
      observed: candidateMergeObservation({
        candidateBranch: record.target.candidateBranch,
        candidateSha: scratch.candidateSha,
        baseSha: record.target.stgBaseSha,
        sourceSha: record.source.sha,
        parents: scratch.parents,
      }),
    });
  }
  if (step === "OPEN_STG_PR") {
    return buildStgPrOpenEvent({
      at,
      record,
      observed: stgPullRequestObservation({
        headBranch: record.target.candidateBranch,
        headSha: scratch.headSha,
      }),
    });
  }
  if (step === "MERGE_STG_PR") {
    return buildStgReadyEvent({
      at,
      record,
      observed: stgReadyObservation({
        stgSha: scratch.stgSha,
        parents: scratch.parents,
        preview: scratch.preview,
      }),
    });
  }
  if (step === "EVALUATE_DB_GATE") {
    return buildDbGateEvaluatedEvent({
      at,
      record,
      observed: { migrationEvidence: scratch.migrationEvidence },
    });
  }
  if (step === "OPEN_MAIN_PR") {
    return buildMainPrOpenEvent({
      at,
      record,
      observed: mainPullRequestObservation({ headSha: scratch.headSha }),
    });
  }
  if (step === "MERGE_MAIN_PR") {
    return buildMainMergeVerifiedEvent({
      at,
      record,
      observed: mainMergeObservation({
        mainBaseSha: scratch.mainBaseSha,
        mainSha: scratch.mainSha,
        headSha: record.target.stgSha,
        parents: scratch.parents,
      }),
    });
  }
  if (step === "VERIFY_PRODUCTION") {
    return buildProductionEvaluatedEvent({
      at,
      record,
      observed: { deployment: scratch.evidence },
    });
  }
  if (step === "ROLLBACK_ALIAS") {
    return buildAliasRollbackVerifiedEvent({
      at,
      record,
      observed: { rollback: scratch.rollback },
    });
  }
  if (step === "CLEANUP_PROMOTION") {
    return buildCleanupVerifiedEvent({
      at,
      record,
      observed: cleanupObservation({
        stgFastForwardedToMain: scratch.stgFastForwardedToMain === true,
      }),
    });
  }
  throw executorError("EXECUTOR_STEP_UNKNOWN");
}

export function describeStepIntent({ step, record }) {
  const profile = accountForStep(step);
  return {
    step,
    operations: profile.operations.map((entry) => ({
      operation: entry.operation,
      account: entry.account,
    })),
    targetRepository: KEDUALL.repositoryIdentity,
    candidateBranch: record.target.candidateBranch,
    stgBranch: KEDUALL.stgBranch,
    mainBranch: KEDUALL.mainBranch,
    vercelProject: record.vercel.project,
    vercelDomain: record.vercel.domain,
  };
}

function resolveNow(options) {
  const value = typeof options.now === "function" ? options.now() : options.now;
  return value ?? new Date().toISOString();
}

export async function runNext(values, options = {}) {
  const repository = safeRepository(values.repo);
  const gitCommonDir = resolveGitCommonDir({ repoPath: repository });
  const runId = values["run-id"];
  const dryRun = values["dry-run"] === true;
  const now = resolveNow(options);
  const record = readPromotionRun({ gitCommonDir, runId });
  const policy = readApprovalPolicy({ gitCommonDir });
  const plan = planNextStep(record);
  const warnings = [];
  const registryLock = registryLockReport(gitCommonDir, runId);
  const base = {
    schemaVersion: 1,
    recordType: "PromotionExecutorStepV1",
    runId: record.runId,
    state: record.state,
    revision: record.revision,
    fingerprint: record.fingerprint,
    dryRun,
    step: plan.step,
    event: plan.event,
    plan,
    registryLock,
    humanApproval: NO_HUMAN_APPROVAL,
    observed: null,
    preflight: null,
    intent: null,
    result: null,
    warnings,
  };

  if (registryLock.present !== false) {
    return {
      ...base,
      outcome: "PREFLIGHT_BLOCKED",
      preflight: {
        ok: false,
        blockers: [
          registryLock.present === true
            ? "PROMOTION_REGISTRY_LOCKED"
            : "EXECUTOR_REGISTRY_LOCK_UNVERIFIED",
        ],
      },
    };
  }
  if (plan.terminal) return { ...base, outcome: "TERMINAL" };
  if (plan.requiresHumanApproval) {
    return {
      ...base,
      outcome: "HUMAN_APPROVAL_REQUIRED",
      humanApproval: {
        required: true,
        command: buildHumanApprovalCommand({ repository, record, at: now }),
      },
    };
  }
  if (plan.requiresDbEvidence && values["db-evidence"] === undefined) {
    return { ...base, outcome: "DB_EVIDENCE_REQUIRED" };
  }

  const migrationEvidence = plan.requiresDbEvidence
    ? loadMigrationEvidenceFile({
        evidencePath: values["db-evidence"],
        allowedRoot: migrationEvidenceRoot(options),
      })
    : null;
  const context = buildStepContext({ repository, options, migrationEvidence, warnings });

  context.git.fetchRemote({ remote: KEDUALL.remote });
  const observed = collectExecutorObservations({ repository, gitCommonDir, runId });
  const remoteStgSha = context.git.remoteBranchSha({
    remote: KEDUALL.remote,
    branch: KEDUALL.stgBranch,
  });
  if (remoteStgSha !== null) {
    observed.stgSha = remoteStgSha;
    observed.stgParents = adapterCommitParents(context.git, remoteStgSha);
  }
  observed.verifiedAccounts = await verifiedAccountsFor(
    context,
    plan.accountProfile?.accounts ?? [],
  );
  const preflight = evaluatePreflight({ record, observed });
  if (!preflight.ok) return { ...base, outcome: "PREFLIGHT_BLOCKED", observed, preflight };
  if (dryRun) {
    return {
      ...base,
      outcome: "DRY_RUN",
      observed,
      preflight,
      intent: describeStepIntent({ step: plan.step, record }),
    };
  }

  const handlerFactory = STEP_HANDLERS.get(plan.step);
  if (handlerFactory === undefined) throw executorError("EXECUTOR_STEP_UNKNOWN");
  const scratch = await runStepOperations({
    step: plan.step,
    context,
    handlers: handlerFactory(record, context),
  });
  const event = assertExecutorSubmittableEvent(
    assembleStepEvent({ step: plan.step, record, scratch, at: now }),
  );
  const advanced = advancePromotionRun(record, {
    expectedRevision: record.revision,
    expectedFingerprint: record.fingerprint,
    policy,
    event,
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
  try {
    context.writeEvidence({
      gitCommonDir,
      runId,
      event,
      sequence: advanced.record.journal.length,
      now,
    });
  } catch {
    warnings.push("PROMOTION_EVIDENCE_RECORDING_WARNING");
  }

  return {
    ...base,
    outcome: "ADVANCED",
    observed,
    preflight,
    result: {
      state: advanced.record.state,
      revision: advanced.record.revision,
      fingerprint: advanced.record.fingerprint,
      blocker: advanced.record.blocker,
      approvalMode: advanced.policy.mode,
      approvalFingerprint: advanced.record.approval.approvalFingerprint,
    },
    warnings,
  };
}

export async function runSequence(values, options = {}) {
  const iterations = [];
  let stoppedBecause = "ITERATION_LIMIT_REACHED";
  for (let attempt = 1; attempt <= EXECUTOR_MAX_RUN_ITERATIONS; attempt += 1) {
    let step;
    try {
      step = await runNext(values, options);
    } catch (error) {
      iterations.push({
        recordType: "PromotionExecutorStepErrorV1",
        outcome: "ADAPTER_ERROR",
        attempt,
        error: safeExecutorCode(error),
      });
      stoppedBecause = "ADAPTER_ERROR";
      break;
    }
    iterations.push(step);
    if (step.outcome !== "ADVANCED") {
      stoppedBecause = step.outcome;
      break;
    }
    if (DB_RETRY_STATES.has(step.result.state)) {
      stoppedBecause = "DB_GATE_BLOCKED";
      break;
    }
  }
  return {
    schemaVersion: 1,
    recordType: "PromotionExecutorRunV1",
    runId: values["run-id"],
    iterationLimit: EXECUTOR_MAX_RUN_ITERATIONS,
    iterationCount: iterations.length,
    stoppedBecause,
    iterations,
  };
}

export async function runExecutorCli(argv, options = {}) {
  const { command, values } = parseExecutorArguments(argv);
  if (command === "status") return runStatus(values, options);
  if (command === "probe-vercel") return runProbeVercel(values, options);
  if (command === "next") return runNext(values, options);
  return runSequence(values, options);
}

export async function main(argv = process.argv.slice(2)) {
  try {
    const result = await runExecutorCli(argv);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ error: safeExecutorCode(error) })}\n`);
    return 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = await main();
}
