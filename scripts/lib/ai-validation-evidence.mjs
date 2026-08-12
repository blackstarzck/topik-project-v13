import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const SHA_PATTERN = /^[a-f0-9]{40}$/u;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/u;
const RESULTS = new Set(["SUCCESS", "FAILED"]);
const MAX_RECORD_BYTES = 16 * 1024;
const MAX_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const UNSAFE_FIELD_PATTERN =
  /(?:authorization|cookie|credential|env(?:ironment)?|output|password|private.?key|secret|session|thread|token|api.?key)/iu;
const DANGEROUS_FIELDS = new Set(["__proto__", "prototype", "constructor"]);
const RECORD_FIELDS = new Set([
  "schemaVersion",
  "recordType",
  "headSha",
  "baseSha",
  "workflowDigest",
  "result",
  "complete",
  "durationMs",
  "recordedAt",
  "revision",
  "fingerprint",
]);
const CREATE_FIELDS = new Set([
  "headSha",
  "baseSha",
  "workflowDigest",
  "result",
  "complete",
  "durationMs",
  "recordedAt",
  "revision",
]);
const MAX_WORKFLOW_FILE_BYTES = 4 * 1024 * 1024;
const APPROVED_WORKFLOWS = new Map([
  [
    "pipeline-v3.1-black-pr-full",
    Object.freeze({
      id: "pipeline-v3.1-black-pr-full",
      baseRef: "origin/main",
      digestFiles: Object.freeze([
        ".github/workflows/ci.yml",
        "package.json",
        "TESTING.md",
        "vitest.config.ts",
        "eslint.config.mjs",
        "tsconfig.json",
        "scripts/check-project-structure.mjs",
        "scripts/check-artifact-hygiene.mjs",
        "scripts/check-agent-skill-policy.mjs",
        "scripts/sync-agent-skills.mjs",
        "scripts/build-preflight.mjs",
        "scripts/lib/ai-validation-evidence.mjs",
      ]),
      steps: Object.freeze([
        Object.freeze({
          id: "project-structure",
          command: "node",
          args: Object.freeze(["scripts/check-project-structure.mjs"]),
          timeoutMs: 120_000,
        }),
        Object.freeze({
          id: "artifact-hygiene",
          command: "node",
          args: Object.freeze(["scripts/check-artifact-hygiene.mjs", "--mode", "check"]),
          timeoutMs: 120_000,
        }),
        Object.freeze({
          id: "agent-skill-policy",
          command: "node",
          args: Object.freeze(["scripts/check-agent-skill-policy.mjs"]),
          timeoutMs: 120_000,
        }),
        Object.freeze({
          id: "agent-skills",
          command: "node",
          args: Object.freeze(["scripts/sync-agent-skills.mjs", "--check"]),
          timeoutMs: 120_000,
        }),
        Object.freeze({
          id: "tests",
          command: "node",
          args: Object.freeze(["node_modules/vitest/vitest.mjs", "run"]),
          timeoutMs: 600_000,
        }),
        Object.freeze({
          id: "typecheck",
          command: "node",
          args: Object.freeze(["node_modules/typescript/bin/tsc", "--noEmit"]),
          timeoutMs: 300_000,
        }),
        Object.freeze({
          id: "lint",
          command: "node",
          args: Object.freeze(["node_modules/eslint/bin/eslint.js", "."]),
          timeoutMs: 300_000,
        }),
        Object.freeze({
          id: "build-preflight",
          command: "node",
          args: Object.freeze(["scripts/build-preflight.mjs", "--isolated-dev-build"]),
          timeoutMs: 120_000,
        }),
        Object.freeze({
          id: "build",
          command: "node",
          args: Object.freeze(["node_modules/next/dist/bin/next", "build"]),
          timeoutMs: 600_000,
        }),
      ]),
    }),
  ],
]);

export class ValidationEvidenceError extends Error {
  constructor(code) {
    super(code);
    this.name = "ValidationEvidenceError";
    this.code = code;
  }
}

function fail(code) {
  throw new ValidationEvidenceError(code);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function issue(code, field) {
  return { code, path: field };
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, stableValue(value[key])]),
  );
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fingerprintRecord(record) {
  const payload = structuredClone(record);
  delete payload.fingerprint;
  return sha256(JSON.stringify(stableValue(payload)));
}

