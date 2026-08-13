import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseTaskBranch,
  readTaskStatus,
  startTask,
  validateCleanupManifest,
  validateTaskRecordV2,
} from "./ai-task-lifecycle-v2.mjs";

const SHA_PATTERN = /^[a-f0-9]{40}$/iu;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;
const TASK_ID_PATTERN = /^task-[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const ACTORS = new Set(["codex", "claude"]);
const STATES = new Set(["ACTIVE", "PR_OPEN", "MERGED", "CLEANED", "RELEASED", "PRESERVED"]);
const WORKSPACE_KINDS = new Set(["shared-slot", "isolated", "adopted", "host"]);
const OWNERSHIP_KINDS = new Set(["managed", "adopted", "host"]);
const CLEANUP_POLICIES = new Set(["auto-after-merge", "release-only", "preserve"]);
const TERMINAL_STATES = new Set(["CLEANED", "RELEASED", "PRESERVED"]);
const REUSABLE_STATES = new Set(["CLEANED", "RELEASED"]);
const MAX_RECORD_BYTES = 64 * 1024;
const UNSAFE_KEY_PATTERN =
  /(authorization|cookie|credential|password|private.?key|secret|token|api.?key|thread.?id|session.?id)/iu;
const SENSITIVE_VALUE_PATTERNS = Object.freeze([
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/u,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/u,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/u,
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/u,
  /\b(?:thread|session|conversation)[ _-]?id[ \t]*[:=][ \t]*[A-Za-z0-9._:-]{16,}/iu,
  /\/threads\/[A-Za-z0-9._:-]{16,}/iu,
]);

const RECORD_KEYS = new Set([
  "schemaVersion",
  "recordType",
  "taskId",
  "repoProfile",
  "baseSha",
  "headSha",
  "branch",
  "workspace",
  "activeActor",
  "pendingActor",
  "handoffFromActor",
  "revision",
  "runtimeRef",
  "artifactManifestRef",
  "cleanupPolicy",
  "state",
  "blockers",
  "createdAt",
  "updatedAt",
  "fingerprint",
]);
const REPO_PROFILE_KEYS = new Set(["name", "remote", "repositoryIdentity", "authLogin", "baseBranch"]);
const BRANCH_KEYS = new Set(["name", "type", "slug"]);
const WORKSPACE_KEYS = new Set(["kind", "ownership", "path", "gitDir"]);
const RUNTIME_SNAPSHOT_KEYS = new Set([
  "schemaVersion",
  "recordType",
  "taskId",
  "branch",
  "actor",
  "ports",
  "pids",
  "lockPaths",
  "createdAt",
  "fingerprint",
]);
const MERGE_EVIDENCE_KEYS = new Set([
  "schemaVersion",
  "recordType",
  "source",
  "repositoryIdentity",
  "authLogin",
  "targetBranch",
  "headSha",
  "mainSha",
  "mergedAt",
  "remoteBranch",
  "production",
]);
const REMOTE_BRANCH_EVIDENCE_KEYS = new Set(["exists", "sha"]);
const PRODUCTION_EVIDENCE_KEYS = new Set(["ready", "commitSha"]);
const AUTOCLEANUP_ELIGIBLE_STATES = new Set(["ACTIVE", "PR_OPEN", "MERGED"]);
const AUTOCLEANUP_COOLDOWN_MS = 15 * 60 * 1000;

class TaskLifecycleV3Error extends Error {
  constructor(code) {
    super(code);
    this.name = "TaskLifecycleV3Error";
    this.code = code;
  }
}

function fail(code) {
  throw new TaskLifecycleV3Error(code);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function error(code, field) {
  return { code, path: field };
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, stableValue(value[key])]),
  );
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fingerprintRecord(record) {
  const payload = structuredClone(record);
  delete payload.fingerprint;
  return hash(JSON.stringify(stableValue(payload)));
}

function validTimestamp(value) {
  if (typeof value !== "string" || value.length > 40) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function validText(value, max = 2048) {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

function sensitiveValue(value) {
  return typeof value === "string" && SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function validateClosedObject(value, allowed, prefix) {
  if (!isPlainObject(value)) return [error("INVALID_OBJECT", prefix)];
  const errors = [];
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(error("UNKNOWN_FIELD", prefix ? `${prefix}.${key}` : key));
    if (UNSAFE_KEY_PATTERN.test(key) || ["__proto__", "prototype", "constructor"].includes(key)) {
      errors.push(error("SECRET_OR_THREAD_FIELD", prefix ? `${prefix}.${key}` : key));
    }
  }
  return errors;
}

function collectSensitiveValues(value, prefix = "record", errors = []) {
  if (typeof value === "string" && sensitiveValue(value)) {
    errors.push(error("SECRET_OR_THREAD_VALUE", prefix));
    return errors;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectSensitiveValues(entry, `${prefix}.${index}`, errors));
  } else if (isPlainObject(value)) {
    for (const [key, entry] of Object.entries(value)) {
      collectSensitiveValues(entry, `${prefix}.${key}`, errors);
    }
  }
  return errors;
}

function canonicalPath(value) {
  const resolved = path.resolve(value);
  return existsSync(resolved) ? realpathSync.native(resolved) : resolved;
}

function pathKey(value) {
  return canonicalPath(value).replace(/[\\/]+$/u, "").toLowerCase();
}

function pathContains(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function samePath(first, second) {
  return pathKey(first) === pathKey(second);
}

function assertPathPlan(root, target, code) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  if (!pathContains(resolvedRoot, resolvedTarget)) fail(code);
  let cursor = resolvedRoot;
  const relative = path.relative(resolvedRoot, resolvedTarget);
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    if (!existsSync(cursor)) break;
    if (lstatSync(cursor).isSymbolicLink()) fail(code);
    if (!pathContains(canonicalPath(resolvedRoot), canonicalPath(cursor))) fail(code);
  }
}

function assertExistingUnlinkedPath(target, code) {
  const resolved = path.resolve(target);
  let cursor = path.parse(resolved).root;
  for (const segment of path.relative(cursor, resolved).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    if (!existsSync(cursor)) fail(code);
    const stats = lstatSync(cursor);
    if (stats.isSymbolicLink()) fail(code);
    const lexical = path.resolve(cursor).replace(/[\\/]+$/u, "").toLowerCase();
    const physical = realpathSync.native(cursor).replace(/[\\/]+$/u, "").toLowerCase();
    if (lexical !== physical) fail(code);
  }
}

function managedWorkspaceErrors(record, repoPath) {
  const errors = [];
  if (record?.workspace?.ownership !== "managed") return errors;
  const workspacePath = path.resolve(record.workspace.path);
  const expectedRoot = path.dirname(workspacePath);
  const managedRoot = path.dirname(expectedRoot);
  const callerPath = path.resolve(repoPath);
  if (
    pathKey(path.basename(expectedRoot)) !== pathKey(".worktrees") ||
    (!samePath(callerPath, managedRoot) && !samePath(callerPath, workspacePath)) ||
    !pathContains(expectedRoot, workspacePath)
  ) {
    errors.push(error("WORKSPACE_PATH_ESCAPE", "workspace.path"));
  }
  if (record.workspace.kind === "shared-slot" &&
      pathKey(workspacePath) !== pathKey(path.join(expectedRoot, "shared-dev"))) {
    errors.push(error("INVALID_SHARED_SLOT_PATH", "workspace.path"));
  }
  return errors;
}

export function validateTaskRecordV3(record, { repoPath = null } = {}) {
  const errors = validateClosedObject(record, RECORD_KEYS, "");
  if (!isPlainObject(record)) return errors;
  errors.push(...validateClosedObject(record.repoProfile, REPO_PROFILE_KEYS, "repoProfile"));
  if (record.branch !== null) errors.push(...validateClosedObject(record.branch, BRANCH_KEYS, "branch"));
  errors.push(...validateClosedObject(record.workspace, WORKSPACE_KEYS, "workspace"));
  errors.push(...collectSensitiveValues(record));
  if (record.schemaVersion !== 3) errors.push(error("INVALID_SCHEMA_VERSION", "schemaVersion"));
  if (record.recordType !== "TaskRecordV3") errors.push(error("INVALID_RECORD_TYPE", "recordType"));
  if (!TASK_ID_PATTERN.test(record.taskId ?? "")) errors.push(error("INVALID_TASK_ID", "taskId"));
  if (isPlainObject(record.repoProfile)) {
    for (const field of REPO_PROFILE_KEYS) {
      if (!validText(record.repoProfile[field], 4096)) errors.push(error("INVALID_TEXT", `repoProfile.${field}`));
    }
    if (record.repoProfile.remote !== "origin") errors.push(error("INVALID_REMOTE", "repoProfile.remote"));
    if (record.repoProfile.baseBranch !== "main") errors.push(error("INVALID_BASE_BRANCH", "repoProfile.baseBranch"));
  }
  if (!SHA_PATTERN.test(record.baseSha ?? "")) errors.push(error("INVALID_SHA", "baseSha"));
  if (!SHA_PATTERN.test(record.headSha ?? "")) errors.push(error("INVALID_SHA", "headSha"));
  if (record.branch !== null && isPlainObject(record.branch)) {
    try {
      const parsed = parseTaskBranch(record.branch.name);
      if (record.branch.type !== parsed.type) errors.push(error("BRANCH_TYPE_MISMATCH", "branch.type"));
      if (record.branch.slug !== parsed.slug) errors.push(error("BRANCH_SLUG_MISMATCH", "branch.slug"));
    } catch {
      errors.push(error("INVALID_TASK_BRANCH", "branch.name"));
    }
  }
  if (isPlainObject(record.workspace)) {
    if (!WORKSPACE_KINDS.has(record.workspace.kind)) errors.push(error("INVALID_WORKSPACE_KIND", "workspace.kind"));
    if (!OWNERSHIP_KINDS.has(record.workspace.ownership)) {
      errors.push(error("INVALID_WORKSPACE_OWNERSHIP", "workspace.ownership"));
    }
    if (!path.isAbsolute(record.workspace.path ?? "")) errors.push(error("INVALID_PATH", "workspace.path"));
    if (!path.isAbsolute(record.workspace.gitDir ?? "")) errors.push(error("INVALID_PATH", "workspace.gitDir"));
    const expectedOwnership =
      record.workspace.kind === "host" ? "host"
        : record.workspace.kind === "adopted" ? "adopted"
          : "managed";
    if (record.workspace.ownership !== expectedOwnership) {
      errors.push(error("WORKSPACE_OWNERSHIP_MISMATCH", "workspace.ownership"));
    }
  }
  const actorAllowed = record.activeActor === null || ACTORS.has(record.activeActor);
  if (!actorAllowed) errors.push(error("INVALID_ACTOR", "activeActor"));
  const pendingActorAllowed = record.pendingActor === null || ACTORS.has(record.pendingActor);
  const handoffActorAllowed = record.handoffFromActor === null || ACTORS.has(record.handoffFromActor);
  if (!pendingActorAllowed) errors.push(error("INVALID_ACTOR", "pendingActor"));
  if (!handoffActorAllowed) errors.push(error("INVALID_ACTOR", "handoffFromActor"));
  if ((record.pendingActor === null) !== (record.handoffFromActor === null)) {
    errors.push(error("INVALID_HANDOFF_STATE", "pendingActor"));
  }
  if (record.pendingActor !== null &&
      (record.activeActor !== record.handoffFromActor || record.pendingActor === record.activeActor)) {
    errors.push(error("INVALID_HANDOFF_STATE", "pendingActor"));
  }
  if (!Number.isInteger(record.revision) || record.revision < 1) errors.push(error("INVALID_REVISION", "revision"));
  for (const field of ["runtimeRef", "artifactManifestRef"]) {
    if (record[field] !== null && !validText(record[field], 4096)) errors.push(error("INVALID_REFERENCE", field));
  }
  if (!CLEANUP_POLICIES.has(record.cleanupPolicy)) errors.push(error("INVALID_CLEANUP_POLICY", "cleanupPolicy"));
  if (!STATES.has(record.state)) errors.push(error("INVALID_STATE", "state"));
  if (!Array.isArray(record.blockers) ||
      record.blockers.length > 32 ||
      record.blockers.some((item) => !/^[A-Z0-9_:-]{1,128}$/u.test(item))) {
    errors.push(error("INVALID_BLOCKERS", "blockers"));
  }
  if (!validTimestamp(record.createdAt)) errors.push(error("INVALID_TIMESTAMP", "createdAt"));
  if (!validTimestamp(record.updatedAt)) errors.push(error("INVALID_TIMESTAMP", "updatedAt"));
  if (!FINGERPRINT_PATTERN.test(record.fingerprint ?? "")) errors.push(error("INVALID_FINGERPRINT", "fingerprint"));
  if (FINGERPRINT_PATTERN.test(record.fingerprint ?? "") &&
      fingerprintRecord(record) !== record.fingerprint) {
    errors.push(error("FINGERPRINT_MISMATCH", "fingerprint"));
  }
  if (TERMINAL_STATES.has(record.state) && record.activeActor !== null) {
    errors.push(error("TERMINAL_ACTOR_FORBIDDEN", "activeActor"));
  }
  if (TERMINAL_STATES.has(record.state) &&
      (record.pendingActor !== null || record.handoffFromActor !== null)) {
    errors.push(error("TERMINAL_HANDOFF_FORBIDDEN", "pendingActor"));
  }
  if (repoPath !== null && isPlainObject(record.workspace)) {
    errors.push(...managedWorkspaceErrors(record, repoPath));
  }
  try {
    if (Buffer.byteLength(JSON.stringify(record), "utf8") > MAX_RECORD_BYTES) {
      errors.push(error("RECORD_TOO_LARGE", "record"));
    }
  } catch {
    errors.push(error("INVALID_SERIALIZATION", "record"));
  }
  return errors;
}

