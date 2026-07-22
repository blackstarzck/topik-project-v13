import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import net from "node:net";
import { performance } from "node:perf_hooks";

import {
  parseTaskBranch,
  validateCleanupManifest,
  validateTaskRecordV2,
} from "./ai-task-lifecycle-v2.mjs";

const SHA_PATTERN = /^[a-f0-9]{40}$/i;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/i;
const MAX_RECORD_BYTES = 64 * 1024;
const NETWORK_TIMEOUT_MS = 30_000;
const PROTECTED_BRANCHES = new Set(["main", "master", "develop", "production", "staging"]);
const DISPOSABLE_ROOTS = Object.freeze([
  "node_modules", ".next", "build", "dist", "out", "coverage", ".cache", ".turbo", ".vercel", ".env.local",
  "tsconfig.tsbuildinfo",
]);
const RUNTIME_KEYS = new Set([
  "schemaVersion",
  "recordType",
  "taskId",
  "branch",
  "worktreePath",
  "ports",
  "pids",
  "lockPaths",
  "revision",
  "registeredAt",
]);
const CLEANUP_LOCK_KEYS = new Set([
  "taskId", "operation", "pid", "nonce", "approvalFingerprint", "createdAt",
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

class TaskCleanupError extends Error {
  constructor(code) {
    super(code);
    this.name = "TaskCleanupError";
    this.code = code;
  }
}

function fail(code) {
  throw new TaskCleanupError(code);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validTimestamp(value) {
  if (typeof value !== "string" || value.length > 40) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function canonicalExternalTimestamp(value) {
  if (typeof value !== "string" || value.length > 40 ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value)) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  const canonical = new Date(parsed).toISOString();
  const expected = value.replace(/(?:\.(\d{1,3}))?Z$/u, (_match, fraction = "") =>
    `.${fraction.padEnd(3, "0")}Z`);
  return canonical === expected ? canonical : null;
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([key, child]) => [key, stableValue(child)]),
  );
}

function fingerprint(value) {
  return hash(JSON.stringify(stableValue(value)));
}

function elapsedMs(startedAt) {
  return Number((performance.now() - startedAt).toFixed(3));
}

function canonicalPath(value) {
  const resolved = path.resolve(value);
  return existsSync(resolved) ? realpathSync.native(resolved) : resolved;
}

function normalizedPath(value) {
  const normalized = canonicalPath(value).replace(/[\\/]+$/, "");
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function samePath(first, second) {
  return normalizedPath(first) === normalizedPath(second);
}

function pathContains(parent, child) {
  const relative = path.relative(normalizedPath(parent), normalizedPath(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertNoSymlinkPlan(root, target, code) {
  const rootResolved = path.resolve(root);
  const targetResolved = path.resolve(target);
  const relative = path.relative(rootResolved, targetResolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) fail(code);
  let cursor = rootResolved;
  if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) fail(code);
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    if (!existsSync(cursor)) break;
    if (lstatSync(cursor).isSymbolicLink()) fail(code);
    if (!pathContains(rootResolved, realpathSync.native(cursor))) fail(code);
  }
}

function runGit(repoPath, args, { allowFailure = false, raw = false, timeoutMs, commandRunner = spawnSync } = {}) {
  const result = commandRunner("git", ["-C", repoPath, ...args], {
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    shell: false,
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
    ...(timeoutMs === undefined ? {} : { timeout: timeoutMs }),
  });
  const status = result.status ?? 1;
  if (status !== 0 && !allowFailure) fail("GIT_COMMAND_FAILED");
  const stdout = String(result.stdout ?? "");
  return {
    status,
    stdout: raw ? stdout : stdout.trim(),
    stderr: String(result.stderr ?? ""),
  };
}

function gitContext(repoPath) {
  if (typeof repoPath !== "string" || !path.isAbsolute(repoPath) || !existsSync(repoPath)) {
    fail("REPOSITORY_REQUIRED");
  }
  const topLevel = runGit(repoPath, ["rev-parse", "--show-toplevel"]).stdout;
  const commonRaw = runGit(repoPath, ["rev-parse", "--git-common-dir"]).stdout;
  const commonDir = canonicalPath(path.isAbsolute(commonRaw) ? commonRaw : path.resolve(repoPath, commonRaw));
  return { topLevel: canonicalPath(topLevel), commonDir };
}

function registryPaths(commonDir, branch) {
  const { type, slug } = parseTaskBranch(branch);
  const taskId = `${type}-${slug}`;
  const v2 = path.join(commonDir, "talkpik-task-lifecycle", "v2");
  return {
    taskId,
    v2,
    tasks: path.join(v2, "tasks"),
    taskFile: path.join(v2, "tasks", `${taskId}.json`),
    operationLock: path.join(v2, "tasks", `${taskId}.lock`),
    runtimes: path.join(v2, "runtimes"),
    runtimeFile: path.join(v2, "runtimes", `${taskId}.json`),
    cleanups: path.join(v2, "cleanups"),
    cleanupFile: path.join(v2, "cleanups", `${taskId}.json`),
  };
}

function ensureRegistryDirectory(commonDir, directory) {
  assertNoSymlinkPlan(commonDir, directory, "REGISTRY_PATH_ESCAPE");
  if (!existsSync(directory)) mkdirSync(directory);
  if (!lstatSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink()) {
    fail("REGISTRY_PATH_ESCAPE");
  }
}

function readJson(filePath, missingCode) {
  if (!existsSync(filePath)) fail(missingCode);
  const stats = lstatSync(filePath);
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size > MAX_RECORD_BYTES) {
    fail("REGISTRY_RECORD_INVALID");
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    fail("REGISTRY_RECORD_INVALID");
  }
}

function atomicWriteJson(filePath, value) {
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    renameSync(tempPath, filePath);
  } finally {
    if (existsSync(tempPath)) unlinkSync(tempPath);
  }
}

function sameFileIdentity(first, second) {
  return first.dev === second.dev && first.ino === second.ino && first.birthtimeMs === second.birthtimeMs;
}

function claimedLockPath(paths, kind) {
  return `${paths.operationLock}.${kind}-${randomUUID()}.claim`;
}

function atomicallyClaimOperationLock(paths, expectedLock, kind, afterClaimed = () => {}) {
  if (!existsSync(paths.operationLock)) return;
  const current = lstatSync(paths.operationLock);
  if (!sameFileIdentity(current, expectedLock.identity) ||
      readFileSync(paths.operationLock, "utf8") !== expectedLock.content) return;
  const claimPath = claimedLockPath(paths, kind);
  try {
    renameSync(paths.operationLock, claimPath);
  } catch {
    return;
  }
  afterClaimed(claimPath);
  if (existsSync(paths.operationLock) || !existsSync(claimPath)) return { claimPath, valid: false };
  const claimed = lstatSync(claimPath);
  const valid = sameFileIdentity(claimed, expectedLock.identity) &&
    readFileSync(claimPath, "utf8") === expectedLock.content;
  return { claimPath, valid };
}

function releaseOperationLock(paths, ownedLock, dependencies = {}) {
  const claimed = atomicallyClaimOperationLock(
    paths,
    ownedLock,
    "owned",
    dependencies.afterOwnedOperationLockClaimed,
  );
  if (claimed?.valid) unlinkSync(claimed.claimPath);
}

function runWithOwnedLock(paths, ownedLock, operation, dependencies) {
  try {
    const result = operation(ownedLock);
    if (result && typeof result.then === "function") {
      return result.finally(() => releaseOperationLock(paths, ownedLock, dependencies));
    }
    releaseOperationLock(paths, ownedLock, dependencies);
    return result;
  } catch (error) {
    releaseOperationLock(paths, ownedLock, dependencies);
    throw error;
  }
}

function createOperationLock(paths, content) {
  writeFileSync(paths.operationLock, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
  return { path: paths.operationLock, content, identity: lstatSync(paths.operationLock) };
}

function withTaskOperationLock(paths, operation) {
  ensureRegistryDirectory(path.dirname(paths.v2), paths.v2);
  ensureRegistryDirectory(paths.v2, paths.tasks);
  const token = `${process.pid}:${randomUUID()}`;
  let ownedLock;
  try {
    ownedLock = createOperationLock(paths, `${token}\n`);
  } catch (error) {
    if (error?.code === "EEXIST") fail("TASK_OPERATION_IN_PROGRESS");
    fail("TASK_OPERATION_LOCK_FAILED");
  }
  return runWithOwnedLock(paths, ownedLock, operation);
}

function validCleanupLockRecord(value, task, approval, now) {
  return isPlainObject(value) &&
    Object.keys(value).length === CLEANUP_LOCK_KEYS.size &&
    Object.keys(value).every((key) => CLEANUP_LOCK_KEYS.has(key)) &&
    value.taskId === task.taskId &&
    value.operation === "cleanup" &&
    Number.isInteger(value.pid) && value.pid > 0 &&
    UUID_PATTERN.test(value.nonce ?? "") &&
    value.approvalFingerprint === approval && FINGERPRINT_PATTERN.test(value.approvalFingerprint) &&
    validTimestamp(value.createdAt) && Date.parse(value.createdAt) <= Date.parse(now);
}

function cleanupJournalOwnsCurrentTask(context, paths, task, journal) {
  if (journal.taskId !== task.taskId || journal.branch !== task.branch ||
      !samePath(journal.worktreePath, task.worktreePath) ||
      journal.taskRevision !== task.revision || journal.taskState !== task.state ||
      !samePath(task.gitCommonDir, context.commonDir)) return false;
  const expectedPaths = registryPaths(context.commonDir, task.branch);
  if (expectedPaths.taskId !== paths.taskId || !samePath(expectedPaths.taskFile, paths.taskFile) ||
      !samePath(expectedPaths.cleanupFile, paths.cleanupFile) ||
      !samePath(expectedPaths.operationLock, paths.operationLock)) return false;
  try {
    assertNoSymlinkPlan(context.commonDir, paths.taskFile, "REGISTRY_PATH_ESCAPE");
    assertNoSymlinkPlan(context.commonDir, paths.cleanupFile, "REGISTRY_PATH_ESCAPE");
    assertNoSymlinkPlan(context.commonDir, paths.operationLock, "REGISTRY_PATH_ESCAPE");
  } catch {
    return false;
  }
  const listed = runGit(context.topLevel, ["worktree", "list", "--porcelain"], { allowFailure: true });
  if (listed.status !== 0) return false;
  const worktrees = parseWorktrees(listed.stdout);
  const pathOwners = worktrees.filter((entry) => samePath(entry.path, task.worktreePath));
  const branchOwners = worktrees.filter((entry) => entry.branch === task.branch);
  const branchHead = runGit(context.topLevel, ["rev-parse", "--verify", `refs/heads/${task.branch}^{commit}`], { allowFailure: true });
  const branchOwned = journal.completedSteps.includes("LOCAL_BRANCH_REMOVED")
    ? branchHead.status !== 0
    : branchHead.status === 0 && branchHead.stdout === journal.headSha;
  if (!branchOwned) return false;
  if (journal.completedSteps.includes("WORKTREE_REMOVED")) {
    return !existsSync(task.worktreePath) && pathOwners.length === 0 && branchOwners.length === 0;
  }
  return existsSync(task.worktreePath) && pathOwners.length === 1 && branchOwners.length === 1 &&
    pathOwners[0] === branchOwners[0] && pathOwners[0].head === journal.headSha &&
    !pathOwners[0].detached && !pathOwners[0].locked && !pathOwners[0].prunable;
}

function reclaimableCleanupLock(context, paths, task, approval, now, dependencies) {
  let identity;
  let content;
  let record;
  try {
    identity = lstatSync(paths.operationLock);
    if (!identity.isFile() || identity.isSymbolicLink() || identity.size > MAX_RECORD_BYTES) return null;
    content = readFileSync(paths.operationLock, "utf8");
    record = JSON.parse(content);
    if (!validCleanupLockRecord(record, task, approval, now)) return null;
    if (!existsSync(paths.cleanupFile)) return null;
    const journal = readJson(paths.cleanupFile, "CLEANUP_JOURNAL_INVALID");
    if (validateCleanupManifest(journal).length > 0 || journal.status !== "CLEANING" ||
        journal.snapshotFingerprint !== approval ||
        !cleanupJournalOwnsCurrentTask(context, paths, task, journal)) return null;
    if (dependencies.isPidActive(record.pid)) return null;
  } catch {
    return null;
  }
  return { identity, content };
}

function withCleanupOperationLock(context, paths, task, approval, now, dependencies, operation) {
  ensureRegistryDirectory(path.dirname(paths.v2), paths.v2);
  ensureRegistryDirectory(paths.v2, paths.tasks);
  const record = {
    taskId: task.taskId,
    operation: "cleanup",
    pid: process.pid,
    nonce: randomUUID(),
    approvalFingerprint: approval,
    createdAt: now,
  };
  const content = `${JSON.stringify(record)}\n`;
  let ownedLock;
  try {
    ownedLock = createOperationLock(paths, content);
  } catch (error) {
    if (error?.code !== "EEXIST") fail("TASK_OPERATION_LOCK_FAILED");
    const stale = reclaimableCleanupLock(context, paths, task, approval, now, dependencies);
    if (!stale || !existsSync(paths.operationLock)) fail("TASK_OPERATION_IN_PROGRESS");
    const claimed = atomicallyClaimOperationLock(
      paths,
      stale,
      "stale",
      dependencies.afterStaleCleanupLockClaimed,
    );
    if (!claimed?.valid) fail("TASK_OPERATION_IN_PROGRESS");
    unlinkSync(claimed.claimPath);
    if (existsSync(paths.operationLock)) fail("TASK_OPERATION_IN_PROGRESS");
    try {
      ownedLock = createOperationLock(paths, content);
    } catch {
      fail("TASK_OPERATION_IN_PROGRESS");
    }
  }
  return runWithOwnedLock(paths, ownedLock, operation, dependencies);
}

function readTask(commonDir, branch) {
  const paths = registryPaths(commonDir, branch);
  assertNoSymlinkPlan(commonDir, paths.taskFile, "REGISTRY_PATH_ESCAPE");
  const task = readJson(paths.taskFile, "TASK_NOT_FOUND");
  if (validateTaskRecordV2(task).length > 0 || task.taskId !== paths.taskId) {
    fail("TASK_RECORD_INVALID");
  }
  return { paths, task };
}

function validateRuntimeManifest(value, task) {
  if (!isPlainObject(value) || Object.keys(value).some((key) => !RUNTIME_KEYS.has(key))) return false;
  return (
    value.schemaVersion === 2 &&
    value.recordType === "RuntimeManifest" &&
    value.taskId === task.taskId &&
    value.branch === task.branch &&
    samePath(value.worktreePath, task.worktreePath) &&
    Array.isArray(value.ports) &&
    value.ports.length <= 32 &&
    value.ports.every((port) => Number.isInteger(port) && port > 0 && port <= 65535) &&
    new Set(value.ports).size === value.ports.length &&
    Array.isArray(value.pids) &&
    value.pids.length <= 32 &&
    value.pids.every((pid) => Number.isInteger(pid) && pid > 0) &&
    new Set(value.pids).size === value.pids.length &&
    Array.isArray(value.lockPaths) &&
    value.lockPaths.length <= 32 &&
    value.lockPaths.every((lockPath) => typeof lockPath === "string" && path.isAbsolute(lockPath)) &&
    Number.isInteger(value.revision) &&
    value.revision >= 1 &&
    validTimestamp(value.registeredAt)
  );
}

function taskArtifactPath(task) {
  return path.join(task.worktreePath, ".codex", "work", task.slug);
}

function assertRuntimeLockPaths(task, lockPaths) {
  const root = taskArtifactPath(task);
  assertNoSymlinkPlan(task.worktreePath, root, "RUNTIME_LOCK_PATH_ESCAPE");
  for (const lockPath of lockPaths) {
    if (typeof lockPath !== "string" || !path.isAbsolute(lockPath) || !pathContains(root, lockPath)) {
      fail("RUNTIME_LOCK_PATH_ESCAPE");
    }
    assertNoSymlinkPlan(root, lockPath, "RUNTIME_LOCK_PATH_ESCAPE");
  }
}

export function registerTaskRuntime({ repoPath, branch, ports, pids, lockPaths, now }) {
  if (!Array.isArray(ports) || !Array.isArray(pids) || !Array.isArray(lockPaths) || !validTimestamp(now)) {
    fail("RUNTIME_MANIFEST_INVALID");
  }
  const context = gitContext(repoPath);
  const { paths, task } = readTask(context.commonDir, branch);
  assertRuntimeLockPaths(task, lockPaths);
  return withTaskOperationLock(paths, () => {
    const refreshed = readTask(context.commonDir, branch).task;
    if (refreshed.revision !== task.revision || !samePath(refreshed.worktreePath, task.worktreePath)) {
      fail("TASK_RECORD_CHANGED");
    }
    ensureRegistryDirectory(paths.v2, paths.runtimes);
    let revision = 1;
    if (existsSync(paths.runtimeFile)) {
      const previous = readJson(paths.runtimeFile, "RUNTIME_REGISTRATION_REQUIRED");
      if (!validateRuntimeManifest(previous, task)) fail("RUNTIME_MANIFEST_INVALID");
      revision = previous.revision + 1;
      if (Date.parse(now) < Date.parse(previous.registeredAt)) fail("TIMESTAMP_REGRESSION");
    }
    const manifest = {
      schemaVersion: 2,
      recordType: "RuntimeManifest",
      taskId: task.taskId,
      branch: task.branch,
      worktreePath: task.worktreePath,
      ports: [...new Set(ports)].sort((first, second) => first - second),
      pids: [...new Set(pids)].sort((first, second) => first - second),
      lockPaths: [...new Set(lockPaths.map((value) => canonicalPath(value)))].sort(),
      revision,
      registeredAt: now,
    };
    if (!validateRuntimeManifest(manifest, task)) fail("RUNTIME_MANIFEST_INVALID");
    atomicWriteJson(paths.runtimeFile, manifest);
    return structuredClone(manifest);
  });
}

function parseWorktrees(output) {
  const records = [];
  let current = null;
  for (const line of `${output}\n`.split(/\r?\n/)) {
    if (line.startsWith("worktree ")) {
      if (current) records.push(current);
      current = { path: line.slice(9), head: null, branch: null, detached: false, locked: false, prunable: false };
    } else if (current && line.startsWith("HEAD ")) current.head = line.slice(5);
    else if (current && line.startsWith("branch refs/heads/")) current.branch = line.slice(18);
    else if (current && line === "detached") current.detached = true;
    else if (current && line.startsWith("locked")) current.locked = true;
    else if (current && line.startsWith("prunable")) current.prunable = true;
    else if (line === "" && current) {
      records.push(current);
      current = null;
    }
  }
  return records;
}

function disposablePaths(task) {
  return [
    ...DISPOSABLE_ROOTS.map((relative) => path.join(task.worktreePath, relative)),
    taskArtifactPath(task),
  ];
}

function validDisposableRootStats(stats) {
  return !stats.isSymbolicLink() && (stats.isDirectory() || stats.isFile()) &&
    typeof stats.dev === "bigint" && stats.dev > 0n &&
    typeof stats.ino === "bigint" && stats.ino > 0n &&
    typeof stats.birthtimeNs === "bigint" && stats.birthtimeNs > 0n;
}

function disposableCandidateFromStats(task, sourcePath, stats) {
  const buildInfoPath = path.join(task.worktreePath, "tsconfig.tsbuildinfo");
  if (!validDisposableRootStats(stats) || (samePath(sourcePath, buildInfoPath) && !stats.isFile())) return null;
  const identity = {
    path: normalizedPath(sourcePath),
    kind: stats.isDirectory() ? "directory" : "file",
    dev: `${stats.dev}`,
    ino: `${stats.ino}`,
    birthtimeNs: `${stats.birthtimeNs}`,
  };
  return { path: canonicalPath(sourcePath), digest: fingerprint(identity) };
}

function inspectDisposableRoot(task, root) {
  try {
    assertNoSymlinkPlan(task.worktreePath, root, "TASK_ARTIFACT_PATH_ESCAPE");
  } catch {
    return { safe: false, candidate: null };
  }
  if (!existsSync(root)) return { safe: true, candidate: null };
  const stats = lstatSync(root, { bigint: true });
  const candidate = disposableCandidateFromStats(task, root, stats);
  return candidate ? { safe: true, candidate } : { safe: false, candidate: null };
}

function candidateClaimRoot(task) {
  return path.join(path.dirname(task.worktreePath), ".talkpik-cleanup-claims", task.taskId);
}

function ensureCandidateClaimRoot(task) {
  const parent = path.dirname(task.worktreePath);
  const commonRoot = path.join(parent, ".talkpik-cleanup-claims");
  const taskRoot = candidateClaimRoot(task);
  for (const directory of [commonRoot, taskRoot]) {
    assertNoSymlinkPlan(parent, directory, "TASK_ARTIFACT_CLAIM_PATH_ESCAPE");
    if (!existsSync(directory)) mkdirSync(directory);
    const stats = lstatSync(directory);
    if (!stats.isDirectory() || stats.isSymbolicLink()) fail("TASK_ARTIFACT_CLAIM_PATH_ESCAPE");
  }
  return taskRoot;
}

function newCandidateClaim(task, approvedCandidate) {
  const root = ensureCandidateClaimRoot(task);
  const quarantine = path.join(root, randomUUID());
  if (existsSync(quarantine)) fail("TASK_ARTIFACT_CLAIM_PATH_EXISTS");
  return { source: approvedCandidate.path, quarantine, digest: approvedCandidate.digest };
}

function validCandidateClaimPath(task, claim) {
  const root = candidateClaimRoot(task);
  if (!samePath(path.dirname(claim.quarantine), root) || !UUID_PATTERN.test(path.basename(claim.quarantine))) {
    return false;
  }
  try {
    assertNoSymlinkPlan(path.dirname(task.worktreePath), claim.quarantine, "TASK_ARTIFACT_CLAIM_PATH_ESCAPE");
  } catch {
    return false;
  }
  return true;
}

function inspectQuarantinedCandidate(task, claim) {
  if (!validCandidateClaimPath(task, claim) || !existsSync(claim.quarantine)) return null;
  const stats = lstatSync(claim.quarantine, { bigint: true });
  const candidate = disposableCandidateFromStats(task, claim.source, stats);
  return candidate && candidate.digest === claim.digest ? candidate : null;
}

function removeEmptyCandidateClaimDirectories(task) {
  const taskRoot = candidateClaimRoot(task);
  const commonRoot = path.dirname(taskRoot);
  for (const directory of [taskRoot, commonRoot]) {
    try {
      if (existsSync(directory) && readdirSync(directory).length === 0) rmdirSync(directory);
    } catch {
      // A concurrent or foreign claim is preserved.
    }
  }
}

function inspectDisposableInventory(task) {
  const candidates = [];
  const disposableCandidates = [];
  let safe = true;
  for (const root of disposablePaths(task)) {
    const inspected = inspectDisposableRoot(task, root);
    if (!inspected.safe) safe = false;
    if (!inspected.candidate) continue;
    candidates.push(inspected.candidate.path);
    disposableCandidates.push(inspected.candidate);
  }
  disposableCandidates.sort((first, second) => first.path.localeCompare(second.path));
  return { safe, candidates: candidates.sort(), disposableCandidates, digest: fingerprint(disposableCandidates) };
}

function ownsAllIgnoredCodexWork(task) {
  const codexRoot = path.join(task.worktreePath, ".codex");
  const workRoot = path.join(codexRoot, "work");
  try {
    assertNoSymlinkPlan(task.worktreePath, workRoot, "TASK_ARTIFACT_PATH_ESCAPE");
    if (!existsSync(codexRoot)) return true;
    const codexStats = lstatSync(codexRoot);
    if (!codexStats.isDirectory() || codexStats.isSymbolicLink()) return false;
    const trackedChildren = new Set(
      runGit(task.worktreePath, ["ls-files", "-z", "--", ".codex"], { raw: true }).stdout
        .split("\0")
        .filter(Boolean)
        .map((entry) => entry.replaceAll("\\", "/").split("/")[1])
        .filter(Boolean),
    );
    if (readdirSync(codexRoot).some((entry) => entry !== "work" && !trackedChildren.has(entry))) return false;
    if (!existsSync(workRoot)) return true;
    const workStats = lstatSync(workRoot);
    if (!workStats.isDirectory() || workStats.isSymbolicLink()) return false;
    return readdirSync(workRoot).every((entry) => entry === task.slug);
  } catch {
    return false;
  }
}

function ignoredContentBlocker(task, allowedRoots = disposablePaths(task)) {
  const ignored = runGit(
    task.worktreePath,
    ["ls-files", "--others", "--ignored", "--exclude-standard", "--directory", "-z"],
    { raw: true },
  ).stdout.split("\0").filter(Boolean);
  const codexRoot = path.join(task.worktreePath, ".codex");
  const codexWorkRoot = path.join(codexRoot, "work");
  for (const relative of ignored) {
    const absolute = path.resolve(task.worktreePath, relative);
    if (samePath(absolute, codexRoot) || samePath(absolute, codexWorkRoot)) {
      if (!ownsAllIgnoredCodexWork(task)) return true;
      continue;
    }
    if (!allowedRoots.some((root) => pathContains(root, absolute))) return true;
  }
  return false;
}

function defaultPidActive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    if (error?.code === "EPERM") return true;
    throw error;
  }
}

