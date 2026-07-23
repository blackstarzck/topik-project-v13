import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  createTaskCleanupService,
  createAutoCleanupSweepService,
  enumerateAutoCleanupTasks,
  registerTaskRuntime,
  shouldDeferAutoCleanup,
  validateAutoCleanupReportV1,
  validateAutoCleanupSweepV1,
} from "../../scripts/lib/ai-task-cleanup.mjs";
import { startTask } from "../../scripts/lib/ai-task-lifecycle-v2.mjs";
import { runTaskLifecycleCommand, scheduleAutoCleanupSweep } from "../../scripts/ai-task.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SHA = "a".repeat(64);
const tempRoots = [];
let repositoryTemplate;
let mergeReadyTemplate;

function makeFixtureRoot(prefix, parent = tmpdir()) {
  return realpathSync.native(mkdtempSync(path.join(parent, prefix)));
}

function removeFixtureRoot(root) {
  if (existsSync(root)) rmSync(root, {
    recursive: true,
    force: true,
    maxRetries: 20,
    retryDelay: 50,
  });
}

beforeAll(() => {
  const root = makeFixtureRoot("talkpik-autocleanup-template-");
  const remote = path.join(root, "remote.git");
  const seed = path.join(root, "seed");
  const base = path.join(root, "base");
  execFileSync("git", ["init", "--bare", remote]);
  execFileSync("git", ["init", "-b", "main", seed]);
  git(seed, ["config", "user.email", "test@example.com"]);
  git(seed, ["config", "user.name", "Auto Cleanup Test"]);
  writeFileSync(path.join(seed, ".gitignore"), ".worktrees/\n.codex/\n");
  writeFileSync(path.join(seed, "README.md"), "baseline\n");
  git(seed, ["add", ".gitignore", "README.md"]);
  git(seed, ["commit", "-m", "baseline"]);
  git(seed, ["remote", "add", "origin", remote]);
  git(seed, ["push", "-u", "origin", "main"]);
  execFileSync("git", ["clone", "--branch", "main", remote, base]);
  git(base, ["config", "user.email", "test@example.com"]);
  git(base, ["config", "user.name", "Auto Cleanup Test"]);
  repositoryTemplate = { root, remote, seed, base };
  mergeReadyTemplate = buildMergeReady({
    keepRemoteBranch: true,
    repository: copyRepository(repositoryTemplate, false),
  });
}, 60_000);

afterAll(() => {
  if (mergeReadyTemplate?.root) removeFixtureRoot(mergeReadyTemplate.root);
  if (repositoryTemplate?.root) removeFixtureRoot(repositoryTemplate.root);
}, 60_000);

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    removeFixtureRoot(root);
  }
}, 60_000);

function git(cwd, args) {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
}

function fakeChild({ pid = 43210, stdout = "", stderr = "", status = 0, signal = null, close = true } = {}) {
  const child = new EventEmitter();
  child.pid = pid;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = vi.fn();
  if (close) {
    queueMicrotask(() => {
      child.stdout.end(stdout);
      child.stderr.end(stderr);
      child.emit("close", status, signal);
    });
  }
  return child;
}

async function waitUntil(predicate, { timeoutMs = 5_000, intervalMs = 20 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return predicate();
}

function pidActive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    if (error?.code === "EPERM") return true;
    throw error;
  }
}

function copyRepository(source, track = true) {
  const root = makeFixtureRoot("talkpik-autocleanup-");
  if (track) tempRoots.push(root);
  const remote = path.join(root, "remote.git");
  const seed = path.join(root, "seed");
  const base = path.join(root, "base");
  cpSync(source.remote, remote, { recursive: true });
  cpSync(source.seed, seed, { recursive: true });
  cpSync(source.base, base, { recursive: true });
  git(seed, ["remote", "set-url", "origin", remote]);
  git(base, ["remote", "set-url", "origin", remote]);
  return { root, remote, seed, base };
}

function makeRepository() {
  return copyRepository(repositoryTemplate);
}

function buildMergeReady({ keepRemoteBranch = false, repository = makeRepository() } = {}) {
  const started = startTask({
    repoPath: repository.base,
    branch: "fix/automatic-cleanup",
    actor: "codex",
    now: "2026-07-23T01:00:00.000Z",
  });
  writeFileSync(path.join(started.worktreePath, "change.txt"), "published\n");
  git(started.worktreePath, ["add", "change.txt"]);
  git(started.worktreePath, ["commit", "-m", "published change"]);
  const headSha = git(started.worktreePath, ["rev-parse", "HEAD"]);
  git(started.worktreePath, ["push", "-u", "origin", started.branch]);
  git(repository.seed, ["fetch", "origin", started.branch]);
  git(repository.seed, ["merge", "--no-ff", `origin/${started.branch}`, "-m", "merge task"]);
  const mergeCommitOid = git(repository.seed, ["rev-parse", "HEAD"]);
  git(repository.seed, ["push", "origin", "main"]);
  git(repository.base, ["fetch", "origin", "main"]);
  if (!keepRemoteBranch) git(repository.seed, ["push", "origin", "--delete", started.branch]);
  registerTaskRuntime({
    repoPath: started.worktreePath,
    branch: started.branch,
    ports: [],
    pids: [],
    lockPaths: [],
    now: "2026-07-23T01:01:00.000Z",
  });
  const evidence = {
    number: 60,
    state: "MERGED",
    baseRefName: "main",
    headRefName: started.branch,
    headRefOid: headSha,
    mergeCommitOid,
    mergedAt: "2026-07-23T00:59:00.000Z",
  };
  return { ...repository, started, evidence, headSha };
}

function replaceRoot(value, oldRoot, newRoot) {
  if (typeof value === "string") return value.replaceAll(oldRoot, newRoot);
  if (Array.isArray(value)) return value.map((entry) => replaceRoot(entry, oldRoot, newRoot));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, replaceRoot(entry, oldRoot, newRoot)]),
    );
  }
  return value;
}

function replaceRootText(value, oldRoot, newRoot) {
  return value
    .replaceAll(oldRoot, newRoot)
    .replaceAll(oldRoot.replaceAll("\\", "/"), newRoot.replaceAll("\\", "/"));
}

function rewriteCopiedMergeReadyPaths(repository, template) {
  const copied = replaceRoot(template, template.root, repository.root);
  const linkedGitDir = path.join(repository.base, ".git", "worktrees", copied.started.taskId);
  const worktreeGitFile = path.join(copied.started.worktreePath, ".git");
  const taskFile = path.join(
    copied.started.gitCommonDir,
    "talkpik-task-lifecycle",
    "v2",
    "tasks",
    `${copied.started.taskId}.json`,
  );
  writeFileSync(
    path.join(linkedGitDir, "gitdir"),
    replaceRootText(
      readFileSync(path.join(linkedGitDir, "gitdir"), "utf8"),
      template.root,
      repository.root,
    ),
  );
  const worktreeGitContent = replaceRootText(
    readFileSync(worktreeGitFile, "utf8"),
    template.root,
    repository.root,
  );
  unlinkSync(worktreeGitFile);
  writeFileSync(
    worktreeGitFile,
    worktreeGitContent,
  );
  const task = replaceRoot(JSON.parse(readFileSync(taskFile, "utf8")), template.root, repository.root);
  writeFileSync(taskFile, `${JSON.stringify(task, null, 2)}\n`);
  const runtimeFile = path.join(
    copied.started.gitCommonDir,
    "talkpik-task-lifecycle",
    "v2",
    "runtimes",
    `${copied.started.taskId}.json`,
  );
  const runtime = replaceRoot(
    JSON.parse(readFileSync(runtimeFile, "utf8")),
    template.root,
    repository.root,
  );
  writeFileSync(runtimeFile, `${JSON.stringify(runtime, null, 2)}\n`);
  return { ...repository, started: copied.started, evidence: copied.evidence, headSha: copied.headSha };
}

function mergeReady({ keepRemoteBranch = false } = {}) {
  const repository = copyRepository(mergeReadyTemplate);
  const copied = rewriteCopiedMergeReadyPaths(repository, mergeReadyTemplate);
  if (!keepRemoteBranch) {
    git(repository.remote, ["update-ref", "-d", `refs/heads/${copied.started.branch}`]);
  }
  return copied;
}

function report(overrides = {}) {
  return {
    schemaVersion: 1,
    recordType: "AutoCleanupReportV1",
    taskId: "fix-sample",
    branch: "fix/sample",
    trigger: "DIRECT",
    result: "PRESERVED",
    blockers: ["PR_NOT_MERGED"],
    startedAt: "2026-07-23T01:00:00.000Z",
    finishedAt: "2026-07-23T01:00:01.000Z",
    retryAt: "2026-07-23T01:15:01.000Z",
    cleanupFingerprint: SHA,
    stageTimings: {
      preflightMs: 100,
      authMs: 0,
      remoteMs: 0,
      revalidationMs: 0,
      cleanupMs: 0,
      totalMs: 1000,
    },
    fingerprint: SHA,
    ...overrides,
  };
}

function fingerprinted(value) {
  const payload = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "fingerprint"));
  const stable = (entry) => Array.isArray(entry)
    ? entry.map(stable)
    : entry && typeof entry === "object"
      ? Object.fromEntries(Object.entries(entry).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, stable(child)]))
      : entry;
  return {
    ...value,
    fingerprint: createHash("sha256").update(JSON.stringify(stable(payload))).digest("hex"),
  };
}

