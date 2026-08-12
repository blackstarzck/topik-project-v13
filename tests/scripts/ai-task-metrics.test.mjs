import { execFileSync, spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  budgetMsForProfile,
  createTaskMetricsReport,
  finishLifecycleTaskMetricSpan,
  finishTaskMetricSpan,
  recordCompletedTaskMetric,
  startLifecycleTaskMetricSpan,
  startTaskMetricSpan,
  summarizeTaskMetricSpans,
  validateTaskMetricSpanV1,
} from "../../scripts/ai-task.mjs";
import { offerTaskHandoff, startTask } from "../../scripts/lib/ai-task-lifecycle-v2.mjs";

const BASE = Object.freeze({
  schemaVersion: 1,
  recordType: "TaskMetricSpanV1",
  spanId: "00000000-0000-4000-8000-000000000001",
  taskId: "feat-ai-pipeline-metrics",
  branch: "feat/ai-pipeline-metrics",
  source: "wrapper",
  phase: "test",
  scope: "focused",
  operation: "measure",
  startedAt: "2026-07-22T00:00:00.000Z",
  finishedAt: null,
  durationMs: null,
  status: "RUNNING",
  exitCode: null,
  pid: 1234,
  budgetProfile: "small-check",
  budgetMs: 120_000,
  exceeded: null,
  fingerprint: "a".repeat(64),
});
const roots = [];

function git(cwd, args) {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function makeTask(branch = "feat/metrics-storage") {
  const root = mkdtempSync(path.join(tmpdir(), "talkpik-task-metrics-"));
  roots.push(root);
  const remote = path.join(root, "remote.git");
  const seed = path.join(root, "seed");
  const base = path.join(root, "base");
  execFileSync("git", ["init", "--bare", remote]);
  execFileSync("git", ["init", "-b", "main", seed]);
  git(seed, ["config", "user.email", "test@example.com"]);
  git(seed, ["config", "user.name", "Metrics Test"]);
  writeFileSync(path.join(seed, "README.md"), "baseline\n");
  git(seed, ["add", "README.md"]);
  git(seed, ["commit", "-m", "baseline"]);
  git(seed, ["remote", "add", "origin", remote]);
  git(seed, ["push", "-u", "origin", "main"]);
  execFileSync("git", ["clone", "--branch", "main", remote, base]);
  const task = startTask({
    repoPath: base,
    branch,
    actor: "codex",
    now: "2026-07-22T02:00:00.000Z",
  });
  return { base, task };
}

function metricFiles(task) {
  const directory = path.join(
    task.gitCommonDir,
    "talkpik-task-lifecycle",
    "v2",
    "metrics",
    task.taskId,
  );
  return (existsSync(directory) ? readdirSync(directory) : [])
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(directory, name));
}

function finishInProcess(task, spanId) {
  const moduleUrl = pathToFileURL(path.resolve(import.meta.dirname, "../../scripts/ai-task.mjs")).href;
  const source = `import(${JSON.stringify(moduleUrl)}).then(({ finishTaskMetricSpan }) => {` +
    `finishTaskMetricSpan(${JSON.stringify({
      repoPath: task.worktreePath,
      branch: task.branch,
      actor: "codex",
      spanId,
      now: "2026-07-22T02:02:00.000Z",
      exitCode: 0,
    })});` +
    `}).catch((error) => { process.stderr.write(String(error.code ?? error.message)); process.exitCode = 1; });`;
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["-e", source], {
      encoding: "utf8",
      shell: false,
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (status) => resolve({ status, stderr }));
  });
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function completed(overrides = {}) {
  const startedAt = overrides.startedAt ?? BASE.startedAt;
  const finishedAt = overrides.finishedAt ?? "2026-07-22T00:01:00.000Z";
  const durationMs = Date.parse(finishedAt) - Date.parse(startedAt);
  const budgetProfile = overrides.budgetProfile ?? BASE.budgetProfile;
  const budgetMs = budgetMsForProfile(budgetProfile);
  const status = overrides.status ?? "PASSED";
  return {
    ...BASE,
    ...overrides,
    startedAt,
    finishedAt,
    durationMs: overrides.durationMs ?? durationMs,
    status,
    exitCode: overrides.exitCode ?? (status === "PASSED" ? 0 : 1),
    budgetProfile,
    budgetMs: overrides.budgetMs ?? budgetMs,
    exceeded: overrides.exceeded ?? durationMs > budgetMs,
  };
}

