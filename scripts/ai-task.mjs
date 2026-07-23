#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  acceptTaskHandoff,
  createFinishReport,
  offerTaskHandoff,
  parseTaskBranch,
  readLegacyCodexHints,
  readTaskStatus,
  refreshTaskHandoff,
  resumeTask,
  startTask,
} from "./lib/ai-task-lifecycle-v2.mjs";
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
import { pathToFileURL } from "node:url";
import {
  cleanupTask,
  finalizeTask,
  registerTaskRuntime,
} from "./lib/ai-task-cleanup.mjs";

const COMMANDS = new Set([
  "start",
  "status",
  "handoff",
  "resume",
  "runtime",
  "finalize",
  "cleanup",
  "finish",
  "metrics",
]);
const VALUE_FLAGS = new Set([
  "repo",
  "branch",
  "actor",
  "to",
  "now",
  "base-sha",
  "codex-home",
  "repo-id",
  "approval",
  "ports",
  "pids",
  "locks",
  "action",
  "context",
]);

function cliError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function parseArguments(argv) {
  const [command, ...tokens] = argv;
  if (!COMMANDS.has(command)) throw cliError("TASK_COMMAND_REQUIRED");
  const values = {};
  for (let index = 0; index < tokens.length; index += 2) {
    const flag = tokens[index];
    const value = tokens[index + 1];
    if (!flag?.startsWith("--") || value === undefined || value.startsWith("--")) {
      throw cliError("INVALID_TASK_ARGUMENTS");
    }
    const name = flag.slice(2);
    if (!VALUE_FLAGS.has(name) || Object.hasOwn(values, name)) {
      throw cliError("INVALID_TASK_ARGUMENTS");
    }
    values[name] = value;
  }
  if (!values.repo || !values.branch) throw cliError("TASK_REPO_AND_BRANCH_REQUIRED");
  return { command, values };
}

function required(values, name) {
  if (!values[name]) throw cliError(`TASK_${name.replaceAll("-", "_").toUpperCase()}_REQUIRED`);
  return values[name];
}

function commaList(value) {
  return typeof value === "string" && value.length > 0
    ? value.split(",").map((entry) => entry.trim()).filter(Boolean)
    : [];
}

function integerList(value, kind) {
  const values = commaList(value).map((entry) => Number(entry));
  if (values.some((entry) => !Number.isInteger(entry) || entry <= 0)) {
    throw cliError(`TASK_${kind}_INVALID`);
  }
  return values;
}

function pathContains(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertNoLinkedAncestor(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw cliError("TASK_CONTEXT_PATH_ESCAPE");
  let cursor = path.resolve(root);
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    if (!existsSync(cursor)) throw cliError("TASK_CONTEXT_NOT_FOUND");
    if (lstatSync(cursor).isSymbolicLink()) throw cliError("TASK_CONTEXT_PATH_ESCAPE");
  }
}

function readHandoffContextFile(repoPath, branch, contextPath) {
  if (typeof contextPath !== "string" || !path.isAbsolute(contextPath)) {
    throw cliError("TASK_CONTEXT_REQUIRED");
  }
  const resolvedRepo = path.resolve(repoPath);
  const resolvedContext = path.resolve(contextPath);
  const { slug } = parseTaskBranch(branch);
  const allowedRoot = path.resolve(resolvedRepo, ".codex", "work", slug);
  const relative = path.relative(allowedRoot, resolvedContext);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw cliError("TASK_CONTEXT_LOCATION_INVALID");
  }
  assertNoLinkedAncestor(resolvedRepo, allowedRoot);
  assertNoLinkedAncestor(allowedRoot, resolvedContext);
  let stats;
  try {
    stats = lstatSync(resolvedContext);
  } catch {
    throw cliError("TASK_CONTEXT_NOT_FOUND");
  }
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size > 64 * 1024) {
    throw cliError("TASK_CONTEXT_INVALID");
  }
  const canonicalRepo = realpathSync.native(resolvedRepo);
  const canonicalAllowedRoot = realpathSync.native(allowedRoot);
  const canonicalContext = realpathSync.native(resolvedContext);
  if (!pathContains(canonicalRepo, canonicalAllowedRoot) || !pathContains(canonicalAllowedRoot, canonicalContext)) {
    throw cliError("TASK_CONTEXT_PATH_ESCAPE");
  }
  try {
    return JSON.parse(readFileSync(resolvedContext, "utf8"));
  } catch {
    throw cliError("TASK_CONTEXT_INVALID");
  }
}

