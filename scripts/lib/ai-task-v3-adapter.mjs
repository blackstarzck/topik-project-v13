import { execFile, spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  readdirSync,
} from "node:fs";
import path from "node:path";

import {
  PIPELINE_REPOSITORY_PROFILES,
  runTaskSweep,
  withRepositoryAuth,
} from "./ai-task-sweep.mjs";
import {
  readPromotionRun,
  validatePromotionRunV1,
} from "./ai-release-promotion.mjs";
import {
  V3_BLOCKER_PATTERN,
  autoCleanupTaskRecordV3,
  mergeDelegatedCleanupBlockers,
  readTaskRecordV3ByBranch,
  reconcileDelegatedCleanupV3,
  sweepTaskRecordsV3,
} from "./ai-task-lifecycle-v3.mjs";
import { autoCleanupTask } from "./ai-task-cleanup.mjs";

const SHA_PATTERN = /^[a-f0-9]{40}$/u;
const SAFE_BRANCH_PATTERN =
  /^(?:feat|fix|refactor|test|docs|chore|ci)\/[a-z0-9]+(?:-[a-z0-9]+)*$/u;
// PRESERVED is retryable, so sweep must keep discovering it. Otherwise the
// catch-up sweep silently skips exactly the tasks that still need cleanup.
const ELIGIBLE_STATES = new Set(["ACTIVE", "PR_OPEN", "MERGED", "PRESERVED"]);
const COMMAND_TIMEOUT_MS = 30_000;

const ADAPTER_PROFILES = Object.freeze({
  "blackstarzck/topik-project-v13": Object.freeze({
    auth: PIPELINE_REPOSITORY_PROFILES.origin,
    remoteCandidates: Object.freeze(["origin"]),
    source: "github-pr",
  }),
  "keduall/topik-project-v13": Object.freeze({
    auth: PIPELINE_REPOSITORY_PROFILES.collab,
    remoteCandidates: Object.freeze(["collab", "origin"]),
    source: "promotion",
  }),
});

function preserved(blocker) {
  return {
    schemaVersion: 3,
    recordType: "TaskAutoCleanupAdapterResultV3",
    result: "PRESERVED",
    blocker,
    blockers: [blocker],
  };
}

// V2 가 던진 예외에서 보고 가능한 코드만 뽑는다. 형식에 맞지 않으면 일반 코드로 대체한다.
function safeV2Blocker(error) {
  return V3_BLOCKER_PATTERN.test(error?.code ?? "") ? error.code : "V2_CLEANUP_THREW";
}

function sanitizedEnvironment(source = process.env) {
  const environment = {};
  for (const [key, value] of Object.entries(source)) {
    if (!/^GIT_/iu.test(key) && value !== undefined) environment[key] = value;
  }
  environment.GIT_TERMINAL_PROMPT = "0";
  environment.GH_PROMPT_DISABLED = "1";
  environment.GCM_INTERACTIVE = "Never";
  return environment;
}

function commandOptions(timeout = COMMAND_TIMEOUT_MS, signal = undefined) {
  return {
    shell: false,
    timeout,
    windowsHide: true,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    env: sanitizedEnvironment(),
    ...(signal ? { signal } : {}),
  };
}

function productionGitRunner(cwd, args, { signal, timeoutMs = COMMAND_TIMEOUT_MS } = {}) {
  if (signal?.aborted || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return { status: 1, stdout: "", stderr: "" };
  }
  const result = spawnSync(
    "git",
    ["-C", cwd, ...args],
    commandOptions(Math.min(COMMAND_TIMEOUT_MS, timeoutMs), signal),
  );
  return {
    status: Number.isInteger(result.status) ? result.status : 1,
    stdout: String(result.stdout ?? "").trim(),
    stderr: "",
  };
}

function productionCommandRunner(file, args, options) {
  return new Promise((resolve) => {
    execFile(file, args, {
      ...options,
      env: sanitizedEnvironment(),
    }, (error, stdout) => {
      resolve({
        exitCode: Number.isInteger(error?.code) ? error.code : error ? 1 : 0,
        stdout: String(stdout ?? ""),
        stderr: "",
      });
    });
  });
}