function errorCodes(record) {
  return validateTaskMetricSpanV1(record).map(({ code, path }) => `${code}:${path}`);
}

describe("AI task metric span contract", () => {
  it("uses fixed non-blocking warning budgets", () => {
    expect(Object.fromEntries([
      "lifecycle-fast",
      "setup",
      "small-check",
      "docs-ci",
      "full-ci",
      "review",
      "publish",
    ].map((profile) => [profile, budgetMsForProfile(profile)]))).toEqual({
      "lifecycle-fast": 30_000,
      setup: 180_000,
      "small-check": 120_000,
      "docs-ci": 60_000,
      "full-ci": 600_000,
      review: 300_000,
      publish: 120_000,
    });
    expect(() => budgetMsForProfile("unbounded")).toThrowError("TASK_METRIC_BUDGET_INVALID");
  });

  it("accepts a closed RUNNING record without storing execution details", () => {
    expect(validateTaskMetricSpanV1(BASE)).toEqual([]);
    expect(errorCodes({ ...BASE, command: "pnpm test" })).toContain("UNKNOWN_FIELD:command");
    expect(errorCodes({ ...BASE, secretToken: "not-stored" })).toEqual(expect.arrayContaining([
      "UNKNOWN_FIELD:secretToken",
      "SECRET_FIELD:secretToken",
    ]));
    const polluted = JSON.parse(JSON.stringify(BASE));
    Object.defineProperty(polluted, "__proto__", { value: "polluted", enumerable: true });
    expect(errorCodes(polluted)).toEqual(expect.arrayContaining([
      "UNKNOWN_FIELD:__proto__",
      "SECRET_FIELD:__proto__",
    ]));
  });

  it("enforces completed status, timestamps, budgets, and duration consistency", () => {
    expect(validateTaskMetricSpanV1(completed())).toEqual([]);
    expect(validateTaskMetricSpanV1(completed({ status: "FAILED", exitCode: 7 }))).toEqual([]);
    expect(errorCodes({ ...BASE, finishedAt: BASE.startedAt })).toContain("INVALID_RUNNING_FIELDS:status");
    expect(errorCodes(completed({ status: "PASSED", exitCode: 2 }))).toContain("INVALID_EXIT_CODE:exitCode");
    expect(errorCodes(completed({ status: "FAILED", exitCode: 0 }))).toContain("INVALID_EXIT_CODE:exitCode");
    expect(errorCodes(completed({ durationMs: 59_999 }))).toContain("DURATION_MISMATCH:durationMs");
    expect(errorCodes(completed({ budgetMs: 60_000 }))).toContain("BUDGET_MISMATCH:budgetMs");
    expect(errorCodes(completed({ exceeded: true }))).toContain("EXCEEDED_MISMATCH:exceeded");
    expect(errorCodes(completed({ finishedAt: "2026-07-21T23:59:59.000Z" }))).toContain(
      "TIMESTAMP_REGRESSION:finishedAt",
    );
  });

  it("rejects invalid enums and lifecycle-wrapper boundary confusion", () => {
    expect(errorCodes({ ...BASE, phase: "implementation" })).toContain("INVALID_PHASE:phase");
    expect(errorCodes({ ...BASE, scope: "everything" })).toContain("INVALID_SCOPE:scope");
    expect(errorCodes({ ...BASE, operation: "pnpm-test" })).toContain("INVALID_OPERATION:operation");
    expect(errorCodes({ ...BASE, source: "lifecycle", phase: "test", operation: "start" })).toContain(
      "INVALID_SOURCE_BOUNDARY:source",
    );
    expect(errorCodes({ ...BASE, source: "wrapper", phase: "test", operation: "test" })).toContain(
      "INVALID_SOURCE_BOUNDARY:source",
    );
  });
});