export function createTaskRecordV3(input) {
  if (!isPlainObject(input)) fail("V3_RECORD_INVALID");
  const record = structuredClone(input);
  delete record.fingerprint;
  record.schemaVersion = 3;
  record.recordType = "TaskRecordV3";
  record.fingerprint = fingerprintRecord(record);
  if (validateTaskRecordV3(record).length > 0) fail("V3_RECORD_INVALID");
  return record;
}

function defaultGitRunner(repoPath, args) {
  const result = spawnSync("git", ["-C", repoPath, ...args], {
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    shell: false,
    timeout: 20_000,
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    status: result.status ?? 1,
    stdout: String(result.stdout ?? "").trim(),
    stderr: String(result.stderr ?? ""),
  };
}

function runGit(repoPath, args, runner = null) {
  if (runner === null) return defaultGitRunner(repoPath, args);
  const result = runner(repoPath, args, { defaultRunner: defaultGitRunner });
  if (!isPlainObject(result) || !Number.isInteger(result.status)) fail("GIT_RUNNER_INVALID");
  return {
    status: result.status,
    stdout: String(result.stdout ?? "").trim(),
    stderr: String(result.stderr ?? ""),
  };
}

function requireGit(repoPath, args, code, runner = null) {
  const result = runGit(repoPath, args, runner);
  if (result.status !== 0) fail(code);
  return result.stdout;
}

function gitContext(repoPath, { requireBase = false, runner = null } = {}) {
  if (!path.isAbsolute(repoPath) || !existsSync(repoPath) || !lstatSync(repoPath).isDirectory()) {
    fail("REPOSITORY_REQUIRED");
  }
  const topLevel = canonicalPath(requireGit(repoPath, ["rev-parse", "--show-toplevel"], "REPOSITORY_REQUIRED", runner));
  const commonRaw = requireGit(repoPath, ["rev-parse", "--git-common-dir"], "REPOSITORY_REQUIRED", runner);
  const gitDirRaw = requireGit(repoPath, ["rev-parse", "--git-dir"], "REPOSITORY_REQUIRED", runner);
  const commonDir = canonicalPath(path.isAbsolute(commonRaw) ? commonRaw : path.resolve(repoPath, commonRaw));
  const gitDir = canonicalPath(path.isAbsolute(gitDirRaw) ? gitDirRaw : path.resolve(repoPath, gitDirRaw));
  if (requireBase && (!samePath(topLevel, repoPath) || !samePath(commonDir, gitDir))) {
    fail("BASE_CHECKOUT_REQUIRED");
  }
  return { topLevel, commonDir, gitDir };
}

function registryPaths(commonDir) {
  const lifecycleRoot = path.join(commonDir, "talkpik-task-lifecycle");
  const root = path.join(lifecycleRoot, "v3");
  return {
    lifecycleRoot,
    root,
    tasks: path.join(root, "tasks"),
    migrations: path.join(root, "migrations"),
    locks: path.join(root, "locks"),
    runtimes: path.join(root, "runtimes"),
    startRecoveries: path.join(root, "start-recoveries"),
    operations: path.join(root, "operations"),
    cleanupReports: path.join(root, "cleanup-reports"),
  };
}

function ensureDirectory(commonDir, directory) {
  assertPathPlan(commonDir, directory, "V3_REGISTRY_PATH_ESCAPE");
  if (existsSync(directory)) {
    const stats = lstatSync(directory);
    if (!stats.isDirectory() || stats.isSymbolicLink()) fail("V3_REGISTRY_PATH_ESCAPE");
  } else {
    mkdirSync(directory);
  }
  assertPathPlan(commonDir, directory, "V3_REGISTRY_PATH_ESCAPE");
}

function prepareRegistry(commonDir) {
  const paths = registryPaths(commonDir);
  for (const directory of [
    paths.lifecycleRoot,
    paths.root,
    paths.tasks,
    paths.migrations,
    paths.locks,
    paths.runtimes,
    paths.startRecoveries,
    paths.operations,
    paths.cleanupReports,
  ]) {
    ensureDirectory(commonDir, directory);
  }
  return paths;
}

function atomicWriteJson(filePath, value) {
  const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    renameSync(temporary, filePath);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

function readJson(filePath, missingCode) {
  if (!existsSync(filePath)) fail(missingCode);
  if (lstatSync(filePath).isSymbolicLink()) fail("V3_REGISTRY_PATH_ESCAPE");
  const bytes = readFileSync(filePath);
  if (bytes.byteLength > MAX_RECORD_BYTES) fail("V3_REGISTRY_RECORD_TOO_LARGE");
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("V3_REGISTRY_RECORD_INVALID");
  }
}

function taskFile(paths, taskId) {
  if (!TASK_ID_PATTERN.test(taskId)) fail("INVALID_TASK_ID");
  return path.join(paths.tasks, `${taskId}.json`);
}

function listTaskRecords(commonDir, { create = false } = {}) {
  const paths = registryPaths(commonDir);
  if (!existsSync(paths.tasks)) return [];
  if (create) prepareRegistry(commonDir);
  assertPathPlan(commonDir, paths.tasks, "V3_REGISTRY_PATH_ESCAPE");
  if (lstatSync(paths.tasks).isSymbolicLink()) fail("V3_REGISTRY_PATH_ESCAPE");
  return readdirSync(paths.tasks)
    .filter((name) => /^task-[a-z0-9-]+\.json$/u.test(name))
    .map((name) => {
      const record = readJson(path.join(paths.tasks, name), "V3_TASK_NOT_FOUND");
      if (validateTaskRecordV3(record).length > 0) fail("V3_REGISTRY_RECORD_INVALID");
      return record;
    });
}

function withLock(paths, id, callback) {
  const lockPath = path.join(paths.locks, `${id}.lock`);
  let identity;
  const token = `${process.pid}:${randomUUID()}\n`;
  try {
    writeFileSync(lockPath, token, { encoding: "utf8", flag: "wx", mode: 0o600 });
    identity = lstatSync(lockPath);
  } catch (error) {
    if (error?.code === "EEXIST") fail("V3_TASK_OPERATION_IN_PROGRESS");
    fail("V3_TASK_LOCK_FAILED");
  }
  try {
    return callback();
  } finally {
    if (existsSync(lockPath)) {
      const current = lstatSync(lockPath);
      if (current.dev === identity.dev && current.ino === identity.ino &&
          readFileSync(lockPath, "utf8") === token) {
        unlinkSync(lockPath);
      }
    }
  }
}

function assertWorkspaceCollision(commonDir, record) {
  for (const existing of listTaskRecords(commonDir)) {
    if (existing.taskId !== record.taskId && pathKey(existing.workspace.path) === pathKey(record.workspace.path)) {
      const safeSharedReuse =
        existing.workspace.kind === "shared-slot" &&
        existing.workspace.ownership === "managed" &&
        record.workspace.kind === "shared-slot" &&
        record.workspace.ownership === "managed" &&
        REUSABLE_STATES.has(existing.state);
      if (!safeSharedReuse) fail("V3_WORKSPACE_COLLISION");
    }
  }
}

export function writeTaskRecordV3({
  repoPath,
  record,
  expectedRevision = null,
  expectedFingerprint = null,
}) {
  const context = gitContext(path.resolve(repoPath));
  const paths = prepareRegistry(context.commonDir);
  const errors = validateTaskRecordV3(record, { repoPath: context.topLevel });
  if (errors.length > 0) fail(errors[0].code === "WORKSPACE_PATH_ESCAPE" ? "V3_WORKSPACE_PATH_ESCAPE" : "V3_RECORD_INVALID");
  const target = taskFile(paths, record.taskId);
  return withLock(paths, record.taskId, () => {
    if (!existsSync(target)) {
      if (expectedRevision !== null || expectedFingerprint !== null) fail("V3_RECORD_STALE");
      assertWorkspaceCollision(context.commonDir, record);
      atomicWriteJson(target, record);
      return structuredClone(record);
    }
    if (expectedRevision === null || expectedFingerprint === null) fail("V3_RECORD_EXISTS");
    const previous = readJson(target, "V3_TASK_NOT_FOUND");
    if (validateTaskRecordV3(previous, { repoPath: context.topLevel }).length > 0) {
      fail("V3_REGISTRY_RECORD_INVALID");
    }
    if (previous.revision !== expectedRevision || previous.fingerprint !== expectedFingerprint) {
      fail("V3_RECORD_STALE");
    }
    if (
      record.revision !== previous.revision + 1 ||
      record.createdAt !== previous.createdAt ||
      record.taskId !== previous.taskId ||
      record.repoProfile.repositoryIdentity !== previous.repoProfile.repositoryIdentity ||
      !samePath(record.workspace.path, previous.workspace.path)
    ) {
      fail("V3_RECORD_UPDATE_INVALID");
    }
    assertWorkspaceCollision(context.commonDir, record);
    atomicWriteJson(target, record);
    return structuredClone(record);
  });
}

export function readTaskRecordV3({ repoPath, taskId }) {
  const context = gitContext(path.resolve(repoPath));
  const paths = registryPaths(context.commonDir);
  assertPathPlan(context.commonDir, paths.tasks, "V3_REGISTRY_PATH_ESCAPE");
  const record = readJson(taskFile(paths, taskId), "V3_TASK_NOT_FOUND");
  if (validateTaskRecordV3(record, { repoPath: context.topLevel }).length > 0) {
    fail("V3_REGISTRY_RECORD_INVALID");
  }
  return structuredClone(record);
}

export function recordPartialStartV3({ repoPath, v2Record, now }) {
  if (
    validateTaskRecordV2(v2Record).length > 0 ||
    !validTimestamp(now) ||
    Date.parse(now) < Date.parse(v2Record.updatedAt)
  ) fail("V3_START_RECOVERY_INVALID");
  const context = gitContext(path.resolve(repoPath));
  const paths = prepareRegistry(context.commonDir);
  const recoveryBase = {
    schemaVersion: 3,
    recordType: "TaskStartRecoveryV3",
    sourceTaskId: v2Record.taskId,
    branch: v2Record.branch,
    worktreePath: v2Record.worktreePath,
    status: "PARTIAL_START_PRESERVED",
    blocker: "V3_COPY_FAILED",
    createdAt: now,
  };
  const recovery = {
    ...recoveryBase,
    fingerprint: hash(JSON.stringify(stableValue(recoveryBase))),
  };
  atomicWriteJson(
    path.join(paths.startRecoveries, `${v2Record.taskId}.json`),
    recovery,
  );
  return structuredClone(recovery);
}

export function parseRepositoryIdentity(remoteUrl) {
  if (!validText(remoteUrl, 4096)) fail("ORIGIN_URL_UNSUPPORTED");
  const localIdentity = (localPath) => {
    const canonical = canonicalPath(localPath);
    const normalized = process.platform === "win32" ? canonical.toLowerCase() : canonical;
    const digest = hash(normalized);
    return {
      host: "local",
      owner: "local",
      repository: digest,
      identity: `local:${digest}`,
    };
  };
  if (path.isAbsolute(remoteUrl) || path.win32.isAbsolute(remoteUrl)) {
    return localIdentity(remoteUrl);
  }
  const scp = /^git@([A-Za-z0-9.-]+):([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/u.exec(remoteUrl);
  if (scp !== null) {
    const host = scp[1].toLowerCase();
    const owner = scp[2];
    const repository = scp[3];
    return { host, owner, repository, identity: `${host}/${owner}/${repository}` };
  }

  let parsed;
  try {
    parsed = new URL(remoteUrl);
  } catch {
    fail("ORIGIN_URL_UNSUPPORTED");
  }
  if (parsed.username !== "" || parsed.password !== "") fail("ORIGIN_URL_CREDENTIALS_FORBIDDEN");
  if (parsed.search !== "" || parsed.hash !== "") fail("ORIGIN_URL_UNSUPPORTED");
  if (parsed.protocol === "file:") {
    try {
      return localIdentity(fileURLToPath(parsed));
    } catch {
      fail("ORIGIN_URL_UNSUPPORTED");
    }
  }
  if (!new Set(["https:", "ssh:"]).has(parsed.protocol)) fail("ORIGIN_URL_UNSUPPORTED");
  const segments = parsed.pathname.replace(/^\/+/u, "").replace(/\.git$/iu, "").split("/");
  if (segments.length !== 2 || segments.some((entry) => !/^[A-Za-z0-9_.-]+$/u.test(entry))) {
    fail("ORIGIN_URL_UNSUPPORTED");
  }
  const host = parsed.hostname.toLowerCase();
  const [owner, repository] = segments;
  return { host, owner, repository, identity: `${host}/${owner}/${repository}` };
}

function repositoryProfile(repoPath, runner = null) {
  const remoteUrl = requireGit(repoPath, ["remote", "get-url", "origin"], "ORIGIN_REQUIRED", runner);
  const identity = parseRepositoryIdentity(remoteUrl);
  let authLogin = "local";
  if (identity.host === "github.com" && identity.owner.toLowerCase() === "blackstarzck") {
    authLogin = "blackstarzck";
  } else if (identity.host === "github.com" && identity.owner.toLowerCase() === "keduall") {
    authLogin = "guestkeduall-design";
  } else if (identity.host !== "local") {
    fail("REPOSITORY_PROFILE_UNSUPPORTED");
  }
  return {
    name: path.basename(repoPath),
    remote: "origin",
    repositoryIdentity: identity.identity,
    authLogin,
    baseBranch: "main",
  };
}

function branchResource(branch) {
  const parsed = parseTaskBranch(branch);
  return { name: branch, type: parsed.type, slug: parsed.slug };
}

function v3TaskId(parts) {
  return `task-${hash(parts.join("\0")).slice(0, 24)}`;
}

function gitDirForWorktree(worktreePath, runner = null) {
  const raw = requireGit(worktreePath, ["rev-parse", "--git-dir"], "WORKTREE_VERIFY_FAILED", runner);
  return canonicalPath(path.isAbsolute(raw) ? raw : path.resolve(worktreePath, raw));
}

function buildRecord({
  repoProfile,
  baseSha,
  branch,
  workspace,
  actor,
  now,
  taskId = null,
  state = "ACTIVE",
  blockers = [],
}) {
  return createTaskRecordV3({
    taskId: taskId ?? v3TaskId([repoProfile.repositoryIdentity, branch, baseSha, now]),
    repoProfile,
    baseSha,
    headSha: baseSha,
    branch: branchResource(branch),
    workspace,
    activeActor: TERMINAL_STATES.has(state) ? null : actor,
    pendingActor: null,
    handoffFromActor: null,
    revision: 1,
    runtimeRef: null,
    artifactManifestRef: null,
    cleanupPolicy: workspace.ownership === "managed" ? "auto-after-merge" : "release-only",
    state,
    blockers,
    createdAt: now,
    updatedAt: now,
  });
}

function validatePrepareInput({ intent, branch, actor, workspace }) {
  if (intent === "read-only") return;
  if (intent !== "code") fail("INVALID_TASK_INTENT");
  try {
    parseTaskBranch(branch);
  } catch {
    fail("INVALID_TASK_BRANCH");
  }
  if (!ACTORS.has(actor)) fail("INVALID_ACTOR");
  if (!new Set(["auto", "shared-slot", "isolated"]).has(workspace)) fail("INVALID_WORKSPACE_CHOICE");
}

function baseHasGitOperation(commonDir) {
  return ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "REBASE_HEAD", "BISECT_START"]
    .some((name) => existsSync(path.join(commonDir, name))) ||
    ["rebase-merge", "rebase-apply"].some((name) => existsSync(path.join(commonDir, name)));
}

function baseIsDirty(context, runner) {
  const output = requireGit(
    context.topLevel,
    ["status", "--porcelain=v1", "--untracked-files=normal"],
    "BASE_STATUS_FAILED",
    runner,
  );
  if (output === "") return false;
  const lines = output.split(/\r?\n/u).filter(Boolean);
  const worktreeMarker = `?? .worktrees${path.sep}`.replaceAll("\\", "/");
  const normalized = lines.map((line) => line.replaceAll("\\", "/"));
  if (normalized.some((line) => line !== worktreeMarker)) return true;

  const worktreeRoot = path.join(context.topLevel, ".worktrees");
  if (!existsSync(worktreeRoot) || lstatSync(worktreeRoot).isSymbolicLink()) return true;
  const native = new Set(
    parseWorktrees(requireGit(context.topLevel, ["worktree", "list", "--porcelain"], "WORKTREE_LIST_FAILED", runner))
      .map((entry) => pathKey(entry.path)),
  );
  return readdirSync(worktreeRoot, { withFileTypes: true }).some((entry) => {
    if (!entry.isDirectory()) return true;
    return !native.has(pathKey(path.join(worktreeRoot, entry.name)));
  });
}

function syncBase(repoPath, runner) {
  const context = gitContext(repoPath, { requireBase: true, runner });
  const branch = requireGit(context.topLevel, ["branch", "--show-current"], "BASE_BRANCH_REQUIRED", runner);
  if (branch !== "main") fail("BASE_MAIN_REQUIRED");
  if (baseHasGitOperation(context.commonDir)) fail("BASE_GIT_OPERATION_IN_PROGRESS");
  if (baseIsDirty(context, runner)) fail("BASE_DIRTY");
  if (runGit(context.topLevel, ["fetch", "--prune", "origin"], runner).status !== 0) fail("FETCH_FAILED");
  const originSha = requireGit(context.topLevel, ["rev-parse", "--verify", "origin/main^{commit}"], "ORIGIN_MAIN_REQUIRED", runner);
  if (!SHA_PATTERN.test(originSha)) fail("ORIGIN_MAIN_REQUIRED");
  const counts = requireGit(context.topLevel, ["rev-list", "--left-right", "--count", "HEAD...origin/main"], "BASE_COMPARE_FAILED", runner)
    .split(/\s+/u).map(Number);
  if (counts.length !== 2 || counts.some((value) => !Number.isInteger(value))) fail("BASE_COMPARE_FAILED");
  if (counts[0] !== 0) fail("BASE_DIVERGED");
  if (runGit(context.topLevel, ["pull", "--ff-only", "origin", "main"], runner).status !== 0) {
    fail("PULL_FF_ONLY_FAILED");
  }
  const headSha = requireGit(context.topLevel, ["rev-parse", "HEAD"], "BASE_VERIFY_FAILED", runner);
  const currentOrigin = requireGit(context.topLevel, ["rev-parse", "origin/main"], "BASE_VERIFY_FAILED", runner);
  if (headSha !== currentOrigin || headSha !== originSha) fail("STALE_BASE");
  return { ...context, originSha };
}

function findTaskByBranch(commonDir, branch) {
  return listTaskRecords(commonDir).find((record) => record.branch?.name === branch) ?? null;
}

function findSharedRecord(commonDir, sharedPath) {
  return listTaskRecords(commonDir)
    .filter((record) => record.workspace.kind === "shared-slot" && samePath(record.workspace.path, sharedPath))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.revision - a.revision)[0] ?? null;
}

function writeSharedSlotOperation(paths, operation) {
  const payload = {
    schemaVersion: 1,
    recordType: "SharedSlotOperationV1",
    ...operation,
  };
  const value = {
    ...payload,
    fingerprint: hash(JSON.stringify(stableValue(payload))),
  };
  atomicWriteJson(path.join(paths.operations, "shared-slot.json"), value);
  return value;
}

function choiceResult(blockers) {
  return {
    status: "CHOICE_REQUIRED",
    intent: "code",
    resourcesCreated: false,
    blockers: [...new Set(blockers)],
    choices: ["shared-slot", "isolated"],
  };
}

function inspectActiveWorkspace({ context, record, runner, allowDescendant = false }) {
  const blockers = [];
  const workspacePath = record.workspace.path;
  if (!existsSync(workspacePath)) {
    return { blockers: ["ACTIVE_WORKSPACE_MISSING"], headSha: null, advanced: false };
  }
  if (record.workspace.ownership === "managed") {
    const workspaceContainer = path.dirname(workspacePath);
    const managedRoot = path.dirname(workspaceContainer);
    const expectedPath = record.workspace.kind === "shared-slot"
      ? path.join(managedRoot, ".worktrees", "shared-dev")
      : path.join(managedRoot, ".worktrees", `${record.branch?.type}-${record.branch?.slug}`);
    if (pathKey(path.basename(workspaceContainer)) !== pathKey(".worktrees")) {
      blockers.push("ACTIVE_WORKSPACE_PATH_UNSAFE");
    }
    if (!samePath(workspacePath, expectedPath)) blockers.push("ACTIVE_WORKSPACE_PATH_UNSAFE");
    try {
      assertPathPlan(workspaceContainer, workspacePath, "ACTIVE_WORKSPACE_PATH_UNSAFE");
    } catch {
      blockers.push("ACTIVE_WORKSPACE_PATH_UNSAFE");
    }
  } else {
    try {
      assertExistingUnlinkedPath(workspacePath, "ACTIVE_WORKSPACE_PATH_UNSAFE");
    } catch {
      blockers.push("ACTIVE_WORKSPACE_PATH_UNSAFE");
    }
  }
  const stats = lstatSync(workspacePath);
  if (!stats.isDirectory() || stats.isSymbolicLink()) blockers.push("ACTIVE_WORKSPACE_PATH_UNSAFE");
  if (blockers.length > 0) return { blockers: [...new Set(blockers)], headSha: null, advanced: false };

  const nativeResult = runGit(context.topLevel, ["worktree", "list", "--porcelain"], runner);
  if (nativeResult.status !== 0) {
    return { blockers: ["ACTIVE_WORKSPACE_IDENTITY_UNAVAILABLE"], headSha: null, advanced: false };
  }
  const native = parseWorktrees(nativeResult.stdout).find((entry) => samePath(entry.path, workspacePath));
  if (native === undefined) blockers.push("ACTIVE_WORKSPACE_NOT_NATIVE");
  else if (native.branch !== record.branch?.name) blockers.push("ACTIVE_WORKSPACE_BRANCH_MISMATCH");

  const commonDir = runGit(workspacePath, ["rev-parse", "--git-common-dir"], runner);
  if (commonDir.status !== 0) {
    blockers.push("ACTIVE_WORKSPACE_IDENTITY_UNAVAILABLE");
  } else {
    const actualCommonDir = canonicalPath(path.isAbsolute(commonDir.stdout)
      ? commonDir.stdout
      : path.resolve(workspacePath, commonDir.stdout));
    if (!samePath(actualCommonDir, context.commonDir)) {
      blockers.push("ACTIVE_WORKSPACE_COMMON_DIR_MISMATCH");
    }
  }
  const gitDir = runGit(workspacePath, ["rev-parse", "--git-dir"], runner);
  if (gitDir.status !== 0) {
    blockers.push("ACTIVE_WORKSPACE_IDENTITY_UNAVAILABLE");
  } else {
    const actualGitDir = canonicalPath(path.isAbsolute(gitDir.stdout)
      ? gitDir.stdout
      : path.resolve(workspacePath, gitDir.stdout));
    if (!samePath(actualGitDir, record.workspace.gitDir)) blockers.push("ACTIVE_WORKSPACE_GITDIR_MISMATCH");
  }
  const branch = runGit(workspacePath, ["branch", "--show-current"], runner);
  if (branch.status !== 0 || branch.stdout !== record.branch?.name) {
    blockers.push("ACTIVE_WORKSPACE_BRANCH_MISMATCH");
  }
  const head = runGit(workspacePath, ["rev-parse", "HEAD"], runner);
  let advanced = false;
  if (head.status !== 0) {
    blockers.push("ACTIVE_WORKSPACE_HEAD_MISMATCH");
  } else if (head.stdout !== record.headSha) {
    const descendant = allowDescendant &&
      runGit(workspacePath, ["merge-base", "--is-ancestor", record.headSha, head.stdout], runner).status === 0;
    if (descendant) advanced = true;
    else blockers.push("ACTIVE_WORKSPACE_HEAD_MISMATCH");
  }
  return {
    blockers: [...new Set(blockers)],
    headSha: head.status === 0 ? head.stdout : null,
    advanced,
  };
}

function activeWorkspaceBlockers(options) {
  return inspectActiveWorkspace(options).blockers;
}

function prepareSharedSlot({ base, profile, branch, actor, now, runner }) {
  const paths = prepareRegistry(base.commonDir);
  const sharedPath = path.join(base.topLevel, ".worktrees", "shared-dev");
  return withLock(paths, "shared-slot-operation", () => {
    const priorJournalFile = path.join(paths.operations, "shared-slot.json");
    if (existsSync(priorJournalFile)) {
      const priorJournal = readJson(priorJournalFile, "SHARED_SLOT_JOURNAL_NOT_FOUND");
      if (priorJournal.stage === "RECOVERY_REQUIRED") {
        return choiceResult(["SHARED_SLOT_RECOVERY_REQUIRED"]);
      }
    }
    const sharedRecord = findSharedRecord(base.commonDir, sharedPath);
    const blockers = [];
    const sharedExists = existsSync(sharedPath);
    if (sharedExists) {
      try {
        assertPathPlan(path.join(base.topLevel, ".worktrees"), sharedPath, "SHARED_SLOT_PATH_UNSAFE");
      } catch {
        blockers.push("SHARED_SLOT_PATH_UNSAFE");
      }
      if (lstatSync(sharedPath).isSymbolicLink()) blockers.push("SHARED_SLOT_PATH_UNSAFE");
      const native = parseWorktrees(
        requireGit(base.topLevel, ["worktree", "list", "--porcelain"], "WORKTREE_LIST_FAILED", runner),
      ).find((entry) => samePath(entry.path, sharedPath));
      if (native === undefined) blockers.push("SHARED_SLOT_UNMANAGED");
      if (sharedRecord === null) blockers.push("SHARED_SLOT_UNMANAGED");
      if (sharedRecord?.state === "PRESERVED") blockers.push("SHARED_SLOT_PRESERVED");
      else if (sharedRecord !== null && !REUSABLE_STATES.has(sharedRecord.state)) {
        blockers.push("SHARED_SLOT_BUSY");
      }
      if (sharedRecord?.runtimeRef !== null && sharedRecord?.runtimeRef !== undefined) {
        blockers.push("SHARED_SLOT_RUNTIME_ACTIVE");
      }
      const status = runGit(sharedPath, ["status", "--porcelain=v1", "--untracked-files=all"], runner);
      if (status.status !== 0) blockers.push("SHARED_SLOT_INVALID");
      else if (status.stdout !== "") blockers.push("SHARED_SLOT_DIRTY");
      if (sharedRecord !== null && sharedRecord.workspace.ownership !== "managed") {
        blockers.push("SHARED_SLOT_NOT_MANAGED");
      }
    } else {
      assertPathPlan(base.topLevel, sharedPath, "SHARED_SLOT_PATH_ESCAPE");
    }
    if (blockers.length > 0) return choiceResult(blockers);

    const operationBase = {
      branch,
      baseSha: base.originSha,
      previousTaskId: sharedRecord?.taskId ?? null,
      previousBranch: sharedRecord?.branch?.name ?? null,
      stage: "PREPARED",
      blocker: null,
      createdAt: now,
      updatedAt: now,
    };
    writeSharedSlotOperation(paths, operationBase);
    let branchCreated = false;
    let storedRecord = null;
    const advance = (stage, blocker = null) => {
      writeSharedSlotOperation(paths, {
        ...operationBase,
        stage,
        blocker,
        updatedAt: now,
      });
    };
    try {
      if (sharedExists) {
        requireGit(sharedPath, ["switch", "--detach", base.originSha], "SHARED_SLOT_DETACH_FAILED", runner);
        advance("DETACHED");
        const priorBranch = sharedRecord?.branch?.name ?? null;
        if (priorBranch !== null) {
          const priorExists = runGit(
            base.topLevel,
            ["show-ref", "--verify", "--quiet", `refs/heads/${priorBranch}`],
            runner,
          );
          if (priorExists.status === 0) {
            requireGit(
              base.topLevel,
              ["branch", "-d", priorBranch],
              "SHARED_SLOT_BRANCH_NOT_DISPOSABLE",
              runner,
            );
          }
        }
        advance("OLD_BRANCH_REMOVED");
      } else {
        const worktreeRoot = path.dirname(sharedPath);
        if (!existsSync(worktreeRoot)) mkdirSync(worktreeRoot);
        assertPathPlan(base.topLevel, worktreeRoot, "SHARED_SLOT_PATH_ESCAPE");
      }

      const localBranch = runGit(
        base.topLevel,
        ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`],
        runner,
      );
      if (localBranch.status === 0) fail("TASK_BRANCH_EXISTS");
      if (sharedExists) {
        requireGit(sharedPath, ["switch", "-c", branch, base.originSha], "SHARED_SLOT_BRANCH_CREATE_FAILED", runner);
      } else {
        requireGit(
          base.topLevel,
          ["worktree", "add", "-b", branch, sharedPath, base.originSha],
          "SHARED_SLOT_CREATE_FAILED",
          runner,
        );
      }
      branchCreated = true;
      advance("NEW_BRANCH_CREATED");
      const actualHead = requireGit(sharedPath, ["rev-parse", "HEAD"], "SHARED_SLOT_VERIFY_FAILED", runner);
      const actualBranch = requireGit(sharedPath, ["branch", "--show-current"], "SHARED_SLOT_VERIFY_FAILED", runner);
      if (actualHead !== base.originSha || actualBranch !== branch) fail("SHARED_SLOT_VERIFY_FAILED");
      const record = buildRecord({
        repoProfile: profile,
        baseSha: base.originSha,
        branch,
        workspace: {
          kind: "shared-slot",
          ownership: "managed",
          path: canonicalPath(sharedPath),
          gitDir: gitDirForWorktree(sharedPath, runner),
        },
        actor,
        now,
      });
      storedRecord = writeTaskRecordV3({ repoPath: base.topLevel, record });
      advance("V3_WRITTEN");
      advance("COMPLETED");
      return {
        status: "STARTED",
        intent: "code",
        resourcesCreated: true,
        v2Compatible: false,
        task: storedRecord,
      };
    } catch (caught) {
      let recovered = false;
      try {
        if (existsSync(sharedPath)) {
          const status = requireGit(
            sharedPath,
            ["status", "--porcelain=v1", "--untracked-files=all"],
            "SHARED_SLOT_ROLLBACK_STATUS_FAILED",
            runner,
          );
          if (status !== "") fail("SHARED_SLOT_ROLLBACK_DIRTY");
          requireGit(
            sharedPath,
            ["switch", "--detach", base.originSha],
            "SHARED_SLOT_ROLLBACK_DETACH_FAILED",
            runner,
          );
          if (branchCreated) {
            const branchSha = requireGit(
              base.topLevel,
              ["rev-parse", `refs/heads/${branch}^{commit}`],
              "SHARED_SLOT_ROLLBACK_BRANCH_FAILED",
              runner,
            );
            if (branchSha !== base.originSha) fail("SHARED_SLOT_ROLLBACK_BRANCH_MOVED");
            requireGit(
              base.topLevel,
              ["branch", "-d", branch],
              "SHARED_SLOT_ROLLBACK_BRANCH_FAILED",
              runner,
            );
          }
          recovered = true;
        } else if (!branchCreated) {
          recovered = true;
        }
      } catch {
        recovered = false;
      }
      if (storedRecord !== null) recovered = false;
      if (recovered) {
        advance("ROLLED_BACK");
        throw caught;
      }
      advance("RECOVERY_REQUIRED", "SHARED_SLOT_RECOVERY_REQUIRED");
      const preserveTarget = storedRecord ?? sharedRecord;
      if (preserveTarget !== null && preserveTarget.state !== "PRESERVED") {
        try {
          updateTaskRecordV3(base.topLevel, preserveTarget, {
            state: "PRESERVED",
            activeActor: null,
            pendingActor: null,
            handoffFromActor: null,
            blockers: ["SHARED_SLOT_RECOVERY_REQUIRED"],
          }, now);
        } catch {
          // The recovery journal remains the fail-closed authority.
        }
      }
      fail("SHARED_SLOT_RECOVERY_REQUIRED");
    }
  });
}

export function prepareTask({
  repoPath,
  intent,
  branch = null,
  actor = null,
  workspace = "auto",
  now = new Date().toISOString(),
  gitRunner = null,
  reuseInterleave = null,
}) {
  validatePrepareInput({ intent, branch, actor, workspace });
  if (intent === "read-only") {
    return {
      schemaVersion: 1,
      recordType: "TaskPreparationV1",
      status: "READY",
      intent: "read-only",
      resourcesCreated: false,
    };
  }
  if (!validTimestamp(now)) fail("INVALID_TIMESTAMP");
  const base = syncBase(path.resolve(repoPath), gitRunner);
  const existing = findTaskByBranch(base.commonDir, branch);
  if (existing !== null && new Set(["ACTIVE", "PR_OPEN"]).has(existing.state)) {
    const paths = prepareRegistry(base.commonDir);
    return withLock(paths, existing.taskId, () => {
      const current = readJson(taskFile(paths, existing.taskId), "V3_TASK_NOT_FOUND");
      if (validateTaskRecordV3(current, { repoPath: base.topLevel }).length > 0) {
        fail("V3_REGISTRY_RECORD_INVALID");
      }
      if (
        current.taskId !== existing.taskId ||
        current.branch?.name !== branch ||
        current.revision !== existing.revision ||
        current.fingerprint !== existing.fingerprint ||
        !new Set(["ACTIVE", "PR_OPEN"]).has(current.state)
      ) fail("V3_RECORD_STALE");
      if (reuseInterleave !== null) reuseInterleave();
      const inspection = inspectActiveWorkspace({
        context: base,
        record: current,
        runner: gitRunner,
        allowDescendant: true,
      });
      if (inspection.blockers.length > 0) {
        const preserved = createTaskRecordV3({
          ...current,
          state: "PRESERVED",
          activeActor: null,
          pendingActor: null,
          handoffFromActor: null,
          blockers: inspection.blockers,
          revision: current.revision + 1,
          updatedAt: now,
        });
        atomicWriteJson(taskFile(paths, current.taskId), preserved);
        fail("V3_ACTIVE_WORKSPACE_MISMATCH");
      }
      let reused = current;
      if (inspection.advanced) {
        reused = createTaskRecordV3({
          ...current,
          headSha: inspection.headSha,
          revision: current.revision + 1,
          updatedAt: now,
        });
        atomicWriteJson(taskFile(paths, current.taskId), reused);
      }
      if (reused.activeActor !== actor) return choiceResult(["TASK_CLAIMED_BY_OTHER_ACTOR"]);
      return { status: "REUSED", intent: "code", resourcesCreated: false, task: reused };
    });
  }
  if (existing?.state === "PRESERVED") return choiceResult(["TASK_PRESERVED"]);
  if (existing?.state === "MERGED") return choiceResult(["TASK_MERGED_AWAITING_CLEANUP"]);
  const profile = repositoryProfile(base.topLevel, gitRunner);

  if (workspace === "isolated") {
    const v2 = startTask({
      repoPath: base.topLevel,
      branch,
      actor,
      now,
      expectedBaseSha: base.originSha,
    });
    const record = buildRecord({
      repoProfile: profile,
      baseSha: base.originSha,
      branch,
      workspace: {
        kind: "isolated",
        ownership: "managed",
        path: canonicalPath(v2.worktreePath),
        gitDir: gitDirForWorktree(v2.worktreePath),
      },
      actor,
      now,
    });
    return {
      status: "STARTED",
      intent: "code",
      resourcesCreated: true,
      v2Compatible: true,
      task: writeTaskRecordV3({ repoPath: base.topLevel, record }),
    };
  }

  return prepareSharedSlot({
    base,
    profile,
    branch,
    actor,
    now,
    runner: gitRunner,
  });
}

export function claimTaskV3({
  repoPath,
  taskId,
  fromActor,
  toActor,
  expectedRevision,
  expectedFingerprint,
  now,
}) {
  if (!ACTORS.has(fromActor) || !ACTORS.has(toActor) || fromActor === toActor) fail("INVALID_ACTOR");
  if (!validTimestamp(now)) fail("INVALID_TIMESTAMP");
  const context = gitContext(path.resolve(repoPath));
  const paths = prepareRegistry(context.commonDir);
  return withLock(paths, taskId, () => {
    const current = readTaskRecordV3({ repoPath, taskId });
    if (
      current.state !== "ACTIVE" ||
      current.activeActor !== fromActor ||
      current.revision !== expectedRevision ||
      current.fingerprint !== expectedFingerprint
    ) fail("V3_CLAIM_STALE");
    const next = createTaskRecordV3({
      ...current,
      activeActor: toActor,
      pendingActor: null,
      handoffFromActor: null,
      revision: current.revision + 1,
      updatedAt: now,
    });
    atomicWriteJson(taskFile(paths, taskId), next);
    return structuredClone(next);
  });
}

export function readTaskRecordV3ByBranch({ repoPath, branch }) {
  try {
    parseTaskBranch(branch);
  } catch {
    fail("INVALID_TASK_BRANCH");
  }
  const context = gitContext(path.resolve(repoPath));
  const record = listTaskRecords(context.commonDir)
    .filter((candidate) => candidate.branch?.name === branch)
    .sort((first, second) =>
      second.updatedAt.localeCompare(first.updatedAt) || second.revision - first.revision)[0] ?? null;
  return record === null ? null : structuredClone(record);
}

export function reconcileTaskRecordV3WithV2Task({
  repoPath,
  branch,
  v2Task,
  now,
}) {
  const current = readTaskRecordV3ByBranch({ repoPath, branch });
  if (
    current === null ||
    v2Task?.branch !== branch ||
    !new Set(["ACTIVE", "HANDOFF_PENDING"]).has(v2Task.state)
  ) {
    return current;
  }
  const activeActor =
    v2Task.state === "ACTIVE" ? v2Task.activeActor : v2Task.handoffFromActor;
  const pendingActor =
    v2Task.state === "HANDOFF_PENDING" ? v2Task.pendingActor : null;
  const handoffFromActor =
    v2Task.state === "HANDOFF_PENDING" ? v2Task.handoffFromActor : null;
  if (
    current.activeActor === activeActor &&
    current.pendingActor === pendingActor &&
    current.handoffFromActor === handoffFromActor
  ) {
    return current;
  }
  return updateTaskRecordV3(repoPath, current, {
    activeActor,
    pendingActor,
    handoffFromActor,
  }, now);
}

function updateTaskRecordV3(repoPath, current, overrides, now) {
  if (!validTimestamp(now) || Date.parse(now) < Date.parse(current.updatedAt)) fail("INVALID_TIMESTAMP");
  const next = createTaskRecordV3({
    ...current,
    ...overrides,
    revision: current.revision + 1,
    updatedAt: now,
  });
  return writeTaskRecordV3({
    repoPath,
    record: next,
    expectedRevision: current.revision,
    expectedFingerprint: current.fingerprint,
  });
}

function handoffCommandV3({ repoPath, record, action, actor, toActor, now }) {
  if (action === "offer") {
    if (
      !ACTORS.has(actor) ||
      !ACTORS.has(toActor) ||
      actor === toActor ||
      record.state !== "ACTIVE" ||
      record.activeActor !== actor ||
      record.pendingActor !== null
    ) fail("V3_HANDOFF_OFFER_STALE");
    const task = updateTaskRecordV3(repoPath, record, {
      pendingActor: toActor,
      handoffFromActor: actor,
    }, now);
    return { task, status: "HANDOFF_OFFERED" };
  }
  if (action === "accept" || action === "resume") {
    if (
      !ACTORS.has(actor) ||
      record.state !== "ACTIVE" ||
      record.pendingActor !== actor ||
      record.handoffFromActor !== record.activeActor
    ) fail("V3_HANDOFF_ACCEPT_STALE");
    const task = updateTaskRecordV3(repoPath, record, {
      activeActor: actor,
      pendingActor: null,
      handoffFromActor: null,
    }, now);
    return { task, status: "HANDOFF_ACCEPTED" };
  }
  if (action === "refresh") {
    if (record.handoffFromActor !== actor || record.pendingActor === null) fail("V3_HANDOFF_REFRESH_STALE");
    return { task: record, status: "HANDOFF_OFFERED" };
  }
  fail("TASK_HANDOFF_ACTION_INVALID");
}

function runtimeSnapshotFile(paths, fingerprint) {
  if (!FINGERPRINT_PATTERN.test(fingerprint)) fail("V3_RUNTIME_REFERENCE_INVALID");
  return path.join(paths.runtimes, `${fingerprint}.json`);
}

function runtimeFingerprint(runtimeRef) {
  const match = /^runtime:([a-f0-9]{64})$/u.exec(runtimeRef ?? "");
  if (match === null) fail("V3_RUNTIME_REFERENCE_INVALID");
  return match[1];
}

function removeRuntimeSnapshotBestEffort(paths, runtimeRef) {
  if (runtimeRef === null) return;
  try {
    const target = runtimeSnapshotFile(paths, runtimeFingerprint(runtimeRef));
    if (existsSync(target) && !lstatSync(target).isSymbolicLink()) unlinkSync(target);
  } catch {
    // Orphan cleanup is retried by later lifecycle maintenance.
  }
}

function validateRuntimeSnapshotV3(snapshot) {
  const errors = validateClosedObject(snapshot, RUNTIME_SNAPSHOT_KEYS, "");
  if (!isPlainObject(snapshot)) return errors;
  errors.push(...collectSensitiveValues(snapshot));
  if (snapshot.schemaVersion !== 1) errors.push(error("INVALID_SCHEMA_VERSION", "schemaVersion"));
  if (snapshot.recordType !== "RuntimeSnapshotV1") {
    errors.push(error("INVALID_RECORD_TYPE", "recordType"));
  }
  if (!TASK_ID_PATTERN.test(snapshot.taskId ?? "")) errors.push(error("INVALID_TASK_ID", "taskId"));
  try {
    parseTaskBranch(snapshot.branch);
  } catch {
    errors.push(error("INVALID_TASK_BRANCH", "branch"));
  }
  if (!ACTORS.has(snapshot.actor)) errors.push(error("INVALID_ACTOR", "actor"));
  if (
    !Array.isArray(snapshot.ports) ||
    snapshot.ports.length > 128 ||
    snapshot.ports.some((value) => !Number.isInteger(value) || value <= 0 || value > 65_535)
  ) errors.push(error("INVALID_PORTS", "ports"));
  if (
    !Array.isArray(snapshot.pids) ||
    snapshot.pids.length > 128 ||
    snapshot.pids.some((value) => !Number.isInteger(value) || value <= 0)
  ) errors.push(error("INVALID_PIDS", "pids"));
  if (
    !Array.isArray(snapshot.lockPaths) ||
    snapshot.lockPaths.length > 128 ||
    snapshot.lockPaths.some((value) => !path.isAbsolute(value) || sensitiveValue(value))
  ) errors.push(error("INVALID_LOCK_PATHS", "lockPaths"));
  if (!validTimestamp(snapshot.createdAt)) errors.push(error("INVALID_TIMESTAMP", "createdAt"));
  if (!FINGERPRINT_PATTERN.test(snapshot.fingerprint ?? "")) {
    errors.push(error("INVALID_FINGERPRINT", "fingerprint"));
  } else {
    const payload = structuredClone(snapshot);
    delete payload.fingerprint;
    if (hash(JSON.stringify(stableValue(payload))) !== snapshot.fingerprint) {
      errors.push(error("FINGERPRINT_MISMATCH", "fingerprint"));
    }
  }
  return errors;
}

export function readRuntimeSnapshotV3({ repoPath, taskId }) {
  const context = gitContext(path.resolve(repoPath));
  const paths = registryPaths(context.commonDir);
  assertPathPlan(context.commonDir, paths.runtimes, "V3_REGISTRY_PATH_ESCAPE");
  const record = readTaskRecordV3({ repoPath, taskId });
  if (record.runtimeRef === null) fail("V3_RUNTIME_NOT_FOUND");
  const fingerprint = runtimeFingerprint(record.runtimeRef);
  const snapshot = readJson(runtimeSnapshotFile(paths, fingerprint), "V3_RUNTIME_NOT_FOUND");
  if (validateRuntimeSnapshotV3(snapshot).length > 0) fail("V3_RUNTIME_INVALID");
  if (snapshot.taskId !== taskId || snapshot.fingerprint !== fingerprint) {
    fail("V3_RUNTIME_REFERENCE_MISMATCH");
  }
  return structuredClone(snapshot);
}

function runtimeCommandV3({
  repoPath,
  record,
  actor,
  ports,
  pids,
  lockPaths,
  now,
  runtimeInterleave = null,
}) {
  if (record.state !== "ACTIVE" || record.activeActor !== actor || !ACTORS.has(actor)) {
    fail("V3_RUNTIME_ACTOR_MISMATCH");
  }
  if (
    !Array.isArray(ports) ||
    !Array.isArray(pids) ||
    !Array.isArray(lockPaths) ||
    ports.length > 128 ||
    pids.length > 128 ||
    lockPaths.length > 128 ||
    ports.some((value) => !Number.isInteger(value) || value <= 0 || value > 65_535) ||
    pids.some((value) => !Number.isInteger(value) || value <= 0) ||
    lockPaths.some((value) => typeof value !== "string" || !path.isAbsolute(value) || sensitiveValue(value))
  ) fail("V3_RUNTIME_INVALID");
  const empty = ports.length === 0 && pids.length === 0 && lockPaths.length === 0;
  const context = gitContext(path.resolve(repoPath));
  const paths = prepareRegistry(context.commonDir);
  return withLock(paths, record.taskId, () => {
    const current = readJson(taskFile(paths, record.taskId), "V3_TASK_NOT_FOUND");
    if (validateTaskRecordV3(current, { repoPath: context.topLevel }).length > 0) {
      fail("V3_REGISTRY_RECORD_INVALID");
    }
    if (current.revision !== record.revision || current.fingerprint !== record.fingerprint) {
      fail("V3_RECORD_STALE");
    }
    if (current.state !== "ACTIVE" || current.activeActor !== actor || !ACTORS.has(actor)) {
      fail("V3_RUNTIME_ACTOR_MISMATCH");
    }
    if (!validTimestamp(now) || Date.parse(now) < Date.parse(current.updatedAt)) {
      fail("INVALID_TIMESTAMP");
    }
    if (runtimeInterleave !== null) runtimeInterleave();
    const previousRuntimeRef = current.runtimeRef;
    if (empty) {
      const task = createTaskRecordV3({
        ...current,
        runtimeRef: null,
        revision: current.revision + 1,
        updatedAt: now,
      });
      atomicWriteJson(taskFile(paths, current.taskId), task);
      removeRuntimeSnapshotBestEffort(paths, previousRuntimeRef);
      return { task, status: "RUNTIME_CLEARED" };
    }
    const canonicalLockPaths = lockPaths.map((lockPath) => {
      try {
        assertExistingUnlinkedPath(lockPath, "V3_RUNTIME_LOCK_PATH_INVALID");
        const canonical = canonicalPath(lockPath);
        const allowed =
          pathContains(current.workspace.path, canonical) ||
          pathContains(context.topLevel, canonical);
        if (!allowed) fail("V3_RUNTIME_LOCK_PATH_INVALID");
        return canonical;
      } catch (caught) {
        if (caught?.code === "V3_RUNTIME_LOCK_PATH_INVALID") throw caught;
        fail("V3_RUNTIME_LOCK_PATH_INVALID");
      }
    });
    const snapshotBase = {
      schemaVersion: 1,
      recordType: "RuntimeSnapshotV1",
      taskId: current.taskId,
      branch: current.branch.name,
      actor,
      ports: [...ports],
      pids: [...pids],
      lockPaths: canonicalLockPaths,
      createdAt: now,
    };
    const snapshot = {
      ...snapshotBase,
      fingerprint: hash(JSON.stringify(stableValue(snapshotBase))),
    };
    if (validateRuntimeSnapshotV3(snapshot).length > 0) fail("V3_RUNTIME_INVALID");
    const snapshotTarget = runtimeSnapshotFile(paths, snapshot.fingerprint);
    if (existsSync(snapshotTarget)) fail("V3_RUNTIME_SNAPSHOT_EXISTS");
    atomicWriteJson(snapshotTarget, snapshot);
    try {
      const runtimeRef = `runtime:${snapshot.fingerprint}`;
      const task = createTaskRecordV3({
        ...current,
        runtimeRef,
        revision: current.revision + 1,
        updatedAt: now,
      });
      atomicWriteJson(taskFile(paths, current.taskId), task);
      removeRuntimeSnapshotBestEffort(paths, previousRuntimeRef);
      return { task, status: "RUNTIME_REGISTERED" };
    } catch (caught) {
      removeRuntimeSnapshotBestEffort(paths, `runtime:${snapshot.fingerprint}`);
      throw caught;
    }
  });
}

function finishCommandV3({ repoPath, record, actor, now }) {
  if (record.activeActor !== actor || record.pendingActor !== null || record.state !== "ACTIVE") {
    fail("V3_FINISH_ACTOR_MISMATCH");
  }
  const context = gitContext(path.resolve(repoPath));
  const blockers = activeWorkspaceBlockers({
    context,
    record: { ...record, headSha: requireGit(record.workspace.path, ["rev-parse", "HEAD"], "WORKTREE_VERIFY_FAILED") },
    runner: null,
  }).filter((code) => code !== "ACTIVE_WORKSPACE_HEAD_MISMATCH");
  if (blockers.length > 0) fail("V3_ACTIVE_WORKSPACE_MISMATCH");
  const headSha = requireGit(record.workspace.path, ["rev-parse", "HEAD"], "WORKTREE_VERIFY_FAILED");
  const dirty = requireGit(
    record.workspace.path,
    ["status", "--porcelain=v1", "--untracked-files=all"],
    "WORKTREE_STATUS_FAILED",
  ) !== "";
  const task = updateTaskRecordV3(repoPath, record, { headSha }, now);
  return {
    schemaVersion: 3,
    recordType: "TaskFinishReportV3",
    taskId: task.taskId,
    branch: task.branch.name,
    headSha,
    dirty,
    task,
    createdAt: now,
  };
}

export function reconcileTaskRecordsV3WithV2({
  repoPath,
  now,
  v2StatusReader = readTaskStatus,
}) {
  if (!validTimestamp(now)) fail("INVALID_TIMESTAMP");
  const context = gitContext(path.resolve(repoPath));
  const candidates = listTaskRecords(context.commonDir).filter((record) =>
    record.state === "ACTIVE" &&
    record.workspace.kind === "isolated" &&
    record.workspace.ownership === "managed");
  let cleaned = 0;
  let preserved = 0;
  let unchanged = 0;
  const results = [];
  for (const candidate of candidates) {
    let v2Status;
    try {
      v2Status = v2StatusReader({
        repoPath: context.topLevel,
        branch: candidate.branch.name,
      });
    } catch {
      unchanged += 1;
      results.push({ taskId: candidate.taskId, result: "UNCHANGED" });
      continue;
    }
    const effectiveTask = v2Status?.task ?? null;
    const identityMismatch =
      effectiveTask !== null &&
      (effectiveTask.branch !== candidate.branch.name ||
        (validText(effectiveTask.worktreePath) &&
          !samePath(effectiveTask.worktreePath, candidate.workspace.path)));
    if (identityMismatch) {
      updateTaskRecordV3(context.topLevel, candidate, {
        state: "PRESERVED",
        activeActor: null,
        pendingActor: null,
        handoffFromActor: null,
        blockers: ["V2_TASK_IDENTITY_MISMATCH"],
      }, now);
      preserved += 1;
      results.push({ taskId: candidate.taskId, result: "PRESERVED" });
      continue;
    }
    if (effectiveTask?.state === "CLEANED" && effectiveTask.branch === candidate.branch.name) {
      updateTaskRecordV3(context.topLevel, candidate, {
        state: "CLEANED",
        activeActor: null,
        pendingActor: null,
        handoffFromActor: null,
        runtimeRef: null,
        blockers: [],
      }, now);
      cleaned += 1;
      results.push({ taskId: candidate.taskId, result: "CLEANED" });
      continue;
    }
    unchanged += 1;
    results.push({ taskId: candidate.taskId, result: "UNCHANGED" });
  }
  return {
    schemaVersion: 1,
    recordType: "TaskRecordV3V2ReconciliationV1",
    inspected: candidates.length,
    cleaned,
    preserved,
    unchanged,
    results,
    createdAt: now,
  };
}

function validateMergeEvidenceV3(evidence) {
  const errors = validateClosedObject(evidence, MERGE_EVIDENCE_KEYS, "mergeEvidence");
  if (!isPlainObject(evidence)) return errors;
  errors.push(...validateClosedObject(evidence.remoteBranch, REMOTE_BRANCH_EVIDENCE_KEYS, "mergeEvidence.remoteBranch"));
  if (evidence.production !== null) {
    errors.push(...validateClosedObject(evidence.production, PRODUCTION_EVIDENCE_KEYS, "mergeEvidence.production"));
  }
  errors.push(...collectSensitiveValues(evidence, "mergeEvidence"));
  if (evidence.schemaVersion !== 1 || evidence.recordType !== "TaskMergeEvidenceV3") {
    errors.push(error("MERGE_EVIDENCE_SCHEMA_INVALID", "mergeEvidence.recordType"));
  }
  if (!new Set(["github-pr", "promotion"]).has(evidence.source)) {
    errors.push(error("MERGE_EVIDENCE_SOURCE_INVALID", "mergeEvidence.source"));
  }
  for (const field of ["repositoryIdentity", "authLogin"]) {
    if (!validText(evidence[field], 4096)) {
      errors.push(error("MERGE_EVIDENCE_TEXT_INVALID", `mergeEvidence.${field}`));
    }
  }
  if (evidence.targetBranch !== "main") {
    errors.push(error("MERGE_TARGET_INVALID", "mergeEvidence.targetBranch"));
  }
  for (const field of ["headSha", "mainSha"]) {
    if (!SHA_PATTERN.test(evidence[field] ?? "")) {
      errors.push(error("MERGE_EVIDENCE_SHA_INVALID", `mergeEvidence.${field}`));
    }
  }
  if (!validTimestamp(evidence.mergedAt)) {
    errors.push(error("MERGE_EVIDENCE_TIMESTAMP_INVALID", "mergeEvidence.mergedAt"));
  }
  if (isPlainObject(evidence.remoteBranch)) {
    if (typeof evidence.remoteBranch.exists !== "boolean") {
      errors.push(error("REMOTE_BRANCH_EVIDENCE_INVALID", "mergeEvidence.remoteBranch.exists"));
    }
    if (evidence.remoteBranch.exists) {
      if (!SHA_PATTERN.test(evidence.remoteBranch.sha ?? "")) {
        errors.push(error("REMOTE_BRANCH_EVIDENCE_INVALID", "mergeEvidence.remoteBranch.sha"));
      }
    } else if (evidence.remoteBranch.sha !== null) {
      errors.push(error("REMOTE_BRANCH_EVIDENCE_INVALID", "mergeEvidence.remoteBranch.sha"));
    }
  }
  if (evidence.source === "promotion") {
    if (!isPlainObject(evidence.production) ||
        evidence.production.ready !== true ||
        !SHA_PATTERN.test(evidence.production.commitSha ?? "")) {
      errors.push(error("PRODUCTION_EVIDENCE_REQUIRED", "mergeEvidence.production"));
    }
  } else if (evidence.production !== null) {
    errors.push(error("PRODUCTION_EVIDENCE_FORBIDDEN", "mergeEvidence.production"));
  }
  return errors;
}

function cleanupReportFile(paths, taskId) {
  if (!TASK_ID_PATTERN.test(taskId)) fail("INVALID_TASK_ID");
  return path.join(paths.cleanupReports, `${taskId}.json`);
}

function cleanupReport({
  taskId,
  branch,
  trigger,
  result,
  blocker,
  strategy,
  stage,
  startedAt,
  finishedAt,
  retryAt,
}) {
  const payload = {
    schemaVersion: 3,
    recordType: "TaskAutoCleanupReportV3",
    taskId,
    branch,
    trigger,
    result,
    blocker,
    strategy,
    stage,
    startedAt,
    finishedAt,
    retryAt,
  };
  return {
    ...payload,
    fingerprint: hash(JSON.stringify(stableValue(payload))),
  };
}

function readCleanupReport(paths, taskId) {
  const target = cleanupReportFile(paths, taskId);
  return existsSync(target) ? readJson(target, "V3_CLEANUP_REPORT_NOT_FOUND") : null;
}

function writeCleanupReport(paths, report) {
  atomicWriteJson(cleanupReportFile(paths, report.taskId), report);
  return structuredClone(report);
}

function relativeStatusPath(line) {
  if (line.length < 4) return null;
  let value = line.slice(3);
  const renameSeparator = value.indexOf(" -> ");
  if (renameSeparator >= 0) value = value.slice(renameSeparator + 4);
  if (value.startsWith("\"") && value.endsWith("\"")) return null;
  return value.replaceAll("\\", "/");
}

function enumerateTaskWorkFiles(record) {
  const root = path.resolve(record.workspace.path, ".codex", "work");
  if (!existsSync(root)) return [];
  assertPathPlan(record.workspace.path, root, "ARTIFACT_WORK_ROOT_UNSAFE");
  if (!lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink()) {
    fail("ARTIFACT_WORK_ROOT_UNSAFE");
  }
  const files = [];
  const visit = (directory) => {
    assertPathPlan(root, directory, "ARTIFACT_WORK_ROOT_UNSAFE");
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      assertPathPlan(root, target, "ARTIFACT_WORK_ROOT_UNSAFE");
      if (entry.isSymbolicLink()) fail("ARTIFACT_WORK_ROOT_UNSAFE");
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile()) files.push(target);
      else fail("ARTIFACT_WORK_ROOT_UNSAFE");
    }
  };
  visit(root);
  return files;
}

function readTaskArtifactManifest(record) {
  if (record.artifactManifestRef === null) {
    return { manifestPath: null, paths: [] };
  }
  const reference = record.artifactManifestRef.replaceAll("\\", "/");
  const expectedPrefix = `.codex/work/${record.branch.slug}/`;
  if (path.isAbsolute(reference) || !reference.startsWith(expectedPrefix) || reference.includes("../")) {
    fail("ARTIFACT_MANIFEST_PATH_UNSAFE");
  }
  const manifestPath = path.resolve(record.workspace.path, ...reference.split("/"));
  assertPathPlan(record.workspace.path, manifestPath, "ARTIFACT_MANIFEST_PATH_UNSAFE");
  if (!existsSync(manifestPath) || lstatSync(manifestPath).isSymbolicLink()) {
    fail("ARTIFACT_MANIFEST_INVALID");
  }
  const manifest = readJson(manifestPath, "ARTIFACT_MANIFEST_INVALID");
  const allowed = new Set([
    "schemaVersion",
    "recordType",
    "taskId",
    "files",
    "createdAt",
    "fingerprint",
  ]);
  if (validateClosedObject(manifest, allowed, "artifactManifest").length > 0 ||
      manifest.schemaVersion !== 3 ||
      manifest.recordType !== "TaskArtifactManifestV3" ||
      manifest.taskId !== record.taskId ||
      !Array.isArray(manifest.files) ||
      !validTimestamp(manifest.createdAt)) {
    fail("ARTIFACT_MANIFEST_INVALID");
  }
  const expectedFingerprint = fingerprintRecord(manifest);
  if (!FINGERPRINT_PATTERN.test(manifest.fingerprint ?? "") ||
      manifest.fingerprint !== expectedFingerprint) {
    fail("ARTIFACT_MANIFEST_INVALID");
  }
  const rootPath = path.dirname(manifestPath);
  const paths = [];
  for (const entry of manifest.files) {
    if (typeof entry !== "string" ||
        entry.length === 0 ||
        entry.includes("\\") ||
        entry.includes("..") ||
        path.isAbsolute(entry)) {
      fail("ARTIFACT_MANIFEST_INVALID");
    }
    const target = path.resolve(rootPath, ...entry.split("/"));
    assertPathPlan(rootPath, target, "ARTIFACT_MANIFEST_PATH_UNSAFE");
    if (!existsSync(target) || lstatSync(target).isSymbolicLink() || !lstatSync(target).isFile()) {
      fail("ARTIFACT_MANIFEST_INVALID");
    }
    paths.push(target);
  }
  return { manifestPath, paths };
}

function runtimeActive(record, context, probes) {
  if (record.runtimeRef === null) return false;
  let snapshot;
  try {
    snapshot = readRuntimeSnapshotV3({ repoPath: context.topLevel, taskId: record.taskId });
  } catch {
    fail("RUNTIME_EVIDENCE_INVALID");
  }
  const processActive = probes.processActive ?? ((pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  });
  const portActive = probes.portActive ?? (() => true);
  const lockActive = probes.lockActive ?? ((lockPath) => existsSync(lockPath));
  return snapshot.pids.some(processActive) ||
    snapshot.ports.some(portActive) ||
    snapshot.lockPaths.some(lockActive);
}

function cleanupWorkspaceSnapshot({ context, record, evidence, runner, probes }) {
  const blockers = [];
  const branchName = record.branch?.name ?? null;
  if (!AUTOCLEANUP_ELIGIBLE_STATES.has(record.state)) blockers.push("TASK_STATE_NOT_ELIGIBLE");
  if (branchName === null || new Set(["main", "stg"]).has(branchName)) {
    blockers.push("PROTECTED_BRANCH");
  }
  if (record.repoProfile.repositoryIdentity !== evidence.repositoryIdentity) {
    blockers.push("REPOSITORY_IDENTITY_MISMATCH");
  }
  if (record.repoProfile.authLogin !== evidence.authLogin) blockers.push("AUTH_LOGIN_MISMATCH");
  if (record.headSha !== evidence.headSha) blockers.push("MERGE_HEAD_MISMATCH");
  const originMain = runGit(context.topLevel, ["rev-parse", "--verify", "origin/main^{commit}"], runner);
  if (originMain.status !== 0 || originMain.stdout !== evidence.mainSha) blockers.push("MAIN_SHA_MISMATCH");
  if (runGit(context.topLevel, ["merge-base", "--is-ancestor", record.headSha, evidence.mainSha], runner).status !== 0) {
    blockers.push("HEAD_NOT_MERGED");
  }
  if (evidence.source === "promotion" && evidence.production?.commitSha !== evidence.mainSha) {
    blockers.push("PRODUCTION_SHA_MISMATCH");
  }
  if (record.workspace.ownership !== "managed") {
    return {
      blockers: [...new Set(blockers)],
      status: "",
      artifact: { manifestPath: null, paths: [] },
      fingerprint: hash(JSON.stringify(stableValue({ blockers, headSha: record.headSha, mainSha: evidence.mainSha }))),
    };
  }
  const active = inspectActiveWorkspace({ context, record, runner });
  blockers.push(...active.blockers);
  let artifact = { manifestPath: null, paths: [] };
  try {
    artifact = readTaskArtifactManifest(record);
  } catch (caught) {
    blockers.push(caught.code ?? "ARTIFACT_MANIFEST_INVALID");
  }
  const statusResult = runGit(
    record.workspace.path,
    ["status", "--porcelain=v1", "--untracked-files=all"],
    runner,
  );
  let status = statusResult.stdout;
  if (statusResult.status !== 0) blockers.push("WORKSPACE_STATUS_FAILED");
  const allowedUntracked = new Set([
    ...(artifact.manifestPath === null ? [] : [
      path.relative(record.workspace.path, artifact.manifestPath).replaceAll("\\", "/"),
    ]),
    ...artifact.paths.map((target) => path.relative(record.workspace.path, target).replaceAll("\\", "/")),
  ]);
  for (const line of status.split(/\r?\n/u).filter(Boolean)) {
    const relative = relativeStatusPath(line);
    if (!line.startsWith("?? ") || relative === null || !allowedUntracked.has(relative)) {
      blockers.push(line.startsWith("?? ") ? "UNKNOWN_ARTIFACT" : "DIRTY");
    }
  }
  try {
    const allowedTaskFiles = new Set([
      ...(artifact.manifestPath === null ? [] : [pathKey(artifact.manifestPath)]),
      ...artifact.paths.map(pathKey),
    ]);
    if (enumerateTaskWorkFiles(record).some((target) => !allowedTaskFiles.has(pathKey(target)))) {
      blockers.push("UNKNOWN_ARTIFACT");
    }
  } catch (caught) {
    blockers.push(caught.code ?? "ARTIFACT_WORK_ROOT_UNSAFE");
  }
  try {
    if (runtimeActive(record, context, probes)) blockers.push("RUNTIME_ACTIVE");
  } catch (caught) {
    blockers.push(caught.code ?? "RUNTIME_EVIDENCE_INVALID");
  }
  const branchSha = branchName === null
    ? { status: 1, stdout: "" }
    : runGit(
        context.topLevel,
        ["rev-parse", "--verify", `refs/heads/${branchName}^{commit}`],
        runner,
      );
  if (branchName !== null &&
      (branchSha.status !== 0 || branchSha.stdout !== record.headSha)) {
    blockers.push("LOCAL_BRANCH_SHA_MISMATCH");
  }
  const fingerprintValue = {
    taskFingerprint: record.fingerprint,
    evidence,
    workspaceHead: active.headSha,
    branchSha: branchSha.stdout,
    status,
    artifactPaths: artifact.paths.map((target) => pathKey(target)),
    runtimeRef: record.runtimeRef,
    blockers: [...new Set(blockers)],
  };
  return {
    blockers: [...new Set(blockers)],
    status,
    artifact,
    fingerprint: hash(JSON.stringify(stableValue(fingerprintValue))),
  };
}

function removeManifestArtifacts(record, artifact) {
  if (artifact.manifestPath === null) return;
  for (const target of artifact.paths) {
    assertPathPlan(record.workspace.path, target, "ARTIFACT_MANIFEST_PATH_UNSAFE");
    unlinkSync(target);
  }
  unlinkSync(artifact.manifestPath);
  let directory = path.dirname(artifact.manifestPath);
  const stop = path.resolve(record.workspace.path, ".codex", "work");
  while (pathContains(stop, directory) && !samePath(stop, directory)) {
    try {
      rmdirSync(directory);
    } catch {
      break;
    }
    directory = path.dirname(directory);
  }
}

function terminalRecord(record, { state, blocker, now }) {
  return createTaskRecordV3({
    ...record,
    state,
    activeActor: null,
    pendingActor: null,
    handoffFromActor: null,
    runtimeRef: state === "CLEANED" || state === "RELEASED" ? null : record.runtimeRef,
    blockers: blocker === null ? [] : [blocker],
    revision: record.revision + 1,
    updatedAt: now,
  });
}

export function autoCleanupTaskRecordV3({
  repoPath,
  taskId,
  mergeEvidence,
  now,
  trigger = "DIRECT",
  gitRunner = null,
  probes = {},
  deleteRemoteBranch = null,
  verifyRemoteBranchAbsent = null,
  delegateIsolated = null,
}) {
  if (!validTimestamp(now)) fail("INVALID_TIMESTAMP");
  const evidenceErrors = validateMergeEvidenceV3(mergeEvidence);
  if (evidenceErrors.length > 0) fail(evidenceErrors[0].code);
  const context = gitContext(path.resolve(repoPath), { requireBase: true, runner: gitRunner });
  const paths = prepareRegistry(context.commonDir);
  return withLock(paths, taskId, () => {
    const target = taskFile(paths, taskId);
    const record = readJson(target, "V3_TASK_NOT_FOUND");
    if (validateTaskRecordV3(record, { repoPath: context.topLevel }).length > 0) {
      fail("V3_REGISTRY_RECORD_INVALID");
    }
    const startedAt = now;
    const strategy = planTaskCleanupV3(record).strategy;
    const branchName = record.branch?.name ?? null;
    const finishReport = (result, blocker, stage, retry = false) => writeCleanupReport(paths, cleanupReport({
      taskId,
      branch: record.branch?.name ?? null,
      trigger,
      result,
      blocker,
      strategy,
      stage,
      startedAt,
      finishedAt: now,
      retryAt: retry ? new Date(Date.parse(now) + AUTOCLEANUP_COOLDOWN_MS).toISOString() : null,
    }));
    if (!AUTOCLEANUP_ELIGIBLE_STATES.has(record.state)) {
      return finishReport("PRESERVED", "TASK_STATE_NOT_ELIGIBLE", "PRECHECK", true);
    }
    if (record.workspace.ownership !== "managed") {
      const liveMain = runGit(
        context.topLevel,
        ["rev-parse", "--verify", "origin/main^{commit}"],
        gitRunner,
      );
      const headMerged =
        liveMain.status === 0 &&
        liveMain.stdout === mergeEvidence.mainSha &&
        runGit(
          context.topLevel,
          ["merge-base", "--is-ancestor", record.headSha, mergeEvidence.mainSha],
          gitRunner,
        ).status === 0;
      const safeRelease =
        branchName !== null &&
        !new Set(["main", "stg"]).has(branchName) &&
        record.repoProfile.repositoryIdentity === mergeEvidence.repositoryIdentity &&
        record.repoProfile.authLogin === mergeEvidence.authLogin &&
        record.headSha === mergeEvidence.headSha &&
        headMerged &&
        mergeEvidence.targetBranch === "main" &&
        (mergeEvidence.source !== "promotion" ||
          (mergeEvidence.production?.ready === true &&
            mergeEvidence.production.commitSha === mergeEvidence.mainSha));
      if (!safeRelease) return finishReport("PRESERVED", "RELEASE_EVIDENCE_MISMATCH", "PRECHECK");
      const released = terminalRecord(record, { state: "RELEASED", blocker: null, now });
      atomicWriteJson(target, released);
      return finishReport("RELEASED", null, "COMPLETE");
    }
    let first = cleanupWorkspaceSnapshot({
      context,
      record,
      evidence: mergeEvidence,
      runner: gitRunner,
      probes,
    });
    if (first.blockers.length > 0) {
      const blocker = first.blockers[0];
      const preserveTerminal = !new Set([
        "MAIN_SHA_MISMATCH",
        "HEAD_NOT_MERGED",
      ]).has(blocker);
      if (preserveTerminal) {
        atomicWriteJson(target, terminalRecord(record, { state: "PRESERVED", blocker, now }));
      }
      return finishReport("PRESERVED", blocker, "PRECHECK", !preserveTerminal);
    }
    if (branchName === null) {
      return finishReport("PRESERVED", "PROTECTED_BRANCH", "PRECHECK");
    }
    if (mergeEvidence.remoteBranch.exists) {
      if (mergeEvidence.remoteBranch.sha !== record.headSha) {
        return finishReport("PRESERVED", "REMOTE_BRANCH_SHA_MISMATCH", "REMOTE_PRECHECK");
      }
      if (typeof deleteRemoteBranch !== "function" || typeof verifyRemoteBranchAbsent !== "function") {
        return finishReport("PRESERVED", "REMOTE_DELETE_UNAVAILABLE", "REMOTE_PRECHECK", true);
      }
      const deletion = deleteRemoteBranch({
        repositoryIdentity: record.repoProfile.repositoryIdentity,
        authLogin: record.repoProfile.authLogin,
        branch: branchName,
        expectedSha: record.headSha,
      });
      if (deletion?.deleted !== true ||
          verifyRemoteBranchAbsent({
            repositoryIdentity: record.repoProfile.repositoryIdentity,
            branch: branchName,
          }) !== true) {
        return finishReport("PRESERVED", "REMOTE_DELETE_NOT_CONFIRMED", "REMOTE_DELETE", true);
      }
    }
    const second = cleanupWorkspaceSnapshot({
      context,
      record,
      evidence: mergeEvidence,
      runner: gitRunner,
      probes,
    });
    if (second.blockers.length > 0 || second.fingerprint !== first.fingerprint) {
      const blocker = second.blockers[0] ?? "CLEANUP_SNAPSHOT_CHANGED";
      atomicWriteJson(target, terminalRecord(record, { state: "PRESERVED", blocker, now }));
      return finishReport("PRESERVED", blocker, "TOCTOU_RECHECK");
    }
    if (record.workspace.kind === "isolated") {
      if (typeof delegateIsolated !== "function") {
        return finishReport("PRESERVED", "V2_CLEANUP_DELEGATE_UNAVAILABLE", "DELEGATE", true);
      }
      const delegated = delegateIsolated({ record: structuredClone(record), mergeEvidence: structuredClone(mergeEvidence) });
      if (delegated?.status !== "CLEANED") {
        return finishReport("PRESERVED", "V2_CLEANUP_NOT_CONFIRMED", "DELEGATE", true);
      }
      removeRuntimeSnapshotBestEffort(paths, record.runtimeRef);
      atomicWriteJson(target, terminalRecord(record, { state: "CLEANED", blocker: null, now }));
      return finishReport("CLEANED", null, "COMPLETE");
    }
    try {
      removeManifestArtifacts(record, second.artifact);
      requireGit(
        record.workspace.path,
        ["switch", "--detach", mergeEvidence.mainSha],
        "SHARED_SLOT_DETACH_FAILED",
        gitRunner,
      );
      const detachedHead = requireGit(
        record.workspace.path,
        ["rev-parse", "HEAD"],
        "SHARED_SLOT_VERIFY_FAILED",
        gitRunner,
      );
      const detachedBranch = requireGit(
        record.workspace.path,
        ["branch", "--show-current"],
        "SHARED_SLOT_VERIFY_FAILED",
        gitRunner,
      );
      if (detachedHead !== mergeEvidence.mainSha || detachedBranch !== "") fail("SHARED_SLOT_VERIFY_FAILED");
      requireGit(
        context.topLevel,
        ["branch", "-d", branchName],
        "SHARED_SLOT_BRANCH_NOT_DISPOSABLE",
        gitRunner,
      );
      if (runGit(
        context.topLevel,
        ["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`],
        gitRunner,
      ).status === 0) {
        fail("SHARED_SLOT_BRANCH_DELETE_NOT_CONFIRMED");
      }
      removeRuntimeSnapshotBestEffort(paths, record.runtimeRef);
      atomicWriteJson(target, terminalRecord(record, { state: "CLEANED", blocker: null, now }));
      return finishReport("CLEANED", null, "COMPLETE");
    } catch (caught) {
      const blocker = /^[A-Z0-9_:-]{1,128}$/u.test(caught?.code ?? "") ?
        caught.code :
        "CLEANUP_MUTATION_FAILED";
      atomicWriteJson(target, terminalRecord(record, { state: "PRESERVED", blocker, now }));
      return finishReport("PRESERVED", blocker, "MUTATION");
    }
  });
}