function exactTimestamp(value) {
  if (typeof value !== "string" || value.length > 40) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function keyFrom(value) {
  return {
    baseSha: value?.baseSha,
    headSha: value?.headSha,
    workflowDigest: value?.workflowDigest,
  };
}

function keyValid(key) {
  return (
    isPlainObject(key) &&
    SHA_PATTERN.test(key.headSha ?? "") &&
    SHA_PATTERN.test(key.baseSha ?? "") &&
    DIGEST_PATTERN.test(key.workflowDigest ?? "")
  );
}

function keyDigest(value) {
  const key = keyFrom(value);
  if (!keyValid(key)) fail("VALIDATION_EVIDENCE_KEY_INVALID");
  return sha256(JSON.stringify(stableValue(key)));
}

export function validateValidationEvidenceV1(record) {
  if (!isPlainObject(record)) return [issue("INVALID_OBJECT", "record")];
  const errors = [];
  for (const field of Object.keys(record)) {
    if (!RECORD_FIELDS.has(field)) errors.push(issue("UNKNOWN_FIELD", field));
    if (UNSAFE_FIELD_PATTERN.test(field) || DANGEROUS_FIELDS.has(field)) {
      errors.push(issue("SECRET_FIELD", field));
    }
  }
  if (record.schemaVersion !== 1) errors.push(issue("INVALID_SCHEMA", "schemaVersion"));
  if (record.recordType !== "ValidationEvidenceV1") {
    errors.push(issue("INVALID_RECORD_TYPE", "recordType"));
  }
  if (!SHA_PATTERN.test(record.headSha ?? "")) errors.push(issue("INVALID_SHA", "headSha"));
  if (!SHA_PATTERN.test(record.baseSha ?? "")) errors.push(issue("INVALID_SHA", "baseSha"));
  if (!DIGEST_PATTERN.test(record.workflowDigest ?? "")) {
    errors.push(issue("INVALID_DIGEST", "workflowDigest"));
  }
  if (!RESULTS.has(record.result)) errors.push(issue("INVALID_RESULT", "result"));
  if (typeof record.complete !== "boolean") errors.push(issue("INVALID_COMPLETE", "complete"));
  if (
    !Number.isSafeInteger(record.durationMs) ||
    record.durationMs < 0 ||
    record.durationMs > MAX_DURATION_MS
  ) {
    errors.push(issue("INVALID_DURATION", "durationMs"));
  }
  if (!exactTimestamp(record.recordedAt)) errors.push(issue("INVALID_TIMESTAMP", "recordedAt"));
  if (!Number.isSafeInteger(record.revision) || record.revision < 1) {
    errors.push(issue("INVALID_REVISION", "revision"));
  }
  if (!DIGEST_PATTERN.test(record.fingerprint ?? "")) {
    errors.push(issue("INVALID_FINGERPRINT", "fingerprint"));
  } else if (record.fingerprint !== fingerprintRecord(record)) {
    errors.push(issue("FINGERPRINT_MISMATCH", "fingerprint"));
  }
  try {
    if (Buffer.byteLength(JSON.stringify(record), "utf8") > MAX_RECORD_BYTES) {
      errors.push(issue("RECORD_TOO_LARGE", "record"));
    }
  } catch {
    errors.push(issue("INVALID_SERIALIZATION", "record"));
  }
  return errors;
}

export function createValidationEvidenceV1(input) {
  if (!isPlainObject(input)) fail("VALIDATION_EVIDENCE_INVALID");
  if (
    Object.keys(input).some(
      (field) =>
        !CREATE_FIELDS.has(field) ||
        UNSAFE_FIELD_PATTERN.test(field) ||
        DANGEROUS_FIELDS.has(field),
    )
  ) {
    fail("VALIDATION_EVIDENCE_INVALID");
  }
  const record = {
    schemaVersion: 1,
    recordType: "ValidationEvidenceV1",
    headSha: input.headSha,
    baseSha: input.baseSha,
    workflowDigest: input.workflowDigest,
    result: input.result,
    complete: input.complete,
    durationMs: input.durationMs,
    recordedAt: input.recordedAt,
    revision: input.revision,
  };
  record.fingerprint = fingerprintRecord(record);
  if (validateValidationEvidenceV1(record).length > 0) fail("VALIDATION_EVIDENCE_INVALID");
  return record;
}

export function evaluateValidationEvidence(record, expectedKey) {
  if (validateValidationEvidenceV1(record).length > 0 || !keyValid(expectedKey)) {
    return { reusable: false, code: "INVALID_EVIDENCE" };
  }
  if (keyDigest(record) !== keyDigest(expectedKey)) {
    return { reusable: false, code: "STALE_EVIDENCE" };
  }
  if (record.complete !== true) return { reusable: false, code: "INCOMPLETE" };
  if (record.result !== "SUCCESS") {
    return { reusable: false, code: "RESULT_NOT_SUCCESS" };
  }
  return { reusable: true, code: "REUSABLE" };
}

function pathKey(value) {
  return path.resolve(value).replace(/[\\/]+$/u, "").toLowerCase();
}

function containedBy(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertPhysicalDirectory(directory, code) {
  const resolved = path.resolve(directory);
  if (!existsSync(resolved)) fail(code);
  const stats = lstatSync(resolved);
  if (!stats.isDirectory() || stats.isSymbolicLink()) fail(code);
  const physical = realpathSync.native(resolved);
  if (pathKey(physical) !== pathKey(resolved)) fail(code);
  return physical;
}

function assertSafeGitCommonDir(gitCommonDir) {
  if (typeof gitCommonDir !== "string" || !path.isAbsolute(gitCommonDir)) {
    fail("GIT_COMMON_DIR_INVALID");
  }
  return assertPhysicalDirectory(gitCommonDir, "GIT_COMMON_DIR_INVALID");
}

function registryDirectories(gitCommonDir) {
  const commonDir = assertSafeGitCommonDir(gitCommonDir);
  const root = path.join(commonDir, "talkpik-validation");
  const version = path.join(root, "v1");
  const evidence = path.join(version, "evidence");
  return { commonDir, root, version, evidence };
}

function assertExistingChain(commonDir, target) {
  if (!containedBy(commonDir, target)) fail("VALIDATION_REGISTRY_PATH_UNSAFE");
  const relative = path.relative(commonDir, target);
  let cursor = commonDir;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    if (!existsSync(cursor)) return false;
    const stats = lstatSync(cursor);
    if (stats.isSymbolicLink()) fail("VALIDATION_REGISTRY_PATH_UNSAFE");
    if (pathKey(realpathSync.native(cursor)) !== pathKey(cursor)) {
      fail("VALIDATION_REGISTRY_PATH_UNSAFE");
    }
  }
  return true;
}

function prepareRegistry(gitCommonDir) {
  const directories = registryDirectories(gitCommonDir);
  for (const directory of [
    directories.root,
    directories.version,
    directories.evidence,
  ]) {
    if (!containedBy(directories.commonDir, directory)) {
      fail("VALIDATION_REGISTRY_PATH_UNSAFE");
    }
    if (existsSync(directory)) {
      const stats = lstatSync(directory);
      if (!stats.isDirectory() || stats.isSymbolicLink()) {
        fail("VALIDATION_REGISTRY_PATH_UNSAFE");
      }
      if (pathKey(realpathSync.native(directory)) !== pathKey(directory)) {
        fail("VALIDATION_REGISTRY_PATH_UNSAFE");
      }
    } else {
      mkdirSync(directory);
    }
  }
  return directories;
}

export function validationEvidenceStoragePath(gitCommonDir, key) {
  const directories = registryDirectories(gitCommonDir);
  const target = path.join(directories.evidence, `${keyDigest(key)}.json`);
  if (!containedBy(directories.evidence, target)) fail("VALIDATION_REGISTRY_PATH_UNSAFE");
  return target;
}

function readJsonRecord(target) {
  if (!existsSync(target)) fail("VALIDATION_EVIDENCE_NOT_FOUND");
  const stats = lstatSync(target);
  if (!stats.isFile() || stats.isSymbolicLink()) fail("VALIDATION_REGISTRY_PATH_UNSAFE");
  if (stats.size > MAX_RECORD_BYTES) fail("VALIDATION_EVIDENCE_INVALID");
  let record;
  try {
    record = JSON.parse(readFileSync(target, "utf8"));
  } catch {
    fail("VALIDATION_EVIDENCE_INVALID");
  }
  if (validateValidationEvidenceV1(record).length > 0) fail("VALIDATION_EVIDENCE_INVALID");
  return record;
}

export function readValidationEvidence({
  gitCommonDir,
  headSha,
  baseSha,
  workflowDigest,
}) {
  const directories = registryDirectories(gitCommonDir);
  if (!assertExistingChain(directories.commonDir, directories.evidence)) {
    fail("VALIDATION_EVIDENCE_NOT_FOUND");
  }
  const key = { headSha, baseSha, workflowDigest };
  const target = validationEvidenceStoragePath(gitCommonDir, key);
  const record = readJsonRecord(target);
  if (keyDigest(record) !== keyDigest(key)) fail("VALIDATION_EVIDENCE_STALE");
  return record;
}

function atomicWriteJson(target, record) {
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(record, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    renameSync(temporary, target);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

function withEvidenceLock(target, callback) {
  const lockPath = `${target}.lock`;
  let descriptor;
  try {
    descriptor = openSync(lockPath, "wx", 0o600);
  } catch {
    fail("VALIDATION_EVIDENCE_LOCKED");
  }
  try {
    return callback();
  } finally {
    closeSync(descriptor);
    if (existsSync(lockPath)) unlinkSync(lockPath);
  }
}

export function writeValidationEvidence({
  gitCommonDir,
  record,
  expectedFingerprint = null,
}) {
  if (validateValidationEvidenceV1(record).length > 0) fail("VALIDATION_EVIDENCE_INVALID");
  if (expectedFingerprint !== null && !DIGEST_PATTERN.test(expectedFingerprint)) {
    fail("VALIDATION_EVIDENCE_STALE");
  }
  const directories = prepareRegistry(gitCommonDir);
  const target = validationEvidenceStoragePath(directories.commonDir, record);
  return withEvidenceLock(target, () => {
    if (existsSync(target)) {
      const existing = readJsonRecord(target);
      if (expectedFingerprint === null) fail("VALIDATION_EVIDENCE_EXISTS");
      if (existing.fingerprint !== expectedFingerprint) fail("VALIDATION_EVIDENCE_STALE");
      if (keyDigest(existing) !== keyDigest(record) || record.revision !== existing.revision + 1) {
        fail("VALIDATION_EVIDENCE_STALE");
      }
    } else if (expectedFingerprint !== null || record.revision !== 1) {
      fail("VALIDATION_EVIDENCE_STALE");
    }
    atomicWriteJson(target, record);
    return target;
  });
}

export function listValidationEvidence({ gitCommonDir }) {
  const directories = registryDirectories(gitCommonDir);
  if (!assertExistingChain(directories.commonDir, directories.evidence)) return [];
  return readdirSync(directories.evidence)
    .filter((name) => /^[a-f0-9]{64}\.json$/u.test(name))
    .sort()
    .map((name) => {
      const target = path.join(directories.evidence, name);
      const record = readJsonRecord(target);
      if (`${keyDigest(record)}.json` !== name) fail("VALIDATION_EVIDENCE_STALE");
      return record;
    });
}

function approvedWorkflow(workflowId) {
  const workflow = APPROVED_WORKFLOWS.get(workflowId);
  if (workflow === undefined) fail("VALIDATION_WORKFLOW_NOT_APPROVED");
  return workflow;
}

export function getApprovedValidationWorkflowDefinition(workflowId) {
  return structuredClone(approvedWorkflow(workflowId));
}

function readWorkflowDigestFile(repoPath, relativePath) {
  if (
    typeof relativePath !== "string" ||
    path.isAbsolute(relativePath) ||
    relativePath.includes("\0")
  ) {
    fail("VALIDATION_WORKFLOW_FILE_UNSAFE");
  }
  const target = path.resolve(repoPath, relativePath);
  if (!containedBy(repoPath, target)) fail("VALIDATION_WORKFLOW_FILE_UNSAFE");
  if (!assertExistingChain(repoPath, target)) fail("VALIDATION_WORKFLOW_FILE_MISSING");
  const stats = lstatSync(target);
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size > MAX_WORKFLOW_FILE_BYTES) {
    fail("VALIDATION_WORKFLOW_FILE_UNSAFE");
  }
  if (pathKey(realpathSync.native(target)) !== pathKey(target)) {
    fail("VALIDATION_WORKFLOW_FILE_UNSAFE");
  }
  return sha256(readFileSync(target));
}

export function computeApprovedWorkflowDigest({ repoPath, workflowId }) {
  if (typeof repoPath !== "string") fail("REPOSITORY_REQUIRED");
  const root = assertPhysicalDirectory(path.resolve(repoPath), "REPOSITORY_REQUIRED");
  const workflow = approvedWorkflow(workflowId);
  const files = workflow.digestFiles
    .map((relativePath) => ({
      path: relativePath.replaceAll("\\", "/"),
      digest: readWorkflowDigestFile(root, relativePath),
    }))
    .sort((first, second) => first.path.localeCompare(second.path));
  return sha256(
    JSON.stringify(
      stableValue({
        schemaVersion: 1,
        workflow: {
          id: workflow.id,
          baseRef: workflow.baseRef,
          steps: workflow.steps,
        },
        files,
      }),
    ),
  );
}

export function sanitizedGitEnvironment(source = process.env) {
  const environment = {};
  for (const [key, value] of Object.entries(source)) {
    if (!/^GIT_/iu.test(key) && value !== undefined) environment[key] = value;
  }
  environment.GIT_TERMINAL_PROMPT = "0";
  return environment;
}

export function resolveGitCommonDir({ repoPath, spawn = spawnSync }) {
  if (typeof repoPath !== "string" || !path.isAbsolute(path.resolve(repoPath))) {
    fail("REPOSITORY_REQUIRED");
  }
  const resolvedRepo = assertPhysicalDirectory(path.resolve(repoPath), "REPOSITORY_REQUIRED");
  const result = spawn(
    "git",
    ["-C", resolvedRepo, "rev-parse", "--git-common-dir"],
    {
      encoding: "utf8",
      env: sanitizedGitEnvironment(),
      maxBuffer: 1024 * 1024,
      shell: false,
      timeout: 20_000,
      windowsHide: true,
    },
  );
  if (result?.status !== 0) fail("REPOSITORY_REQUIRED");
  const raw = String(result.stdout ?? "").trim();
  if (raw.length === 0 || raw.includes("\0") || /[\r\n]/u.test(raw)) {
    fail("GIT_COMMON_DIR_INVALID");
  }
  const commonDir = path.isAbsolute(raw) ? raw : path.resolve(resolvedRepo, raw);
  return assertSafeGitCommonDir(commonDir);
}

function runGit(repoPath, args, spawn) {
  const result = spawn("git", ["-C", repoPath, ...args], {
    encoding: "utf8",
    env: sanitizedGitEnvironment(),
    maxBuffer: 1024 * 1024,
    shell: false,
    timeout: 20_000,
    windowsHide: true,
  });
  if (result?.status !== 0) fail("VALIDATION_GIT_CONTEXT_UNAVAILABLE");
  return String(result.stdout ?? "").trim();
}

function readValidationContext({ repoPath, workflowId, spawn, requireClean }) {
  const workflow = approvedWorkflow(workflowId);
  const headSha = runGit(repoPath, ["rev-parse", "--verify", "HEAD^{commit}"], spawn);
  const baseSha = runGit(
    repoPath,
    ["rev-parse", "--verify", `${workflow.baseRef}^{commit}`],
    spawn,
  );
  if (!SHA_PATTERN.test(headSha) || !SHA_PATTERN.test(baseSha)) {
    fail("VALIDATION_GIT_CONTEXT_UNAVAILABLE");
  }
  const dirty =
    runGit(repoPath, ["status", "--porcelain=v1", "--untracked-files=all"], spawn).length > 0;
  if (requireClean && dirty) fail("VALIDATION_WORKTREE_DIRTY");
  return {
    headSha,
    baseSha,
    workflowDigest: computeApprovedWorkflowDigest({ repoPath, workflowId }),
    dirty,
  };
}

function defaultValidationCommandRunner(command, args, options) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: sanitizedGitEnvironment(),
    shell: false,
    stdio: "inherit",
    timeout: options.timeoutMs,
    windowsHide: true,
  });
  return { status: result.status ?? 1 };
}