describe("AI task metric interval summary", () => {
  it("separates summed command time from overlapping measured wall time", () => {
    const spans = [
      completed({
        spanId: "00000000-0000-4000-8000-000000000011",
        phase: "ci",
        scope: "full",
        startedAt: "2026-07-22T00:00:00.000Z",
        finishedAt: "2026-07-22T00:05:00.000Z",
        budgetProfile: "full-ci",
      }),
      completed({
        spanId: "00000000-0000-4000-8000-000000000012",
        phase: "ci",
        scope: "docs",
        startedAt: "2026-07-22T00:01:00.000Z",
        finishedAt: "2026-07-22T00:07:00.000Z",
        budgetProfile: "docs-ci",
      }),
      { ...BASE, spanId: "00000000-0000-4000-8000-000000000013" },
      completed({
        spanId: "00000000-0000-4000-8000-000000000014",
        phase: "build",
        scope: "full",
        startedAt: "2026-07-22T00:10:00.000Z",
        finishedAt: "2026-07-22T00:12:00.000Z",
        status: "FAILED",
        exitCode: 1,
      }),
    ];

    expect(summarizeTaskMetricSpans(spans)).toEqual({
      commandTotalMs: 780_000,
      measuredWallMs: 540_000,
      overlapMs: 240_000,
      counts: { total: 4, completed: 3, incomplete: 1, passed: 2, failed: 1, exceeded: 1 },
      byPhase: [
        {
          phase: "test",
          attempts: 1,
          completed: 0,
          failures: 0,
          exceeded: 0,
          totalMs: 0,
          measuredWallMs: 0,
        },
        {
          phase: "build",
          attempts: 1,
          completed: 1,
          failures: 1,
          exceeded: 0,
          totalMs: 120_000,
          measuredWallMs: 120_000,
        },
        {
          phase: "ci",
          attempts: 2,
          completed: 2,
          failures: 0,
          exceeded: 1,
          totalMs: 660_000,
          measuredWallMs: 420_000,
        },
      ],
    });
  });

  it("returns zeroes for no measurements and rejects invalid spans", () => {
    expect(summarizeTaskMetricSpans([])).toEqual({
      commandTotalMs: 0,
      measuredWallMs: 0,
      overlapMs: 0,
      counts: { total: 0, completed: 0, incomplete: 0, passed: 0, failed: 0, exceeded: 0 },
      byPhase: [],
    });
    expect(() => summarizeTaskMetricSpans([{ ...BASE, status: "BROKEN" }])).toThrowError(
      "TASK_METRIC_SPAN_INVALID",
    );
    expect(() => summarizeTaskMetricSpans([completed(), completed()])).toThrowError(
      "TASK_METRIC_SPAN_DUPLICATE",
    );
  });
});