function statusOf(result) {
  if (Number.isInteger(result?.status)) return result.status;
  if (Number.isInteger(result?.exitCode)) return result.exitCode;
  return 1;
}

function stdoutOf(result) {
  return String(result?.stdout ?? "").trim();
}

function runGit(gitRunner, cwd, args) {
  try {
    const result = gitRunner(cwd, args);
    return {
      status: statusOf(result),
      stdout: stdoutOf(result),
    };
  } catch {
    return { status: 1, stdout: "" };
  }
}

function repositoryIdentity(remoteUrl) {
  if (typeof remoteUrl !== "string" || remoteUrl.length > 4096) return null;
  let value = remoteUrl.trim().replace(/\.git$/iu, "");
  const scp = /^git@github\.com:([^/]+)\/([^/]+)$/iu.exec(value);
  if (scp) return `${scp[1]}/${scp[2]}`.toLowerCase();
  try {
    const parsed = new URL(value);
    if (parsed.hostname.toLowerCase() !== "github.com") return null;
    const parts = parsed.pathname.replace(/^\/+/u, "").split("/").filter(Boolean);
    return parts.length === 2 ? `${parts[0]}/${parts[1]}`.toLowerCase() : null;
  } catch {
    return null;
  }
}

export const ADAPTER_PROFILE_IDENTITIES = Object.freeze(Object.keys(ADAPTER_PROFILES));

export function adapterIdentity(recordIdentity) {
  if (typeof recordIdentity !== "string" || recordIdentity.length > 4096) return null;
  const parts = recordIdentity.trim().toLowerCase().split("/").filter(Boolean);
  if (parts.length !== 3 || parts[0] !== "github.com") return null;
  return `${parts[1]}/${parts[2]}`;
}

function exactProfile(record) {
  const identityValue = record?.repoProfile?.repositoryIdentity;
  const authLogin = record?.repoProfile?.authLogin;
  if (typeof identityValue !== "string" || typeof authLogin !== "string") return null;
  const identity = adapterIdentity(identityValue);
  if (identity === null) return null;
  const profile = ADAPTER_PROFILES[identity];
  if (!profile ||
      authLogin.toLowerCase() !== profile.auth.authLogin.toLowerCase()) {
    return null;
  }
  return profile;
}

function resolveRemote({ repoPath, record, profile, gitRunner }) {
  const candidates = [
    record.repoProfile.remote,
    ...profile.remoteCandidates,
  ].filter((candidate, index, values) =>
    typeof candidate === "string" && values.indexOf(candidate) === index);
  const expected = adapterIdentity(record.repoProfile.repositoryIdentity);
  if (expected === null) return null;
  for (const candidate of candidates) {
    const result = runGit(gitRunner, repoPath, ["remote", "get-url", candidate]);
    if (result.status === 0 && repositoryIdentity(result.stdout) === expected) {
      return candidate;
    }
  }
  return null;
}

function gitCommonDir(repoPath, gitRunner) {
  const result = runGit(gitRunner, repoPath, ["rev-parse", "--git-common-dir"]);
  if (result.status !== 0 || result.stdout.length === 0) return null;
  const absolute = path.isAbsolute(result.stdout)
    ? path.resolve(result.stdout)
    : path.resolve(repoPath, result.stdout);
  return absolute;
}

