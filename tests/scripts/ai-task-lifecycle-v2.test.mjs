import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  computeWorktreeFingerprint,
  createTaskLifecycleService,
  handoffTask,
  parseTaskBranch,
  readLegacyCodexHints,
  readTaskStatus,
  resumeTask,
  startTask,
  taskWorktreePath,
  validateArtifactManifest,
  validateCleanupManifest,
  validateHandoffSnapshot,
  validateTaskRecordV2,
} from "../../scripts/lib/ai-task-lifecycle-v2.mjs";

const NOW = "2026-07-21T05:00:00.000Z";
const SHA = "a".repeat(40);
const FINGERPRINT = "b".repeat(64);
const tempRoots = [];

function tempRoot(prefix = "talkpik-task-v2-") {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function git(cwd, args, options = {}) {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
  }).trim();
}

function makeRepository() {
  const root = tempRoot();
  const remote = path.join(root, "remote.git");
  const seed = path.join(root, "seed");
  const base = path.join(root, "base");
  execFileSync("git", ["init", "--bare", remote]);
  execFileSync("git", ["init", "-b", "main", seed]);
  git(seed, ["config", "user.email", "test@example.com"]);
  git(seed, ["config", "user.name", "Lifecycle Test"]);
  writeFileSync(path.join(seed, "README.md"), "baseline\n");
  git(seed, ["add", "README.md"]);
  git(seed, ["commit", "-m", "baseline"]);
  git(seed, ["remote", "add", "origin", remote]);
  git(seed, ["push", "-u", "origin", "main"]);
  execFileSync("git", ["clone", "--branch", "main", remote, base]);
  git(base, ["config", "user.email", "test@example.com"]);
  git(base, ["config", "user.name", "Lifecycle Test"]);
  return { root, remote, seed, base };
}