function sweep(overrides = {}) {
  return {
    schemaVersion: 1,
    recordType: "AutoCleanupSweepV1",
    startedAt: "2026-07-23T01:00:00.000Z",
    finishedAt: "2026-07-23T01:00:03.000Z",
    durationMs: 3000,
    checked: 4,
    attempted: 3,
    cleaned: 1,
    preserved: 1,
    failed: 1,
    deferred: 1,
    runnerFailure: null,
    fingerprint: SHA,
    ...overrides,
  };
}

describe("automatic lifecycle cleanup contracts", () => {
  it.runIf(process.platform === "win32")("canonicalizes fixture roots created through a Windows path alias", () => {
    const targetParent = mkdtempSync(path.join(tmpdir(), "talkpik-autocleanup-real-parent-"));
    const aliasParent = path.join(tmpdir(), `talkpik-autocleanup-alias-${randomUUID()}`);
    try {
      symlinkSync(targetParent, aliasParent, "junction");
      const root = makeFixtureRoot("child-", aliasParent);
      expect(root).toBe(realpathSync.native(root));
    } finally {
      if (existsSync(aliasParent)) unlinkSync(aliasParent);
      removeFixtureRoot(targetParent);
    }
  });

  it("validates closed secret-safe report and sweep records", () => {
    expect(validateAutoCleanupReportV1(report())).toEqual([]);
    expect(validateAutoCleanupSweepV1(sweep())).toEqual([]);
    expect(validateAutoCleanupReportV1(report({ token: "must-not-be-stored" })))
      .toContainEqual(expect.objectContaining({ code: "UNKNOWN_FIELD", path: "token" }));
    expect(validateAutoCleanupSweepV1(sweep({ attempted: 5 })))
      .toContainEqual(expect.objectContaining({ code: "COUNT_MISMATCH", path: "attempted" }));
    expect(validateAutoCleanupReportV1(report({
      result: "CLEANED",
      blockers: ["WORKTREE_DIRTY"],
      retryAt: null,
    }))).toContainEqual(expect.objectContaining({ code: "INVALID_BLOCKERS", path: "blockers" }));
    expect(validateAutoCleanupReportV1(report({ blockers: [], retryAt: null })))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ code: "INVALID_BLOCKERS", path: "blockers" }),
        expect.objectContaining({ code: "INVALID_RETRY", path: "retryAt" }),
      ]));
  });

  it("exposes both public one-shot commands and includes their tests in lifecycle CI", () => {
    const packageJson = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
    expect(packageJson.scripts["task:autocleanup"]).toBe("node scripts/ai-task.mjs autocleanup");
    expect(packageJson.scripts["task:sweep"]).toBe("node scripts/ai-task.mjs sweep");
    expect(packageJson.scripts["check:task-lifecycle"]).toContain("tests/scripts/ai-task-autocleanup.test.mjs");
  });

  it("requires immediate post-merge autocleanup and documents conditional remote deletion", () => {
    const agents = readFileSync(path.join(ROOT, "AGENTS.md"), "utf8");
    const operations = readFileSync(path.join(ROOT, "docs", "operations", "ai-development-pipeline.md"), "utf8");
    expect(agents).toContain("병합에 성공한 에이전트는 대상 worktree 밖의 안전한 기준 checkout에서");
    expect(operations).toContain("병합에 성공한 에이전트는 대상 worktree 밖의 안전한 기준 checkout에서");
    expect(operations).toContain("--force-with-lease=<remote-ref>:<expected-sha>");
    expect(operations).not.toContain("끝날 때는 먼저 삭제 가능성만 보고한 다음 사용자가 승인한 동일 상태만");
  });

  it("enumerates only valid active v2 records in canonical worktrees and excludes legacy records", () => {
    const repository = makeRepository();
    const started = startTask({
      repoPath: repository.base,
      branch: "fix/valid-auto-cleanup",
      actor: "codex",
      now: "2026-07-23T01:00:00.000Z",
    });
    const legacy = path.join(started.gitCommonDir, "codex", "tasks");
    mkdirSync(legacy, { recursive: true });
    writeFileSync(path.join(legacy, "feat-legacy.json"), "{}\n");
    expect(enumerateAutoCleanupTasks({ repoPath: repository.base }).map(({ branch }) => branch))
      .toEqual(["fix/valid-auto-cleanup"]);

    const taskFile = path.join(started.gitCommonDir, "talkpik-task-lifecycle", "v2", "tasks", `${started.taskId}.json`);
    const record = JSON.parse(readFileSync(taskFile, "utf8"));
    record.worktreePath = path.join(repository.root, "escape");
    writeFileSync(taskFile, `${JSON.stringify(record)}\n`);
    expect(enumerateAutoCleanupTasks({ repoPath: repository.base })).toEqual([]);
  });

  it("keeps copied Git fixtures isolated from the immutable merge-ready template and each other", () => {
    const first = mergeReady({ keepRemoteBranch: true });
    const second = mergeReady({ keepRemoteBranch: true });
    expect(first.root).not.toBe(second.root);
    expect(first.started.gitCommonDir).not.toBe(second.started.gitCommonDir);
    expect(first.started.worktreePath).not.toBe(second.started.worktreePath);

    git(first.remote, ["update-ref", "-d", `refs/heads/${first.started.branch}`]);
    writeFileSync(path.join(first.started.worktreePath, "isolated.txt"), "first only\n");

    expect(git(second.remote, ["rev-parse", `refs/heads/${second.started.branch}`]))
      .toBe(second.headSha);
    expect(git(second.started.worktreePath, ["status", "--short"])).toBe("");
    expect(git(mergeReadyTemplate.remote, ["rev-parse", `refs/heads/${second.started.branch}`]))
      .toBe(second.headSha);
  });

  it("defers only an identical blocker set during the fifteen-minute cooldown", () => {
    const previous = report({
      blockers: ["WORKTREE_DIRTY", "PR_NOT_MERGED"],
      finishedAt: "2026-07-23T01:00:00.000Z",
      retryAt: "2026-07-23T01:15:00.000Z",
    });
    expect(shouldDeferAutoCleanup(previous, ["PR_NOT_MERGED", "WORKTREE_DIRTY"], "2026-07-23T01:14:59.000Z"))
      .toBe(true);
    expect(shouldDeferAutoCleanup(previous, ["WORKTREE_DIRTY"], "2026-07-23T01:14:59.000Z"))
      .toBe(false);
    expect(shouldDeferAutoCleanup(previous, previous.blockers, "2026-07-23T01:15:00.000Z"))
      .toBe(false);
  });

  it("defers every identical owner-auth blocker", async () => {
    const repository = makeRepository();
    const commonDir = path.resolve(repository.base, git(repository.base, ["rev-parse", "--git-common-dir"]));
    const autoDirectory = path.join(commonDir, "talkpik-task-lifecycle", "v2", "auto-cleanup");
    mkdirSync(autoDirectory, { recursive: true });
    for (const blocker of [
      "ORIGIN_LOOKUP_FAILED",
      "ORIGIN_URL_UNSUPPORTED",
      "ORIGIN_HOST_UNSUPPORTED",
      "ORIGIN_OWNER_MISMATCH",
    ]) {
      writeFileSync(path.join(autoDirectory, "fix-cooldown.json"), `${JSON.stringify(fingerprinted(report({
        taskId: "fix-cooldown",
        branch: "fix/cooldown",
        trigger: "SWEEP",
        result: "PRESERVED",
        blockers: [blocker],
        finishedAt: "2026-07-23T01:00:00.000Z",
        retryAt: "2026-07-23T01:15:00.000Z",
        fingerprint: "",
      })))}\n`);
      const autoCleanupTask = vi.fn(async () => ({ result: "FAILED" }));
      const service = createAutoCleanupSweepService({
        enumerateTasks: () => [{ taskId: "fix-cooldown", branch: "fix/cooldown", worktreePath: "unused" }],
        previewTask: async () => ({ blockers: ["REMOTE_TASK_BRANCH_PRESENT"] }),
        autoCleanupTask,
        isPidActive: () => false,
      });
      await expect(service.sweepTasks({ repoPath: repository.base, now: "2026-07-23T01:05:00.000Z" }))
        .resolves.toMatchObject({ checked: 1, attempted: 0, deferred: 1 });
      expect(autoCleanupTask).not.toHaveBeenCalled();
    }
  });

  it("automatically removes a safe merged task without a manual approval fingerprint", async () => {
    const context = mergeReady();
    const service = createTaskCleanupService({
      readPrEvidence: async () => context.evidence,
      isPidActive: () => false,
      isPortActive: async () => false,
    });
    const result = await service.autoCleanupTask({
      repoPath: context.base,
      branch: context.started.branch,
      trigger: "DIRECT",
      now: "2026-07-23T01:05:00.000Z",
    });
    expect(result).toMatchObject({
      recordType: "AutoCleanupReportV1",
      taskId: context.started.taskId,
      result: "CLEANED",
      blockers: [],
    });
    expect(existsSync(context.started.worktreePath)).toBe(false);
    expect(() => git(context.base, ["show-ref", "--verify", `refs/heads/${context.started.branch}`])).toThrow();
    const sidecar = path.join(
      context.started.gitCommonDir,
      "talkpik-task-lifecycle",
      "v2",
      "auto-cleanup",
      `${context.started.taskId}.json`,
    );
    expect(JSON.parse(readFileSync(sidecar, "utf8"))).toEqual(result);
  });

  it("authenticates as blackstarzck and deletes only the exact merged remote head before local cleanup", async () => {
    const context = mergeReady({ keepRemoteBranch: true });
    const runOwnerAuth = vi.fn(async ({ owner, publishApproved }) => ({
      status: "OWNER_AUTHENTICATED",
      owner,
      publishApprovalUsed: publishApproved,
    }));
    const verifyRepositoryIdentity = vi.fn(async () => true);
    const service = createTaskCleanupService({
      readPrEvidence: async () => context.evidence,
      isPidActive: () => false,
      isPortActive: async () => false,
      runOwnerAuth,
      verifyRepositoryIdentity,
    });
    const result = await service.autoCleanupTask({
      repoPath: context.base,
      branch: context.started.branch,
      trigger: "DIRECT",
      now: "2026-07-23T01:05:00.000Z",
    });
    expect(result.result).toBe("CLEANED");
    expect(runOwnerAuth).toHaveBeenCalledWith(expect.objectContaining({ owner: "blackstarzck", publishApproved: true }));
    expect(verifyRepositoryIdentity).toHaveBeenCalledOnce();
    expect(git(context.base, ["ls-remote", "--heads", "origin", `refs/heads/${context.started.branch}`])).toBe("");
  }, 90_000);

  it("keeps a newer remote ref and all local items when it changes between precheck and conditional delete", async () => {
    const context = mergeReady({ keepRemoteBranch: true });
    let racedSha = null;
    let raced = false;
    const networkCommandRunner = (command, args, options) => {
      const isDelete = command === "git" && args.includes("push") &&
        (args.includes("--delete") || args.some((argument) => argument.startsWith("--force-with-lease=")));
      if (isDelete && !raced) {
        raced = true;
        git(context.seed, ["checkout", "-B", "remote-race", context.headSha]);
        writeFileSync(path.join(context.seed, "remote-race.txt"), "newer remote head\n");
        git(context.seed, ["add", "remote-race.txt"]);
        git(context.seed, ["commit", "-m", "move remote head"]);
        racedSha = git(context.seed, ["rev-parse", "HEAD"]);
        git(context.seed, ["push", "--force", "origin", `HEAD:refs/heads/${context.started.branch}`]);
      }
      return spawnSync(command, args, options);
    };
    const service = createTaskCleanupService({
      readPrEvidence: async () => context.evidence,
      isPidActive: () => false,
      isPortActive: async () => false,
      runOwnerAuth: async () => ({ status: "OWNER_AUTHENTICATED" }),
      verifyRepositoryIdentity: async () => true,
      networkCommandRunner,
    });

    const result = await service.autoCleanupTask({
      repoPath: context.base,
      branch: context.started.branch,
      trigger: "DIRECT",
      now: "2026-07-23T01:05:00.000Z",
    });

    expect(result).toMatchObject({ result: "PRESERVED", blockers: ["REMOTE_BRANCH_DELETE_FAILED"] });
    expect(racedSha).toMatch(/^[a-f0-9]{40}$/u);
    expect(git(context.base, ["ls-remote", "--heads", "origin", `refs/heads/${context.started.branch}`]))
      .toContain(racedSha);
    expect(existsSync(context.started.worktreePath)).toBe(true);
    expect(git(context.base, ["show-ref", "--verify", `refs/heads/${context.started.branch}`]))
      .toContain(context.headSha);
  });

  it("preserves all local items when owner authentication fails", async () => {
    const context = mergeReady({ keepRemoteBranch: true });
    const service = createTaskCleanupService({
      readPrEvidence: async () => context.evidence,
      isPidActive: () => false,
      isPortActive: async () => false,
      runOwnerAuth: async () => { throw Object.assign(new Error("OWNER_AUTH_SWITCH_FAILED"), { code: "OWNER_AUTH_SWITCH_FAILED" }); },
      verifyRepositoryIdentity: async () => true,
      deleteRemoteBranch: async () => { throw new Error("must not delete"); },
    });
    const result = await service.autoCleanupTask({
      repoPath: context.base,
      branch: context.started.branch,
      trigger: "DIRECT",
      now: "2026-07-23T01:05:00.000Z",
    });
    expect(result).toMatchObject({ result: "PRESERVED", blockers: ["OWNER_AUTH_SWITCH_FAILED"] });
    expect(existsSync(context.started.worktreePath)).toBe(true);
    expect(git(context.base, ["show-ref", "--verify", `refs/heads/${context.started.branch}`])).toContain(context.headSha);
  });

  it("uses real completion time and records failed auth and remote stage durations", async () => {
    const context = mergeReady({ keepRemoteBranch: true });
    let tick = -25;
    const service = createTaskCleanupService({
      readPrEvidence: async () => context.evidence,
      isPidActive: () => false,
      isPortActive: async () => false,
      runOwnerAuth: async () => ({ status: "OWNER_AUTHENTICATED" }),
      verifyRepositoryIdentity: async () => true,
      deleteRemoteBranch: async () => {
        throw Object.assign(new Error("delete failed"), { code: "REMOTE_BRANCH_DELETE_FAILED" });
      },
      monotonicNow: () => {
        tick += 25;
        return tick;
      },
      wallNow: () => "2026-07-23T01:05:02.500Z",
    });

    const result = await service.autoCleanupTask({
      repoPath: context.base,
      branch: context.started.branch,
      trigger: "DIRECT",
      now: "2026-07-23T01:05:00.000Z",
    });

    expect(result).toMatchObject({
      result: "PRESERVED",
      blockers: ["REMOTE_BRANCH_DELETE_FAILED"],
      startedAt: "2026-07-23T01:05:00.000Z",
      finishedAt: "2026-07-23T01:05:02.500Z",
      retryAt: "2026-07-23T01:20:02.500Z",
    });
    expect(result.stageTimings.authMs).toBeGreaterThan(0);
    expect(result.stageTimings.remoteMs).toBeGreaterThan(0);
    expect(result.stageTimings.totalMs).toBeGreaterThan(0);
  });

  it("cancels local cleanup when state changes after remote deletion", async () => {
    const context = mergeReady({ keepRemoteBranch: true });
    let tick = -10;
    const service = createTaskCleanupService({
      readPrEvidence: async () => context.evidence,
      isPidActive: () => false,
      isPortActive: async () => false,
      runOwnerAuth: async () => ({ status: "OWNER_AUTHENTICATED" }),
      verifyRepositoryIdentity: async () => true,
      deleteRemoteBranch: async ({ repoPath, branch }) => {
        git(repoPath, ["push", "origin", "--delete", branch]);
      },
      afterRemoteBranchDeleted: () => {
        writeFileSync(path.join(context.started.worktreePath, "raced.txt"), "changed\n");
      },
      monotonicNow: () => {
        tick += 10;
        return tick;
      },
      wallNow: () => "2026-07-23T01:05:01.000Z",
    });
    const result = await service.autoCleanupTask({
      repoPath: context.base,
      branch: context.started.branch,
      trigger: "DIRECT",
      now: "2026-07-23T01:05:00.000Z",
    });
    expect(result).toMatchObject({ result: "PRESERVED" });
    expect(result.blockers).toContain("AUTOCLEANUP_STATE_CHANGED");
    expect(result.stageTimings.revalidationMs).toBeGreaterThan(0);
    expect(existsSync(context.started.worktreePath)).toBe(true);
  });

  it("directly preserves every unsafe task state without deleting local ownership", async () => {
    const context = mergeReady();
    let attempt = 0;
    const fastAbsentRemote = (command, args, options) => {
      if (command === "git" && args.includes("fetch")) return { status: 0, stdout: "", stderr: "", signal: null };
      if (command === "git" && args.includes("ls-remote")) return { status: 2, stdout: "", stderr: "", signal: null };
      return spawnSync(command, args, options);
    };
    const invoke = async (expectedBlocker, overrides = {}) => {
      attempt += 1;
      const service = createTaskCleanupService({
        readPrEvidence: async () => context.evidence,
        isPidActive: () => false,
        isPortActive: async () => false,
        networkCommandRunner: fastAbsentRemote,
        ...overrides,
      });
      const result = await service.autoCleanupTask({
        repoPath: context.base,
        branch: context.started.branch,
        trigger: "DIRECT",
        now: `2026-07-23T01:${String(attempt + 5).padStart(2, "0")}:00.000Z`,
      });
      expect(result.result).toBe("PRESERVED");
      expect(result.blockers).toContain(expectedBlocker);
      expect(existsSync(context.started.worktreePath)).toBe(true);
    };

    const dirty = path.join(context.started.worktreePath, "dirty.txt");
    writeFileSync(dirty, "preserve\n");
    await invoke("WORKTREE_DIRTY");
    rmSync(dirty);

    registerTaskRuntime({
      repoPath: context.started.worktreePath,
      branch: context.started.branch,
      ports: [],
      pids: [4242],
      lockPaths: [],
      now: "2026-07-23T01:06:30.000Z",
    });
    await invoke("RUNTIME_PID_ACTIVE", { isPidActive: (pid) => pid === 4242 });

    registerTaskRuntime({
      repoPath: context.started.worktreePath,
      branch: context.started.branch,
      ports: [43210],
      pids: [],
      lockPaths: [],
      now: "2026-07-23T01:07:30.000Z",
    });
    await invoke("RUNTIME_PORT_ACTIVE", { isPortActive: async (port) => port === 43210 });

    const runtimeRoot = path.join(context.started.worktreePath, ".codex", "work", "automatic-cleanup");
    mkdirSync(runtimeRoot, { recursive: true });
    const runtimeLock = path.join(runtimeRoot, "runtime.lock");
    writeFileSync(runtimeLock, "active\n");
    registerTaskRuntime({
      repoPath: context.started.worktreePath,
      branch: context.started.branch,
      ports: [],
      pids: [],
      lockPaths: [runtimeLock],
      now: "2026-07-23T01:08:30.000Z",
    });
    await invoke("RUNTIME_LOCK_ACTIVE");
    rmSync(runtimeLock);
    registerTaskRuntime({
      repoPath: context.started.worktreePath,
      branch: context.started.branch,
      ports: [],
      pids: [],
      lockPaths: [],
      now: "2026-07-23T01:09:30.000Z",
    });

    git(context.base, ["worktree", "lock", context.started.worktreePath]);
    await invoke("WORKTREE_LOCKED");
    git(context.base, ["worktree", "unlock", context.started.worktreePath]);

    git(context.started.worktreePath, ["checkout", "--detach"]);
    await invoke("WORKTREE_DETACHED");
    git(context.started.worktreePath, ["switch", context.started.branch]);

    await invoke("PR_NOT_MERGED", {
      readPrEvidence: async () => ({ ...context.evidence, state: "OPEN", mergeCommitOid: null, mergedAt: null }),
    });
    await invoke("PR_HEAD_MISMATCH", {
      readPrEvidence: async () => ({ ...context.evidence, headRefOid: "f".repeat(40) }),
    });
    await invoke("PR_BASE_NOT_MAIN", {
      readPrEvidence: async () => ({ ...context.evidence, baseRefName: "develop" }),
    });

    const operationLock = path.join(
      context.started.gitCommonDir,
      "talkpik-task-lifecycle",
      "v2",
      "tasks",
      `${context.started.taskId}.lock`,
    );
    writeFileSync(operationLock, "owned elsewhere\n", { flag: "wx" });
    await invoke("TASK_OPERATION_IN_PROGRESS");
    rmSync(operationLock);

    const remoteAt = (sha) => (command, args, options) => {
      if (command === "git" && args.includes("fetch")) return { status: 0, stdout: "", stderr: "", signal: null };
      if (command === "git" && args.includes("ls-remote")) {
        return {
          status: 0,
          stdout: `${sha}\trefs/heads/${context.started.branch}\n`,
          stderr: "",
          signal: null,
        };
      }
      return spawnSync(command, args, options);
    };
    await invoke("GITHUB_REPOSITORY_IDENTITY_MISMATCH", {
      networkCommandRunner: remoteAt(context.headSha),
      runOwnerAuth: async () => ({ status: "OWNER_AUTHENTICATED" }),
      verifyRepositoryIdentity: async () => {
        throw Object.assign(new Error("wrong repository"), { code: "GITHUB_REPOSITORY_IDENTITY_MISMATCH" });
      },
    });

    await invoke("REMOTE_BRANCH_SHA_MISMATCH", {
      networkCommandRunner: remoteAt("f".repeat(40)),
      runOwnerAuth: async () => ({ status: "OWNER_AUTHENTICATED" }),
      verifyRepositoryIdentity: async () => true,
    });
    expect(git(context.base, ["show-ref", "--verify", `refs/heads/${context.started.branch}`]))
      .toContain(context.headSha);
  }, 60_000);

  it("runs at most ten candidates sequentially and records a closed sweep summary", async () => {
    const repository = makeRepository();
    const calls = [];
    const candidates = Array.from({ length: 12 }, (_, index) => ({
      taskId: `fix-sweep-${index}`,
      branch: `fix/sweep-${index}`,
      worktreePath: path.join(repository.base, ".worktrees", `fix-sweep-${index}`),
    }));
    const sweepService = createAutoCleanupSweepService({
      enumerateTasks: () => candidates,
      previewTask: async () => ({ blockers: [] }),
      autoCleanupTask: async ({ branch }) => {
        calls.push(branch);
        return {
          result: calls.length === 1 ? "CLEANED" : calls.length === 2 ? "PRESERVED" : "FAILED",
        };
      },
      isPidActive: () => false,
    });
    const result = await sweepService.sweepTasks({
      repoPath: repository.base,
      now: "2026-07-23T01:00:00.000Z",
    });
    expect(calls).toHaveLength(10);
    expect(result).toMatchObject({
      recordType: "AutoCleanupSweepV1",
      checked: 10,
      attempted: 10,
      cleaned: 1,
      preserved: 1,
      failed: 8,
      deferred: 0,
    });
    expect(validateAutoCleanupSweepV1(result)).toEqual([]);
    const commonDir = path.resolve(repository.base, git(repository.base, ["rev-parse", "--git-common-dir"]));
    const latest = path.join(commonDir, "talkpik-task-lifecycle", "v2", "sweeps", "latest.json");
    expect(JSON.parse(readFileSync(latest, "utf8"))).toEqual(result);
  });

  it("defers an identical blocker and enforces the ten-minute deadline without blocking later starts", async () => {
    const repository = makeRepository();
    const commonDir = path.resolve(repository.base, git(repository.base, ["rev-parse", "--git-common-dir"]));
    const taskId = "fix-cooldown";
    const autoDirectory = path.join(commonDir, "talkpik-task-lifecycle", "v2", "auto-cleanup");
    mkdirSync(autoDirectory, { recursive: true });
    const previous = fingerprinted(report({
      taskId,
      branch: "fix/cooldown",
      trigger: "SWEEP",
      result: "PRESERVED",
      blockers: ["PR_NOT_MERGED"],
      finishedAt: "2026-07-23T01:00:00.000Z",
      retryAt: "2026-07-23T01:15:00.000Z",
      fingerprint: "",
    }));
    writeFileSync(path.join(autoDirectory, `${taskId}.json`), `${JSON.stringify(previous)}\n`);
    const autoCleanupTask = vi.fn(async () => ({ result: "FAILED" }));
    const times = [0, 0, 0, 600_001, 600_001];
    const service = createAutoCleanupSweepService({
      enumerateTasks: () => [
        { taskId, branch: "fix/cooldown", worktreePath: "unused" },
        { taskId: "fix-later", branch: "fix/later", worktreePath: "unused" },
      ],
      previewTask: async () => ({ blockers: ["PR_NOT_MERGED"] }),
      autoCleanupTask,
      isPidActive: () => false,
      monotonicNow: () => times.shift() ?? 600_001,
    });
    const result = await service.sweepTasks({ repoPath: repository.base, now: "2026-07-23T01:05:00.000Z" });
    expect(result).toMatchObject({ checked: 1, attempted: 0, deferred: 1, durationMs: 600_001 });
    expect(autoCleanupTask).not.toHaveBeenCalled();

    const spawnWorker = vi.fn(() => ({ unref: vi.fn() }));
    expect(scheduleAutoCleanupSweep({
      baseRepoPath: repository.base,
      cliPath: path.join(ROOT, "scripts", "ai-task.mjs"),
      spawnWorker,
    })).toBe(true);
    expect(spawnWorker).toHaveBeenCalledWith(
      process.execPath,
      [path.join(ROOT, "scripts", "ai-task.mjs"), "sweep", "--repo", repository.base],
      expect.objectContaining({ cwd: repository.base, detached: true, windowsHide: true, stdio: "ignore" }),
    );
    expect(scheduleAutoCleanupSweep({
      baseRepoPath: repository.base,
      cliPath: path.join(ROOT, "scripts", "ai-task.mjs"),
      spawnWorker: () => { throw new Error("cannot spawn"); },
    })).toBe(false);
  });

  it("hard-stops an in-flight sweep candidate at the remaining deadline and starts no later candidate", async () => {
    const repository = makeRepository();
    const calls = [];
    const times = [0, 0, 0, 600_000];
    const service = createAutoCleanupSweepService({
      enumerateTasks: () => [
        { taskId: "fix-timeout", branch: "fix/timeout", worktreePath: "unused" },
        { taskId: "fix-later", branch: "fix/later", worktreePath: "unused" },
      ],
      previewTask: async () => ({ blockers: [] }),
      runCandidate: async ({ branch, timeoutMs }) => {
        calls.push({ branch, timeoutMs });
        throw Object.assign(new Error("worker timed out"), { code: "AUTOCLEANUP_TIMEOUT" });
      },
      isPidActive: () => false,
      monotonicNow: () => times.shift() ?? 600_000,
    });

    const result = await service.sweepTasks({ repoPath: repository.base, now: "2026-07-23T01:00:00.000Z" });

    expect(calls).toEqual([{ branch: "fix/timeout", timeoutMs: 595_000 }]);
    expect(result).toMatchObject({ checked: 1, attempted: 1, failed: 1, durationMs: 600_000 });

    const boundaryTimes = [0, 0, 600_001, 600_001];
    const boundaryWorker = vi.fn(async () => ({ result: "CLEANED" }));
    const boundaryService = createAutoCleanupSweepService({
      enumerateTasks: () => [{ taskId: "fix-boundary", branch: "fix/boundary", worktreePath: "unused" }],
      previewTask: async () => ({ blockers: [] }),
      runCandidate: boundaryWorker,
      isPidActive: () => false,
      monotonicNow: () => boundaryTimes.shift() ?? 600_001,
    });
    await expect(boundaryService.sweepTasks({
      repoPath: repository.base,
      now: "2026-07-23T01:00:00.000Z",
    })).resolves.toMatchObject({ checked: 0, attempted: 0, durationMs: 600_001 });
    expect(boundaryWorker).not.toHaveBeenCalled();

    const commonDir = path.resolve(repository.base, git(repository.base, ["rev-parse", "--git-common-dir"]));
    const autoDirectory = path.join(commonDir, "talkpik-task-lifecycle", "v2", "auto-cleanup");
    mkdirSync(autoDirectory, { recursive: true });
    writeFileSync(path.join(autoDirectory, "fix-preview-deadline.json"), `${JSON.stringify(fingerprinted(report({
      taskId: "fix-preview-deadline",
      branch: "fix/preview-deadline",
      trigger: "SWEEP",
      finishedAt: "2026-07-23T01:00:00.000Z",
      retryAt: "2026-07-23T01:15:00.000Z",
      fingerprint: "",
    })))}\n`);
    const previewTask = vi.fn(async () => ({ blockers: ["PR_NOT_MERGED"] }));
    const nearDeadlineTimes = [0, 565_002, 565_002];
    const previewService = createAutoCleanupSweepService({
      enumerateTasks: () => [{
        taskId: "fix-preview-deadline",
        branch: "fix/preview-deadline",
        worktreePath: "unused",
      }],
      previewTask,
      autoCleanupTask: vi.fn(async () => ({ result: "CLEANED" })),
      isPidActive: () => false,
      monotonicNow: () => nearDeadlineTimes.shift() ?? 565_002,
    });
    await expect(previewService.sweepTasks({
      repoPath: repository.base,
      now: "2026-07-23T01:00:00.000Z",
    })).resolves.toMatchObject({ checked: 0, attempted: 0, durationMs: 565_002 });
    expect(previewTask).not.toHaveBeenCalled();
  });

  it("records a confirmed worker timeout for the task and defers the same blocker for 15 minutes", async () => {
    const repository = makeRepository();
    const started = startTask({
      repoPath: repository.base,
      branch: "fix/timeout-cooldown",
      actor: "codex",
      now: "2026-07-23T01:00:00.000Z",
    });
    const candidate = {
      taskId: started.taskId,
      branch: started.branch,
      worktreePath: started.worktreePath,
    };
    const timeout = Object.assign(new Error("raw output must not be stored"), {
      code: "AUTOCLEANUP_TIMEOUT",
      processTreeTerminated: true,
    });
    const first = createAutoCleanupSweepService({
      enumerateTasks: () => [candidate],
      previewTask: async () => ({ blockers: [] }),
      runCandidate: async () => { throw timeout; },
      isPidActive: () => false,
      monotonicNow: () => 0,
    });

    await expect(first.sweepTasks({
      repoPath: repository.base,
      now: "2026-07-23T01:00:00.000Z",
    })).resolves.toMatchObject({ failed: 1 });

    const reportPath = path.join(
      started.gitCommonDir,
      "talkpik-task-lifecycle",
      "v2",
      "auto-cleanup",
      `${started.taskId}.json`,
    );
    const timeoutReport = JSON.parse(readFileSync(reportPath, "utf8"));
    expect(timeoutReport).toMatchObject({
      recordType: "AutoCleanupReportV1",
      taskId: started.taskId,
      branch: started.branch,
      trigger: "SWEEP",
      result: "FAILED",
      blockers: ["AUTOCLEANUP_TIMEOUT"],
      retryAt: "2026-07-23T01:15:00.000Z",
    });
    expect(validateAutoCleanupReportV1(timeoutReport)).toEqual([]);
    expect(JSON.stringify(timeoutReport)).not.toContain("raw output must not be stored");

    const secondRunner = vi.fn(async () => ({ result: "CLEANED" }));
    const second = createAutoCleanupSweepService({
      enumerateTasks: () => [candidate],
      previewTask: async () => ({ blockers: [] }),
      runCandidate: secondRunner,
      isPidActive: () => false,
      monotonicNow: () => 0,
    });
    await expect(second.sweepTasks({
      repoPath: repository.base,
      now: "2026-07-23T01:05:00.000Z",
    })).resolves.toMatchObject({ checked: 1, attempted: 0, deferred: 1 });
    expect(secondRunner).not.toHaveBeenCalled();
  });

  it("records an unconfirmed termination only in the sweep sidecar and carries its cooldown", async () => {
    const repository = makeRepository();
    const started = startTask({
      repoPath: repository.base,
      branch: "fix/termination-cooldown",
      actor: "codex",
      now: "2026-07-23T01:00:00.000Z",
    });
    const candidate = {
      taskId: started.taskId,
      branch: started.branch,
      worktreePath: started.worktreePath,
    };
    const first = createAutoCleanupSweepService({
      enumerateTasks: () => [candidate],
      previewTask: async () => ({ blockers: [] }),
      runCandidate: async () => {
        throw Object.assign(new Error("raw descendant output"), {
          code: "AUTOCLEANUP_TERMINATION_FAILED",
        });
      },
      isPidActive: () => false,
      monotonicNow: () => 0,
    });

    const firstResult = await first.sweepTasks({
      repoPath: repository.base,
      now: "2026-07-23T01:00:00.000Z",
    });
    expect(firstResult).toMatchObject({
      failed: 1,
      runnerFailure: {
        taskId: started.taskId,
        branch: started.branch,
        blocker: "AUTOCLEANUP_TERMINATION_FAILED",
        retryAt: "2026-07-23T01:15:00.000Z",
      },
    });
    expect(validateAutoCleanupSweepV1(firstResult)).toEqual([]);
    expect(JSON.stringify(firstResult)).not.toContain("raw descendant output");
    const reportPath = path.join(
      started.gitCommonDir,
      "talkpik-task-lifecycle",
      "v2",
      "auto-cleanup",
      `${started.taskId}.json`,
    );
    expect(existsSync(reportPath)).toBe(false);

    const secondRunner = vi.fn(async () => ({ result: "CLEANED" }));
    const second = createAutoCleanupSweepService({
      enumerateTasks: () => [candidate],
      previewTask: async () => ({ blockers: [] }),
      runCandidate: secondRunner,
      isPidActive: () => false,
      monotonicNow: () => 0,
    });
    await expect(second.sweepTasks({
      repoPath: repository.base,
      now: "2026-07-23T01:05:00.000Z",
    })).resolves.toMatchObject({
      checked: 1,
      attempted: 0,
      deferred: 1,
      runnerFailure: firstResult.runnerFailure,
    });
    expect(secondRunner).not.toHaveBeenCalled();
  });

  it("preserves the sweep lock through cooldown when an unconfirmed failure sidecar cannot be written", async () => {
    const repository = makeRepository();
    const started = startTask({
      repoPath: repository.base,
      branch: "fix/termination-write-failure",
      actor: "codex",
      now: "2026-07-23T01:00:00.000Z",
    });
    const service = createAutoCleanupSweepService({
      enumerateTasks: () => [{
        taskId: started.taskId,
        branch: started.branch,
        worktreePath: started.worktreePath,
      }],
      previewTask: async () => ({ blockers: [] }),
      runCandidate: async () => {
        throw Object.assign(new Error("unconfirmed"), {
          code: "AUTOCLEANUP_TERMINATION_FAILED",
        });
      },
      writeSweepReport: () => { throw new Error("simulated disk failure"); },
      isPidActive: () => false,
      monotonicNow: () => 0,
    });

    await expect(service.sweepTasks({
      repoPath: repository.base,
      now: "2026-07-23T01:00:00.000Z",
    })).rejects.toThrow("simulated disk failure");

    const lockPath = path.join(
      started.gitCommonDir,
      "talkpik-task-lifecycle",
      "v2",
      "sweep.lock",
    );
    expect(JSON.parse(readFileSync(lockPath, "utf8"))).toMatchObject({
      createdAt: "2026-07-23T01:00:00.000Z",
      holdUntil: "2026-07-23T01:25:00.000Z",
    });

    const retry = createAutoCleanupSweepService({
      enumerateTasks: () => [],
      isPidActive: () => false,
    });
    await expect(retry.sweepTasks({
      repoPath: repository.base,
      now: "2026-07-23T01:20:00.000Z",
    })).rejects.toMatchObject({ code: "SWEEP_IN_PROGRESS" });
  });

  it("starts no later sweep candidate when process-tree termination is unconfirmed", async () => {
    const repository = makeRepository();
    const calls = [];
    const service = createAutoCleanupSweepService({
      enumerateTasks: () => [
        { taskId: "fix-unsafe-timeout", branch: "fix/unsafe-timeout", worktreePath: "unused" },
        { taskId: "fix-must-not-race", branch: "fix/must-not-race", worktreePath: "unused" },
      ],
      previewTask: async () => ({ blockers: [] }),
      runCandidate: async ({ branch }) => {
        calls.push(branch);
        throw Object.assign(new Error("secret raw worker output"), {
          code: "AUTOCLEANUP_TERMINATION_FAILED",
        });
      },
      isPidActive: () => false,
    });

    await expect(service.sweepTasks({
      repoPath: repository.base,
      now: "2026-07-23T01:00:00.000Z",
    })).resolves.toMatchObject({ checked: 1, attempted: 1, failed: 1 });
    expect(calls).toEqual(["fix/unsafe-timeout"]);
  });

  it("runs the production sweep candidate as a bounded hidden child and accepts only a SWEEP report", async () => {
    const cleanupModule = await import("../../scripts/lib/ai-task-cleanup.mjs");
    expect(typeof cleanupModule.runAutoCleanupChild).toBe("function");
    const childReport = fingerprinted(report({
      taskId: "fix-child",
      branch: "fix/child",
      trigger: "SWEEP",
      fingerprint: "",
    }));
    const commandRunner = vi.fn(() => fakeChild({
      stdout: `${JSON.stringify(childReport)}\n`,
      stderr: "ignored raw child output",
    }));

    await expect(cleanupModule.runAutoCleanupChild({
      repoPath: "C:/safe-base",
      branch: "fix/child",
      now: "2026-07-23T01:00:00.000Z",
      timeoutMs: 1234,
      commandRunner,
    })).resolves.toEqual(childReport);
    expect(commandRunner).toHaveBeenCalledWith(
      process.execPath,
      expect.arrayContaining(["autocleanup", "--repo", "C:/safe-base", "--branch", "fix/child"]),
      expect.objectContaining({
        cwd: "C:/safe-base",
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        detached: process.platform !== "win32",
        env: expect.objectContaining({ TALKPIK_AUTOCLEANUP_TRIGGER: "SWEEP" }),
      }),
    );
  });

  it("terminates the timed-out tree, confirms root close, then reclaims only its plain operation lock", async () => {
    const cleanupModule = await import("../../scripts/lib/ai-task-cleanup.mjs");
    const repository = makeRepository();
    const started = startTask({
      repoPath: repository.base,
      branch: "fix/timeout-lock",
      actor: "codex",
      now: "2026-07-23T01:00:00.000Z",
    });
    const operationLock = path.join(
      started.gitCommonDir,
      "talkpik-task-lifecycle",
      "v2",
      "tasks",
      `${started.taskId}.lock`,
    );
    const pid = 43210;
    const order = [];
    const timedOut = () => {
      writeFileSync(operationLock, `${pid}:12345678-1234-4123-8123-123456789abc\n`, { flag: "wx" });
      return fakeChild({ pid, close: false });
    };
    const terminateProcessTree = vi.fn(async ({ child }) => {
      order.push("terminate-tree");
      queueMicrotask(() => {
        order.push("root-close");
        child.emit("close", null, "SIGKILL");
      });
      return true;
    });
    const reclaimOperationLock = vi.fn((input) => {
      order.push("reclaim-lock");
      return cleanupModule.reclaimTimedOutRemoteOperationLock(input);
    });
    await expect(cleanupModule.runAutoCleanupChild({
      repoPath: repository.base,
      branch: started.branch,
      now: "2026-07-23T01:00:00.000Z",
      timeoutMs: 50,
      commandRunner: timedOut,
      terminateProcessTree,
      confirmProcessTreeTerminated: async () => true,
      reclaimOperationLock,
    })).rejects.toMatchObject({ code: "AUTOCLEANUP_TIMEOUT" });
    expect(order).toEqual(["terminate-tree", "root-close", "reclaim-lock"]);
    expect(existsSync(operationLock)).toBe(false);
  });

  it("preserves operation and cleanup-journal locks when tree termination is not confirmed", async () => {
    const cleanupModule = await import("../../scripts/lib/ai-task-cleanup.mjs");
    const repository = makeRepository();
    const started = startTask({
      repoPath: repository.base,
      branch: "fix/timeout-lock-preserved",
      actor: "codex",
      now: "2026-07-23T01:00:00.000Z",
    });
    const operationLock = path.join(
      started.gitCommonDir,
      "talkpik-task-lifecycle",
      "v2",
      "tasks",
      `${started.taskId}.lock`,
    );
    const pid = 43211;
    writeFileSync(operationLock, `${pid}:12345678-1234-4123-8123-123456789abc\n`, { flag: "wx" });
    await expect(cleanupModule.runAutoCleanupChild({
      repoPath: repository.base,
      branch: started.branch,
      now: "2026-07-23T01:00:00.000Z",
      timeoutMs: 50,
      commandRunner: () => fakeChild({ pid, close: false }),
      terminateProcessTree: async () => false,
    })).rejects.toMatchObject({ code: "AUTOCLEANUP_TERMINATION_FAILED" });
    expect(existsSync(operationLock)).toBe(true);

    rmSync(operationLock);
    writeFileSync(operationLock, `${JSON.stringify({
      taskId: started.taskId,
      operation: "cleanup",
      pid,
      nonce: "12345678-1234-4123-8123-123456789abc",
      approvalFingerprint: "a".repeat(64),
      createdAt: "2026-07-23T01:00:00.000Z",
    })}\n`, { flag: "wx" });
    const cleanupChild = fakeChild({ pid, close: false });
    await expect(cleanupModule.runAutoCleanupChild({
      repoPath: repository.base,
      branch: started.branch,
      now: "2026-07-23T01:00:00.000Z",
      timeoutMs: 50,
      commandRunner: () => cleanupChild,
      terminateProcessTree: async ({ child }) => {
        queueMicrotask(() => child.emit("close", null, "SIGKILL"));
        return true;
      },
      confirmProcessTreeTerminated: async () => true,
    })).rejects.toMatchObject({ code: "AUTOCLEANUP_TIMEOUT" });
    expect(existsSync(operationLock)).toBe(true);
  });

  it.runIf(process.platform === "win32")(
    "kills a real Windows worker tree before reclaiming its exact owned lock",
    async () => {
      const cleanupModule = await import("../../scripts/lib/ai-task-cleanup.mjs");
      const repository = makeRepository();
      const started = startTask({
        repoPath: repository.base,
        branch: "fix/windows-timeout-tree",
        actor: "codex",
        now: "2026-07-23T01:00:00.000Z",
      });
      const operationLock = path.join(
        started.gitCommonDir,
        "talkpik-task-lifecycle",
        "v2",
        "tasks",
        `${started.taskId}.lock`,
      );
      const handshake = path.join(repository.root, "worker-handshake.json");
      const descendantReady = path.join(repository.root, "descendant-ready.txt");
      const worker = path.join(repository.root, "timeout-worker.mjs");
      const descendantSource = [
        'import { writeFileSync } from "node:fs";',
        `writeFileSync(${JSON.stringify(descendantReady)}, String(process.pid));`,
        "setInterval(() => {}, 1000);",
      ].join("\n");
      writeFileSync(worker, [
        'import { existsSync, writeFileSync } from "node:fs";',
        'import { spawn } from "node:child_process";',
        `const lock = ${JSON.stringify(operationLock)};`,
        `const handshake = ${JSON.stringify(handshake)};`,
        `const ready = ${JSON.stringify(descendantReady)};`,
        `const source = ${JSON.stringify(descendantSource)};`,
        'writeFileSync(lock, `${process.pid}:12345678-1234-4123-8123-123456789abc\\n`, { flag: "wx" });',
        'const descendant = spawn(process.execPath, ["--input-type=module", "-e", source], { stdio: "ignore", windowsHide: true });',
        "const awaitReady = setInterval(() => {",
        "  if (!existsSync(ready)) return;",
        "  clearInterval(awaitReady);",
        '  writeFileSync(handshake, JSON.stringify({ rootPid: process.pid, descendantPid: descendant.pid }));',
        "}, 10);",
        "setInterval(() => {}, 1000);",
      ].join("\n"));

      await expect(cleanupModule.runAutoCleanupChild({
        repoPath: repository.base,
        branch: started.branch,
        now: "2026-07-23T01:00:00.000Z",
        timeoutMs: 12_000,
        cliPath: worker,
      })).rejects.toMatchObject({ code: "AUTOCLEANUP_TIMEOUT" });
      expect(existsSync(handshake)).toBe(true);
      const first = JSON.parse(readFileSync(handshake, "utf8"));
      expect(await waitUntil(
        () => !pidActive(first.rootPid) && !pidActive(first.descendantPid),
        { timeoutMs: 2_000 },
      )).toBe(true);
      expect(existsSync(operationLock)).toBe(false);
    },
    20_000,
  );

  it("blocks a duplicate sweep worker and safely reclaims only an inactive stale sweep lock", async () => {
    const repository = makeRepository();
    const commonDir = path.resolve(repository.base, git(repository.base, ["rev-parse", "--git-common-dir"]));
    const v2 = path.join(commonDir, "talkpik-task-lifecycle", "v2");
    mkdirSync(v2, { recursive: true });
    const lock = path.join(v2, "sweep.lock");
    const nonce = "12345678-1234-4123-8123-123456789abc";
    writeFileSync(lock, `${JSON.stringify({
      pid: 12345,
      nonce,
      createdAt: "2026-07-23T01:00:00.000Z",
      holdUntil: "2026-07-23T01:15:00.000Z",
    })}\n`);
    const active = createAutoCleanupSweepService({
      enumerateTasks: () => [],
      previewTask: async () => ({ blockers: [] }),
      autoCleanupTask: async () => ({ result: "FAILED" }),
      isPidActive: () => true,
    });
    await expect(active.sweepTasks({ repoPath: repository.base, now: "2026-07-23T01:20:00.000Z" }))
      .rejects.toMatchObject({ code: "SWEEP_IN_PROGRESS" });

    writeFileSync(lock, `${JSON.stringify({
      pid: 12345,
      nonce,
      createdAt: "2026-07-23T01:00:00.000Z",
      unexpected: true,
    })}\n`);
    const malformed = createAutoCleanupSweepService({
      enumerateTasks: () => [],
      previewTask: async () => ({ blockers: [] }),
      autoCleanupTask: async () => ({ result: "FAILED" }),
      isPidActive: () => false,
    });
    await expect(malformed.sweepTasks({ repoPath: repository.base, now: "2026-07-23T01:20:00.000Z" }))
      .rejects.toMatchObject({ code: "SWEEP_IN_PROGRESS" });

    writeFileSync(lock, `${JSON.stringify({
      pid: 12345,
      nonce,
      createdAt: "2026-07-23T01:00:00.000Z",
      holdUntil: "2026-07-23T01:15:00.000Z",
    })}\n`);
    const times = [0, 1];
    const stale = createAutoCleanupSweepService({
      enumerateTasks: () => [],
      previewTask: async () => ({ blockers: [] }),
      autoCleanupTask: async () => ({ result: "FAILED" }),
      isPidActive: () => false,
      monotonicNow: () => times.shift() ?? 1,
    });
    await expect(stale.sweepTasks({ repoPath: repository.base, now: "2026-07-23T01:20:00.000Z" }))
      .resolves.toMatchObject({ checked: 0, attempted: 0, durationMs: 1 });
    expect(existsSync(lock)).toBe(false);
  });

  it("rejects ambiguous sweep CLI arguments", () => {
    const repository = makeRepository();
    const sweepWithBranch = spawnSync(
      process.execPath,
      [path.join(ROOT, "scripts", "ai-task.mjs"), "sweep", "--repo", repository.base, "--branch", "fix/nope"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
    );
    expect(sweepWithBranch.status).toBe(1);
    expect(sweepWithBranch.stdout).toBe("");
    expect(sweepWithBranch.stderr.trim()).toBe("INVALID_TASK_ARGUMENTS");
    const autoWithApproval = spawnSync(
      process.execPath,
      [
        path.join(ROOT, "scripts", "ai-task.mjs"),
        "autocleanup",
        "--repo", repository.base,
        "--branch", "fix/nope",
        "--approval", "a".repeat(64),
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
    );
    expect(autoWithApproval.status).toBe(1);
    expect(autoWithApproval.stderr.trim()).toBe("INVALID_TASK_ARGUMENTS");
  });

  it("refuses automatic cleanup when the worker is inside the target worktree", async () => {
    const repository = makeRepository();
    const started = startTask({
      repoPath: repository.base,
      branch: "fix/self-removal",
      actor: "codex",
      now: "2026-07-23T01:00:00.000Z",
    });
    const service = createTaskCleanupService({
      readPrEvidence: async () => { throw new Error("must not inspect PR"); },
      isPidActive: () => false,
      isPortActive: async () => false,
      currentWorkingDirectory: () => started.worktreePath,
    });
    await expect(service.autoCleanupTask({
      repoPath: repository.base,
      branch: started.branch,
      trigger: "DIRECT",
      now: "2026-07-23T01:05:00.000Z",
    })).rejects.toMatchObject({ code: "AUTOCLEANUP_TARGET_CWD_FORBIDDEN" });
    expect(existsSync(started.worktreePath)).toBe(true);
  });

  it("records preservation without auth when the task common directory does not match the actual repository", async () => {
    const context = mergeReady();
    const taskFile = path.join(
      context.started.gitCommonDir,
      "talkpik-task-lifecycle",
      "v2",
      "tasks",
      `${context.started.taskId}.json`,
    );
    const task = JSON.parse(readFileSync(taskFile, "utf8"));
    task.gitCommonDir = path.join(context.root, "other-common-dir");
    writeFileSync(taskFile, `${JSON.stringify(task)}\n`);
    const runOwnerAuth = vi.fn(async () => ({ status: "OWNER_AUTHENTICATED" }));
    const service = createTaskCleanupService({
      readPrEvidence: async () => ({ ...context.evidence, state: "OPEN", mergeCommitOid: null, mergedAt: null }),
      isPidActive: () => false,
      isPortActive: async () => false,
      runOwnerAuth,
    });

    const result = await service.autoCleanupTask({
      repoPath: context.base,
      branch: context.started.branch,
      trigger: "DIRECT",
      now: "2026-07-23T01:05:00.000Z",
    });

    expect(result).toMatchObject({ result: "PRESERVED", blockers: ["TASK_GIT_COMMON_DIR_MISMATCH"] });
    expect(runOwnerAuth).not.toHaveBeenCalled();
    expect(existsSync(context.started.worktreePath)).toBe(true);
    const sidecar = path.join(
      context.started.gitCommonDir,
      "talkpik-task-lifecycle",
      "v2",
      "auto-cleanup",
      `${context.started.taskId}.json`,
    );
    expect(JSON.parse(readFileSync(sidecar, "utf8"))).toEqual(result);
  });

  it("records preservation for a noncanonical native worktree owner instead of throwing", async () => {
    const context = mergeReady();
    const taskFile = path.join(
      context.started.gitCommonDir,
      "talkpik-task-lifecycle",
      "v2",
      "tasks",
      `${context.started.taskId}.json`,
    );
    const task = JSON.parse(readFileSync(taskFile, "utf8"));
    task.worktreePath = path.join(context.root, "unknown-native-owner");
    writeFileSync(taskFile, `${JSON.stringify(task)}\n`);
    const service = createTaskCleanupService({
      readPrEvidence: async () => { throw new Error("must not inspect PR"); },
      isPidActive: () => false,
      isPortActive: async () => false,
    });

    const result = await service.autoCleanupTask({
      repoPath: context.base,
      branch: context.started.branch,
      trigger: "DIRECT",
      now: "2026-07-23T01:05:00.000Z",
    });

    expect(result).toMatchObject({ result: "PRESERVED", blockers: ["AUTOCLEANUP_WORKTREE_NOT_CANONICAL"] });
    expect(existsSync(context.started.worktreePath)).toBe(true);
  });

  it("excludes a worktree root reparse path and accepts only equivalent Windows casing", () => {
    const repository = makeRepository();
    const started = startTask({
      repoPath: repository.base,
      branch: "fix/reparse-candidate",
      actor: "codex",
      now: "2026-07-23T01:00:00.000Z",
    });
    const taskFile = path.join(started.gitCommonDir, "talkpik-task-lifecycle", "v2", "tasks", `${started.taskId}.json`);
    if (process.platform === "win32") {
      const record = JSON.parse(readFileSync(taskFile, "utf8"));
      record.worktreePath = record.worktreePath.toUpperCase();
      writeFileSync(taskFile, `${JSON.stringify(record)}\n`);
      expect(enumerateAutoCleanupTasks({ repoPath: repository.base })).toHaveLength(1);
      record.worktreePath = started.worktreePath;
      writeFileSync(taskFile, `${JSON.stringify(record)}\n`);
    }
    const moved = `${started.worktreePath}-moved`;
    renameSync(started.worktreePath, moved);
    symlinkSync(moved, started.worktreePath, process.platform === "win32" ? "junction" : "dir");
    expect(enumerateAutoCleanupTasks({ repoPath: repository.base })).toEqual([]);
  });

  it("emits a successful task:start before scheduling and remains successful when scheduling throws", async () => {
    const repository = makeRepository();
    const order = [];
    const started = await runTaskLifecycleCommand(
      {
        command: "start",
        values: {
          repo: repository.base,
          branch: "fix/nonblocking-sweep-schedule",
          actor: "codex",
          now: "2026-07-23T01:00:00.000Z",
        },
      },
      {
        onStartSuccess: () => order.push("output"),
        scheduleSweep: () => {
          order.push("schedule");
          throw new Error("spawn unavailable");
        },
      },
    );
    expect(started).toMatchObject({ branch: "fix/nonblocking-sweep-schedule", state: "ACTIVE" });
    expect(existsSync(started.worktreePath)).toBe(true);
    expect(order).toEqual(["output", "schedule"]);
  });

  it("lets an old-base task start schedule the latest CLI explicitly in the background", async () => {
    const repository = makeRepository();
    const latestCli = path.join(repository.root, "latest-worktree", "scripts", "ai-task.mjs");
    const scheduleSweep = vi.fn(() => true);

    await expect(runTaskLifecycleCommand(
      {
        command: "sweep",
        values: { repo: repository.base, background: "true" },
      },
      { currentCliPath: latestCli, scheduleSweep },
    )).resolves.toEqual({ status: "SCHEDULED", repoPath: path.resolve(repository.base) });
    expect(scheduleSweep).toHaveBeenCalledWith({
      baseRepoPath: path.resolve(repository.base),
      cliPath: latestCli,
    });

    await expect(runTaskLifecycleCommand(
      {
        command: "sweep",
        values: { repo: repository.base, background: "true" },
      },
      { currentCliPath: latestCli, scheduleSweep: () => false },
    )).rejects.toMatchObject({ code: "TASK_SWEEP_SCHEDULE_FAILED" });

    const invalid = spawnSync(process.execPath, [
      path.join(ROOT, "scripts", "ai-task.mjs"),
      "sweep",
      "--repo", repository.base,
      "--background", "false",
    ], { cwd: repository.base, encoding: "utf8", shell: false, windowsHide: true });
    expect(invalid.status).toBe(1);
    expect(invalid.stderr.trim()).toBe("INVALID_TASK_ARGUMENTS");
  });

  it("does not let a stale preserved writer overwrite a concurrent CLEANED report", async () => {
    const context = mergeReady();
    let releaseStale;
    let staleReached;
    const staleReachedPromise = new Promise((resolve) => { staleReached = resolve; });
    const releaseStalePromise = new Promise((resolve) => { releaseStale = resolve; });
    const commonOptions = {
      isPidActive: () => false,
      isPortActive: async () => false,
      currentWorkingDirectory: () => context.base,
    };
    const staleService = createTaskCleanupService({
      ...commonOptions,
      readPrEvidence: async () => ({ ...context.evidence, state: "OPEN", mergedAt: null }),
      wallNow: () => "2026-07-23T01:05:01.000Z",
      async beforeAutoCleanupReportWrite() {
        staleReached();
        await releaseStalePromise;
      },
    });
    const cleanupService = createTaskCleanupService({
      ...commonOptions,
      readPrEvidence: async () => context.evidence,
      wallNow: () => "2026-07-23T01:05:02.000Z",
    });

    const staleResultPromise = staleService.autoCleanupTask({
      repoPath: context.base,
      branch: context.started.branch,
      trigger: "SWEEP",
      now: "2026-07-23T01:05:00.000Z",
    });
    await staleReachedPromise;
    const cleaned = await cleanupService.autoCleanupTask({
      repoPath: context.base,
      branch: context.started.branch,
      trigger: "DIRECT",
      now: "2026-07-23T01:05:00.000Z",
    });
    releaseStale();
    const staleResult = await staleResultPromise;

    expect(cleaned).toMatchObject({ result: "CLEANED", blockers: [], retryAt: null });
    expect(staleResult).toMatchObject({ trigger: "SWEEP", result: "CLEANED", blockers: [], retryAt: null });
    const reportFile = path.join(
      context.started.gitCommonDir,
      "talkpik-task-lifecycle",
      "v2",
      "auto-cleanup",
      `${context.started.taskId}.json`,
    );
    expect(JSON.parse(readFileSync(reportFile, "utf8")))
      .toMatchObject({ trigger: "DIRECT", result: "CLEANED", blockers: [], retryAt: null });
  }, 90_000);

  it("shares one absolute preview budget across production fetch, GitHub, and remote lookup", async () => {
    const context = mergeReady();
    git(context.base, ["remote", "set-url", "origin", "https://github.com/blackstarzck/topik-project.git"]);
    const networkCalls = [];
    const networkCommandRunner = (command, args, options = {}) => {
      if (Number.isFinite(options.timeout)) networkCalls.push({ command, args, timeout: options.timeout });
      if (command === "git" && args[2] === "fetch") return { status: 0, stdout: "", stderr: "" };
      if (command === "git" && args[2] === "ls-remote") return { status: 2, stdout: "", stderr: "" };
      if (command === "gh") {
        return {
          status: 0,
          stdout: JSON.stringify({
            ...context.evidence,
            mergeCommit: { oid: context.evidence.mergeCommitOid },
          }),
          stderr: "",
        };
      }
      return spawnSync(command, args, options);
    };
    const service = createTaskCleanupService({
      networkCommandRunner,
      isPidActive: () => false,
      isPortActive: async () => false,
      currentWorkingDirectory: () => context.base,
    });

    await expect(service.finalizeTask({
      repoPath: context.base,
      branch: context.started.branch,
      timeoutMs: 60_000,
    })).resolves.toMatchObject({ reportOnly: true });
    const networkTimeouts = networkCalls.map(({ timeout }) => timeout);
    expect(networkCalls.map(({ command, args }) => `${command}:${command === "git" ? args[2] : args[0]}`))
      .toEqual(["git:fetch", "gh:pr", "git:ls-remote"]);
    expect(networkTimeouts.every((timeout) => timeout > 0 && timeout <= 60_000)).toBe(true);
    expect(networkTimeouts[1]).toBeLessThanOrEqual(networkTimeouts[0]);
    expect(networkTimeouts[2]).toBeLessThanOrEqual(networkTimeouts[1]);
  }, 90_000);

  it("revalidates the report directory after lock waits and never follows a replacement junction", async () => {
    const context = mergeReady();
    const autoDirectory = path.join(
      context.started.gitCommonDir,
      "talkpik-task-lifecycle",
      "v2",
      "auto-cleanup",
    );
    const lockFile = path.join(autoDirectory, `${context.started.taskId}.lock`);
    const outside = path.join(context.root, "outside-report-target");
    mkdirSync(autoDirectory, { recursive: true });
    mkdirSync(outside);
    writeFileSync(lockFile, `${process.pid}:${randomUUID()}\n`);
    let replaced = false;
    const service = createTaskCleanupService({
      readPrEvidence: async () => ({ ...context.evidence, state: "OPEN", mergedAt: null }),
      isPidActive: () => false,
      isPortActive: async () => false,
      currentWorkingDirectory: () => context.base,
      wallNow: () => "2026-07-23T01:05:01.000Z",
      waitForAutoCleanupReportLock: async () => {
        if (replaced) return;
        replaced = true;
        unlinkSync(lockFile);
        rmSync(autoDirectory, { recursive: true, force: true });
        symlinkSync(outside, autoDirectory, process.platform === "win32" ? "junction" : "dir");
      },
    });

    await expect(service.autoCleanupTask({
      repoPath: context.base,
      branch: context.started.branch,
      trigger: "DIRECT",
      now: "2026-07-23T01:05:00.000Z",
    })).rejects.toMatchObject({ code: "REGISTRY_PATH_ESCAPE" });
    expect(readdirSync(outside)).toEqual([]);
  });

  it("recovers an old malformed report lock by exact identity before writing", async () => {
    const context = mergeReady();
    const autoDirectory = path.join(
      context.started.gitCommonDir,
      "talkpik-task-lifecycle",
      "v2",
      "auto-cleanup",
    );
    const lockFile = path.join(autoDirectory, `${context.started.taskId}.lock`);
    mkdirSync(autoDirectory, { recursive: true });
    writeFileSync(lockFile, "");
    const staleTime = new Date(Date.now() - 11 * 60 * 1000);
    utimesSync(lockFile, staleTime, staleTime);
    const service = createTaskCleanupService({
      readPrEvidence: async () => ({ ...context.evidence, state: "OPEN", mergedAt: null }),
      isPidActive: () => false,
      isPortActive: async () => false,
      currentWorkingDirectory: () => context.base,
      wallNow: () => "2026-07-23T01:05:01.000Z",
    });

    await expect(service.autoCleanupTask({
      repoPath: context.base,
      branch: context.started.branch,
      trigger: "DIRECT",
      now: "2026-07-23T01:05:00.000Z",
    })).resolves.toMatchObject({ result: "PRESERVED", blockers: ["PR_NOT_MERGED"] });
    expect(existsSync(lockFile)).toBe(false);
  });

  it("enumerates and resumes an automatic cleanup journal after the worktree was already removed", async () => {
    const context = mergeReady();
    let failOnce = true;
    let tick = -10;
    const service = createTaskCleanupService({
      readPrEvidence: async () => context.evidence,
      isPidActive: () => false,
      isPortActive: async () => false,
      afterCleanupStep(step) {
        if (step === "WORKTREE_ABSENCE_VERIFIED" && failOnce) {
          failOnce = false;
          throw new Error("INJECTED_PARTIAL_FAILURE");
        }
      },
      monotonicNow: () => {
        tick += 10;
        return tick;
      },
      wallNow: () => "2026-07-23T01:06:01.000Z",
    });
    const first = await service.autoCleanupTask({
      repoPath: context.base,
      branch: context.started.branch,
      trigger: "DIRECT",
      now: "2026-07-23T01:05:00.000Z",
    });
    expect(first).toMatchObject({ result: "FAILED", blockers: ["CLEANUP_PARTIAL_FAILURE"] });
    expect(first.stageTimings.cleanupMs).toBeGreaterThan(0);
    expect(existsSync(context.started.worktreePath)).toBe(false);
    expect(enumerateAutoCleanupTasks({ repoPath: context.base }).map(({ branch }) => branch))
      .toEqual([context.started.branch]);

    const resumed = await service.autoCleanupTask({
      repoPath: context.base,
      branch: context.started.branch,
      trigger: "SWEEP",
      now: "2026-07-23T01:06:00.000Z",
    });
    expect(resumed).toMatchObject({ result: "CLEANED", blockers: [] });
  });
});
