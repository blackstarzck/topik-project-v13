import path from "node:path";

const MAX_RECORD_BYTES = 64 * 1024;
const MAX_STRING_LENGTH = 1024;
const MAX_SHORT_STRING_LENGTH = 128;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,126}[A-Za-z0-9])?$/;
const WINDOWS_RESERVED_NAMES = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  ...Array.from({ length: 9 }, (_, index) => `COM${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `LPT${index + 1}`),
]);

const REPORT_STATES = new Set([
  "DISCOVERED",
  "ISOLATED",
  "SYNC_DECISION",
  "WORKING",
  "VERIFIED",
  "COMMITTED",
  "PUBLISHED",
  "PR_OPEN",
  "MERGE_VERIFIED",
  "NEEDS_ATTENTION",
  "PRESERVED",
  "BLOCKED",
]);
const FORBIDDEN_REPORT_STATES = new Set(["FINALIZING", "CLEANED"]);
const ALL_STATES = new Set([...REPORT_STATES, ...FORBIDDEN_REPORT_STATES]);
const VALID_TRANSITIONS = new Map([
  ["DISCOVERED", new Set(["ISOLATED", "NEEDS_ATTENTION", "PRESERVED", "BLOCKED"])],
  ["ISOLATED", new Set(["SYNC_DECISION", "NEEDS_ATTENTION", "PRESERVED", "BLOCKED"])],
  ["SYNC_DECISION", new Set(["WORKING", "NEEDS_ATTENTION", "PRESERVED", "BLOCKED"])],
  ["WORKING", new Set(["VERIFIED", "NEEDS_ATTENTION", "PRESERVED", "BLOCKED"])],
  ["VERIFIED", new Set(["COMMITTED", "WORKING", "NEEDS_ATTENTION", "BLOCKED"])],
  ["COMMITTED", new Set(["PUBLISHED", "WORKING", "NEEDS_ATTENTION", "BLOCKED"])],
  ["PUBLISHED", new Set(["PR_OPEN", "WORKING", "NEEDS_ATTENTION", "BLOCKED"])],
  ["PR_OPEN", new Set(["WORKING", "MERGE_VERIFIED", "NEEDS_ATTENTION", "BLOCKED"])],
  ["MERGE_VERIFIED", new Set(["FINALIZING", "NEEDS_ATTENTION", "PRESERVED", "BLOCKED"])],
  ["NEEDS_ATTENTION", new Set(["WORKING", "PRESERVED", "BLOCKED"])],
  ["BLOCKED", new Set(["WORKING", "NEEDS_ATTENTION", "PRESERVED"])],
]);

export function isForbiddenReportState(state) {
  return FORBIDDEN_REPORT_STATES.has(state);
}

export function isValidTransition(from, to) {
  return VALID_TRANSITIONS.get(from)?.has(to) === true;
}

const TOP_LEVEL_KEYS = new Set([
  "schemaVersion",
  "mode",
  "taskId",
  "slug",
  "owner",
  "repoId",
  "gitCommonDir",
  "worktreePath",
  "branch",
  "baseRef",
  "baseSha",
  "publishedHeadSha",
  "pullRequestHint",
  "state",
  "ports",
  "lastVerification",
  "lastTransition",
  "cleanupAuthorized",
  "revision",
  "updatedAt",
]);
const PR_HINT_KEYS = new Set([
  "repository",
  "number",
  "state",
  "base",
  "headSha",
  "checkedAt",
]);
const VERIFICATION_KEYS = new Set(["result", "completedAt", "checks"]);
const VERIFICATION_CHECK_KEYS = new Set(["name", "result"]);
const TRANSITION_KEYS = new Set(["from", "to", "evidence"]);
const EVIDENCE_KEYS = new Set(["source", "checks", "observedAt"]);
const POLLUTION_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const SECRET_LIKE_KEY = /(authorization|cookie|credential|password|private.?key|secret|token|api.?key)/i;

export class RegistryDisplayHintError extends Error {
  constructor() {
    super("REGISTRY_HINT_INVALID");
    this.name = "RegistryDisplayHintError";
    this.code = "REGISTRY_HINT_INVALID";
  }
}

function validationError(code, fieldPath) {
  return { code, path: fieldPath };
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function containsUnsafeKey(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  return Object.keys(value).some(
    (key) =>
      POLLUTION_KEYS.has(key) ||
      SECRET_LIKE_KEY.test(key) ||
      containsUnsafeKey(value[key], seen),
  );
}

function checkClosedObject(value, allowedKeys, fieldPath, errors) {
  if (!isPlainObject(value)) {
    errors.push(validationError("INVALID_OBJECT", fieldPath));
    return false;
  }
  for (const key of Object.keys(value)) {
    if (POLLUTION_KEYS.has(key)) {
      errors.push(validationError("PROTOTYPE_POLLUTION_KEY", `${fieldPath}.${key}`));
    } else if (!allowedKeys.has(key)) {
      errors.push(validationError("UNKNOWN_FIELD", `${fieldPath}.${key}`));
    }
  }
  return true;
}

function checkString(value, fieldPath, errors, options = {}) {
  const { nullable = false, max = MAX_STRING_LENGTH, pattern } = options;
  if (nullable && value === null) return;
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    errors.push(validationError("INVALID_STRING", fieldPath));
    return;
  }
  if (value.length > max) errors.push(validationError("FIELD_TOO_LONG", fieldPath));
  if (pattern && !pattern.test(value)) {
    errors.push(validationError("INVALID_STRING_FORMAT", fieldPath));
  }
}

export function hasValidIsoTimestamp(value) {
  if (typeof value !== "string" || value.length > 40) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function hasValidSha(value, { nullable = false } = {}) {
  if (nullable && value === null) return true;
  return typeof value === "string" && /^[a-f0-9]{40}$/i.test(value);
}

export function isValidIdentifier(value) {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) return false;
  if (value.endsWith(".") || value.endsWith(" ") || value.includes(":")) return false;
  return !WINDOWS_RESERVED_NAMES.has(value.split(".", 1)[0].toUpperCase());
}

function validatePullRequestHint(value, errors) {
  if (value === null) return;
  if (!checkClosedObject(value, PR_HINT_KEYS, "pullRequestHint", errors)) return;
  checkString(value.repository, "pullRequestHint.repository", errors, {
    max: 200,
    pattern: /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/,
  });
  if (!Number.isInteger(value.number) || value.number <= 0) {
    errors.push(validationError("INVALID_INTEGER", "pullRequestHint.number"));
  }
  if (!["OPEN", "MERGED", "CLOSED", "UNKNOWN"].includes(value.state)) {
    errors.push(validationError("INVALID_ENUM", "pullRequestHint.state"));
  }
  checkString(value.base, "pullRequestHint.base", errors, {
    max: MAX_SHORT_STRING_LENGTH,
  });
  if (!hasValidSha(value.headSha)) {
    errors.push(validationError("INVALID_SHA", "pullRequestHint.headSha"));
  }
  if (!hasValidIsoTimestamp(value.checkedAt)) {
    errors.push(validationError("INVALID_TIMESTAMP", "pullRequestHint.checkedAt"));
  }
}

function validateVerification(value, errors) {
  if (value === null) return;
  if (!checkClosedObject(value, VERIFICATION_KEYS, "lastVerification", errors)) return;
  if (!["passed", "failed"].includes(value.result)) {
    errors.push(validationError("INVALID_ENUM", "lastVerification.result"));
  }
  if (!hasValidIsoTimestamp(value.completedAt)) {
    errors.push(validationError("INVALID_TIMESTAMP", "lastVerification.completedAt"));
  }
  if (!Array.isArray(value.checks) || value.checks.length > 32) {
    errors.push(validationError("INVALID_ARRAY", "lastVerification.checks"));
    return;
  }
  value.checks.forEach((check, index) => {
    const prefix = `lastVerification.checks[${index}]`;
    if (!checkClosedObject(check, VERIFICATION_CHECK_KEYS, prefix, errors)) return;
    checkString(check.name, `${prefix}.name`, errors, { max: 80 });
    if (!["passed", "failed", "skipped"].includes(check.result)) {
      errors.push(validationError("INVALID_ENUM", `${prefix}.result`));
    }
  });
}

function validateEvidence(value, fieldPath, errors) {
  if (!checkClosedObject(value, EVIDENCE_KEYS, fieldPath, errors)) return;
  if (!["local-inspection", "git", "github-api"].includes(value.source)) {
    errors.push(validationError("INVALID_ENUM", `${fieldPath}.source`));
  }
  if (!Array.isArray(value.checks) || value.checks.length === 0 || value.checks.length > 32) {
    errors.push(validationError("INVALID_ARRAY", `${fieldPath}.checks`));
  } else {
    value.checks.forEach((check, index) => {
      checkString(check, `${fieldPath}.checks[${index}]`, errors, {
        max: 80,
        pattern: /^[a-z0-9][a-z0-9-]*$/,
      });
    });
  }
  if (!hasValidIsoTimestamp(value.observedAt)) {
    errors.push(validationError("INVALID_TIMESTAMP", `${fieldPath}.observedAt`));
  }
}

export function validateTransitionEvidence(value) {
  const errors = [];
  validateEvidence(value, "evidence", errors);
  return errors;
}

function validateLastTransition(value, recordState, updatedAt, errors) {
  if (value === null) return;
  if (!checkClosedObject(value, TRANSITION_KEYS, "lastTransition", errors)) return;
  for (const field of ["from", "to"]) {
    if (isForbiddenReportState(value[field])) {
      errors.push(validationError("REPORT_STATE_FORBIDDEN", `lastTransition.${field}`));
    } else if (!REPORT_STATES.has(value[field])) {
      errors.push(validationError("INVALID_ENUM", `lastTransition.${field}`));
    }
  }
  if (
    REPORT_STATES.has(value.from) &&
    REPORT_STATES.has(value.to) &&
    !isValidTransition(value.from, value.to)
  ) {
    errors.push(validationError("INVALID_TRANSITION", "lastTransition"));
  }
  if (value.to !== recordState) {
    errors.push(validationError("TRANSITION_STATE_MISMATCH", "lastTransition.to"));
  }
  validateEvidence(value.evidence, "lastTransition.evidence", errors);
  if (
    hasValidIsoTimestamp(value.evidence?.observedAt) &&
    hasValidIsoTimestamp(updatedAt) &&
    Date.parse(value.evidence.observedAt) > Date.parse(updatedAt)
  ) {
    errors.push(validationError("TRANSITION_TIME_INVALID", "lastTransition.evidence.observedAt"));
  }
}

function isPortableAbsolutePath(value) {
  return (
    typeof value === "string" &&
    (path.posix.isAbsolute(value) || path.win32.isAbsolute(value))
  );
}

export function validateTaskRecord(record) {
  const errors = [];
  if (!checkClosedObject(record, TOP_LEVEL_KEYS, "record", errors)) return errors;
  if (containsUnsafeKey(record)) {
    errors.push(validationError("SECRET_OR_POLLUTION_FIELD", "record"));
  }
  if (record.schemaVersion !== 1) {
    errors.push(validationError("INVALID_SCHEMA_VERSION", "schemaVersion"));
  }
  if (record.mode !== "report") errors.push(validationError("INVALID_MODE", "mode"));
  for (const field of ["taskId", "repoId"]) {
    if (!isValidIdentifier(record[field])) {
      errors.push(validationError("INVALID_IDENTIFIER", field));
    }
  }
  checkString(record.slug, "slug", errors, {
    max: MAX_SHORT_STRING_LENGTH,
    pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  });
  if (!["codex-desktop", "manual"].includes(record.owner)) {
    errors.push(validationError("INVALID_ENUM", "owner"));
  }
  for (const field of ["gitCommonDir", "worktreePath"]) {
    checkString(record[field], field, errors, { max: 2048 });
    if (!isPortableAbsolutePath(record[field])) {
      errors.push(validationError("INVALID_PATH", field));
    }
  }
  checkString(record.branch, "branch", errors, { nullable: true, max: 255 });
  checkString(record.baseRef, "baseRef", errors, { max: 255 });
  if (!hasValidSha(record.baseSha)) errors.push(validationError("INVALID_SHA", "baseSha"));
  if (!hasValidSha(record.publishedHeadSha, { nullable: true })) {
    errors.push(validationError("INVALID_SHA", "publishedHeadSha"));
  }
  validatePullRequestHint(record.pullRequestHint, errors);
  if (!ALL_STATES.has(record.state)) {
    errors.push(validationError("INVALID_ENUM", "state"));
  } else if (isForbiddenReportState(record.state)) {
    errors.push(validationError("REPORT_STATE_FORBIDDEN", "state"));
  }
  if (
    !Array.isArray(record.ports) ||
    record.ports.length > 32 ||
    record.ports.some((port) => !Number.isInteger(port) || port <= 0 || port > 65535)
  ) {
    errors.push(validationError("INVALID_PORTS", "ports"));
  }
  validateVerification(record.lastVerification, errors);
  validateLastTransition(record.lastTransition, record.state, record.updatedAt, errors);
  if (record.cleanupAuthorized !== false) {
    errors.push(validationError("CLEANUP_AUTHORIZATION_FORBIDDEN", "cleanupAuthorized"));
  }
  if (!Number.isInteger(record.revision) || record.revision < 1) {
    errors.push(validationError("INVALID_REVISION", "revision"));
  }
  if (!hasValidIsoTimestamp(record.updatedAt)) {
    errors.push(validationError("INVALID_TIMESTAMP", "updatedAt"));
  }
  try {
    if (Buffer.byteLength(JSON.stringify(record), "utf8") > MAX_RECORD_BYTES) {
      errors.push(validationError("RECORD_TOO_LARGE", "record"));
    }
  } catch {
    errors.push(validationError("INVALID_SERIALIZATION", "record"));
  }
  return errors;
}

export function extractRegistryDisplayHint(record) {
  if (validateTaskRecord(record).length > 0) throw new RegistryDisplayHintError();
  return Object.freeze({
    worktreePath: record.worktreePath,
    owner: record.owner,
    publishedHeadSha: record.publishedHeadSha,
    pullRequestHint:
      record.pullRequestHint === null
        ? null
        : Object.freeze({
            number: record.pullRequestHint.number,
            state: record.pullRequestHint.state,
            checkedAt: record.pullRequestHint.checkedAt,
          }),
  });
}