function sameValidationContext(first, second) {
  return (
    second !== null &&
    second.dirty === false &&
    first.headSha === second.headSha &&
    first.baseSha === second.baseSha &&
    first.workflowDigest === second.workflowDigest
  );
}

const APPROVED_RECORDER_FIELDS = new Set([
  "repoPath",
  "workflowId",
  "now",
  "monotonicNow",
  "spawn",
  "commandRunner",
]);

export function recordApprovedValidationEvidence(options) {
  if (
    !isPlainObject(options) ||
    Object.keys(options).some((field) => !APPROVED_RECORDER_FIELDS.has(field))
  ) {
    fail("VALIDATION_RECORDER_INPUT_INVALID");
  }
  const {
    repoPath,
    workflowId,
    now = () => new Date(),
    monotonicNow = () => performance.now(),
    spawn = spawnSync,
    commandRunner = defaultValidationCommandRunner,
  } = options;
  if (
    typeof repoPath !== "string" ||
    typeof workflowId !== "string" ||
    typeof now !== "function" ||
    typeof monotonicNow !== "function" ||
    typeof spawn !== "function" ||
    typeof commandRunner !== "function"
  ) {
    fail("VALIDATION_RECORDER_INPUT_INVALID");
  }
  const resolvedRepo = assertPhysicalDirectory(path.resolve(repoPath), "REPOSITORY_REQUIRED");
  const workflow = approvedWorkflow(workflowId);
  const gitCommonDir = resolveGitCommonDir({ repoPath: resolvedRepo, spawn });
  const initial = readValidationContext({
    repoPath: resolvedRepo,
    workflowId,
    spawn,
    requireClean: true,
  });
  const startedAt = monotonicNow();
  let attemptedSteps = 0;
  let commandsPassed = true;
  for (const step of workflow.steps) {
    attemptedSteps += 1;
    let result;
    try {
      result = commandRunner(step.command, [...step.args], {
        cwd: resolvedRepo,
        shell: false,
        timeoutMs: step.timeoutMs,
      });
    } catch {
      result = { status: 1 };
    }
    if (!isPlainObject(result) || !Number.isInteger(result.status) || result.status !== 0) {
      commandsPassed = false;
      break;
    }
  }
  const finishedAt = monotonicNow();
  let finalContext = null;
  try {
    finalContext = readValidationContext({
      repoPath: resolvedRepo,
      workflowId,
      spawn,
      requireClean: false,
    });
  } catch {
    finalContext = null;
  }
  const contextStable = sameValidationContext(initial, finalContext);
  const complete = attemptedSteps === workflow.steps.length && contextStable;
  const rawDuration = finishedAt - startedAt;
  const durationMs =
    Number.isFinite(rawDuration) && rawDuration >= 0
      ? Math.min(MAX_DURATION_MS, Math.round(rawDuration))
      : 0;
  let existing = null;
  try {
    existing = readValidationEvidence({
      gitCommonDir,
      headSha: initial.headSha,
      baseSha: initial.baseSha,
      workflowDigest: initial.workflowDigest,
    });
  } catch (error) {
    if (
      !(error instanceof ValidationEvidenceError) ||
      error.code !== "VALIDATION_EVIDENCE_NOT_FOUND"
    ) {
      throw error;
    }
  }
  const record = createValidationEvidenceV1({
    headSha: initial.headSha,
    baseSha: initial.baseSha,
    workflowDigest: initial.workflowDigest,
    result: commandsPassed && complete ? "SUCCESS" : "FAILED",
    complete,
    durationMs,
    recordedAt: now().toISOString(),
    revision: existing === null ? 1 : existing.revision + 1,
  });
  writeValidationEvidence({
    gitCommonDir,
    record,
    expectedFingerprint: existing?.fingerprint ?? null,
  });
  return record;
}

