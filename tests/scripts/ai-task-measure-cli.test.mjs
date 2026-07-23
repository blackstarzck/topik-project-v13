import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { createTaskMetricsReport, runTaskMeasureCli } from "../../scripts/ai-task.mjs";
import { startTask } from "../../scripts/lib/ai-task-lifecycle-v2.mjs";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const taskCli = path.join(projectRoot, "scripts", "ai-task.mjs");
const roots = [];

function git(cwd, args) {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function makeTask(branch = "test/measure-cli") {
  const root = mkdtempSync(path.join(tmpdir(), "talkpik-measure-cli-"));
  roots.push(root);
  const remote = path.join(root, "remote.git");
  const seed = path.join(root, "seed");
  const base = path.join(root, "base");
  execFileSync("git", ["init", "--bare", remote]);
  execFileSync("git", ["init", "-b", "main", seed]);
  git(seed, ["config", "user.email", "test@example.com"]);
  git(seed, ["config", "user.name", "Measure CLI Test"]);
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
    now: "2026-07-22T03:00:00.000Z",
  });
  return { base, root, task };
}

function runMeasure(task, extra, command) {
  return spawnSync(process.execPath, [
    taskCli,
    "measure",
    "--repo", task.worktreePath,
    "--branch", task.branch,
    "--actor", "codex",
    "--phase", "test",
    "--scope", "focused",
    "--budget", "small-check",
    ...extra,
    "--",
    ...command,
  ], { encoding: "utf8", shell: false, windowsHide: true });
}

