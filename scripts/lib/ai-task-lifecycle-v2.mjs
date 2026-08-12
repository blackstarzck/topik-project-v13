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
const GITHUB_LOGIN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/u;
const UUID_VALUE_PATTERN_SOURCE = String.raw`[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}`;
const OPAQUE_ID_PATTERN_SOURCE = String.raw`[A-Za-z0-9._:-]{16,}`;
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
const SENSITIVE_CONTEXT_VALUE_PATTERNS = Object.freeze([
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/u,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/u,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/u,
  /\bAKIA[A-Z0-9]{16}\b/u,
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/u,
  /\bBearer[ \t]+[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?![A-Za-z0-9_-])/iu,
  /\bAuthorization[ \t]*:[ \t]*Bearer[ \t]+(?=[A-Za-z0-9._~+/=-]{24,}(?![A-Za-z0-9._~+/=-]))(?=[A-Za-z0-9._~+/=-]*[0-9._~+/=-])[A-Za-z0-9._~+/=-]{24,}/iu,
  new RegExp(
    String.raw`\b(?:thread|session|conversation)[ _-]?id[ \t]*[:=][ \t]*(?:${UUID_VALUE_PATTERN_SOURCE}|${OPAQUE_ID_PATTERN_SOURCE})(?![A-Za-z0-9._:-])`,
    "iu",
  ),
  new RegExp(
    String.raw`/threads/(?:${UUID_VALUE_PATTERN_SOURCE}|${OPAQUE_ID_PATTERN_SOURCE})(?![A-Za-z0-9._:-])`,
    "iu",
  ),
]);
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
  "candidateProgress",
  "currentClaim",
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
const HANDOFF_CONTEXT_V1_KEYS = new Set([
  "schemaVersion", "recordType", "taskId", "branch", "snapshotId", "revision",
  "fromActor", "toActor", "objective", "completed", "decisions", "remaining",
  "verification", "blockers", "nextAction", "fingerprint", "createdAt",
]);
const START_RECOVERY_V1_KEYS = new Set([
  "schemaVersion", "recordType", "taskId", "branch", "baseSha", "actor",
  "worktreePath", "phase", "blocker", "fingerprint", "createdAt", "updatedAt",
]);
const NEXT_ACTION_KEYS = new Set([
  "owner", "reason", "command", "approvalRequired", "retrySafe",
]);
const FINISH_REPORT_V1_KEYS = new Set([
  "schemaVersion", "recordType", "taskId", "branch", "actor", "worktreePath",
  "headSha", "dirty", "upstream", "ahead", "behind", "published",
  "lastOwnerAuth", "blockers", "nextAction", "fingerprint", "createdAt",
]);
const OWNER_AUTH_RESULT_V1_KEYS = new Set([
  "schemaVersion", "recordType", "status", "host", "owner", "currentLogin",
  "switchAttempted", "publishApprovalUsed", "manualApprovalRequired", "checkedAt",
  "fingerprint",
]);
const HANDOFF_CONTEXT_INPUT_KEYS = new Set([
  "objective", "completed", "decisions", "remaining", "verification", "blockers", "nextAction",
]);
const MAX_TEXT_LENGTH = 4_096;
const MAX_ARRAY_ITEMS = 64;
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