async function runParsed({ command, values }) {
  const common = { repoPath: values.repo, branch: values.branch };
  const now = values.now ?? new Date().toISOString();
  if (command === "start") {
    return startTask({
      ...common,
      actor: required(values, "actor"),
      now,
      expectedBaseSha: values["base-sha"] ?? null,
    });
  }
  if (command === "status") {
    const status = readTaskStatus(common);
    const codexHome = values["codex-home"] ?? process.env.CODEX_HOME;
    const repoId = values["repo-id"];
    return {
      ...status,
      legacyHints:
        typeof codexHome === "string" && typeof repoId === "string"
          ? readLegacyCodexHints({ codexHome, repoId })
          : [],
    };
  }
  if (command === "metrics") return createTaskMetricsReport(common);
  if (command === "handoff") {
    const action = required(values, "action");
    if (action === "offer") {
      return offerTaskHandoff({
        ...common,
        actor: required(values, "actor"),
        toActor: required(values, "to"),
        context: readHandoffContextFile(values.repo, values.branch, required(values, "context")),
        now,
      });
    }
    if (action === "accept") {
      if (values.to || values.context) throw cliError("TASK_HANDOFF_ACCEPT_ARGUMENTS_INVALID");
      return acceptTaskHandoff({ ...common, actor: required(values, "actor"), now });
    }
    if (action === "refresh") {
      if (values.to) throw cliError("TASK_HANDOFF_REFRESH_ARGUMENTS_INVALID");
      return refreshTaskHandoff({
        ...common,
        actor: required(values, "actor"),
        context: readHandoffContextFile(values.repo, values.branch, required(values, "context")),
        now,
      });
    }
    throw cliError("TASK_HANDOFF_ACTION_INVALID");
  }
  if (command === "resume") {
    return resumeTask({ ...common, actor: required(values, "actor"), now });
  }
  if (command === "runtime") {
    return registerTaskRuntime({
      ...common,
      ports: integerList(values.ports, "PORTS"),
      pids: integerList(values.pids, "PIDS"),
      lockPaths: commaList(values.locks),
      now,
    });
  }
  if (command === "finish") {
    return createFinishReport({
      ...common,
      actor: required(values, "actor"),
      now,
    });
  }
  if (command === "finalize") return finalizeTask(common);
  return cleanupTask({
    ...common,
    approval: required(values, "approval"),
    now,
  });
}

const BUDGETS = Object.freeze({
  "lifecycle-fast": 30_000,
  setup: 180_000,
  "small-check": 120_000,
  "docs-ci": 60_000,
  "full-ci": 600_000,
  review: 300_000,
  publish: 120_000,
});

const PHASES = Object.freeze([
  "setup",
  "test",
  "typecheck",
  "lint",
  "build",
  "review",
  "ci",
  "lifecycle",
  "publish",
]);
const PHASE_SET = new Set(PHASES);
const SOURCES = new Set(["lifecycle", "wrapper"]);
const SCOPES = new Set(["task", "focused", "full", "docs", "pipeline"]);
const OPERATIONS = new Set([
  "start",
  "status",
  "handoff",
  "resume",
  "finish",
  "runtime",
  "finalize",
  "cleanup",
  "owner-auth",
  "measure",
]);
const LIFECYCLE_OPERATIONS = new Set([
  "start",
  "status",
  "handoff",
  "resume",
  "finish",
  "runtime",
  "finalize",
  "cleanup",
  "owner-auth",
]);
const RECORD_KEYS = new Set([
  "schemaVersion",
  "recordType",
  "spanId",
  "taskId",
  "branch",
  "source",
  "phase",
  "scope",
  "operation",
  "startedAt",
  "finishedAt",
  "durationMs",
  "status",
  "exitCode",
  "pid",
  "budgetProfile",
  "budgetMs",
  "exceeded",
  "fingerprint",
]);
const UNSAFE_KEY_PATTERN = /(authorization|cookie|credential|password|private.?key|secret|token|api.?key|thread.?id|session.?id|command|args?|environment|stdout|stderr)/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TASK_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BRANCH_PATTERN = /^(feat|fix|refactor|test|docs|chore|ci)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const MAX_RECORD_BYTES = 64 * 1024;

class TaskMetricError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function fail(code) {
  throw new TaskMetricError(code);
}

function canonicalPath(value) {
  const resolved = path.resolve(value);
  return existsSync(resolved) ? realpathSync.native(resolved) : resolved;
}

function samePath(first, second) {
  const left = canonicalPath(first).replace(/[\\/]+$/, "");
  const right = canonicalPath(second).replace(/[\\/]+$/, "");
  return process.platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right;
}