export function sweepTaskRecordsV3({
  repoPath,
  now = null,
  maxTasks = 10,
  maxDurationMs = 600_000,
  resolveMergeEvidence = null,
  clock = () => Date.now(),
  cleanupOptions = {},
} = {}) {
  const context = gitContext(path.resolve(repoPath));
  const records = listTaskRecords(context.commonDir);
  if (resolveMergeEvidence !== null) {
    if (typeof resolveMergeEvidence !== "function" ||
        !validTimestamp(now) ||
        !Number.isInteger(maxTasks) ||
        maxTasks < 1 ||
        maxTasks > 10 ||
        !Number.isInteger(maxDurationMs) ||
        maxDurationMs < 1 ||
        maxDurationMs > 600_000) {
      fail("V3_SWEEP_ARGUMENTS_INVALID");
    }
    const paths = prepareRegistry(context.commonDir);
    return withLock(paths, "autocleanup-sweep", () => {
      const started = clock();
      let attempted = 0;
      let cleaned = 0;
      let released = 0;
      let preserved = 0;
      let deferred = 0;
      const results = [];
      const candidates = records
        .filter((record) => AUTOCLEANUP_ELIGIBLE_STATES.has(record.state))
        .sort((first, second) => first.updatedAt.localeCompare(second.updatedAt));
      for (const record of candidates) {
        if (attempted >= maxTasks || clock() - started >= maxDurationMs) break;
        const prior = readCleanupReport(paths, record.taskId);
        if (prior?.retryAt && Date.parse(prior.retryAt) > Date.parse(now)) {
          deferred += 1;
          results.push({ taskId: record.taskId, result: "DEFERRED_COOLDOWN" });
          continue;
        }
        const evidence = resolveMergeEvidence(structuredClone(record));
        if (evidence === null) {
          deferred += 1;
          results.push({ taskId: record.taskId, result: "DEFERRED_NOT_MERGED" });
          continue;
        }
        attempted += 1;
        const result = autoCleanupTaskRecordV3({
          repoPath: context.topLevel,
          taskId: record.taskId,
          mergeEvidence: evidence,
          now,
          trigger: "SWEEP",
          ...cleanupOptions,
        });
        if (result.result === "CLEANED") cleaned += 1;
        else if (result.result === "RELEASED") released += 1;
        else preserved += 1;
        results.push({ taskId: record.taskId, result: result.result, blocker: result.blocker });
      }
      return {
        schemaVersion: 3,
        recordType: "TaskSweepReportV3",
        inspected: records.length,
        attempted,
        cleaned,
        released,
        preserved,
        deferred,
        durationMs: Math.max(0, clock() - started),
        results,
        status: "COMPLETED",
      };
    });
  }
  const candidates = records.map((record) => ({
      taskId: record.taskId,
      branch: record.branch?.name ?? null,
      state: record.state,
      workspaceKind: record.workspace.kind,
      action:
        record.state === "PRESERVED" ? "PRESERVE"
          : record.state === "MERGED" ? "V3_PENDING_AUTOCLEANUP"
            : "SKIP_NOT_MERGED",
    }));
  return {
    schemaVersion: 3,
    recordType: "TaskSweepReportV3",
    inspected: records.length,
    deleted: 0,
    candidates,
    status: "REPORT_ONLY",
  };
}

