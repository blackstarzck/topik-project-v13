import {
  cpSync,
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

import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import {
  cleanupTask,
  createTaskCleanupService,
  finalizeTask,
  registerTaskRuntime,
} from "../../scripts/lib/ai-task-cleanup.mjs";
import { readTaskStatus, startTask, validateCleanupManifest } from "../../scripts/lib/ai-task-lifecycle-v2.mjs";

const NOW = "2026-07-21T07:00:00.000Z";
const tempRoots = [];
let mergedTemplate = null;

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
    ".codex/\nnode_modules/\n.next/\nbuild/\ndist/\nout/\ncoverage/\n.cache/\n.env.local\ntsconfig.tsbuildinfo\n",
  );
  writeFileSync(path.join(seed, "README.md"), "baseline\n");
  mkdirSync(path.join(seed, ".codex", "skills"), { recursive: true });
  writeFileSync(path.join(seed, ".codex", "skills", "contract.md"), "tracked contract\n");
  git(seed, ["add", ".gitignore", "README.md"]);
  git(seed, ["add", "-f", ".codex/skills/contract.md"]);
  git(seed, ["commit", "-m", "baseline"]);
  git(seed, ["remote", "add", "origin", remote]);
  git(seed, ["push", "-u", "origin", "main"]);
  execFileSync("git", [
    "clone",
    "--config", "user.email=test@example.com",
    "--config", "user.name=Cleanup Test",
    "--branch", "main",
    remote,
    base,
  ]);
  return { root, remote, seed, base };
}

function taskPaths(started) {
  const v2 = path.join(started.gitCommonDir, "talkpik-task-lifecycle", "v2");
  return {
    v2,
    task: path.join(v2, "tasks", `${started.taskId}.json`),
    operationLock: path.join(v2, "tasks", `${started.taskId}.lock`),
    runtime: path.join(v2, "runtimes", `${started.taskId}.json`),
    cleanup: path.join(v2, "cleanups", `${started.taskId}.json`),
    temp: path.join(started.worktreePath, ".codex", "work", started.slug),
  };
}

function writeCleaningJournal(context, report, overrides = {}) {
  const task = JSON.parse(readFileSync(context.paths.task, "utf8"));
  const journal = {
    schemaVersion: 2,
    recordType: "CleanupManifest",
    taskId: task.taskId,
    status: "CLEANING",
    reportOnly: false,
    snapshotFingerprint: report.fingerprint,
    candidates: report.candidates,
    completedSteps: [],
    branch: task.branch,
    worktreePath: task.worktreePath,
    headSha: report.prEvidence.headRefOid,
    inventoryDigest: report.disposableInventoryDigest,
    disposableCandidates: report.disposableCandidates,
    candidateProgress: [],
    createdAt: "2026-07-21T07:05:00.000Z",
    updatedAt: "2026-07-21T07:05:00.000Z",
    cleanedAt: null,
    ...report.recoveryContext,
    ...overrides,
  };
  expect(validateCleanupManifest(journal)).toEqual([]);
  mkdirSync(path.dirname(context.paths.cleanup), { recursive: true });
  writeFileSync(context.paths.cleanup, `${JSON.stringify(journal, null, 2)}\n`);
  return journal;
}

function writeCleanupOperationLock(context, approval, overrides = {}) {
  const record = {
    taskId: context.started.taskId,
    operation: "cleanup",
    pid: 999_999_991,
    nonce: "12345678-1234-4123-8123-123456789abc",
    approvalFingerprint: approval,
    createdAt: "2026-07-21T07:05:00.000Z",
    ...overrides,
  };
  writeFileSync(context.paths.operationLock, `${JSON.stringify(record)}\n`, { flag: "wx" });
  return record;
}

function slowMergeReady({ keepRemoteBranch = false, runtime = {}, squash = false } = {}) {
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

function getMergedTemplate() {
  if (mergedTemplate) return mergedTemplate;
  const root = mkdtempSync(path.join(tmpdir(), "talkpik-cleanup-template-"));
  const remote = path.join(root, "remote.git");
  const seed = path.join(root, "seed");
  const base = path.join(root, "base");
  execFileSync("git", ["init", "--bare", remote]);
  execFileSync("git", ["init", "-b", "main", seed]);
  git(seed, ["config", "user.email", "test@example.com"]);
  git(seed, ["config", "user.name", "Cleanup Template"]);
  writeFileSync(
    path.join(seed, ".gitignore"),
    ".codex/\nnode_modules/\n.next/\nbuild/\ndist/\nout/\ncoverage/\n.cache/\n.env.local\ntsconfig.tsbuildinfo\n",
  );
  writeFileSync(path.join(seed, "README.md"), "baseline\n");
  mkdirSync(path.join(seed, ".codex", "skills"), { recursive: true });
  writeFileSync(path.join(seed, ".codex", "skills", "contract.md"), "tracked contract\n");
  git(seed, ["add", ".gitignore", "README.md"]);
  git(seed, ["add", "-f", ".codex/skills/contract.md"]);
  git(seed, ["commit", "-m", "baseline"]);
  git(seed, ["checkout", "-b", "chore/cleanup-sample"]);
  writeFileSync(path.join(seed, "change.txt"), "published change\n");
  git(seed, ["add", "change.txt"]);
  git(seed, ["commit", "-m", "published change"]);
  const headSha = git(seed, ["rev-parse", "HEAD"]);
  git(seed, ["checkout", "main"]);
  git(seed, ["merge", "--no-ff", "chore/cleanup-sample", "-m", "merge task"]);
  const mergeCommitOid = git(seed, ["rev-parse", "HEAD"]);
  git(seed, ["remote", "add", "origin", remote]);
  git(seed, ["push", "-u", "origin", "main"]);
  execFileSync("git", [
    "clone",
    "--config",
    "user.email=test@example.com",
    "--config",
    "user.name=Cleanup Test",
    "--branch",
    "main",
    remote,
    base,
  ]);
  mergedTemplate = { root, remote, base, headSha, mergeCommitOid };
  return mergedTemplate;
}

function cloneMergedTemplate() {
  const template = getMergedTemplate();
  const root = tempRoot();
  const remote = path.join(root, "remote.git");
  const base = path.join(root, "base");
  cpSync(template.remote, remote, { recursive: true, errorOnExist: true });
  cpSync(template.base, base, { recursive: true, errorOnExist: true });
  git(base, ["remote", "set-url", "origin", remote]);
  return { root, remote, seed: base, base, headSha: template.headSha, mergeCommitOid: template.mergeCommitOid };
}

function mergeReady({ keepRemoteBranch = false, runtime = {}, squash = false } = {}) {
  if (squash) return slowMergeReady({ keepRemoteBranch, runtime, squash });
  const repository = cloneMergedTemplate();
  const started = startTask({
    repoPath: repository.base,
    branch: "chore/cleanup-sample",
    actor: "codex",
    now: NOW,
  });
  git(started.worktreePath, ["reset", "--hard", repository.headSha]);
  if (keepRemoteBranch) git(started.worktreePath, ["push", "-u", "origin", started.branch]);
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
    headRefOid: repository.headSha,
    mergeCommitOid: repository.mergeCommitOid,
    mergedAt: "2026-07-21T06:59:00.000Z",
  };
  return { ...repository, started, paths, evidence };
}

