import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_BUFFER_BYTES = 1024 * 1024;
const SHA_PATTERN = /^[a-f0-9]{40}$/iu;
const CANDIDATE_BRANCH_PATTERN = /^chore\/promote-\d{8}-[0-9a-f]{8}$/u;
const REMOTE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const BRANCH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/u;
const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,255}$/u;
const OWNER_REPO_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/u;
const FORCE_ARGUMENT_PATTERN =
  /^(?:-f|--force|--force-with-lease(?:=.*)?|--force-if-includes|\+.+)$/u;
const MERGE_METHOD_ARGUMENT_PATTERN = /^(?:--squash|--rebase|--hard|--admin)$/u;

export const FAST_FORWARD_ALLOWED_BRANCHES = Object.freeze(["stg"]);

export const PROTECTED_BRANCH_NAMES = Object.freeze([
  "stg",
  "main",
  "master",
  "develop",
  "production",
  "staging",
]);

export class ReleaseGitError extends Error {
  constructor(code) {
    super(code);
    this.name = "ReleaseGitError";
    this.code = code;
  }
}

function fail(code) {
  throw new ReleaseGitError(code);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
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

function commandOptions(cwd, timeoutMs) {
  return {
    ...(cwd === undefined ? {} : { cwd }),
    encoding: "utf8",
    env: sanitizedEnvironment(),
    maxBuffer: MAX_BUFFER_BYTES,
    shell: false,
    timeout: timeoutMs,
    windowsHide: true,
  };
}

export function executeReleaseGitCommand(command, args, options) {
  return spawnSync(command, args, options);
}

export function assertSafeCommandArguments(args) {
  if (!Array.isArray(args) || args.length === 0) fail("EXECUTOR_ARGUMENT_INVALID");
  for (const arg of args) {
    if (typeof arg !== "string" || arg.length === 0) fail("EXECUTOR_ARGUMENT_INVALID");
    if (FORCE_ARGUMENT_PATTERN.test(arg)) fail("EXECUTOR_FORCE_ARGUMENT_FORBIDDEN");
    if (MERGE_METHOD_ARGUMENT_PATTERN.test(arg)) fail("EXECUTOR_MERGE_METHOD_FORBIDDEN");
  }
  return args;
}

export function assertSafeGitHubArguments(args) {
  assertSafeCommandArguments(args);
  if (args[0] === "auth") fail("EXECUTOR_GH_AUTH_COMMAND_FORBIDDEN");
  return args;
}

function runCommand(commandRunner, command, args, cwd, timeoutMs) {
  if (command === "gh") assertSafeGitHubArguments(args);
  else assertSafeCommandArguments(args);
  let result;
  try {
    result = commandRunner(command, args, commandOptions(cwd, timeoutMs));
  } catch {
    return { ok: false, status: null, stdout: "" };
  }
  const status = typeof result?.status === "number" ? result.status : null;
  const failed = status !== 0 || Boolean(result?.error) || Boolean(result?.signal);
  return { ok: !failed, status, stdout: String(result?.stdout ?? "") };
}

function singleLine(stdout) {
  const output = stdout.trim();
  if (output === "" || output.includes("\0") || /[\r\n]/u.test(output)) return null;
  return output;
}

function firstLineTokens(stdout) {
  const [line] = stdout.split(/\r?\n/u);
  const trimmed = String(line ?? "").trim();
  if (trimmed === "" || trimmed.includes("\0")) return [];
  return trimmed.split(/\s+/u);
}

function assertSha(value, code = "EXECUTOR_SHA_INVALID") {
  if (typeof value !== "string" || !SHA_PATTERN.test(value)) fail(code);
  return value.toLowerCase();
}

function assertRemote(remote) {
  if (typeof remote !== "string" || !REMOTE_PATTERN.test(remote)) fail("EXECUTOR_REMOTE_INVALID");
  return remote;
}

function assertBranch(branch) {
  if (
    typeof branch !== "string" ||
    !BRANCH_PATTERN.test(branch) ||
    branch.includes("..") ||
    branch.endsWith(".lock")
  ) {
    fail("EXECUTOR_BRANCH_INVALID");
  }
  return branch;
}

function assertRef(ref) {
  if (typeof ref !== "string" || !REF_PATTERN.test(ref) || ref.includes("..")) {
    fail("EXECUTOR_REF_INVALID");
  }
  return ref;
}

function assertCandidateBranch(branch) {
  if (typeof branch !== "string" || !CANDIDATE_BRANCH_PATTERN.test(branch)) {
    fail("EXECUTOR_CANDIDATE_BRANCH_INVALID");
  }
  return branch;
}

function assertOwnerRepo(ownerRepo) {
  if (typeof ownerRepo !== "string" || !OWNER_REPO_PATTERN.test(ownerRepo)) {
    fail("EXECUTOR_REPOSITORY_INVALID");
  }
  return ownerRepo;
}

function assertPullRequestNumber(number) {
  if (!Number.isSafeInteger(number) || number <= 0) fail("EXECUTOR_PR_NUMBER_INVALID");
  return number;
}

function assertText(value, code) {
  if (typeof value !== "string" || value.trim() === "") fail(code);
  return value;
}

function assertShaList(parents) {
  if (!Array.isArray(parents)) fail("EXECUTOR_LINEAGE_MISMATCH");
  return parents.map((entry) => assertSha(entry, "EXECUTOR_LINEAGE_MISMATCH"));
}

export function createGitAdapter({
  repoPath,
  commandRunner = executeReleaseGitCommand,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  if (typeof repoPath !== "string" || !path.isAbsolute(repoPath) || !existsSync(repoPath)) {
    fail("EXECUTOR_REPOSITORY_INVALID");
  }
  if (typeof commandRunner !== "function") fail("EXECUTOR_COMMAND_RUNNER_REQUIRED");
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) fail("EXECUTOR_TIMEOUT_INVALID");

  const git = (cwd, args) => runCommand(commandRunner, "git", args, cwd, timeoutMs);

  const resolveCommit = (ref) => {
    const safeRef = assertRef(ref);
    const result = git(repoPath, ["rev-parse", "--verify", `${safeRef}^{commit}`]);
    if (!result.ok) fail("EXECUTOR_REF_LOOKUP_FAILED");
    const output = singleLine(result.stdout);
    if (output === null || !SHA_PATTERN.test(output)) fail("EXECUTOR_REF_LOOKUP_FAILED");
    return output.toLowerCase();
  };

  const commitParents = (sha) => {
    const safeSha = assertSha(sha);
    const result = git(repoPath, ["rev-list", "--parents", "-n", "1", safeSha]);
    if (!result.ok) fail("EXECUTOR_REF_LOOKUP_FAILED");
    const tokens = firstLineTokens(result.stdout);
    if (tokens.length === 0 || tokens[0].toLowerCase() !== safeSha) {
      fail("EXECUTOR_REF_LOOKUP_FAILED");
    }
    const parents = tokens.slice(1);
    if (parents.some((entry) => !SHA_PATTERN.test(entry))) fail("EXECUTOR_REF_LOOKUP_FAILED");
    return parents.map((entry) => entry.toLowerCase());
  };

  const remoteBranchSha = (remote, branch) => {
    const result = git(repoPath, ["ls-remote", remote, `refs/heads/${branch}`]);
    if (!result.ok) return null;
    const tokens = firstLineTokens(result.stdout);
    if (tokens.length < 2 || !SHA_PATTERN.test(tokens[0])) return null;
    if (tokens[1] !== `refs/heads/${branch}`) return null;
    return tokens[0].toLowerCase();
  };

  const removeCandidateWorktree = (worktreePath) =>
    git(repoPath, ["worktree", "remove", worktreePath]).ok;

  const isAncestor = (fromSha, toSha) => {
    const result = git(repoPath, ["merge-base", "--is-ancestor", fromSha, toSha]);
    if (result.ok) return true;
    if (result.status === 1) return false;
    return fail("EXECUTOR_ANCESTRY_LOOKUP_FAILED");
  };

  return Object.freeze({
    repoPath,

    fetchRemote({ remote }) {
      assertRemote(remote);
      if (!git(repoPath, ["fetch", "--no-tags", remote]).ok) fail("EXECUTOR_FETCH_FAILED");
      return { ok: true };
    },

    resolveCommit,

    commitParents,

    remoteBranchSha({ remote, branch }) {
      assertRemote(remote);
      assertBranch(branch);
      return remoteBranchSha(remote, branch);
    },

    createCandidateMerge({ candidateBranch, baseSha, sourceSha, worktreeRoot }) {
      assertCandidateBranch(candidateBranch);
      const base = assertSha(baseSha);
      const source = assertSha(sourceSha);
      if (typeof worktreeRoot !== "string" || !path.isAbsolute(worktreeRoot)) {
        fail("EXECUTOR_WORKTREE_ROOT_INVALID");
      }
      mkdirSync(worktreeRoot, { recursive: true });
      const worktreePath = path.join(worktreeRoot, `candidate-${randomUUID()}`);
      if (existsSync(worktreePath)) fail("EXECUTOR_CANDIDATE_WORKTREE_FAILED");
      if (!git(repoPath, ["worktree", "add", "--detach", worktreePath, base]).ok) {
        fail("EXECUTOR_CANDIDATE_WORKTREE_FAILED");
      }

      let observed = null;
      let pending = null;
      try {
        if (!git(worktreePath, ["switch", "-c", candidateBranch]).ok) {
          fail("EXECUTOR_CANDIDATE_BRANCH_CREATE_FAILED");
        }
        if (!git(worktreePath, ["merge", "--no-ff", "--no-edit", source]).ok) {
          const unmerged = git(worktreePath, ["ls-files", "--unmerged"]);
          const conflicted = unmerged.ok && unmerged.stdout.trim() !== "";
          git(worktreePath, ["merge", "--abort"]);
          fail(
            conflicted
              ? "EXECUTOR_CANDIDATE_MERGE_CONFLICT"
              : "EXECUTOR_CANDIDATE_MERGE_FAILED",
          );
        }
        const head = git(worktreePath, ["rev-parse", "--verify", "HEAD^{commit}"]);
        const candidateSha = head.ok ? singleLine(head.stdout) : null;
        if (candidateSha === null || !SHA_PATTERN.test(candidateSha)) {
          fail("EXECUTOR_CANDIDATE_SHA_UNVERIFIED");
        }
        observed = {
          candidateSha: candidateSha.toLowerCase(),
          actualParents: commitParents(candidateSha.toLowerCase()),
        };
      } catch (error) {
        pending = error;
      }
      const cleanupFailed = !removeCandidateWorktree(worktreePath);
      if (pending !== null) {
        pending.cleanupFailed = cleanupFailed;
        throw pending;
      }
      return { ...observed, cleanupFailed };
    },

    pushBranch({ remote, branch, expectedSha }) {
      assertRemote(remote);
      assertBranch(branch);
      const expected = assertSha(expectedSha);
      if (!git(repoPath, ["push", remote, `refs/heads/${branch}:refs/heads/${branch}`]).ok) {
        fail("EXECUTOR_PUSH_FAILED");
      }
      const observedSha = remoteBranchSha(remote, branch);
      if (observedSha !== expected) fail("EXECUTOR_PUSH_VERIFY_FAILED");
      return { ok: true, remoteSha: observedSha };
    },

    isFastForward({ fromSha, toSha }) {
      return isAncestor(assertSha(fromSha), assertSha(toSha));
    },

    fastForwardRemoteBranch({ remote, branch, expectedSha }) {
      assertRemote(remote);
      if (typeof branch !== "string" || !FAST_FORWARD_ALLOWED_BRANCHES.includes(branch)) {
        fail("EXECUTOR_FAST_FORWARD_BRANCH_FORBIDDEN");
      }
      const expected = assertSha(expectedSha);
      const current = remoteBranchSha(remote, branch);
      if (current === null) fail("EXECUTOR_REF_LOOKUP_FAILED");
      if (current === expected) return { ok: true, alreadySynced: true, remoteSha: current };
      if (!isAncestor(current, expected)) fail("EXECUTOR_FAST_FORWARD_NOT_POSSIBLE");
      if (!git(repoPath, ["push", remote, `${expected}:refs/heads/${branch}`]).ok) {
        fail("EXECUTOR_PUSH_FAILED");
      }
      const observedSha = remoteBranchSha(remote, branch);
      if (observedSha !== expected) fail("EXECUTOR_PUSH_VERIFY_FAILED");
      return { ok: true, alreadySynced: false, remoteSha: observedSha };
    },

    deleteRemoteBranch({ remote, branch }) {
      assertRemote(remote);
      if (
        typeof branch !== "string" ||
        PROTECTED_BRANCH_NAMES.includes(branch) ||
        !CANDIDATE_BRANCH_PATTERN.test(branch)
      ) {
        fail("EXECUTOR_PROTECTED_BRANCH");
      }
      if (!git(repoPath, ["push", remote, "--delete", `refs/heads/${branch}`]).ok) {
        fail("EXECUTOR_BRANCH_DELETE_FAILED");
      }
      if (remoteBranchSha(remote, branch) !== null) fail("EXECUTOR_BRANCH_DELETE_FAILED");
      return { ok: true };
    },
  });
}

export function createGitHubAdapter({
  commandRunner = executeReleaseGitCommand,
  cwd = undefined,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  if (typeof commandRunner !== "function") fail("EXECUTOR_COMMAND_RUNNER_REQUIRED");
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) fail("EXECUTOR_TIMEOUT_INVALID");

  const gh = (args) => runCommand(commandRunner, "gh", args, cwd, timeoutMs);

  const parseJson = (stdout, code) => {
    try {
      return JSON.parse(stdout);
    } catch {
      return fail(code);
    }
  };

  const pullRequestSha = (value, code) => {
    if (typeof value !== "string" || !SHA_PATTERN.test(value)) fail(code);
    return value.toLowerCase();
  };

  const findPullRequest = ({ ownerRepo, base, head }) => {
    assertOwnerRepo(ownerRepo);
    assertBranch(base);
    assertBranch(head);
    const result = gh([
      "pr",
      "list",
      "--repo",
      ownerRepo,
      "--base",
      base,
      "--head",
      head,
      "--state",
      "open",
      "--limit",
      "10",
      "--json",
      "number,headRefOid,state",
    ]);
    if (!result.ok) fail("EXECUTOR_PR_LOOKUP_FAILED");
    const parsed = parseJson(result.stdout, "EXECUTOR_PR_LOOKUP_FAILED");
    if (!Array.isArray(parsed)) fail("EXECUTOR_PR_LOOKUP_FAILED");
    if (parsed.length === 0) return null;
    const [entry] = parsed;
    if (!isPlainObject(entry)) fail("EXECUTOR_PR_LOOKUP_FAILED");
    return {
      number: assertPullRequestNumber(entry.number),
      headSha: pullRequestSha(entry.headRefOid, "EXECUTOR_PR_LOOKUP_FAILED"),
      state: assertText(entry.state, "EXECUTOR_PR_LOOKUP_FAILED"),
    };
  };

  const getPullRequest = ({ ownerRepo, number }) => {
    assertOwnerRepo(ownerRepo);
    assertPullRequestNumber(number);
    const result = gh([
      "pr",
      "view",
      String(number),
      "--repo",
      ownerRepo,
      "--json",
      "state,headRefOid,baseRefName,headRefName,mergeCommit",
    ]);
    if (!result.ok) fail("EXECUTOR_PR_LOOKUP_FAILED");
    const parsed = parseJson(result.stdout, "EXECUTOR_PR_LOOKUP_FAILED");
    if (!isPlainObject(parsed)) fail("EXECUTOR_PR_LOOKUP_FAILED");
    const mergeCommit = isPlainObject(parsed.mergeCommit) ? parsed.mergeCommit.oid : null;
    return {
      state: assertText(parsed.state, "EXECUTOR_PR_LOOKUP_FAILED"),
      headSha: pullRequestSha(parsed.headRefOid, "EXECUTOR_PR_LOOKUP_FAILED"),
      baseRefName: assertText(parsed.baseRefName, "EXECUTOR_PR_LOOKUP_FAILED"),
      headRefName: assertText(parsed.headRefName, "EXECUTOR_PR_LOOKUP_FAILED"),
      mergeCommitSha:
        typeof mergeCommit === "string" && SHA_PATTERN.test(mergeCommit)
          ? mergeCommit.toLowerCase()
          : null,
    };
  };

  return Object.freeze({
    findPullRequest,

    createPullRequest({ ownerRepo, base, head, title, body }) {
      assertOwnerRepo(ownerRepo);
      assertBranch(base);
      assertBranch(head);
      assertText(title, "EXECUTOR_PR_TITLE_REQUIRED");
      assertText(body, "EXECUTOR_PR_BODY_REQUIRED");
      if (/[\r\n]/u.test(title)) fail("EXECUTOR_PR_TITLE_REQUIRED");
      const existing = findPullRequest({ ownerRepo, base, head });
      if (existing !== null) return { number: existing.number, headSha: existing.headSha };
      const created = gh([
        "pr",
        "create",
        "--repo",
        ownerRepo,
        "--base",
        base,
        "--head",
        head,
        "--title",
        title,
        "--body",
        body,
      ]);
      if (!created.ok) fail("EXECUTOR_PR_CREATE_FAILED");
      const opened = findPullRequest({ ownerRepo, base, head });
      if (opened === null) fail("EXECUTOR_PR_CREATE_FAILED");
      return { number: opened.number, headSha: opened.headSha };
    },

    getPullRequest,

    mergePullRequest({ ownerRepo, number, expectedHeadSha }) {
      assertOwnerRepo(ownerRepo);
      assertPullRequestNumber(number);
      const expected = assertSha(expectedHeadSha);
      const merged = gh([
        "pr",
        "merge",
        String(number),
        "--repo",
        ownerRepo,
        "--merge",
        "--match-head-commit",
        expected,
      ]);
      if (!merged.ok) fail("EXECUTOR_PR_MERGE_FAILED");
      const verified = getPullRequest({ ownerRepo, number });
      if (
        verified.state !== "MERGED" ||
        verified.headSha !== expected ||
        verified.mergeCommitSha === null
      ) {
        fail("EXECUTOR_PR_MERGE_VERIFY_FAILED");
      }
      return { mergeCommitSha: verified.mergeCommitSha };
    },
  });
}

export function candidateMergeObservation({
  candidateBranch,
  candidateSha,
  baseSha,
  sourceSha,
  parents,
}) {
  return {
    candidateBranch: assertCandidateBranch(candidateBranch),
    candidateSha: assertSha(candidateSha),
    targetBranch: "stg",
    noFastForward: true,
    mergeMethod: "merge",
    directMainPush: false,
    baseSha: assertSha(baseSha),
    sourceSha: assertSha(sourceSha),
    parents: assertShaList(parents),
  };
}

export function stgPullRequestObservation({ headBranch, headSha }) {
  return {
    targetBranch: "stg",
    headBranch: assertCandidateBranch(headBranch),
    headSha: assertSha(headSha),
  };
}

export function stgReadyObservation({ stgSha, parents, preview }) {
  if (!isPlainObject(preview)) fail("EXECUTOR_PREVIEW_EVIDENCE_INVALID");
  return {
    stgSha: assertSha(stgSha),
    mergeMethod: "merge",
    directMainPush: false,
    parents: assertShaList(parents),
    preview,
  };
}

export function mainPullRequestObservation({ headSha }) {
  return {
    targetBranch: "main",
    headBranch: "stg",
    headSha: assertSha(headSha),
    mergeMethod: "merge",
    directMainPush: false,
  };
}

export function mainMergeObservation({ mainBaseSha, mainSha, headSha, parents }) {
  return {
    mainBaseSha: assertSha(mainBaseSha),
    mainSha: assertSha(mainSha),
    headSha: assertSha(headSha),
    targetBranch: "main",
    mergeMethod: "merge",
    directMainPush: false,
    parents: assertShaList(parents),
  };
}

export function cleanupObservation({ stgFastForwardedToMain }) {
  if (typeof stgFastForwardedToMain !== "boolean") fail("EXECUTOR_OBSERVATION_INVALID");
  return { stgFastForwardedToMain };
}

export function preflightObservation({
  stgSha,
  sourceRepositoryIdentity,
  targetRepositoryIdentity,
  registryLockPresent,
  verifiedAccounts,
}) {
  if (typeof registryLockPresent !== "boolean") fail("EXECUTOR_OBSERVATION_INVALID");
  if (!Array.isArray(verifiedAccounts)) fail("EXECUTOR_OBSERVATION_INVALID");
  return {
    stgSha: assertSha(stgSha),
    sourceRepositoryIdentity: assertOwnerRepo(sourceRepositoryIdentity),
    targetRepositoryIdentity: assertOwnerRepo(targetRepositoryIdentity),
    registryLockPresent,
    verifiedAccounts: verifiedAccounts.map((entry) =>
      assertText(entry, "EXECUTOR_OBSERVATION_INVALID"),
    ),
  };
}
