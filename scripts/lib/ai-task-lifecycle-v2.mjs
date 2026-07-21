import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { validateArtifactManifestV2 } from "./artifact-manifest-v2.mjs";

const BRANCH_PATTERN = /^(feat|fix|refactor|test|docs|chore|ci)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const SHA_PATTERN = /^[a-f0-9]{40}$/i;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/i;
const ACTORS = new Set(["codex", "claude", "manual"]);
const MAX_RECORD_BYTES = 64 * 1024;
const WINDOWS_RESERVED_NAMES = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  ...Array.from({ length: 9 }, (_, index) => `COM${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `LPT${index + 1}`),
]);
const UNSAFE_KEY_PATTERN = /(authorization|cookie|credential|password|private.?key|secret|token|api.?key|thread.?id|session.?id)/i;
const TASK_KEYS = new Set([
  "schemaVersion",
  "recordType",
  "taskId",
  "type",
  "slug",
  "branch",
  "baseRef",
  "baseSha",
  "gitCommonDir",
  "worktreePath",
  "state",
  "activeActor",
  "pendingActor",
  "handoffFromActor",
  "handoffSnapshotId",
  "revision",
  "createdAt",
  "updatedAt",
]);
const HANDOFF_KEYS = new Set([
  "schemaVersion",
  "recordType",
  "snapshotId",
  "taskId",
  "branch",
  "fromActor",
  "toActor",
  "revision",
  "headSha",
  "statusHash",
  "fingerprint",
  "createdAt",
]);
const CLEANUP_KEYS = new Set([
  "schemaVersion",
  "recordType",
  "taskId",
  "reportOnly",
  "snapshotFingerprint",
  "candidates",
  "createdAt",
  "status",
  "completedSteps",
  "branch",
  "worktreePath",
  "headSha",
  "inventoryDigest",
  "disposableCandidates",
  "updatedAt",
  "cleanedAt",
  "taskRevision",
  "taskState",
  "runtimeDigest",
  "prNumber",
  "prState",
  "prBaseRefName",
  "prHeadRefName",
  "mergeCommitOid",
  "mergedAt",
  "originMainSha",
  "remoteState",
]);
const CLEANUP_STEPS = Object.freeze([
  "TASK_ARTIFACTS_REMOVED",
  "WORKTREE_REMOVED",
  "WORKTREE_ABSENCE_VERIFIED",
  "LOCAL_BRANCH_REMOVED",
  "REMOTE_BRANCH_ABSENCE_VERIFIED",
]);

class TaskLifecycleError extends Error {
  constructor(code) {
    super(code);
    this.name = "TaskLifecycleError";
    this.code = code;
  }
}

function fail(code) {
  throw new TaskLifecycleError(code);
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function validationError(code, field) {
  return { code, path: field };
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateClosedObject(value, allowedKeys) {
  const errors = [];
  if (!isPlainObject(value)) return [validationError("INVALID_OBJECT", "record")];
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) errors.push(validationError("UNKNOWN_FIELD", key));
    if (UNSAFE_KEY_PATTERN.test(key) || ["__proto__", "prototype", "constructor"].includes(key)) {
      errors.push(validationError("SECRET_OR_THREAD_FIELD", key));
    }
  }
  try {
    if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAX_RECORD_BYTES) {
      errors.push(validationError("RECORD_TOO_LARGE", "record"));
    }
  } catch {
    errors.push(validationError("INVALID_SERIALIZATION", "record"));
  }
  return errors;
}

function validTimestamp(value) {
  if (typeof value !== "string" || value.length > 40) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function validTaskId(value) {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function validActor(value, nullable = false) {
  return (nullable && value === null) || ACTORS.has(value);
}

function validAbsolutePath(value) {
  return typeof value === "string" && (path.isAbsolute(value) || path.win32.isAbsolute(value));
}

function requireField(condition, errors, code, field) {
  if (!condition) errors.push(validationError(code, field));
}

export function parseTaskBranch(branch) {
  if (typeof branch !== "string") fail("INVALID_TASK_BRANCH");
  const match = BRANCH_PATTERN.exec(branch);
  if (!match) fail("INVALID_TASK_BRANCH");
  const [, type, slug] = match;
  if (slug.split("-").some((part) => WINDOWS_RESERVED_NAMES.has(part.toUpperCase()))) {
    fail("INVALID_TASK_BRANCH");
  }
  return { type, slug };
}

export function taskWorktreePath(baseCheckout, branch) {
  const { type, slug } = parseTaskBranch(branch);
  if (!validAbsolutePath(baseCheckout)) fail("INVALID_BASE_PATH");
  return path.resolve(baseCheckout, ".worktrees", `${type}-${slug}`);
}

export function validateTaskRecordV2(record) {
  const errors = validateClosedObject(record, TASK_KEYS);
  if (!isPlainObject(record)) return errors;
  requireField(record.schemaVersion === 2, errors, "INVALID_SCHEMA_VERSION", "schemaVersion");
  requireField(record.recordType === "TaskRecordV2", errors, "INVALID_RECORD_TYPE", "recordType");
  requireField(validTaskId(record.taskId), errors, "INVALID_TASK_ID", "taskId");
  let parsed = null;
  try {
    parsed = parseTaskBranch(record.branch);
  } catch {
    errors.push(validationError("INVALID_TASK_BRANCH", "branch"));
  }
  if (parsed) {
    requireField(record.type === parsed.type, errors, "TASK_TYPE_MISMATCH", "type");
    requireField(record.slug === parsed.slug, errors, "TASK_SLUG_MISMATCH", "slug");
    requireField(record.taskId === `${parsed.type}-${parsed.slug}`, errors, "TASK_ID_MISMATCH", "taskId");
  }
  requireField(record.baseRef === "origin/main", errors, "INVALID_BASE_REF", "baseRef");
  requireField(SHA_PATTERN.test(record.baseSha ?? ""), errors, "INVALID_SHA", "baseSha");
  requireField(validAbsolutePath(record.gitCommonDir), errors, "INVALID_PATH", "gitCommonDir");
  requireField(validAbsolutePath(record.worktreePath), errors, "INVALID_PATH", "worktreePath");
  requireField(["ACTIVE", "HANDOFF_PENDING", "CLEANED"].includes(record.state), errors, "INVALID_STATE", "state");
  requireField(validActor(record.activeActor, true), errors, "INVALID_ACTOR", "activeActor");
  requireField(validActor(record.pendingActor, true), errors, "INVALID_ACTOR", "pendingActor");
  requireField(validActor(record.handoffFromActor, true), errors, "INVALID_ACTOR", "handoffFromActor");
  if (record.state === "ACTIVE") {
    requireField(
      record.activeActor !== null && record.pendingActor === null && record.handoffFromActor === null,
      errors,
      "ACTOR_STATE_MISMATCH",
      "state",
    );
  }
  if (record.state === "HANDOFF_PENDING") {
    requireField(
      record.activeActor === null && record.pendingActor !== null && record.handoffFromActor !== null,
      errors,
      "ACTOR_STATE_MISMATCH",
      "state",
    );
  }
  if (record.state === "CLEANED") {
    requireField(
      record.activeActor === null && record.pendingActor === null && record.handoffFromActor === null &&
        record.handoffSnapshotId === null,
      errors,
      "ACTOR_STATE_MISMATCH",
      "state",
    );
  }
  requireField(
    record.handoffSnapshotId === null || validTaskId(record.handoffSnapshotId),
    errors,
    "INVALID_SNAPSHOT_ID",
    "handoffSnapshotId",
  );
  requireField(Number.isInteger(record.revision) && record.revision >= 1, errors, "INVALID_REVISION", "revision");
  requireField(validTimestamp(record.createdAt), errors, "INVALID_TIMESTAMP", "createdAt");
  requireField(validTimestamp(record.updatedAt), errors, "INVALID_TIMESTAMP", "updatedAt");
  if (validTimestamp(record.createdAt) && validTimestamp(record.updatedAt)) {
    requireField(Date.parse(record.updatedAt) >= Date.parse(record.createdAt), errors, "TIMESTAMP_REGRESSION", "updatedAt");
  }
  return errors;
}

export function validateHandoffSnapshot(record) {
  const errors = validateClosedObject(record, HANDOFF_KEYS);
  if (!isPlainObject(record)) return errors;
  requireField(record.schemaVersion === 2, errors, "INVALID_SCHEMA_VERSION", "schemaVersion");
  requireField(record.recordType === "HandoffSnapshot", errors, "INVALID_RECORD_TYPE", "recordType");
  requireField(validTaskId(record.snapshotId), errors, "INVALID_SNAPSHOT_ID", "snapshotId");
  requireField(validTaskId(record.taskId), errors, "INVALID_TASK_ID", "taskId");
  try {
    parseTaskBranch(record.branch);
  } catch {
    errors.push(validationError("INVALID_TASK_BRANCH", "branch"));
  }
  requireField(validActor(record.fromActor), errors, "INVALID_ACTOR", "fromActor");
  requireField(validActor(record.toActor), errors, "INVALID_ACTOR", "toActor");
  requireField(record.fromActor !== record.toActor, errors, "SAME_HANDOFF_ACTOR", "toActor");
  requireField(Number.isInteger(record.revision) && record.revision >= 2, errors, "INVALID_REVISION", "revision");
  requireField(SHA_PATTERN.test(record.headSha ?? ""), errors, "INVALID_SHA", "headSha");
  for (const field of ["statusHash", "fingerprint"]) {
    requireField(FINGERPRINT_PATTERN.test(record[field] ?? ""), errors, "INVALID_FINGERPRINT", field);
  }
  requireField(validTimestamp(record.createdAt), errors, "INVALID_TIMESTAMP", "createdAt");
  return errors;
}

export function validateArtifactManifest(record) {
  return validateArtifactManifestV2(record);
}

export function validateCleanupManifest(record) {
  const errors = validateClosedObject(record, CLEANUP_KEYS);
  if (!isPlainObject(record)) return errors;
  requireField(record.schemaVersion === 2, errors, "INVALID_SCHEMA_VERSION", "schemaVersion");
  requireField(record.recordType === "CleanupManifest", errors, "INVALID_RECORD_TYPE", "recordType");
  requireField(validTaskId(record.taskId), errors, "INVALID_TASK_ID", "taskId");
  requireField(typeof record.reportOnly === "boolean", errors, "INVALID_REPORT_ONLY", "reportOnly");
  requireField(
    FINGERPRINT_PATTERN.test(record.snapshotFingerprint ?? ""),
    errors,
    "INVALID_FINGERPRINT",
    "snapshotFingerprint",
  );
  requireField(
    Array.isArray(record.candidates) &&
      record.candidates.length <= 128 &&
      record.candidates.every((entry) => typeof entry === "string" && entry.length > 0 && entry.length <= 2048),
    errors,
    "INVALID_CANDIDATES",
    "candidates",
  );
  requireField(validTimestamp(record.createdAt), errors, "INVALID_TIMESTAMP", "createdAt");
  if (record.reportOnly === true) {
    requireField(record.status === undefined, errors, "REPORT_STATUS_FORBIDDEN", "status");
    for (const field of ["completedSteps", "branch", "worktreePath", "headSha", "inventoryDigest", "disposableCandidates", "updatedAt", "cleanedAt", "taskRevision", "taskState", "runtimeDigest", "prNumber", "prState", "prBaseRefName", "prHeadRefName", "mergeCommitOid", "mergedAt", "originMainSha", "remoteState"]) {
      requireField(record[field] === undefined, errors, "REPORT_FIELD_FORBIDDEN", field);
    }
  } else {
    requireField(["CLEANING", "CLEANED"].includes(record.status), errors, "INVALID_CLEANUP_STATUS", "status");
    const validSteps = Array.isArray(record.completedSteps) &&
      record.completedSteps.length <= CLEANUP_STEPS.length &&
      record.completedSteps.every((entry, index) => entry === CLEANUP_STEPS[index]);
    requireField(validSteps, errors, "INVALID_COMPLETED_STEPS", "completedSteps");
    try { parseTaskBranch(record.branch); } catch { errors.push(validationError("INVALID_TASK_BRANCH", "branch")); }
    requireField(validAbsolutePath(record.worktreePath), errors, "INVALID_PATH", "worktreePath");
    requireField(SHA_PATTERN.test(record.headSha ?? ""), errors, "INVALID_SHA", "headSha");
    requireField(FINGERPRINT_PATTERN.test(record.inventoryDigest ?? ""), errors, "INVALID_FINGERPRINT", "inventoryDigest");
    requireField(
      Array.isArray(record.disposableCandidates) &&
        record.disposableCandidates.length <= 16 &&
        record.disposableCandidates.every((candidate) =>
          isPlainObject(candidate) &&
          Object.keys(candidate).length === 2 &&
          validAbsolutePath(candidate.path) &&
          FINGERPRINT_PATTERN.test(candidate.digest ?? "")) &&
        new Set(record.disposableCandidates.map((candidate) => candidate.path)).size === record.disposableCandidates.length,
      errors,
      "INVALID_DISPOSABLE_CANDIDATES",
      "disposableCandidates",
    );
    requireField(validTimestamp(record.updatedAt), errors, "INVALID_TIMESTAMP", "updatedAt");
    requireField(Number.isInteger(record.taskRevision) && record.taskRevision >= 1, errors, "INVALID_REVISION", "taskRevision");
    requireField(record.taskState === "ACTIVE", errors, "INVALID_STATE", "taskState");
    requireField(FINGERPRINT_PATTERN.test(record.runtimeDigest ?? ""), errors, "INVALID_FINGERPRINT", "runtimeDigest");
    requireField(Number.isInteger(record.prNumber) && record.prNumber > 0, errors, "INVALID_PR_NUMBER", "prNumber");
    requireField(record.prState === "MERGED", errors, "INVALID_PR_STATE", "prState");
    requireField(record.prBaseRefName === "main", errors, "INVALID_PR_BASE", "prBaseRefName");
    try { parseTaskBranch(record.prHeadRefName); } catch { errors.push(validationError("INVALID_TASK_BRANCH", "prHeadRefName")); }
    requireField(record.prHeadRefName === record.branch, errors, "PR_BRANCH_MISMATCH", "prHeadRefName");
    for (const field of ["mergeCommitOid", "originMainSha"]) {
      requireField(SHA_PATTERN.test(record[field] ?? ""), errors, "INVALID_SHA", field);
    }
    requireField(validTimestamp(record.mergedAt), errors, "INVALID_TIMESTAMP", "mergedAt");
    requireField(record.remoteState === "absent", errors, "INVALID_REMOTE_STATE", "remoteState");
    if (record.status === "CLEANED") {
      requireField(validSteps && record.completedSteps.length === CLEANUP_STEPS.length, errors, "INCOMPLETE_CLEANED_STEPS", "completedSteps");
      requireField(validTimestamp(record.cleanedAt), errors, "INVALID_TIMESTAMP", "cleanedAt");
    } else {
      requireField(record.cleanedAt === null, errors, "CLEANED_AT_FORBIDDEN", "cleanedAt");
    }
  }
  return errors;
}

function runGit(
  repoPath,
  args,
  { code = "GIT_COMMAND_FAILED", allowFailure = false, raw = false } = {},
) {
  const result = spawnSync("git", ["-C", repoPath, ...args], {
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    shell: false,
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  const status = result.status ?? 1;
  if (status !== 0 && !allowFailure) fail(code);
  const stdout = String(result.stdout ?? "");
  return { status, stdout: raw ? stdout : stdout.trim(), stderr: String(result.stderr ?? "") };
}

function canonicalPath(value) {
  const resolved = path.resolve(value);
  return existsSync(resolved) ? realpathSync.native(resolved) : resolved;
}

function samePath(first, second) {
  const a = canonicalPath(first).replace(/[\\/]+$/, "");
  const b = canonicalPath(second).replace(/[\\/]+$/, "");
  return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function pathContains(parent, child) {
  const canonicalParent = canonicalPath(parent);
  const canonicalChild = canonicalPath(child);
  const relative = path.relative(canonicalParent, canonicalChild);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertSafePathPlan(root, target, code) {
  const canonicalRoot = canonicalPath(root);
  const lexicalTarget = path.resolve(target);
  const lexicalRelative = path.relative(path.resolve(root), lexicalTarget);
  if (lexicalRelative.startsWith("..") || path.isAbsolute(lexicalRelative)) fail(code);

  let cursor = path.resolve(root);
  for (const segment of lexicalRelative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    if (!existsSync(cursor)) break;
    const stats = lstatSync(cursor);
    if (stats.isSymbolicLink()) fail(code);
    const canonicalCursor = realpathSync.native(cursor);
    if (!pathContains(canonicalRoot, canonicalCursor)) fail(code);
  }
}

function resolveGitPath(repoPath, value) {
  return canonicalPath(path.isAbsolute(value) ? value : path.resolve(repoPath, value));
}

function gitContext(repoPath, { requireBase = false } = {}) {
  if (!validAbsolutePath(repoPath) || !existsSync(repoPath) || !lstatSync(repoPath).isDirectory()) {
    fail("REPOSITORY_REQUIRED");
  }
  const topLevel = runGit(repoPath, ["rev-parse", "--show-toplevel"], { code: "REPOSITORY_REQUIRED" }).stdout;
  const commonRaw = runGit(repoPath, ["rev-parse", "--git-common-dir"], { code: "REPOSITORY_REQUIRED" }).stdout;
  const gitDirRaw = runGit(repoPath, ["rev-parse", "--git-dir"], { code: "REPOSITORY_REQUIRED" }).stdout;
  const commonDir = resolveGitPath(repoPath, commonRaw);
  const gitDir = resolveGitPath(repoPath, gitDirRaw);
  if (requireBase && (!samePath(repoPath, topLevel) || !samePath(commonDir, gitDir))) {
    fail("BASE_CHECKOUT_REQUIRED");
  }
  return { topLevel: canonicalPath(topLevel), commonDir, gitDir };
}

function parseWorktrees(output) {
  const records = [];
  let current = null;
  for (const line of `${output}\n`.split(/\r?\n/)) {
    if (line.startsWith("worktree ")) {
      if (current) records.push(current);
      current = { path: line.slice(9), branch: null };
    } else if (current && line.startsWith("branch refs/heads/")) {
      current.branch = line.slice("branch refs/heads/".length);
    } else if (line === "" && current) {
      records.push(current);
      current = null;
    }
  }
  return records;
}

function assertActor(actor) {
  if (!ACTORS.has(actor)) fail("INVALID_ACTOR");
}

function registryPaths(commonDir, branch) {
  const { type, slug } = parseTaskBranch(branch);
  const lifecycleRoot = path.join(commonDir, "talkpik-task-lifecycle");
  const root = path.join(lifecycleRoot, "v2");
  const taskId = `${type}-${slug}`;
  return {
    lifecycleRoot,
    root,
    tasks: path.join(root, "tasks"),
    handoffs: path.join(root, "handoffs"),
    cleanups: path.join(root, "cleanups"),
    taskId,
    taskFile: path.join(root, "tasks", `${taskId}.json`),
    lockFile: path.join(root, "tasks", `${taskId}.lock`),
    cleanupFile: path.join(root, "cleanups", `${taskId}.json`),
  };
}

function assertRegistryDirectory(value, commonDir) {
  assertSafePathPlan(commonDir, value, "REGISTRY_PATH_ESCAPE");
  if (existsSync(value) && !lstatSync(value).isDirectory()) fail("REGISTRY_PATH_ESCAPE");
}

function prepareRegistry(commonDir, branch) {
  const paths = registryPaths(commonDir, branch);
  for (const value of [paths.lifecycleRoot, paths.root, paths.tasks, paths.handoffs]) {
    assertRegistryDirectory(value, commonDir);
    if (!existsSync(value)) mkdirSync(value);
    assertRegistryDirectory(value, commonDir);
  }
  return paths;
}

function atomicWriteJson(filePath, value) {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    renameSync(tempPath, filePath);
  } finally {
    if (existsSync(tempPath)) unlinkSync(tempPath);
  }
}

function withTaskOperationLock(paths, operation) {
  const token = `${process.pid}:${randomUUID()}`;
  let identity;
  try {
    writeFileSync(paths.lockFile, `${token}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    identity = lstatSync(paths.lockFile);
  } catch (error) {
    if (error?.code === "EEXIST") fail("TASK_OPERATION_IN_PROGRESS");
    fail("TASK_OPERATION_LOCK_FAILED");
  }
  try {
    return operation();
  } finally {
    if (existsSync(paths.lockFile)) {
      const currentIdentity = lstatSync(paths.lockFile);
      const sameIdentity =
        currentIdentity.dev === identity.dev &&
        currentIdentity.ino === identity.ino &&
        currentIdentity.birthtimeMs === identity.birthtimeMs;
      if (sameIdentity && readFileSync(paths.lockFile, "utf8") === `${token}\n`) {
        unlinkSync(paths.lockFile);
      }
    }
  }
}