describe("AI task metric registry", () => {
  it("persists a fingerprinted span and returns a read-only aggregate report", () => {
    const { task } = makeTask();
    const running = startTaskMetricSpan({
      repoPath: task.worktreePath,
      branch: task.branch,
      actor: "codex",
      phase: "test",
      scope: "focused",
      budgetProfile: "small-check",
      now: "2026-07-22T02:01:00.000Z",
      pid: 1234,
    });
    const finished = finishTaskMetricSpan({
      repoPath: task.worktreePath,
      branch: task.branch,
      actor: "codex",
      spanId: running.spanId,
      now: "2026-07-22T02:02:00.000Z",
      exitCode: 0,
    });
    expect(finished).toMatchObject({ status: "PASSED", durationMs: 60_000, exceeded: false });

    const [file] = metricFiles(task);
    const storedText = readFileSync(file, "utf8");
    expect(storedText).not.toMatch(/command|argument|environment|stdout|stderr|token|secret/i);
    const beforeReport = { text: storedText, mtimeMs: statSync(file).mtimeMs };
    expect(createTaskMetricsReport({ repoPath: task.worktreePath, branch: task.branch })).toMatchObject({
      command: "task:metrics",
      reportOnly: true,
      taskId: task.taskId,
      branch: task.branch,
      commandTotalMs: 60_000,
      measuredWallMs: 60_000,
      counts: { total: 1, completed: 1, incomplete: 0, passed: 1, failed: 0, exceeded: 0 },
    });
    expect({ text: readFileSync(file, "utf8"), mtimeMs: statSync(file).mtimeMs }).toEqual(beforeReport);
    expect(() => finishTaskMetricSpan({
      repoPath: task.worktreePath,
      branch: task.branch,
      actor: "codex",
      spanId: running.spanId,
      now: "2026-07-22T02:03:00.000Z",
      exitCode: 0,
    })).toThrowError("TASK_METRIC_SPAN_NOT_RUNNING");
  });

  it("blocks wrapper measurement from the wrong actor or checkout", () => {
    const { base, task } = makeTask("fix/metric-ownership");
    const options = {
      branch: task.branch,
      phase: "test",
      scope: "focused",
      budgetProfile: "small-check",
      now: "2026-07-22T02:01:00.000Z",
      pid: 1234,
    };
    expect(() => startTaskMetricSpan({ ...options, repoPath: task.worktreePath, actor: "claude" }))
      .toThrowError("TASK_METRIC_ACTOR_MISMATCH");
    expect(() => startTaskMetricSpan({ ...options, repoPath: base, actor: "codex" }))
      .toThrowError("TASK_METRIC_WORKTREE_REQUIRED");
    expect(metricFiles(task)).toEqual([]);
  });

  it("detects record tampering instead of reporting corrupted measurements", () => {
    const { task } = makeTask("chore/metric-integrity");
    startTaskMetricSpan({
      repoPath: task.worktreePath,
      branch: task.branch,
      actor: "codex",
      phase: "build",
      scope: "full",
      budgetProfile: "full-ci",
      now: "2026-07-22T02:01:00.000Z",
      pid: 1234,
    });
    const [file] = metricFiles(task);
    const record = JSON.parse(readFileSync(file, "utf8"));
    writeFileSync(file, `${JSON.stringify({ ...record, phase: "lint" }, null, 2)}\n`);
    expect(() => finishTaskMetricSpan({
      repoPath: task.worktreePath,
      branch: task.branch,
      actor: "codex",
      spanId: record.spanId,
      now: "2026-07-22T02:02:00.000Z",
      exitCode: 0,
    })).toThrowError("TASK_METRIC_FINGERPRINT_MISMATCH");
    expect(() => createTaskMetricsReport({ repoPath: task.worktreePath, branch: task.branch }))
      .toThrowError("TASK_METRIC_FINGERPRINT_MISMATCH");
  });

  it("allows lifecycle timing from the base checkout without requiring the task worktree", () => {
    const { base, task } = makeTask("docs/metric-lifecycle");
    const lifecycle = startLifecycleTaskMetricSpan({
      repoPath: base,
      branch: task.branch,
      actor: "codex",
      operation: "finalize",
      now: "2026-07-22T02:00:10.000Z",
      pid: 1234,
    });
    finishLifecycleTaskMetricSpan({
      repoPath: base,
      branch: task.branch,
      spanId: lifecycle.spanId,
      now: "2026-07-22T02:00:13.000Z",
      exitCode: 0,
    });
    recordCompletedTaskMetric({
      repoPath: base,
      branch: task.branch,
      actor: "codex",
      source: "lifecycle",
      phase: "lifecycle",
      scope: "task",
      operation: "status",
      budgetProfile: "lifecycle-fast",
      startedAt: "2026-07-22T02:01:00.000Z",
      finishedAt: "2026-07-22T02:01:02.000Z",
      exitCode: 0,
      pid: 1234,
    });
    expect(createTaskMetricsReport({ repoPath: base, branch: task.branch })).toMatchObject({
      commandTotalMs: 5_000,
      counts: { total: 2, passed: 2 },
      byPhase: [{ phase: "lifecycle", attempts: 2, completed: 2 }],
    });
    expect(() => startLifecycleTaskMetricSpan({
      repoPath: base,
      branch: task.branch,
      actor: "claude",
      operation: "status",
      now: "2026-07-22T02:03:00.000Z",
      pid: 1234,
    })).toThrowError("TASK_METRIC_ACTOR_MISMATCH");
    expect(() => recordCompletedTaskMetric({
      repoPath: base,
      branch: task.branch,
      actor: "claude",
      source: "lifecycle",
      phase: "lifecycle",
      scope: "task",
      operation: "status",
      budgetProfile: "lifecycle-fast",
      startedAt: "2026-07-22T02:02:00.000Z",
      finishedAt: "2026-07-22T02:02:01.000Z",
      exitCode: 0,
      pid: 1234,
    })).toThrowError("TASK_METRIC_ACTOR_MISMATCH");

    offerTaskHandoff({
      repoPath: task.worktreePath,
      branch: task.branch,
      actor: "codex",
      toActor: "claude",
      context: {
        objective: "측정 인수인계",
        completed: ["저장 계층 완료"],
        decisions: ["같은 task 측정 사용"],
        remaining: ["다음 검증"],
        verification: ["metrics test"],
        blockers: [],
        nextAction: "검증을 이어간다.",
      },
      now: "2026-07-22T02:04:00.000Z",
    });
    expect(startLifecycleTaskMetricSpan({
      repoPath: base,
      branch: task.branch,
      actor: "claude",
      operation: "handoff",
      now: "2026-07-22T02:04:01.000Z",
      pid: 1234,
    })).toMatchObject({ source: "lifecycle", operation: "handoff", status: "RUNNING" });
  });

  it("rejects a junction substituted for the task metric directory", () => {
    const { task } = makeTask("test/metric-junction");
    const metricsRoot = path.join(task.gitCommonDir, "talkpik-task-lifecycle", "v2", "metrics");
    const outside = path.join(path.dirname(task.gitCommonDir), "outside-metrics");
    mkdirSync(metricsRoot);
    mkdirSync(outside);
    symlinkSync(outside, path.join(metricsRoot, task.taskId), process.platform === "win32" ? "junction" : "dir");
    expect(() => startTaskMetricSpan({
      repoPath: task.worktreePath,
      branch: task.branch,
      actor: "codex",
      phase: "test",
      scope: "focused",
      budgetProfile: "small-check",
      now: "2026-07-22T02:01:00.000Z",
      pid: 1234,
    })).toThrowError("TASK_METRIC_REGISTRY_PATH_ESCAPE");
  });

  it("allows only one of two concurrent processes to finish a span", async () => {
    const { task } = makeTask("test/metric-concurrent-finish");
    const running = startTaskMetricSpan({
      repoPath: task.worktreePath,
      branch: task.branch,
      actor: "codex",
      phase: "test",
      scope: "focused",
      budgetProfile: "small-check",
      now: "2026-07-22T02:01:00.000Z",
      pid: 1234,
    });
    const results = await Promise.all([
      finishInProcess(task, running.spanId),
      finishInProcess(task, running.spanId),
    ]);
    expect(results.map(({ status }) => status).sort()).toEqual([0, 1]);
    expect(results.find(({ status }) => status === 1).stderr).toMatch(
      /TASK_METRIC_SPAN_(?:BUSY|NOT_RUNNING)/,
    );
    expect(createTaskMetricsReport({ repoPath: task.worktreePath, branch: task.branch })).toMatchObject({
      counts: { total: 1, completed: 1, passed: 1 },
    });
  });

  it("rejects a valid record copied from a different task", () => {
    const { task: first } = makeTask("test/metric-first-task");
    const { task: second } = makeTask("test/metric-second-task");
    startTaskMetricSpan({
      repoPath: first.worktreePath,
      branch: first.branch,
      actor: "codex",
      phase: "test",
      scope: "focused",
      budgetProfile: "small-check",
      now: "2026-07-22T02:01:00.000Z",
      pid: 1234,
    });
    startTaskMetricSpan({
      repoPath: second.worktreePath,
      branch: second.branch,
      actor: "codex",
      phase: "test",
      scope: "focused",
      budgetProfile: "small-check",
      now: "2026-07-22T02:01:00.000Z",
      pid: 1234,
    });
    const [foreignFile] = metricFiles(first);
    const secondDirectory = path.dirname(metricFiles(second)[0]);
    writeFileSync(path.join(secondDirectory, path.basename(foreignFile)), readFileSync(foreignFile));
    expect(() => createTaskMetricsReport({ repoPath: second.worktreePath, branch: second.branch }))
      .toThrowError("TASK_METRIC_TASK_MISMATCH");
  });
});