function parsePrList(result) {
  if (statusOf(result) !== 0) return null;
  try {
    const parsed = JSON.parse(stdoutOf(result));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function validMergedPr(entry, { headName, headSha, repository }) {
  return (
    entry &&
    Object.keys(entry).every((key) =>
      ["baseRefName", "headRefName", "headRefOid", "headRepository", "mergedAt", "mergeCommit"]
        .includes(key)) &&
    entry.baseRefName === "main" &&
    entry.headRefName === headName &&
    // --head 는 브랜치 이름만 좁히므로 fork 의 동명 브랜치도 목록에 들어온다. head 저장소가
    // 이 저장소여야 한다. head SHA 까지 같은 fork PR 이 삭제 근거가 되는 것을 막는다.
    entry.headRepository?.nameWithOwner === repository &&
    entry.headRefOid === headSha &&
    SHA_PATTERN.test(entry.mergeCommit?.oid ?? "") &&
    typeof entry.mergedAt === "string" &&
    Number.isFinite(Date.parse(entry.mergedAt))
  );
}

async function resolveMainPr({
  runCommand,
  repositoryProfile,
  headName,
  headSha,
  signal,
  timeoutMs,
}) {
  const repository = `${repositoryProfile.owner}/${repositoryProfile.repository}`;
  const result = await runCommand(
    "gh",
    [
      "pr",
      "list",
      "--repo",
      repository,
      "--state",
      "merged",
      "--base",
      "main",
      // gh 는 --head 에 "<owner>:<branch>" 형식을 지원하지 않고(`gh pr list --help`)
      // 그 형식을 넘기면 조용히 빈 목록을 반환한다. 소유자는 아래 validMergedPr 의
      // headRepository.nameWithOwner 검사로 좁힌다.
      "--head",
      headName,
      "--json",
      "baseRefName,headRefName,headRefOid,headRepository,mergedAt,mergeCommit",
      "--limit",
      "100",
    ],
    commandOptions(Math.min(COMMAND_TIMEOUT_MS, timeoutMs ?? COMMAND_TIMEOUT_MS), signal),
  );
  const entries = parsePrList(result);
  if (entries === null) return { blocker: "MERGED_MAIN_PR_QUERY_FAILED" };
  const exact = entries.filter((entry) =>
    validMergedPr(entry, { headName, headSha, repository }));
  if (exact.length !== 1) return { blocker: "MERGED_MAIN_PR_NOT_FOUND" };
  return { pr: exact[0] };
}

function exactRemoteBranch({ repoPath, remote, branch, gitRunner }) {
  const result = runGit(gitRunner, repoPath, [
    "ls-remote",
    "--heads",
    remote,
    `refs/heads/${branch}`,
  ]);
  if (result.status !== 0) return { blocker: "REMOTE_BRANCH_QUERY_FAILED" };
  if (result.stdout === "") return { evidence: { exists: false, sha: null } };
  const lines = result.stdout.split(/\r?\n/u).filter(Boolean);
  const match = /^([a-f0-9]{40})\trefs\/heads\/(.+)$/u.exec(lines[0] ?? "");
  if (lines.length !== 1 || !match || match[2] !== branch) {
    return { blocker: "REMOTE_BRANCH_EVIDENCE_INVALID" };
  }
  return { evidence: { exists: true, sha: match[1] } };
}

function readPromotionEvidenceDefault({ commonDir, record, mainSha }) {
  const root = path.join(commonDir, "ai-pipeline", "promotions", "v1", "runs");
  if (!existsSync(root) ||
      lstatSync(root).isSymbolicLink() ||
      !lstatSync(root).isDirectory()) {
    return null;
  }
  const matches = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith(".json")) continue;
    const runId = entry.name.slice(0, -5);
    let promotion;
    try {
      promotion = readPromotionRun({ gitCommonDir: commonDir, runId });
    } catch {
      continue;
    }
    if (validatePromotionRunV1(promotion).length > 0) continue;
    const exactTask =
      promotion.target?.candidateSha === record.headSha ||
      promotion.target?.stgSha === record.headSha;
    const released = new Set(["RELEASED", "CLEANED"]).has(promotion.state);
    if (
      exactTask &&
      released &&
      promotion.target.repositoryIdentity.toLowerCase() ===
        adapterIdentity(record.repoProfile.repositoryIdentity) &&
      promotion.target.mainSha === mainSha &&
      promotion.vercel.commitSha === mainSha &&
      promotion.vercel.smokeStatus === "PASSED" &&
      new Set(["RELEASED", "CLEANED"]).has(promotion.workspace.cleanupStatus)
    ) {
      matches.push({
        candidateSha: promotion.target.candidateSha,
        stgSha: promotion.target.stgSha,
        mainSha,
        mergedAt: promotion.updatedAt,
        productionReady: true,
      });
    }
  }
  return matches.length === 1 ? matches[0] : null;
}

