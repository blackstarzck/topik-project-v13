import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createProductionRegistryCapability,
  createTestRegistryCapability,
  pathsOverlap,
  readTaskRecords,
  transitionTaskRecord,
  validateTaskRecord,
  writeTaskRecordAtomic,
} from "../../scripts/lib/task-lifecycle-registry.mjs";
import { classifyWorktreeSnapshot } from "../../scripts/lib/worktree-lifecycle.mjs";
import * as lifecycleSchema from "../../scripts/lib/task-lifecycle-schema.mjs";

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);
const NOW = "2026-07-10T00:10:00.000Z";
const FRESH_PR_CHECK = "2026-07-10T00:05:00.000Z";
const ORIGINAL_CODEX_HOME = process.env.CODEX_HOME;
let tempDirs = [];

function createTempRoot(prefix = "v13-lifecycle-") {
  const root = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(root);
  return root;
}

function taskRecord(overrides = {}) {
  return {
    schemaVersion: 1,
    mode: "report",
    taskId: "workflow-overhaul",
    slug: "workflow-overhaul",
    owner: "codex-desktop",
    repoId: "talkpik-v13",
    gitCommonDir: "C:/repo/.git",
    worktreePath: "C:/worktrees/workflow-overhaul",
    branch: "codex/workflow-overhaul",
    baseRef: "origin/main",
    baseSha: SHA_A,
    publishedHeadSha: null,
    pullRequestHint: null,
    state: "DISCOVERED",
    ports: [],
    lastVerification: null,
    lastTransition: null,
    cleanupAuthorized: false,
    revision: 1,
    updatedAt: NOW,
    ...overrides,
  };
}

function lifecycleEvidence(overrides = {}) {
  return {
    source: "local-inspection",
    checks: ["worktree-identity"],
    observedAt: NOW,
    ...overrides,
  };
}

function safeSnapshot(overrides = {}) {
  return {
    worktreePath: "C:/worktrees/finished-task",
    repositoryIdentity: "blackstarzck/topik-project-v13",
    branch: "codex/finished-task",
    headSha: SHA_B,
    detached: false,
    isCurrent: false,
    isBaseCheckout: false,
    owner: "codex-desktop",
    ownerEvidence: "task-metadata",
    statusEvidence: "complete",
    ignoredEvidence: "complete",
    trackedChanges: [],
    untrackedFiles: [],
    ignoredEntries: ["node_modules/", ".next/"],
    branchOwnership: "exclusive",
    pathOwnership: "exclusive",
    worktreeFlags: { bare: false, locked: false, prunable: false },
    pullRequestHint: null,
    livePullRequestEvidence: {
      source: "github-api",
      repository: "blackstarzck/topik-project-v13",
      number: 39,
      state: "MERGED",
      base: "main",
      headSha: SHA_B,
      checkedAt: FRESH_PR_CHECK,
    },
    publishedHeadSha: SHA_B,
    processState: "inactive",
    portState: "inactive",
    fileLockState: "inactive",
    snapshotStable: true,
    ...overrides,
  };
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
  if (ORIGINAL_CODEX_HOME === undefined) delete process.env.CODEX_HOME;
  else process.env.CODEX_HOME = ORIGINAL_CODEX_HOME;
});