export function checkApprovedValidationEvidence({
  repoPath,
  workflowId,
  spawn = spawnSync,
}) {
  const resolvedRepo = assertPhysicalDirectory(path.resolve(repoPath), "REPOSITORY_REQUIRED");
  const gitCommonDir = resolveGitCommonDir({ repoPath: resolvedRepo, spawn });
  const context = readValidationContext({
    repoPath: resolvedRepo,
    workflowId,
    spawn,
    requireClean: true,
  });
  return checkValidationEvidence({ gitCommonDir, ...context });
}

export function checkValidationEvidence({
  gitCommonDir = null,
  repoPath = null,
  headSha,
  baseSha,
  workflowDigest,
  spawn = spawnSync,
}) {
  const commonDir =
    gitCommonDir ?? resolveGitCommonDir({ repoPath: path.resolve(repoPath), spawn });
  try {
    const record = readValidationEvidence({
      gitCommonDir: commonDir,
      headSha,
      baseSha,
      workflowDigest,
    });
    return evaluateValidationEvidence(record, { headSha, baseSha, workflowDigest });
  } catch (error) {
    if (error instanceof ValidationEvidenceError &&
        error.code === "VALIDATION_EVIDENCE_NOT_FOUND") {
      return { reusable: false, code: "NOT_FOUND" };
    }
    throw error;
  }
}

