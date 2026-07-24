import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
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

function makeRepository(prefix) {
  const root = tempRoot(prefix);
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

function makeInterruptedTask(branch) {
  const repository = makeRepository();
  let worktreePath = null;
  const service = createTaskLifecycleService({
    afterWorktreeCreated({ worktreePath: createdPath }) {
      worktreePath = createdPath;
      writeFileSync(path.join(createdPath, "interrupted-change.txt"), "preserve\n");
      throw new Error("simulated abrupt process failure");
    },
  });
  expect(() => service.startTask({ repoPath: repository.base, branch, actor: "codex", now: NOW }))
    .toThrowError("START_FAILED_TASK_PRESERVED");
  return { ...repository, branch, worktreePath, dirtyFile: path.join(worktreePath, "interrupted-change.txt") };
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

function handoffContextInput(overrides = {}) {
  return {
    objective: "Claude가 남은 lifecycle 구현을 이어간다.",
    completed: ["실패 테스트 작성"],
    decisions: ["TaskRecordV2는 변경하지 않는다."],
    remaining: ["구현과 검증"],
    verification: ["관련 Vitest"],
    blockers: [],
    nextAction: "관련 테스트를 실행한다.",
    ...overrides,
  };
}

function handoffContextRecord(overrides = {}) {
  return {
    schemaVersion: 1,
    recordType: "HandoffContextV1",
    taskId: "feat-sample-task",
    branch: "feat/sample-task",
    snapshotId: "feat-sample-task-handoff-2",
    revision: 2,
    fromActor: "codex",
    toActor: "claude",
    ...handoffContextInput(),
    fingerprint: FINGERPRINT,
    createdAt: NOW,
    ...overrides,
  };
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("AI task lifecycle v2 schema", () => {
  it("publishes closed validators for practical-flow sidecars", async () => {
    const lifecycle = await import("../../scripts/lib/ai-task-lifecycle-v2.mjs");

    for (const name of [
      "validateHandoffContextV1",
      "validateStartRecoveryV1",
      "validateFinishReportV1",
      "validateOwnerAuthResultV1",
    ]) {
      expect(lifecycle[name], `${name} must be public`).toBeTypeOf("function");
    }
  });

  it("rejects unknown, secret-like, thread-like, oversized, and prototype-like sidecar input", async () => {
    const { validateHandoffContextV1 } = await import("../../scripts/lib/ai-task-lifecycle-v2.mjs");
    expect(validateHandoffContextV1).toBeTypeOf("function");
    const valid = {
      schemaVersion: 1,
      recordType: "HandoffContextV1",
      taskId: "feat-sample-task",
      branch: "feat/sample-task",
      snapshotId: "feat-sample-task-handoff-2",
      revision: 2,
      fromActor: "codex",
      toActor: "claude",
      objective: "검색 기능을 이어서 구현한다.",
      completed: ["테스트 작성"],
      decisions: ["기존 API 유지"],
      remaining: ["구현"],
      verification: ["관련 테스트"],
      blockers: [],
      nextAction: "실패 테스트를 통과시킨다.",
      fingerprint: FINGERPRINT,
      createdAt: NOW,
    };
    expect(validateHandoffContextV1(valid)).toEqual([]);
    expect(validateHandoffContextV1({ ...valid, token: "never" })).toContainEqual(
      expect.objectContaining({ code: "UNKNOWN_FIELD" }),
    );
    expect(validateHandoffContextV1({ ...valid, threadId: "raw" })).toContainEqual(
      expect.objectContaining({ code: "UNKNOWN_FIELD" }),
    );
    expect(validateHandoffContextV1({ ...valid, objective: "x".repeat(20_000) })).not.toEqual([]);
    const polluted = Object.create({ injected: true });
    Object.assign(polluted, valid);
    expect(validateHandoffContextV1(polluted)).toContainEqual(
      expect.objectContaining({ code: "INVALID_OBJECT" }),
    );
  });

  it("rejects high-confidence secret and thread identifiers from every handoff context string", async () => {
    const lifecycle = await import("../../scripts/lib/ai-task-lifecycle-v2.mjs");
    const sensitiveValues = [
      `ghp_${"a".repeat(36)}`,
      `github_pat_${"b".repeat(40)}`,
      `sk-${"c".repeat(32)}`,
      `sk-proj-${"d".repeat(32)}`,
      `AKIA${"E".repeat(16)}`,
      "-----BEGIN PRIVATE KEY-----",
      "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.fake-signature-1234",
      "thread id: 550e8400-e29b-41d4-a716-446655440000",
      "session-id=6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "conversation id: 6ba7b811-9dad-11d1-80b4-00c04fd430c8",
      "/threads/6ba7b812-9dad-11d1-80b4-00c04fd430c8",
    ];
    const secret = sensitiveValues[0];
    const fieldOverrides = [
      { objective: secret },
      { completed: [secret] },
      { decisions: [secret] },
      { remaining: [secret] },
      { verification: [secret] },
      { blockers: [secret] },
      { nextAction: secret },
    ];

    for (const value of sensitiveValues) {
      const errors = lifecycle.validateHandoffContextV1(handoffContextRecord({ objective: value }));
      expect(errors).toContainEqual(expect.objectContaining({ code: "SECRET_OR_THREAD_VALUE" }));
      expect(JSON.stringify(errors)).not.toContain(value);
    }
    for (const overrides of fieldOverrides) {
      expect(lifecycle.validateHandoffContextV1(handoffContextRecord(overrides))).toContainEqual(
        expect.objectContaining({ code: "SECRET_OR_THREAD_VALUE" }),
      );
    }

    const { base } = makeRepository();
    const started = startTask({ repoPath: base, branch: "fix/context-secret-values", actor: "codex", now: NOW });
    for (const value of sensitiveValues) {
      let caught = null;
      try {
        lifecycle.offerTaskHandoff({
          repoPath: started.worktreePath,
          branch: started.branch,
          actor: "codex",
          toActor: "claude",
          context: handoffContextInput({ objective: value }),
          now: "2026-07-21T05:01:00.000Z",
        });
      } catch (error) {
        caught = error;
      }
      expect(caught).toMatchObject({ code: "HANDOFF_CONTEXT_INVALID" });
      expect(caught.message).not.toContain(value);
    }
  });

  it("allows ordinary UUIDs, short token words, and unlabelled hashes in handoff context", async () => {
    const lifecycle = await import("../../scripts/lib/ai-task-lifecycle-v2.mjs");
    const ordinaryText = [
      "UUID 550e8400-e29b-41d4-a716-446655440000",
      "use the token word in ordinary prose",
      `checksum ${"a".repeat(64)}`,
    ].join("; ");

    expect(lifecycle.validateHandoffContextV1(handoffContextRecord({ objective: ordinaryText }))).toEqual([]);

    const { base } = makeRepository();
    const started = startTask({ repoPath: base, branch: "fix/context-safe-values", actor: "codex", now: NOW });
    expect(() => lifecycle.offerTaskHandoff({
      repoPath: started.worktreePath,
      branch: started.branch,
      actor: "codex",
      toActor: "claude",
      context: handoffContextInput({ objective: ordinaryText }),
      now: "2026-07-21T05:01:00.000Z",
    })).not.toThrow();
  });

  it.each([
    "Implement Bearer authentication for the API",
    "Document bearer authorization headers",
    "thread id: issue",
    "GET /threads/list endpoint",
  ])("allows normal handoff prose without credential evidence: %s", async (objective) => {
    const lifecycle = await import("../../scripts/lib/ai-task-lifecycle-v2.mjs");

    expect(lifecycle.validateHandoffContextV1(handoffContextRecord({ objective }))).toEqual([]);
  });

  it("binds sidecar identity and owner-auth state flags to their declared meaning", async () => {
    const { validateOwnerAuthResultV1, validateStartRecoveryV1 } = await import(
      "../../scripts/lib/ai-task-lifecycle-v2.mjs"
    );
    const recovery = {
      schemaVersion: 1,
      recordType: "StartRecoveryV1",
      taskId: "fix-different-task",
      branch: "fix/start-recovery",
      baseSha: SHA,
      actor: "codex",
      worktreePath: "C:/repo/.worktrees/fix-start-recovery",
      phase: "BLOCKED",
      blocker: "확인이 필요합니다.",
      fingerprint: FINGERPRINT,
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(validateStartRecoveryV1(recovery)).toContainEqual(
      expect.objectContaining({ code: "TASK_ID_MISMATCH" }),
    );

    const auth = {
      schemaVersion: 1,
      recordType: "OwnerAuthResultV1",
      status: "SWITCH_REQUIRED",
      host: "github.com",
      owner: "blackstarzck",
      currentLogin: "collaborator",
      switchAttempted: false,
      publishApprovalUsed: false,
      manualApprovalRequired: false,
      checkedAt: NOW,
      fingerprint: FINGERPRINT,
    };
    expect(validateOwnerAuthResultV1(auth)).toContainEqual(
      expect.objectContaining({ code: "OWNER_AUTH_STATE_MISMATCH" }),
    );
  });
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
  it("recovers an interrupted owned start after the preserved worktree becomes clean", () => {
    const { base } = makeRepository();
    let preservedPath = null;
    const service = createTaskLifecycleService({
      afterWorktreeCreated({ worktreePath }) {
        preservedPath = worktreePath;
        writeFileSync(path.join(worktreePath, "process-leftover.txt"), "unfinished\n");
        throw new Error("simulated abrupt process failure");
      },
    });
    expect(() => service.startTask({
      repoPath: base,
      branch: "fix/start-recovery",
      actor: "codex",
      now: NOW,
    })).toThrowError("START_FAILED_TASK_PRESERVED");

    const blocked = readTaskStatus({ repoPath: base, branch: "fix/start-recovery" });
    expect(blocked).toMatchObject({
      task: null,
      startRecovery: { recordType: "StartRecoveryV1", phase: "BLOCKED", actor: "codex" },
      blockers: [expect.any(String)],
      nextAction: { owner: "codex", retrySafe: true, approvalRequired: false },
    });
    unlinkSync(path.join(preservedPath, "process-leftover.txt"));

    const recovered = startTask({
      repoPath: base,
      branch: "fix/start-recovery",
      actor: "codex",
      now: "2026-07-21T05:02:00.000Z",
    });
    expect(recovered).toMatchObject({ recordType: "TaskRecordV2", state: "ACTIVE", activeActor: "codex" });
    expect(recovered.worktreePath).toBe(realpathSync.native(preservedPath));
    expect(readTaskStatus({ repoPath: base, branch: "fix/start-recovery" }).startRecovery.phase).toBe("COMPLETED");
  });

  it("preserves interrupted starts when ownership evidence or worktree state is unsafe", () => {
    const { base } = makeRepository();
    const service = createTaskLifecycleService({
      afterWorktreeCreated({ worktreePath }) {
        writeFileSync(path.join(worktreePath, "owned-change.txt"), "keep\n");
        throw new Error("simulated abrupt process failure");
      },
    });
    expect(() => service.startTask({ repoPath: base, branch: "fix/start-owner", actor: "codex", now: NOW }))
      .toThrowError("START_FAILED_TASK_PRESERVED");
    expect(() => startTask({
      repoPath: base,
      branch: "fix/start-owner",
      actor: "claude",
      now: "2026-07-21T05:01:00.000Z",
    })).toThrowError("START_RECOVERY_OWNER_MISMATCH");
    expect(existsSync(path.join(base, ".worktrees", "fix-start-owner", "owned-change.txt"))).toBe(true);
  });

  it.each([
    ["missing worktree", "fix/recovery-missing", ({ base, worktreePath, dirtyFile }) => {
      unlinkSync(dirtyFile);
      git(base, ["worktree", "remove", worktreePath]);
    }, "START_RECOVERY_WORKTREE_MISSING"],
    ["dirty worktree", "fix/recovery-dirty", () => {}, "START_RECOVERY_WORKTREE_DIRTY"],
    ["detached worktree", "fix/recovery-detached", ({ worktreePath, dirtyFile }) => {
      unlinkSync(dirtyFile);
      git(worktreePath, ["checkout", "--detach"]);
    }, "START_RECOVERY_WORKTREE_DETACHED"],
    ["wrong branch", "fix/recovery-wrong-branch", ({ worktreePath, dirtyFile }) => {
      unlinkSync(dirtyFile);
      git(worktreePath, ["switch", "-c", "fix/recovery-other-branch"]);
    }, "START_RECOVERY_WRONG_BRANCH"],
    ["wrong HEAD", "fix/recovery-wrong-head", ({ worktreePath, dirtyFile }) => {
      unlinkSync(dirtyFile);
      writeFileSync(path.join(worktreePath, "committed-change.txt"), "changed\n");
      git(worktreePath, ["add", "committed-change.txt"]);
      git(worktreePath, ["commit", "-m", "advance interrupted branch"]);
    }, "START_RECOVERY_WRONG_HEAD"],
    ["missing native ownership", "fix/recovery-native-owner", ({ base, worktreePath, dirtyFile }) => {
      unlinkSync(dirtyFile);
      git(base, ["worktree", "remove", worktreePath]);
      mkdirSync(worktreePath, { recursive: true });
    }, "START_RECOVERY_NATIVE_OWNERSHIP_MISSING"],
    ["remote branch conflict", "fix/recovery-remote-branch", ({ worktreePath, dirtyFile, branch }) => {
      unlinkSync(dirtyFile);
      git(worktreePath, ["push", "origin", branch]);
    }, "START_RECOVERY_REMOTE_BRANCH_EXISTS"],
    ["ambiguous remote evidence", "fix/recovery-remote-unknown", ({ base, dirtyFile, root }) => {
      unlinkSync(dirtyFile);
      git(base, ["remote", "set-url", "origin", path.join(root, "missing-remote.git")]);
    }, "START_RECOVERY_REMOTE_EVIDENCE_UNAVAILABLE"],
  ])("reports %s with a concrete recovery blocker and one next action", (_label, branch, mutate, expectedCode) => {
    const interrupted = makeInterruptedTask(branch);
    mutate(interrupted);

    const status = readTaskStatus({ repoPath: interrupted.base, branch });

    expect(status.startRecoveryEligibility.eligible).toBe(false);
    expect(status.startRecoveryEligibility.issues).toContainEqual(
      expect.objectContaining({ code: expectedCode, message: expect.any(String) }),
    );
    expect(status.blockers).toContainEqual(expect.any(String));
    expect(status.nextAction).toEqual({
      owner: expect.stringMatching(/^(codex|manual)$/),
      reason: expect.any(String),
      command: expect.any(String),
      approvalRequired: expect.any(Boolean),
      retrySafe: expect.any(Boolean),
    });
    if (expectedCode === "START_RECOVERY_REMOTE_BRANCH_EXISTS") {
      expect(status.nextAction.command).toContain("ls-remote --heads origin");
      expect(status.nextAction.reason).toContain("원격 branch");
    }
    if (expectedCode === "START_RECOVERY_REMOTE_EVIDENCE_UNAVAILABLE") {
      expect(status.nextAction.command).toContain("task:status");
      expect(status.nextAction.retrySafe).toBe(true);
    }
  });

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
    expect(realpathSync.native(result.worktreePath)).toBe(
      realpathSync.native(path.join(base, ".worktrees", "feat-sample-task")),
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
  const handoffContext = {
    objective: "Claude가 남은 lifecycle 구현을 이어간다.",
    completed: ["실패 테스트 작성"],
    decisions: ["TaskRecordV2는 변경하지 않는다."],
    remaining: ["구현과 검증"],
    verification: ["관련 Vitest"],
    blockers: [],
    nextAction: "관련 테스트를 실행한다.",
  };

  it("offers and accepts a handoff with a fingerprinted context sidecar", async () => {
    const lifecycle = await import("../../scripts/lib/ai-task-lifecycle-v2.mjs");
    expect(lifecycle.offerTaskHandoff).toBeTypeOf("function");
    expect(lifecycle.acceptTaskHandoff).toBeTypeOf("function");
    const { base } = makeRepository();
    const started = startTask({ repoPath: base, branch: "refactor/context-handoff", actor: "codex", now: NOW });

    const offered = lifecycle.offerTaskHandoff({
      repoPath: started.worktreePath,
      branch: started.branch,
      actor: "codex",
      toActor: "claude",
      context: handoffContext,
      now: "2026-07-21T05:01:00.000Z",
    });
    expect(offered.handoffContext).toMatchObject({
      recordType: "HandoffContextV1",
      objective: handoffContext.objective,
      fromActor: "codex",
      toActor: "claude",
      revision: 2,
    });
    expect(readTaskStatus({ repoPath: started.worktreePath, branch: started.branch })).toMatchObject({
      summary: expect.any(String),
      blockers: [],
      nextAction: {
        owner: "claude",
        command: `pnpm task:handoff -- --action accept --repo '${started.worktreePath.replaceAll("'", "''")}' --branch ${started.branch} --actor claude`,
        approvalRequired: false,
        retrySafe: true,
      },
      handoffContext: { fingerprint: offered.handoffContext.fingerprint },
    });

    const accepted = lifecycle.acceptTaskHandoff({
      repoPath: started.worktreePath,
      branch: started.branch,
      actor: "claude",
      now: "2026-07-21T05:02:00.000Z",
    });
    expect(accepted).toMatchObject({ state: "ACTIVE", activeActor: "claude" });
    expect(existsSync(started.worktreePath)).toBe(true);
  });

  it("rejects tampered context and lets the original actor refresh after worktree changes", async () => {
    const lifecycle = await import("../../scripts/lib/ai-task-lifecycle-v2.mjs");
    expect(lifecycle.refreshTaskHandoff).toBeTypeOf("function");
    const { base } = makeRepository();
    const started = startTask({ repoPath: base, branch: "fix/context-refresh", actor: "codex", now: NOW });
    const offered = lifecycle.offerTaskHandoff({
      repoPath: started.worktreePath,
      branch: started.branch,
      actor: "codex",
      toActor: "claude",
      context: handoffContext,
      now: "2026-07-21T05:01:00.000Z",
    });
    const contextFile = path.join(
      started.gitCommonDir,
      "talkpik-task-lifecycle",
      "v2",
      "handoff-contexts",
      `${offered.handoffSnapshotId}.json`,
    );
    const tampered = JSON.parse(readFileSync(contextFile, "utf8"));
    tampered.objective = "변조됨";
    writeFileSync(contextFile, `${JSON.stringify(tampered, null, 2)}\n`);
    expect(() => lifecycle.acceptTaskHandoff({
      repoPath: started.worktreePath,
      branch: started.branch,
      actor: "claude",
      now: "2026-07-21T05:02:00.000Z",
    })).toThrowError("HANDOFF_CONTEXT_FINGERPRINT_MISMATCH");

    writeFileSync(path.join(started.worktreePath, "continued.txt"), "continued\n");
    const refreshed = lifecycle.refreshTaskHandoff({
      repoPath: started.worktreePath,
      branch: started.branch,
      actor: "codex",
      context: { ...handoffContext, completed: ["실패 테스트 작성", "추가 변경"] },
      now: "2026-07-21T05:03:00.000Z",
    });
    expect(refreshed).toMatchObject({ state: "HANDOFF_PENDING", pendingActor: "claude", revision: 3 });
    expect(refreshed.handoffContext.revision).toBe(3);
    expect(() => lifecycle.acceptTaskHandoff({
      repoPath: started.worktreePath,
      branch: started.branch,
      actor: "claude",
      now: "2026-07-21T05:04:00.000Z",
    })).not.toThrow();
  }, 90_000);

  it("requires the context sidecar for strict accept while keeping legacy resume compatible", async () => {
    const lifecycle = await import("../../scripts/lib/ai-task-lifecycle-v2.mjs");
    const { base } = makeRepository();
    const started = startTask({ repoPath: base, branch: "fix/strict-accept", actor: "codex", now: NOW });
    const offered = lifecycle.offerTaskHandoff({
      repoPath: started.worktreePath,
      branch: started.branch,
      actor: "codex",
      toActor: "claude",
      context: handoffContext,
      now: "2026-07-21T05:01:00.000Z",
    });
    const contextFile = path.join(
      started.gitCommonDir,
      "talkpik-task-lifecycle",
      "v2",
      "handoff-contexts",
      `${offered.handoffSnapshotId}.json`,
    );
    unlinkSync(contextFile);

    const status = readTaskStatus({ repoPath: started.worktreePath, branch: started.branch });
    const contextInputPath = path.join(
      started.worktreePath,
      ".codex",
      "work",
      "strict-accept",
      "handoff-context.json",
    );
    expect(status.handoffContext).toBeNull();
    expect(status.blockers).toEqual([
      expect.stringContaining("인수인계 context"),
    ]);
    expect(status.nextAction).toEqual({
      owner: "codex",
      reason: expect.stringContaining("context"),
      command: `pnpm task:handoff -- --action refresh --repo '${started.worktreePath.replaceAll("'", "''")}' --branch ${started.branch} --actor codex --context '${contextInputPath.replaceAll("'", "''")}'`,
      approvalRequired: false,
      retrySafe: true,
    });
    expect(status.nextAction.command).not.toContain("--action accept");

    expect(() => lifecycle.acceptTaskHandoff({
      repoPath: started.worktreePath,
      branch: started.branch,
      actor: "claude",
      now: "2026-07-21T05:02:00.000Z",
    })).toThrowError("HANDOFF_CONTEXT_NOT_FOUND");
    const cliAccept = spawnSync(process.execPath, [
      path.resolve("scripts/ai-task.mjs"),
      "handoff", "--action", "accept",
      "--repo", started.worktreePath,
      "--branch", started.branch,
      "--actor", "claude",
      "--now", "2026-07-21T05:02:00.000Z",
    ], { cwd: started.worktreePath, encoding: "utf8", windowsHide: true });
    expect(cliAccept.status).toBe(1);
    expect(cliAccept.stderr.trim()).toBe("HANDOFF_CONTEXT_NOT_FOUND");
    expect(() => resumeTask({
      repoPath: started.worktreePath,
      branch: started.branch,
      actor: "claude",
      now: "2026-07-21T05:02:00.000Z",
    })).not.toThrow();
  });

  it("PowerShell-quotes status command paths containing spaces and apostrophes", async () => {
    const lifecycle = await import("../../scripts/lib/ai-task-lifecycle-v2.mjs");
    const { base } = makeRepository("talkpik status's path-");
    const started = startTask({
      repoPath: base,
      branch: "fix/status-path-quoting",
      actor: "codex",
      now: NOW,
    });
    const quotedWorktree = `'${started.worktreePath.replaceAll("'", "''")}'`;

    expect(readTaskStatus({ repoPath: started.worktreePath, branch: started.branch }).nextAction.command)
      .toBe(`pnpm task:finish -- --repo ${quotedWorktree} --branch ${started.branch} --actor codex`);

    lifecycle.offerTaskHandoff({
      repoPath: started.worktreePath,
      branch: started.branch,
      actor: "codex",
      toActor: "claude",
      context: handoffContext,
      now: "2026-07-21T05:01:00.000Z",
    });
    expect(readTaskStatus({ repoPath: started.worktreePath, branch: started.branch }).nextAction.command)
      .toBe(`pnpm task:handoff -- --action accept --repo ${quotedWorktree} --branch ${started.branch} --actor claude`);
  });
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

  it("exposes the practical lifecycle commands through package.json", () => {
    const packageJson = JSON.parse(readFileSync(path.resolve("package.json"), "utf8"));
    expect(packageJson.scripts).toMatchObject({
      "task:start": "node scripts/ai-task.mjs start",
      "task:status": "node scripts/ai-task.mjs status",
      "task:handoff": "node scripts/ai-task.mjs handoff",
      "task:resume": "node scripts/ai-task.mjs resume",
      "task:finish": "node scripts/ai-task.mjs finish",
      "task:autocleanup": "node scripts/ai-task.mjs autocleanup",
      "task:sweep": "node scripts/ai-task.mjs sweep",
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
    const finish = JSON.parse(run([
      "finish",
      "--repo", started.worktreePath,
      "--branch", "chore/cli-flow",
      "--actor", "codex",
      "--now", "2026-07-21T05:00:30.000Z",
    ], started.worktreePath));
    expect(finish).toMatchObject({ recordType: "FinishReportV1", dirty: false, published: false });

    const contextDirectory = path.join(started.worktreePath, ".codex", "work", "cli-flow");
    mkdirSync(contextDirectory, { recursive: true });
    const contextFile = path.join(contextDirectory, "handoff-context.json");
    writeFileSync(contextFile, JSON.stringify({
      objective: "CLI 인수인계",
      completed: [],
      decisions: [],
      remaining: ["검증"],
      verification: [],
      blockers: [],
      nextAction: "검증을 실행한다.",
    }));
    const pending = JSON.parse(
      run(
        [
          "handoff",
          "--action",
          "offer",
          "--repo",
          started.worktreePath,
          "--branch",
          "chore/cli-flow",
          "--actor",
          "codex",
          "--to",
          "claude",
          "--context",
          contextFile,
          "--now",
          "2026-07-21T05:01:00.000Z",
        ],
        started.worktreePath,
      ),
    );
    expect(pending.state).toBe("HANDOFF_PENDING");
    const resumedProcess = spawnSync(process.execPath, [
      script,
      "resume",
      "--repo", started.worktreePath,
      "--branch", "chore/cli-flow",
      "--actor", "claude",
      "--now", "2026-07-21T05:02:00.000Z",
    ], { cwd: started.worktreePath, encoding: "utf8", windowsHide: true });
    expect(resumedProcess.status).toBe(0);
    expect(resumedProcess.stderr).toContain("TASK_RESUME_DEPRECATED_USE_HANDOFF_ACCEPT");
    const resumed = JSON.parse(resumedProcess.stdout);
    expect(resumed).toMatchObject({ state: "ACTIVE", activeActor: "claude" });
    expect(existsSync(started.worktreePath)).toBe(true);
  }, 90_000);

  it("rejects handoff context outside the task work area and through symlink or junction ancestors", () => {
    const { root, base } = makeRepository();
    const started = startTask({ repoPath: base, branch: "fix/context-path", actor: "codex", now: NOW });
    const script = path.resolve("scripts/ai-task.mjs");
    const payload = JSON.stringify({
      objective: "경로 검증",
      completed: [],
      decisions: [],
      remaining: ["수락"],
      verification: [],
      blockers: [],
      nextAction: "경로를 확인한다.",
    });
    const runOffer = (contextFile) => spawnSync(process.execPath, [
      script,
      "handoff", "--action", "offer",
      "--repo", started.worktreePath,
      "--branch", started.branch,
      "--actor", "codex",
      "--to", "claude",
      "--context", contextFile,
      "--now", "2026-07-21T05:01:00.000Z",
    ], { cwd: started.worktreePath, encoding: "utf8", windowsHide: true });

    const misplaced = path.join(started.worktreePath, "handoff.json");
    writeFileSync(misplaced, payload);
    const misplacedResult = runOffer(misplaced);
    expect(misplacedResult.status).toBe(1);
    expect(misplacedResult.stderr.trim()).toBe("TASK_CONTEXT_LOCATION_INVALID");

    unlinkSync(misplaced);
    const workRoot = path.join(started.worktreePath, ".codex", "work");
    mkdirSync(workRoot, { recursive: true });
    const externalDirectory = path.join(root, "external-context");
    mkdirSync(externalDirectory);
    const externalFile = path.join(externalDirectory, "handoff.json");
    writeFileSync(externalFile, payload);
    const linkedTaskDirectory = path.join(workRoot, "context-path");
    try {
      symlinkSync(externalDirectory, linkedTaskDirectory, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (["EPERM", "EACCES", "UNKNOWN"].includes(error?.code)) return;
      throw error;
    }
    const linkedResult = runOffer(path.join(linkedTaskDirectory, "handoff.json"));
    expect(linkedResult.status).toBe(1);
    expect(linkedResult.stderr.trim()).toBe("TASK_CONTEXT_PATH_ESCAPE");
  });
});