function coreGitRunner(gitRunner, remote) {
  return (cwd, args) => {
    const mapped = args.map((argument) =>
      argument === "origin/main^{commit}" ? `${remote}/main^{commit}` : argument);
    return gitRunner(cwd, mapped);
  };
}

function remoteMutationCallbacks({ repoPath, remote, record, gitRunner }) {
  return {
    deleteRemoteBranch(request) {
      if (request.branch !== record.branch.name ||
          request.expectedSha !== record.headSha ||
          !SHA_PATTERN.test(request.expectedSha ?? "")) {
        return { deleted: false };
      }
      const result = runGit(gitRunner, repoPath, [
        "push",
        `--force-with-lease=refs/heads/${request.branch}:${request.expectedSha}`,
        remote,
        `:refs/heads/${request.branch}`,
      ]);
      return { deleted: result.status === 0 };
    },
    verifyRemoteBranchAbsent(request) {
      if (request.branch !== record.branch.name) return false;
      const remoteBranch = exactRemoteBranch({
        repoPath,
        remote,
        branch: request.branch,
        gitRunner,
      });
      return remoteBranch.evidence?.exists === false;
    },
  };
}

async function resolveAndCleanup({
  repoPath,
  record,
  profile,
  remote,
  now,
  trigger,
  runCommand,
  gitRunner,
  cleanupRecord,
  findPromotionEvidence,
  v2AutoCleanup,
  reconcileIsolated,
  signal,
  timeoutMs,
}) {
  const fetch = runGit(gitRunner, repoPath, [
    "fetch",
    "--prune",
    remote,
    `+refs/heads/main:refs/remotes/${remote}/main`,
  ]);
  if (fetch.status !== 0) return preserved("MAIN_FETCH_FAILED");
  const main = runGit(gitRunner, repoPath, [
    "rev-parse",
    "--verify",
    `${remote}/main^{commit}`,
  ]);
  if (main.status !== 0 || !SHA_PATTERN.test(main.stdout)) {
    return preserved("MAIN_SHA_UNAVAILABLE");
  }
  const mainSha = main.stdout;
  const commonDir = gitCommonDir(repoPath, gitRunner);
  if (commonDir === null) return preserved("GIT_COMMON_DIR_UNAVAILABLE");

  let promotion = null;
  let prHeadName = record.branch.name;
  let prHeadSha = record.headSha;
  if (profile.source === "promotion") {
    promotion = findPromotionEvidence({
      commonDir,
      record,
      mainSha,
    });
    if (
      promotion === null ||
      promotion.productionReady !== true ||
      promotion.mainSha !== mainSha ||
      promotion.candidateSha !== record.headSha ||
      !SHA_PATTERN.test(promotion.stgSha ?? "")
    ) {
      return preserved("PROMOTION_EVIDENCE_UNAVAILABLE");
    }
    prHeadName = "stg";
    prHeadSha = promotion.stgSha;
  }
  const mergedPr = await resolveMainPr({
    runCommand,
    repositoryProfile: profile.auth,
    headName: prHeadName,
    headSha: prHeadSha,
    signal,
    timeoutMs,
  });
  if (mergedPr.blocker) return preserved(mergedPr.blocker);
  const mergeCommit = mergedPr.pr.mergeCommit.oid;
  if (runGit(gitRunner, repoPath, [
    "merge-base",
    "--is-ancestor",
    mergeCommit,
    mainSha,
  ]).status !== 0 ||
      runGit(gitRunner, repoPath, [
        "merge-base",
        "--is-ancestor",
        record.headSha,
        mainSha,
      ]).status !== 0) {
    return preserved("MERGE_ANCESTRY_MISMATCH");
  }
  const remoteBranch = exactRemoteBranch({
    repoPath,
    remote,
    branch: record.branch.name,
    gitRunner,
  });
  if (remoteBranch.blocker) return preserved(remoteBranch.blocker);
  const mergeEvidence = {
    schemaVersion: 1,
    recordType: "TaskMergeEvidenceV3",
    source: profile.source,
    repositoryIdentity: record.repoProfile.repositoryIdentity,
    authLogin: record.repoProfile.authLogin,
    targetBranch: "main",
    headSha: record.headSha,
    mainSha,
    mergedAt: new Date(mergedPr.pr.mergedAt).toISOString(),
    remoteBranch: remoteBranch.evidence,
    production: profile.source === "promotion"
      ? { ready: true, commitSha: mainSha }
      : null,
  };

  if (record.workspace.kind === "isolated" &&
      record.workspace.ownership === "managed") {
    let v2Result;
    try {
      v2Result = await v2AutoCleanup({
        repoPath,
        branch: record.branch.name,
        trigger,
        now,
      });
    } catch (error) {
      // 예외를 삼키면 정리 실패 원인이 사라진다. 안전한 코드로 바꿔 blocker 병합 경로에
      // 넘겨 보고에 남긴다.
      v2Result = { result: "V2_THREW", blockers: [safeV2Blocker(error)] };
    }
    const v3Task = reconcileIsolated({
      repoPath,
      branch: record.branch.name,
      v2Result,
      now,
    });
    const cleaned = v3Task.state === "CLEANED";
    // Report the reasons this run produced. An earlier revision also merged the
    // record's stored blockers, because PRESERVED was terminal and the reconcile
    // short-circuited without refreshing them. PRESERVED is retryable now and the
    // reconcile rewrites the record every run, so merging stored values only echoes
    // reasons that no longer hold. The single blocker string stays for callers.
    const blockers = cleaned ? [] : mergeDelegatedCleanupBlockers(v2Result);
    return {
      schemaVersion: 3,
      recordType: "TaskAutoCleanupAdapterResultV3",
      result: cleaned ? "CLEANED" : "PRESERVED",
      blocker: cleaned ? null : blockers[0],
      blockers,
      v3Task,
    };
  }
  const callbacks = remoteMutationCallbacks({
    repoPath,
    remote,
    record,
    gitRunner,
  });
  return cleanupRecord({
    repoPath,
    taskId: record.taskId,
    mergeEvidence,
    now,
    trigger,
    gitRunner: coreGitRunner(gitRunner, remote),
    ...callbacks,
  });
}

