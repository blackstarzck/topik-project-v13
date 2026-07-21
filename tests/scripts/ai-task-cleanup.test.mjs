import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cleanupTask,
  createTaskCleanupService,
  finalizeTask,
  registerTaskRuntime,
} from "../../scripts/lib/ai-task-cleanup.mjs";
import { readTaskStatus, startTask, validateCleanupManifest } from "../../scripts/lib/ai-task-lifecycle-v2.mjs";

const NOW = "2026-07-21T07:00:00.000Z";
const tempRoots = [];

// These integration tests create real local Git repositories and worktrees.
// On Windows, full-suite worker contention can make an otherwise 10-15 second
// case exceed the repository-wide 40 second UI-test ceiling.
vi.setConfig({ testTimeout: 120_000 });

function tempRoot(prefix = "talkpik-cleanup-") {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function git(cwd, args, { allowFailure = false } = {}) {
  try {
    return execFileSync("git", ["-C", cwd, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    if (allowFailure) return null;
    throw error;
  }
}

function makeRepository() {
  const root = tempRoot();
  const remote = path.join(root, "remote.git");
  const seed = path.join(root, "seed");
  const base = path.join(root, "base");
  execFileSync("git", ["init", "--bare", remote]);
  execFileSync("git", ["init", "-b", "main", seed]);
  git(seed, ["config", "user.email", "test@example.com"]);
  git(seed, ["config", "user.name", "Cleanup Test"]);
  writeFileSync(
    path.join(seed, ".gitignore"),
    ".codex/\nnode_modules/\n.next/\nbuild/\ndist/\nout/\ncoverage/\n.cache/\n.env.local\n",
  );
  writeFileSync(path.join(seed, "README.md"), "baseline\n");
  git(seed, ["add", ".gitignore", "README.md"]);
  git(seed, ["commit", "-m", "baseline"]);
  git(seed, ["remote", "add", "origin", remote]);
  git(seed, ["push", "-u", "origin", "main"]);
  execFileSync("git", ["clone", "--branch", "main", remote, base]);
  git(base, ["config", "user.email", "test@example.com"]);
  git(base, ["config", "user.name", "Cleanup Test"]);
  return { root, remote, seed, base };
}

function taskPaths(started) {
  const v2 = path.join(started.gitCommonDir, "talkpik-task-lifecycle", "v2");
  return {
    v2,
    task: path.join(v2, "tasks", `${started.taskId}.json`),
    runtime: path.join(v2, "runtimes", `${started.taskId}.json`),
    cleanup: path.join(v2, "cleanups", `${started.taskId}.json`),
    temp: path.join(started.worktreePath, ".codex", "work", started.slug),
  };
}

function mergeReady({ keepRemoteBranch = false, runtime = {}, squash = false } = {}) {
  const repository = makeRepository();
  const started = startTask({
    repoPath: repository.base,
    branch: "chore/cleanup-sample",
    actor: "codex",
    now: NOW,
  });
  writeFileSync(path.join(started.worktreePath, "change.txt"), "published change\n");
  git(started.worktreePath, ["add", "change.txt"]);
  git(started.worktreePath, ["commit", "-m", "published change"]);
  const headSha = git(started.worktreePath, ["rev-parse", "HEAD"]);
  git(started.worktreePath, ["push", "-u", "origin", started.branch]);
  git(repository.seed, ["fetch", "origin", started.branch]);
  if (squash) {
    git(repository.seed, ["merge", "--squash", `origin/${started.branch}`]);
    git(repository.seed, ["commit", "-m", "squash merge task"]);
  } else {
    git(repository.seed, ["merge", "--no-ff", `origin/${started.branch}`, "-m", "merge task"]);
  }
  const mergeCommitOid = git(repository.seed, ["rev-parse", "HEAD"]);
  git(repository.seed, ["push", "origin", "main"]);
  if (!keepRemoteBranch) git(repository.seed, ["push", "origin", "--delete", started.branch]);
  registerTaskRuntime({
    repoPath: started.worktreePath,
    branch: started.branch,
    ports: runtime.ports ?? [],
    pids: runtime.pids ?? [],
    lockPaths: runtime.lockPaths ?? [],
    now: "2026-07-21T07:01:00.000Z",
  });
  const paths = taskPaths(started);
  mkdirSync(paths.temp, { recursive: true });
  writeFileSync(path.join(paths.temp, "task.log"), "temporary\n");
  const evidence = {
    number: 42,
    state: "MERGED",
    baseRefName: "main",
    headRefName: started.branch,
    headRefOid: headSha,
    mergeCommitOid,
    mergedAt: "2026-07-21T06:59:00.000Z",
  };
  return { ...repository, started, paths, evidence, headSha, mergeCommitOid };
}

function serviceFor(context, overrides = {}) {
  return createTaskCleanupService({
    readPrEvidence: async () => structuredClone(context.evidence),
    isPidActive: () => false,
    isPortActive: async () => false,
    ...overrides,
  });
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("task:runtime", () => {
  it("requires an explicit safe runtime registration, including an explicit empty registration", async () => {
    const { base } = makeRepository();
    const started = startTask({ repoPath: base, branch: "test/runtime-empty", actor: "codex", now: NOW });
    const service = createTaskCleanupService({
      readPrEvidence: async () => { throw new Error("not reached"); },
      isPidActive: () => false,
      isPortActive: async () => false,
    });

    const missing = await service.finalizeTask({ repoPath: started.worktreePath, branch: started.branch });
    expect(missing.blockers).toContain("RUNTIME_REGISTRATION_REQUIRED");

    const manifest = registerTaskRuntime({
      repoPath: started.worktreePath,
      branch: started.branch,
      ports: [],
      pids: [],
      lockPaths: [],
      now: "2026-07-21T07:01:00.000Z",
    });
    expect(manifest).toMatchObject({ recordType: "RuntimeManifest", ports: [], pids: [], lockPaths: [] });
  });

  it("rejects runtime lock paths outside the task-owned temporary directory", () => {
    const { base } = makeRepository();
    const started = startTask({ repoPath: base, branch: "test/runtime-escape", actor: "codex", now: NOW });

    expect(() => registerTaskRuntime({
      repoPath: started.worktreePath,
      branch: started.branch,
      ports: [],
      pids: [],
      lockPaths: [path.join(started.worktreePath, "outside.lock")],
      now: "2026-07-21T07:01:00.000Z",
    })).toThrowError("RUNTIME_LOCK_PATH_ESCAPE");
  });
});

describe("task:finalize report-only gate", () => {
  it("returns stable sorted candidates and a fingerprint without deleting or changing registry state", async () => {
    const context = mergeReady();
    const taskBefore = readFileSync(context.paths.task, "utf8");
    const runtimeBefore = readFileSync(context.paths.runtime, "utf8");

    const report = await serviceFor(context).finalizeTask({
      repoPath: context.started.worktreePath,
      branch: context.started.branch,
    });

    expect(report.ready).toBe(true);
    expect(report.blockers).toEqual([]);
    expect(report.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(report.candidates).toEqual([...report.candidates].sort());
    expect(report.fetch).toEqual({ remote: "origin", prune: true, refsRefreshed: true });
    expect(report.prEvidence).toEqual(context.evidence);
    expect(existsSync(context.started.worktreePath)).toBe(true);
    expect(git(context.base, ["branch", "--list", context.started.branch])).toContain(context.started.branch);
    expect(readFileSync(context.paths.task, "utf8")).toBe(taskBefore);
    expect(readFileSync(context.paths.runtime, "utf8")).toBe(runtimeBefore);
    expect(existsSync(context.paths.cleanup)).toBe(false);
  });

  it("includes exact ignored disposable roots in the snapshot and invalidates content changes", async () => {
    const context = mergeReady();
    mkdirSync(path.join(context.started.worktreePath, "node_modules", "sample"), { recursive: true });
    writeFileSync(path.join(context.started.worktreePath, "node_modules", "sample", "index.js"), "first\n");
    writeFileSync(path.join(context.started.worktreePath, ".env.local"), "SECRET_VALUE=never-print\n");
    const service = serviceFor(context);
    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });
    expect(report.ready).toBe(true);
    expect(report.candidates).toEqual(expect.arrayContaining([
      `disposable:${path.join(context.started.worktreePath, "node_modules")}`,
      `disposable:${path.join(context.started.worktreePath, ".env.local")}`,
    ]));
    expect(JSON.stringify(report)).not.toContain("never-print");
    writeFileSync(path.join(context.paths.temp, "task.log"), "changed ignored contents\n");
    await expect(service.cleanupTask({
      repoPath: context.base,
      branch: context.started.branch,
      approval: report.fingerprint,
      now: "2026-07-21T07:05:00.000Z",
    })).rejects.toThrowError("APPROVAL_INVALIDATED");
  });

  it("blocks arbitrary ignored files outside the exact disposable policy", async () => {
    const context = mergeReady();
    writeFileSync(path.join(context.started.gitCommonDir, "info", "exclude"), ".rogue/\n");
    mkdirSync(path.join(context.started.worktreePath, ".rogue"));
    writeFileSync(path.join(context.started.worktreePath, ".rogue", "keep.txt"), "keep\n");
    const report = await serviceFor(context).finalizeTask({ repoPath: context.base, branch: context.started.branch });
    expect(report.blockers).toContain("WORKTREE_IGNORED_CONTENT");
  });

  it("blocks squash PR cleanup when the PR head is not in origin/main", async () => {
    const context = mergeReady({ squash: true });
    const report = await serviceFor(context).finalizeTask({ repoPath: context.base, branch: context.started.branch });
    expect(report.blockers).toContain("PR_HEAD_NOT_IN_ORIGIN_MAIN");
  });

  it("reports another lifecycle operation lock as a blocker", async () => {
    const context = mergeReady();
    const operationLock = path.join(context.paths.v2, "tasks", `${context.started.taskId}.lock`);
    writeFileSync(operationLock, "other-owner\n", { flag: "wx" });
    const report = await serviceFor(context).finalizeTask({ repoPath: context.base, branch: context.started.branch });
    expect(report.blockers).toContain("TASK_OPERATION_IN_PROGRESS");
  });

  it.each([
    ["dirty worktree", "WORKTREE_DIRTY", (context) => writeFileSync(path.join(context.started.worktreePath, "dirty.txt"), "dirty\n")],
    ["open pull request", "PR_NOT_MERGED", (context) => { context.evidence.state = "OPEN"; context.evidence.mergedAt = null; }],
    ["PR head mismatch", "PR_HEAD_MISMATCH", (context) => { context.evidence.headRefOid = "a".repeat(40); }],
    ["PR base mismatch", "PR_BASE_NOT_MAIN", (context) => { context.evidence.baseRefName = "develop"; }],
    ["remote branch remains", "REMOTE_TASK_BRANCH_PRESENT", null],
  ])("preserves a task for %s", async (_label, blocker, mutate) => {
    const context = mergeReady({ keepRemoteBranch: blocker === "REMOTE_TASK_BRANCH_PRESENT" });
    mutate?.(context);
    const report = await serviceFor(context).finalizeTask({ repoPath: context.base, branch: context.started.branch });
    expect(report.ready).toBe(false);
    expect(report.blockers).toContain(blocker);
    expect(existsSync(context.started.worktreePath)).toBe(true);
  });

  it("preserves unpublished local commits", async () => {
    const context = mergeReady();
    writeFileSync(path.join(context.started.worktreePath, "late.txt"), "late\n");
    git(context.started.worktreePath, ["add", "late.txt"]);
    git(context.started.worktreePath, ["commit", "-m", "not published"]);

    const report = await serviceFor(context).finalizeTask({ repoPath: context.base, branch: context.started.branch });
    expect(report.blockers).toEqual(expect.arrayContaining(["LOCAL_COMMITS_NOT_PUBLISHED", "PR_HEAD_MISMATCH"]));
  });

  it.each([
    ["pid", { pids: [process.pid] }, "RUNTIME_PID_ACTIVE"],
    ["port", { ports: [43219] }, "RUNTIME_PORT_ACTIVE"],
  ])("preserves a task with an active runtime %s", async (kind, runtime, blocker) => {
    const context = mergeReady({ runtime });
    const service = serviceFor(context, {
      isPidActive: (pid) => kind === "pid" && pid === process.pid,
      isPortActive: async (port) => kind === "port" && port === 43219,
    });
    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });
    expect(report.blockers).toContain(blocker);
  });

  it("preserves a task while a registered runtime lock exists", async () => {
    const context = mergeReady();
    const runtimeLock = path.join(context.paths.temp, "runtime.lock");
    writeFileSync(runtimeLock, "locked\n");
    registerTaskRuntime({
      repoPath: context.started.worktreePath,
      branch: context.started.branch,
      ports: [],
      pids: [],
      lockPaths: [runtimeLock],
      now: "2026-07-21T07:02:00.000Z",
    });
    const report = await serviceFor(context).finalizeTask({ repoPath: context.base, branch: context.started.branch });
    expect(report.blockers).toContain("RUNTIME_LOCK_ACTIVE");
  });

  it("fails closed when PR evidence cannot be obtained", async () => {
    const context = mergeReady();
    const service = serviceFor(context, {
      readPrEvidence: async () => { throw Object.assign(new Error("raw secret must not escape"), { code: "GH_FAILED" }); },
    });
    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });
    expect(report.blockers).toContain("PR_EVIDENCE_UNAVAILABLE");
    expect(JSON.stringify(report)).not.toContain("raw secret");
  });

  it("preserves locked and detached worktrees", async () => {
    const locked = mergeReady();
    git(locked.base, ["worktree", "lock", locked.started.worktreePath]);
    const lockedReport = await serviceFor(locked).finalizeTask({ repoPath: locked.base, branch: locked.started.branch });
    expect(lockedReport.blockers).toContain("WORKTREE_LOCKED");

    const detached = mergeReady();
    git(detached.started.worktreePath, ["checkout", "--detach"]);
    const detachedReport = await serviceFor(detached).finalizeTask({ repoPath: detached.base, branch: detached.started.branch });
    expect(detachedReport.blockers).toContain("WORKTREE_DETACHED");
  });

  it("preserves a native worktree whose v2 ownership record points elsewhere", async () => {
    const context = mergeReady();
    const task = JSON.parse(readFileSync(context.paths.task, "utf8"));
    task.worktreePath = path.join(context.root, "unknown-owner");
    writeFileSync(context.paths.task, `${JSON.stringify(task, null, 2)}\n`);
    const report = await serviceFor(context).finalizeTask({ repoPath: context.base, branch: context.started.branch });
    expect(report.blockers).toContain("WORKTREE_OWNERSHIP_UNKNOWN");
    expect(existsSync(context.started.worktreePath)).toBe(true);
  });

  it("fails closed without a valid v2 ownership record", async () => {
    const context = mergeReady();
    rmSync(context.paths.task);
    await expect(finalizeTask({ repoPath: context.base, branch: context.started.branch }))
      .rejects.toThrowError("TASK_NOT_FOUND");
    expect(existsSync(context.started.worktreePath)).toBe(true);
  });

  it("accepts equivalent worktree path casing on Windows", async () => {
    if (process.platform !== "win32") return;
    const context = mergeReady();
    const task = JSON.parse(readFileSync(context.paths.task, "utf8"));
    task.worktreePath = task.worktreePath.toUpperCase();
    writeFileSync(context.paths.task, `${JSON.stringify(task, null, 2)}\n`);
    const report = await serviceFor(context).finalizeTask({ repoPath: context.base, branch: context.started.branch });
    expect(report.blockers).not.toContain("WORKTREE_OWNERSHIP_UNKNOWN");
  });

  it("blocks protected branches even if an unsafe record reaches the assessor", async () => {
    const context = mergeReady();
    const task = JSON.parse(readFileSync(context.paths.task, "utf8"));
    task.branch = "main";
    writeFileSync(context.paths.task, `${JSON.stringify(task, null, 2)}\n`);
    await expect(serviceFor(context).finalizeTask({ repoPath: context.base, branch: context.started.branch }))
      .rejects.toThrowError(/TASK_RECORD_INVALID|PROTECTED_BRANCH/);
    expect(existsSync(context.started.worktreePath)).toBe(true);
  });
});