function defaultPortActive(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    let settled = false;
    const finish = (active) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(active);
    };
    socket.setTimeout(300, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

function githubRepositoryFromOrigin(repoPath) {
  const url = runGit(repoPath, ["remote", "get-url", "origin"]).stdout;
  const match = /^(?:https:\/\/github\.com\/|git@github\.com:)([^/\s]+\/[^/\s]+?)(?:\.git)?$/.exec(url);
  if (!match) fail("PR_EVIDENCE_UNAVAILABLE");
  return match[1];
}

function defaultReadPrEvidence({ repoPath, branch }, commandRunner = spawnSync) {
  const repository = githubRepositoryFromOrigin(repoPath);
  const result = commandRunner(
    "gh",
    [
      "pr",
      "view",
      branch,
      "--repo",
      repository,
      "--json",
      "number,state,baseRefName,headRefName,headRefOid,mergeCommit,mergedAt",
    ],
    {
      encoding: "utf8",
      env: { ...process.env, GH_PROMPT_DISABLED: "1", GIT_TERMINAL_PROMPT: "0" },
      shell: false,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
      timeout: NETWORK_TIMEOUT_MS,
    },
  );
  if ((result.status ?? 1) !== 0) fail("PR_EVIDENCE_UNAVAILABLE");
  let raw;
  try {
    raw = JSON.parse(String(result.stdout ?? ""));
  } catch {
    fail("PR_EVIDENCE_UNAVAILABLE");
  }
  return {
    number: raw.number,
    state: raw.state,
    baseRefName: raw.baseRefName,
    headRefName: raw.headRefName,
    headRefOid: raw.headRefOid,
    mergeCommitOid: raw.mergeCommit?.oid ?? null,
    mergedAt: raw.mergedAt,
  };
}

function sanitizePrEvidence(value) {
  if (!isPlainObject(value)) return null;
  const canonicalMergedAt = value.mergedAt === null ? null : canonicalExternalTimestamp(value.mergedAt);
  const evidence = {
    number: value.number,
    state: value.state,
    baseRefName: value.baseRefName,
    headRefName: value.headRefName,
    headRefOid: value.headRefOid,
    mergeCommitOid: value.mergeCommitOid,
    mergedAt: canonicalMergedAt,
  };
  if (
    !Number.isInteger(evidence.number) ||
    evidence.number <= 0 ||
    typeof evidence.state !== "string" ||
    typeof evidence.baseRefName !== "string" ||
    typeof evidence.headRefName !== "string" ||
    !SHA_PATTERN.test(evidence.headRefOid ?? "") ||
    (evidence.state === "MERGED" && (!SHA_PATTERN.test(evidence.mergeCommitOid ?? "") || !validTimestamp(evidence.mergedAt))) ||
    (evidence.state !== "MERGED" && !(
      (evidence.mergeCommitOid === null || SHA_PATTERN.test(evidence.mergeCommitOid ?? "")) &&
      evidence.mergedAt === null
    ))
  ) {
    return null;
  }
  return evidence;
}

function remoteBranchState(repoPath, branch, commandRunner = spawnSync) {
  const result = runGit(repoPath, ["ls-remote", "--exit-code", "--heads", "origin", `refs/heads/${branch}`], {
    allowFailure: true,
    timeoutMs: NETWORK_TIMEOUT_MS,
    commandRunner,
  });
  if (result.status === 0) return "present";
  if (result.status === 2) return "absent";
  return "unknown";
}

function ownsOperationLock(paths, ownedLock) {
  if (!existsSync(paths.operationLock) || !ownedLock || !samePath(ownedLock.path, paths.operationLock)) return false;
  const current = lstatSync(paths.operationLock);
  return current.dev === ownedLock.identity.dev && current.ino === ownedLock.identity.ino &&
    current.birthtimeMs === ownedLock.identity.birthtimeMs &&
    readFileSync(paths.operationLock, "utf8") === ownedLock.content;
}

async function finalizeWithDependencies({ repoPath, branch }, dependencies, ownedLock = null) {
  const totalStartedAt = performance.now();
  let phaseStartedAt = totalStartedAt;
  const context = gitContext(repoPath);
  const { paths, task } = readTask(context.commonDir, branch);
  const blockers = [];
  const fetchResult = runGit(context.topLevel, ["fetch", "--prune", "origin"], {
    allowFailure: true,
    timeoutMs: NETWORK_TIMEOUT_MS,
    commandRunner: dependencies.networkCommandRunner,
  });
  const gitAndFetchMs = elapsedMs(phaseStartedAt);
  phaseStartedAt = performance.now();
  const fetch = { remote: "origin", prune: true, refsRefreshed: fetchResult.status === 0 };
  if (fetchResult.status !== 0) blockers.push("ORIGIN_FETCH_FAILED");
  if (PROTECTED_BRANCHES.has(task.branch)) blockers.push("PROTECTED_BRANCH");
  if (task.state !== "ACTIVE") blockers.push("TASK_NOT_ACTIVE");
  if (existsSync(paths.operationLock) && !ownsOperationLock(paths, ownedLock)) blockers.push("TASK_OPERATION_IN_PROGRESS");

  const worktrees = parseWorktrees(
    runGit(context.topLevel, ["worktree", "list", "--porcelain"]).stdout,
  );
  const byPath = worktrees.find((entry) => samePath(entry.path, task.worktreePath));
  const owner = byPath ?? null;
  if (!owner || (owner.branch !== task.branch && !owner.detached)) blockers.push("WORKTREE_OWNERSHIP_UNKNOWN");
  if (owner?.detached) blockers.push("WORKTREE_OWNERSHIP_UNKNOWN");
  if (owner?.locked) blockers.push("WORKTREE_LOCKED");
  if (owner?.prunable) blockers.push("WORKTREE_PRUNABLE");
  if (owner?.detached || owner?.branch === null) blockers.push("WORKTREE_DETACHED");

  let headSha = null;
  let branchSha = null;
  if (existsSync(task.worktreePath) && owner) {
    const head = runGit(task.worktreePath, ["rev-parse", "HEAD"], { allowFailure: true });
    if (head.status === 0 && SHA_PATTERN.test(head.stdout)) headSha = head.stdout;
    else blockers.push("WORKTREE_HEAD_UNKNOWN");
    const symbolic = runGit(task.worktreePath, ["symbolic-ref", "--quiet", "--short", "HEAD"], { allowFailure: true });
    if (symbolic.status !== 0 || symbolic.stdout !== task.branch) blockers.push("WORKTREE_BRANCH_MISMATCH");
    const branchRef = runGit(context.topLevel, ["rev-parse", "--verify", `refs/heads/${task.branch}^{commit}`], {
      allowFailure: true,
    });
    if (branchRef.status === 0 && SHA_PATTERN.test(branchRef.stdout)) branchSha = branchRef.stdout;
    else blockers.push("LOCAL_BRANCH_MISSING");
    if (headSha && branchSha && headSha !== branchSha) blockers.push("WORKTREE_HEAD_MISMATCH");
    const status = runGit(
      task.worktreePath,
      ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignore-submodules=none"],
      { raw: true, allowFailure: true },
    );
    if (status.status !== 0 || status.stdout !== "") blockers.push("WORKTREE_DIRTY");
    try {
      if (ignoredContentBlocker(task)) blockers.push("WORKTREE_IGNORED_CONTENT");
    } catch {
      blockers.push("WORKTREE_STATUS_UNKNOWN");
    }
  } else if (!existsSync(task.worktreePath)) {
    blockers.push("WORKTREE_MISSING");
  }
  const worktreeMs = elapsedMs(phaseStartedAt);
  phaseStartedAt = performance.now();

  const inventory = inspectDisposableInventory(task);
  if (!inventory.safe) blockers.push("TASK_ARTIFACT_PATH_ESCAPE");
  const inventoryMs = elapsedMs(phaseStartedAt);
  phaseStartedAt = performance.now();

  let runtime = null;
  if (!existsSync(paths.runtimeFile)) {
    blockers.push("RUNTIME_REGISTRATION_REQUIRED");
  } else {
    try {
      runtime = readJson(paths.runtimeFile, "RUNTIME_REGISTRATION_REQUIRED");
      if (!validateRuntimeManifest(runtime, task)) fail("RUNTIME_MANIFEST_INVALID");
      assertRuntimeLockPaths(task, runtime.lockPaths);
    } catch {
      runtime = null;
      blockers.push("RUNTIME_MANIFEST_INVALID");
    }
  }
  if (runtime) {
    for (const pid of runtime.pids) {
      try {
        if (dependencies.isPidActive(pid)) blockers.push("RUNTIME_PID_ACTIVE");
      } catch {
        blockers.push("RUNTIME_PID_STATUS_UNKNOWN");
      }
    }
    for (const port of runtime.ports) {
      try {
        if (await dependencies.isPortActive(port)) blockers.push("RUNTIME_PORT_ACTIVE");
      } catch {
        blockers.push("RUNTIME_PORT_STATUS_UNKNOWN");
      }
    }
    if (runtime.lockPaths.some((lockPath) => existsSync(lockPath))) blockers.push("RUNTIME_LOCK_ACTIVE");
  }
  const runtimeMs = elapsedMs(phaseStartedAt);
  phaseStartedAt = performance.now();

  let prEvidence = null;
  try {
    prEvidence = sanitizePrEvidence(
      await dependencies.readPrEvidence({ repoPath: context.topLevel, branch: task.branch }),
    );
    if (!prEvidence) blockers.push("PR_EVIDENCE_AMBIGUOUS");
  } catch {
    blockers.push("PR_EVIDENCE_UNAVAILABLE");
  }
  if (prEvidence) {
    if (prEvidence.state !== "MERGED" || !prEvidence.mergedAt) blockers.push("PR_NOT_MERGED");
    if (prEvidence.baseRefName !== "main") blockers.push("PR_BASE_NOT_MAIN");
    if (prEvidence.headRefName !== task.branch) blockers.push("PR_HEAD_BRANCH_MISMATCH");
    if (headSha && prEvidence.headRefOid !== headSha) {
      blockers.push("PR_HEAD_MISMATCH", "LOCAL_COMMITS_NOT_PUBLISHED");
    }
    if (fetch.refsRefreshed) {
      const included = runGit(
        context.topLevel,
        ["merge-base", "--is-ancestor", prEvidence.mergeCommitOid, "origin/main"],
        { allowFailure: true },
      );
      if (included.status !== 0) blockers.push("MERGE_NOT_IN_ORIGIN_MAIN");
      const headIncluded = runGit(context.topLevel, ["merge-base", "--is-ancestor", prEvidence.headRefOid, "origin/main"], { allowFailure: true });
      if (headIncluded.status !== 0) blockers.push("PR_HEAD_NOT_IN_ORIGIN_MAIN");
    }
  }
  const prEvidenceMs = elapsedMs(phaseStartedAt);
  phaseStartedAt = performance.now();

  const remoteState = remoteBranchState(context.topLevel, task.branch, dependencies.networkCommandRunner);
  if (remoteState === "present") blockers.push("REMOTE_TASK_BRANCH_PRESENT");
  if (remoteState === "unknown") blockers.push("REMOTE_BRANCH_EVIDENCE_UNAVAILABLE");

  const candidates = [
    ...inventory.candidates.map((candidate) => `disposable:${candidate}`),
    `branch:${task.branch}`,
    `tombstone:${paths.cleanupFile}`,
    `worktree:${task.worktreePath}`,
  ].sort();
  const uniqueBlockers = [...new Set(blockers)].sort();
  const originMainSha = fetch.refsRefreshed
    ? runGit(context.topLevel, ["rev-parse", "--verify", "origin/main^{commit}"], { allowFailure: true }).stdout
    : null;
  const runtimeDigest = runtime === null ? null : fingerprint(runtime);
  const remoteMs = elapsedMs(phaseStartedAt);
  const snapshot = {
    task: {
      taskId: task.taskId,
      branch: task.branch,
      worktreePath: normalizedPath(task.worktreePath),
      revision: task.revision,
      state: task.state,
    },
    git: {
      headSha,
      branchSha,
      owner: owner
        ? { path: normalizedPath(owner.path), branch: owner.branch, head: owner.head, detached: owner.detached, locked: owner.locked }
        : null,
      originMain: originMainSha,
      remoteState,
    },
    runtime,
    disposableInventoryDigest: inventory.digest,
    disposableCandidates: inventory.disposableCandidates,
    prEvidence,
    blockers: uniqueBlockers,
    candidates,
  };
  return {
    command: "task:finalize",
    reportOnly: true,
    ready: uniqueBlockers.length === 0,
    blockers: uniqueBlockers,
    candidates,
    fingerprint: fingerprint(snapshot),
    fetch,
    prEvidence,
    disposableInventoryDigest: inventory.digest,
    disposableCandidates: inventory.disposableCandidates,
    timings: {
      gitAndFetchMs,
      worktreeMs,
      inventoryMs,
      runtimeMs,
      prEvidenceMs,
      remoteMs,
      totalMs: elapsedMs(totalStartedAt),
    },
    recoveryContext: prEvidence && runtime ? {
      taskRevision: task.revision,
      taskState: task.state,
      runtimeDigest,
      prNumber: prEvidence.number,
      prState: prEvidence.state,
      prBaseRefName: prEvidence.baseRefName,
      prHeadRefName: prEvidence.headRefName,
      mergeCommitOid: prEvidence.mergeCommitOid,
      mergedAt: prEvidence.mergedAt,
      originMainSha,
      remoteState,
    } : null,
  };
}

const DEFAULT_DEPENDENCIES = Object.freeze({
  readPrEvidence: defaultReadPrEvidence,
  isPidActive: defaultPidActive,
  isPortActive: defaultPortActive,
  afterCleanupStep() {},
  beforeDisposableCandidateRemoved() {},
  afterDisposableCandidateClaimJournaled() {},
  afterDisposableCandidateClaimed() {},
  afterDisposableCandidateRemoved() {},
  afterDisposableCandidateJournaled() {},
  afterStaleCleanupLockClaimed() {},
  afterOwnedOperationLockClaimed() {},
  networkCommandRunner: spawnSync,
});

async function assertRecoveryState({ context, paths, task, journal, dependencies, ownedLock }) {
  const blocked = () => fail("CLEANUP_RECOVERY_BLOCKED");
  if (!ownsOperationLock(paths, ownedLock)) blocked();
  if (task.revision !== journal.taskRevision || task.state !== journal.taskState) blocked();
  const fetch = runGit(context.topLevel, ["fetch", "--prune", "origin"], {
    allowFailure: true,
    timeoutMs: NETWORK_TIMEOUT_MS,
    commandRunner: dependencies.networkCommandRunner,
  });
  if (fetch.status !== 0) blocked();
  const originMainSha = runGit(context.topLevel, ["rev-parse", "--verify", "origin/main^{commit}"], { allowFailure: true });
  if (originMainSha.status !== 0 || originMainSha.stdout !== journal.originMainSha) blocked();
  if (!existsSync(paths.runtimeFile)) blocked();
  const runtime = readJson(paths.runtimeFile, "RUNTIME_REGISTRATION_REQUIRED");
  if (!validateRuntimeManifest(runtime, task) || fingerprint(runtime) !== journal.runtimeDigest) blocked();
  for (const pid of runtime.pids) {
    try { if (dependencies.isPidActive(pid)) blocked(); } catch { blocked(); }
  }
  for (const port of runtime.ports) {
    try { if (await dependencies.isPortActive(port)) blocked(); } catch { blocked(); }
  }
  if (runtime.lockPaths.some((lockPath) => existsSync(lockPath))) blocked();
  let prEvidence;
  try {
    prEvidence = sanitizePrEvidence(await dependencies.readPrEvidence({ repoPath: context.topLevel, branch: task.branch }));
  } catch { blocked(); }
  if (!prEvidence || prEvidence.number !== journal.prNumber || prEvidence.state !== journal.prState ||
      prEvidence.baseRefName !== journal.prBaseRefName || prEvidence.headRefName !== journal.prHeadRefName ||
      prEvidence.headRefOid !== journal.headSha || prEvidence.mergeCommitOid !== journal.mergeCommitOid ||
      prEvidence.mergedAt !== journal.mergedAt) blocked();
  for (const sha of [journal.headSha, journal.mergeCommitOid]) {
    if (runGit(context.topLevel, ["merge-base", "--is-ancestor", sha, "origin/main"], { allowFailure: true }).status !== 0) blocked();
  }
  if (remoteBranchState(context.topLevel, task.branch, dependencies.networkCommandRunner) !== journal.remoteState || journal.remoteState !== "absent") blocked();

  const steps = journal.completedSteps;
  const worktrees = parseWorktrees(runGit(context.topLevel, ["worktree", "list", "--porcelain"]).stdout);
  const ownedWorktree = worktrees.find((entry) => samePath(entry.path, task.worktreePath));
  if (steps.includes("WORKTREE_REMOVED")) {
    if (ownedWorktree || existsSync(task.worktreePath)) blocked();
  } else {
    if (!ownedWorktree || ownedWorktree.branch !== task.branch || ownedWorktree.head !== journal.headSha ||
        ownedWorktree.detached || ownedWorktree.locked) blocked();
  }
  const branchHead = runGit(context.topLevel, ["rev-parse", "--verify", `refs/heads/${task.branch}^{commit}`], { allowFailure: true });
  if (steps.includes("LOCAL_BRANCH_REMOVED")) {
    if (branchHead.status === 0) blocked();
  } else if (branchHead.status !== 0 || branchHead.stdout !== journal.headSha) blocked();
  const inventory = existsSync(task.worktreePath)
    ? inspectDisposableInventory(task)
    : { safe: true, candidates: [], disposableCandidates: [], digest: null };
  if (!inventory.safe) blocked();
  if (existsSync(task.worktreePath)) {
    const status = runGit(task.worktreePath, ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignore-submodules=none"], { raw: true, allowFailure: true });
    if (status.status !== 0 || status.stdout !== "" || ignoredContentBlocker(task)) blocked();
  }
  if (steps.includes("TASK_ARTIFACTS_REMOVED")) {
    if (inventory.candidates.length > 0) blocked();
  } else {
    const approved = new Map(
      journal.disposableCandidates.map((candidate) => [normalizedPath(candidate.path), candidate.digest]),
    );
    const progress = journal.candidateProgress ?? [];
    const claim = journal.currentClaim;
    if (approved.size !== journal.disposableCandidates.length) blocked();
    if (journal.disposableCandidates.some((candidate) =>
      !disposablePaths(task).some((allowed) => samePath(allowed, candidate.path)))) blocked();
    if (claim) {
      const expected = journal.disposableCandidates[progress.length];
      if (!expected || claim.source !== expected.path || claim.digest !== expected.digest ||
          !validCandidateClaimPath(task, claim)) blocked();
      const sourceExists = existsSync(claim.source);
      const quarantineExists = existsSync(claim.quarantine);
      if (sourceExists && quarantineExists) blocked();
      if (sourceExists) {
        const source = inspectDisposableRoot(task, claim.source);
        if (!source.safe || source.candidate?.digest !== claim.digest) blocked();
      }
      if (quarantineExists && !inspectQuarantinedCandidate(task, claim)) blocked();
    }
    const current = new Map(
      inventory.disposableCandidates.map((candidate) => [normalizedPath(candidate.path), candidate.digest]),
    );
    for (const candidate of inventory.disposableCandidates) {
      if (approved.get(normalizedPath(candidate.path)) !== candidate.digest) blocked();
    }
    let missingUnjournaled = 0;
    for (let index = 0; index < journal.disposableCandidates.length; index += 1) {
      const candidate = journal.disposableCandidates[index];
      const exists = current.has(normalizedPath(candidate.path));
      if (index < progress.length) {
        if (progress[index] !== candidate.path || exists) blocked();
      } else if (!exists) {
        missingUnjournaled += 1;
        if (index !== progress.length || missingUnjournaled > 1) blocked();
      }
    }
  }
}

export function createTaskCleanupService(options = {}) {
  if (!isPlainObject(options)) fail("INVALID_CLEANUP_SERVICE_OPTIONS");
  const allowed = new Set([
    "readPrEvidence", "isPidActive", "isPortActive", "afterCleanupStep",
    "beforeDisposableCandidateRemoved", "afterDisposableCandidateClaimJournaled",
    "afterDisposableCandidateClaimed", "afterDisposableCandidateRemoved", "afterDisposableCandidateJournaled",
    "afterStaleCleanupLockClaimed", "afterOwnedOperationLockClaimed",
    "networkCommandRunner",
  ]);
  if (Object.keys(options).some((key) => !allowed.has(key))) fail("INVALID_CLEANUP_SERVICE_OPTIONS");
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...options };
  if (!Object.hasOwn(options, "readPrEvidence")) {
    dependencies.readPrEvidence = (input) => defaultReadPrEvidence(input, dependencies.networkCommandRunner);
  }
  if (Object.values(dependencies).some((value) => typeof value !== "function")) {
    fail("INVALID_CLEANUP_SERVICE_OPTIONS");
  }

  async function serviceFinalize(input) {
    return finalizeWithDependencies(input, dependencies);
  }

  async function serviceCleanup({ repoPath, branch, approval, now }) {
    const totalStartedAt = performance.now();
    const timings = {
      lockMs: 0,
      revalidationMs: 0,
      artifactsMs: 0,
      worktreeMs: 0,
      branchMs: 0,
      remoteMs: 0,
    };
    if (!FINGERPRINT_PATTERN.test(approval ?? "")) fail("INVALID_APPROVAL");
    if (!validTimestamp(now)) fail("INVALID_TIMESTAMP");
    const context = gitContext(repoPath);
    const { paths, task: lockTask } = readTask(context.commonDir, branch);
    const lockStartedAt = performance.now();
    const result = await withCleanupOperationLock(context, paths, lockTask, approval, now, dependencies, async (ownedLock) => {
      timings.lockMs = elapsedMs(lockStartedAt);
      let phaseStartedAt = performance.now();
      const { task } = readTask(context.commonDir, branch);
      ensureRegistryDirectory(paths.v2, paths.cleanups);
      let report;
      let journal;
      if (existsSync(paths.cleanupFile)) {
        journal = readJson(paths.cleanupFile, "CLEANUP_JOURNAL_INVALID");
        if (validateCleanupManifest(journal).length > 0 || journal.status !== "CLEANING") fail("CLEANUP_JOURNAL_INVALID");
        if (journal.snapshotFingerprint !== approval || journal.branch !== task.branch ||
            !samePath(journal.worktreePath, task.worktreePath)) fail("APPROVAL_INVALIDATED");
        await assertRecoveryState({ context, paths, task, journal, dependencies, ownedLock });
        report = {
          fingerprint: journal.snapshotFingerprint,
          candidates: journal.candidates,
          disposableInventoryDigest: journal.inventoryDigest,
          disposableCandidates: journal.disposableCandidates,
          prEvidence: { headRefOid: journal.headSha },
        };
      } else {
        report = await finalizeWithDependencies({ repoPath: context.topLevel, branch }, dependencies, ownedLock);
        if (report.fingerprint !== approval) fail("APPROVAL_INVALIDATED");
        if (!report.ready) fail("CLEANUP_BLOCKED");
        if (!report.recoveryContext) fail("CLEANUP_JOURNAL_INVALID");
        journal = {
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
          createdAt: now,
          updatedAt: now,
          cleanedAt: null,
          ...report.recoveryContext,
        };
        const journalErrors = validateCleanupManifest(journal);
        if (journalErrors.length > 0) {
          fail(`CLEANUP_JOURNAL_INVALID:${[...new Set(journalErrors.map((error) => error.code))].sort().join(",")}`);
        }
        atomicWriteJson(paths.cleanupFile, journal);
      }
      timings.revalidationMs = elapsedMs(phaseStartedAt);
      const steps = [...journal.completedSteps];
      const candidateProgress = [...(journal.candidateProgress ?? [])];
      let currentClaim = journal.currentClaim ?? null;
      let destructiveStarted = false;
      const completed = (step) => {
        if (steps.includes(step)) return;
        steps.push(step);
        journal = { ...journal, completedSteps: [...steps], updatedAt: now };
        if (validateCleanupManifest(journal).length > 0) fail("CLEANUP_JOURNAL_INVALID");
        atomicWriteJson(paths.cleanupFile, journal);
        dependencies.afterCleanupStep(step);
      };
      const completedCandidate = (candidatePath) => {
        if (candidateProgress.includes(candidatePath)) return;
        const expected = journal.disposableCandidates[candidateProgress.length]?.path;
        if (candidatePath !== expected) fail("CLEANUP_CANDIDATE_ORDER_INVALID");
        candidateProgress.push(candidatePath);
        const journalWithoutClaim = { ...journal };
        delete journalWithoutClaim.currentClaim;
        currentClaim = null;
        journal = { ...journalWithoutClaim, candidateProgress: [...candidateProgress], updatedAt: now };
        if (validateCleanupManifest(journal).length > 0) fail("CLEANUP_JOURNAL_INVALID");
        atomicWriteJson(paths.cleanupFile, journal);
        dependencies.afterDisposableCandidateJournaled(candidatePath);
        removeEmptyCandidateClaimDirectories(task);
      };
      const startCandidateClaim = (approvedCandidate) => {
        currentClaim = newCandidateClaim(task, approvedCandidate);
        journal = { ...journal, currentClaim, updatedAt: now };
        if (validateCleanupManifest(journal).length > 0) fail("CLEANUP_JOURNAL_INVALID");
        atomicWriteJson(paths.cleanupFile, journal);
        dependencies.afterDisposableCandidateClaimJournaled(currentClaim);
      };
      try {
        phaseStartedAt = performance.now();
        if (!steps.includes("TASK_ARTIFACTS_REMOVED")) {
          const inventory = inspectDisposableInventory(task);
          if (!inventory.safe) fail("TASK_ARTIFACT_PATH_ESCAPE");
          const approved = new Map(
            report.disposableCandidates.map((candidate) => [normalizedPath(candidate.path), candidate.digest]),
          );
          if (inventory.disposableCandidates.some((candidate) => !approved.has(normalizedPath(candidate.path)))) {
            fail("APPROVAL_INVALIDATED");
          }
          for (const approvedCandidate of report.disposableCandidates) {
            if (candidateProgress.includes(approvedCandidate.path)) {
              if (existsSync(approvedCandidate.path)) fail("APPROVAL_INVALIDATED");
              if (!currentClaim) removeEmptyCandidateClaimDirectories(task);
              continue;
            }
            const inspected = inspectDisposableRoot(task, approvedCandidate.path);
            if (!inspected.safe) fail("TASK_ARTIFACT_PATH_ESCAPE");
            if (inspected.candidate === null) {
              if (currentClaim?.source === approvedCandidate.path) {
                const quarantineExists = existsSync(currentClaim.quarantine);
                if (quarantineExists && !inspectQuarantinedCandidate(task, currentClaim)) fail("APPROVAL_INVALIDATED");
                if (quarantineExists) {
                  destructiveStarted = true;
                  rmSync(currentClaim.quarantine, { recursive: true, force: false });
                  if (existsSync(currentClaim.quarantine)) fail("TASK_ARTIFACT_REMOVE_NOT_VERIFIED");
                  dependencies.afterDisposableCandidateRemoved(approvedCandidate.path);
                  if (existsSync(approvedCandidate.path) || existsSync(currentClaim.quarantine)) {
                    fail("APPROVAL_INVALIDATED");
                  }
                }
              }
              destructiveStarted = true;
              completedCandidate(approvedCandidate.path);
              continue;
            }
            if (inspected.candidate.digest !== approvedCandidate.digest ||
                !samePath(inspected.candidate.path, approvedCandidate.path)) fail("APPROVAL_INVALIDATED");
            if (currentClaim && currentClaim.source !== approvedCandidate.path) fail("CLEANUP_CANDIDATE_ORDER_INVALID");
            if (!currentClaim) startCandidateClaim(approvedCandidate);
            if (!validCandidateClaimPath(task, currentClaim) || existsSync(currentClaim.quarantine)) {
              fail("APPROVAL_INVALIDATED");
            }
            dependencies.beforeDisposableCandidateRemoved(approvedCandidate.path);
            const immediate = inspectDisposableRoot(task, approvedCandidate.path);
            if (!immediate.safe || immediate.candidate === null ||
                immediate.candidate.digest !== approvedCandidate.digest ||
                !samePath(immediate.candidate.path, approvedCandidate.path)) fail("APPROVAL_INVALIDATED");
            destructiveStarted = true;
            renameSync(approvedCandidate.path, currentClaim.quarantine);
            dependencies.afterDisposableCandidateClaimed(currentClaim);
            if (existsSync(approvedCandidate.path)) fail("APPROVAL_INVALIDATED");
            if (!inspectQuarantinedCandidate(task, currentClaim)) fail("APPROVAL_INVALIDATED");
            rmSync(currentClaim.quarantine, { recursive: true, force: false });
            if (existsSync(currentClaim.quarantine)) fail("TASK_ARTIFACT_REMOVE_NOT_VERIFIED");
            dependencies.afterDisposableCandidateRemoved(approvedCandidate.path);
            if (existsSync(approvedCandidate.path) || existsSync(currentClaim.quarantine)) fail("APPROVAL_INVALIDATED");
            completedCandidate(approvedCandidate.path);
          }
          removeEmptyCandidateClaimDirectories(task);
          const finalInventory = inspectDisposableInventory(task);
          if (!finalInventory.safe || finalInventory.disposableCandidates.length > 0 || ignoredContentBlocker(task, [])) {
            fail("APPROVAL_INVALIDATED");
          }
          completed("TASK_ARTIFACTS_REMOVED");
        }
        timings.artifactsMs = elapsedMs(phaseStartedAt);
        phaseStartedAt = performance.now();
        if (!steps.includes("WORKTREE_REMOVED")) {
          removeEmptyCandidateClaimDirectories(task);
          const finalInventory = inspectDisposableInventory(task);
          if (!finalInventory.safe || finalInventory.disposableCandidates.length > 0 || ignoredContentBlocker(task, [])) {
            fail("WORKTREE_CHANGED_DURING_CLEANUP");
          }
          const status = runGit(task.worktreePath, ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignore-submodules=none"], { raw: true, allowFailure: true });
          if (status.status !== 0 || status.stdout !== "" || ignoredContentBlocker(task, [])) fail("WORKTREE_CHANGED_DURING_CLEANUP");
          const currentHead = runGit(task.worktreePath, ["rev-parse", "HEAD"]).stdout;
          if (currentHead !== report.prEvidence.headRefOid) fail("WORKTREE_CHANGED_DURING_CLEANUP");
          destructiveStarted = true;
          const removed = runGit(context.topLevel, ["worktree", "remove", task.worktreePath], { allowFailure: true });
          if (removed.status !== 0) fail("WORKTREE_REMOVE_FAILED");
          completed("WORKTREE_REMOVED");
        }
        if (!steps.includes("WORKTREE_ABSENCE_VERIFIED")) {
          const remaining = parseWorktrees(runGit(context.topLevel, ["worktree", "list", "--porcelain"]).stdout);
          if (remaining.some((entry) => samePath(entry.path, task.worktreePath))) fail("WORKTREE_REMOVE_NOT_VERIFIED");
          completed("WORKTREE_ABSENCE_VERIFIED");
        }
        timings.worktreeMs = elapsedMs(phaseStartedAt);

        phaseStartedAt = performance.now();
        if (!steps.includes("LOCAL_BRANCH_REMOVED")) {
          const branchHead = runGit(context.topLevel, ["rev-parse", "--verify", `refs/heads/${task.branch}^{commit}`], { allowFailure: true });
          if (branchHead.status !== 0 || branchHead.stdout !== report.prEvidence.headRefOid) fail("LOCAL_BRANCH_CHANGED_DURING_CLEANUP");
          const headIncluded = runGit(context.topLevel, ["merge-base", "--is-ancestor", branchHead.stdout, "origin/main"], { allowFailure: true });
          if (headIncluded.status !== 0) fail("PR_HEAD_NOT_IN_ORIGIN_MAIN");
          const upstream = runGit(context.topLevel, ["branch", "--set-upstream-to=origin/main", task.branch], { allowFailure: true });
          if (upstream.status !== 0) fail("LOCAL_BRANCH_UPSTREAM_FAILED");
          const deleted = runGit(context.topLevel, ["branch", "-d", task.branch], { allowFailure: true });
          if (deleted.status !== 0) fail("LOCAL_BRANCH_REMOVE_FAILED");
          completed("LOCAL_BRANCH_REMOVED");
        }
        timings.branchMs = elapsedMs(phaseStartedAt);

        phaseStartedAt = performance.now();
        if (!steps.includes("REMOTE_BRANCH_ABSENCE_VERIFIED")) {
          if (remoteBranchState(context.topLevel, task.branch, dependencies.networkCommandRunner) !== "absent") {
            fail("REMOTE_BRANCH_ABSENCE_NOT_VERIFIED");
          }
          completed("REMOTE_BRANCH_ABSENCE_VERIFIED");
        }
        const tombstone = {
          ...journal,
          status: "CLEANED",
          completedSteps: [...steps],
          updatedAt: now,
          cleanedAt: now,
        };
        if (validateCleanupManifest(tombstone).length > 0) fail("CLEANUP_TOMBSTONE_INVALID");
        atomicWriteJson(paths.cleanupFile, tombstone);
        steps.push("CLEANED_TOMBSTONE_WRITTEN");
        dependencies.afterCleanupStep("CLEANED_TOMBSTONE_WRITTEN");
        timings.remoteMs = elapsedMs(phaseStartedAt);
        return { status: "CLEANED", fingerprint: report.fingerprint, steps, tombstone };
      } catch (error) {
        if (!destructiveStarted && error instanceof TaskCleanupError) throw error;
        const partial = new TaskCleanupError("CLEANUP_PARTIAL_FAILURE");
        partial.completedSteps = [...steps];
        partial.failureCode = error instanceof TaskCleanupError ? error.code : "CLEANUP_STEP_FAILED";
        throw partial;
      }
    });
    return { ...result, timings: { ...timings, totalMs: elapsedMs(totalStartedAt) } };
  }

  return Object.freeze({ finalizeTask: serviceFinalize, cleanupTask: serviceCleanup });
}

const productionService = createTaskCleanupService();

export function finalizeTask(options) {
  return productionService.finalizeTask(options);
}

export function cleanupTask(options) {
  return productionService.cleanupTask(options);
}