function readJson(filePath, validator, missingCode) {
  if (!existsSync(filePath)) fail(missingCode);
  if (lstatSync(filePath).isSymbolicLink()) fail("REGISTRY_PATH_ESCAPE");
  const bytes = readFileSync(filePath);
  if (bytes.byteLength > MAX_RECORD_BYTES) fail("REGISTRY_RECORD_TOO_LARGE");
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("REGISTRY_RECORD_INVALID");
  }
  if (validator(value).length > 0) fail("REGISTRY_RECORD_INVALID");
  return value;
}

function readTask(commonDir, branch) {
  const paths = registryPaths(commonDir, branch);
  for (const value of [paths.lifecycleRoot, paths.root, paths.tasks, paths.handoffs]) {
    assertRegistryDirectory(value, commonDir);
  }
  return { paths, task: readJson(paths.taskFile, validateTaskRecordV2, "TASK_NOT_FOUND") };
}

function writeTask(paths, task) {
  if (validateTaskRecordV2(task).length > 0) fail("TASK_RECORD_INVALID");
  atomicWriteJson(paths.taskFile, task);
}

function statusOutput(worktreePath) {
  return runGit(
    worktreePath,
    ["-c", "core.quotepath=false", "status", "--porcelain=v2", "-z", "--untracked-files=all", "--ignore-submodules=none"],
    { code: "WORKTREE_STATUS_FAILED", raw: true },
  ).stdout;
}

