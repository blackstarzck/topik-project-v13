import {
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
} from "node:fs";
import {
  open,
  readFile,
  readdir,
  rename,
  lstat,
  stat,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";

import {
  hasValidIsoTimestamp,
  isForbiddenReportState,
  isValidIdentifier,
  isValidTransition,
  validateTaskRecord,
  validateTransitionEvidence,
} from "./task-lifecycle-schema.mjs";

export { validateTaskRecord } from "./task-lifecycle-schema.mjs";

const CAPABILITY_BRAND = Symbol("task-lifecycle-registry-capability");
const MAX_RECORD_BYTES = 64 * 1024;

class RegistryError extends Error {
  constructor(code) {
    super(code);
    this.name = "RegistryError";
    this.code = code;
  }
}

function assertValidRecord(record) {
  const errors = validateTaskRecord(record);
  if (errors.length > 0) {
    const codes = [...new Set(errors.map((error) => error.code))].sort().join(",");
    throw new RegistryError(`INVALID_TASK_RECORD:${codes}`);
  }
}

export function transitionTaskRecord(record, nextState, { now, evidence } = {}) {
  if (isForbiddenReportState(nextState) || isForbiddenReportState(record?.state)) {
    throw new RegistryError("REPORT_STATE_FORBIDDEN");
  }
  assertValidRecord(record);
  if (!evidence) throw new RegistryError("TRANSITION_EVIDENCE_REQUIRED");
  const evidenceErrors = validateTransitionEvidence(evidence);
  if (evidenceErrors.length > 0) {
    throw new RegistryError("INVALID_TRANSITION_EVIDENCE");
  }
  if (!hasValidIsoTimestamp(now)) throw new RegistryError("INVALID_TRANSITION_TIMESTAMP");
  if (Date.parse(now) < Date.parse(record.updatedAt)) {
    throw new RegistryError("TRANSITION_TIMESTAMP_REGRESSION");
  }
  if (!isValidTransition(record.state, nextState)) {
    throw new RegistryError("INVALID_TRANSITION");
  }

  const nextRecord = {
    ...record,
    state: nextState,
    cleanupAuthorized: false,
    revision: record.revision + 1,
    updatedAt: now,
    lastTransition: {
      from: record.state,
      to: nextState,
      evidence: structuredClone(evidence),
    },
  };
  assertValidRecord(nextRecord);
  return nextRecord;
}

function pathTools(platform) {
  return platform === "win32" ? path.win32 : path.posix;
}

function normalizedPath(value, platform = process.platform) {
  const tools = pathTools(platform);
  const resolved = tools.resolve(value);
  const trimmed = resolved.length > tools.parse(resolved).root.length
    ? resolved.replace(/[\\/]+$/, "")
    : resolved;
  return platform === "win32" ? trimmed.toLowerCase() : trimmed;
}

function pathContains(parent, child, platform = process.platform) {
  const tools = pathTools(platform);
  const normalizedParent = normalizedPath(parent, platform);
  const normalizedChild = normalizedPath(child, platform);
  const relative = tools.relative(normalizedParent, normalizedChild);
  return relative === "" || (!relative.startsWith("..") && !tools.isAbsolute(relative));
}

export function pathsOverlap(first, second, { platform = process.platform } = {}) {
  return pathContains(first, second, platform) || pathContains(second, first, platform);
}

function samePath(first, second, platform = process.platform) {
  return normalizedPath(first, platform) === normalizedPath(second, platform);
}

function realpathIfExists(value) {
  return existsSync(value) ? realpathSync.native(value) : canonicalPlannedPath(value);
}

function canonicalPlannedPath(value) {
  // Canonicalize the deepest existing ancestor (including Windows 8.3 aliases)
  // while keeping only the not-yet-created suffix as a lexical path plan.
  const resolved = path.resolve(value);
  let existingAncestor = resolved;
  const missingSegments = [];

  while (!existsSync(existingAncestor)) {
    const parent = path.dirname(existingAncestor);
    if (parent === existingAncestor) break;
    missingSegments.unshift(path.basename(existingAncestor));
    existingAncestor = parent;
  }

  const canonicalAncestor = realpathSync.native(existingAncestor);
  return path.join(canonicalAncestor, ...missingSegments);
}

function assertNoSymlinkAt(value, expectedPath) {
  if (!existsSync(value)) return;
  const stats = lstatSync(value);
  if (stats.isSymbolicLink()) throw new RegistryError("REGISTRY_PATH_ESCAPE");
  const canonical = realpathSync.native(value);
  if (!samePath(canonical, expectedPath)) {
    throw new RegistryError("REGISTRY_PATH_ESCAPE");
  }
}

function createCapability({
  kind,
  registryRoot,
  repoId,
  protectedPaths = [],
  gitCommonDir = null,
  worktreePaths = [],
}) {
  if (!isValidIdentifier(repoId)) throw new RegistryError("INVALID_IDENTIFIER");
  const plannedRoot = canonicalPlannedPath(registryRoot);
  const plannedRecordDir = path.join(plannedRoot, repoId);
  for (const protectedPath of protectedPaths) {
    const canonicalProtected = realpathIfExists(protectedPath);
    if (pathsOverlap(plannedRecordDir, canonicalProtected)) {
      throw new RegistryError("REGISTRY_PROTECTED_PATH_OVERLAP");
    }
  }
  if (!existsSync(plannedRoot)) mkdirSync(plannedRoot, { recursive: true });
  assertNoSymlinkAt(plannedRoot, plannedRoot);
  const canonicalRoot = realpathSync.native(plannedRoot);
  const recordDir = path.join(canonicalRoot, repoId);

  if (existsSync(recordDir)) assertNoSymlinkAt(recordDir, recordDir);
  for (const protectedPath of protectedPaths) {
    const canonicalProtected = realpathIfExists(protectedPath);
    if (pathsOverlap(recordDir, canonicalProtected)) {
      throw new RegistryError("REGISTRY_PROTECTED_PATH_OVERLAP");
    }
  }

  return Object.freeze({
    [CAPABILITY_BRAND]: true,
    kind,
    registryRoot: canonicalRoot,
    recordDir,
    repoId,
    protectedPaths: Object.freeze([...protectedPaths]),
    gitCommonDir,
    worktreePaths: Object.freeze([...worktreePaths]),
  });
}

function canonicalExistingDirectory(value, code) {
  if (typeof value !== "string" || !path.isAbsolute(value) || !existsSync(value)) {
    throw new RegistryError(code);
  }
  const stats = lstatSync(value);
  if (!stats.isDirectory() || stats.isSymbolicLink()) throw new RegistryError(code);
  return realpathSync.native(value);
}

function isPlainOptionsObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function createProductionRegistryCapability(options) {
  const allowedOptions = new Set(["repoId", "gitCommonDir", "worktreePaths"]);
  if (
    !isPlainOptionsObject(options) ||
    Object.keys(options).some((key) => !allowedOptions.has(key))
  ) {
    throw new RegistryError("UNKNOWN_CAPABILITY_OPTION");
  }
  const { repoId, gitCommonDir, worktreePaths } = options;
  const codexHome = process.env.CODEX_HOME;
  if (typeof codexHome !== "string" || codexHome.length === 0) {
    throw new RegistryError("CODEX_HOME_REQUIRED");
  }
  if (!Array.isArray(worktreePaths) || worktreePaths.length === 0) {
    throw new RegistryError("PROTECTED_WORKTREES_REQUIRED");
  }
  const canonicalCodexHome = canonicalExistingDirectory(
    codexHome,
    "CODEX_HOME_INVALID",
  );
  const canonicalGitCommonDir = canonicalExistingDirectory(
    gitCommonDir,
    "GIT_COMMON_DIR_REQUIRED",
  );
  const canonicalWorktreePaths = worktreePaths.map((worktreePath) =>
    canonicalExistingDirectory(worktreePath, "PROTECTED_WORKTREE_INVALID"),
  );
  const registryRoot = path.join(canonicalCodexHome, "worktree-lifecycle");
  if (existsSync(registryRoot)) {
    assertNoSymlinkAt(registryRoot, registryRoot);
  }
  const capability = createCapability({
    kind: "production",
    registryRoot,
    repoId,
    protectedPaths: [canonicalGitCommonDir, ...canonicalWorktreePaths],
    gitCommonDir: canonicalGitCommonDir,
    worktreePaths: canonicalWorktreePaths,
  });
  if (!samePath(capability.registryRoot, registryRoot)) {
    throw new RegistryError("REGISTRY_PATH_ESCAPE");
  }
  return capability;
}

export function createTestRegistryCapability({ registryRoot, repoId, protectedPaths = [] }) {
  const plannedRoot = canonicalPlannedPath(registryRoot);
  const canonicalTemp = realpathSync.native(tmpdir());
  if (!pathContains(canonicalTemp, plannedRoot)) {
    throw new RegistryError("TEST_REGISTRY_ROOT_REQUIRED");
  }
  return createCapability({
    kind: "test",
    registryRoot: plannedRoot,
    repoId,
    protectedPaths,
  });
}

function assertCapability(capability) {
  if (!capability?.[CAPABILITY_BRAND]) throw new RegistryError("REGISTRY_CAPABILITY_REQUIRED");
  assertNoSymlinkAt(capability.registryRoot, capability.registryRoot);
  if (!pathContains(capability.registryRoot, capability.recordDir)) {
    throw new RegistryError("REGISTRY_PATH_ESCAPE");
  }
  if (existsSync(capability.recordDir)) {
    assertNoSymlinkAt(capability.recordDir, capability.recordDir);
  }
}

function assertRecordOutsideProtectedPaths(record, capability) {
  if (record.repoId !== capability.repoId) throw new RegistryError("REGISTRY_REPO_MISMATCH");
  if (capability.kind === "production") {
    let recordGitCommonDir;
    let recordWorktreePath;
    try {
      recordGitCommonDir = canonicalExistingDirectory(
        record.gitCommonDir,
        "REGISTRY_GIT_COMMON_DIR_MISMATCH",
      );
      recordWorktreePath = canonicalExistingDirectory(
        record.worktreePath,
        "REGISTRY_WORKTREE_MISMATCH",
      );
    } catch (error) {
      if (error instanceof RegistryError) throw error;
      throw new RegistryError("REGISTRY_PROTECTED_PATH_INVALID");
    }
    if (!samePath(recordGitCommonDir, capability.gitCommonDir)) {
      throw new RegistryError("REGISTRY_GIT_COMMON_DIR_MISMATCH");
    }
    if (
      !capability.worktreePaths.some((worktreePath) =>
        samePath(recordWorktreePath, worktreePath),
      )
    ) {
      throw new RegistryError("REGISTRY_WORKTREE_MISMATCH");
    }
  }
  const protectedPaths = [
    record.gitCommonDir,
    record.worktreePath,
    ...capability.protectedPaths,
  ];
  for (const protectedPath of protectedPaths) {
    if (pathsOverlap(capability.recordDir, realpathIfExists(protectedPath))) {
      throw new RegistryError("REGISTRY_PROTECTED_PATH_OVERLAP");
    }
  }
}

async function readExistingRecord(recordPath, expectedRepoId, expectedTaskId) {
  let fileStats;
  try {
    fileStats = await stat(recordPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  if (!fileStats.isFile() || fileStats.size > MAX_RECORD_BYTES) {
    throw new RegistryError("CORRUPT_EXISTING_RECORD");
  }
  let parsed;
  try {
    parsed = JSON.parse(await readFile(recordPath, "utf8"));
  } catch {
    throw new RegistryError("CORRUPT_EXISTING_RECORD");
  }
  const errors = validateTaskRecord(parsed);
  if (
    errors.length > 0 ||
    parsed.repoId !== expectedRepoId ||
    parsed.taskId !== expectedTaskId
  ) {
    throw new RegistryError("CORRUPT_EXISTING_RECORD");
  }
  return parsed;
}

async function safeUnlink(filePath) {
  if (!filePath) return;
  try {
    await unlink(filePath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function releaseOwnedLock(lockPath, ownerToken, acquiredStats) {
  try {
    const currentStats = await lstat(lockPath);
    if (
      !currentStats.isFile() ||
      currentStats.dev !== acquiredStats.dev ||
      currentStats.ino !== acquiredStats.ino ||
      currentStats.size > 256
    ) {
      return false;
    }
    const currentOwner = await readFile(lockPath, "utf8");
    if (currentOwner !== `${ownerToken}\n`) return false;
    await unlink(lockPath);
    return true;
  } catch (error) {
    return error?.code === "ENOENT";
  }
}

export async function writeTaskRecordAtomic(
  record,
  { capability, expectedRevision, testHooks } = {},
) {
  assertCapability(capability);
  assertValidRecord(record);
  assertRecordOutsideProtectedPaths(record, capability);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    throw new RegistryError("EXPECTED_REVISION_REQUIRED");
  }
  if (testHooks && capability.kind !== "test") {
    throw new RegistryError("TEST_HOOKS_FORBIDDEN");
  }

  const recordPath = path.join(capability.recordDir, `${record.taskId}.json`);
  const lockPath = path.join(capability.recordDir, `${record.taskId}.write.lock`);
  const tempPath = path.join(
    capability.recordDir,
    `${record.taskId}.${process.pid}.${randomUUID()}.json.tmp`,
  );
  let lockHandle;
  let lockOwnerToken;
  let lockStats;
  let tempHandle;

  try {
    if (!existsSync(capability.recordDir)) {
      if (testHooks?.beforeRecordDirCreate) await testHooks.beforeRecordDirCreate();
      try {
        mkdirSync(capability.recordDir, { recursive: false });
      } catch (error) {
        if (error?.code !== "EEXIST") throw error;
      }
    }
    assertCapability(capability);

    try {
      lockHandle = await open(lockPath, "wx");
    } catch (error) {
      if (error?.code === "EEXIST") throw new RegistryError("REGISTRY_WRITE_CONFLICT");
      throw error;
    }
    lockOwnerToken = randomUUID();
    await lockHandle.writeFile(`${lockOwnerToken}\n`, "utf8");
    await lockHandle.sync();
    lockStats = await lockHandle.stat();

    const existing = await readExistingRecord(recordPath, record.repoId, record.taskId);
    const currentRevision = existing?.revision ?? 0;
    if (currentRevision !== expectedRevision || record.revision !== expectedRevision + 1) {
      throw new RegistryError("REGISTRY_REVISION_CONFLICT");
    }

    tempHandle = await open(tempPath, "wx", 0o600);
    if (testHooks?.failAt === "write") throw new Error("injected write failure");
    await tempHandle.writeFile(`${JSON.stringify(record, null, 2)}\n`, "utf8");
    if (testHooks?.failAt === "fsync") throw new Error("injected fsync failure");
    await tempHandle.sync();
    await tempHandle.close();
    tempHandle = null;

    if (testHooks?.beforeRename) await testHooks.beforeRename();
    if (testHooks?.failAt === "rename") throw new Error("injected rename failure");
    await rename(tempPath, recordPath);
    return { recordPath, revision: record.revision };
  } catch (error) {
    if (error instanceof RegistryError) throw error;
    throw new RegistryError("REGISTRY_ATOMIC_WRITE_FAILED");
  } finally {
    if (tempHandle) {
      try {
        await tempHandle.close();
      } catch {
        // The final error is intentionally code-only and never includes record content.
      }
    }
    try {
      await safeUnlink(tempPath);
    } catch {
      // A cleanup failure must not replace the primary code-only error.
    }
    if (lockHandle) {
      try {
        await lockHandle.close();
      } catch {
        // The lock file is removed below when possible.
      }
      try {
        if (testHooks?.beforeLockRelease) await testHooks.beforeLockRelease();
        await releaseOwnedLock(lockPath, lockOwnerToken, lockStats);
      } catch {
        // A stale write lock remains fail-closed for the next caller.
      }
    }
  }
}

export async function readTaskRecords(capability, { testHooks } = {}) {
  assertCapability(capability);
  if (testHooks && capability.kind !== "test") {
    throw new RegistryError("TEST_HOOKS_FORBIDDEN");
  }
  if (!existsSync(capability.recordDir)) return [];
  const entries = await readdir(capability.recordDir, { withFileTypes: true });
  if (testHooks?.afterReadDirectory) await testHooks.afterReadDirectory();
  assertCapability(capability);
  const records = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const filePath = path.join(capability.recordDir, entry.name);
    let record;
    try {
      record = await readExistingRecord(
        filePath,
        capability.repoId,
        entry.name.slice(0, -".json".length),
      );
    } catch {
      throw new RegistryError("CORRUPT_REGISTRY_RECORD");
    }
    if (record !== null) records.push(record);
  }
  return records;
}