function quotePowerShellArgument(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function requireField(condition, errors, code, field) {
  if (!condition) errors.push(validationError(code, field));
}

function validText(value, { allowEmpty = false } = {}) {
  return typeof value === "string" && value.length <= MAX_TEXT_LENGTH && (allowEmpty || value.trim().length > 0);
}

function validTextArray(value) {
  return Array.isArray(value) && value.length <= MAX_ARRAY_ITEMS && value.every((entry) => validText(entry));
}

function containsSensitiveContextValue(value) {
  return typeof value === "string" && SENSITIVE_CONTEXT_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function validateContextText(value, errors, field) {
  requireField(validText(value), errors, "INVALID_TEXT", field);
  if (validText(value) && containsSensitiveContextValue(value)) {
    errors.push(validationError("SECRET_OR_THREAD_VALUE", field));
  }
}

function validateContextTextArray(value, errors, field) {
  requireField(validTextArray(value), errors, "INVALID_TEXT_ARRAY", field);
  if (!Array.isArray(value)) return;
  value.forEach((entry, index) => {
    if (validText(entry) && containsSensitiveContextValue(entry)) {
      errors.push(validationError("SECRET_OR_THREAD_VALUE", `${field}.${index}`));
    }
  });
}

function validateNextAction(value, errors, field = "nextAction") {
  const nested = validateClosedObject(value, NEXT_ACTION_KEYS);
  for (const error of nested) errors.push({ ...error, path: `${field}.${error.path}` });
  if (!isPlainObject(value)) return;
  requireField(validActor(value.owner), errors, "INVALID_ACTOR", `${field}.owner`);
  requireField(validText(value.reason), errors, "INVALID_TEXT", `${field}.reason`);
  requireField(validText(value.command), errors, "INVALID_TEXT", `${field}.command`);
  requireField(typeof value.approvalRequired === "boolean", errors, "INVALID_BOOLEAN", `${field}.approvalRequired`);
  requireField(typeof value.retrySafe === "boolean", errors, "INVALID_BOOLEAN", `${field}.retrySafe`);
}

function validateHandoffContextInput(value) {
  const errors = validateClosedObject(value, HANDOFF_CONTEXT_INPUT_KEYS);
  if (!isPlainObject(value)) return errors;
  validateContextText(value.objective, errors, "objective");
  for (const field of ["completed", "decisions", "remaining", "verification", "blockers"]) {
    validateContextTextArray(value[field], errors, field);
  }
  validateContextText(value.nextAction, errors, "nextAction");
  return errors;
}

export function validateHandoffContextV1(record) {
  const errors = validateClosedObject(record, HANDOFF_CONTEXT_V1_KEYS);
  if (!isPlainObject(record)) return errors;
  requireField(record.schemaVersion === 1, errors, "INVALID_SCHEMA_VERSION", "schemaVersion");
  requireField(record.recordType === "HandoffContextV1", errors, "INVALID_RECORD_TYPE", "recordType");
  requireField(validTaskId(record.taskId), errors, "INVALID_TASK_ID", "taskId");
  let parsed = null;
  try { parsed = parseTaskBranch(record.branch); } catch { errors.push(validationError("INVALID_TASK_BRANCH", "branch")); }
  if (parsed) requireField(record.taskId === `${parsed.type}-${parsed.slug}`, errors, "TASK_ID_MISMATCH", "taskId");
  requireField(validTaskId(record.snapshotId), errors, "INVALID_SNAPSHOT_ID", "snapshotId");
  requireField(Number.isInteger(record.revision) && record.revision >= 2, errors, "INVALID_REVISION", "revision");
  if (validTaskId(record.taskId) && Number.isInteger(record.revision)) {
    requireField(record.snapshotId === `${record.taskId}-handoff-${record.revision}`, errors, "SNAPSHOT_ID_MISMATCH", "snapshotId");
  }
  requireField(validActor(record.fromActor), errors, "INVALID_ACTOR", "fromActor");
  requireField(validActor(record.toActor), errors, "INVALID_ACTOR", "toActor");
  requireField(record.fromActor !== record.toActor, errors, "SAME_HANDOFF_ACTOR", "toActor");
  validateContextText(record.objective, errors, "objective");
  for (const field of ["completed", "decisions", "remaining", "verification", "blockers"]) {
    validateContextTextArray(record[field], errors, field);
  }
  validateContextText(record.nextAction, errors, "nextAction");
  requireField(FINGERPRINT_PATTERN.test(record.fingerprint ?? ""), errors, "INVALID_FINGERPRINT", "fingerprint");
  requireField(validTimestamp(record.createdAt), errors, "INVALID_TIMESTAMP", "createdAt");
  return errors;
}

export function validateStartRecoveryV1(record) {
  const errors = validateClosedObject(record, START_RECOVERY_V1_KEYS);
  if (!isPlainObject(record)) return errors;
  requireField(record.schemaVersion === 1, errors, "INVALID_SCHEMA_VERSION", "schemaVersion");
  requireField(record.recordType === "StartRecoveryV1", errors, "INVALID_RECORD_TYPE", "recordType");
  requireField(validTaskId(record.taskId), errors, "INVALID_TASK_ID", "taskId");
  let parsed = null;
  try { parsed = parseTaskBranch(record.branch); } catch { errors.push(validationError("INVALID_TASK_BRANCH", "branch")); }
  if (parsed) requireField(record.taskId === `${parsed.type}-${parsed.slug}`, errors, "TASK_ID_MISMATCH", "taskId");
  requireField(SHA_PATTERN.test(record.baseSha ?? ""), errors, "INVALID_SHA", "baseSha");
  requireField(validActor(record.actor), errors, "INVALID_ACTOR", "actor");
  requireField(validAbsolutePath(record.worktreePath), errors, "INVALID_PATH", "worktreePath");
  requireField(["PREPARED", "WORKTREE_CREATED", "BLOCKED", "COMPLETED"].includes(record.phase), errors, "INVALID_RECOVERY_PHASE", "phase");
  requireField(record.blocker === null || validText(record.blocker), errors, "INVALID_TEXT", "blocker");
  requireField(FINGERPRINT_PATTERN.test(record.fingerprint ?? ""), errors, "INVALID_FINGERPRINT", "fingerprint");
  requireField(validTimestamp(record.createdAt), errors, "INVALID_TIMESTAMP", "createdAt");
  requireField(validTimestamp(record.updatedAt), errors, "INVALID_TIMESTAMP", "updatedAt");
  if (validTimestamp(record.createdAt) && validTimestamp(record.updatedAt)) {
    requireField(Date.parse(record.updatedAt) >= Date.parse(record.createdAt), errors, "TIMESTAMP_REGRESSION", "updatedAt");
  }
  return errors;
}

export function validateFinishReportV1(record) {
  const errors = validateClosedObject(record, FINISH_REPORT_V1_KEYS);
  if (!isPlainObject(record)) return errors;
  requireField(record.schemaVersion === 1, errors, "INVALID_SCHEMA_VERSION", "schemaVersion");
  requireField(record.recordType === "FinishReportV1", errors, "INVALID_RECORD_TYPE", "recordType");
  requireField(validTaskId(record.taskId), errors, "INVALID_TASK_ID", "taskId");
  let parsed = null;
  try { parsed = parseTaskBranch(record.branch); } catch { errors.push(validationError("INVALID_TASK_BRANCH", "branch")); }
  if (parsed) requireField(record.taskId === `${parsed.type}-${parsed.slug}`, errors, "TASK_ID_MISMATCH", "taskId");
  requireField(validActor(record.actor), errors, "INVALID_ACTOR", "actor");
  requireField(validAbsolutePath(record.worktreePath), errors, "INVALID_PATH", "worktreePath");
  requireField(SHA_PATTERN.test(record.headSha ?? ""), errors, "INVALID_SHA", "headSha");
  requireField(typeof record.dirty === "boolean", errors, "INVALID_BOOLEAN", "dirty");
  requireField(record.upstream === null || validText(record.upstream), errors, "INVALID_TEXT", "upstream");
  requireField(Number.isInteger(record.ahead) && record.ahead >= 0, errors, "INVALID_COUNT", "ahead");
  requireField(Number.isInteger(record.behind) && record.behind >= 0, errors, "INVALID_COUNT", "behind");
  requireField(typeof record.published === "boolean", errors, "INVALID_BOOLEAN", "published");
  requireField(record.lastOwnerAuth === null || validateOwnerAuthResultV1(record.lastOwnerAuth).length === 0, errors, "INVALID_OWNER_AUTH", "lastOwnerAuth");
  requireField(validTextArray(record.blockers), errors, "INVALID_TEXT_ARRAY", "blockers");
  validateNextAction(record.nextAction, errors);
  requireField(FINGERPRINT_PATTERN.test(record.fingerprint ?? ""), errors, "INVALID_FINGERPRINT", "fingerprint");
  requireField(validTimestamp(record.createdAt), errors, "INVALID_TIMESTAMP", "createdAt");
  return errors;
}

export function validateOwnerAuthResultV1(record) {
  const errors = validateClosedObject(record, OWNER_AUTH_RESULT_V1_KEYS);
  if (!isPlainObject(record)) return errors;
  requireField(record.schemaVersion === 1, errors, "INVALID_SCHEMA_VERSION", "schemaVersion");
  requireField(record.recordType === "OwnerAuthResultV1", errors, "INVALID_RECORD_TYPE", "recordType");
  requireField(["OWNER_AUTHENTICATED", "SWITCH_REQUIRED"].includes(record.status), errors, "INVALID_STATUS", "status");
  requireField(record.host === "github.com", errors, "INVALID_HOST", "host");
  requireField(GITHUB_LOGIN_PATTERN.test(record.owner ?? ""), errors, "INVALID_OWNER", "owner");
  requireField(GITHUB_LOGIN_PATTERN.test(record.currentLogin ?? ""), errors, "INVALID_LOGIN", "currentLogin");
  requireField(typeof record.switchAttempted === "boolean", errors, "INVALID_BOOLEAN", "switchAttempted");
  requireField(typeof record.publishApprovalUsed === "boolean", errors, "INVALID_BOOLEAN", "publishApprovalUsed");
  requireField(typeof record.manualApprovalRequired === "boolean", errors, "INVALID_BOOLEAN", "manualApprovalRequired");
  if (record.status === "SWITCH_REQUIRED") {
    requireField(
      record.manualApprovalRequired === true &&
        record.switchAttempted === false &&
        record.publishApprovalUsed === false &&
        typeof record.currentLogin === "string" &&
        typeof record.owner === "string" &&
        record.currentLogin.toLowerCase() !== record.owner.toLowerCase(),
      errors,
      "OWNER_AUTH_STATE_MISMATCH",
      "status",
    );
  }
  if (record.status === "OWNER_AUTHENTICATED") {
    requireField(
      record.manualApprovalRequired === false &&
        typeof record.currentLogin === "string" &&
        typeof record.owner === "string" &&
        record.currentLogin.toLowerCase() === record.owner.toLowerCase() &&
        (record.switchAttempted === false || record.publishApprovalUsed === true),
      errors,
      "OWNER_AUTH_STATE_MISMATCH",
      "status",
    );
  }
  requireField(validTimestamp(record.checkedAt), errors, "INVALID_TIMESTAMP", "checkedAt");
  requireField(FINGERPRINT_PATTERN.test(record.fingerprint ?? ""), errors, "INVALID_FINGERPRINT", "fingerprint");
  return errors;
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
    for (const field of ["completedSteps", "branch", "worktreePath", "headSha", "inventoryDigest", "disposableCandidates", "candidateProgress", "currentClaim", "updatedAt", "cleanedAt", "taskRevision", "taskState", "runtimeDigest", "prNumber", "prState", "prBaseRefName", "prHeadRefName", "mergeCommitOid", "mergedAt", "originMainSha", "remoteState"]) {
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
    if (Object.hasOwn(record, "candidateProgress")) {
      const approvedPaths = Array.isArray(record.disposableCandidates)
        ? record.disposableCandidates.map((candidate) => candidate?.path)
        : [];
      const validCandidateProgress = Array.isArray(record.candidateProgress) &&
        record.candidateProgress.length <= approvedPaths.length &&
        record.candidateProgress.every((candidatePath, index) =>
          validAbsolutePath(candidatePath) && candidatePath === approvedPaths[index]) &&
        new Set(record.candidateProgress).size === record.candidateProgress.length;
      requireField(validCandidateProgress, errors, "INVALID_CANDIDATE_PROGRESS", "candidateProgress");
      if (validSteps && record.completedSteps.includes("TASK_ARTIFACTS_REMOVED")) {
        requireField(
          validCandidateProgress && record.candidateProgress.length === approvedPaths.length,
          errors,
          "INCOMPLETE_CANDIDATE_PROGRESS",
          "candidateProgress",
        );
      }
    }
    if (Object.hasOwn(record, "currentClaim")) {
      const claim = record.currentClaim;
      const progressLength = Array.isArray(record.candidateProgress) ? record.candidateProgress.length : -1;
      const expectedCandidate = Array.isArray(record.disposableCandidates)
        ? record.disposableCandidates[progressLength]
        : undefined;
      const validClaim = isPlainObject(claim) &&
        Object.keys(claim).length === 3 &&
        Object.keys(claim).every((key) => ["source", "quarantine", "digest"].includes(key)) &&
        validAbsolutePath(claim.source) && validAbsolutePath(claim.quarantine) &&
        claim.source !== claim.quarantine && FINGERPRINT_PATTERN.test(claim.digest ?? "") &&
        expectedCandidate?.path === claim.source && expectedCandidate?.digest === claim.digest;
      requireField(validClaim, errors, "INVALID_CURRENT_CLAIM", "currentClaim");
      requireField(
        validSteps && !record.completedSteps.includes("TASK_ARTIFACTS_REMOVED") && record.status === "CLEANING",
        errors,
        "CURRENT_CLAIM_NOT_ALLOWED",
        "currentClaim",
      );
    }
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
      if (Object.hasOwn(record, "candidateProgress")) {
        requireField(
          Array.isArray(record.candidateProgress) &&
            Array.isArray(record.disposableCandidates) &&
            record.candidateProgress.length === record.disposableCandidates.length,
          errors,
          "INCOMPLETE_CANDIDATE_PROGRESS",
          "candidateProgress",
        );
      }
    } else {
      requireField(record.cleanedAt === null, errors, "CLEANED_AT_FORBIDDEN", "cleanedAt");
    }
  }
  return errors;
}

function runGit(
  repoPath,
  args,
  { code = "GIT_COMMAND_FAILED", allowFailure = false, raw = false, timeout = undefined } = {},
) {
  const result = spawnSync("git", ["-C", repoPath, ...args], {
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    shell: false,
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
    ...(timeout === undefined ? {} : { timeout }),
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
    handoffContexts: path.join(root, "handoff-contexts"),
    startRecoveries: path.join(root, "start-recoveries"),
    finishReports: path.join(root, "finish-reports"),
    ownerAuth: path.join(root, "owner-auth"),
    cleanups: path.join(root, "cleanups"),
    taskId,
    taskFile: path.join(root, "tasks", `${taskId}.json`),
    lockFile: path.join(root, "tasks", `${taskId}.lock`),
    cleanupFile: path.join(root, "cleanups", `${taskId}.json`),
    startRecoveryFile: path.join(root, "start-recoveries", `${taskId}.json`),
    finishReportFile: path.join(root, "finish-reports", `${taskId}.json`),
    ownerAuthFile: path.join(root, "owner-auth", `${taskId}.json`),
  };
}

function assertRegistryDirectory(value, commonDir) {
  assertSafePathPlan(commonDir, value, "REGISTRY_PATH_ESCAPE");
  if (existsSync(value) && !lstatSync(value).isDirectory()) fail("REGISTRY_PATH_ESCAPE");
}

function prepareRegistry(commonDir, branch) {
  const paths = registryPaths(commonDir, branch);
  for (const value of [
    paths.lifecycleRoot,
    paths.root,
    paths.tasks,
    paths.handoffs,
    paths.handoffContexts,
    paths.startRecoveries,
    paths.finishReports,
    paths.ownerAuth,
  ]) {
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
  for (const value of [paths.lifecycleRoot, paths.root, paths.tasks, paths.handoffs, paths.handoffContexts]) {
    assertRegistryDirectory(value, commonDir);
  }
  return { paths, task: readJson(paths.taskFile, validateTaskRecordV2, "TASK_NOT_FOUND") };
}

function handoffContextFingerprint(record) {
  const payload = Object.fromEntries(Object.entries(record).filter(([key]) => key !== "fingerprint"));
  return hash(JSON.stringify(payload));
}

function sidecarFingerprint(record) {
  const payload = Object.fromEntries(Object.entries(record).filter(([key]) => key !== "fingerprint"));
  return hash(JSON.stringify(payload));
}

function writeStartRecovery(paths, record) {
  const next = { ...record, fingerprint: "" };
  next.fingerprint = sidecarFingerprint(next);
  if (validateStartRecoveryV1(next).length > 0) fail("START_RECOVERY_INVALID");
  atomicWriteJson(paths.startRecoveryFile, next);
  return next;
}

function readStartRecovery(paths, { optional = false } = {}) {
  if (optional && !existsSync(paths.startRecoveryFile)) return null;
  const record = readJson(paths.startRecoveryFile, validateStartRecoveryV1, "START_RECOVERY_NOT_FOUND");
  if (sidecarFingerprint(record) !== record.fingerprint) fail("START_RECOVERY_FINGERPRINT_MISMATCH");
  return record;
}

function readFingerprintedSidecar(filePath, validator, missingCode, mismatchCode, { optional = false } = {}) {
  if (optional && !existsSync(filePath)) return null;
  const record = readJson(filePath, validator, missingCode);
  if (sidecarFingerprint(record) !== record.fingerprint) fail(mismatchCode);
  return record;
}

export function writeFinishReportSidecar({ repoPath, branch, report }) {
  const context = gitContext(repoPath);
  const paths = prepareRegistry(context.commonDir, branch);
  const { task } = readTask(context.commonDir, branch);
  if (report.taskId !== task.taskId || report.branch !== task.branch || report.worktreePath !== task.worktreePath) {
    fail("FINISH_REPORT_TASK_MISMATCH");
  }
  if (validateFinishReportV1(report).length > 0 || sidecarFingerprint(report) !== report.fingerprint) {
    fail("FINISH_REPORT_INVALID");
  }
  return withTaskOperationLock(paths, () => {
    const currentTask = readTask(context.commonDir, branch).task;
    const previous = readFingerprintedSidecar(
      paths.finishReportFile,
      validateFinishReportV1,
      "FINISH_REPORT_NOT_FOUND",
      "FINISH_REPORT_FINGERPRINT_MISMATCH",
      { optional: true },
    );
    if (
      Date.parse(report.createdAt) < Date.parse(currentTask.updatedAt) ||
      (previous !== null && Date.parse(report.createdAt) < Date.parse(previous.createdAt))
    ) fail("TIMESTAMP_REGRESSION");
    atomicWriteJson(paths.finishReportFile, report);
    return structuredClone(report);
  });
}

export function writeOwnerAuthResultSidecar({ repoPath, branch, result }) {
  const context = gitContext(repoPath);
  const paths = prepareRegistry(context.commonDir, branch);
  readTask(context.commonDir, branch);
  if (validateOwnerAuthResultV1(result).length > 0 || sidecarFingerprint(result) !== result.fingerprint) {
    fail("OWNER_AUTH_RESULT_INVALID");
  }
  return withTaskOperationLock(paths, () => {
    const currentTask = readTask(context.commonDir, branch).task;
    const previous = readFingerprintedSidecar(
      paths.ownerAuthFile,
      validateOwnerAuthResultV1,
      "OWNER_AUTH_RESULT_NOT_FOUND",
      "OWNER_AUTH_RESULT_FINGERPRINT_MISMATCH",
      { optional: true },
    );
    if (
      Date.parse(result.checkedAt) < Date.parse(currentTask.updatedAt) ||
      (previous !== null && Date.parse(result.checkedAt) < Date.parse(previous.checkedAt))
    ) fail("TIMESTAMP_REGRESSION");
    atomicWriteJson(paths.ownerAuthFile, result);
    return structuredClone(result);
  });
}

function buildHandoffContext({ task, snapshot, context }) {
  if (validateHandoffContextInput(context).length > 0) fail("HANDOFF_CONTEXT_INVALID");
  const record = {
    schemaVersion: 1,
    recordType: "HandoffContextV1",
    taskId: task.taskId,
    branch: task.branch,
    snapshotId: snapshot.snapshotId,
    revision: snapshot.revision,
    fromActor: snapshot.fromActor,
    toActor: snapshot.toActor,
    ...structuredClone(context),
    fingerprint: "",
    createdAt: snapshot.createdAt,
  };
  record.fingerprint = handoffContextFingerprint(record);
  if (validateHandoffContextV1(record).length > 0) fail("HANDOFF_CONTEXT_INVALID");
  return record;
}

function readHandoffContext(paths, snapshotId, { optional = false } = {}) {
  const filePath = path.join(paths.handoffContexts, `${snapshotId}.json`);
  if (optional && !existsSync(filePath)) return null;
  const context = readJson(filePath, validateHandoffContextV1, "HANDOFF_CONTEXT_NOT_FOUND");
  if (handoffContextFingerprint(context) !== context.fingerprint) {
    fail("HANDOFF_CONTEXT_FINGERPRINT_MISMATCH");
  }
  return context;
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

const START_RECOVERY_REMOTE_TIMEOUT_MS = 5_000;

function recoveryIssue(code, message) {
  return Object.freeze({ code, message });
}

function diagnoseStartRecoveryEligibility({ context, paths, recovery }) {
  const issues = [];
  const expectedPath = taskWorktreePath(context.topLevel, recovery.branch);
  if (
    recovery.taskId !== paths.taskId ||
    !samePath(recovery.worktreePath, expectedPath)
  ) {
    issues.push(recoveryIssue(
      "START_RECOVERY_OWNERSHIP_AMBIGUOUS",
      "중단 기록의 task 또는 작업 폴더가 현재 저장소 규칙과 일치하지 않습니다.",
    ));
  }

  const worktreeExists = existsSync(recovery.worktreePath);
  if (!worktreeExists) {
    issues.push(recoveryIssue(
      "START_RECOVERY_WORKTREE_MISSING",
      "중단 기록에 적힌 작업 폴더를 찾을 수 없습니다.",
    ));
  } else {
    try {
      assertSafePathPlan(context.topLevel, recovery.worktreePath, "WORKTREE_PATH_ESCAPE");
    } catch {
      issues.push(recoveryIssue(
        "START_RECOVERY_OWNERSHIP_AMBIGUOUS",
        "작업 폴더 경로에 symlink·junction 또는 저장소 밖 경로가 포함되어 소유권을 확정할 수 없습니다.",
      ));
    }
  }

  const inventoryResult = runGit(context.topLevel, ["worktree", "list", "--porcelain"], { allowFailure: true });
  if (inventoryResult.status !== 0) {
    issues.push(recoveryIssue(
      "START_RECOVERY_NATIVE_EVIDENCE_UNAVAILABLE",
      "Git native worktree 소유권 목록을 읽을 수 없습니다.",
    ));
  } else {
    const inventory = parseWorktrees(inventoryResult.stdout);
    const pathOwners = inventory.filter((entry) => samePath(entry.path, recovery.worktreePath));
    const branchOwners = inventory.filter((entry) => entry.branch === recovery.branch);
    const exactOwners = inventory.filter(
      (entry) => samePath(entry.path, recovery.worktreePath) && entry.branch === recovery.branch,
    );
    if (exactOwners.length !== 1) {
      if (pathOwners.length === 0 && branchOwners.length === 0) {
        issues.push(recoveryIssue(
          "START_RECOVERY_NATIVE_OWNERSHIP_MISSING",
          "작업 폴더와 branch를 소유한 Git native worktree 기록이 없습니다.",
        ));
      } else {
        issues.push(recoveryIssue(
          "START_RECOVERY_NATIVE_OWNERSHIP_AMBIGUOUS",
          "Git native worktree의 경로와 branch 소유권이 서로 일치하지 않습니다.",
        ));
      }
    }
  }

  if (worktreeExists) {
    const branchResult = runGit(recovery.worktreePath, ["symbolic-ref", "--quiet", "--short", "HEAD"], {
      allowFailure: true,
    });
    if (branchResult.status !== 0) {
      issues.push(recoveryIssue(
        "START_RECOVERY_WORKTREE_DETACHED",
        "작업 폴더가 branch에 연결되지 않은 detached HEAD 상태입니다.",
      ));
    } else if (branchResult.stdout !== recovery.branch) {
      issues.push(recoveryIssue(
        "START_RECOVERY_WRONG_BRANCH",
        `작업 폴더가 예상 branch ${recovery.branch}가 아닌 ${branchResult.stdout}에 연결되어 있습니다.`,
      ));
    }

    const headResult = runGit(recovery.worktreePath, ["rev-parse", "HEAD"], { allowFailure: true });
    if (headResult.status !== 0) {
      issues.push(recoveryIssue(
        "START_RECOVERY_HEAD_UNAVAILABLE",
        "작업 폴더의 HEAD를 확인할 수 없습니다.",
      ));
    } else if (headResult.stdout !== recovery.baseSha) {
      issues.push(recoveryIssue(
        "START_RECOVERY_WRONG_HEAD",
        "작업 폴더 HEAD가 시작 때 고정한 origin/main SHA와 다릅니다.",
      ));
    }

    const statusResult = runGit(
      recovery.worktreePath,
      ["-c", "core.quotepath=false", "status", "--porcelain=v2", "-z", "--untracked-files=all", "--ignore-submodules=none"],
      { allowFailure: true, raw: true },
    );
    if (statusResult.status !== 0) {
      issues.push(recoveryIssue(
        "START_RECOVERY_STATUS_UNAVAILABLE",
        "작업 폴더의 변경 상태를 확인할 수 없습니다.",
      ));
    } else if (statusResult.stdout !== "") {
      issues.push(recoveryIssue(
        "START_RECOVERY_WORKTREE_DIRTY",
        "중단된 작업 폴더에 보존해야 할 변경이 있습니다.",
      ));
    }
  }

  const remoteResult = runGit(
    context.topLevel,
    ["ls-remote", "--exit-code", "--heads", "origin", `refs/heads/${recovery.branch}`],
    { allowFailure: true, timeout: START_RECOVERY_REMOTE_TIMEOUT_MS },
  );
  let remoteEvidence = "unavailable";
  if (remoteResult.status === 0) {
    remoteEvidence = "present";
    issues.push(recoveryIssue(
      "START_RECOVERY_REMOTE_BRANCH_EXISTS",
      "같은 이름의 원격 branch가 이미 있어 중단 기록의 단독 소유권을 증명할 수 없습니다.",
    ));
  } else if (remoteResult.status === 2) {
    remoteEvidence = "absent";
  } else {
    issues.push(recoveryIssue(
      "START_RECOVERY_REMOTE_EVIDENCE_UNAVAILABLE",
      `원격 branch 부재를 ${START_RECOVERY_REMOTE_TIMEOUT_MS / 1000}초 안에 확인하지 못했습니다. 네트워크 또는 인증을 확인하세요.`,
    ));
  }

  return Object.freeze({
    eligible: issues.length === 0,
    remoteEvidence,
    remoteTimeoutMs: START_RECOVERY_REMOTE_TIMEOUT_MS,
    issues: issues.map((issue) => ({ ...issue })),
  });
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

function recoverInterruptedStart({ context, paths, branch, actor, now, expectedBaseSha }) {
  return withTaskOperationLock(paths, () => {
    const recovery = readStartRecovery(paths);
    const expectedPath = taskWorktreePath(context.topLevel, branch);
    if (
      recovery.branch !== branch ||
      recovery.taskId !== paths.taskId ||
      !samePath(recovery.worktreePath, expectedPath)
    ) fail("START_RECOVERY_OWNERSHIP_AMBIGUOUS");
    if (recovery.actor !== actor) fail("START_RECOVERY_OWNER_MISMATCH");
    if (Date.parse(now) < Date.parse(recovery.updatedAt)) fail("TIMESTAMP_REGRESSION");
    if (expectedBaseSha !== null && expectedBaseSha !== recovery.baseSha) fail("STALE_BASE");
    const eligibility = diagnoseStartRecoveryEligibility({ context, paths, recovery });
    if (!eligibility.eligible) fail(eligibility.issues[0].code);
    const fetched = runGit(context.topLevel, ["fetch", "--prune", "origin"], { allowFailure: true });
    if (fetched.status !== 0) fail("FETCH_FAILED");
    const eligibilityAfterFetch = diagnoseStartRecoveryEligibility({ context, paths, recovery });
    if (!eligibilityAfterFetch.eligible) fail(eligibilityAfterFetch.issues[0].code);
    const stillBase = runGit(context.topLevel, ["merge-base", "--is-ancestor", recovery.baseSha, "origin/main"], { allowFailure: true });
    if (stillBase.status !== 0) fail("STALE_BASE");
    const parsed = parseTaskBranch(branch);
    const record = {
      schemaVersion: 2,
      recordType: "TaskRecordV2",
      taskId: paths.taskId,
      type: parsed.type,
      slug: parsed.slug,
      branch,
      baseRef: "origin/main",
      baseSha: recovery.baseSha,
      gitCommonDir: context.commonDir,
      worktreePath: canonicalPath(expectedPath),
      state: "ACTIVE",
      activeActor: actor,
      pendingActor: null,
      handoffFromActor: null,
      handoffSnapshotId: null,
      revision: 1,
      createdAt: recovery.createdAt,
      updatedAt: now,
    };
    writeTask(paths, record);
    writeStartRecovery(paths, { ...recovery, phase: "COMPLETED", blocker: null, updatedAt: now });
    return structuredClone(record);
  });
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
  const paths = prepareRegistry(context.commonDir, branch);

  if (!existsSync(paths.taskFile) && existsSync(paths.startRecoveryFile)) {
    return recoverInterruptedStart({ context, paths, branch, actor, now, expectedBaseSha });
  }

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
    const recoveryBase = {
      schemaVersion: 1,
      recordType: "StartRecoveryV1",
      taskId: paths.taskId,
      branch,
      baseSha,
      actor,
      worktreePath: canonicalPath(worktreePath),
      phase: "PREPARED",
      blocker: null,
      fingerprint: "",
      createdAt: now,
      updatedAt: now,
    };
    writeStartRecovery(paths, recoveryBase);
    try {
      runGit(context.topLevel, ["worktree", "add", "-b", branch, worktreePath, baseSha], {
        code: "WORKTREE_CREATE_FAILED",
      });
      created = true;
      writeStartRecovery(paths, { ...recoveryBase, phase: "WORKTREE_CREATED" });
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
      writeStartRecovery(paths, { ...recoveryBase, phase: "COMPLETED" });
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
        if (existsSync(paths.startRecoveryFile)) unlinkSync(paths.startRecoveryFile);
        throw error;
      }
      writeStartRecovery(paths, {
        ...recoveryBase,
        phase: "BLOCKED",
        blocker: "작업 폴더에 보존해야 할 변경이 있어 자동 복구를 중단했습니다.",
      });
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
  const paths = registryPaths(context.commonDir, branch);
  for (const value of [paths.lifecycleRoot, paths.root, paths.tasks, paths.startRecoveries]) {
    assertRegistryDirectory(value, context.commonDir);
  }
  const startRecovery = readStartRecovery(paths, { optional: true });
  if (!existsSync(paths.taskFile)) {
    if (startRecovery === null) fail("TASK_NOT_FOUND");
    const eligibility = diagnoseStartRecoveryEligibility({ context, paths, recovery: startRecovery });
    const blockers = eligibility.issues.map((issue) => issue.message);
    const firstIssue = eligibility.issues[0] ?? null;
    const retryableEvidence = firstIssue?.code === "START_RECOVERY_REMOTE_EVIDENCE_UNAVAILABLE";
    const dirtyWorktree = eligibility.issues.some((issue) => issue.code === "START_RECOVERY_WORKTREE_DIRTY");
    const remoteConflict = eligibility.issues.find((issue) => issue.code === "START_RECOVERY_REMOTE_BRANCH_EXISTS");
    const quotedWorktree = quotePowerShellArgument(startRecovery.worktreePath);
    const quotedRepository = quotePowerShellArgument(context.topLevel);
    const nextAction = eligibility.eligible
      ? {
          owner: startRecovery.actor,
          reason: "같은 실행자가 같은 시작 명령을 다시 실행하면 기존 작업 폴더를 안전하게 연결합니다.",
          command: `pnpm task:start -- --repo ${quotedRepository} --branch ${branch} --actor ${startRecovery.actor} --base-sha ${startRecovery.baseSha}`,
          approvalRequired: false,
          retrySafe: true,
        }
      : dirtyWorktree
        ? {
            owner: startRecovery.actor,
            reason: "보존해야 할 변경의 소유자와 내용을 먼저 확인하세요.",
            command: `git -C ${quotedWorktree} status --short`,
            approvalRequired: false,
            retrySafe: true,
          }
        : remoteConflict
          ? {
              owner: "manual",
              reason: remoteConflict.message,
              command: `git -C ${quotedRepository} ls-remote --heads origin refs/heads/${branch}`,
              approvalRequired: true,
              retrySafe: true,
            }
        : retryableEvidence
          ? {
              owner: startRecovery.actor,
              reason: firstIssue.message,
              command: `pnpm task:status -- --repo ${quotedRepository} --branch ${branch}`,
              approvalRequired: false,
              retrySafe: true,
            }
          : {
              owner: "manual",
              reason: firstIssue?.message ?? "소유권 증거를 사람이 확인해야 합니다.",
              command: `git -C ${quotedRepository} worktree list --porcelain`,
              approvalRequired: true,
              retrySafe: true,
            };
    return {
      task: null,
      handoffSnapshot: null,
      handoffContext: null,
      cleanupManifest: null,
      startRecovery: structuredClone(startRecovery),
      startRecoveryEligibility: structuredClone(eligibility),
      summary: "작업 시작이 중단되어 소유권 증거를 확인한 뒤 복구해야 합니다.",
      blockers,
      nextAction,
    };
  }
  const { task } = readTask(context.commonDir, branch);
  let handoffSnapshot = null;
  let handoffContext = null;
  if (task.handoffSnapshotId !== null) {
    handoffSnapshot = readJson(
      path.join(paths.handoffs, `${task.handoffSnapshotId}.json`),
      validateHandoffSnapshot,
      "HANDOFF_SNAPSHOT_NOT_FOUND",
    );
    handoffContext = readHandoffContext(paths, task.handoffSnapshotId, { optional: true });
  }
  let cleanupManifest = null;
  assertRegistryDirectory(paths.cleanups, context.commonDir);
  if (existsSync(paths.cleanupFile)) {
    cleanupManifest = readJson(paths.cleanupFile, validateCleanupManifest, "CLEANUP_MANIFEST_NOT_FOUND");
  }
  assertRegistryDirectory(paths.finishReports, context.commonDir);
  assertRegistryDirectory(paths.ownerAuth, context.commonDir);
  const finishReport = readFingerprintedSidecar(
    paths.finishReportFile,
    validateFinishReportV1,
    "FINISH_REPORT_NOT_FOUND",
    "FINISH_REPORT_FINGERPRINT_MISMATCH",
    { optional: true },
  );
  const ownerAuthResult = readFingerprintedSidecar(
    paths.ownerAuthFile,
    validateOwnerAuthResultV1,
    "OWNER_AUTH_RESULT_NOT_FOUND",
    "OWNER_AUTH_RESULT_FINGERPRINT_MISMATCH",
    { optional: true },
  );
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
  const quotedWorktree = quotePowerShellArgument(effectiveTask.worktreePath);
  const quotedRepository = quotePowerShellArgument(context.topLevel);
  const missingHandoffContext = effectiveTask.state === "HANDOFF_PENDING" && handoffContext === null;
  const handoffContextInputPath = path.join(
    effectiveTask.worktreePath,
    ".codex",
    "work",
    effectiveTask.slug,
    "handoff-context.json",
  );
  const nextAction = missingHandoffContext
    ? {
        owner: effectiveTask.handoffFromActor,
        reason: "기존 실행자가 작업 context를 준비하고 인수인계 상태를 갱신해야 합니다.",
        command: `pnpm task:handoff -- --action refresh --repo ${quotedWorktree} --branch ${effectiveTask.branch} --actor ${effectiveTask.handoffFromActor} --context ${quotePowerShellArgument(handoffContextInputPath)}`,
        approvalRequired: false,
        retrySafe: true,
      }
    : effectiveTask.state === "HANDOFF_PENDING"
      ? {
          owner: effectiveTask.pendingActor,
          reason: "인수인계 내용을 확인하고 같은 작업 폴더에서 작업을 수락하세요.",
          command: `pnpm task:handoff -- --action accept --repo ${quotedWorktree} --branch ${effectiveTask.branch} --actor ${effectiveTask.pendingActor}`,
          approvalRequired: false,
          retrySafe: true,
        }
    : effectiveTask.state === "CLEANED"
      ? {
          owner: "manual",
          reason: "이 작업은 이미 정리되었습니다.",
          command: `pnpm task:status -- --repo ${quotedRepository} --branch ${effectiveTask.branch}`,
          approvalRequired: false,
          retrySafe: true,
        }
      : {
          owner: effectiveTask.activeActor,
          reason: "현재 실행자가 이 작업 폴더에서 구현과 검증을 이어가면 됩니다.",
          command: `pnpm task:finish -- --repo ${quotedWorktree} --branch ${effectiveTask.branch} --actor ${effectiveTask.activeActor}`,
          approvalRequired: false,
          retrySafe: true,
        };
  return {
    task: structuredClone(effectiveTask),
    handoffSnapshot: structuredClone(handoffSnapshot),
    handoffContext: structuredClone(handoffContext),
    cleanupManifest: structuredClone(cleanupManifest),
    startRecovery: structuredClone(startRecovery),
    startRecoveryEligibility: null,
    finishReport: structuredClone(finishReport),
    ownerAuthResult: structuredClone(ownerAuthResult),
    summary: effectiveTask.state === "HANDOFF_PENDING"
      ? `${effectiveTask.handoffFromActor}에서 ${effectiveTask.pendingActor}(으)로 인수인계를 기다리고 있습니다.`
      : effectiveTask.state === "CLEANED"
        ? "작업 정리가 완료되었습니다."
        : `${effectiveTask.activeActor}가 작업을 진행할 수 있습니다.`,
    blockers: missingHandoffContext
      ? ["인수인계 context가 없어 새 실행자가 아직 작업을 수락할 수 없습니다."]
      : [],
    nextAction,
  };
}

export function handoffTask({ repoPath, branch, actor, toActor, now, context: handoffContextInput = null }) {
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
    let handoffContext = null;
    if (handoffContextInput !== null) {
      handoffContext = buildHandoffContext({ task, snapshot, context: handoffContextInput });
      atomicWriteJson(path.join(paths.handoffContexts, `${snapshotId}.json`), handoffContext);
    }
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
    return {
      ...structuredClone(next),
      handoffSnapshot: structuredClone(snapshot),
      ...(handoffContext === null ? {} : { handoffContext: structuredClone(handoffContext) }),
    };
  });
}

export function offerTaskHandoff(options) {
  if (!isPlainObject(options?.context)) fail("HANDOFF_CONTEXT_REQUIRED");
  if (validateHandoffContextInput(options.context).length > 0) fail("HANDOFF_CONTEXT_INVALID");
  return handoffTask(options);
}

function resumeTaskWithOptions({ repoPath, branch, actor, now }, { requireContext }) {
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
    const handoffContext = readHandoffContext(paths, task.handoffSnapshotId, { optional: !requireContext });
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
    if (handoffContext !== null && (
      handoffContext.taskId !== task.taskId ||
      handoffContext.branch !== task.branch ||
      handoffContext.snapshotId !== snapshot.snapshotId ||
      handoffContext.revision !== snapshot.revision ||
      handoffContext.fromActor !== snapshot.fromActor ||
      handoffContext.toActor !== snapshot.toActor ||
      handoffContext.createdAt !== snapshot.createdAt
    )) {
      fail("HANDOFF_CONTEXT_MISMATCH");
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

export function resumeTask(options) {
  return resumeTaskWithOptions(options, { requireContext: false });
}

export function acceptTaskHandoff(options) {
  return resumeTaskWithOptions(options, { requireContext: true });
}

export function refreshTaskHandoff({ repoPath, branch, actor, context: handoffContextInput, now }) {
  assertActor(actor);
  if (!isPlainObject(handoffContextInput)) fail("HANDOFF_CONTEXT_REQUIRED");
  if (!validTimestamp(now)) fail("INVALID_TIMESTAMP");
  const git = gitContext(repoPath);
  const paths = prepareRegistry(git.commonDir, branch);
  return withTaskOperationLock(paths, () => {
    const { task } = readTask(git.commonDir, branch);
    if (!samePath(git.topLevel, task.worktreePath)) fail("TASK_WORKTREE_MISMATCH");
    assertTaskBranchAtWorktree(task.worktreePath, task.branch);
    if (task.state !== "HANDOFF_PENDING" || task.handoffFromActor !== actor) {
      fail("HANDOFF_REFRESH_ACTOR_MISMATCH");
    }
    if (Date.parse(now) < Date.parse(task.updatedAt)) fail("TIMESTAMP_REGRESSION");
    const current = computeWorktreeFingerprint(task.worktreePath);
    const snapshotId = `${task.taskId}-handoff-${task.revision + 1}`;
    const metadata = {
      taskId: task.taskId,
      branch: task.branch,
      fromActor: actor,
      toActor: task.pendingActor,
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
    const handoffContext = buildHandoffContext({ task, snapshot, context: handoffContextInput });
    atomicWriteJson(path.join(paths.handoffs, `${snapshotId}.json`), snapshot);
    atomicWriteJson(path.join(paths.handoffContexts, `${snapshotId}.json`), handoffContext);
    const next = {
      ...task,
      handoffSnapshotId: snapshotId,
      revision: task.revision + 1,
      updatedAt: now,
    };
    writeTask(paths, next);
    return { ...structuredClone(next), handoffSnapshot: structuredClone(snapshot), handoffContext: structuredClone(handoffContext) };
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

const FINISH_COMMAND_TIMEOUT_MS = 30_000;

function finishFlowError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function defaultFinishCommandRunner(command, args, options) {
  return spawnSync(command, args, {
    ...options,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    shell: false,
    windowsHide: true,
  });
}

function runFinishGit(commandRunner, worktreePath, args, { allowFailure = false } = {}) {
  let result;
  try {
    result = commandRunner("git", ["-C", worktreePath, ...args], {
      cwd: worktreePath,
      timeout: FINISH_COMMAND_TIMEOUT_MS,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
  } catch {
    throw finishFlowError("FINISH_GIT_CHECK_FAILED");
  }
  const status = result?.status ?? 1;
  if (status !== 0 && !allowFailure) throw finishFlowError("FINISH_GIT_CHECK_FAILED");
  return { status, stdout: String(result?.stdout ?? "").trim() };
}

function finishNextActionFor({ dirty, upstream, ahead, behind, branch, worktreePath, actor }) {
  const quotedWorktreePath = quotePowerShellArgument(worktreePath);
  if (dirty) {
    return {
      blockers: ["커밋되지 않은 변경이 있어 먼저 검증하고 커밋 준비를 해야 합니다."],
      nextAction: {
        owner: actor,
        reason: "변경 파일을 확인하고 필요한 검증을 마친 뒤 커밋 준비 상태로 만드세요.",
        command: `git -C ${quotedWorktreePath} status --short`,
        approvalRequired: false,
        retrySafe: true,
      },
    };
  }
  if (upstream !== null && ahead > 0 && behind > 0) {
    return {
      blockers: ["로컬과 원격 task branch가 서로 다른 커밋을 가지고 있습니다."],
      nextAction: {
        owner: "manual",
        reason: "기록을 보존한 채 merge 또는 rebase 방식을 결정해야 합니다.",
        command: `git -C ${quotedWorktreePath} log --oneline --left-right HEAD...origin/${branch}`,
        approvalRequired: true,
        retrySafe: true,
      },
    };
  }
  if (upstream !== null && ahead === 0 && behind > 0) {
    return {
      blockers: ["원격 task branch에 로컬보다 새로운 커밋이 있습니다."],
      nextAction: {
        owner: actor,
        reason: "이미 가져온 원격 변경을 fast-forward로 반영한 뒤 다시 확인하세요.",
        command: `git -C ${quotedWorktreePath} merge --ff-only origin/${branch}`,
        approvalRequired: false,
        retrySafe: true,
      },
    };
  }
  if (upstream === null) {
    return {
      blockers: ["아직 원격에 게시되지 않아 게시 승인이 필요합니다."],
      nextAction: {
        owner: "manual",
        reason: "검증된 커밋을 원격에 처음 게시할지 승인해 주세요.",
        command: `git -C ${quotedWorktreePath} push -u origin ${branch}`,
        approvalRequired: true,
        retrySafe: true,
      },
    };
  }
  if (ahead > 0) {
    return {
      blockers: ["원격에 아직 게시되지 않은 로컬 커밋이 있습니다."],
      nextAction: {
        owner: "manual",
        reason: "남은 로컬 커밋을 원격에 게시할지 승인해 주세요.",
        command: `git -C ${quotedWorktreePath} push`,
        approvalRequired: true,
        retrySafe: true,
      },
    };
  }
  return {
    blockers: [],
    nextAction: {
      owner: actor,
      reason: "원격 게시가 끝났으므로 PR 상태와 필수 검사를 확인하세요.",
      command: `gh pr view ${branch}`,
      approvalRequired: false,
      retrySafe: true,
    },
  };
}

export function createFinishReport({
  repoPath,
  branch,
  actor,
  now = new Date().toISOString(),
  commandRunner = defaultFinishCommandRunner,
}) {
  const status = readTaskStatus({ repoPath, branch });
  const task = status.task;
  if (task === null) throw finishFlowError("TASK_NOT_ACTIVE");
  if (task.state !== "ACTIVE" || task.activeActor !== actor) throw finishFlowError("TASK_ACTOR_MISMATCH");
  const worktreePath = task.worktreePath;
  if (path.resolve(repoPath).toLowerCase() !== path.resolve(worktreePath).toLowerCase()) {
    throw finishFlowError("TASK_WORKTREE_REQUIRED");
  }
  const actualBranch = runFinishGit(commandRunner, worktreePath, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  if (actualBranch.stdout !== branch) throw finishFlowError("TASK_BRANCH_MISMATCH");
  const headSha = runFinishGit(commandRunner, worktreePath, ["rev-parse", "HEAD"]).stdout;
  const worktreeStatus = runFinishGit(commandRunner, worktreePath, [
    "-c", "core.quotepath=false", "status", "--porcelain=v2", "-z",
    "--untracked-files=normal", "--ignore-submodules=none",
  ]).stdout;
  const upstreamResult = runFinishGit(
    commandRunner,
    worktreePath,
    ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
    { allowFailure: true },
  );
  const upstream = upstreamResult.status === 0 && upstreamResult.stdout ? upstreamResult.stdout : null;
  let ahead = 0;
  let behind = 0;
  if (upstream !== null) {
    const counts = runFinishGit(
      commandRunner,
      worktreePath,
      ["rev-list", "--left-right", "--count", `HEAD...${upstream}`],
    ).stdout;
    const [aheadText, behindText] = counts.split(/\s+/u);
    ahead = Number(aheadText);
    behind = Number(behindText);
    if (!Number.isInteger(ahead) || !Number.isInteger(behind)) {
      throw finishFlowError("FINISH_UPSTREAM_COUNT_INVALID");
    }
  }
  const dirty = worktreeStatus !== "";
  const taskUpstream = upstream !== null && upstream.toLowerCase() === `origin/${branch}`.toLowerCase();
  const published = taskUpstream && ahead === 0 && behind === 0;
  const guidance = finishNextActionFor({
    dirty,
    upstream: taskUpstream ? upstream : null,
    ahead,
    behind,
    branch,
    worktreePath,
    actor,
  });
  const report = {
    schemaVersion: 1,
    recordType: "FinishReportV1",
    taskId: task.taskId,
    branch,
    actor,
    worktreePath,
    headSha,
    dirty,
    upstream,
    ahead,
    behind,
    published,
    lastOwnerAuth: status.ownerAuthResult,
    blockers: guidance.blockers,
    nextAction: guidance.nextAction,
    fingerprint: "",
    createdAt: now,
  };
  report.fingerprint = sidecarFingerprint(report);
  if (validateFinishReportV1(report).length > 0) throw finishFlowError("FINISH_REPORT_INVALID");
  return writeFinishReportSidecar({ repoPath, branch, report });
}