function worktreeContentHash(worktreePath, rawStatus) {
  const unstaged = runGit(worktreePath, ["diff", "--no-ext-diff", "--binary", "--"], {
    code: "WORKTREE_DIFF_FAILED",
    raw: true,
  }).stdout;
  const staged = runGit(worktreePath, ["diff", "--cached", "--no-ext-diff", "--binary", "--"], {
    code: "WORKTREE_DIFF_FAILED",
    raw: true,
  }).stdout;
  const untrackedOutput = runGit(
    worktreePath,
    ["ls-files", "--others", "--exclude-standard", "-z"],
    { code: "WORKTREE_STATUS_FAILED", raw: true },
  ).stdout;
  const digest = createHash("sha256");
  digest.update("status\0").update(rawStatus);
  digest.update("unstaged\0").update(unstaged);
  digest.update("staged\0").update(staged);
  for (const relativePath of untrackedOutput.split("\0").filter(Boolean).sort()) {
    const absolutePath = path.resolve(worktreePath, relativePath);
    const relative = path.relative(worktreePath, absolutePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) fail("WORKTREE_PATH_ESCAPE");
    const stats = lstatSync(absolutePath);
    if (!stats.isFile()) fail("UNSUPPORTED_UNTRACKED_ENTRY");
    digest.update("untracked\0").update(relativePath).update("\0");
    digest.update(readFileSync(absolutePath));
  }
  return digest.digest("hex");
}