export async function autoCleanupTaskV3Adapter({
  repoPath,
  branch,
  now = new Date().toISOString(),
  trigger = "DIRECT",
  readRecord = readTaskRecordV3ByBranch,
  runCommand = productionCommandRunner,
  gitRunner = productionGitRunner,
  withAuth = withRepositoryAuth,
  cleanupRecord = autoCleanupTaskRecordV3,
  findPromotionEvidence = readPromotionEvidenceDefault,
  v2AutoCleanup = autoCleanupTask,
  reconcileIsolated = reconcileDelegatedCleanupV3,
  localAppData = process.env.LOCALAPPDATA,
  env = process.env,
  signal = undefined,
  timeoutMs = undefined,
} = {}) {
  const startedAt = Date.now();
  const remainingMs = () => Number.isFinite(timeoutMs)
    ? Math.max(0, timeoutMs - (Date.now() - startedAt))
    : undefined;
  const boundedGitRunner = (cwd, args) => {
    const remaining = remainingMs();
    if (signal?.aborted || remaining === 0) return { status: 1, stdout: "", stderr: "" };
    return gitRunner(cwd, args, {
      signal,
      timeoutMs: remaining ?? COMMAND_TIMEOUT_MS,
    });
  };
  let record;
  try {
    record = readRecord({ repoPath, branch });
  } catch {
    return preserved("V3_REGISTRY_UNAVAILABLE");
  }
  if (record === null) return { handled: false };
  if (!SAFE_BRANCH_PATTERN.test(record.branch?.name ?? "") ||
      record.branch.name !== branch) {
    return preserved("TASK_BRANCH_INVALID");
  }
  const profile = exactProfile(record);
  if (profile === null) return preserved("REPOSITORY_PROFILE_UNAPPROVED");
  const remote = resolveRemote({ repoPath, record, profile, gitRunner: boundedGitRunner });
  if (remote === null) return preserved("REMOTE_IDENTITY_MISMATCH");
  const commonDir = gitCommonDir(repoPath, boundedGitRunner);
  if (commonDir === null) return preserved("GIT_COMMON_DIR_UNAVAILABLE");
  const authTimeoutMs = remainingMs();
  const authenticated = await withAuth({
    profile: profile.auth,
    localAppData,
    env,
    runCommand,
    ...(signal ? { signal } : {}),
    ...(authTimeoutMs === undefined ? {} : { timeoutMs: authTimeoutMs }),
    operation: ({
      signal: operationSignal = signal,
      timeoutMs: operationTimeoutMs = remainingMs(),
    } = {}) => resolveAndCleanup({
      repoPath,
      record,
      profile,
      remote,
      now,
      trigger,
      runCommand,
      gitRunner: boundedGitRunner,
      cleanupRecord,
      findPromotionEvidence,
      v2AutoCleanup,
      reconcileIsolated,
      signal: operationSignal,
      timeoutMs: operationTimeoutMs,
    }),
  });
  if (authenticated?.result !== "AUTHENTICATED") {
    return preserved(authenticated?.blocker ?? "AUTH_UNAVAILABLE");
  }
  return authenticated.value;
}

