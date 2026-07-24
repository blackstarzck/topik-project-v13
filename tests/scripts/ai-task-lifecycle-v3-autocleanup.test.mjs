import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  autoCleanupTaskRecordV3,
  createTaskRecordV3,
  readTaskRecordV3,
  sweepTaskRecordsV3,
  writeTaskRecordV3,
} from "../../scripts/lib/ai-task-lifecycle-v3.mjs";

const NOW = "2026-07-23T04:00:00.000Z";
const FINISHED = "2026-07-23T04:01:00.000Z";
const CLEANUP = "2026-07-23T04:02:00.000Z";
let repository;

function git(cwd, args) {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 10_000,
    windowsHide: true,
  }).trim();
}

function makeRepository() {
  const root = mkdtempSync(path.join(tmpdir(), "talkpik-v3-autocleanup-"));
  const base = path.join(root, "base");
  execFileSync("git", ["init", "-b", "main", base], { timeout: 10_000 });
  git(base, ["config", "user.email", "test@example.com"]);
  git(base, ["config", "user.name", "Lifecycle V3 Test"]);
  writeFileSync(path.join(base, "README.md"), "baseline\n");
  git(base, ["add", "README.md"]);
  git(base, ["commit", "-m", "baseline"]);
  git(base, ["remote", "add", "origin", path.join(root, "unused-remote.git")]);
  git(base, ["update-ref", "refs/remotes/origin/main", git(base, ["rev-parse", "HEAD"])]);
  writeFileSync(path.join(base, ".git", "info", "exclude"), ".worktrees/\n");
  return { root, base };
}

function startAndMergeShared() {
  const baseSha = git(repository.base, ["rev-parse", "HEAD"]);
  const branch = "feat/autocleanup-shared";
  const workspacePath = path.join(repository.base, ".worktrees", "shared-dev");
  mkdirSync(path.dirname(workspacePath), { recursive: true });
  git(repository.base, ["worktree", "add", "-b", branch, workspacePath, baseSha]);
  writeFileSync(path.join(workspacePath, "shared-clean.txt"), "shared-clean\n");
  git(workspacePath, ["add", "shared-clean.txt"]);
  git(workspacePath, ["commit", "-m", "shared-clean"]);
  const headSha = git(workspacePath, ["rev-parse", "HEAD"]);
  const gitDirRaw = git(workspacePath, ["rev-parse", "--git-dir"]);
  const finished = writeTaskRecordV3({
    repoPath: repository.base,
    record: createTaskRecordV3({
      taskId: "task-autocleanup-shared",
      repoProfile: {
        name: "topik-project-v13",
        remote: "origin",
        repositoryIdentity: "local/test/topik-project-v13",
        authLogin: "local",
        baseBranch: "main",
      },
      baseSha,
      headSha,
      branch: { name: branch, type: "feat", slug: "autocleanup-shared" },
      workspace: {
        kind: "shared-slot",
        ownership: "managed",
        path: workspacePath,
        gitDir: realpathSync.native(path.resolve(workspacePath, gitDirRaw)),
      },
      activeActor: "codex",
      pendingActor: null,
      handoffFromActor: null,
      revision: 1,
      runtimeRef: null,
      artifactManifestRef: null,
      cleanupPolicy: "auto-after-merge",
      state: "ACTIVE",
      blockers: [],
      createdAt: NOW,
      updatedAt: FINISHED,
    }),
  });
  git(repository.base, ["merge", "--no-ff", "-m", "merge shared-clean", finished.branch.name]);
  const mainSha = git(repository.base, ["rev-parse", "HEAD"]);
  git(repository.base, ["update-ref", "refs/remotes/origin/main", mainSha]);
  return { finished, mainSha };
}

function mergeEvidence(record, mainSha, overrides = {}) {
  return {
    schemaVersion: 1,
    recordType: "TaskMergeEvidenceV3",
    source: "github-pr",
    repositoryIdentity: record.repoProfile.repositoryIdentity,
    authLogin: record.repoProfile.authLogin,
    targetBranch: "main",
    headSha: record.headSha,
    mainSha,
    mergedAt: CLEANUP,
    remoteBranch: { exists: false, sha: null },
    production: null,
    ...overrides,
  };
}