export function computeWorktreeFingerprint(worktreePath) {
  const context = gitContext(worktreePath);
  const headSha = runGit(worktreePath, ["rev-parse", "HEAD"], { code: "WORKTREE_HEAD_FAILED" }).stdout;
  const rawStatus = statusOutput(worktreePath);
  const statusHash = worktreeContentHash(worktreePath, rawStatus);
  const fingerprint = hash(
    JSON.stringify({ headSha, statusHash, worktreePath: canonicalPath(context.topLevel) }),
  );
  return Object.freeze({
    headSha,
    statusHash,
    fingerprint,
    worktreePath: canonicalPath(context.topLevel),
  });
}

function computeHandoffFingerprint(worktreeState, metadata) {
  return hash(
    JSON.stringify({
      taskId: metadata.taskId,
      branch: metadata.branch,
      fromActor: metadata.fromActor,
      toActor: metadata.toActor,
      revision: metadata.revision,
      snapshotId: metadata.snapshotId,
      createdAt: metadata.createdAt,
      headSha: worktreeState.headSha,
      statusHash: worktreeState.statusHash,
      worktreePath: worktreeState.worktreePath,
    }),
  );
}

function branchExists(repoPath, branch) {
  const result = runGit(repoPath, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], {
    allowFailure: true,
  });
  if (![0, 1].includes(result.status)) fail("BRANCH_CHECK_FAILED");
  return result.status === 0;
}