export function runTaskCommandV3({
  command,
  repoPath,
  branch,
  actor = null,
  toActor = null,
  action = null,
  ports = [],
  pids = [],
  lockPaths = [],
  now = new Date().toISOString(),
  runtimeInterleave = null,
}) {
  if (command === "sweep") {
    return { handled: true, result: sweepTaskRecordsV3({ repoPath }) };
  }
  const record = readTaskRecordV3ByBranch({ repoPath, branch });
  if (record === null) return { handled: false, result: null };
  if (command === "status") {
    const context = gitContext(path.resolve(repoPath));
    const liveBlockers = !TERMINAL_STATES.has(record.state)
      ? activeWorkspaceBlockers({ context, record, runner: null, allowDescendant: true })
      : [];
    return {
      handled: true,
      result: {
        task: record,
        summary: liveBlockers.length === 0 ? "V3_TASK_READY" : "V3_TASK_PRESERVE_REQUIRED",
        blockers: [...new Set([...record.blockers, ...liveBlockers])],
      },
    };
  }
  if (command === "handoff") {
    return {
      handled: true,
      result: handoffCommandV3({ repoPath, record, action, actor, toActor, now }),
    };
  }
  if (command === "resume") {
    return {
      handled: true,
      result: handoffCommandV3({ repoPath, record, action: "resume", actor, now }),
    };
  }
  if (command === "runtime") {
    return {
      handled: true,
      result: runtimeCommandV3({
        repoPath,
        record,
        actor,
        ports,
        pids,
        lockPaths,
        now,
        runtimeInterleave,
      }),
    };
  }
  if (command === "finish") {
    return { handled: true, result: finishCommandV3({ repoPath, record, actor, now }) };
  }
  if (command === "finalize") {
    return {
      handled: true,
      result: {
        schemaVersion: 3,
        recordType: "TaskFinalizeReportV3",
        taskId: record.taskId,
        reportOnly: true,
        cleanupPlan: planTaskCleanupV3(record),
        blockers: record.runtimeRef === null ? [] : ["RUNTIME_ACTIVE"],
      },
    };
  }
  if (new Set(["cleanup", "autocleanup"]).has(command)) {
    if (record.workspace.kind === "isolated" && record.workspace.ownership === "managed") {
      return { handled: false, result: null, v3Task: record };
    }
    return {
      handled: true,
      result: {
        schemaVersion: 3,
        recordType: "TaskCleanupDeferredV3",
        taskId: record.taskId,
        status: "PRESERVED",
        blocker: command === "autocleanup" ? "V3_AUTOCLEANUP_NOT_READY" : "V3_CLEANUP_NOT_READY",
        cleanupPlan: planTaskCleanupV3(record),
      },
    };
  }
  return { handled: false, result: null, v3Task: record };
}