function discoverTasksDefault({ repoPath }) {
  const report = sweepTaskRecordsV3({ repoPath });
  return report.candidates
    .filter((candidate) =>
      candidate.branch !== null &&
      ELIGIBLE_STATES.has(candidate.state))
    .map((candidate) => {
      const record = readTaskRecordV3ByBranch({
        repoPath,
        branch: candidate.branch,
      });
      return record === null ? null : {
        taskId: record.taskId,
        branch: record.branch.name,
        ownership: record.workspace.ownership,
      };
    })
    .filter(Boolean);
}

export async function runRepositorySweepV3({
  repoPath,
  now = new Date().toISOString(),
  localAppData = process.env.LOCALAPPDATA,
  env = process.env,
  discoverTasks = discoverTasksDefault,
  runCommand = productionCommandRunner,
  gitRunner = productionGitRunner,
  runSweep = runTaskSweep,
  cleanupTask = autoCleanupTaskV3Adapter,
} = {}) {
  const tasks = discoverTasks({ repoPath });
  if (tasks.length === 0) {
    return {
      schemaVersion: 3,
      recordType: "TaskSweepAdapterReportV3",
      result: "NO_ACTIVE_TASKS",
      examined: 0,
      attempted: 0,
      deferred: 0,
      results: [],
    };
  }
  const commonDir = gitCommonDir(repoPath, gitRunner);
  if (commonDir === null) return preserved("GIT_COMMON_DIR_UNAVAILABLE");
  const sweepTasks = tasks.map((task) => ({
    ...task,
    resourceOwnership: task.ownership,
    // The sweep's `managed` tag means the task is owned by this registry.
    // Resource ownership is re-read by the cleanup core before any mutation.
    ownership: "managed",
  }));
  const results = [];
  const sweep = await runSweep({
    lockPath: path.join(commonDir, "ai-pipeline", "locks", ".v3-cli-sweep.lock"),
    repositories: [{ repoPath }],
    listActiveManagedTasks: () => sweepTasks,
    withAuth: async ({ operation }) => operation(),
    processTask: async ({ task, signal, timeoutMs }) => {
      const result = await cleanupTask({
        repoPath,
        branch: task.branch,
        now,
        trigger: "SWEEP",
        localAppData,
        env,
        signal,
        timeoutMs,
        runCommand,
        gitRunner,
      });
      results.push({
        taskId: task.taskId,
        result: result.result,
        blocker: result.blocker ?? null,
      });
      return result;
    },
  });
  return {
    schemaVersion: 3,
    recordType: "TaskSweepAdapterReportV3",
    ...sweep,
    results,
  };
}

export const sweepTasksV3Adapter = runRepositorySweepV3;