function assertRemoteTaskBranchAbsent(repoPath, branch) {
  const result = runGit(
    repoPath,
    ["ls-remote", "--exit-code", "--heads", "origin", `refs/heads/${branch}`],
    { allowFailure: true },
  );
  if (result.status === 0) fail("REMOTE_TASK_BRANCH_EXISTS");
  if (result.status === 2) return;
  fail("REMOTE_BRANCH_EVIDENCE_UNAVAILABLE");
}

function assertTaskBranchAtWorktree(worktreePath, expectedBranch) {
  const actualBranch = runGit(worktreePath, ["symbolic-ref", "--quiet", "--short", "HEAD"], {
    allowFailure: true,
  });
  if (actualBranch.status !== 0 || actualBranch.stdout !== expectedBranch) {
    fail("TASK_BRANCH_MISMATCH");
  }
}

function nativeWorktreeOwner(repoPath, worktreePath, branch) {
  const output = runGit(repoPath, ["worktree", "list", "--porcelain"], { code: "WORKTREE_LIST_FAILED" }).stdout;
  return parseWorktrees(output).find(
    (record) => samePath(record.path, worktreePath) || record.branch === branch,
  );
}

function rollbackNewTask({ repoPath, worktreePath, branch, baseSha, taskFile }) {
  if (existsSync(taskFile) || !existsSync(worktreePath)) return false;
  const branchTip = runGit(repoPath, ["rev-parse", "--verify", `refs/heads/${branch}^{commit}`], {
    allowFailure: true,
  });
  if (branchTip.status !== 0 || branchTip.stdout !== baseSha) return false;
  const includedInOriginMain = runGit(
    repoPath,
    ["merge-base", "--is-ancestor", baseSha, "origin/main"],
    { allowFailure: true },
  );
  if (includedInOriginMain.status !== 0) return false;
  const allChanges = runGit(
    worktreePath,
    [
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=all",
      "--ignored=matching",
      "--ignore-submodules=none",
    ],
    { allowFailure: true, raw: true },
  );
  if (allChanges.status !== 0 || allChanges.stdout !== "") return false;

  const removed = runGit(repoPath, ["worktree", "remove", worktreePath], { allowFailure: true });
  if (removed.status !== 0 || existsSync(worktreePath)) return false;
  const stillOwned = nativeWorktreeOwner(repoPath, worktreePath, branch);
  if (stillOwned && samePath(stillOwned.path, worktreePath)) return false;

  const upstreamSet = runGit(
    repoPath,
    ["branch", "--set-upstream-to=origin/main", branch],
    { allowFailure: true },
  );
  if (upstreamSet.status !== 0) return false;
  const deleted = runGit(repoPath, ["branch", "-d", branch], { allowFailure: true });
  if (deleted.status !== 0 || branchExists(repoPath, branch)) return false;
  return nativeWorktreeOwner(repoPath, worktreePath, branch) === undefined;
}