// 위임 실패 사실(V2_CLEANUP_NOT_CONFIRMED)만 남기면 운영자가 무엇을 고쳐야 하는지 알 수
// 없다. V2 가 보고한 실제 이유를 함께 남긴다. V2 결과는 이 모듈이 검증하지 않는 입력이라
// record schema 가 허용하는 형식만 통과시키고 개수 상한도 지킨다.
export const V3_BLOCKER_PATTERN = /^[A-Z0-9_:-]{1,128}$/u;
const V3_BLOCKER_LIMIT = 32;

export function mergeDelegatedCleanupBlockers(v2Result) {
  const reported = Array.isArray(v2Result?.blockers) ? v2Result.blockers : [];
  const safe = reported.filter((item) =>
    typeof item === "string" && V3_BLOCKER_PATTERN.test(item));
  return [...new Set(["V2_CLEANUP_NOT_CONFIRMED", ...safe])].slice(0, V3_BLOCKER_LIMIT);
}

// 보고용 목록. record 의 blocker 와 방금 받은 V2 이유를 합치면 각각 상한이 32 라 그냥
// 이어붙이면 상한을 넘는다. 뒤에서 자르면 최신 이유가 사라지므로 순서를 고정한다:
// 위임 실패 사실(단일 blocker 계약) -> 방금 받은 V2 이유 -> record 의 기존 blocker.
// 상한에 걸리면 오래된 record 항목부터 잘린다.
export function mergeReportedCleanupBlockers({ recordBlockers, v2Result }) {
  const stored = Array.isArray(recordBlockers) ? recordBlockers : [];
  const safeStored = stored.filter((item) =>
    typeof item === "string" && V3_BLOCKER_PATTERN.test(item));
  return [...new Set([
    ...mergeDelegatedCleanupBlockers(v2Result),
    ...safeStored,
  ])].slice(0, V3_BLOCKER_LIMIT);
}