function parseArguments(argv) {
  const [action, ...rest] = argv;
  if (!new Set(["record", "check", "status"]).has(action)) fail("CLI_ACTION_INVALID");
  const allowed = new Set(["repo", "workflow"]);
  const values = {};
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (!/^--[a-z-]+$/u.test(flag ?? "") || value === undefined) fail("CLI_ARGUMENT_INVALID");
    const key = flag.slice(2);
    if (!allowed.has(key) || Object.hasOwn(values, key)) fail("CLI_ARGUMENT_INVALID");
    values[key] = value;
  }
  const required = action === "status" ? ["repo"] : ["repo", "workflow"];
  if (Object.keys(values).some((key) => !required.includes(key)) ||
      required.some((key) => !Object.hasOwn(values, key))) {
    fail("CLI_ARGUMENT_INVALID");
  }
  if (values.workflow !== undefined) approvedWorkflow(values.workflow);
  return { action, values };
}

function safeSummary(record) {
  return {
    fingerprint: record.fingerprint,
    keyDigest: keyDigest(record),
    result: record.result,
    complete: record.complete,
    durationMs: record.durationMs,
    recordedAt: record.recordedAt,
    revision: record.revision,
  };
}

export function runValidationEvidenceCli(
  argv,
  {
    spawn = spawnSync,
    now = () => new Date(),
    monotonicNow = () => performance.now(),
    commandRunner = defaultValidationCommandRunner,
    stdout = (line) => process.stdout.write(`${line}\n`),
    stderr = (line) => process.stderr.write(`${line}\n`),
  } = {},
) {
  try {
    const { action, values } = parseArguments(argv);
    if (action === "record") {
      const record = recordApprovedValidationEvidence({
        repoPath: path.resolve(values.repo),
        workflowId: values.workflow,
        now,
        monotonicNow,
        spawn,
        commandRunner,
      });
      stdout(JSON.stringify({ action, ...safeSummary(record) }));
      return record.result === "SUCCESS" && record.complete ? 0 : 2;
    }
    const gitCommonDir = resolveGitCommonDir({
      repoPath: path.resolve(values.repo),
      spawn,
    });
    if (action === "check") {
      const result = checkApprovedValidationEvidence({
        repoPath: path.resolve(values.repo),
        workflowId: values.workflow,
        spawn,
      });
      stdout(JSON.stringify({ action, ...result }));
      return result.reusable ? 0 : 2;
    }
    const evidence = listValidationEvidence({ gitCommonDir }).map(safeSummary);
    stdout(JSON.stringify({ action, count: evidence.length, evidence }));
    return 0;
  } catch (error) {
    const code =
      error instanceof ValidationEvidenceError ? error.code : "VALIDATION_EVIDENCE_INTERNAL_ERROR";
    stderr(code);
    return 1;
  }
}