function startTaskWithDependencies(
  { repoPath, branch, actor, now, expectedBaseSha = null },
  dependencies,
) {
  assertActor(actor);
  if (!validTimestamp(now)) fail("INVALID_TIMESTAMP");
  const parsed = parseTaskBranch(branch);
  const context = gitContext(repoPath, { requireBase: true });
  const worktreePath = taskWorktreePath(context.topLevel, branch);
  assertSafePathPlan(context.topLevel, worktreePath, "WORKTREE_PATH_ESCAPE");

  if (branchExists(context.topLevel, branch)) fail("TASK_BRANCH_EXISTS");
  if (nativeWorktreeOwner(context.topLevel, worktreePath, branch)) fail("TASK_WORKTREE_OWNED");
  if (existsSync(worktreePath)) fail("TASK_WORKTREE_PATH_EXISTS");
  if (statusOutput(context.topLevel) !== "") fail("BASE_DIRTY");
  assertRemoteTaskBranchAbsent(context.topLevel, branch);

  const fetchResult = runGit(context.topLevel, ["fetch", "--prune", "origin"], {
    code: "FETCH_FAILED",
    allowFailure: true,
  });
  if (fetchResult.status !== 0) fail("FETCH_FAILED");
  const baseSha = runGit(context.topLevel, ["rev-parse", "--verify", "origin/main^{commit}"], {
    code: "ORIGIN_MAIN_REQUIRED",
  }).stdout;
  if (!SHA_PATTERN.test(baseSha)) fail("ORIGIN_MAIN_REQUIRED");
  if (expectedBaseSha !== null && expectedBaseSha !== baseSha) fail("STALE_BASE");
  assertRemoteTaskBranchAbsent(context.topLevel, branch);

  if (branchExists(context.topLevel, branch)) fail("TASK_BRANCH_EXISTS");
  if (nativeWorktreeOwner(context.topLevel, worktreePath, branch)) fail("TASK_WORKTREE_OWNED");
  if (existsSync(worktreePath)) fail("TASK_WORKTREE_PATH_EXISTS");

  const paths = prepareRegistry(context.commonDir, branch);
  return withTaskOperationLock(paths, () => {
    if (existsSync(paths.taskFile)) fail("TASK_RECORD_EXISTS");
    if (branchExists(context.topLevel, branch)) fail("TASK_BRANCH_EXISTS");
    if (nativeWorktreeOwner(context.topLevel, worktreePath, branch)) fail("TASK_WORKTREE_OWNED");
    if (existsSync(worktreePath)) fail("TASK_WORKTREE_PATH_EXISTS");
    if (statusOutput(context.topLevel) !== "") fail("BASE_DIRTY");
    assertRemoteTaskBranchAbsent(context.topLevel, branch);
    const currentOriginSha = runGit(context.topLevel, ["rev-parse", "--verify", "origin/main^{commit}"], {
      code: "ORIGIN_MAIN_REQUIRED",
    }).stdout;
    if (currentOriginSha !== baseSha) fail("STALE_BASE");

    const worktreeRoot = path.dirname(worktreePath);
    assertSafePathPlan(context.topLevel, worktreeRoot, "WORKTREE_PATH_ESCAPE");
    if (!existsSync(worktreeRoot)) mkdirSync(worktreeRoot);
    assertSafePathPlan(context.topLevel, worktreeRoot, "WORKTREE_PATH_ESCAPE");

    let created = false;
    try {
      runGit(context.topLevel, ["worktree", "add", "-b", branch, worktreePath, baseSha], {
        code: "WORKTREE_CREATE_FAILED",
      });
      created = true;
      assertSafePathPlan(context.topLevel, worktreePath, "WORKTREE_PATH_ESCAPE");
      const createdHead = runGit(worktreePath, ["rev-parse", "HEAD"], {
        code: "WORKTREE_VERIFY_FAILED",
      }).stdout;
      const createdBranch = runGit(worktreePath, ["branch", "--show-current"], {
        code: "WORKTREE_VERIFY_FAILED",
      }).stdout;
      if (createdHead !== baseSha || createdBranch !== branch) fail("WORKTREE_VERIFY_FAILED");

      dependencies.afterWorktreeCreated({
        repoPath: context.topLevel,
        worktreePath,
        branch,
        lockFile: paths.lockFile,
      });
      const record = {
        schemaVersion: 2,
        recordType: "TaskRecordV2",
        taskId: paths.taskId,
        type: parsed.type,
        slug: parsed.slug,
        branch,
        baseRef: "origin/main",
        baseSha,
        gitCommonDir: context.commonDir,
        worktreePath: canonicalPath(worktreePath),
        state: "ACTIVE",
        activeActor: actor,
        pendingActor: null,
        handoffFromActor: null,
        handoffSnapshotId: null,
        revision: 1,
        createdAt: now,
        updatedAt: now,
      };
      dependencies.persistTask(paths, record);
      return structuredClone(record);
    } catch (error) {
      if (
        !created ||
        rollbackNewTask({
          repoPath: context.topLevel,
          worktreePath,
          branch,
          baseSha,
          taskFile: paths.taskFile,
        })
      ) {
        throw error;
      }
      fail("START_FAILED_TASK_PRESERVED");
    }
  });
}