export function reconcileDelegatedCleanupV3({
  repoPath,
  branch,
  v2Result,
  now,
  v2StatusReader = readTaskStatus,
}) {
  const current = readTaskRecordV3ByBranch({ repoPath, branch });
  if (current === null) fail("V3_TASK_NOT_FOUND");
  if (current.workspace.kind !== "isolated" || current.workspace.ownership !== "managed") {
    fail("V3_CLEANUP_DELEGATION_INVALID");
  }
  // CLEANED and RELEASED are final - their resources are gone and nothing can
  // change that. PRESERVED is the one state worth revisiting here, because the
  // delegated cleanup can finish after the record was written and a record that
  // reports a blocked cleanup for resources that no longer exist is simply wrong.
  // Only a confirmed cleanup moves it; every other outcome returns the record
  // untouched below, so a preserved task never churns. Nothing else about
  // PRESERVED changes - it stays outside the autocleanup eligibility set and keeps
  // reporting preserve-only as its plan.
  if (current.state === "CLEANED" || current.state === "RELEASED") return current;
  let v2Status = null;
  try {
    v2Status = v2StatusReader({ repoPath, branch });
  } catch {
    v2Status = null;
  }
  const resultClaimsCleaned = v2Result?.status === "CLEANED" || v2Result?.result === "CLEANED";
  const v2ConfirmsCleaned =
    resultClaimsCleaned &&
    v2Status?.task?.state === "CLEANED" &&
    v2Status?.task?.branch === branch;
  // A preserved record only moves on a confirmed cleanup. Rewriting it on any
  // other outcome would churn its revision and blockers without new information.
  if (current.state === "PRESERVED" && !v2ConfirmsCleaned) return current;
  return updateTaskRecordV3(repoPath, current, {
    state: v2ConfirmsCleaned ? "CLEANED" : "PRESERVED",
    activeActor: null,
    pendingActor: null,
    handoffFromActor: null,
    runtimeRef: v2ConfirmsCleaned ? null : current.runtimeRef,
    blockers: v2ConfirmsCleaned ? [] : mergeDelegatedCleanupBlockers(v2Result),
  }, now);
}