function metricPathContains(parent, child) {
  const relative = path.relative(canonicalPath(parent), canonicalPath(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertSafePathPlan(root, target) {
  const canonicalRoot = canonicalPath(root);
  const lexicalRoot = path.resolve(root);
  const lexicalTarget = path.resolve(target);
  const relative = path.relative(lexicalRoot, lexicalTarget);
  if (relative.startsWith("..") || path.isAbsolute(relative)) fail("TASK_METRIC_REGISTRY_PATH_ESCAPE");
  let cursor = lexicalRoot;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    if (!existsSync(cursor)) break;
    const stats = lstatSync(cursor);
    if (stats.isSymbolicLink()) fail("TASK_METRIC_REGISTRY_PATH_ESCAPE");
    if (!metricPathContains(canonicalRoot, realpathSync.native(cursor))) {
      fail("TASK_METRIC_REGISTRY_PATH_ESCAPE");
    }
  }
}

function metricPaths(task, spanId = null) {
  const root = path.join(task.gitCommonDir, "talkpik-task-lifecycle", "v2", "metrics");
  const taskDirectory = path.join(root, task.taskId);
  return {
    root,
    taskDirectory,
    recordFile: spanId === null ? null : path.join(taskDirectory, `${spanId}.json`),
  };
}

function prepareMetricDirectory(task) {
  const paths = metricPaths(task);
  for (const directory of [paths.root, paths.taskDirectory]) {
    assertSafePathPlan(task.gitCommonDir, directory);
    if (!existsSync(directory)) mkdirSync(directory);
    if (!lstatSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink()) {
      fail("TASK_METRIC_REGISTRY_PATH_ESCAPE");
    }
    assertSafePathPlan(task.gitCommonDir, directory);
  }
  return paths;
}

function metricFingerprint(record) {
  const payload = Object.fromEntries(Object.entries(record).filter(([key]) => key !== "fingerprint"));
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function fingerprinted(record) {
  const next = { ...record, fingerprint: "" };
  next.fingerprint = metricFingerprint(next);
  if (validateTaskMetricSpanV1(next).length > 0) fail("TASK_METRIC_RECORD_INVALID");
  return next;
}

function atomicWriteMetric(filePath, record, { createOnly = false } = {}) {
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`);
  try {
    writeFileSync(tempPath, `${JSON.stringify(record, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    if (createOnly && existsSync(filePath)) fail("TASK_METRIC_SPAN_EXISTS");
    renameSync(tempPath, filePath);
  } finally {
    if (existsSync(tempPath)) unlinkSync(tempPath);
  }
}

function withSpanLock(recordFile, callback) {
  const lockFile = `${recordFile}.lock`;
  let descriptor;
  try {
    descriptor = openSync(lockFile, "wx", 0o600);
  } catch (error) {
    if (error?.code === "EEXIST") fail("TASK_METRIC_SPAN_BUSY");
    throw error;
  }
  try {
    return callback();
  } finally {
    closeSync(descriptor);
    if (existsSync(lockFile)) unlinkSync(lockFile);
  }
}

function readMetric(filePath, expectedSpanId = null) {
  if (!existsSync(filePath)) fail("TASK_METRIC_SPAN_NOT_FOUND");
  const stats = lstatSync(filePath);
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size > MAX_RECORD_BYTES) {
    fail("TASK_METRIC_RECORD_INVALID");
  }
  let record;
  try {
    record = JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    fail("TASK_METRIC_RECORD_INVALID");
  }
  if (validateTaskMetricSpanV1(record).length > 0) fail("TASK_METRIC_RECORD_INVALID");
  if (metricFingerprint(record) !== record.fingerprint) fail("TASK_METRIC_FINGERPRINT_MISMATCH");
  if (expectedSpanId !== null && record.spanId !== expectedSpanId) fail("TASK_METRIC_SPAN_MISMATCH");
  return record;
}

export function assertTaskMetricContext({ repoPath, branch, actor = null, source = "wrapper" }) {
  if (source !== "wrapper" && source !== "lifecycle") fail("TASK_METRIC_SOURCE_INVALID");
  const status = readTaskStatus({ repoPath, branch });
  const task = status.task;
  if (task === null) fail("TASK_METRIC_TASK_NOT_FOUND");
  if (source === "wrapper") {
    if (task.state !== "ACTIVE") fail("TASK_METRIC_TASK_NOT_ACTIVE");
    if (actor !== task.activeActor) fail("TASK_METRIC_ACTOR_MISMATCH");
    if (!samePath(repoPath, task.worktreePath)) fail("TASK_METRIC_WORKTREE_REQUIRED");
  } else if (actor !== null) {
    const permittedActors = task.state === "ACTIVE"
      ? [task.activeActor]
      : task.state === "HANDOFF_PENDING"
        ? [task.handoffFromActor, task.pendingActor]
        : [];
    if (!permittedActors.includes(actor)) fail("TASK_METRIC_ACTOR_MISMATCH");
  }
  return structuredClone(task);
}

function validationError(code, path) {
  return { code, path };
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

function pushUnless(errors, condition, code, path) {
  if (!condition) errors.push(validationError(code, path));
}

export function budgetMsForProfile(profile) {
  if (!Object.hasOwn(BUDGETS, profile)) throw new TaskMetricError("TASK_METRIC_BUDGET_INVALID");
  return BUDGETS[profile];
}

export function validateTaskMetricSpanV1(record) {
  if (!isPlainObject(record)) return [validationError("INVALID_OBJECT", "record")];
  const errors = [];
  for (const key of Object.keys(record)) {
    if (!RECORD_KEYS.has(key)) errors.push(validationError("UNKNOWN_FIELD", key));
    if (UNSAFE_KEY_PATTERN.test(key) || ["__proto__", "prototype", "constructor"].includes(key)) {
      errors.push(validationError("SECRET_FIELD", key));
    }
  }
  try {
    if (Buffer.byteLength(JSON.stringify(record), "utf8") > MAX_RECORD_BYTES) {
      errors.push(validationError("RECORD_TOO_LARGE", "record"));
    }
  } catch {
    errors.push(validationError("INVALID_SERIALIZATION", "record"));
  }

  pushUnless(errors, record.schemaVersion === 1, "INVALID_SCHEMA_VERSION", "schemaVersion");
  pushUnless(errors, record.recordType === "TaskMetricSpanV1", "INVALID_RECORD_TYPE", "recordType");
  pushUnless(errors, UUID_PATTERN.test(record.spanId ?? ""), "INVALID_SPAN_ID", "spanId");
  pushUnless(errors, TASK_ID_PATTERN.test(record.taskId ?? ""), "INVALID_TASK_ID", "taskId");
  const branchMatch = BRANCH_PATTERN.exec(record.branch ?? "");
  pushUnless(errors, branchMatch !== null, "INVALID_BRANCH", "branch");
  if (branchMatch !== null) {
    pushUnless(
      errors,
      record.taskId === `${branchMatch[1]}-${branchMatch[2]}`,
      "TASK_ID_MISMATCH",
      "taskId",
    );
  }
  pushUnless(errors, SOURCES.has(record.source), "INVALID_SOURCE", "source");
  pushUnless(errors, PHASE_SET.has(record.phase), "INVALID_PHASE", "phase");
  pushUnless(errors, SCOPES.has(record.scope), "INVALID_SCOPE", "scope");
  pushUnless(errors, OPERATIONS.has(record.operation), "INVALID_OPERATION", "operation");
  if (record.source === "lifecycle") {
    pushUnless(
      errors,
      record.phase === "lifecycle" && record.scope === "task" && LIFECYCLE_OPERATIONS.has(record.operation),
      "INVALID_SOURCE_BOUNDARY",
      "source",
    );
  } else if (record.source === "wrapper") {
    pushUnless(
      errors,
      record.operation === "measure" && record.phase !== "lifecycle",
      "INVALID_SOURCE_BOUNDARY",
      "source",
    );
  }
  pushUnless(errors, validTimestamp(record.startedAt), "INVALID_TIMESTAMP", "startedAt");
  pushUnless(
    errors,
    Number.isSafeInteger(record.pid) && record.pid > 0,
    "INVALID_PID",
    "pid",
  );

  let expectedBudget = null;
  try {
    expectedBudget = budgetMsForProfile(record.budgetProfile);
  } catch {
    errors.push(validationError("INVALID_BUDGET_PROFILE", "budgetProfile"));
  }
  if (expectedBudget !== null) {
    pushUnless(errors, record.budgetMs === expectedBudget, "BUDGET_MISMATCH", "budgetMs");
  }
  pushUnless(errors, FINGERPRINT_PATTERN.test(record.fingerprint ?? ""), "INVALID_FINGERPRINT", "fingerprint");

  if (record.status === "RUNNING") {
    pushUnless(
      errors,
      record.finishedAt === null && record.durationMs === null && record.exitCode === null && record.exceeded === null,
      "INVALID_RUNNING_FIELDS",
      "status",
    );
  } else if (record.status === "PASSED" || record.status === "FAILED") {
    pushUnless(errors, validTimestamp(record.finishedAt), "INVALID_TIMESTAMP", "finishedAt");
    pushUnless(
      errors,
      Number.isSafeInteger(record.durationMs) && record.durationMs >= 0,
      "INVALID_DURATION",
      "durationMs",
    );
    if (record.status === "PASSED") {
      pushUnless(errors, record.exitCode === 0, "INVALID_EXIT_CODE", "exitCode");
    } else {
      pushUnless(
        errors,
        Number.isInteger(record.exitCode) && record.exitCode !== 0,
        "INVALID_EXIT_CODE",
        "exitCode",
      );
    }
    if (validTimestamp(record.startedAt) && validTimestamp(record.finishedAt)) {
      const expectedDuration = Date.parse(record.finishedAt) - Date.parse(record.startedAt);
      if (expectedDuration < 0) {
        errors.push(validationError("TIMESTAMP_REGRESSION", "finishedAt"));
      } else if (record.durationMs !== expectedDuration) {
        errors.push(validationError("DURATION_MISMATCH", "durationMs"));
      }
      if (expectedBudget !== null && record.exceeded !== expectedDuration > expectedBudget) {
        errors.push(validationError("EXCEEDED_MISMATCH", "exceeded"));
      }
    }
    pushUnless(errors, typeof record.exceeded === "boolean", "INVALID_EXCEEDED", "exceeded");
  } else {
    errors.push(validationError("INVALID_STATUS", "status"));
  }
  return errors;
}

function intervalUnionMs(intervals) {
  if (intervals.length === 0) return 0;
  const sorted = intervals
    .map(([start, end]) => [start, end])
    .sort(([left], [right]) => left - right);
  let [currentStart, currentEnd] = sorted[0];
  let total = 0;
  for (const [start, end] of sorted.slice(1)) {
    if (start <= currentEnd) {
      currentEnd = Math.max(currentEnd, end);
    } else {
      total += currentEnd - currentStart;
      currentStart = start;
      currentEnd = end;
    }
  }
  return total + currentEnd - currentStart;
}

export function summarizeTaskMetricSpans(spans) {
  if (!Array.isArray(spans) || spans.some((span) => validateTaskMetricSpanV1(span).length > 0)) {
    throw new TaskMetricError("TASK_METRIC_SPAN_INVALID");
  }
  if (new Set(spans.map(({ spanId }) => spanId)).size !== spans.length) {
    throw new TaskMetricError("TASK_METRIC_SPAN_DUPLICATE");
  }
  const completed = spans.filter(({ status }) => status !== "RUNNING");
  const intervals = completed.map(({ startedAt, finishedAt }) => [
    Date.parse(startedAt),
    Date.parse(finishedAt),
  ]);
  const commandTotalMs = completed.reduce((total, { durationMs }) => total + durationMs, 0);
  const measuredWallMs = intervalUnionMs(intervals);
  const byPhase = PHASES.flatMap((phase) => {
    const attempts = spans.filter((span) => span.phase === phase);
    if (attempts.length === 0) return [];
    const completedAttempts = attempts.filter(({ status }) => status !== "RUNNING");
    const phaseIntervals = completedAttempts.map(({ startedAt, finishedAt }) => [
      Date.parse(startedAt),
      Date.parse(finishedAt),
    ]);
    return [{
      phase,
      attempts: attempts.length,
      completed: completedAttempts.length,
      failures: completedAttempts.filter(({ status }) => status === "FAILED").length,
      exceeded: completedAttempts.filter(({ exceeded }) => exceeded).length,
      totalMs: completedAttempts.reduce((total, { durationMs }) => total + durationMs, 0),
      measuredWallMs: intervalUnionMs(phaseIntervals),
    }];
  });
  return {
    commandTotalMs,
    measuredWallMs,
    overlapMs: commandTotalMs - measuredWallMs,
    counts: {
      total: spans.length,
      completed: completed.length,
      incomplete: spans.length - completed.length,
      passed: completed.filter(({ status }) => status === "PASSED").length,
      failed: completed.filter(({ status }) => status === "FAILED").length,
      exceeded: completed.filter(({ exceeded }) => exceeded).length,
    },
    byPhase,
  };
}

function buildMetricRecord({
  task,
  spanId = randomUUID(),
  source,
  phase,
  scope,
  operation,
  startedAt,
  finishedAt = null,
  exitCode = null,
  pid = process.pid,
  budgetProfile,
}) {
  const durationMs = finishedAt === null ? null : Date.parse(finishedAt) - Date.parse(startedAt);
  const budgetMs = budgetMsForProfile(budgetProfile);
  return fingerprinted({
    schemaVersion: 1,
    recordType: "TaskMetricSpanV1",
    spanId,
    taskId: task.taskId,
    branch: task.branch,
    source,
    phase,
    scope,
    operation,
    startedAt,
    finishedAt,
    durationMs,
    status: finishedAt === null ? "RUNNING" : exitCode === 0 ? "PASSED" : "FAILED",
    exitCode,
    pid,
    budgetProfile,
    budgetMs,
    exceeded: finishedAt === null ? null : durationMs > budgetMs,
    fingerprint: "",
  });
}

export function startTaskMetricSpan({
  repoPath,
  branch,
  actor,
  phase,
  scope,
  budgetProfile,
  now = new Date().toISOString(),
  pid = process.pid,
}) {
  const task = assertTaskMetricContext({ repoPath, branch, actor, source: "wrapper" });
  const record = buildMetricRecord({
    task,
    source: "wrapper",
    phase,
    scope,
    operation: "measure",
    startedAt: now,
    pid,
    budgetProfile,
  });
  const paths = prepareMetricDirectory(task);
  const recordFile = path.join(paths.taskDirectory, `${record.spanId}.json`);
  assertSafePathPlan(task.gitCommonDir, recordFile);
  atomicWriteMetric(recordFile, record, { createOnly: true });
  return structuredClone(record);
}

export function finishTaskMetricSpan({
  repoPath,
  branch,
  actor,
  spanId,
  now = new Date().toISOString(),
  exitCode,
}) {
  if (!UUID_PATTERN.test(spanId ?? "")) fail("TASK_METRIC_SPAN_ID_INVALID");
  if (!Number.isInteger(exitCode)) fail("TASK_METRIC_EXIT_CODE_INVALID");
  const task = assertTaskMetricContext({ repoPath, branch, actor, source: "wrapper" });
  const paths = metricPaths(task, spanId);
  assertSafePathPlan(task.gitCommonDir, paths.recordFile);
  return withSpanLock(paths.recordFile, () => {
    const running = readMetric(paths.recordFile, spanId);
    if (
      running.status !== "RUNNING" ||
      running.taskId !== task.taskId ||
      running.branch !== task.branch ||
      running.source !== "wrapper"
    ) {
      fail("TASK_METRIC_SPAN_NOT_RUNNING");
    }
    const finished = buildMetricRecord({
      task,
      spanId,
      source: running.source,
      phase: running.phase,
      scope: running.scope,
      operation: running.operation,
      startedAt: running.startedAt,
      finishedAt: now,
      exitCode,
      pid: running.pid,
      budgetProfile: running.budgetProfile,
    });
    atomicWriteMetric(paths.recordFile, finished);
    return structuredClone(finished);
  });
}

export function startLifecycleTaskMetricSpan({
  repoPath,
  branch,
  actor,
  operation,
  now = new Date().toISOString(),
  pid = process.pid,
}) {
  if (typeof actor !== "string" || actor.length === 0) fail("TASK_METRIC_ACTOR_REQUIRED");
  const task = assertTaskMetricContext({ repoPath, branch, actor, source: "lifecycle" });
  const record = buildMetricRecord({
    task,
    source: "lifecycle",
    phase: "lifecycle",
    scope: "task",
    operation,
    startedAt: now,
    pid,
    budgetProfile: "lifecycle-fast",
  });
  const paths = prepareMetricDirectory(task);
  const recordFile = path.join(paths.taskDirectory, `${record.spanId}.json`);
  assertSafePathPlan(task.gitCommonDir, recordFile);
  atomicWriteMetric(recordFile, record, { createOnly: true });
  return structuredClone(record);
}

export function finishLifecycleTaskMetricSpan({
  repoPath,
  branch,
  spanId,
  now = new Date().toISOString(),
  exitCode,
}) {
  if (!UUID_PATTERN.test(spanId ?? "")) fail("TASK_METRIC_SPAN_ID_INVALID");
  if (!Number.isInteger(exitCode)) fail("TASK_METRIC_EXIT_CODE_INVALID");
  const task = assertTaskMetricContext({ repoPath, branch, source: "lifecycle" });
  const paths = metricPaths(task, spanId);
  assertSafePathPlan(task.gitCommonDir, paths.recordFile);
  return withSpanLock(paths.recordFile, () => {
    const running = readMetric(paths.recordFile, spanId);
    if (
      running.status !== "RUNNING" ||
      running.taskId !== task.taskId ||
      running.branch !== task.branch ||
      running.source !== "lifecycle"
    ) {
      fail("TASK_METRIC_SPAN_NOT_RUNNING");
    }
    const finished = buildMetricRecord({
      task,
      spanId,
      source: running.source,
      phase: running.phase,
      scope: running.scope,
      operation: running.operation,
      startedAt: running.startedAt,
      finishedAt: now,
      exitCode,
      pid: running.pid,
      budgetProfile: running.budgetProfile,
    });
    atomicWriteMetric(paths.recordFile, finished);
    return structuredClone(finished);
  });
}

export function recordCompletedTaskMetric({
  repoPath,
  branch,
  actor,
  source = "lifecycle",
  phase = "lifecycle",
  scope = "task",
  operation,
  budgetProfile = "lifecycle-fast",
  startedAt,
  finishedAt,
  exitCode,
  pid = process.pid,
}) {
  if (source !== "lifecycle") fail("TASK_METRIC_SOURCE_INVALID");
  if (!Number.isInteger(exitCode)) fail("TASK_METRIC_EXIT_CODE_INVALID");
  if (typeof actor !== "string" || actor.length === 0) fail("TASK_METRIC_ACTOR_REQUIRED");
  const task = assertTaskMetricContext({ repoPath, branch, actor, source });
  const record = buildMetricRecord({
    task,
    source,
    phase,
    scope,
    operation,
    startedAt,
    finishedAt,
    exitCode,
    pid,
    budgetProfile,
  });
  const paths = prepareMetricDirectory(task);
  const recordFile = path.join(paths.taskDirectory, `${record.spanId}.json`);
  assertSafePathPlan(task.gitCommonDir, recordFile);
  atomicWriteMetric(recordFile, record, { createOnly: true });
  return structuredClone(record);
}

export function createTaskMetricsReport({ repoPath, branch }) {
  const task = assertTaskMetricContext({ repoPath, branch, source: "lifecycle" });
  const paths = metricPaths(task);
  assertSafePathPlan(task.gitCommonDir, paths.taskDirectory);
  let spans = [];
  if (existsSync(paths.taskDirectory)) {
    if (!lstatSync(paths.taskDirectory).isDirectory() || lstatSync(paths.taskDirectory).isSymbolicLink()) {
      fail("TASK_METRIC_REGISTRY_PATH_ESCAPE");
    }
    spans = readdirSync(paths.taskDirectory, { withFileTypes: true })
      .filter((entry) => entry.name.endsWith(".json"))
      .map((entry) => {
        const spanId = entry.name.slice(0, -5);
        if (!entry.isFile() || !UUID_PATTERN.test(spanId)) fail("TASK_METRIC_RECORD_INVALID");
        const record = readMetric(path.join(paths.taskDirectory, entry.name), spanId);
        if (record.taskId !== task.taskId || record.branch !== task.branch) {
          fail("TASK_METRIC_TASK_MISMATCH");
        }
        return record;
      });
  }
  const summary = summarizeTaskMetricSpans(spans);
  return {
    command: "task:metrics",
    reportOnly: true,
    taskId: task.taskId,
    branch: task.branch,
    ...summary,
  };
}


const MEASURE_PHASES = new Set(["setup", "test", "typecheck", "lint", "build", "review", "ci", "publish"]);
const MEASURE_SCOPES = new Set(["task", "focused", "full", "docs", "pipeline"]);
const MEASURE_FLAGS = new Set(["repo", "branch", "actor", "phase", "scope", "budget"]);
const WINDOWS_NODE_SHIMS = Object.freeze({
  pnpm: [
    ["node_modules", "pnpm", "bin", "pnpm.cjs"],
    ["node_modules", "corepack", "dist", "pnpm.js"],
  ],
  pnpx: [
    ["node_modules", "pnpm", "bin", "pnpx.cjs"],
    ["node_modules", "corepack", "dist", "pnpx.js"],
  ],
  npm: [
    ["node_modules", "npm", "bin", "npm-cli.js"],
    ["node_modules", "corepack", "dist", "npm.js"],
  ],
  npx: [
    ["node_modules", "npm", "bin", "npx-cli.js"],
    ["node_modules", "corepack", "dist", "npx.js"],
  ],
  corepack: [["node_modules", "corepack", "dist", "corepack.js"]],
  yarn: [["node_modules", "corepack", "dist", "yarn.js"]],
  yarnpkg: [["node_modules", "corepack", "dist", "yarnpkg.js"]],
});

function safeCode(error, fallback = "TASK_MEASURE_FAILED") {
  const code = typeof error?.code === "string" ? error.code : error?.message;
  return typeof code === "string" && /^[A-Z][A-Z0-9_:.-]*$/u.test(code) ? code : fallback;
}

function parseMeasureArguments(argv) {
  const tokens = argv[0] === "--" ? argv.slice(1) : argv;
  const delimiter = tokens.indexOf("--");
  if (delimiter < 0 || delimiter === tokens.length - 1) throw cliError("TASK_MEASURE_COMMAND_REQUIRED");
  const optionTokens = tokens.slice(0, delimiter);
  if (optionTokens.length % 2 !== 0) throw cliError("TASK_MEASURE_ARGUMENTS_INVALID");
  const values = {};
  for (let index = 0; index < optionTokens.length; index += 2) {
    const flag = optionTokens[index];
    const value = optionTokens[index + 1];
    if (!flag?.startsWith("--") || value === undefined || value.startsWith("--")) {
      throw cliError("TASK_MEASURE_ARGUMENTS_INVALID");
    }
    const name = flag.slice(2);
    if (!MEASURE_FLAGS.has(name) || Object.hasOwn(values, name)) throw cliError("TASK_MEASURE_ARGUMENTS_INVALID");
    values[name] = value;
  }
  if ([...MEASURE_FLAGS].some((name) => !values[name])) throw cliError("TASK_MEASURE_ARGUMENTS_REQUIRED");
  if (!MEASURE_PHASES.has(values.phase)) throw cliError("TASK_MEASURE_PHASE_INVALID");
  if (!MEASURE_SCOPES.has(values.scope)) throw cliError("TASK_MEASURE_SCOPE_INVALID");
  budgetMsForProfile(values.budget);
  return { values, command: tokens[delimiter + 1], args: tokens.slice(delimiter + 2) };
}

function writeWarning(code, writeStderr) {
  writeStderr(`${code}\n`);
}

function resolveChildCommand(command, args, repoPath) {
  if (process.platform !== "win32") return { command, args };
  const commandPath = path.isAbsolute(command) ? command : path.resolve(repoPath, command);
  const extension = path.extname(command).toLowerCase();
  if ([".exe", ".com"].includes(extension)) return { command, args };
  if ([".js", ".cjs", ".mjs"].includes(extension) && existsSync(commandPath)) {
    return { command: process.execPath, args: [realpathSync.native(commandPath), ...args] };
  }

  const hasDirectory = command.includes("\\") || command.includes("/");
  const commandDirectory = hasDirectory ? path.dirname(commandPath) : null;
  const shimName = path.basename(command).replace(/\.(?:cmd|bat|ps1)$/iu, "").toLowerCase();
  const relativeCandidates = WINDOWS_NODE_SHIMS[shimName];
  if (relativeCandidates === undefined) return { command, args };
  const pathDirectories = (process.env.PATH ?? process.env.Path ?? "")
    .split(path.delimiter)
    .map((entry) => entry.replace(/^"|"$/gu, ""))
    .filter(Boolean);
  const directories = [...new Set([
    repoPath,
    ...(commandDirectory === null ? [] : [commandDirectory]),
    path.dirname(process.execPath),
    ...pathDirectories,
  ].map((entry) => path.resolve(entry)))];
  for (const directory of directories) {
    for (const segments of relativeCandidates) {
      const candidate = path.join(directory, ...segments);
      if (!existsSync(candidate)) continue;
      const stats = lstatSync(candidate);
      if (!stats.isFile() || stats.isSymbolicLink()) continue;
      return { command: process.execPath, args: [realpathSync.native(candidate), ...args] };
    }
  }
  return { command, args };
}

export function runTaskMeasureCli({
  argv,
  commandRunner = spawnSync,
  now = () => new Date().toISOString(),
  writeStderr = (value) => process.stderr.write(value),
}) {
  let parsed;
  try {
    parsed = parseMeasureArguments(argv);
    assertTaskMetricContext({
      repoPath: parsed.values.repo,
      branch: parsed.values.branch,
      actor: parsed.values.actor,
      source: "wrapper",
    });
  } catch (error) {
    writeStderr(`${safeCode(error)}\n`);
    return 1;
  }

  const startedAt = now();
  let span = null;
  try {
    span = startTaskMetricSpan({
      repoPath: parsed.values.repo,
      branch: parsed.values.branch,
      actor: parsed.values.actor,
      phase: parsed.values.phase,
      scope: parsed.values.scope,
      budgetProfile: parsed.values.budget,
      now: startedAt,
    });
  } catch {
    writeWarning("TASK_METRIC_RECORDING_WARNING", writeStderr);
  }

  const child = resolveChildCommand(parsed.command, parsed.args, parsed.values.repo);
  const result = commandRunner(child.command, child.args, {
    cwd: parsed.values.repo,
    shell: false,
    stdio: "inherit",
    windowsHide: true,
  });
  const exitCode = Number.isInteger(result?.status) ? result.status : 1;
  if (span !== null) {
    try {
      const finished = finishTaskMetricSpan({
        repoPath: parsed.values.repo,
        branch: parsed.values.branch,
        actor: parsed.values.actor,
        spanId: span.spanId,
        now: now(),
        exitCode,
      });
      if (finished.exceeded) writeWarning("TASK_METRIC_BUDGET_EXCEEDED", writeStderr);
    } catch {
      writeWarning("TASK_METRIC_RECORDING_WARNING", writeStderr);
    }
  }
  if (result?.error) writeWarning("TASK_MEASURE_CHILD_START_FAILED", writeStderr);
  return exitCode;
}

function safeErrorCode(error) {
  return typeof error?.code === "string" && /^[A-Z0-9_:.-]+$/.test(error.code)
    ? error.code
    : typeof error?.message === "string" && /^[A-Z0-9_:.-]+$/.test(error.message)
      ? error.message
      : "TASK_COMMAND_FAILED";
}

function metricWarning() {
  process.stderr.write("TASK_METRIC_RECORDING_WARNING\n");
}

function isMetricContextError(error) {
  return new Set([
    "TASK_METRIC_ACTOR_MISMATCH",
    "TASK_METRIC_TASK_NOT_ACTIVE",
    "TASK_METRIC_TASK_NOT_FOUND",
    "TASK_METRIC_WORKTREE_REQUIRED",
  ]).has(error?.code ?? error?.message);
}

const aiTaskIsMain =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (aiTaskIsMain) {
  if (process.argv[2] === "measure") {
    process.exitCode = runTaskMeasureCli({ argv: process.argv.slice(3) });
  } else {
    let parsed;
    try {
      parsed = parseArguments(process.argv.slice(2));
    } catch (error) {
      process.stderr.write(`${safeErrorCode(error)}\n`);
      process.exitCode = 1;
    }

    if (parsed !== undefined) {
      const { command, values } = parsed;
      const metricStartedAt = new Date().toISOString();
      let lifecycleSpan = null;
      if (command === "resume") {
        process.stderr.write("TASK_RESUME_DEPRECATED_USE_HANDOFF_ACCEPT\n");
      }
      if (command !== "start" && command !== "metrics") {
        let status = null;
        try {
          status = readTaskStatus({ repoPath: values.repo, branch: values.branch });
        } catch {
          status = null;
        }
        if (status?.task) {
          const actor = values.actor ?? status.task?.activeActor ?? status.task?.handoffFromActor;
          try {
            lifecycleSpan = startLifecycleTaskMetricSpan({
              repoPath: values.repo,
              branch: values.branch,
              actor,
              operation: command,
              now: metricStartedAt,
            });
          } catch (error) {
            if (!isMetricContextError(error)) metricWarning();
          }
        }
      }

      try {
        const result = await runParsed(parsed);
        try {
          let metricResult = null;
          if (command === "start") {
            metricResult = recordCompletedTaskMetric({
              repoPath: values.repo,
              branch: values.branch,
              actor: values.actor,
              operation: "start",
              startedAt: metricStartedAt,
              finishedAt: new Date().toISOString(),
              exitCode: 0,
            });
          } else if (lifecycleSpan !== null) {
            metricResult = finishLifecycleTaskMetricSpan({
              repoPath: values.repo,
              branch: values.branch,
              spanId: lifecycleSpan.spanId,
              now: new Date().toISOString(),
              exitCode: 0,
            });
          }
          if (metricResult?.exceeded) process.stderr.write("TASK_METRIC_BUDGET_EXCEEDED\n");
        } catch {
          metricWarning();
        }
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } catch (error) {
        if (lifecycleSpan !== null) {
          try {
            const metricResult = finishLifecycleTaskMetricSpan({
              repoPath: values.repo,
              branch: values.branch,
              spanId: lifecycleSpan.spanId,
              now: new Date().toISOString(),
              exitCode: 1,
            });
            if (metricResult.exceeded) process.stderr.write("TASK_METRIC_BUDGET_EXCEEDED\n");
          } catch {
            metricWarning();
          }
        }
        process.stderr.write(`${safeErrorCode(error)}\n`);
        process.exitCode = 1;
      }
    }
  }
}