const DEFAULT_TASK_DEPENDENCIES = Object.freeze({
  afterWorktreeCreated() {},
  persistTask: writeTask,
});

export function createTaskLifecycleService(options = {}) {
  if (!isPlainObject(options)) fail("INVALID_TASK_SERVICE_OPTIONS");
  const allowed = new Set(["afterWorktreeCreated", "persistTask"]);
  if (Object.keys(options).some((key) => !allowed.has(key))) fail("INVALID_TASK_SERVICE_OPTIONS");
  const dependencies = {
    afterWorktreeCreated: options.afterWorktreeCreated ?? DEFAULT_TASK_DEPENDENCIES.afterWorktreeCreated,
    persistTask: options.persistTask ?? DEFAULT_TASK_DEPENDENCIES.persistTask,
  };
  if (
    typeof dependencies.afterWorktreeCreated !== "function" ||
    typeof dependencies.persistTask !== "function"
  ) {
    fail("INVALID_TASK_SERVICE_OPTIONS");
  }
  return Object.freeze({
    startTask(optionsForTask) {
      return startTaskWithDependencies(optionsForTask, dependencies);
    },
  });
}

export function startTask(options) {
  return startTaskWithDependencies(options, DEFAULT_TASK_DEPENDENCIES);
}

export function readTaskStatus({ repoPath, branch }) {
  const context = gitContext(repoPath);
  const { paths, task } = readTask(context.commonDir, branch);
  let handoffSnapshot = null;
  if (task.handoffSnapshotId !== null) {
    handoffSnapshot = readJson(
      path.join(paths.handoffs, `${task.handoffSnapshotId}.json`),
      validateHandoffSnapshot,
      "HANDOFF_SNAPSHOT_NOT_FOUND",
    );
  }
  let cleanupManifest = null;
  assertRegistryDirectory(paths.cleanups, context.commonDir);
  if (existsSync(paths.cleanupFile)) {
    cleanupManifest = readJson(paths.cleanupFile, validateCleanupManifest, "CLEANUP_MANIFEST_NOT_FOUND");
  }
  const validCleanedTombstone = cleanupManifest?.status === "CLEANED" &&
    cleanupManifest.taskId === task.taskId &&
    cleanupManifest.branch === task.branch &&
    samePath(cleanupManifest.worktreePath, task.worktreePath) &&
    cleanupManifest.taskRevision === task.revision &&
    cleanupManifest.taskState === task.state &&
    task.state === "ACTIVE";
  const effectiveTask = validCleanedTombstone
    ? {
        ...task,
        state: "CLEANED",
        activeActor: null,
        pendingActor: null,
        handoffFromActor: null,
        handoffSnapshotId: null,
      }
    : task;
  return {
    task: structuredClone(effectiveTask),
    handoffSnapshot: structuredClone(handoffSnapshot),
    cleanupManifest: structuredClone(cleanupManifest),
  };
}