describe("task lifecycle registry schema", () => {
  it("accepts the closed report-mode schema", () => {
    expect(validateTaskRecord(taskRecord())).toEqual([]);
  });

  it("rejects unknown, nested secret-like, prototype-pollution, and oversized data", () => {
    const sentinel = "TOP-SECRET-SENTINEL";
    const polluted = JSON.parse(
      JSON.stringify(taskRecord()).replace(
        /}$/,
        `,"__proto__":{"polluted":true},"extra":"${sentinel}"}`,
      ),
    );
    polluted.pullRequestHint = {
      repository: "owner/repo",
      number: 39,
      state: "MERGED",
      base: "main",
      headSha: SHA_A,
      checkedAt: NOW,
      token: sentinel,
    };
    polluted.lastVerification = {
      result: "passed",
      completedAt: NOW,
      checks: [{ name: "lint", result: "passed", output: sentinel }],
    };
    polluted.slug = "x".repeat(200);

    const errors = validateTaskRecord(polluted);
    const serialized = JSON.stringify(errors);

    expect(errors.map((error) => error.code)).toEqual(
      expect.arrayContaining([
        "UNKNOWN_FIELD",
        "PROTOTYPE_POLLUTION_KEY",
        "FIELD_TOO_LONG",
      ]),
    );
    expect(serialized).not.toContain(sentinel);
  });

  it.each([
    "../escape",
    "folder/task",
    "folder\\task",
    "\\\\server\\share",
    "name:stream",
    "CON",
    "CON.txt",
    "aux.json",
    "LPT1.log",
    "task.",
    "task ",
  ])("rejects unsafe task and repository identifiers: %s", (identifier) => {
    expect(
      validateTaskRecord(taskRecord({ taskId: identifier })).map(
        (error) => error.code,
      ),
    ).toContain("INVALID_IDENTIFIER");
    expect(
      validateTaskRecord(taskRecord({ repoId: identifier })).map(
        (error) => error.code,
      ),
    ).toContain("INVALID_IDENTIFIER");
  });

  it("keeps cleanup authorization false and terminal cleanup states unavailable", () => {
    expect(
      validateTaskRecord(taskRecord({ cleanupAuthorized: true })).map(
        (error) => error.code,
      ),
    ).toContain("CLEANUP_AUTHORIZATION_FORBIDDEN");
    expect(
      validateTaskRecord(taskRecord({ state: "FINALIZING" })).map(
        (error) => error.code,
      ),
    ).toContain("REPORT_STATE_FORBIDDEN");
    expect(
      validateTaskRecord(taskRecord({ state: "CLEANED" })).map(
        (error) => error.code,
      ),
    ).toContain("REPORT_STATE_FORBIDDEN");
  });

  it.each([
    [
      "hidden terminal transition",
      taskRecord({
        lastTransition: {
          from: "MERGE_VERIFIED",
          to: "FINALIZING",
          evidence: lifecycleEvidence(),
        },
      }),
      "REPORT_STATE_FORBIDDEN",
    ],
    [
      "transition target mismatch",
      taskRecord({
        state: "DISCOVERED",
        lastTransition: {
          from: "WORKING",
          to: "VERIFIED",
          evidence: lifecycleEvidence(),
        },
      }),
      "TRANSITION_STATE_MISMATCH",
    ],
    [
      "invalid transition edge",
      taskRecord({
        state: "VERIFIED",
        lastTransition: {
          from: "DISCOVERED",
          to: "VERIFIED",
          evidence: lifecycleEvidence(),
        },
      }),
      "INVALID_TRANSITION",
    ],
    [
      "future transition evidence",
      taskRecord({
        state: "ISOLATED",
        lastTransition: {
          from: "DISCOVERED",
          to: "ISOLATED",
          evidence: lifecycleEvidence({
            observedAt: "2026-07-10T00:11:00.000Z",
          }),
        },
      }),
      "TRANSITION_TIME_INVALID",
    ],
  ])("rejects %s in an otherwise valid report record", (_label, record, code) => {
    expect(validateTaskRecord(record).map((error) => error.code)).toContain(code);
  });
});

describe("task lifecycle transitions", () => {
  it("returns a new revision for an evidence-backed valid transition", () => {
    const input = taskRecord();
    const output = transitionTaskRecord(input, "ISOLATED", {
      now: "2026-07-10T00:11:00.000Z",
      evidence: lifecycleEvidence(),
    });

    expect(output).not.toBe(input);
    expect(output).toMatchObject({
      state: "ISOLATED",
      revision: 2,
      cleanupAuthorized: false,
      lastTransition: {
        from: "DISCOVERED",
        to: "ISOLATED",
        evidence: lifecycleEvidence(),
      },
    });
    expect(input.state).toBe("DISCOVERED");
  });

  it("rejects missing evidence and invalid jumps", () => {
    expect(() =>
      transitionTaskRecord(taskRecord(), "ISOLATED", { now: NOW }),
    ).toThrow(/TRANSITION_EVIDENCE_REQUIRED/);
    expect(() =>
      transitionTaskRecord(taskRecord(), "PR_OPEN", {
        now: NOW,
        evidence: lifecycleEvidence(),
      }),
    ).toThrow(/INVALID_TRANSITION/);
  });

  it("rejects a transition timestamp earlier than the current revision", () => {
    const earlier = "2026-07-09T00:10:00.000Z";

    expect(() =>
      transitionTaskRecord(taskRecord(), "ISOLATED", {
        now: earlier,
        evidence: lifecycleEvidence({ observedAt: earlier }),
      }),
    ).toThrow(/TRANSITION_TIMESTAMP_REGRESSION/);
  });

  it("rejects FINALIZING and CLEANED transitions in report mode", () => {
    const merged = taskRecord({ state: "MERGE_VERIFIED" });
    expect(() =>
      transitionTaskRecord(merged, "FINALIZING", {
        now: NOW,
        evidence: lifecycleEvidence(),
      }),
    ).toThrow(/REPORT_STATE_FORBIDDEN/);
    expect(() =>
      transitionTaskRecord(taskRecord({ state: "FINALIZING" }), "CLEANED", {
        now: NOW,
        evidence: lifecycleEvidence(),
      }),
    ).toThrow(/REPORT_STATE_FORBIDDEN/);
  });
});