describe("task:cleanup approval and ordered non-force removal", () => {
  it("removes only the approved task in order and writes a CLEANED tombstone", async () => {
    const context = mergeReady();
    const service = serviceFor(context);
    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });

    const result = await service.cleanupTask({
      repoPath: context.base,
      branch: context.started.branch,
      approval: report.fingerprint,
      now: "2026-07-21T07:05:00.000Z",
    });

    expect(result.status).toBe("CLEANED");
    expect(result.steps).toEqual([
      "TASK_ARTIFACTS_REMOVED",
      "WORKTREE_REMOVED",
      "WORKTREE_ABSENCE_VERIFIED",
      "LOCAL_BRANCH_REMOVED",
      "REMOTE_BRANCH_ABSENCE_VERIFIED",
      "CLEANED_TOMBSTONE_WRITTEN",
    ]);
    expect(existsSync(context.started.worktreePath)).toBe(false);
    expect(git(context.base, ["branch", "--list", context.started.branch])).toBe("");
    const tombstone = JSON.parse(readFileSync(context.paths.cleanup, "utf8"));
    expect(tombstone).toMatchObject({ recordType: "CleanupManifest", status: "CLEANED", reportOnly: false });
    expect(tombstone.snapshotFingerprint).toBe(report.fingerprint);
  });

  it("invalidates approval when the snapshot changes before cleanup", async () => {
    const context = mergeReady();
    const service = serviceFor(context);
    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });
    writeFileSync(path.join(context.started.worktreePath, "changed-after-approval.txt"), "changed\n");

    await expect(service.cleanupTask({
      repoPath: context.base,
      branch: context.started.branch,
      approval: report.fingerprint,
      now: "2026-07-21T07:05:00.000Z",
    })).rejects.toThrowError("APPROVAL_INVALIDATED");
    expect(existsSync(context.started.worktreePath)).toBe(true);
    expect(existsSync(context.paths.cleanup)).toBe(false);
  });

  it("journals partial cleanup and safely resumes the same approval", async () => {
    const context = mergeReady();
    let failOnce = true;
    const service = serviceFor(context, {
      afterCleanupStep(step) {
        if (step === "WORKTREE_ABSENCE_VERIFIED" && failOnce) {
          failOnce = false;
          throw new Error("INJECTED_PARTIAL_FAILURE");
        }
      },
    });
    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });

    await expect(service.cleanupTask({
      repoPath: context.base,
      branch: context.started.branch,
      approval: report.fingerprint,
      now: "2026-07-21T07:05:00.000Z",
    })).rejects.toThrowError("CLEANUP_PARTIAL_FAILURE");
    const journal = JSON.parse(readFileSync(context.paths.cleanup, "utf8"));
    expect(journal).toMatchObject({ status: "CLEANING", snapshotFingerprint: report.fingerprint });
    expect(validateCleanupManifest(journal)).toEqual([]);
    expect(git(context.base, ["branch", "--list", context.started.branch])).toContain(context.started.branch);

    const resumed = await service.cleanupTask({
      repoPath: context.base,
      branch: context.started.branch,
      approval: report.fingerprint,
      now: "2026-07-21T07:06:00.000Z",
    });
    expect(resumed.status).toBe("CLEANED");
    expect(validateCleanupManifest(JSON.parse(readFileSync(context.paths.cleanup, "utf8")))).toEqual([]);
  });

  it("resumes after one approved disposable candidate vanished before the aggregate step was journaled", async () => {
    const context = mergeReady();
    mkdirSync(path.join(context.started.worktreePath, "node_modules"), { recursive: true });
    writeFileSync(path.join(context.started.worktreePath, "node_modules", "cache.bin"), "approved\n");
    let failOnce = true;
    const service = serviceFor(context, {
      afterDisposableCandidateRemoved() {
        if (failOnce) {
          failOnce = false;
          throw new Error("INJECTED_CANDIDATE_FAILURE");
        }
      },
    });
    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });

    await expect(service.cleanupTask({ repoPath: context.base, branch: context.started.branch, approval: report.fingerprint, now: "2026-07-21T07:05:00.000Z" }))
      .rejects.toThrowError("CLEANUP_PARTIAL_FAILURE");
    const partial = JSON.parse(readFileSync(context.paths.cleanup, "utf8"));
    expect(partial.completedSteps).toEqual([]);
    expect(partial.disposableCandidates).toHaveLength(2);
    expect(partial.disposableCandidates.filter((candidate) => !existsSync(candidate.path))).toHaveLength(1);

    const resumed = await service.cleanupTask({ repoPath: context.base, branch: context.started.branch, approval: report.fingerprint, now: "2026-07-21T07:06:00.000Z" });
    expect(resumed.status).toBe("CLEANED");
  });

  it("blocks candidate-level recovery when content is added after a partial disposable removal", async () => {
    const context = mergeReady();
    mkdirSync(path.join(context.started.worktreePath, "node_modules"), { recursive: true });
    writeFileSync(path.join(context.started.worktreePath, "node_modules", "cache.bin"), "approved\n");
    let failOnce = true;
    const service = serviceFor(context, {
      afterDisposableCandidateRemoved() {
        if (failOnce) {
          failOnce = false;
          throw new Error("INJECTED_CANDIDATE_FAILURE");
        }
      },
    });
    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });
    await expect(service.cleanupTask({ repoPath: context.base, branch: context.started.branch, approval: report.fingerprint, now: "2026-07-21T07:05:00.000Z" }))
      .rejects.toThrowError("CLEANUP_PARTIAL_FAILURE");
    const partial = JSON.parse(readFileSync(context.paths.cleanup, "utf8"));
    const vanished = partial.disposableCandidates.find((candidate) => !existsSync(candidate.path));
    mkdirSync(vanished.path, { recursive: true });
    writeFileSync(path.join(vanished.path, "new-after-approval.txt"), "new\n");

    await expect(service.cleanupTask({ repoPath: context.base, branch: context.started.branch, approval: report.fingerprint, now: "2026-07-21T07:06:00.000Z" }))
      .rejects.toThrowError("CLEANUP_RECOVERY_BLOCKED");
    expect(existsSync(context.started.worktreePath)).toBe(true);
  });

  it("reports CLEANED from a valid tombstone even if the task-record follow-up write does not happen", async () => {
    const context = mergeReady();
    const service = serviceFor(context, {
      afterCleanupStep(step) {
        if (step === "CLEANED_TOMBSTONE_WRITTEN") throw new Error("INJECTED_TASK_RECORD_WRITE_GAP");
      },
    });
    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });
    await expect(service.cleanupTask({ repoPath: context.base, branch: context.started.branch, approval: report.fingerprint, now: "2026-07-21T07:05:00.000Z" }))
      .rejects.toThrowError("CLEANUP_PARTIAL_FAILURE");

    const status = readTaskStatus({ repoPath: context.base, branch: context.started.branch });
    expect(status.task).toMatchObject({ state: "CLEANED", activeActor: null, pendingActor: null });
    expect(status.cleanupManifest).toMatchObject({ status: "CLEANED", snapshotFingerprint: report.fingerprint });

    const forged = { ...status.cleanupManifest, taskRevision: status.cleanupManifest.taskRevision + 1 };
    writeFileSync(context.paths.cleanup, `${JSON.stringify(forged, null, 2)}\n`);
    expect(readTaskStatus({ repoPath: context.base, branch: context.started.branch }).task.state).toBe("ACTIVE");
  });

  it.each(["runtime restarted", "task revision changed", "PR evidence changed", "origin/main changed"])(
    "blocks partial recovery when %s",
    async (change) => {
      const context = mergeReady();
      let failOnce = true;
      const service = serviceFor(context, {
        afterCleanupStep(step) {
          if (step === "TASK_ARTIFACTS_REMOVED" && failOnce) {
            failOnce = false;
            throw new Error("INJECTED_PARTIAL_FAILURE");
          }
        },
      });
      const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });
      await expect(service.cleanupTask({ repoPath: context.base, branch: context.started.branch, approval: report.fingerprint, now: "2026-07-21T07:05:00.000Z" }))
        .rejects.toThrowError("CLEANUP_PARTIAL_FAILURE");

      if (change === "runtime restarted") {
        registerTaskRuntime({ repoPath: context.base, branch: context.started.branch, ports: [], pids: [process.pid], lockPaths: [], now: "2026-07-21T07:05:30.000Z" });
      } else if (change === "task revision changed") {
        const task = JSON.parse(readFileSync(context.paths.task, "utf8"));
        task.revision += 1;
        task.updatedAt = "2026-07-21T07:05:30.000Z";
        writeFileSync(context.paths.task, `${JSON.stringify(task, null, 2)}\n`);
      } else if (change === "PR evidence changed") {
        context.evidence.number += 1;
      } else {
        writeFileSync(path.join(context.seed, "later-main.txt"), "later\n");
        git(context.seed, ["add", "later-main.txt"]);
        git(context.seed, ["commit", "-m", "advance main after approval"]);
        git(context.seed, ["push", "origin", "main"]);
      }

      await expect(service.cleanupTask({ repoPath: context.base, branch: context.started.branch, approval: report.fingerprint, now: "2026-07-21T07:06:00.000Z" }))
        .rejects.toThrowError(/APPROVAL_INVALIDATED|CLEANUP_RECOVERY_BLOCKED/);
      expect(git(context.base, ["branch", "--list", context.started.branch])).toContain(context.started.branch);
      expect(JSON.parse(readFileSync(context.paths.cleanup, "utf8")).status).toBe("CLEANING");
    },
  );

  it("blocks a forged all-steps journal when the worktree and branch still exist", async () => {
    const context = mergeReady();
    let failOnce = true;
    const service = serviceFor(context, {
      afterCleanupStep(step) {
        if (step === "TASK_ARTIFACTS_REMOVED" && failOnce) {
          failOnce = false;
          throw new Error("INJECTED_PARTIAL_FAILURE");
        }
      },
    });
    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });
    await expect(service.cleanupTask({ repoPath: context.base, branch: context.started.branch, approval: report.fingerprint, now: "2026-07-21T07:05:00.000Z" }))
      .rejects.toThrowError("CLEANUP_PARTIAL_FAILURE");
    const journal = JSON.parse(readFileSync(context.paths.cleanup, "utf8"));
    journal.completedSteps = [
      "TASK_ARTIFACTS_REMOVED", "WORKTREE_REMOVED", "WORKTREE_ABSENCE_VERIFIED",
      "LOCAL_BRANCH_REMOVED", "REMOTE_BRANCH_ABSENCE_VERIFIED",
    ];
    writeFileSync(context.paths.cleanup, `${JSON.stringify(journal, null, 2)}\n`);

    await expect(service.cleanupTask({ repoPath: context.base, branch: context.started.branch, approval: report.fingerprint, now: "2026-07-21T07:06:00.000Z" }))
      .rejects.toThrowError("CLEANUP_RECOVERY_BLOCKED");
    expect(existsSync(context.started.worktreePath)).toBe(true);
    expect(git(context.base, ["branch", "--list", context.started.branch])).toContain(context.started.branch);
  });

  it("preserves external files when the task artifact path is a junction or symlink", async () => {
    const context = mergeReady();
    rmSync(context.paths.temp, { recursive: true, force: true });
    const external = tempRoot("talkpik-external-artifacts-");
    writeFileSync(path.join(external, "keep.txt"), "keep\n");
    symlinkSync(external, context.paths.temp, process.platform === "win32" ? "junction" : "dir");
    const service = serviceFor(context);
    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });

    expect(report.blockers).toContain("TASK_ARTIFACT_PATH_ESCAPE");
    expect(readFileSync(path.join(external, "keep.txt"), "utf8")).toBe("keep\n");
  });
});