export function handoffTask({ repoPath, branch, actor, toActor, now }) {
  assertActor(actor);
  assertActor(toActor);
  if (actor === toActor) fail("SAME_HANDOFF_ACTOR");
  if (!validTimestamp(now)) fail("INVALID_TIMESTAMP");
  const context = gitContext(repoPath);
  const paths = prepareRegistry(context.commonDir, branch);
  return withTaskOperationLock(paths, () => {
    const { task } = readTask(context.commonDir, branch);
    if (!samePath(context.topLevel, task.worktreePath)) fail("TASK_WORKTREE_MISMATCH");
    assertTaskBranchAtWorktree(task.worktreePath, task.branch);
    if (task.state !== "ACTIVE" || task.activeActor !== actor) fail("AGENT_ALREADY_ACTIVE");
    if (Date.parse(now) < Date.parse(task.updatedAt)) fail("TIMESTAMP_REGRESSION");
    const current = computeWorktreeFingerprint(task.worktreePath);
    const snapshotId = `${task.taskId}-handoff-${task.revision + 1}`;
    const metadata = {
      taskId: task.taskId,
      branch: task.branch,
      fromActor: actor,
      toActor,
      revision: task.revision + 1,
      snapshotId,
      createdAt: now,
    };
    const snapshot = {
      schemaVersion: 2,
      recordType: "HandoffSnapshot",
      ...metadata,
      headSha: current.headSha,
      statusHash: current.statusHash,
      fingerprint: computeHandoffFingerprint(current, metadata),
    };
    if (validateHandoffSnapshot(snapshot).length > 0) fail("HANDOFF_SNAPSHOT_INVALID");
    atomicWriteJson(path.join(paths.handoffs, `${snapshotId}.json`), snapshot);
    const next = {
      ...task,
      state: "HANDOFF_PENDING",
      activeActor: null,
      pendingActor: toActor,
      handoffFromActor: actor,
      handoffSnapshotId: snapshotId,
      revision: task.revision + 1,
      updatedAt: now,
    };
    writeTask(paths, next);
    return { ...structuredClone(next), handoffSnapshot: structuredClone(snapshot) };
  });
}

export function resumeTask({ repoPath, branch, actor, now }) {
  assertActor(actor);
  if (!validTimestamp(now)) fail("INVALID_TIMESTAMP");
  const context = gitContext(repoPath);
  const paths = prepareRegistry(context.commonDir, branch);
  return withTaskOperationLock(paths, () => {
    const { task } = readTask(context.commonDir, branch);
    if (!samePath(context.topLevel, task.worktreePath)) fail("TASK_WORKTREE_MISMATCH");
    assertTaskBranchAtWorktree(task.worktreePath, task.branch);
    if (task.state === "ACTIVE") fail("AGENT_ALREADY_ACTIVE");
    if (task.state !== "HANDOFF_PENDING" || task.pendingActor !== actor) {
      fail("HANDOFF_ACTOR_MISMATCH");
    }
    if (Date.parse(now) < Date.parse(task.updatedAt)) fail("TIMESTAMP_REGRESSION");
    const snapshot = readJson(
      path.join(paths.handoffs, `${task.handoffSnapshotId}.json`),
      validateHandoffSnapshot,
      "HANDOFF_SNAPSHOT_NOT_FOUND",
    );
    if (
      snapshot.taskId !== task.taskId ||
      snapshot.branch !== task.branch ||
      snapshot.fromActor !== task.handoffFromActor ||
      snapshot.toActor !== task.pendingActor ||
      snapshot.toActor !== actor ||
      snapshot.revision !== task.revision ||
      snapshot.snapshotId !== task.handoffSnapshotId ||
      snapshot.createdAt !== task.updatedAt ||
      Date.parse(snapshot.createdAt) < Date.parse(task.createdAt)
    ) {
      fail("HANDOFF_SNAPSHOT_MISMATCH");
    }
    const current = computeWorktreeFingerprint(task.worktreePath);
    if (
      current.headSha !== snapshot.headSha ||
      current.statusHash !== snapshot.statusHash ||
      computeHandoffFingerprint(current, snapshot) !== snapshot.fingerprint
    ) {
      fail("HANDOFF_FINGERPRINT_MISMATCH");
    }
    const next = {
      ...task,
      state: "ACTIVE",
      activeActor: actor,
      pendingActor: null,
      handoffFromActor: null,
      revision: task.revision + 1,
      updatedAt: now,
    };
    writeTask(paths, next);
    return structuredClone(next);
  });
}

export function readLegacyCodexHints({ codexHome, repoId }) {
  if (!validAbsolutePath(codexHome) || !validTaskId(repoId)) return [];
  const directory = path.join(codexHome, "worktree-lifecycle", repoId);
  if (!existsSync(directory) || !lstatSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink()) {
    return [];
  }
  const hints = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const filePath = path.join(directory, entry.name);
    if (lstatSync(filePath).isSymbolicLink() || lstatSync(filePath).size > MAX_RECORD_BYTES) continue;
    try {
      const value = JSON.parse(readFileSync(filePath, "utf8"));
      if (
        value?.schemaVersion === 1 &&
        typeof value.taskId === "string" &&
        typeof value.worktreePath === "string" &&
        typeof value.owner === "string"
      ) {
        hints.push({ taskId: value.taskId, worktreePath: value.worktreePath, owner: value.owner });
      }
    } catch {
      // A legacy record is an optional read-only hint; malformed files are ignored.
    }
  }
  return hints.sort((first, second) => first.taskId.localeCompare(second.taskId));
}