export function planTaskCleanupV3(record) {
  if (validateTaskRecordV3(record).length > 0) fail("V3_RECORD_INVALID");
  if (record.state === "PRESERVED") {
    return {
      strategy: "preserve-only",
      preserveWorkspace: true,
      actions: ["PRESERVE_ALL_RESOURCES"],
    };
  }
  if (record.workspace.kind === "shared-slot" && record.workspace.ownership === "managed") {
    return {
      strategy: "shared-slot",
      preserveWorkspace: true,
      actions: [
        ...(record.artifactManifestRef === null ? [] : ["REMOVE_MANIFEST_OWNED_ARTIFACTS"]),
        "DETACH_TO_EXACT_ORIGIN_MAIN",
        "DELETE_LOCAL_BRANCH_NON_FORCE",
      ],
    };
  }
  if (record.workspace.kind === "isolated" && record.workspace.ownership === "managed") {
    return {
      strategy: "delegate-v2-isolated",
      preserveWorkspace: false,
      actions: ["USE_V2_SAFE_CLEANUP"],
    };
  }
  return {
    strategy: "release-only",
    preserveWorkspace: true,
    actions: ["RELEASE_CLAIM", "PRESERVE_FOLDER_AND_REF"],
  };
}

export function transitionTaskCleanupV3(record, { result, blocker = null, now }) {
  if (validateTaskRecordV3(record).length > 0) fail("V3_RECORD_INVALID");
  if (record.state !== "MERGED") fail("V3_CLEANUP_STATE_INVALID");
  if (!validTimestamp(now) || Date.parse(now) < Date.parse(record.updatedAt)) fail("INVALID_TIMESTAMP");
  let state;
  let blockers = [];
  if (result === "PRESERVED") {
    if (!/^[A-Z0-9_:-]{1,128}$/u.test(blocker ?? "")) fail("V3_CLEANUP_BLOCKER_REQUIRED");
    state = "PRESERVED";
    blockers = [blocker];
  } else if (result === "CLEANED") {
    state = record.workspace.ownership === "managed" ? "CLEANED" : "RELEASED";
  } else {
    fail("V3_CLEANUP_RESULT_INVALID");
  }
  return createTaskRecordV3({
    ...record,
    state,
    activeActor: null,
    blockers,
    revision: record.revision + 1,
    updatedAt: now,
  });
}