describe("registry capability containment", () => {
  it("keeps lifecycle schema and state definitions in one pure shared module", () => {
    const registrySource = readFileSync(
      join(process.cwd(), "scripts/lib/task-lifecycle-registry.mjs"),
      "utf8",
    );
    const schemaSource = readFileSync(
      join(process.cwd(), "scripts/lib/task-lifecycle-schema.mjs"),
      "utf8",
    );

    expect(registrySource).toMatch(/task-lifecycle-schema/);
    expect(registrySource).not.toMatch(
      /const (REPORT_STATES|FORBIDDEN_REPORT_STATES|VALID_TRANSITIONS|TOP_LEVEL_KEYS)/,
    );
    expect(schemaSource).toMatch(/export function isForbiddenReportState/);
    expect(schemaSource).toMatch(/export function isValidTransition/);
    expect(lifecycleSchema).not.toHaveProperty("REPORT_STATES");
    expect(lifecycleSchema).not.toHaveProperty("FORBIDDEN_REPORT_STATES");
    expect(lifecycleSchema).not.toHaveProperty("VALID_TRANSITIONS");
    expect(lifecycleSchema.isForbiddenReportState("CLEANED")).toBe(true);
    expect(lifecycleSchema.isValidTransition("MERGE_VERIFIED", "CLEANED")).toBe(false);
  });

  it("derives the production root under CODEX_HOME and excludes protected Git paths", () => {
    const root = createTempRoot();
    const codexHome = join(root, "codex-home");
    const gitCommonDir = join(root, "repo", ".git");
    const worktree = join(root, "repo");
    mkdirSync(codexHome, { recursive: true });
    mkdirSync(gitCommonDir, { recursive: true });
    process.env.CODEX_HOME = codexHome;

    const capability = createProductionRegistryCapability({
      repoId: "talkpik-v13",
      gitCommonDir,
      worktreePaths: [worktree],
    });

    expect(capability.recordDir).toBe(
      join(realpathSync.native(codexHome), "worktree-lifecycle", "talkpik-v13"),
    );
    expect(capability.kind).toBe("production");

    expect(() =>
      createProductionRegistryCapability({
        codexHome: worktree,
        repoId: "talkpik-v13",
        gitCommonDir,
        worktreePaths: [worktree],
      }),
    ).toThrow(/UNKNOWN_CAPABILITY_OPTION/);
    expect(() =>
      createProductionRegistryCapability({
        repoId: "talkpik-v13",
        gitCommonDir,
        worktreePaths: [],
      }),
    ).toThrow(/PROTECTED_WORKTREES_REQUIRED/);
    process.env.CODEX_HOME = worktree;
    expect(() =>
      createProductionRegistryCapability({
        repoId: "talkpik-v13",
        gitCommonDir,
        worktreePaths: [worktree],
      }),
    ).toThrow(/REGISTRY_PROTECTED_PATH_OVERLAP/);
    expect(existsSync(join(worktree, "worktree-lifecycle"))).toBe(false);
  });

  it("binds production records to the declared Git common directory and worktrees", async () => {
    const root = createTempRoot();
    const codexHome = join(root, "codex-home");
    const worktree = join(root, "repo");
    const gitCommonDir = join(worktree, ".git");
    const otherWorktree = join(root, "other-repo");
    mkdirSync(codexHome, { recursive: true });
    mkdirSync(gitCommonDir, { recursive: true });
    mkdirSync(otherWorktree, { recursive: true });
    process.env.CODEX_HOME = codexHome;
    const capability = createProductionRegistryCapability({
      repoId: "talkpik-v13",
      gitCommonDir,
      worktreePaths: [worktree],
    });

    await expect(
      writeTaskRecordAtomic(
        taskRecord({ gitCommonDir, worktreePath: otherWorktree }),
        { capability, expectedRevision: 0 },
      ),
    ).rejects.toThrow(/REGISTRY_WORKTREE_MISMATCH/);
  });

  it("keeps test registry capabilities inside the operating-system temp directory", () => {
    const registryRoot = join(process.cwd(), "test-registry-outside-temp");

    expect(() =>
      createTestRegistryCapability({ registryRoot, repoId: "talkpik-v13" }),
    ).toThrow(/TEST_REGISTRY_ROOT_REQUIRED/);
    expect(existsSync(registryRoot)).toBe(false);
  });

  it("canonicalizes a temp-internal directory alias before containment checks", () => {
    const root = createTempRoot();
    const target = join(root, "target");
    const alias = join(root, "alias");
    mkdirSync(target, { recursive: true });
    symlinkSync(target, alias, process.platform === "win32" ? "junction" : "dir");

    const capability = createTestRegistryCapability({
      registryRoot: join(alias, "registry"),
      repoId: "talkpik-v13",
    });

    expect(capability.registryRoot).toBe(join(realpathSync.native(target), "registry"));
    expect(capability.recordDir).toBe(
      join(realpathSync.native(target), "registry", "talkpik-v13"),
    );
  });

  it("rejects a temp-internal alias whose canonical target escapes the temp root", () => {
    const root = createTempRoot();
    const alias = join(root, "outside-alias");
    symlinkSync(
      process.cwd(),
      alias,
      process.platform === "win32" ? "junction" : "dir",
    );

    expect(() =>
      createTestRegistryCapability({
        registryRoot: join(alias, "registry"),
        repoId: "talkpik-v13",
      }),
    ).toThrow(/TEST_REGISTRY_ROOT_REQUIRED/);
    expect(existsSync(join(process.cwd(), "registry"))).toBe(false);
  });

  it.runIf(process.platform === "win32")(
    "treats a DOS 8.3 short path and its canonical long path as one temp location",
    () => {
      const root = createTempRoot("v13 lifecycle short path ");
      const canonicalRoot = realpathSync.native(root);
      const shortRoot = execFileSync(
        "cmd.exe",
        ["/d", "/c", "for %I in (.) do @echo %~sI"],
        { cwd: canonicalRoot, encoding: "utf8" },
      ).trim();

      expect(shortRoot.toLowerCase()).not.toBe(canonicalRoot.toLowerCase());

      const capability = createTestRegistryCapability({
        registryRoot: join(shortRoot, "registry"),
        repoId: "talkpik-v13",
      });

      expect(capability.registryRoot).toBe(join(canonicalRoot, "registry"));
    },
  );

  it("rejects a production CODEX_HOME alias that resolves inside a protected worktree", () => {
    const root = createTempRoot();
    const worktree = join(root, "repo");
    const gitCommonDir = join(worktree, ".git");
    const codexHomeAlias = join(root, "codex-home-alias");
    mkdirSync(gitCommonDir, { recursive: true });
    symlinkSync(
      worktree,
      codexHomeAlias,
      process.platform === "win32" ? "junction" : "dir",
    );
    process.env.CODEX_HOME = codexHomeAlias;

    expect(() =>
      createProductionRegistryCapability({
        repoId: "talkpik-v13",
        gitCommonDir,
        worktreePaths: [worktree],
      }),
    ).toThrow(/CODEX_HOME_INVALID/);
    expect(existsSync(join(worktree, "worktree-lifecycle"))).toBe(false);
  });

  it("rejects an existing production registry junction outside CODEX_HOME without writing through it", () => {
    const root = createTempRoot();
    const codexHome = join(root, "codex-home");
    const external = join(root, "external");
    const worktree = join(root, "repo");
    const gitCommonDir = join(worktree, ".git");
    mkdirSync(codexHome, { recursive: true });
    mkdirSync(external, { recursive: true });
    mkdirSync(gitCommonDir, { recursive: true });
    symlinkSync(
      external,
      join(codexHome, "worktree-lifecycle"),
      process.platform === "win32" ? "junction" : "dir",
    );
    process.env.CODEX_HOME = codexHome;

    expect(() =>
      createProductionRegistryCapability({
        repoId: "talkpik-v13",
        gitCommonDir,
        worktreePaths: [worktree],
      }),
    ).toThrow(/REGISTRY_PATH_ESCAPE/);
    expect(readdirSync(external)).toEqual([]);
  });

  it("uses case-insensitive overlap checks for Windows canonical paths", () => {
    expect(
      pathsOverlap("C:\\Users\\Admin\\Repo", "c:\\users\\admin\\repo\\.git", {
        platform: "win32",
      }),
    ).toBe(true);
    expect(
      pathsOverlap("C:\\Users\\Admin\\Registry", "D:\\repo", {
        platform: "win32",
      }),
    ).toBe(false);
  });

  it("rejects a repository directory that escapes through a symlink or junction", () => {
    const root = createTempRoot();
    const registryRoot = join(root, "registry");
    const outside = join(root, "outside");
    mkdirSync(registryRoot, { recursive: true });
    mkdirSync(outside, { recursive: true });
    symlinkSync(
      outside,
      join(registryRoot, "talkpik-v13"),
      process.platform === "win32" ? "junction" : "dir",
    );

    expect(() =>
      createTestRegistryCapability({ registryRoot, repoId: "talkpik-v13" }),
    ).toThrow(/REGISTRY_PATH_ESCAPE/);
  });
});