function taskRecord(overrides = {}) {
  return {
    schemaVersion: 2,
    recordType: "TaskRecordV2",
    taskId: "feat-sample-task",
    type: "feat",
    slug: "sample-task",
    branch: "feat/sample-task",
    baseRef: "origin/main",
    baseSha: SHA,
    gitCommonDir: "C:/repo/.git",
    worktreePath: "C:/repo/.worktrees/feat-sample-task",
    state: "ACTIVE",
    activeActor: "codex",
    pendingActor: null,
    handoffFromActor: null,
    handoffSnapshotId: null,
    revision: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("AI task lifecycle v2 schema", () => {
  it.each([
    "feat/add-search",
    "fix/windows-path",
    "refactor/task-registry",
    "test/task-cleanup",
    "docs/agent-guide",
    "chore/ai-pipeline",
    "ci/lifecycle-check",
  ])("accepts the conventional task branch %s", (branch) => {
    expect(parseTaskBranch(branch)).toEqual({
      type: branch.split("/")[0],
      slug: branch.split("/")[1],
    });
  });

  it.each([
    "codex/add-search",
    "feature/add-search",
    "feat/Add-search",
    "feat/add_search",
    "feat/-add-search",
    "feat/add-search-",
    "feat/add/search",
    "feat/CON",
  ])("rejects the unsupported task branch %s", (branch) => {
    expect(() => parseTaskBranch(branch)).toThrowError("INVALID_TASK_BRANCH");
  });

  it("places official worktrees in the base checkout .worktrees directory", () => {
    expect(taskWorktreePath("C:/repo", "docs/agent-guide")).toBe(
      path.resolve("C:/repo", ".worktrees", "docs-agent-guide"),
    );
  });

  it("keeps public records closed, distinct, and free of secret or raw thread fields", () => {
    expect(validateTaskRecordV2(taskRecord())).toEqual([]);
    expect(
      validateHandoffSnapshot({
        schemaVersion: 2,
        recordType: "HandoffSnapshot",
        snapshotId: "handoff-1",
        taskId: "feat-sample-task",
        branch: "feat/sample-task",
        fromActor: "codex",
        toActor: "claude",
        revision: 2,
        headSha: SHA,
        statusHash: FINGERPRINT,
        fingerprint: FINGERPRINT,
        createdAt: NOW,
      }),
    ).toEqual([]);
    expect(
      validateArtifactManifest({
        schemaVersion: 2,
        recordType: "ArtifactManifest",
        taskId: "feat-sample-task",
        files: [
          {
            path: "desktop.png",
            sha256: FINGERPRINT,
            purpose: "final-ui-evidence",
          },
        ],
        updatedAt: NOW,
        finalEvidence: [],
      }),
    ).toContainEqual({ code: "UNKNOWN_FIELD", path: "finalEvidence" });
    expect(
      validateArtifactManifest({
        schemaVersion: 2,
        recordType: "ArtifactManifest",
        taskId: "feat-sample-task",
        files: [],
        updatedAt: NOW,
      }),
    ).toEqual([]);
    expect(
      validateCleanupManifest({
        schemaVersion: 2,
        recordType: "CleanupManifest",
        taskId: "feat-sample-task",
        reportOnly: true,
        snapshotFingerprint: FINGERPRINT,
        candidates: [],
        createdAt: NOW,
      }),
    ).toEqual([]);

    const unsafe = taskRecord({ token: "do-not-store", threadId: "raw-thread" });
    expect(validateTaskRecordV2(unsafe).map((error) => error.code)).toEqual(
      expect.arrayContaining(["UNKNOWN_FIELD", "SECRET_OR_THREAD_FIELD"]),
    );
  });
});

describe("task:start", () => {
  it("fetches origin and creates a branch/worktree from the pinned origin/main SHA", () => {
    const { base } = makeRepository();
    const expectedSha = git(base, ["rev-parse", "origin/main"]);

    const result = startTask({
      repoPath: base,
      branch: "feat/sample-task",
      actor: "codex",
      now: NOW,
    });

    expect(result.baseSha).toBe(expectedSha);
    expect(result.worktreePath).toBe(
      path.join(base, ".worktrees", "feat-sample-task"),
    );
    expect(git(result.worktreePath, ["rev-parse", "HEAD"])).toBe(expectedSha);
    expect(git(result.worktreePath, ["branch", "--show-current"])).toBe(
      "feat/sample-task",
    );
    expect(readTaskStatus({ repoPath: base, branch: "feat/sample-task" }).task).toMatchObject({
      recordType: "TaskRecordV2",
      state: "ACTIVE",
      activeActor: "codex",
      baseSha: expectedSha,
    });
  });

  it("fails closed when remote branch evidence is unavailable before fetch", () => {
    const { base, root } = makeRepository();
    git(base, ["remote", "set-url", "origin", path.join(root, "missing.git")]);

    expect(() =>
      startTask({ repoPath: base, branch: "fix/fetch-failure", actor: "codex", now: NOW }),
    ).toThrowError("REMOTE_BRANCH_EVIDENCE_UNAVAILABLE");
    expect(git(base, ["branch", "--list", "fix/fetch-failure"])).toBe("");
    expect(existsSync(path.join(base, ".worktrees", "fix-fetch-failure"))).toBe(false);
  });

  it("fails closed on a dirty base before fetching", () => {
    const { base } = makeRepository();
    writeFileSync(path.join(base, "dirty.txt"), "dirty\n");

    expect(() =>
      startTask({ repoPath: base, branch: "chore/dirty-base", actor: "manual", now: NOW }),
    ).toThrowError("BASE_DIRTY");
  });

  it("rejects stale expected base evidence", () => {
    const { base } = makeRepository();

    expect(() =>
      startTask({
        repoPath: base,
        branch: "test/stale-base",
        actor: "codex",
        now: NOW,
        expectedBaseSha: "b".repeat(40),
      }),
    ).toThrowError("STALE_BASE");
    expect(git(base, ["branch", "--list", "test/stale-base"])).toBe("");
  });

  it("rejects duplicate branch and duplicate or native-owned worktree paths", () => {
    const first = makeRepository();
    startTask({ repoPath: first.base, branch: "docs/duplicate", actor: "codex", now: NOW });
    expect(() =>
      startTask({ repoPath: first.base, branch: "docs/duplicate", actor: "codex", now: NOW }),
    ).toThrowError(/TASK_BRANCH_EXISTS|TASK_WORKTREE_OWNED/);

    const second = makeRepository();
    const desired = path.join(second.base, ".worktrees", "fix-native-owner");
    execFileSync("git", ["-C", second.base, "worktree", "add", "-b", "chore/other-owner", desired]);
    expect(() =>
      startTask({ repoPath: second.base, branch: "fix/native-owner", actor: "codex", now: NOW }),
    ).toThrowError("TASK_WORKTREE_OWNED");
  });

  it("rejects a task branch that already exists on origin", () => {
    const { base, seed } = makeRepository();
    git(seed, ["switch", "-c", "feat/remote-owned"]);
    git(seed, ["push", "origin", "feat/remote-owned"]);

    expect(() =>
      startTask({ repoPath: base, branch: "feat/remote-owned", actor: "codex", now: NOW }),
    ).toThrowError("REMOTE_TASK_BRANCH_EXISTS");
  });

  it("rejects an origin branch even when fetch refspec tracks only main", () => {
    const { base, seed } = makeRepository();
    git(seed, ["switch", "-c", "fix/remote-refspec-hidden"]);
    git(seed, ["push", "origin", "fix/remote-refspec-hidden"]);
    git(base, [
      "config",
      "remote.origin.fetch",
      "+refs/heads/main:refs/remotes/origin/main",
    ]);

    expect(() =>
      startTask({
        repoPath: base,
        branch: "fix/remote-refspec-hidden",
        actor: "codex",
        now: NOW,
      }),
    ).toThrowError("REMOTE_TASK_BRANCH_EXISTS");
    expect(git(base, ["branch", "--list", "fix/remote-refspec-hidden"])).toBe("");
    expect(existsSync(path.join(base, ".worktrees", "fix-remote-refspec-hidden"))).toBe(false);
  });

  it("rejects a Windows junction at the official .worktrees ancestor", () => {
    const { base } = makeRepository();
    const external = tempRoot("external-worktrees-");
    symlinkSync(external, path.join(base, ".worktrees"), "junction");

    expect(() =>
      startTask({ repoPath: base, branch: "fix/junction-escape", actor: "codex", now: NOW }),
    ).toThrowError("WORKTREE_PATH_ESCAPE");
    expect(readdirSync(external)).toEqual([]);
    expect(git(base, ["branch", "--list", "fix/junction-escape"])).toBe("");
  });

  it("rejects a Windows junction in the registry ancestor before creating a worktree", () => {
    const { base } = makeRepository();
    const external = tempRoot("external-registry-");
    const commonRaw = git(base, ["rev-parse", "--git-common-dir"]);
    const commonDir = path.resolve(base, commonRaw);
    symlinkSync(external, path.join(commonDir, "talkpik-task-lifecycle"), "junction");

    expect(() =>
      startTask({ repoPath: base, branch: "chore/registry-junction", actor: "codex", now: NOW }),
    ).toThrowError("REGISTRY_PATH_ESCAPE");
    expect(readdirSync(external)).toEqual([]);
    expect(existsSync(path.join(base, ".worktrees", "chore-registry-junction"))).toBe(false);
  });

  it("rolls back only a newly-created clean worktree after a post-create failure", () => {
    const { base } = makeRepository();
    const service = createTaskLifecycleService({
      persistTask() {
        const error = new Error("INJECTED_START_FAILURE");
        error.code = "INJECTED_START_FAILURE";
        throw error;
      },
    });
    const worktreePath = path.join(base, ".worktrees", "test-clean-rollback");

    expect(() =>
      service.startTask({ repoPath: base, branch: "test/clean-rollback", actor: "codex", now: NOW }),
    ).toThrowError("INJECTED_START_FAILURE");
    expect(existsSync(worktreePath)).toBe(false);
    expect(git(base, ["branch", "--list", "test/clean-rollback"])).toBe("");
    expect(git(base, ["worktree", "list", "--porcelain"])).not.toContain(worktreePath);
  });

  it("rolls back a baseSha branch when local main is behind fetched origin/main", () => {
    const { base, seed } = makeRepository();
    writeFileSync(path.join(seed, "new-origin-file.txt"), "new origin main\n");
    git(seed, ["add", "new-origin-file.txt"]);
    git(seed, ["commit", "-m", "advance origin main"]);
    git(seed, ["push", "origin", "main"]);
    const localMainBefore = git(base, ["rev-parse", "HEAD"]);
    const service = createTaskLifecycleService({
      persistTask() {
        const error = new Error("INJECTED_STALE_LOCAL_MAIN_FAILURE");
        error.code = "INJECTED_STALE_LOCAL_MAIN_FAILURE";
        throw error;
      },
    });
    const worktreePath = path.join(base, ".worktrees", "test-stale-local-main-rollback");

    expect(() =>
      service.startTask({
        repoPath: base,
        branch: "test/stale-local-main-rollback",
        actor: "codex",
        now: NOW,
      }),
    ).toThrowError("INJECTED_STALE_LOCAL_MAIN_FAILURE");
    expect(git(base, ["rev-parse", "HEAD"])).toBe(localMainBefore);
    expect(git(base, ["rev-parse", "origin/main"])).not.toBe(localMainBefore);
    expect(existsSync(worktreePath)).toBe(false);
    expect(git(base, ["branch", "--list", "test/stale-local-main-rollback"])).toBe("");
  });

  it("preserves a post-create worktree when rollback finds a user change", () => {
    const { base } = makeRepository();
    const service = createTaskLifecycleService({
      afterWorktreeCreated({ worktreePath }) {
        writeFileSync(path.join(worktreePath, "user-change.txt"), "preserve me\n");
        const error = new Error("INJECTED_DIRTY_FAILURE");
        error.code = "INJECTED_DIRTY_FAILURE";
        throw error;
      },
    });
    const worktreePath = path.join(base, ".worktrees", "test-dirty-preserve");

    expect(() =>
      service.startTask({ repoPath: base, branch: "test/dirty-preserve", actor: "codex", now: NOW }),
    ).toThrowError("START_FAILED_TASK_PRESERVED");
    expect(readFileSync(path.join(worktreePath, "user-change.txt"), "utf8")).toBe("preserve me\n");
    expect(git(base, ["branch", "--list", "test/dirty-preserve"])).toContain("test/dirty-preserve");
  });
});

describe("task handoff/resume", () => {
  it("keeps the worktree and transfers the actor only after fingerprint revalidation", () => {
    const { base } = makeRepository();
    const started = startTask({
      repoPath: base,
      branch: "refactor/agent-handoff",
      actor: "codex",
      now: NOW,
    });
    const before = computeWorktreeFingerprint(started.worktreePath);

    const pending = handoffTask({
      repoPath: started.worktreePath,
      branch: "refactor/agent-handoff",
      actor: "codex",
      toActor: "claude",
      now: "2026-07-21T05:01:00.000Z",
    });
    expect(pending).toMatchObject({ state: "HANDOFF_PENDING", activeActor: null, pendingActor: "claude" });
    expect(existsSync(started.worktreePath)).toBe(true);
    expect(pending.handoffSnapshot.fingerprint).not.toBe(before.fingerprint);
    expect(pending.handoffSnapshot).toMatchObject({
      taskId: "refactor-agent-handoff",
      branch: "refactor/agent-handoff",
      fromActor: "codex",
      toActor: "claude",
      revision: 2,
      snapshotId: pending.handoffSnapshotId,
      createdAt: "2026-07-21T05:01:00.000Z",
    });

    const resumed = resumeTask({
      repoPath: started.worktreePath,
      branch: "refactor/agent-handoff",
      actor: "claude",
      now: "2026-07-21T05:02:00.000Z",
    });
    expect(resumed).toMatchObject({ state: "ACTIVE", activeActor: "claude", pendingActor: null });
  });

  it("blocks resume after the handoff fingerprint changes", () => {
    const { base } = makeRepository();
    const started = startTask({ repoPath: base, branch: "fix/fingerprint", actor: "codex", now: NOW });
    handoffTask({
      repoPath: started.worktreePath,
      branch: "fix/fingerprint",
      actor: "codex",
      toActor: "claude",
      now: "2026-07-21T05:01:00.000Z",
    });
    writeFileSync(path.join(started.worktreePath, "changed-after-handoff.txt"), "changed\n");

    expect(() =>
      resumeTask({
        repoPath: started.worktreePath,
        branch: "fix/fingerprint",
        actor: "claude",
        now: "2026-07-21T05:02:00.000Z",
      }),
    ).toThrowError("HANDOFF_FINGERPRINT_MISMATCH");
  });

  it("detects content changes even when the dirty path list stays the same", () => {
    const { base } = makeRepository();
    const started = startTask({ repoPath: base, branch: "fix/content-fingerprint", actor: "codex", now: NOW });
    const dirtyFile = path.join(started.worktreePath, "same-dirty-path.txt");
    writeFileSync(dirtyFile, "first contents\n");
    handoffTask({
      repoPath: started.worktreePath,
      branch: "fix/content-fingerprint",
      actor: "codex",
      toActor: "claude",
      now: "2026-07-21T05:01:00.000Z",
    });
    writeFileSync(dirtyFile, "second contents\n");

    expect(() =>
      resumeTask({
        repoPath: started.worktreePath,
        branch: "fix/content-fingerprint",
        actor: "claude",
        now: "2026-07-21T05:02:00.000Z",
      }),
    ).toThrowError("HANDOFF_FINGERPRINT_MISMATCH");
  });

  it("blocks another actor while an actor is active or a different actor is pending", () => {
    const { base } = makeRepository();
    const started = startTask({ repoPath: base, branch: "test/actor-lock", actor: "codex", now: NOW });

    expect(() =>
      resumeTask({ repoPath: started.worktreePath, branch: "test/actor-lock", actor: "claude", now: NOW }),
    ).toThrowError("AGENT_ALREADY_ACTIVE");
    handoffTask({
      repoPath: started.worktreePath,
      branch: "test/actor-lock",
      actor: "codex",
      toActor: "claude",
      now: "2026-07-21T05:01:00.000Z",
    });
    expect(() =>
      resumeTask({ repoPath: started.worktreePath, branch: "test/actor-lock", actor: "manual", now: NOW }),
    ).toThrowError("HANDOFF_ACTOR_MISMATCH");
  });

  it("rejects handoff when the registered worktree switched or detached from its task branch", () => {
    const { base } = makeRepository();
    const started = startTask({ repoPath: base, branch: "fix/branch-owner", actor: "codex", now: NOW });
    git(started.worktreePath, ["switch", "-c", "chore/unrelated"]);

    expect(() =>
      handoffTask({
        repoPath: started.worktreePath,
        branch: "fix/branch-owner",
        actor: "codex",
        toActor: "claude",
        now: "2026-07-21T05:01:00.000Z",
      }),
    ).toThrowError("TASK_BRANCH_MISMATCH");
  });

  it("fails closed while another lifecycle process owns the task operation lock", () => {
    const { base } = makeRepository();
    const started = startTask({ repoPath: base, branch: "ci/process-lock", actor: "codex", now: NOW });
    const commonDir = git(started.worktreePath, ["rev-parse", "--git-common-dir"]);
    const lockPath = path.join(commonDir, "talkpik-task-lifecycle", "v2", "tasks", "ci-process-lock.lock");
    writeFileSync(lockPath, "other-process\n", { flag: "wx" });

    expect(() =>
      handoffTask({
        repoPath: started.worktreePath,
        branch: "ci/process-lock",
        actor: "codex",
        toActor: "claude",
        now: "2026-07-21T05:01:00.000Z",
      }),
    ).toThrowError("TASK_OPERATION_IN_PROGRESS");
  });

  it("does not delete a lock that was replaced by another owner", () => {
    const { base } = makeRepository();
    let replacedLockFile = null;
    const service = createTaskLifecycleService({
      afterWorktreeCreated({ lockFile }) {
        unlinkSync(lockFile);
        writeFileSync(lockFile, "other-owner\n", { flag: "wx" });
        replacedLockFile = lockFile;
      },
    });

    service.startTask({ repoPath: base, branch: "ci/lock-owner", actor: "codex", now: NOW });
    expect(readFileSync(replacedLockFile, "utf8")).toBe("other-owner\n");
  });

  it("rejects a handoff snapshot whose fromActor was changed after handoff", () => {
    const { base } = makeRepository();
    const started = startTask({ repoPath: base, branch: "fix/snapshot-actor", actor: "codex", now: NOW });
    const pending = handoffTask({
      repoPath: started.worktreePath,
      branch: "fix/snapshot-actor",
      actor: "codex",
      toActor: "claude",
      now: "2026-07-21T05:01:00.000Z",
    });
    const snapshotFile = path.join(
      started.gitCommonDir,
      "talkpik-task-lifecycle",
      "v2",
      "handoffs",
      `${pending.handoffSnapshotId}.json`,
    );
    const snapshot = JSON.parse(readFileSync(snapshotFile, "utf8"));
    snapshot.fromActor = "manual";
    writeFileSync(snapshotFile, `${JSON.stringify(snapshot, null, 2)}\n`);

    expect(() =>
      resumeTask({
        repoPath: started.worktreePath,
        branch: "fix/snapshot-actor",
        actor: "claude",
        now: "2026-07-21T05:02:00.000Z",
      }),
    ).toThrowError("HANDOFF_SNAPSHOT_MISMATCH");
  });

  it("reads legacy Codex registry files only as display hints", () => {
    const root = tempRoot("legacy-codex-");
    const repoId = "talkpik-v13";
    const legacyDir = path.join(root, "worktree-lifecycle", repoId);
    mkdirSync(legacyDir, { recursive: true });
    writeFileSync(
      path.join(legacyDir, "hint.json"),
      JSON.stringify({ schemaVersion: 1, taskId: "old-task", worktreePath: "C:/old", owner: "codex-desktop" }),
    );

    const before = readFileSync(path.join(legacyDir, "hint.json"), "utf8");
    expect(readLegacyCodexHints({ codexHome: root, repoId })).toEqual([
      { taskId: "old-task", worktreePath: "C:/old", owner: "codex-desktop" },
    ]);
    expect(readFileSync(path.join(legacyDir, "hint.json"), "utf8")).toBe(before);
  });
});

describe("public package CLI", () => {
  it("keeps the official .worktrees container out of base checkout status", () => {
    expect(() => git(path.resolve("."), ["check-ignore", "-q", ".worktrees/task-probe"])).not.toThrow();
  });

  it("exposes the four lifecycle commands through package.json", () => {
    const packageJson = JSON.parse(readFileSync(path.resolve("package.json"), "utf8"));
    expect(packageJson.scripts).toMatchObject({
      "task:start": "node scripts/ai-task.mjs start",
      "task:status": "node scripts/ai-task.mjs status",
      "task:handoff": "node scripts/ai-task.mjs handoff",
      "task:resume": "node scripts/ai-task.mjs resume",
    });
  });

  it("starts, reports, hands off, and resumes one task without changing worktrees", () => {
    const { base } = makeRepository();
    const script = path.resolve("scripts/ai-task.mjs");
    const run = (args, cwd = base) =>
      execFileSync(process.execPath, [script, ...args], {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();

    const started = JSON.parse(
      run(["start", "--repo", base, "--branch", "chore/cli-flow", "--actor", "codex", "--now", NOW]),
    );
    const status = JSON.parse(
      run(["status", "--repo", started.worktreePath, "--branch", "chore/cli-flow"], started.worktreePath),
    );
    expect(status.task.activeActor).toBe("codex");

    const pending = JSON.parse(
      run(
        [
          "handoff",
          "--repo",
          started.worktreePath,
          "--branch",
          "chore/cli-flow",
          "--actor",
          "codex",
          "--to",
          "claude",
          "--now",
          "2026-07-21T05:01:00.000Z",
        ],
        started.worktreePath,
      ),
    );
    expect(pending.state).toBe("HANDOFF_PENDING");
    const resumed = JSON.parse(
      run(
        [
          "resume",
          "--repo",
          started.worktreePath,
          "--branch",
          "chore/cli-flow",
          "--actor",
          "claude",
          "--now",
          "2026-07-21T05:02:00.000Z",
        ],
        started.worktreePath,
      ),
    );
    expect(resumed).toMatchObject({ state: "ACTIVE", activeActor: "claude" });
    expect(existsSync(started.worktreePath)).toBe(true);
  });
});