describe("production adapters", () => {
  it("exports production finalize and cleanup functions", () => {
    expect(finalizeTask).toBeTypeOf("function");
    expect(cleanupTask).toBeTypeOf("function");
  });

  it("rejects unknown cleanup manifest fields", () => {
    expect(validateCleanupManifest({
      schemaVersion: 2,
      recordType: "CleanupManifest",
      taskId: "chore-cleanup-sample",
      status: "CLEANED",
      reportOnly: false,
      snapshotFingerprint: "a".repeat(64),
      candidates: [],
      completedSteps: [],
      branch: "chore/cleanup-sample",
      worktreePath: "C:/repo/.worktrees/chore-cleanup-sample",
      headSha: "b".repeat(40),
      createdAt: NOW,
      updatedAt: NOW,
      cleanedAt: NOW,
      token: "unsafe",
    }).map((error) => error.code)).toEqual(expect.arrayContaining(["UNKNOWN_FIELD", "SECRET_OR_THREAD_FIELD"]));
  });

  it.each([
    ["skipped", ["TASK_ARTIFACTS_REMOVED", "WORKTREE_ABSENCE_VERIFIED"]],
    ["duplicate", ["TASK_ARTIFACTS_REMOVED", "TASK_ARTIFACTS_REMOVED"]],
    ["out of order", ["WORKTREE_REMOVED"]],
  ])("rejects a %s cleanup step sequence", (_label, completedSteps) => {
    const record = {
      schemaVersion: 2,
      recordType: "CleanupManifest",
      taskId: "chore-cleanup-sample",
      status: "CLEANING",
      reportOnly: false,
      snapshotFingerprint: "a".repeat(64),
      candidates: [],
      completedSteps,
      branch: "chore/cleanup-sample",
      worktreePath: "C:/repo/.worktrees/chore-cleanup-sample",
      headSha: "b".repeat(40),
      inventoryDigest: "c".repeat(64),
      taskRevision: 1,
      taskState: "ACTIVE",
      runtimeDigest: "d".repeat(64),
      prNumber: 1,
      prState: "MERGED",
      prBaseRefName: "main",
      prHeadRefName: "chore/cleanup-sample",
      mergeCommitOid: "e".repeat(40),
      mergedAt: NOW,
      originMainSha: "f".repeat(40),
      remoteState: "absent",
      createdAt: NOW,
      updatedAt: NOW,
      cleanedAt: null,
    };
    expect(validateCleanupManifest(record).map((error) => error.code)).toContain("INVALID_COMPLETED_STEPS");
  });

  it("publishes finalize, cleanup, and runtime package commands", () => {
    const packageJson = JSON.parse(readFileSync(path.resolve("package.json"), "utf8"));
    expect(packageJson.scripts).toMatchObject({
      "task:finalize": "node scripts/ai-task.mjs finalize",
      "task:cleanup": "node scripts/ai-task.mjs cleanup",
      "task:runtime": "node scripts/ai-task.mjs runtime",
    });
  });
});