function blockMetricStorage(task) {
  const metricsRoot = path.join(task.gitCommonDir, "talkpik-task-lifecycle", "v2", "metrics");
  const outside = path.join(path.dirname(task.gitCommonDir), `blocked-${task.taskId}`);
  mkdirSync(metricsRoot);
  mkdirSync(outside);
  symlinkSync(outside, path.join(metricsRoot, task.taskId), process.platform === "win32" ? "junction" : "dir");
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("task:measure CLI", () => {
  it("runs a command without a shell and stores only timing metadata", () => {
    const { task } = makeTask();
    const result = runMeasure(task, [], [process.execPath, "-e", "process.stdout.write('child-ok')"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("child-ok");
    expect(createTaskMetricsReport({ repoPath: task.worktreePath, branch: task.branch })).toMatchObject({
      counts: { total: 1, completed: 1, passed: 1, failed: 0 },
      byPhase: [{ phase: "test", attempts: 1, completed: 1 }],
    });
    const metricDirectory = path.join(
      task.gitCommonDir,
      "talkpik-task-lifecycle",
      "v2",
      "metrics",
      task.taskId,
    );
    const stored = readdirSync(metricDirectory)
      .filter((name) => name.endsWith(".json"))
      .map((name) => readFileSync(path.join(metricDirectory, name), "utf8"))
      .join("\n");
    expect(stored).not.toContain("child-ok");
    expect(stored).not.toContain("process.stdout");
  });

  it.runIf(process.platform === "win32")("runs the pnpm Windows shim without enabling a shell", () => {
    const { task } = makeTask("test/measure-pnpm-windows");
    const result = runMeasure(task, [], ["pnpm", "--version"]);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/u);
  });

  it.runIf(process.platform === "win32")("resolves relative script commands from the task worktree", () => {
    const { task } = makeTask("test/measure-relative-script");
    writeFileSync(
      path.join(task.worktreePath, "task-relative-runner.mjs"),
      "process.stdout.write('task-relative-ok');\n",
    );
    const result = runMeasure(task, [], ["task-relative-runner.mjs"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("task-relative-ok");
  });

  it("preserves a failing child exit code", () => {
    const { task } = makeTask("fix/measure-exit-code");
    const result = runMeasure(task, [], [process.execPath, "-e", "process.exit(7)"]);
    expect(result.status).toBe(7);
    expect(createTaskMetricsReport({ repoPath: task.worktreePath, branch: task.branch })).toMatchObject({
      counts: { total: 1, completed: 1, passed: 0, failed: 1 },
    });
  });

  it("blocks the child before execution when task ownership is wrong", () => {
    const { root, task } = makeTask("chore/measure-ownership");
    const marker = path.join(root, "should-not-exist.txt");
    const result = spawnSync(process.execPath, [
      taskCli,
      "measure",
      "--repo", task.worktreePath,
      "--branch", task.branch,
      "--actor", "claude",
      "--phase", "test",
      "--scope", "focused",
      "--budget", "small-check",
      "--",
      process.execPath,
      "-e",
      `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'ran')`,
    ], { encoding: "utf8", shell: false, windowsHide: true });
    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe("TASK_METRIC_ACTOR_MISMATCH");
    expect(existsSync(marker)).toBe(false);
  });

  it("preserves child output and exit code when metric storage is unavailable", () => {
    const { task } = makeTask("test/measure-recording-failure");
    blockMetricStorage(task);
    const result = runMeasure(task, [], [process.execPath, "-e", "process.stdout.write('still-ran')"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("still-ran");
    expect(result.stderr.trim()).toBe("TASK_METRIC_RECORDING_WARNING");
  });

  it("warns without failing when a command exceeds its budget", () => {
    const { task } = makeTask("test/measure-budget-warning");
    const timestamps = ["2026-07-22T03:01:00.000Z", "2026-07-22T03:02:01.000Z"];
    let stderr = "";
    const exitCode = runTaskMeasureCli({
      argv: [
        "--repo", task.worktreePath,
        "--branch", task.branch,
        "--actor", "codex",
        "--phase", "ci",
        "--scope", "docs",
        "--budget", "docs-ci",
        "--",
        "synthetic-check",
      ],
      commandRunner: () => ({ status: 0 }),
      now: () => timestamps.shift(),
      writeStderr: (value) => { stderr += value; },
    });
    expect(exitCode).toBe(0);
    expect(stderr.trim()).toBe("TASK_METRIC_BUDGET_EXCEEDED");
    expect(createTaskMetricsReport({ repoPath: task.worktreePath, branch: task.branch })).toMatchObject({
      counts: { total: 1, passed: 1, exceeded: 1 },
    });
  });
});

describe("task lifecycle automatic metrics", () => {
  it("records lifecycle commands and exposes a report-only metrics command", () => {
    const { base, task } = makeTask("docs/automatic-metrics");
    const status = spawnSync(process.execPath, [
      taskCli,
      "status",
      "--repo", base,
      "--branch", task.branch,
    ], { encoding: "utf8", shell: false, windowsHide: true });
    expect(status.status).toBe(0);

    const firstReport = spawnSync(process.execPath, [
      taskCli,
      "metrics",
      "--repo", base,
      "--branch", task.branch,
    ], { encoding: "utf8", shell: false, windowsHide: true });
    expect(firstReport.status).toBe(0);
    expect(JSON.parse(firstReport.stdout)).toMatchObject({
      command: "task:metrics",
      reportOnly: true,
      counts: { total: 1, completed: 1, passed: 1 },
    });
    const secondReport = spawnSync(process.execPath, [
      taskCli,
      "metrics",
      "--repo", base,
      "--branch", task.branch,
    ], { encoding: "utf8", shell: false, windowsHide: true });
    expect(JSON.parse(secondReport.stdout).counts.total).toBe(1);
  });

  it("publishes the two metric commands through package scripts", () => {
    const packageJson = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8"));
    expect(packageJson.scripts["task:measure"]).toBe("node scripts/ai-task.mjs measure");
    expect(packageJson.scripts["task:metrics"]).toBe("node scripts/ai-task.mjs metrics");
    expect(packageJson.scripts["check:task-lifecycle"]).toContain("tests/scripts/ai-task-metrics.test.mjs");
    expect(packageJson.scripts["check:task-lifecycle"]).toContain("tests/scripts/ai-task-measure-cli.test.mjs");
  });

  it("can be imported without executing the command-line entrypoint", async () => {
    const importedModule = await import(`${pathToFileURL(taskCli).href}?import-test=${Date.now()}`);
    expect(importedModule.runTaskMeasureCli).toBeTypeOf("function");
  });

  it("keeps lifecycle command results usable when metric storage is unavailable", () => {
    const { base, task } = makeTask("test/lifecycle-recording-failure");
    blockMetricStorage(task);
    const result = spawnSync(process.execPath, [
      taskCli,
      "status",
      "--repo", base,
      "--branch", task.branch,
    ], { encoding: "utf8", shell: false, windowsHide: true });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).task).toMatchObject({ taskId: task.taskId, state: "ACTIVE" });
    expect(result.stderr.trim()).toBe("TASK_METRIC_RECORDING_WARNING");
  });
});