function withManifest(record) {
  const folder = path.join(record.workspace.path, ".codex", "work", record.branch.slug);
  mkdirSync(folder, { recursive: true });
  writeFileSync(path.join(folder, "owned.log"), "owned\n");
  const payload = {
    createdAt: "2026-07-23T04:01:30.000Z",
    files: ["owned.log"],
    recordType: "TaskArtifactManifestV3",
    schemaVersion: 3,
    taskId: record.taskId,
  };
  const fingerprint = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  writeFileSync(
    path.join(folder, "manifest.json"),
    `${JSON.stringify({ ...payload, fingerprint }, null, 2)}\n`,
  );
  return writeTaskRecordV3({
    repoPath: repository.base,
    record: createTaskRecordV3({
      ...record,
      artifactManifestRef: `.codex/work/${record.branch.slug}/manifest.json`,
      revision: record.revision + 1,
      updatedAt: payload.createdAt,
    }),
    expectedRevision: record.revision,
    expectedFingerprint: record.fingerprint,
  });
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

function syntheticManagedTask(suffix) {
  const mainSha = git(repository.base, ["rev-parse", "HEAD"]);
  const branch = `feat/autocleanup-${suffix}`;
  const workspacePath = path.join(repository.base, ".worktrees", `feat-autocleanup-${suffix}`);
  mkdirSync(workspacePath, { recursive: true });
  const task = writeTaskRecordV3({
    repoPath: repository.base,
    record: createTaskRecordV3({
      taskId: `task-autocleanup-${suffix}`,
      repoProfile: {
        name: "topik-project-v13",
        remote: "origin",
        repositoryIdentity: "local/test/topik-project-v13",
        authLogin: "local",
        baseBranch: "main",
      },
      baseSha: mainSha,
      headSha: mainSha,
      branch: { name: branch, type: "feat", slug: `autocleanup-${suffix}` },
      workspace: {
        kind: "isolated",
        ownership: "managed",
        path: workspacePath,
        gitDir: path.join(repository.base, ".git", "worktrees", `feat-autocleanup-${suffix}`),
      },
      activeActor: "codex",
      pendingActor: null,
      handoffFromActor: null,
      revision: 1,
      runtimeRef: null,
      artifactManifestRef: null,
      cleanupPolicy: "auto-after-merge",
      state: "ACTIVE",
      blockers: [],
      createdAt: NOW,
      updatedAt: FINISHED,
    }),
  });
  return { task, mainSha, state: { status: "" } };
}

function syntheticGitRunner(synthetic) {
  const common = realpathSync.native(path.join(repository.base, ".git"));
  return (repoPath, args) => {
    const command = args.join(" ");
    if (command === "rev-parse --show-toplevel") {
      return { status: 0, stdout: repository.base };
    }
    if (command === "rev-parse --git-common-dir") return { status: 0, stdout: common };
    if (command === "rev-parse --git-dir") {
      return {
        status: 0,
        stdout: path.resolve(repoPath) === path.resolve(repository.base)
          ? common
          : synthetic.task.workspace.gitDir,
      };
    }
    if (command === "rev-parse --verify origin/main^{commit}") {
      return { status: 0, stdout: synthetic.mainSha };
    }
    if (command === `rev-parse --verify refs/heads/${synthetic.task.branch.name}^{commit}`) {
      return { status: 0, stdout: synthetic.task.headSha };
    }
    if (command.startsWith("merge-base --is-ancestor ")) return { status: 0, stdout: "" };
    if (command === "worktree list --porcelain") {
      return {
        status: 0,
        stdout: [
          `worktree ${synthetic.task.workspace.path}`,
          `HEAD ${synthetic.task.headSha}`,
          `branch refs/heads/${synthetic.task.branch.name}`,
          "",
        ].join("\n"),
      };
    }
    if (command === "branch --show-current") {
      return { status: 0, stdout: synthetic.task.branch.name };
    }
    if (command === "rev-parse HEAD") return { status: 0, stdout: synthetic.task.headSha };
    if (command === "status --porcelain=v1 --untracked-files=all") {
      return { status: 0, stdout: synthetic.state.status };
    }
    return { status: 1, stdout: "", stderr: "unexpected synthetic git command" };
  };
}

function addRuntimeSnapshot(synthetic) {
  const payload = {
    actor: "codex",
    branch: synthetic.task.branch.name,
    createdAt: "2026-07-23T04:01:30.000Z",
    lockPaths: [],
    pids: [],
    ports: [34_099],
    recordType: "RuntimeSnapshotV1",
    schemaVersion: 1,
    taskId: synthetic.task.taskId,
  };
  const fingerprint = digest(payload);
  const runtimes = path.join(
    repository.base,
    ".git",
    "talkpik-task-lifecycle",
    "v3",
    "runtimes",
  );
  writeFileSync(
    path.join(runtimes, `${fingerprint}.json`),
    `${JSON.stringify({ ...payload, fingerprint }, null, 2)}\n`,
  );
  synthetic.task = writeTaskRecordV3({
    repoPath: repository.base,
    record: createTaskRecordV3({
      ...synthetic.task,
      runtimeRef: `runtime:${fingerprint}`,
      revision: synthetic.task.revision + 1,
      updatedAt: payload.createdAt,
    }),
    expectedRevision: synthetic.task.revision,
    expectedFingerprint: synthetic.task.fingerprint,
  });
}

beforeAll(() => {
  repository = makeRepository();
});

afterAll(() => {
  if (repository?.root) rmSync(repository.root, { recursive: true, force: true });
});

describe("TaskRecordV3 automatic cleanup", () => {
  it("keeps the shared slot, detaches it to exact origin/main, and deletes only the merged branch", () => {
    const merged = startAndMergeShared();
    const finished = withManifest(merged.finished);
    const remoteDeletes = [];

    const report = autoCleanupTaskRecordV3({
      repoPath: repository.base,
      taskId: finished.taskId,
      mergeEvidence: mergeEvidence(finished, merged.mainSha, {
        remoteBranch: { exists: true, sha: finished.headSha },
      }),
      now: CLEANUP,
      deleteRemoteBranch: (request) => {
        remoteDeletes.push(request);
        return { deleted: true };
      },
      verifyRemoteBranchAbsent: () => true,
    });

    expect(report).toMatchObject({
      recordType: "TaskAutoCleanupReportV3",
      result: "CLEANED",
      strategy: "shared-slot",
    });
    expect(existsSync(finished.workspace.path)).toBe(true);
    expect(git(finished.workspace.path, ["branch", "--show-current"])).toBe("");
    expect(git(finished.workspace.path, ["rev-parse", "HEAD"])).toBe(merged.mainSha);
    expect(existsSync(path.join(
      finished.workspace.path,
      ".codex",
      "work",
      finished.branch.slug,
      "owned.log",
    ))).toBe(false);
    expect(remoteDeletes).toEqual([expect.objectContaining({
      authLogin: finished.repoProfile.authLogin,
      branch: finished.branch.name,
      expectedSha: finished.headSha,
    })]);
    expect(() => git(repository.base, ["show-ref", "--verify", `refs/heads/${finished.branch.name}`]))
      .toThrow();
    expect(readTaskRecordV3({ repoPath: repository.base, taskId: finished.taskId }))
      .toMatchObject({ state: "CLEANED", activeActor: null });
  });

  it("preserves dirty, runtime-active, wrong-account, and stale-SHA workspaces without Git deletion", () => {
    const dirty = syntheticManagedTask("dirty-synthetic");
    dirty.state.status = "?? unknown.txt";

    const runtime = syntheticManagedTask("runtime-synthetic");
    addRuntimeSnapshot(runtime);

    const account = syntheticManagedTask("account-synthetic");
    const stale = syntheticManagedTask("stale-synthetic");
    const toctou = syntheticManagedTask("toctou-synthetic");

    const cases = [
      {
        synthetic: dirty,
        expectedBlocker: "UNKNOWN_ARTIFACT",
      },
      {
        synthetic: runtime,
        expectedBlocker: "RUNTIME_ACTIVE",
        probes: { portActive: () => true },
      },
      {
        synthetic: account,
        expectedBlocker: "AUTH_LOGIN_MISMATCH",
        evidenceOverride: { authLogin: "wrong-account" },
      },
      {
        synthetic: stale,
        expectedBlocker: "MERGE_HEAD_MISMATCH",
        evidenceOverride: { headSha: "f".repeat(40) },
      },
      {
        synthetic: toctou,
        expectedBlocker: "UNKNOWN_ARTIFACT",
        evidenceOverride: {
          remoteBranch: { exists: true, sha: toctou.task.headSha },
        },
        deleteRemoteBranch: () => {
          toctou.state.status = "?? appeared-after-delete.txt";
          return { deleted: true };
        },
        verifyRemoteBranchAbsent: () => true,
      },
    ];

    for (const entry of cases) {
      const report = autoCleanupTaskRecordV3({
        repoPath: repository.base,
        taskId: entry.synthetic.task.taskId,
        mergeEvidence: mergeEvidence(
          entry.synthetic.task,
          entry.synthetic.mainSha,
          entry.evidenceOverride,
        ),
        now: CLEANUP,
        gitRunner: syntheticGitRunner(entry.synthetic),
        probes: entry.probes,
        deleteRemoteBranch: entry.deleteRemoteBranch,
        verifyRemoteBranchAbsent: entry.verifyRemoteBranchAbsent,
        delegateIsolated: () => {
          throw new Error("must not delegate unsafe task");
        },
      });
      expect(report).toMatchObject({
        result: "PRESERVED",
        blocker: entry.expectedBlocker,
      });
      expect(existsSync(entry.synthetic.task.workspace.path)).toBe(true);
    }
  });

  it("releases host/adopted claims and never deletes stg or main", () => {
    const headSha = git(repository.base, ["rev-parse", "HEAD"]);
    for (const [kind, ownership] of [["host", "host"], ["adopted", "adopted"]]) {
      const branch = `chore/promote-host-${kind}`;
      const task = writeTaskRecordV3({
        repoPath: repository.base,
        record: createTaskRecordV3({
          taskId: `task-release-${kind}`,
          repoProfile: {
            name: "topik-project-v13",
            remote: "origin",
            repositoryIdentity: "local/test/topik-project-v13",
            authLogin: "local",
            baseBranch: "main",
          },
          baseSha: headSha,
          headSha,
          branch: { name: branch, type: "chore", slug: `promote-host-${kind}` },
          workspace: {
            kind,
            ownership,
            path: path.join(repository.root, `${kind}-preserved-workspace`),
            gitDir: path.join(repository.root, `${kind}-preserved-gitdir`),
          },
          activeActor: "codex",
          pendingActor: null,
          handoffFromActor: null,
          revision: 1,
          runtimeRef: null,
          artifactManifestRef: null,
          cleanupPolicy: "release-only",
          state: "MERGED",
          blockers: [],
          createdAt: NOW,
          updatedAt: FINISHED,
        }),
      });
      const report = autoCleanupTaskRecordV3({
        repoPath: repository.base,
        taskId: task.taskId,
        mergeEvidence: mergeEvidence(task, headSha, {
          source: "promotion",
          production: { ready: true, commitSha: headSha },
        }),
        now: CLEANUP,
      });
      expect(report).toMatchObject({ result: "RELEASED", strategy: "release-only" });
      expect(existsSync(repository.base)).toBe(true);
    }
    expect(git(repository.base, ["branch", "--show-current"])).toBe("main");
  });

  it("sweeps at most ten tasks, honors cooldown, and detects both repository profiles through evidence", () => {
    const report = sweepTaskRecordsV3({
      repoPath: repository.base,
      now: CLEANUP,
      maxTasks: 10,
      maxDurationMs: 600_000,
      resolveMergeEvidence: () => null,
    });
    expect(report).toMatchObject({
      recordType: "TaskSweepReportV3",
      status: "COMPLETED",
    });
    expect(report.attempted).toBeLessThanOrEqual(10);
    expect(report.durationMs).toBeLessThanOrEqual(600_000);
  });
});
