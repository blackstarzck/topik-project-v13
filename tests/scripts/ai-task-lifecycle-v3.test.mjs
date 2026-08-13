import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  claimTaskV3,
  createTaskRecordV3,
  discoverUnregisteredWorktreesV3,
  migrateTaskRecordV2,
  parseRepositoryIdentity,
  planTaskCleanupV3,
  prepareTask,
  readRuntimeSnapshotV3,
  readTaskRecordV3,
  readTaskRecordV3ByBranch,
  reconcileDelegatedCleanupV3,
  reconcileTaskRecordsV3WithV2,
  runTaskCommandV3,
  sweepTaskRecordsV3,
  transitionTaskCleanupV3,
  validateTaskRecordV3,
  writeTaskRecordV3,
} from "../../scripts/lib/ai-task-lifecycle-v3.mjs";
import { runTaskLifecycleCommand } from "../../scripts/ai-task.mjs";
import { finalizeTask } from "../../scripts/lib/ai-task-cleanup.mjs";

const NOW = "2026-07-23T01:00:00.000Z";
const LATER = "2026-07-23T01:01:00.000Z";
const EVEN_LATER = "2026-07-23T01:02:00.000Z";
const tempRoots = [];
let repositoryTemplateRoot;

function git(cwd, args) {
  const gitArgs =
    args[0] === "commit"
      ? [
          "-c",
          "user.email=test@example.com",
          "-c",
          "user.name=Lifecycle V3 Test",
          ...args,
        ]
      : args;
  return execFileSync("git", ["-C", cwd, ...gitArgs], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 10_000,
    windowsHide: true,
  }).trim();
}

function initializeRepository(root) {
  const remote = path.join(root, "remote.git");
  const base = path.join(root, "base");
  execFileSync("git", ["init", "--bare", remote], { timeout: 10_000 });
  execFileSync("git", ["init", "-b", "main", base], { timeout: 10_000 });
  writeFileSync(path.join(base, "README.md"), "baseline\n");
  git(base, ["add", "README.md"]);
  git(base, ["commit", "-m", "baseline"]);
  git(base, ["remote", "add", "origin", pathToFileURL(remote).href]);
  git(base, ["push", "-u", "origin", "main"]);
  writeFileSync(path.join(base, ".git", "info", "exclude"), ".worktrees/\n");
  return { root, remote, base, sha: git(base, ["rev-parse", "HEAD"]) };
}

function makeRepository(prefix = "talkpik-v3-") {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  tempRoots.push(root);
  const remote = path.join(root, "remote.git");
  const base = path.join(root, "base");
  cpSync(path.join(repositoryTemplateRoot, "remote.git"), remote, {
    recursive: true,
  });
  cpSync(path.join(repositoryTemplateRoot, "base"), base, { recursive: true });
  git(base, ["remote", "set-url", "origin", pathToFileURL(remote).href]);
  return { root, remote, base, sha: git(base, ["rev-parse", "HEAD"]) };
}

function commonDir(repoPath) {
  const raw = git(repoPath, ["rev-parse", "--git-common-dir"]);
  return realpathSync.native(path.resolve(repoPath, raw));
}