function serviceFor(context, overrides = {}) {
  return createTaskCleanupService({
    readPrEvidence: async () => structuredClone(context.evidence),
    isPidActive: () => false,
    isPortActive: async () => false,
    ...overrides,
  });
}

function validCleaningManifest(overrides = {}) {
  const first = { path: path.resolve("candidate-a"), digest: "1".repeat(64) };
  const second = { path: path.resolve("candidate-b"), digest: "2".repeat(64) };
  return {
    schemaVersion: 2,
    recordType: "CleanupManifest",
    taskId: "chore-cleanup-sample",
    status: "CLEANING",
    reportOnly: false,
    snapshotFingerprint: "a".repeat(64),
    candidates: [],
    completedSteps: [],
    branch: "chore/cleanup-sample",
    worktreePath: path.resolve("worktree"),
    headSha: "b".repeat(40),
    inventoryDigest: "c".repeat(64),
    disposableCandidates: [first, second],
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
    ...overrides,
  };
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

afterAll(() => {
  if (mergedTemplate) rmSync(mergedTemplate.root, { recursive: true, force: true });
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
  it("accepts GitHub's second-precision merge timestamp and stores the canonical instant", async () => {
    const context = mergeReady();
    context.evidence.mergedAt = "2026-07-21T06:59:00Z";

    const report = await serviceFor(context).finalizeTask({
      repoPath: context.started.worktreePath,
      branch: context.started.branch,
    });

    expect(report.blockers).toEqual([]);
    expect(report.ready).toBe(true);
    expect(report.prEvidence.mergedAt).toBe("2026-07-21T06:59:00.000Z");
    expect(report.recoveryContext.mergedAt).toBe("2026-07-21T06:59:00.000Z");

    context.evidence.mergedAt = "2026-02-30T06:59:00Z";
    const invalid = await serviceFor(context).finalizeTask({
      repoPath: context.started.worktreePath,
      branch: context.started.branch,
    });
    expect(invalid.blockers).toContain("PR_EVIDENCE_AMBIGUOUS");
  });

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
    expect(report.timings).toEqual({
      gitAndFetchMs: expect.any(Number),
      worktreeMs: expect.any(Number),
      inventoryMs: expect.any(Number),
      runtimeMs: expect.any(Number),
      prEvidenceMs: expect.any(Number),
      remoteMs: expect.any(Number),
      totalMs: expect.any(Number),
    });
    expect(Object.values(report.timings).every((duration) => duration >= 0)).toBe(true);
    expect(existsSync(context.started.worktreePath)).toBe(true);
    expect(git(context.base, ["branch", "--list", context.started.branch])).toContain(context.started.branch);
    expect(readFileSync(context.paths.task, "utf8")).toBe(taskBefore);
    expect(readFileSync(context.paths.runtime, "utf8")).toBe(runtimeBefore);
    expect(existsSync(context.paths.cleanup)).toBe(false);
  });

  it("fingerprints exact disposable root identity without invalidating content changes", async () => {
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
    writeFileSync(path.join(context.started.worktreePath, "node_modules", "sample", "index.js"), "second\n");
    const result = await service.cleanupTask({
      repoPath: context.base,
      branch: context.started.branch,
      approval: report.fingerprint,
      now: "2026-07-21T07:05:00.000Z",
    });
    expect(result.status).toBe("CLEANED");
    expect(result.timings).toEqual({
      lockMs: expect.any(Number),
      revalidationMs: expect.any(Number),
      artifactsMs: expect.any(Number),
      worktreeMs: expect.any(Number),
      branchMs: expect.any(Number),
      remoteMs: expect.any(Number),
      totalMs: expect.any(Number),
    });
    expect(Object.values(result.timings).every((duration) => duration >= 0)).toBe(true);
  });

  it("invalidates approval when an approved disposable root is replaced", async () => {
    const context = mergeReady();
    const candidate = path.join(context.started.worktreePath, "node_modules");
    mkdirSync(candidate, { recursive: true });
    const service = serviceFor(context);
    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });

    rmSync(candidate, { recursive: true, force: false });
    mkdirSync(candidate);

    await expect(service.cleanupTask({
      repoPath: context.base,
      branch: context.started.branch,
      approval: report.fingerprint,
      now: "2026-07-21T07:05:00.000Z",
    })).rejects.toThrowError("APPROVAL_INVALIDATED");
    expect(existsSync(context.started.worktreePath)).toBe(true);
  });

  it("treats the exact tsconfig build info file as disposable", async () => {
    const context = mergeReady();
    const buildInfo = path.join(context.started.worktreePath, "tsconfig.tsbuildinfo");
    writeFileSync(buildInfo, "compiler cache\n");

    const report = await serviceFor(context).finalizeTask({ repoPath: context.base, branch: context.started.branch });

    expect(report.ready).toBe(true);
    expect(report.candidates).toContain(`disposable:${buildInfo}`);
  });

  it("blocks a directory at the exact tsconfig build info path", async () => {
    const context = mergeReady();
    const buildInfo = path.join(context.started.worktreePath, "tsconfig.tsbuildinfo");
    mkdirSync(buildInfo);

    const report = await serviceFor(context).finalizeTask({ repoPath: context.base, branch: context.started.branch });

    expect(report.blockers).toContain("TASK_ARTIFACT_PATH_ESCAPE");
    expect(report.disposableCandidates).not.toContainEqual(expect.objectContaining({ path: buildInfo }));
    expect(existsSync(buildInfo)).toBe(true);
  });

  it("blocks a file symlink at the exact tsconfig build info path", async () => {
    const context = mergeReady();
    const buildInfo = path.join(context.started.worktreePath, "tsconfig.tsbuildinfo");
    const externalRoot = tempRoot("talkpik-external-build-info-");
    const externalFile = path.join(externalRoot, "keep.tsbuildinfo");
    writeFileSync(externalFile, "keep\n");
    symlinkSync(externalFile, buildInfo, "file");

    const report = await serviceFor(context).finalizeTask({ repoPath: context.base, branch: context.started.branch });

    expect(report.blockers).toContain("TASK_ARTIFACT_PATH_ESCAPE");
    expect(report.disposableCandidates).not.toContainEqual(expect.objectContaining({ path: buildInfo }));
    expect(readFileSync(externalFile, "utf8")).toBe("keep\n");
  });

  it("blocks a junction at the exact tsconfig build info path", async () => {
    const context = mergeReady();
    const buildInfo = path.join(context.started.worktreePath, "tsconfig.tsbuildinfo");
    const externalRoot = tempRoot("talkpik-external-build-info-junction-");
    writeFileSync(path.join(externalRoot, "keep.txt"), "keep\n");
    symlinkSync(externalRoot, buildInfo, process.platform === "win32" ? "junction" : "dir");

    const report = await serviceFor(context).finalizeTask({ repoPath: context.base, branch: context.started.branch });

    expect(report.blockers).toContain("TASK_ARTIFACT_PATH_ESCAPE");
    expect(report.disposableCandidates).not.toContainEqual(expect.objectContaining({ path: buildInfo }));
    expect(readFileSync(path.join(externalRoot, "keep.txt"), "utf8")).toBe("keep\n");
  });

  it("blocks a directory symlink reparse point at the exact tsconfig build info path", async () => {
    const context = mergeReady();
    const buildInfo = path.join(context.started.worktreePath, "tsconfig.tsbuildinfo");
    const externalRoot = tempRoot("talkpik-external-build-info-reparse-");
    writeFileSync(path.join(externalRoot, "keep.txt"), "keep\n");
    symlinkSync(externalRoot, buildInfo, "dir");

    const report = await serviceFor(context).finalizeTask({ repoPath: context.base, branch: context.started.branch });

    expect(report.blockers).toContain("TASK_ARTIFACT_PATH_ESCAPE");
    expect(report.disposableCandidates).not.toContainEqual(expect.objectContaining({ path: buildInfo }));
    expect(readFileSync(path.join(externalRoot, "keep.txt"), "utf8")).toBe("keep\n");
  });

  it("uses root-only inventory and directory-collapsed ignored discovery", () => {
    const source = readFileSync(path.resolve("scripts/lib/ai-task-cleanup.mjs"), "utf8");
    const rootInspectionBody = source.slice(
      source.indexOf("function disposableCandidateFromStats"),
      source.indexOf("function candidateClaimRoot"),
    );
    const inventoryBody = source.slice(
      source.indexOf("function inspectDisposableInventory"),
      source.indexOf("function ownsAllIgnoredCodexWork"),
    );
    const ignoredBody = source.slice(
      source.indexOf("function ignoredContentBlocker"),
      source.indexOf("function defaultPidActive"),
    );

    expect(inventoryBody).not.toMatch(/readdirSync|readFileSync|readlinkSync|while\s*\(/u);
    expect(inventoryBody).toContain("inspectDisposableRoot(task, root)");
    expect(rootInspectionBody).not.toMatch(/readdirSync|readFileSync|readlinkSync|while\s*\(/u);
    expect(rootInspectionBody).toContain("lstatSync(root, { bigint: true })");
    expect(rootInspectionBody).toContain("disposableCandidateFromStats(task, root, stats)");
    expect(ignoredBody).toContain('"--directory"');
  });

  it("applies a hard timeout only to finalize network commands and maps timeouts to blockers", async () => {
    const context = mergeReady();
    git(context.base, ["remote", "set-url", "origin", "https://github.com/example/example.git"]);
    const calls = [];
    const networkCommandRunner = (command, args, options) => {
      calls.push({ command, args, options });
      return { status: null, stdout: "", stderr: "timed out", error: { code: "ETIMEDOUT" } };
    };
    const service = createTaskCleanupService({
      networkCommandRunner,
      isPidActive: () => false,
      isPortActive: async () => false,
    });

    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });

    expect(report.blockers).toEqual(expect.arrayContaining([
      "ORIGIN_FETCH_FAILED",
      "PR_EVIDENCE_UNAVAILABLE",
      "REMOTE_BRANCH_EVIDENCE_UNAVAILABLE",
    ]));
    expect(calls.some((call) => call.command === "git" && call.args.includes("fetch"))).toBe(true);
    expect(calls.some((call) => call.command === "git" && call.args.includes("ls-remote"))).toBe(true);
    expect(calls.some((call) => call.command === "gh" && call.args.includes("view"))).toBe(true);
    expect(calls.every((call) => call.options.timeout === 30_000)).toBe(true);
  });

  it("blocks ignored sibling task work instead of deleting another owner's files", async () => {
    const context = mergeReady();
    const sibling = path.join(context.started.worktreePath, ".codex", "work", "other-task");
    mkdirSync(sibling, { recursive: true });
    writeFileSync(path.join(sibling, "keep.log"), "other owner\n");

    const report = await serviceFor(context).finalizeTask({ repoPath: context.base, branch: context.started.branch });

    expect(report.blockers).toContain("WORKTREE_IGNORED_CONTENT");
    expect(readFileSync(path.join(sibling, "keep.log"), "utf8")).toBe("other owner\n");
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
  it("recovers an inactive exact cleanup PID only with a matching CLEANING journal and approval", async () => {
    const context = mergeReady();
    const observedPids = [];
    const service = serviceFor(context, {
      isPidActive(pid) {
        observedPids.push(pid);
        return false;
      },
    });
    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });
    writeCleaningJournal(context, report);
    const stale = writeCleanupOperationLock(context, report.fingerprint);

    const result = await service.cleanupTask({
      repoPath: context.base,
      branch: context.started.branch,
      approval: report.fingerprint,
      now: "2026-07-21T07:06:00.000Z",
    });

    expect(observedPids).toContain(stale.pid);
    expect(result.status).toBe("CLEANED");
    expect(existsSync(context.paths.operationLock)).toBe(false);
  });

  it.each([
    ["taskId", { taskId: "chore-other-task" }],
    ["branch", { branch: "chore/other-task", prHeadRefName: "chore/other-task" }],
    ["worktreePath", { worktreePath: path.resolve("other-worktree") }],
  ])("preserves a stale cleanup lock when the CLEANING journal %s belongs to another task", async (_field, journalOverrides) => {
    const context = mergeReady();
    const service = serviceFor(context, { isPidActive: () => false });
    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });
    writeCleaningJournal(context, report, journalOverrides);
    writeCleanupOperationLock(context, report.fingerprint);
    const originalLock = readFileSync(context.paths.operationLock, "utf8");

    await expect(service.cleanupTask({
      repoPath: context.base,
      branch: context.started.branch,
      approval: report.fingerprint,
      now: "2026-07-21T07:06:00.000Z",
    })).rejects.toThrowError("TASK_OPERATION_IN_PROGRESS");

    expect(readFileSync(context.paths.operationLock, "utf8")).toBe(originalLock);
    expect(existsSync(context.started.worktreePath)).toBe(true);
  });

  it("preserves a stale cleanup lock when the task record and journal claim a non-owned worktree path", async () => {
    const context = mergeReady();
    const service = serviceFor(context, { isPidActive: () => false });
    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });
    const task = JSON.parse(readFileSync(context.paths.task, "utf8"));
    task.worktreePath = context.base;
    writeFileSync(context.paths.task, `${JSON.stringify(task, null, 2)}\n`);
    writeCleaningJournal(context, report);
    writeCleanupOperationLock(context, report.fingerprint);
    const originalLock = readFileSync(context.paths.operationLock, "utf8");

    await expect(service.cleanupTask({
      repoPath: context.base,
      branch: context.started.branch,
      approval: report.fingerprint,
      now: "2026-07-21T07:06:00.000Z",
    })).rejects.toThrowError("TASK_OPERATION_IN_PROGRESS");

    expect(readFileSync(context.paths.operationLock, "utf8")).toBe(originalLock);
    expect(existsSync(context.started.worktreePath)).toBe(true);
  });

  it.each(["revision", "state"])(
    "preserves a stale cleanup lock when the current task %s no longer matches the CLEANING journal",
    async (changedField) => {
      const context = mergeReady();
      const service = serviceFor(context, { isPidActive: () => false });
      const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });
      writeCleaningJournal(context, report);
      writeCleanupOperationLock(context, report.fingerprint);
      const originalLock = readFileSync(context.paths.operationLock, "utf8");
      const task = JSON.parse(readFileSync(context.paths.task, "utf8"));
      if (changedField === "revision") {
        task.revision += 1;
      } else {
        task.state = "CLEANED";
        task.activeActor = null;
      }
      task.updatedAt = "2026-07-21T07:05:30.000Z";
      writeFileSync(context.paths.task, `${JSON.stringify(task, null, 2)}\n`);

      await expect(service.cleanupTask({
        repoPath: context.base,
        branch: context.started.branch,
        approval: report.fingerprint,
        now: "2026-07-21T07:06:00.000Z",
      })).rejects.toThrowError("TASK_OPERATION_IN_PROGRESS");

      expect(readFileSync(context.paths.operationLock, "utf8")).toBe(originalLock);
    },
  );

  it.each(["locked", "prunable"])("preserves a stale cleanup lock for a %s worktree", async (condition) => {
    const context = mergeReady();
    const service = serviceFor(context, { isPidActive: () => false });
    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });
    writeCleaningJournal(context, report);
    writeCleanupOperationLock(context, report.fingerprint);
    const originalLock = readFileSync(context.paths.operationLock, "utf8");
    if (condition === "locked") git(context.base, ["worktree", "lock", context.started.worktreePath]);
    else rmSync(path.join(context.started.worktreePath, ".git"));

    await expect(service.cleanupTask({ repoPath: context.base, branch: context.started.branch, approval: report.fingerprint, now: "2026-07-21T07:06:00.000Z" }))
      .rejects.toThrowError("TASK_OPERATION_IN_PROGRESS");
    expect(readFileSync(context.paths.operationLock, "utf8")).toBe(originalLock);
  });

  it.each(["deleted", "replaced"])("preserves a stale cleanup lock when the local branch ref is %s", async (condition) => {
    const context = mergeReady();
    const service = serviceFor(context, { isPidActive: () => false });
    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });
    writeCleaningJournal(context, report);
    writeCleanupOperationLock(context, report.fingerprint);
    const originalLock = readFileSync(context.paths.operationLock, "utf8");
    const ref = `refs/heads/${context.started.branch}`;
    if (condition === "deleted") git(context.base, ["update-ref", "-d", ref]);
    else git(context.base, ["update-ref", ref, git(context.base, ["rev-parse", "origin/main"])]);

    await expect(service.cleanupTask({ repoPath: context.base, branch: context.started.branch, approval: report.fingerprint, now: "2026-07-21T07:06:00.000Z" }))
      .rejects.toThrowError("TASK_OPERATION_IN_PROGRESS");
    expect(readFileSync(context.paths.operationLock, "utf8")).toBe(originalLock);
  });

  it("preserves a stale cleanup lock when a removed local branch is recreated", async () => {
    const context = mergeReady();
    let failOnce = true;
    const service = serviceFor(context, {
      isPidActive: () => false,
      afterCleanupStep(step) {
        if (step === "LOCAL_BRANCH_REMOVED" && failOnce) {
          failOnce = false;
          throw new Error("INJECTED_PARTIAL_FAILURE");
        }
      },
    });
    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });
    await expect(service.cleanupTask({ repoPath: context.base, branch: context.started.branch, approval: report.fingerprint, now: "2026-07-21T07:05:00.000Z" }))
      .rejects.toThrowError("CLEANUP_PARTIAL_FAILURE");
    git(context.base, ["branch", context.started.branch, report.prEvidence.headRefOid]);
    writeCleanupOperationLock(context, report.fingerprint);
    const originalLock = readFileSync(context.paths.operationLock, "utf8");

    await expect(service.cleanupTask({ repoPath: context.base, branch: context.started.branch, approval: report.fingerprint, now: "2026-07-21T07:06:00.000Z" }))
      .rejects.toThrowError("TASK_OPERATION_IN_PROGRESS");
    expect(readFileSync(context.paths.operationLock, "utf8")).toBe(originalLock);
  });

  it("recovers a stale cleanup lock after the journaled worktree removal is verified absent", async () => {
    const context = mergeReady();
    let failOnce = true;
    const service = serviceFor(context, {
      isPidActive: () => false,
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
    const partial = JSON.parse(readFileSync(context.paths.cleanup, "utf8"));
    expect(partial.completedSteps).toContain("WORKTREE_REMOVED");
    expect(existsSync(context.started.worktreePath)).toBe(false);
    writeCleanupOperationLock(context, report.fingerprint);

    const resumed = await service.cleanupTask({
      repoPath: context.base,
      branch: context.started.branch,
      approval: report.fingerprint,
      now: "2026-07-21T07:06:00.000Z",
    });

    expect(resumed.status).toBe("CLEANED");
    expect(existsSync(context.paths.operationLock)).toBe(false);
  });

  it("preserves a new live lock created after the stale lock is atomically claimed", async () => {
    const context = mergeReady();
    let claimedPath = null;
    const service = serviceFor(context, {
      isPidActive: (pid) => pid === process.pid,
      afterStaleCleanupLockClaimed(claimPath) {
        claimedPath = claimPath;
        writeCleanupOperationLock(context, report.fingerprint, {
          pid: process.pid,
          nonce: "22345678-1234-4123-8123-123456789abc",
        });
      },
    });
    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });
    writeCleaningJournal(context, report);
    writeCleanupOperationLock(context, report.fingerprint);

    await expect(service.cleanupTask({
      repoPath: context.base,
      branch: context.started.branch,
      approval: report.fingerprint,
      now: "2026-07-21T07:06:00.000Z",
    })).rejects.toThrowError("TASK_OPERATION_IN_PROGRESS");

    expect(JSON.parse(readFileSync(context.paths.operationLock, "utf8")).pid).toBe(process.pid);
    expect(claimedPath).not.toBeNull();
    expect(existsSync(claimedPath)).toBe(true);
  });

  it("preserves a changed stale-lock claim when restoring it is not safe", async () => {
    const context = mergeReady();
    let claimedPath = null;
    const service = serviceFor(context, {
      isPidActive: () => false,
      afterStaleCleanupLockClaimed(claimPath) {
        claimedPath = claimPath;
        rmSync(claimPath);
        writeFileSync(claimPath, "changed-claim\n", { flag: "wx" });
      },
    });
    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });
    writeCleaningJournal(context, report);
    writeCleanupOperationLock(context, report.fingerprint);

    await expect(service.cleanupTask({
      repoPath: context.base,
      branch: context.started.branch,
      approval: report.fingerprint,
      now: "2026-07-21T07:06:00.000Z",
    })).rejects.toThrowError("TASK_OPERATION_IN_PROGRESS");

    expect(existsSync(context.paths.operationLock)).toBe(false);
    expect(readFileSync(claimedPath, "utf8")).toBe("changed-claim\n");
  });

  it("preserves a new live lock created while the owned operation lock is being released", async () => {
    const context = mergeReady();
    let releaseClaim = null;
    const service = serviceFor(context, {
      afterOwnedOperationLockClaimed(claimPath) {
        releaseClaim = claimPath;
        writeCleanupOperationLock(context, report.fingerprint, {
          pid: process.pid,
          nonce: "32345678-1234-4123-8123-123456789abc",
        });
      },
    });
    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });

    const result = await service.cleanupTask({
      repoPath: context.base,
      branch: context.started.branch,
      approval: report.fingerprint,
      now: "2026-07-21T07:05:00.000Z",
    });

    expect(result.status).toBe("CLEANED");
    expect(JSON.parse(readFileSync(context.paths.operationLock, "utf8")).pid).toBe(process.pid);
    expect(releaseClaim).not.toBeNull();
    expect(existsSync(releaseClaim)).toBe(true);
  });

  it("preserves live, legacy, malformed, mismatched, and pre-journal cleanup locks", async () => {
    const context = mergeReady();
    const observedLivePids = [];
    const service = serviceFor(context, {
      isPidActive(pid) {
        observedLivePids.push(pid);
        return pid === process.pid;
      },
    });
    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });
    writeCleaningJournal(context, report);

    writeCleanupOperationLock(context, report.fingerprint, { pid: process.pid });
    await expect(service.cleanupTask({ repoPath: context.base, branch: context.started.branch, approval: report.fingerprint, now: "2026-07-21T07:06:00.000Z" }))
      .rejects.toThrowError("TASK_OPERATION_IN_PROGRESS");
    expect(existsSync(context.paths.operationLock)).toBe(true);
    expect(observedLivePids).toEqual([process.pid]);

    rmSync(context.paths.operationLock);
    writeCleanupOperationLock(context, report.fingerprint, { operation: "handoff" });
    await expect(service.cleanupTask({ repoPath: context.base, branch: context.started.branch, approval: report.fingerprint, now: "2026-07-21T07:06:00.000Z" }))
      .rejects.toThrowError("TASK_OPERATION_IN_PROGRESS");

    rmSync(context.paths.operationLock);
    writeFileSync(context.paths.operationLock, "legacy-owner\n", { flag: "wx" });
    await expect(service.cleanupTask({ repoPath: context.base, branch: context.started.branch, approval: report.fingerprint, now: "2026-07-21T07:06:00.000Z" }))
      .rejects.toThrowError("TASK_OPERATION_IN_PROGRESS");

    rmSync(context.paths.operationLock);
    writeFileSync(context.paths.operationLock, '{"taskId":', { flag: "wx" });
    await expect(service.cleanupTask({ repoPath: context.base, branch: context.started.branch, approval: report.fingerprint, now: "2026-07-21T07:06:00.000Z" }))
      .rejects.toThrowError("TASK_OPERATION_IN_PROGRESS");

    rmSync(context.paths.operationLock);
    writeCleanupOperationLock(context, "9".repeat(64));
    await expect(service.cleanupTask({ repoPath: context.base, branch: context.started.branch, approval: report.fingerprint, now: "2026-07-21T07:06:00.000Z" }))
      .rejects.toThrowError("TASK_OPERATION_IN_PROGRESS");

    rmSync(context.paths.operationLock);
    rmSync(context.paths.cleanup);
    writeCleanupOperationLock(context, report.fingerprint);
    await expect(service.cleanupTask({ repoPath: context.base, branch: context.started.branch, approval: report.fingerprint, now: "2026-07-21T07:06:00.000Z" }))
      .rejects.toThrowError("TASK_OPERATION_IN_PROGRESS");
    expect(existsSync(context.started.worktreePath)).toBe(true);
    expect(git(context.base, ["branch", "--list", context.started.branch])).toContain(context.started.branch);
  });

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
    expect(partial.candidateProgress).toEqual([]);
    expect(partial.disposableCandidates).toHaveLength(2);
    expect(partial.disposableCandidates.filter((candidate) => !existsSync(candidate.path))).toHaveLength(1);

    const resumed = await service.cleanupTask({ repoPath: context.base, branch: context.started.branch, approval: report.fingerprint, now: "2026-07-21T07:06:00.000Z" });
    expect(resumed.status).toBe("CLEANED");
    expect(resumed.tombstone.candidateProgress).toEqual(
      resumed.tombstone.disposableCandidates.map((candidate) => candidate.path),
    );
  });

  it("atomically journals each removed candidate before attempting the next one", async () => {
    const context = mergeReady();
    mkdirSync(path.join(context.started.worktreePath, "node_modules"));
    let journaled = 0;
    const service = serviceFor(context, {
      afterDisposableCandidateJournaled() {
        journaled += 1;
        if (journaled === 1) throw new Error("INJECTED_AFTER_CANDIDATE_JOURNAL");
      },
    });
    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });

    await expect(service.cleanupTask({
      repoPath: context.base,
      branch: context.started.branch,
      approval: report.fingerprint,
      now: "2026-07-21T07:05:00.000Z",
    })).rejects.toThrowError("CLEANUP_PARTIAL_FAILURE");

    const partial = JSON.parse(readFileSync(context.paths.cleanup, "utf8"));
    expect(partial.candidateProgress).toEqual([partial.disposableCandidates[0].path]);
    expect(existsSync(partial.disposableCandidates[0].path)).toBe(false);
    expect(existsSync(partial.disposableCandidates[1].path)).toBe(true);
  });

  it("removes an empty claim root when cleanup resumes after a post-progress hard crash", async () => {
    const context = mergeReady();
    const claimRoot = path.join(
      path.dirname(context.started.worktreePath),
      ".talkpik-cleanup-claims",
      context.started.taskId,
    );
    let failOnce = true;
    const service = serviceFor(context, {
      afterDisposableCandidateJournaled() {
        if (!failOnce) return;
        failOnce = false;
        throw new Error("INJECTED_POST_PROGRESS_HARD_CRASH");
      },
    });
    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });

    await expect(service.cleanupTask({ repoPath: context.base, branch: context.started.branch, approval: report.fingerprint, now: "2026-07-21T07:05:00.000Z" }))
      .rejects.toThrowError("CLEANUP_PARTIAL_FAILURE");
    expect(existsSync(claimRoot)).toBe(true);

    const resumed = await service.cleanupTask({ repoPath: context.base, branch: context.started.branch, approval: report.fingerprint, now: "2026-07-21T07:06:00.000Z" });
    expect(resumed.status).toBe("CLEANED");
    expect(existsSync(claimRoot)).toBe(false);
  });

  it("preserves a non-empty claim root during resumed cleanup", async () => {
    const context = mergeReady();
    const claimRoot = path.join(path.dirname(context.started.worktreePath), ".talkpik-cleanup-claims", context.started.taskId);
    let failOnce = true;
    const service = serviceFor(context, {
      afterDisposableCandidateJournaled() {
        if (!failOnce) return;
        failOnce = false;
        throw new Error("INJECTED_POST_PROGRESS_HARD_CRASH");
      },
    });
    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });
    await expect(service.cleanupTask({ repoPath: context.base, branch: context.started.branch, approval: report.fingerprint, now: "2026-07-21T07:05:00.000Z" }))
      .rejects.toThrowError("CLEANUP_PARTIAL_FAILURE");
    writeFileSync(path.join(claimRoot, "foreign.claim"), "preserve\n");

    const resumed = await service.cleanupTask({ repoPath: context.base, branch: context.started.branch, approval: report.fingerprint, now: "2026-07-21T07:06:00.000Z" });
    expect(resumed.status).toBe("CLEANED");
    expect(readFileSync(path.join(claimRoot, "foreign.claim"), "utf8")).toBe("preserve\n");
  });

  it("rechecks candidate identity immediately before deletion", async () => {
    const context = mergeReady();
    const candidate = path.join(context.started.worktreePath, "node_modules");
    mkdirSync(candidate);
    let replaced = false;
    const service = serviceFor(context, {
      beforeDisposableCandidateRemoved(candidatePath) {
        if (!replaced && path.basename(candidatePath) === "node_modules") {
          replaced = true;
          rmSync(candidatePath, { recursive: true, force: false });
          mkdirSync(candidatePath);
        }
      },
    });
    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });

    let failure;
    try {
      await service.cleanupTask({
        repoPath: context.base,
        branch: context.started.branch,
        approval: report.fingerprint,
        now: "2026-07-21T07:05:00.000Z",
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({ code: "CLEANUP_PARTIAL_FAILURE", failureCode: "APPROVAL_INVALIDATED" });
    expect(existsSync(candidate)).toBe(true);
  });

  it("removes an internal junction or symlink without following its external target", async () => {
    const context = mergeReady();
    const disposable = path.join(context.started.worktreePath, "node_modules");
    const external = tempRoot("talkpik-external-dependency-");
    writeFileSync(path.join(external, "keep.txt"), "keep\n");
    mkdirSync(disposable);
    symlinkSync(external, path.join(disposable, "external-link"), process.platform === "win32" ? "junction" : "dir");
    const service = serviceFor(context);
    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });

    const result = await service.cleanupTask({
      repoPath: context.base,
      branch: context.started.branch,
      approval: report.fingerprint,
      now: "2026-07-21T07:05:00.000Z",
    });

    expect(result.status).toBe("CLEANED");
    expect(readFileSync(path.join(external, "keep.txt"), "utf8")).toBe("keep\n");
  });

  it("preserves both roots when an approved source is recreated after its atomic quarantine claim", async () => {
    const context = mergeReady();
    const source = path.join(context.started.worktreePath, "node_modules");
    mkdirSync(source);
    writeFileSync(path.join(source, "approved.txt"), "approved\n");
    let claim;
    const service = serviceFor(context, {
      afterDisposableCandidateClaimed(currentClaim) {
        if (currentClaim.source !== source) return;
        claim = currentClaim;
        mkdirSync(source);
        writeFileSync(path.join(source, "new.txt"), "new\n");
      },
    });
    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });

    await expect(service.cleanupTask({ repoPath: context.base, branch: context.started.branch, approval: report.fingerprint, now: "2026-07-21T07:05:00.000Z" }))
      .rejects.toThrowError("CLEANUP_PARTIAL_FAILURE");

    const journal = JSON.parse(readFileSync(context.paths.cleanup, "utf8"));
    expect(journal.currentClaim).toEqual(claim);
    expect(existsSync(source)).toBe(true);
    expect(existsSync(claim.quarantine)).toBe(true);
    expect(readFileSync(path.join(claim.quarantine, "approved.txt"), "utf8")).toBe("approved\n");
  });

  it("preserves a quarantine claim whose identity changes after the atomic rename", async () => {
    const context = mergeReady();
    const source = path.join(context.started.worktreePath, "node_modules");
    mkdirSync(source);
    let claim;
    const service = serviceFor(context, {
      afterDisposableCandidateClaimed(currentClaim) {
        if (currentClaim.source !== source) return;
        claim = currentClaim;
        rmSync(currentClaim.quarantine, { recursive: true, force: false });
        mkdirSync(currentClaim.quarantine);
        writeFileSync(path.join(currentClaim.quarantine, "replacement.txt"), "replacement\n");
      },
    });
    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });

    await expect(service.cleanupTask({ repoPath: context.base, branch: context.started.branch, approval: report.fingerprint, now: "2026-07-21T07:05:00.000Z" }))
      .rejects.toThrowError("CLEANUP_PARTIAL_FAILURE");

    expect(existsSync(source)).toBe(false);
    expect(readFileSync(path.join(claim.quarantine, "replacement.txt"), "utf8")).toBe("replacement\n");
  });

  it.each(["claim journaled", "source quarantined", "quarantine removed"])(
    "resumes candidate cleanup after a crash with %s",
    async (crashPoint) => {
      const context = mergeReady();
      const source = path.join(context.started.worktreePath, "node_modules");
      mkdirSync(source);
      writeFileSync(path.join(source, "approved.txt"), "approved\n");
      let failOnce = true;
      const crash = () => {
        if (!failOnce) return;
        failOnce = false;
        throw new Error("INJECTED_CLAIM_CRASH");
      };
      const crashClaim = (claim) => {
        if (claim.source === source) crash();
      };
      const crashRemoved = (candidatePath) => {
        if (candidatePath === source) crash();
      };
      const service = serviceFor(context, {
        afterDisposableCandidateClaimJournaled: crashPoint === "claim journaled" ? crashClaim : () => {},
        afterDisposableCandidateClaimed: crashPoint === "source quarantined" ? crashClaim : () => {},
        afterDisposableCandidateRemoved: crashPoint === "quarantine removed" ? crashRemoved : () => {},
      });
      const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });
      await expect(service.cleanupTask({ repoPath: context.base, branch: context.started.branch, approval: report.fingerprint, now: "2026-07-21T07:05:00.000Z" }))
        .rejects.toThrowError("CLEANUP_PARTIAL_FAILURE");
      const partial = JSON.parse(readFileSync(context.paths.cleanup, "utf8"));
      expect(partial.currentClaim).toMatchObject({ source, digest: expect.any(String) });

      const resumed = await service.cleanupTask({ repoPath: context.base, branch: context.started.branch, approval: report.fingerprint, now: "2026-07-21T07:06:00.000Z" });

      expect(resumed.status).toBe("CLEANED");
      expect(resumed.tombstone.currentClaim).toBeUndefined();
    },
  );

  it("blocks claim recovery when a new ignored root appears", async () => {
    const context = mergeReady();
    const source = path.join(context.started.worktreePath, "node_modules");
    mkdirSync(source);
    let failOnce = true;
    const service = serviceFor(context, {
      afterDisposableCandidateClaimed() {
        if (!failOnce) return;
        failOnce = false;
        throw new Error("INJECTED_CLAIM_CRASH");
      },
    });
    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });
    await expect(service.cleanupTask({ repoPath: context.base, branch: context.started.branch, approval: report.fingerprint, now: "2026-07-21T07:05:00.000Z" }))
      .rejects.toThrowError("CLEANUP_PARTIAL_FAILURE");
    const partial = JSON.parse(readFileSync(context.paths.cleanup, "utf8"));
    writeFileSync(path.join(context.started.gitCommonDir, "info", "exclude"), ".rogue/\n");
    mkdirSync(path.join(context.started.worktreePath, ".rogue"));

    await expect(service.cleanupTask({ repoPath: context.base, branch: context.started.branch, approval: report.fingerprint, now: "2026-07-21T07:06:00.000Z" }))
      .rejects.toThrowError("CLEANUP_RECOVERY_BLOCKED");
    expect(existsSync(partial.currentClaim.quarantine)).toBe(true);
  });

  it("preserves a disposable root recreated by the last candidate deletion hook", async () => {
    const context = mergeReady();
    const source = path.join(context.started.worktreePath, "node_modules");
    mkdirSync(source);
    const service = serviceFor(context, {
      afterDisposableCandidateRemoved(candidatePath) {
        if (candidatePath !== source) return;
        mkdirSync(source);
        writeFileSync(path.join(source, "recreated.txt"), "preserve\n");
      },
    });
    const report = await service.finalizeTask({ repoPath: context.base, branch: context.started.branch });

    await expect(service.cleanupTask({ repoPath: context.base, branch: context.started.branch, approval: report.fingerprint, now: "2026-07-21T07:05:00.000Z" }))
      .rejects.toThrowError("CLEANUP_PARTIAL_FAILURE");

    expect(readFileSync(path.join(source, "recreated.txt"), "utf8")).toBe("preserve\n");
    expect(existsSync(context.started.worktreePath)).toBe(true);
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

  it("keeps old manifests valid and validates additive ordered candidate progress", () => {
    const oldManifest = validCleaningManifest();
    expect(validateCleanupManifest(oldManifest)).toEqual([]);

    const firstPath = oldManifest.disposableCandidates[0].path;
    expect(validateCleanupManifest({ ...oldManifest, candidateProgress: [firstPath] })).toEqual([]);
    expect(validateCleanupManifest({
      ...oldManifest,
      candidateProgress: [oldManifest.disposableCandidates[1].path],
    }).map((error) => error.code)).toContain("INVALID_CANDIDATE_PROGRESS");
    expect(validateCleanupManifest({
      ...oldManifest,
      candidateProgress: [firstPath, firstPath],
    }).map((error) => error.code)).toContain("INVALID_CANDIDATE_PROGRESS");
    expect(validateCleanupManifest({
      ...oldManifest,
      candidateProgress: [path.resolve("unapproved")],
    }).map((error) => error.code)).toContain("INVALID_CANDIDATE_PROGRESS");
  });

  it("accepts only an additive current claim for the next approved candidate", () => {
    const manifest = validCleaningManifest({ candidateProgress: [] });
    const expected = manifest.disposableCandidates[0];
    const currentClaim = {
      source: expected.path,
      quarantine: path.resolve("claim-root", "12345678-1234-4123-8123-123456789abc"),
      digest: expected.digest,
    };

    expect(validateCleanupManifest({ ...manifest, currentClaim })).toEqual([]);
    expect(validateCleanupManifest({
      ...manifest,
      currentClaim: { ...currentClaim, source: manifest.disposableCandidates[1].path },
    }).map((error) => error.code)).toContain("INVALID_CURRENT_CLAIM");
    expect(validateCleanupManifest({
      ...manifest,
      currentClaim: { ...currentClaim, unknown: true },
    }).map((error) => error.code)).toContain("INVALID_CURRENT_CLAIM");
  });

  it("requires a new CLEANED manifest to record every approved candidate", () => {
    const record = validCleaningManifest({
      status: "CLEANED",
      completedSteps: [
        "TASK_ARTIFACTS_REMOVED",
        "WORKTREE_REMOVED",
        "WORKTREE_ABSENCE_VERIFIED",
        "LOCAL_BRANCH_REMOVED",
        "REMOTE_BRANCH_ABSENCE_VERIFIED",
      ],
      candidateProgress: [path.resolve("candidate-a")],
      cleanedAt: NOW,
    });

    expect(validateCleanupManifest(record).map((error) => error.code)).toContain("INCOMPLETE_CANDIDATE_PROGRESS");
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