describe("atomic registry writes", () => {
  function capabilityFor(root) {
    return createTestRegistryCapability({
      registryRoot: join(root, "registry"),
      repoId: "talkpik-v13",
    });
  }

  it("writes and reads one complete record without temp or lock residue", async () => {
    const root = createTempRoot();
    const capability = capabilityFor(root);

    const result = await writeTaskRecordAtomic(taskRecord(), {
      capability,
      expectedRevision: 0,
    });
    const records = await readTaskRecords(capability);

    expect(result.recordPath).toBe(
      join(capability.recordDir, "workflow-overhaul.json"),
    );
    expect(records).toEqual([taskRecord()]);
    expect(
      existsSync(join(capability.recordDir, "workflow-overhaul.write.lock")),
    ).toBe(false);
    expect(
      existsSync(join(capability.recordDir, "workflow-overhaul.json.tmp")),
    ).toBe(false);
  });

  it("allows only one concurrent writer for the same expected revision", async () => {
    const root = createTempRoot();
    const capability = capabilityFor(root);
    await writeTaskRecordAtomic(taskRecord(), {
      capability,
      expectedRevision: 0,
    });
    const next = taskRecord({ revision: 2, updatedAt: "2026-07-10T00:12:00.000Z" });

    const results = await Promise.allSettled([
      writeTaskRecordAtomic(next, { capability, expectedRevision: 1 }),
      writeTaskRecordAtomic(next, { capability, expectedRevision: 1 }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((await readTaskRecords(capability))[0].revision).toBe(2);
  });

  it("never removes a write lock owned by another concurrent writer", async () => {
    const root = createTempRoot();
    const capability = capabilityFor(root);
    await writeTaskRecordAtomic(taskRecord(), {
      capability,
      expectedRevision: 0,
    });
    const next = taskRecord({ revision: 2, updatedAt: "2026-07-10T00:12:00.000Z" });
    let signalPaused;
    let releaseRename;
    const paused = new Promise((resolve) => {
      signalPaused = resolve;
    });
    const release = new Promise((resolve) => {
      releaseRename = resolve;
    });
    const firstWriter = writeTaskRecordAtomic(next, {
      capability,
      expectedRevision: 1,
      testHooks: {
        beforeRename: async () => {
          signalPaused();
          await release;
        },
      },
    });

    await paused;
    await expect(
      writeTaskRecordAtomic(next, { capability, expectedRevision: 1 }),
    ).rejects.toThrow(/REGISTRY_WRITE_CONFLICT/);
    expect(
      existsSync(join(capability.recordDir, "workflow-overhaul.write.lock")),
    ).toBe(true);
    await expect(
      writeTaskRecordAtomic(next, { capability, expectedRevision: 1 }),
    ).rejects.toThrow(/REGISTRY_WRITE_CONFLICT/);

    releaseRename();
    await firstWriter;
    expect((await readTaskRecords(capability))[0].revision).toBe(2);
  });

  it("preserves a foreign lock that replaces the acquired lock before release", async () => {
    const root = createTempRoot();
    const capability = capabilityFor(root);
    const lockPath = join(
      capability.recordDir,
      "workflow-overhaul.write.lock",
    );
    await writeTaskRecordAtomic(taskRecord(), {
      capability,
      expectedRevision: 0,
    });

    await writeTaskRecordAtomic(
      taskRecord({ revision: 2, updatedAt: "2026-07-10T00:12:00.000Z" }),
      {
        capability,
        expectedRevision: 1,
        testHooks: {
          beforeLockRelease: async () => {
            rmSync(lockPath, { force: true });
            writeFileSync(lockPath, "foreign-owner\n", "utf8");
          },
        },
      },
    );

    expect(readFileSync(lockPath, "utf8")).toBe("foreign-owner\n");
    await expect(
      writeTaskRecordAtomic(
        taskRecord({ revision: 3, updatedAt: "2026-07-10T00:13:00.000Z" }),
        { capability, expectedRevision: 2 },
      ),
    ).rejects.toThrow(/REGISTRY_WRITE_CONFLICT/);
  });

  it.each(["write", "fsync", "rename"])(
    "preserves the previous valid record when %s fails",
    async (failAt) => {
      const root = createTempRoot();
      const capability = capabilityFor(root);
      await writeTaskRecordAtomic(taskRecord(), {
        capability,
        expectedRevision: 0,
      });
      const original = readFileSync(
        join(capability.recordDir, "workflow-overhaul.json"),
        "utf8",
      );

      await expect(
        writeTaskRecordAtomic(
          taskRecord({ revision: 2, updatedAt: "2026-07-10T00:12:00.000Z" }),
          {
            capability,
            expectedRevision: 1,
            testHooks: { failAt },
          },
        ),
      ).rejects.toThrow(/REGISTRY_ATOMIC_WRITE_FAILED/);

      expect(
        readFileSync(join(capability.recordDir, "workflow-overhaul.json"), "utf8"),
      ).toBe(original);
      expect(
        existsSync(join(capability.recordDir, "workflow-overhaul.write.lock")),
      ).toBe(false);
    },
  );

  it("keeps the old record readable until rename publishes the complete new record", async () => {
    const root = createTempRoot();
    const capability = capabilityFor(root);
    await writeTaskRecordAtomic(taskRecord(), {
      capability,
      expectedRevision: 0,
    });

    let releaseRename;
    let signalPaused;
    const paused = new Promise((resolve) => {
      signalPaused = resolve;
    });
    const release = new Promise((resolve) => {
      releaseRename = resolve;
    });
    const writePromise = writeTaskRecordAtomic(
      taskRecord({ revision: 2, updatedAt: "2026-07-10T00:13:00.000Z" }),
      {
        capability,
        expectedRevision: 1,
        testHooks: {
          beforeRename: async () => {
            signalPaused();
            await release;
          },
        },
      },
    );

    await paused;
    expect((await readTaskRecords(capability))[0].revision).toBe(1);
    releaseRename();
    await writePromise;
    expect((await readTaskRecords(capability))[0].revision).toBe(2);
  });

  it("does not overwrite corrupt or non-registry target content", async () => {
    const root = createTempRoot();
    const capability = capabilityFor(root);
    mkdirSync(dirname(join(capability.recordDir, "workflow-overhaul.json")), {
      recursive: true,
    });
    writeFileSync(
      join(capability.recordDir, "workflow-overhaul.json"),
      "not a registry record",
      "utf8",
    );

    await expect(
      writeTaskRecordAtomic(taskRecord({ revision: 2 }), {
        capability,
        expectedRevision: 1,
      }),
    ).rejects.toThrow(/CORRUPT_EXISTING_RECORD/);
  });
});

describe("report-only worktree classification", () => {
  it("marks only a fully evidenced merged item as a review candidate", () => {
    expect(classifyWorktreeSnapshot(safeSnapshot(), { now: NOW })).toMatchObject({
      disposition: "REVIEW_CANDIDATE",
      cleanupReady: false,
      deletionAuthorized: false,
    });
  });

  it.each([
    ["detached", { detached: true, branch: null }],
    ["tracked dirty", { trackedChanges: ["src/app/page.tsx"] }],
    ["untracked", { untrackedFiles: ["notes.txt"] }],
    ["ignored-sensitive", { ignoredEntries: [".env.local"] }],
    ["unknown owner", { owner: null, ownerEvidence: "unknown" }],
    ["branch conflict", { branchOwnership: "conflict" }],
    ["path conflict", { pathOwnership: "conflict" }],
    ["process unknown", { processState: "unknown" }],
    ["port active", { portState: "active" }],
    ["file lock unknown", { fileLockState: "unknown" }],
    ["snapshot race", { snapshotStable: false }],
    ["main branch", { branch: "main" }],
    ["collab branch", { branch: "collab" }],
    ["current head mismatch", { headSha: SHA_A }],
    [
      "repository mismatch",
      {
        livePullRequestEvidence: {
          ...safeSnapshot().livePullRequestEvidence,
          repository: "other/repository",
        },
      },
    ],
    ["status failure", { statusEvidence: "failed" }],
    ["ignored scan failure", { ignoredEvidence: "failed" }],
    ["closed PR", { livePullRequestEvidence: { state: "CLOSED" } }],
    ["unknown PR", { livePullRequestEvidence: null }],
    [
      "stale PR evidence",
      {
        livePullRequestEvidence: {
          ...safeSnapshot().livePullRequestEvidence,
          checkedAt: "2026-07-09T20:00:00.000Z",
        },
      },
    ],
  ])("fails closed for %s", (_label, overrides) => {
    const result = classifyWorktreeSnapshot(safeSnapshot(overrides), { now: NOW });
    expect(result.disposition).toBe("NEEDS_ATTENTION");
    expect(result.cleanupReady).toBe(false);
    expect(result.deletionAuthorized).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.nextReviewChecks.length).toBeGreaterThan(0);
  });

  it("does not treat a registry PR hint as live GitHub evidence", () => {
    const result = classifyWorktreeSnapshot(
      safeSnapshot({
        livePullRequestEvidence: null,
        pullRequestHint: {
          repository: "owner/repo",
          number: 39,
          state: "MERGED",
          base: "main",
          headSha: SHA_B,
          checkedAt: FRESH_PR_CHECK,
        },
      }),
      { now: NOW },
    );

    expect(result.disposition).toBe("NEEDS_ATTENTION");
    expect(result.reasons).toContain("LIVE_PR_EVIDENCE_MISSING");
  });

  it("keeps a clean base checkout preserved and an open task active", () => {
    expect(
      classifyWorktreeSnapshot(
        safeSnapshot({
          isBaseCheckout: true,
          branch: "main",
          livePullRequestEvidence: null,
        }),
        { now: NOW },
      ).disposition,
    ).toBe("PRESERVED");
    expect(
      classifyWorktreeSnapshot(
        safeSnapshot({
          isCurrent: true,
          livePullRequestEvidence: {
            ...safeSnapshot().livePullRequestEvidence,
            state: "OPEN",
          },
        }),
        { now: NOW },
      ).disposition,
    ).toBe("ACTIVE");
  });

  it("never emits a review candidate for the current task even after merge", () => {
    expect(
      classifyWorktreeSnapshot(safeSnapshot({ isCurrent: true }), { now: NOW }),
    ).toMatchObject({
      disposition: "ACTIVE",
      cleanupReady: false,
      deletionAuthorized: false,
    });
  });

  it("still sends dirty current and base checkouts to attention", () => {
    for (const marker of [{ isCurrent: true }, { isBaseCheckout: true }]) {
      expect(
        classifyWorktreeSnapshot(
          safeSnapshot({ ...marker, trackedChanges: ["user-change.txt"] }),
          { now: NOW },
        ).disposition,
      ).toBe("NEEDS_ATTENTION");
    }
  });
});