function validRecord(repository, overrides = {}) {
  return createTaskRecordV3({
    taskId: "task-independent-001",
    repoProfile: {
      name: "topik-project-v13",
      remote: "origin",
      repositoryIdentity: "local/test/topik-project-v13",
      authLogin: "local",
      baseBranch: "main",
    },
    baseSha: repository.sha,
    headSha: repository.sha,
    branch: { name: "feat/sample-v3", type: "feat", slug: "sample-v3" },
    workspace: {
      kind: "isolated",
      ownership: "managed",
      path: path.join(repository.base, ".worktrees", "feat-sample-v3"),
      gitDir: path.join(commonDir(repository.base), "worktrees", "feat-sample-v3"),
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
    updatedAt: NOW,
    ...overrides,
  });
}

beforeAll(() => {
  repositoryTemplateRoot = mkdtempSync(
    path.join(tmpdir(), "talkpik-v3-template-"),
  );
  initializeRepository(repositoryTemplateRoot);
});

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

afterAll(() => {
  rmSync(repositoryTemplateRoot, { recursive: true, force: true });
});

describe("TaskRecordV3", () => {
  it("is closed, deterministic, branch-independent, and secret safe", () => {
    const repository = makeRepository();
    const record = validRecord(repository);
    expect(validateTaskRecordV3(record)).toEqual([]);
    expect(record.taskId).not.toBe(record.branch.name);
    expect(createTaskRecordV3({ ...record, fingerprint: undefined }).fingerprint).toBe(record.fingerprint);
    expect(validateTaskRecordV3({ ...record, token: "never" })).toContainEqual(
      expect.objectContaining({ code: "UNKNOWN_FIELD" }),
    );
    expect(validateTaskRecordV3({ ...record, runtimeRef: "session id: 550e8400-e29b-41d4-a716-446655440000" }))
      .toContainEqual(expect.objectContaining({ code: "SECRET_OR_THREAD_VALUE" }));
  });

  it("writes atomically under the Git common directory and rejects linked registry paths", () => {
    const repository = makeRepository();
    const record = validRecord(repository);
    const stored = writeTaskRecordV3({ repoPath: repository.base, record });
    expect(readTaskRecordV3({ repoPath: repository.base, taskId: record.taskId })).toEqual(stored);

    const lifecycle = path.join(commonDir(repository.base), "talkpik-task-lifecycle");
    rmSync(path.join(lifecycle, "v3"), { recursive: true, force: true });
    const outside = path.join(repository.root, "outside");
    mkdirSync(outside);
    try {
      symlinkSync(outside, path.join(lifecycle, "v3"), "junction");
    } catch {
      return;
    }
    expect(() => writeTaskRecordV3({ repoPath: repository.base, record }))
      .toThrowError("V3_REGISTRY_PATH_ESCAPE");
  });

  it("rejects managed workspace path escape and case-insensitive collisions", () => {
    const repository = makeRepository();
    const escaped = validRecord(repository, {
      workspace: {
        kind: "isolated",
        ownership: "managed",
        path: path.join(repository.root, "outside"),
        gitDir: path.join(commonDir(repository.base), "worktrees", "outside"),
      },
    });
    expect(validateTaskRecordV3(escaped, { repoPath: repository.base }))
      .toContainEqual(expect.objectContaining({ code: "WORKSPACE_PATH_ESCAPE" }));

    writeTaskRecordV3({ repoPath: repository.base, record: validRecord(repository) });
    const colliding = validRecord(repository, {
      taskId: "task-independent-002",
      branch: { name: "fix/other-v3", type: "fix", slug: "other-v3" },
      workspace: {
        ...validRecord(repository).workspace,
        path: validRecord(repository).workspace.path.toUpperCase(),
      },
    });
    expect(() => writeTaskRecordV3({ repoPath: repository.base, record: colliding }))
      .toThrowError("V3_WORKSPACE_COLLISION");
  });

  it("parses only credential-free repository identities", () => {
    expect(parseRepositoryIdentity("https://github.com/blackstarzck/topik-project-v13.git")).toEqual({
      host: "github.com",
      owner: "blackstarzck",
      repository: "topik-project-v13",
      identity: "github.com/blackstarzck/topik-project-v13",
    });
    expect(parseRepositoryIdentity("git@github.com:keduall/topik-project-v13.git").identity)
      .toBe("github.com/keduall/topik-project-v13");
    expect(() => parseRepositoryIdentity("https://person:token@github.com/owner/repo.git"))
      .toThrowError("ORIGIN_URL_CREDENTIALS_FORBIDDEN");
    expect(() => parseRepositoryIdentity("ftp://github.com/owner/repo.git"))
      .toThrowError("ORIGIN_URL_UNSUPPORTED");
    for (const local of [
      "C:\\fixture\\credential-free\\remote.git",
      "C:/fixture/credential-free/remote.git",
      "file:///C:/fixture/credential-free/remote.git",
    ]) {
      const parsed = parseRepositoryIdentity(local);
      expect(parsed.identity).toMatch(/^local:[a-f0-9]{64}$/u);
      expect(parsed.identity).not.toContain("fixture");
    }
  });

  it("requires revision and fingerprint CAS for every existing public record write", () => {
    const repository = makeRepository();
    const current = writeTaskRecordV3({ repoPath: repository.base, record: validRecord(repository) });
    const next = createTaskRecordV3({
      ...current,
      revision: 2,
      updatedAt: LATER,
    });
    expect(() => writeTaskRecordV3({ repoPath: repository.base, record: next }))
      .toThrowError("V3_RECORD_EXISTS");
    expect(writeTaskRecordV3({
      repoPath: repository.base,
      record: next,
      expectedRevision: current.revision,
      expectedFingerprint: current.fingerprint,
    })).toEqual(next);
    expect(() => writeTaskRecordV3({
      repoPath: repository.base,
      record: createTaskRecordV3({ ...next, revision: 3, updatedAt: EVEN_LATER }),
      expectedRevision: current.revision,
      expectedFingerprint: current.fingerprint,
    })).toThrowError("V3_RECORD_STALE");
  });
});

describe("v2 copy-only migration", () => {
  function writeV2(repository, { worktreeExists = true, cleaned = false } = {}) {
    const root = path.join(commonDir(repository.base), "talkpik-task-lifecycle", "v2");
    mkdirSync(path.join(root, "tasks"), { recursive: true });
    mkdirSync(path.join(root, "cleanups"), { recursive: true });
    const worktreePath = path.join(repository.base, ".worktrees", "feat-legacy-task");
    if (worktreeExists) {
      mkdirSync(path.dirname(worktreePath), { recursive: true });
      git(repository.base, ["worktree", "add", "-b", "feat/legacy-task", worktreePath, repository.sha]);
    }
    const record = {
      schemaVersion: 2,
      recordType: "TaskRecordV2",
      taskId: "feat-legacy-task",
      type: "feat",
      slug: "legacy-task",
      branch: "feat/legacy-task",
      baseRef: "origin/main",
      baseSha: repository.sha,
      gitCommonDir: commonDir(repository.base),
      worktreePath,
      state: "ACTIVE",
      activeActor: "codex",
      pendingActor: null,
      handoffFromActor: null,
      handoffSnapshotId: null,
      revision: 1,
      createdAt: NOW,
      updatedAt: NOW,
    };
    writeFileSync(path.join(root, "tasks", "feat-legacy-task.json"), `${JSON.stringify(record)}\n`);
    if (cleaned) {
      const cleanup = {
        schemaVersion: 2,
        recordType: "CleanupManifest",
        taskId: record.taskId,
        reportOnly: false,
        snapshotFingerprint: "b".repeat(64),
        candidates: [],
        createdAt: NOW,
        status: "CLEANED",
        completedSteps: [
          "TASK_ARTIFACTS_REMOVED",
          "WORKTREE_REMOVED",
          "WORKTREE_ABSENCE_VERIFIED",
          "LOCAL_BRANCH_REMOVED",
          "REMOTE_BRANCH_ABSENCE_VERIFIED",
        ],
        branch: record.branch,
        worktreePath,
        headSha: repository.sha,
        inventoryDigest: "c".repeat(64),
        disposableCandidates: [],
        candidateProgress: [],
        updatedAt: NOW,
        cleanedAt: NOW,
        taskRevision: 1,
        taskState: "ACTIVE",
        runtimeDigest: "d".repeat(64),
        prNumber: 1,
        prState: "MERGED",
        prBaseRefName: "main",
        prHeadRefName: record.branch,
        mergeCommitOid: repository.sha,
        mergedAt: NOW,
        originMainSha: repository.sha,
        remoteState: "absent",
      };
      writeFileSync(path.join(root, "cleanups", "feat-legacy-task.json"), `${JSON.stringify(cleanup)}\n`);
    }
    return { record, taskFile: path.join(root, "tasks", "feat-legacy-task.json") };
  }

  it("copies active v2 records idempotently without modifying their source", () => {
    const repository = makeRepository();
    const legacy = writeV2(repository);
    const before = readFileSync(legacy.taskFile, "utf8");
    const first = migrateTaskRecordV2({ repoPath: repository.base, branch: legacy.record.branch, now: LATER });
    const second = migrateTaskRecordV2({ repoPath: repository.base, branch: legacy.record.branch, now: LATER });
    expect(first.record.state).toBe("ACTIVE");
    expect(first.record.workspace).toMatchObject({ kind: "isolated", ownership: "managed" });
    expect(second.record).toEqual(first.record);
    expect(second.journal).toEqual(first.journal);
    expect(second.reused).toBe(true);
    expect(readFileSync(legacy.taskFile, "utf8")).toBe(before);
  });

  it("maps a valid cleaned tombstone to CLEANED and missing workspace to PRESERVED", () => {
    const cleanedRepo = makeRepository("talkpik-v3-cleaned-");
    const cleaned = writeV2(cleanedRepo, { worktreeExists: false, cleaned: true });
    expect(migrateTaskRecordV2({ repoPath: cleanedRepo.base, branch: cleaned.record.branch, now: LATER }).record.state)
      .toBe("CLEANED");

    const missingRepo = makeRepository("talkpik-v3-missing-");
    const missing = writeV2(missingRepo, { worktreeExists: false });
    const result = migrateTaskRecordV2({ repoPath: missingRepo.base, branch: missing.record.branch, now: LATER });
    expect(result.record.state).toBe("PRESERVED");
    expect(result.record.blockers).toContain("V2_WORKSPACE_MISSING");
  });

  it("discovers but never imports unregistered native worktrees", () => {
    const repository = makeRepository();
    const worktree = path.join(repository.root, "native-worktree");
    git(repository.base, ["worktree", "add", "-b", "feat/native-only", worktree, repository.sha]);
    const discovery = discoverUnregisteredWorktreesV3({ repoPath: repository.base });
    expect(discovery.some((entry) => entry.path === realpathSync.native(worktree))).toBe(true);
    const tasksDir = path.join(commonDir(repository.base), "talkpik-task-lifecycle", "v3", "tasks");
    expect(existsSync(tasksDir) ? readdirSync(tasksDir) : []).toEqual([]);
  });

  it("rejects linked v2 cleanup parents before reading a tombstone", () => {
    const repository = makeRepository();
    const legacy = writeV2(repository, { worktreeExists: false });
    const v2Root = path.join(commonDir(repository.base), "talkpik-task-lifecycle", "v2");
    rmSync(path.join(v2Root, "cleanups"), { recursive: true, force: true });
    const outside = path.join(repository.root, "outside-cleanups");
    mkdirSync(outside);
    try {
      symlinkSync(outside, path.join(v2Root, "cleanups"), "junction");
    } catch {
      return;
    }
    expect(() => migrateTaskRecordV2({
      repoPath: repository.base,
      branch: legacy.record.branch,
      now: LATER,
    })).toThrowError("V3_REGISTRY_PATH_ESCAPE");
  });
});

describe("task prepare and shared workspace", () => {
  it("keeps task:start V2 output while immediately making the task V3-visible", async () => {
    const repository = makeRepository();
    const started = await runTaskLifecycleCommand({
      command: "start",
      values: {
        repo: repository.base,
        branch: "feat/v2-start-v3-copy",
        actor: "codex",
        now: NOW,
      },
    }, { launchSweep: () => false });
    expect(started).toMatchObject({
      recordType: "TaskRecordV2",
      branch: "feat/v2-start-v3-copy",
      state: "ACTIVE",
    });
    expect(Object.hasOwn(started, "v3")).toBe(false);
    expect(readTaskRecordV3ByBranch({
      repoPath: repository.base,
      branch: started.branch,
    })).toMatchObject({
      recordType: "TaskRecordV3",
      workspace: { kind: "isolated", ownership: "managed" },
    });

    const partial = await runTaskLifecycleCommand({
      command: "start",
      values: {
        repo: repository.base,
        branch: "fix/v3-copy-failure",
        actor: "codex",
        now: LATER,
      },
    }, {
      launchSweep: () => false,
      migrateStartedTask() {
        throw new Error("simulated migration failure");
      },
    });
    expect(partial).toMatchObject({
      branch: "fix/v3-copy-failure",
      v3Status: "PARTIAL_START_PRESERVED",
      v3Recovery: {
        recordType: "TaskStartRecoveryV3",
        blocker: "V3_COPY_FAILED",
      },
    });
    expect(existsSync(partial.worktreePath)).toBe(true);
  });

  it("routes task:prepare through the public CLI without requiring a branch for read-only work", () => {
    const root = mkdtempSync(path.join(tmpdir(), "talkpik-v3-cli-readonly-"));
    tempRoots.push(root);
    const cliPath = path.resolve(import.meta.dirname, "../../scripts/ai-task.mjs");
    const result = execFileSync(
      process.execPath,
      [cliPath, "prepare", "--repo", root, "--intent", "read-only"],
      {
        encoding: "utf8",
        shell: false,
        timeout: 10_000,
        windowsHide: true,
      },
    );
    expect(JSON.parse(result)).toMatchObject({
      status: "READY",
      intent: "read-only",
      resourcesCreated: false,
    });
    const packageJson = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../../package.json"), "utf8"));
    expect(packageJson.scripts["task:prepare"]).toBe("node scripts/ai-task.mjs prepare");
  });

  it("classifies read-only work without executing Git or writing a registry", () => {
    const root = mkdtempSync(path.join(tmpdir(), "talkpik-v3-readonly-"));
    tempRoots.push(root);
    let calls = 0;
    const result = prepareTask({
      repoPath: root,
      intent: "read-only",
      gitRunner() {
        calls += 1;
        throw new Error("must not call git");
      },
    });
    expect(result).toMatchObject({ status: "READY", intent: "read-only", resourcesCreated: false });
    expect(calls).toBe(0);
    expect(existsSync(path.join(root, ".git"))).toBe(false);
  });

  it("launches a one-shot catch-up sweep only after code preparation succeeds", async () => {
    const readOnlyRoot = mkdtempSync(path.join(tmpdir(), "talkpik-v3-readonly-sweep-"));
    tempRoots.push(readOnlyRoot);
    const scheduled = [];
    const launchSweep = (request) => {
      scheduled.push(request);
      return true;
    };

    await runTaskLifecycleCommand({
      command: "prepare",
      values: {
        repo: readOnlyRoot,
        intent: "read-only",
      },
    }, { launchSweep });
    expect(scheduled).toEqual([]);

    const repository = makeRepository();
    const prepared = await runTaskLifecycleCommand({
      command: "prepare",
      values: {
        repo: repository.base,
        intent: "code",
        branch: "feat/prepare-catch-up-sweep",
        actor: "codex",
        workspace: "shared-slot",
        now: NOW,
      },
    }, {
      launchSweep,
      currentCliPath: path.resolve(import.meta.dirname, "../../scripts/ai-task.mjs"),
    });

    expect(prepared).toMatchObject({ status: "STARTED", intent: "code" });
    expect(scheduled).toEqual([
      {
        baseRepoPath: path.resolve(repository.base),
        cliPath: path.resolve(import.meta.dirname, "../../scripts/ai-task.mjs"),
      },
    ]);

    await expect(
      runTaskLifecycleCommand(
        {
          command: "prepare",
          values: {
            repo: repository.base,
            intent: "code",
            branch: "feat/prepare-catch-up-sweep",
            actor: "codex",
            workspace: "shared-slot",
            now: LATER,
          },
        },
        {
          launchSweep() {
            throw new Error("background launch unavailable");
          },
        },
      ),
    ).resolves.toMatchObject({ intent: "code", resourcesCreated: false });
  });

  it("creates the shared slot once from the exact pulled origin/main and reuses the exact active task", () => {
    const repository = makeRepository();
    const first = prepareTask({
      repoPath: repository.base,
      intent: "code",
      branch: "feat/shared-task",
      actor: "codex",
      workspace: "auto",
      now: NOW,
    });
    expect(first.status).toBe("STARTED");
    expect(first.task.workspace).toMatchObject({ kind: "shared-slot", ownership: "managed" });
    expect(first.task.workspace.path).toBe(realpathSync.native(path.join(repository.base, ".worktrees", "shared-dev")));
    expect(git(first.task.workspace.path, ["rev-parse", "HEAD"])).toBe(first.task.baseSha);

    const reused = prepareTask({
      repoPath: repository.base,
      intent: "code",
      branch: "feat/shared-task",
      actor: "codex",
      workspace: "auto",
      now: LATER,
    });
    expect(reused.status).toBe("REUSED");
    expect(reused.task.taskId).toBe(first.task.taskId);

    const merged = createTaskRecordV3({
      ...first.task,
      state: "MERGED",
      revision: 2,
      updatedAt: LATER,
    });
    writeTaskRecordV3({
      repoPath: repository.base,
      record: merged,
      expectedRevision: first.task.revision,
      expectedFingerprint: first.task.fingerprint,
    });
    const cleaned = transitionTaskCleanupV3(merged, { result: "CLEANED", now: EVEN_LATER });
    writeTaskRecordV3({
      repoPath: repository.base,
      record: cleaned,
      expectedRevision: merged.revision,
      expectedFingerprint: merged.fingerprint,
    });
    const next = prepareTask({
      repoPath: repository.base,
      intent: "code",
      branch: "fix/reused-slot",
      actor: "claude",
      workspace: "shared-slot",
      now: "2026-07-23T01:03:00.000Z",
    });
    expect(next.status).toBe("STARTED");
    expect(next.task.workspace.path).toBe(first.task.workspace.path);
    expect(next.task.taskId).not.toBe(first.task.taskId);
  });

  it("serializes the repository shared slot and keeps its journal aligned with the winning record", () => {
    const repository = makeRepository();
    const first = prepareTask({
      repoPath: repository.base,
      intent: "code",
      branch: "feat/shared-lock-seed",
      actor: "codex",
      workspace: "shared-slot",
      now: NOW,
    });
    const merged = createTaskRecordV3({
      ...first.task,
      state: "MERGED",
      revision: 2,
      updatedAt: LATER,
    });
    writeTaskRecordV3({
      repoPath: repository.base,
      record: merged,
      expectedRevision: first.task.revision,
      expectedFingerprint: first.task.fingerprint,
    });
    const cleaned = transitionTaskCleanupV3(merged, { result: "CLEANED", now: EVEN_LATER });
    writeTaskRecordV3({
      repoPath: repository.base,
      record: cleaned,
      expectedRevision: merged.revision,
      expectedFingerprint: merged.fingerprint,
    });

    let interleaved = false;
    let competing = null;
    let competingError = null;
    const winner = prepareTask({
      repoPath: repository.base,
      intent: "code",
      branch: "fix/shared-lock-winner",
      actor: "codex",
      workspace: "shared-slot",
      now: "2026-07-23T01:03:00.000Z",
      gitRunner(repoPath, args, { defaultRunner }) {
        if (!interleaved && repoPath === first.task.workspace.path && args[0] === "status") {
          interleaved = true;
          try {
            competing = prepareTask({
              repoPath: repository.base,
              intent: "code",
              branch: "fix/shared-lock-loser",
              actor: "claude",
              workspace: "shared-slot",
              now: "2026-07-23T01:03:01.000Z",
            });
          } catch (error) {
            competingError = error;
          }
        }
        return defaultRunner(repoPath, args);
      },
    });
    expect(winner.status).toBe("STARTED");
    expect(competing).toBeNull();
    expect(competingError?.code).toBe("V3_TASK_OPERATION_IN_PROGRESS");
    expect(git(first.task.workspace.path, ["branch", "--show-current"]))
      .toBe(winner.task.branch.name);
    expect(readTaskRecordV3ByBranch({
      repoPath: repository.base,
      branch: winner.task.branch.name,
    })?.workspace.path).toBe(first.task.workspace.path);
    expect(JSON.parse(readFileSync(path.join(
      commonDir(repository.base),
      "talkpik-task-lifecycle",
      "v3",
      "operations",
      "shared-slot.json",
    ), "utf8"))).toMatchObject({
      recordType: "SharedSlotOperationV1",
      branch: winner.task.branch.name,
      stage: "COMPLETED",
      blocker: null,
    });
  });

  it("advances a descendant HEAD with CAS but preserves a rewound task", () => {
    const repository = makeRepository();
    const first = prepareTask({
      repoPath: repository.base,
      intent: "code",
      branch: "feat/live-mismatch",
      actor: "codex",
      workspace: "shared-slot",
      now: NOW,
    });
    writeFileSync(path.join(first.task.workspace.path, "commit.txt"), "new head\n");
    git(first.task.workspace.path, ["add", "commit.txt"]);
    git(first.task.workspace.path, ["commit", "-m", "advance task head"]);
    expect(runTaskCommandV3({
      command: "status",
      repoPath: repository.base,
      branch: first.task.branch.name,
    }).result).toMatchObject({ blockers: [], task: { state: "ACTIVE", revision: 1 } });
    expect(readTaskRecordV3({ repoPath: repository.base, taskId: first.task.taskId }))
      .toMatchObject({ state: "ACTIVE", revision: 1 });
    const continued = prepareTask({
      repoPath: repository.base,
      intent: "code",
      branch: "feat/live-mismatch",
      actor: "codex",
      workspace: "auto",
      now: LATER,
    });
    expect(continued).toMatchObject({
      status: "REUSED",
      task: { headSha: git(first.task.workspace.path, ["rev-parse", "HEAD"]), revision: 2 },
    });
    git(first.task.workspace.path, ["reset", "--hard", first.task.baseSha]);
    expect(() => prepareTask({
      repoPath: repository.base,
      intent: "code",
      branch: "feat/live-mismatch",
      actor: "codex",
      workspace: "auto",
      now: EVEN_LATER,
    })).toThrowError("V3_ACTIVE_WORKSPACE_MISMATCH");
    expect(readTaskRecordV3({ repoPath: repository.base, taskId: first.task.taskId }))
      .toMatchObject({ state: "PRESERVED", blockers: ["ACTIVE_WORKSPACE_HEAD_MISMATCH"] });
  });

  it("locks an ACTIVE task while validating reuse so an interleaved handoff cannot win", () => {
    const repository = makeRepository();
    const first = prepareTask({
      repoPath: repository.base,
      intent: "code",
      branch: "feat/reuse-lock",
      actor: "codex",
      workspace: "shared-slot",
      now: NOW,
    });
    let handoffError = null;
    const reused = prepareTask({
      repoPath: repository.base,
      intent: "code",
      branch: first.task.branch.name,
      actor: "codex",
      workspace: "auto",
      now: LATER,
      reuseInterleave() {
        try {
          runTaskCommandV3({
            command: "handoff",
            action: "offer",
            repoPath: repository.base,
            branch: first.task.branch.name,
            actor: "codex",
            toActor: "claude",
            now: EVEN_LATER,
          });
        } catch (error) {
          handoffError = error;
        }
      },
    });
    expect(handoffError?.code).toBe("V3_TASK_OPERATION_IN_PROGRESS");
    expect(reused).toMatchObject({
      status: "REUSED",
      task: {
        activeActor: "codex",
        pendingActor: null,
        revision: first.task.revision,
        fingerprint: first.task.fingerprint,
      },
    });
  });

  it("offers a choice instead of silently creating isolated space when shared slot is busy or dirty", () => {
    const repository = makeRepository();
    const first = prepareTask({
      repoPath: repository.base,
      intent: "code",
      branch: "feat/first-shared",
      actor: "codex",
      workspace: "shared-slot",
      now: NOW,
    });
    const busy = prepareTask({
      repoPath: repository.base,
      intent: "code",
      branch: "fix/second-shared",
      actor: "claude",
      workspace: "auto",
      now: LATER,
    });
    expect(busy).toMatchObject({
      status: "CHOICE_REQUIRED",
      blockers: ["SHARED_SLOT_BUSY"],
      choices: ["shared-slot", "isolated"],
    });
    expect(existsSync(path.join(repository.base, ".worktrees", "fix-second-shared"))).toBe(false);

    writeFileSync(path.join(first.task.workspace.path, "dirty.txt"), "preserve\n");
    const dirty = prepareTask({
      repoPath: repository.base,
      intent: "code",
      branch: "fix/third-shared",
      actor: "claude",
      workspace: "auto",
      now: LATER,
    });
    expect(dirty.blockers).toContain("SHARED_SLOT_DIRTY");

    unlinkSync(path.join(first.task.workspace.path, "dirty.txt"));
    const preserved = createTaskRecordV3({
      ...first.task,
      state: "PRESERVED",
      activeActor: null,
      blockers: ["MANUAL_REVIEW_REQUIRED"],
      revision: 2,
      updatedAt: EVEN_LATER,
    });
    writeTaskRecordV3({
      repoPath: repository.base,
      record: preserved,
      expectedRevision: first.task.revision,
      expectedFingerprint: first.task.fingerprint,
    });
    const preservedChoice = prepareTask({
      repoPath: repository.base,
      intent: "code",
      branch: "fix/preserved-slot",
      actor: "claude",
      workspace: "auto",
      now: "2026-07-23T01:03:00.000Z",
    });
    expect(preservedChoice).toMatchObject({
      status: "CHOICE_REQUIRED",
      blockers: ["SHARED_SLOT_PRESERVED"],
    });
    expect(planTaskCleanupV3(preserved)).toEqual({
      strategy: "preserve-only",
      preserveWorkspace: true,
      actions: ["PRESERVE_ALL_RESOURCES"],
    });
  });

  it("creates an explicit isolated task through the compatible v2 lifecycle", () => {
    const repository = makeRepository();
    const result = prepareTask({
      repoPath: repository.base,
      intent: "code",
      branch: "fix/isolated-v3",
      actor: "claude",
      workspace: "isolated",
      now: NOW,
    });
    expect(result.status).toBe("STARTED");
    expect(result.task.workspace.kind).toBe("isolated");
    expect(existsSync(result.task.workspace.path)).toBe(true);
    expect(result.v2Compatible).toBe(true);
  });

  it("fails closed for invalid branch, dirty base, and in-progress Git operation", () => {
    const invalidRepo = makeRepository("talkpik-v3-invalid-");
    expect(() => prepareTask({
      repoPath: invalidRepo.base,
      intent: "code",
      branch: "bad/branch",
      actor: "codex",
      workspace: "auto",
      now: NOW,
    })).toThrowError("INVALID_TASK_BRANCH");

    const dirtyRepo = makeRepository("talkpik-v3-dirty-");
    writeFileSync(path.join(dirtyRepo.base, "dirty.txt"), "dirty\n");
    expect(() => prepareTask({
      repoPath: dirtyRepo.base,
      intent: "code",
      branch: "feat/dirty-base",
      actor: "codex",
      workspace: "auto",
      now: NOW,
    })).toThrowError("BASE_DIRTY");

    const opRepo = makeRepository("talkpik-v3-operation-");
    writeFileSync(path.join(commonDir(opRepo.base), "MERGE_HEAD"), opRepo.sha);
    expect(() => prepareTask({
      repoPath: opRepo.base,
      intent: "code",
      branch: "feat/operation-base",
      actor: "codex",
      workspace: "auto",
      now: NOW,
    })).toThrowError("BASE_GIT_OPERATION_IN_PROGRESS");
  });

  it("fails closed when fetch or ff-only pull fails", () => {
    const repository = makeRepository();
    const calls = [];
    expect(() => prepareTask({
      repoPath: repository.base,
      intent: "code",
      branch: "feat/fetch-failure",
      actor: "codex",
      workspace: "auto",
      now: NOW,
      gitRunner(repoPath, args, options) {
        calls.push(args);
        if (args[0] === "fetch") return { status: 1, stdout: "", stderr: "" };
        return options.defaultRunner(repoPath, args);
      },
    })).toThrowError("FETCH_FAILED");

    expect(() => prepareTask({
      repoPath: repository.base,
      intent: "code",
      branch: "feat/pull-failure",
      actor: "codex",
      workspace: "auto",
      now: NOW,
      gitRunner(repoPath, args, options) {
        if (args[0] === "pull") return { status: 1, stdout: "", stderr: "" };
        return options.defaultRunner(repoPath, args);
      },
    })).toThrowError("PULL_FF_ONLY_FAILED");
    expect(calls.some((args) => args.join(" ") === "fetch --prune origin")).toBe(true);
  });
});

describe("claim and cleanup", () => {
  it("moves a claim with revision and fingerprint CAS and rejects stale actors", () => {
    const repository = makeRepository();
    const record = writeTaskRecordV3({ repoPath: repository.base, record: validRecord(repository) });
    const claimed = claimTaskV3({
      repoPath: repository.base,
      taskId: record.taskId,
      fromActor: "codex",
      toActor: "claude",
      expectedRevision: 1,
      expectedFingerprint: record.fingerprint,
      now: LATER,
    });
    expect(claimed).toMatchObject({ activeActor: "claude", revision: 2 });
    expect(() => claimTaskV3({
      repoPath: repository.base,
      taskId: record.taskId,
      fromActor: "codex",
      toActor: "claude",
      expectedRevision: 1,
      expectedFingerprint: record.fingerprint,
      now: LATER,
    })).toThrowError("V3_CLAIM_STALE");
  });

  it("routes existing V3 lifecycle commands and reports sweep candidates without deleting", () => {
    const repository = makeRepository();
    const started = prepareTask({
      repoPath: repository.base,
      intent: "code",
      branch: "feat/v3-command-adapter",
      actor: "codex",
      workspace: "shared-slot",
      now: NOW,
    });
    const status = runTaskCommandV3({
      command: "status",
      repoPath: repository.base,
      branch: started.task.branch.name,
    });
    expect(status).toMatchObject({ handled: true, result: { task: { taskId: started.task.taskId } } });
    const cliStatus = JSON.parse(execFileSync(
      process.execPath,
      [
        path.resolve(import.meta.dirname, "../../scripts/ai-task.mjs"),
        "status",
        "--repo",
        repository.base,
        "--branch",
        started.task.branch.name,
      ],
      { encoding: "utf8", shell: false, timeout: 10_000, windowsHide: true },
    ));
    expect(cliStatus.task.taskId).toBe(started.task.taskId);

    const offered = runTaskCommandV3({
      command: "handoff",
      action: "offer",
      repoPath: repository.base,
      branch: started.task.branch.name,
      actor: "codex",
      toActor: "claude",
      now: LATER,
    });
    expect(offered.result.task).toMatchObject({
      activeActor: "codex",
      pendingActor: "claude",
      handoffFromActor: "codex",
    });
    const accepted = runTaskCommandV3({
      command: "handoff",
      action: "accept",
      repoPath: repository.base,
      branch: started.task.branch.name,
      actor: "claude",
      now: EVEN_LATER,
    });
    expect(accepted.result.task).toMatchObject({
      activeActor: "claude",
      pendingActor: null,
      handoffFromActor: null,
    });
    const runtime = runTaskCommandV3({
      command: "runtime",
      repoPath: repository.base,
      branch: started.task.branch.name,
      actor: "claude",
      ports: [3401],
      pids: [1234],
      lockPaths: [],
      now: "2026-07-23T01:03:00.000Z",
    });
    expect(runtime.result.task.runtimeRef).toMatch(/^runtime:[a-f0-9]{64}$/u);
    expect(readRuntimeSnapshotV3({
      repoPath: repository.base,
      taskId: started.task.taskId,
    })).toMatchObject({
      recordType: "RuntimeSnapshotV1",
      actor: "claude",
      ports: [3401],
      pids: [1234],
      lockPaths: [],
      fingerprint: runtime.result.task.runtimeRef.slice("runtime:".length),
    });
    const clearedRuntime = runTaskCommandV3({
      command: "runtime",
      repoPath: repository.base,
      branch: started.task.branch.name,
      actor: "claude",
      ports: [],
      pids: [],
      lockPaths: [],
      now: "2026-07-23T01:03:30.000Z",
    });
    expect(clearedRuntime.result.task.runtimeRef).toBeNull();
    expect(() => readRuntimeSnapshotV3({
      repoPath: repository.base,
      taskId: started.task.taskId,
    })).toThrowError("V3_RUNTIME_NOT_FOUND");
    const finish = runTaskCommandV3({
      command: "finish",
      repoPath: repository.base,
      branch: started.task.branch.name,
      actor: "claude",
      now: "2026-07-23T01:04:00.000Z",
    });
    expect(finish.result).toMatchObject({ recordType: "TaskFinishReportV3", dirty: false });
    const finalized = runTaskCommandV3({
      command: "finalize",
      repoPath: repository.base,
      branch: started.task.branch.name,
    });
    expect(finalized).toMatchObject({
      handled: true,
      result: { reportOnly: true, cleanupPlan: { strategy: "shared-slot" } },
    });
    expect(runTaskCommandV3({
      command: "autocleanup",
      repoPath: repository.base,
      branch: started.task.branch.name,
    }).result).toMatchObject({ status: "PRESERVED", blocker: "V3_AUTOCLEANUP_NOT_READY" });
    expect(sweepTaskRecordsV3({ repoPath: repository.base })).toMatchObject({
      recordType: "TaskSweepReportV3",
      deleted: 0,
      candidates: [expect.objectContaining({ taskId: started.task.taskId })],
    });
    expect(existsSync(started.task.workspace.path)).toBe(true);
  });

  it("serializes runtime updates and keeps only the immutable snapshot referenced by the task", () => {
    const repository = makeRepository();
    const started = prepareTask({
      repoPath: repository.base,
      intent: "code",
      branch: "feat/runtime-lock",
      actor: "codex",
      workspace: "shared-slot",
      now: NOW,
    });
    let competingError = null;
    const registered = runTaskCommandV3({
      command: "runtime",
      repoPath: repository.base,
      branch: started.task.branch.name,
      actor: "codex",
      ports: [3401],
      pids: [1234],
      lockPaths: [],
      now: LATER,
      runtimeInterleave() {
        try {
          runTaskCommandV3({
            command: "runtime",
            repoPath: repository.base,
            branch: started.task.branch.name,
            actor: "codex",
            ports: [3402],
            pids: [5678],
            lockPaths: [],
            now: EVEN_LATER,
          });
        } catch (error) {
          competingError = error;
        }
      },
    });
    expect(competingError?.code).toBe("V3_TASK_OPERATION_IN_PROGRESS");
    const snapshot = readRuntimeSnapshotV3({
      repoPath: repository.base,
      taskId: started.task.taskId,
    });
    expect(registered.result.task.runtimeRef).toBe(`runtime:${snapshot.fingerprint}`);
    expect(snapshot).toMatchObject({ ports: [3401], pids: [1234] });
    const runtimeFiles = readdirSync(path.join(
      commonDir(repository.base),
      "talkpik-task-lifecycle",
      "v3",
      "runtimes",
    )).filter((name) => name.endsWith(".json"));
    expect(runtimeFiles).toEqual([`${snapshot.fingerprint}.json`]);
  });

  it("requires the active actor for runtime and reconciles delegated v2 cleanup into V3", () => {
    const repository = makeRepository();
    const started = prepareTask({
      repoPath: repository.base,
      intent: "code",
      branch: "fix/v2-cleanup-reconcile",
      actor: "codex",
      workspace: "isolated",
      now: NOW,
    });
    expect(() => runTaskCommandV3({
      command: "runtime",
      repoPath: repository.base,
      branch: started.task.branch.name,
      ports: [3402],
      pids: [],
      lockPaths: [],
      now: LATER,
    })).toThrowError("V3_RUNTIME_ACTOR_MISMATCH");
    const outsideLock = path.join(repository.root, "outside.lock");
    writeFileSync(outsideLock, "lock\n");
    expect(() => runTaskCommandV3({
      command: "runtime",
      repoPath: repository.base,
      branch: started.task.branch.name,
      actor: "codex",
      ports: [],
      pids: [],
      lockPaths: [outsideLock],
      now: LATER,
    })).toThrowError("V3_RUNTIME_LOCK_PATH_INVALID");
    const cleaned = reconcileDelegatedCleanupV3({
      repoPath: repository.base,
      branch: started.task.branch.name,
      v2Result: { status: "CLEANED" },
      now: LATER,
      v2StatusReader: () => ({ task: { state: "CLEANED", branch: started.task.branch.name } }),
    });
    expect(cleaned).toMatchObject({ state: "CLEANED", activeActor: null });

    const unresolved = writeTaskRecordV3({
      repoPath: repository.base,
      record: validRecord(repository, {
        taskId: "task-cleanup-unresolved",
        branch: { name: "feat/cleanup-unresolved", type: "feat", slug: "cleanup-unresolved" },
      }),
    });
    const preserved = reconcileDelegatedCleanupV3({
      repoPath: repository.base,
      branch: unresolved.branch.name,
      v2Result: { result: "FAILED", blockers: ["RUNTIME_ACTIVE"] },
      now: LATER,
      v2StatusReader: () => ({ task: { state: "ACTIVE", branch: unresolved.branch.name } }),
    });
    // 위임 실패 사실만 남기면 운영자가 무엇을 고쳐야 하는지 알 수 없다. V2 가 준 실제
    // 이유를 함께 남긴다.
    expect(preserved).toMatchObject({
      state: "PRESERVED",
      blockers: ["V2_CLEANUP_NOT_CONFIRMED", "RUNTIME_ACTIVE"],
    });
  });

  it("reconciles a confirmed V2 cleaned tombstone into its active isolated V3 copy", () => {
    const repository = makeRepository();
    const started = prepareTask({
      repoPath: repository.base,
      intent: "code",
      branch: "fix/v2-sweep-cleaned",
      actor: "codex",
      workspace: "isolated",
      now: NOW,
    });
    const report = reconcileTaskRecordsV3WithV2({
      repoPath: repository.base,
      now: LATER,
      v2StatusReader: ({ branch }) => ({
        task: { state: "CLEANED", branch },
        cleanupManifest: { status: "CLEANED" },
      }),
    });
    expect(report).toMatchObject({
      recordType: "TaskRecordV3V2ReconciliationV1",
      inspected: 1,
      cleaned: 1,
      preserved: 0,
    });
    expect(readTaskRecordV3({
      repoPath: repository.base,
      taskId: started.task.taskId,
    })).toMatchObject({
      state: "CLEANED",
      activeActor: null,
      blockers: [],
    });
  });

  it("allows an exact external host worktree but keeps it preserve-only", () => {
    const repository = makeRepository();
    const hostPath = path.join(repository.root, "host-worktree");
    git(repository.base, ["worktree", "add", "-b", "feat/host-workspace", hostPath, repository.sha]);
    const host = writeTaskRecordV3({
      repoPath: repository.base,
      record: validRecord(repository, {
        taskId: "task-host-workspace",
        branch: { name: "feat/host-workspace", type: "feat", slug: "host-workspace" },
        workspace: {
          kind: "host",
          ownership: "host",
          path: realpathSync.native(hostPath),
          gitDir: realpathSync.native(path.resolve(hostPath, git(hostPath, ["rev-parse", "--git-dir"]))),
        },
      }),
    });
    expect(runTaskCommandV3({
      command: "finish",
      repoPath: repository.base,
      branch: host.branch.name,
      actor: "codex",
      now: LATER,
    }).result).toMatchObject({ recordType: "TaskFinishReportV3", dirty: false });
    expect(planTaskCleanupV3(host)).toMatchObject({
      strategy: "release-only",
      preserveWorkspace: true,
    });
  });

  it("keeps shared slots, delegates isolated cleanup, and never deletes adopted or host resources", () => {
    const repository = makeRepository();
    const shared = validRecord(repository, {
      workspace: {
        kind: "shared-slot",
        ownership: "managed",
        path: path.join(repository.base, ".worktrees", "shared-dev"),
        gitDir: path.join(commonDir(repository.base), "worktrees", "shared-dev"),
      },
      artifactManifestRef: ".codex/work/sample-v3/manifest.json",
    });
    expect(planTaskCleanupV3(shared)).toEqual({
      strategy: "shared-slot",
      preserveWorkspace: true,
      actions: [
        "REMOVE_MANIFEST_OWNED_ARTIFACTS",
        "DETACH_TO_EXACT_ORIGIN_MAIN",
        "DELETE_LOCAL_BRANCH_NON_FORCE",
      ],
    });
    expect(planTaskCleanupV3(validRecord(repository)).strategy).toBe("delegate-v2-isolated");
    for (const kind of ["adopted", "host"]) {
      const ownership = kind;
      const plan = planTaskCleanupV3(validRecord(repository, {
        workspace: { ...validRecord(repository).workspace, kind, ownership },
      }));
      expect(plan).toMatchObject({ strategy: "release-only", preserveWorkspace: true });
    }
  });

  it("only allows safe cleanup terminal transitions", () => {
    const repository = makeRepository();
    const shared = validRecord(repository, {
      workspace: {
        kind: "shared-slot",
        ownership: "managed",
        path: path.join(repository.base, ".worktrees", "shared-dev"),
        gitDir: path.join(commonDir(repository.base), "worktrees", "shared-dev"),
      },
      state: "MERGED",
    });
    expect(transitionTaskCleanupV3(shared, { result: "CLEANED", now: LATER }).state).toBe("CLEANED");
    const host = validRecord(repository, {
      workspace: { ...validRecord(repository).workspace, kind: "host", ownership: "host" },
      state: "MERGED",
    });
    expect(transitionTaskCleanupV3(host, { result: "CLEANED", now: LATER }).state).toBe("RELEASED");
    expect(transitionTaskCleanupV3(shared, {
      result: "PRESERVED",
      blocker: "RUNTIME_ACTIVE",
      now: LATER,
    })).toMatchObject({ state: "PRESERVED", blockers: ["RUNTIME_ACTIVE"] });
  });
});

// V3 가 runtime 명령을 가져가면서 V2 manifest 를 쓰지 않으면, V3 정리가 위임하는
// V2 게이트가 영구히 RUNTIME_REGISTRATION_REQUIRED 를 보고해 CLEANED 에 도달할 수
// 없다. 기존 테스트는 runTaskCommandV3 를 직접 호출해 이 경계를 건너뛰었으므로
// 여기서는 CLI 진입점으로 두 레지스트리가 함께 갱신되는지 확인한다.
describe("runtime registration keeps the delegated V2 cleanup gate satisfiable", () => {
  function v2RuntimeManifest(repository, branch) {
    // V2 taskId 는 branch 를 그대로 평탄화한 값이다 (feat/x -> feat-x).
    return path.join(
      commonDir(repository.base),
      "talkpik-task-lifecycle",
      "v2",
      "runtimes",
      `${branch.replace("/", "-")}.json`,
    );
  }

  async function startedTask(repository, branch) {
    await runTaskLifecycleCommand({
      command: "start",
      values: { repo: repository.base, branch, actor: "codex", now: NOW },
    }, { launchSweep: () => false });
    return branch;
  }

  it("writes the V2 runtime manifest for an empty declaration", async () => {
    const repository = makeRepository();
    const branch = await startedTask(repository, "feat/runtime-bridge-empty");

    const result = await runTaskLifecycleCommand({
      command: "runtime",
      values: { repo: repository.base, branch, actor: "codex", now: LATER },
    });

    // 빈 선언은 V3 에서 runtimeRef 해제를 뜻하지만, 운영자가 "실행 중인 것이
    // 없다"고 선언한 사실 자체는 V2 게이트가 요구하는 증거다.
    expect(result.task.runtimeRef).toBeNull();
    expect(existsSync(v2RuntimeManifest(repository, branch))).toBe(true);
    expect(JSON.parse(readFileSync(v2RuntimeManifest(repository, branch), "utf8")))
      .toMatchObject({ recordType: "RuntimeManifest", ports: [], pids: [], lockPaths: [] });
  });

  it("mirrors declared ports and pids into the V2 runtime manifest", async () => {
    const repository = makeRepository();
    const branch = await startedTask(repository, "feat/runtime-bridge-ports");

    const result = await runTaskLifecycleCommand({
      command: "runtime",
      values: {
        repo: repository.base,
        branch,
        actor: "codex",
        ports: "3401",
        pids: "1234",
        now: LATER,
      },
    });

    expect(result.task.runtimeRef).toMatch(/^runtime:[a-f0-9]{64}$/u);
    expect(JSON.parse(readFileSync(v2RuntimeManifest(repository, branch), "utf8")))
      .toMatchObject({ recordType: "RuntimeManifest", ports: [3401], pids: [1234] });
  });

  // V3 정리가 위임하는 실제 게이트는 V2 finalizeTask 다. CLI 의 finalize 는 V3 가
  // 가져가 report-only 계획만 돌려주므로 이 blocker 를 볼 수 없다.
  it("clears RUNTIME_REGISTRATION_REQUIRED from the delegated V2 cleanup gate", async () => {
    const repository = makeRepository();
    const unregistered = await startedTask(repository, "feat/runtime-bridge-gate-off");
    const registered = await startedTask(repository, "feat/runtime-bridge-gate-on");

    await runTaskLifecycleCommand({
      command: "runtime",
      values: { repo: repository.base, branch: registered, actor: "codex", now: LATER },
    });

    const withoutRuntime = await finalizeTask({ repoPath: repository.base, branch: unregistered });
    const withRuntime = await finalizeTask({ repoPath: repository.base, branch: registered });

    expect(withoutRuntime.blockers ?? []).toContain("RUNTIME_REGISTRATION_REQUIRED");
    expect(withRuntime.blockers ?? []).not.toContain("RUNTIME_REGISTRATION_REQUIRED");
  });
});

// CLI 는 --repo 를 그대로 넘긴다. v3 는 내부에서 path.resolve 하지만 v2 는
// path.isAbsolute 를 요구해 거부하므로, 같은 명령에서 v3 만 통과하고 v2 위임이
// REPOSITORY_REQUIRED 로 실패했다.
//
// 그리고 legacy v2 분기가 v3 위임보다 먼저 실행돼 finish 를 가로챈다. 그 분기를
// 건너뛰는 유일한 경우가 잘못된 경로로 readTaskStatus 가 던진 예외를 catch 가
// 삼킬 때였다. v3 처리가 우연한 오류에 얹혀 있었고, 정상 경로에서는 v3 record 의
// headSha 가 갱신되지 않아 병합 PR 조회가 SHA 대조에서 탈락했다.
describe("task CLI resolves --repo and routes v3 before the legacy v2 branch", () => {
  async function preparedTask(repository, branch) {
    const prepared = await runTaskLifecycleCommand({
      command: "prepare",
      values: {
        repo: repository.base,
        intent: "code",
        branch,
        actor: "codex",
        workspace: "isolated",
        now: NOW,
      },
    }, { launchSweep: () => false });
    return { branch, worktree: prepared.task.workspace.path };
  }

  // 임시 저장소로 상대 경로를 만들지 않는다. Windows CI 는 checkout 과 temp 가
  // 서로 다른 drive 라 path.relative 가 절대 경로를 돌려주고, 그러면 이 테스트가
  // 검사하려던 조건 자체가 성립하지 않는다. cwd 만 가리키는 "." 은 어디서나
  // 상대 경로다.
  it("resolves a relative --repo before handing it to the cleanup adapter", async () => {
    expect(path.isAbsolute(".")).toBe(false);

    let seen;
    await runTaskLifecycleCommand({
      command: "autocleanup",
      values: { repo: ".", branch: "feat/cli-relative-repo" },
    }, {
      runV3Autocleanup: (input) => {
        seen = input.repoPath;
        return { handled: true, result: { result: "PRESERVED", blockers: [] } };
      },
    });

    // v2 위임은 절대 경로만 받는다. 진입점이 resolve 하지 않으면 그 자리에서
    // REPOSITORY_REQUIRED 로 막힌다.
    expect(seen).toBe(path.resolve("."));
    expect(path.isAbsolute(seen)).toBe(true);
  });

  it("routes finish through v3 even when --repo resolves a legacy v2 task", async () => {
    const repository = makeRepository();
    const { branch, worktree } = await preparedTask(repository, "feat/cli-finish-routing");
    writeFileSync(path.join(worktree, "finish-routing.txt"), "work\n");
    git(worktree, ["add", "finish-routing.txt"]);
    git(worktree, ["commit", "-m", "work"]);
    const head = git(worktree, ["rev-parse", "HEAD"]);
    expect(head).not.toBe(repository.sha);

    // v2 finish 는 --repo 가 task worktree 여야 한다. 바로 그 조건에서 legacy
    // 분기가 readTaskStatus 로 task 를 찾아 v3 위임 전에 가로챈다. 보고 형태는
    // 공개 CLI 계약대로 v2 를 유지하되 v3 record 는 함께 갱신돼야 한다.
    const result = await runTaskLifecycleCommand({
      command: "finish",
      values: { repo: worktree, branch, actor: "codex", now: LATER },
    });

    expect(result.recordType).toBe("FinishReportV1");
    // 갱신되지 않으면 headSha 가 준비 시점 base 에 머물고, 이후 자동 정리가 병합
    // PR 을 SHA 대조에서 놓친다.
    expect(readTaskRecordV3ByBranch({ repoPath: repository.base, branch }).headSha).toBe(head);
  });

  it("keeps the legacy v2 path for a task that has no v3 record", async () => {
    const repository = makeRepository();
    const { branch, worktree } = await preparedTask(repository, "feat/cli-legacy-fallback");
    const record = readTaskRecordV3ByBranch({ repoPath: repository.base, branch });
    expect(record).not.toBeNull();
    unlinkSync(path.join(
      commonDir(repository.base),
      "talkpik-task-lifecycle",
      "v3",
      "tasks",
      `${record.taskId}.json`,
    ));

    const result = await runTaskLifecycleCommand({
      command: "finish",
      values: { repo: worktree, branch, actor: "codex", now: LATER },
    });

    expect(result.recordType).toBe("FinishReportV1");
  });
});