function parseWorktrees(output) {
  const records = [];
  let current = null;
  for (const line of `${output}\n`.split(/\r?\n/u)) {
    if (line.startsWith("worktree ")) {
      if (current !== null) records.push(current);
      current = { path: canonicalPath(line.slice(9)), branch: null };
    } else if (current !== null && line.startsWith("branch refs/heads/")) {
      current.branch = line.slice("branch refs/heads/".length);
    } else if (line === "" && current !== null) {
      records.push(current);
      current = null;
    }
  }
  return records;
}

export function discoverUnregisteredWorktreesV3({ repoPath }) {
  const context = gitContext(path.resolve(repoPath));
  const registered = new Set(listTaskRecords(context.commonDir).map((record) => pathKey(record.workspace.path)));
  return parseWorktrees(requireGit(context.topLevel, ["worktree", "list", "--porcelain"], "WORKTREE_LIST_FAILED"))
    .filter((entry) => !samePath(entry.path, context.topLevel) && !registered.has(pathKey(entry.path)))
    .map((entry) => ({ ...entry, registered: false, disposition: "DISCOVERY_ONLY" }));
}

function safeReadOptionalJson(filePath) {
  if (!existsSync(filePath)) return null;
  if (lstatSync(filePath).isSymbolicLink()) fail("V3_REGISTRY_PATH_ESCAPE");
  return readJson(filePath, "V2_RECORD_NOT_FOUND");
}

export function migrateTaskRecordV2({ repoPath, branch, now }) {
  if (!validTimestamp(now)) fail("INVALID_TIMESTAMP");
  const context = gitContext(path.resolve(repoPath));
  const parsed = parseTaskBranch(branch);
  const v2Root = path.join(context.commonDir, "talkpik-task-lifecycle", "v2");
  const v2TaskFile = path.join(v2Root, "tasks", `${parsed.type}-${parsed.slug}.json`);
  assertPathPlan(context.commonDir, v2TaskFile, "V3_REGISTRY_PATH_ESCAPE");
  const source = readJson(v2TaskFile, "V2_TASK_NOT_FOUND");
  if (validateTaskRecordV2(source).length > 0 || source.branch !== branch) fail("V2_RECORD_INVALID");
  const sourceFingerprint = hash(JSON.stringify(stableValue(source)));
  const taskId = v3TaskId(["v2", source.taskId, sourceFingerprint]);
  const paths = prepareRegistry(context.commonDir);
  const journalFile = path.join(paths.migrations, `${source.taskId}.json`);
  if (existsSync(journalFile)) {
    const journal = readJson(journalFile, "V3_MIGRATION_NOT_FOUND");
    if (journal.sourceFingerprint !== sourceFingerprint || journal.targetTaskId !== taskId) {
      fail("V3_MIGRATION_SOURCE_CHANGED");
    }
    return {
      record: readTaskRecordV3({ repoPath, taskId }),
      journal: structuredClone(journal),
      reused: true,
    };
  }
  const cleanupFile = path.join(v2Root, "cleanups", `${source.taskId}.json`);
  assertPathPlan(context.commonDir, cleanupFile, "V3_REGISTRY_PATH_ESCAPE");
  const cleanup = safeReadOptionalJson(cleanupFile);
  const cleaned = cleanup !== null &&
    validateCleanupManifest(cleanup).length === 0 &&
    cleanup.status === "CLEANED" &&
    cleanup.taskId === source.taskId &&
    cleanup.branch === source.branch;
  const workspaceExists = existsSync(source.worktreePath) &&
    lstatSync(source.worktreePath).isDirectory() &&
    !lstatSync(source.worktreePath).isSymbolicLink();
  let state = "ACTIVE";
  const blockers = [];
  if (cleaned) state = "CLEANED";
  else if (!workspaceExists) {
    state = "PRESERVED";
    blockers.push("V2_WORKSPACE_MISSING");
  } else if (!ACTORS.has(source.activeActor)) {
    state = "PRESERVED";
    blockers.push("V2_ACTOR_UNSUPPORTED");
  }
  const profile = repositoryProfile(context.topLevel);
  const record = buildRecord({
    repoProfile: profile,
    baseSha: source.baseSha,
    branch: source.branch,
    workspace: {
      kind: "isolated",
      ownership: "managed",
      path: canonicalPath(source.worktreePath),
      gitDir: workspaceExists ? gitDirForWorktree(source.worktreePath) : path.join(context.commonDir, "worktrees", source.taskId),
    },
    actor: ACTORS.has(source.activeActor) ? source.activeActor : "codex",
    now,
    taskId,
    state,
    blockers,
  });
  const stored = writeTaskRecordV3({ repoPath, record });
  const journalBase = {
    schemaVersion: 1,
    recordType: "TaskRecordV2CopyJournalV1",
    sourceTaskId: source.taskId,
    sourceFingerprint,
    targetTaskId: taskId,
    migratedAt: now,
  };
  const journal = { ...journalBase, fingerprint: hash(JSON.stringify(stableValue(journalBase))) };
  atomicWriteJson(journalFile, journal);
  return { record: stored, journal: structuredClone(journal), reused: false };
}
