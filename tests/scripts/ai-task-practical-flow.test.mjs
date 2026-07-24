import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createFinishReport,
  offerTaskHandoff,
  readTaskStatus,
  startTask,
  validateFinishReportV1,
} from "../../scripts/lib/ai-task-lifecycle-v2.mjs";
import { createTaskMetricsReport } from "../../scripts/ai-task.mjs";

const NOW = "2026-07-22T01:00:00.000Z";
const roots = [];

function git(cwd, args) {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function makeRepository(prefix = "talkpik-practical-flow-") {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  roots.push(root);
  const remote = path.join(root, "remote.git");
  const seed = path.join(root, "seed");
  const base = path.join(root, "base");
  execFileSync("git", ["init", "--bare", remote]);
  execFileSync("git", ["init", "-b", "main", seed]);
  git(seed, ["config", "user.email", "test@example.com"]);
  git(seed, ["config", "user.name", "Practical Flow Test"]);
  writeFileSync(path.join(seed, "README.md"), "baseline\n");
  writeFileSync(path.join(seed, ".gitignore"), "node_modules/\n.next/\n");
  git(seed, ["add", "README.md", ".gitignore"]);
  git(seed, ["commit", "-m", "baseline"]);
  git(seed, ["remote", "add", "origin", remote]);
  git(seed, ["push", "-u", "origin", "main"]);
  execFileSync("git", ["clone", "--branch", "main", remote, base]);
  git(base, ["config", "user.email", "test@example.com"]);
  git(base, ["config", "user.name", "Practical Flow Test"]);
  return base;
}

function publishAndAdvanceRemote(started) {
  git(started.worktreePath, ["push", "-u", "origin", started.branch]);
  const remote = git(started.worktreePath, ["remote", "get-url", "origin"]);
  const peer = path.join(path.dirname(remote), `peer-${started.taskId}`);
  execFileSync("git", ["clone", "--branch", started.branch, remote, peer]);
  git(peer, ["config", "user.email", "peer@example.com"]);
  git(peer, ["config", "user.name", "Peer"]);
  writeFileSync(path.join(peer, "peer-change.txt"), "remote change\n");
  git(peer, ["add", "peer-change.txt"]);
  git(peer, ["commit", "-m", "advance task branch"]);
  git(peer, ["push", "origin", started.branch]);
  git(started.worktreePath, ["fetch", "origin", started.branch]);
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("task:finish practical report", () => {
  it("uses a bounded local Git path and never publishes, fetches, or scans ignored dependency trees", async () => {
    expect(createFinishReport).toBeTypeOf("function");
    const base = makeRepository("talkpik practical flow ");
    const started = startTask({ repoPath: base, branch: "refactor/fast-finish", actor: "codex", now: NOW });
    const dependencyRoot = path.join(started.worktreePath, "node_modules", "package", "deep");
    mkdirSync(dependencyRoot, { recursive: true });
    writeFileSync(path.join(dependencyRoot, "ignored.js"), "ignored\n");
    const calls = [];
    const commandRunner = (command, args, options) => {
      calls.push({ command, args: [...args] });
      return spawnSync(command, args, { ...options, encoding: "utf8", shell: false, windowsHide: true });
    };

    const report = createFinishReport({
      repoPath: started.worktreePath,
      branch: started.branch,
      actor: "codex",
      now: "2026-07-22T01:01:00.000Z",
      commandRunner,
    });
    expect(validateFinishReportV1(report)).toEqual([]);
    expect(report).toMatchObject({
      recordType: "FinishReportV1",
      dirty: false,
      published: false,
      blockers: [expect.any(String)],
      nextAction: { owner: "manual", approvalRequired: true, retrySafe: true },
    });
    expect(calls.every(({ command }) => command === "git")).toBe(true);
    expect(calls.some(({ args }) => args.includes("fetch") || args.includes("push") || args.includes("--ignored"))).toBe(false);
    expect(calls.some(({ args }) => args.includes("--untracked-files=normal"))).toBe(true);
    expect(report.nextAction.command).toContain(`-C '${started.worktreePath.replaceAll("'", "''")}'`);
    expect(readTaskStatus({ repoPath: started.worktreePath, branch: started.branch }).finishReport)
      .toMatchObject({ fingerprint: report.fingerprint });
  });

  it("does not treat an unrelated upstream as proof that the task branch was published", async () => {
    const base = makeRepository();
    const started = startTask({ repoPath: base, branch: "fix/upstream-proof", actor: "codex", now: NOW });
    git(started.worktreePath, ["branch", "--set-upstream-to=origin/main"]);

    const report = createFinishReport({
      repoPath: started.worktreePath,
      branch: started.branch,
      actor: "codex",
      now: "2026-07-22T01:02:00.000Z",
    });

    expect(report.upstream).toBe("origin/main");
    expect(report.published).toBe(false);
    expect(report.nextAction).toMatchObject({ owner: "manual", approvalRequired: true });
  });

  it("reports a behind-only task branch with one fast-forward next action", async () => {
    const base = makeRepository();
    const started = startTask({ repoPath: base, branch: "fix/behind-finish", actor: "codex", now: NOW });
    publishAndAdvanceRemote(started);

    const report = createFinishReport({
      repoPath: started.worktreePath,
      branch: started.branch,
      actor: "codex",
      now: "2026-07-22T01:03:00.000Z",
    });

    expect(report).toMatchObject({ ahead: 0, behind: 1, published: false });
    expect(report.blockers).toEqual(["원격 task branch에 로컬보다 새로운 커밋이 있습니다."]);
    expect(report.nextAction).toEqual({
      owner: "codex",
      reason: "이미 가져온 원격 변경을 fast-forward로 반영한 뒤 다시 확인하세요.",
      command: `git -C '${started.worktreePath.replaceAll("'", "''")}' merge --ff-only origin/fix/behind-finish`,
      approvalRequired: false,
      retrySafe: true,
    });
  });

  it("reports a diverged task branch with one read-only manual decision action", async () => {
    const base = makeRepository();
    const started = startTask({ repoPath: base, branch: "fix/diverged-finish", actor: "codex", now: NOW });
    publishAndAdvanceRemote(started);
    writeFileSync(path.join(started.worktreePath, "local-change.txt"), "local change\n");
    git(started.worktreePath, ["add", "local-change.txt"]);
    git(started.worktreePath, ["commit", "-m", "local task change"]);

    const report = createFinishReport({
      repoPath: started.worktreePath,
      branch: started.branch,
      actor: "codex",
      now: "2026-07-22T01:04:00.000Z",
    });

    expect(report).toMatchObject({ ahead: 1, behind: 1, published: false });
    expect(report.blockers).toEqual(["로컬과 원격 task branch가 서로 다른 커밋을 가지고 있습니다."]);
    expect(report.nextAction).toEqual({
      owner: "manual",
      reason: "기록을 보존한 채 merge 또는 rebase 방식을 결정해야 합니다.",
      command: `git -C '${started.worktreePath.replaceAll("'", "''")}' log --oneline --left-right HEAD...origin/fix/diverged-finish`,
      approvalRequired: true,
      retrySafe: true,
    });
  });

  it("stores owner-auth CLI evidence for a task and rejects timestamp regression", async () => {
    const { runGitHubOwnerAuthCli } = await import("../../scripts/check-github-owner-auth.mjs");
    const base = makeRepository();
    const started = startTask({ repoPath: base, branch: "chore/auth-sidecar", actor: "codex", now: NOW });
    git(started.worktreePath, ["remote", "set-url", "origin", "https://github.com/blackstarzck/example.git"]);
    const commandRunner = (command, args) => {
      if (command === "git") return { status: 0, stdout: "https://github.com/blackstarzck/example.git\n", stderr: "" };
      if (command === "gh" && args[0] === "api") return { status: 0, stdout: "BlackStarzck\n", stderr: "" };
      throw new Error("UNEXPECTED_COMMAND");
    };
    const runAuth = async (now) => {
      let stdout = "";
      let stderr = "";
      const exitCode = await runGitHubOwnerAuthCli({
        argv: [
          "--repo", started.worktreePath,
          "--branch", started.branch,
          "--owner", "blackstarzck",
          "--now", now,
        ],
        commandRunner,
        writeStdout: (value) => { stdout += value; },
        writeStderr: (value) => { stderr += value; },
      });
      return { exitCode, stdout, stderr };
    };

    const first = await runAuth("2026-07-22T01:05:00.000Z");
    expect(first).toMatchObject({ exitCode: 0, stderr: "" });
    const stored = readTaskStatus({ repoPath: started.worktreePath, branch: started.branch }).ownerAuthResult;
    expect(stored).toMatchObject({ recordType: "OwnerAuthResultV1", checkedAt: "2026-07-22T01:05:00.000Z" });

    const regressed = await runAuth("2026-07-22T01:04:00.000Z");
    expect(regressed.exitCode).toBe(1);
    expect(regressed.stdout).toBe("");
    expect(JSON.parse(regressed.stderr)).toEqual({ code: "TIMESTAMP_REGRESSION" });
    expect(readTaskStatus({ repoPath: started.worktreePath, branch: started.branch }).ownerAuthResult.fingerprint)
      .toBe(stored.fingerprint);
    expect(createTaskMetricsReport({ repoPath: started.worktreePath, branch: started.branch })).toMatchObject({
      counts: { total: 2, completed: 2, passed: 1, failed: 1 },
      byPhase: [{ phase: "lifecycle", attempts: 2, completed: 2, failures: 1 }],
    });

    offerTaskHandoff({
      repoPath: started.worktreePath,
      branch: started.branch,
      actor: "codex",
      toActor: "claude",
      context: {
        objective: "Verify owner authentication timing during handoff.",
        completed: ["Owner authentication baseline recorded."],
        decisions: ["Keep the existing task worktree."],
        remaining: ["Accept the handoff."],
        verification: ["Run owner-auth while handoff is pending."],
        blockers: [],
        nextAction: "Claude accepts the handoff after authentication.",
      },
      now: "2026-07-22T01:06:00.000Z",
    });
    const pending = await runAuth("2026-07-22T01:07:00.000Z");
    expect(pending).toMatchObject({ exitCode: 0, stderr: "" });
    expect(createTaskMetricsReport({ repoPath: started.worktreePath, branch: started.branch })).toMatchObject({
      counts: { total: 3, completed: 3, passed: 2, failed: 1 },
      byPhase: [{ phase: "lifecycle", attempts: 3, completed: 3, failures: 1 }],
    });
  });

  it("rejects finish reports older than the task or the last finish report", async () => {
    const base = makeRepository();
    const started = startTask({ repoPath: base, branch: "fix/finish-time", actor: "codex", now: NOW });

    expect(() => createFinishReport({
      repoPath: started.worktreePath,
      branch: started.branch,
      actor: "codex",
      now: "2026-07-22T00:59:00.000Z",
    })).toThrowError("TIMESTAMP_REGRESSION");

    createFinishReport({
      repoPath: started.worktreePath,
      branch: started.branch,
      actor: "codex",
      now: "2026-07-22T01:05:00.000Z",
    });
    expect(() => createFinishReport({
      repoPath: started.worktreePath,
      branch: started.branch,
      actor: "codex",
      now: "2026-07-22T01:04:00.000Z",
    })).toThrowError("TIMESTAMP_REGRESSION");
  });
});
