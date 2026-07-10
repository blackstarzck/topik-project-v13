import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  assertReadOnlyGitOperation,
  collectWorktreeInventory,
  gitInvocationFor,
  parseIgnoredStatus,
  parseStatusPorcelainV2,
  parseWorktreePorcelain,
  readCodexOwnerEvidence,
  renderInventoryJson,
  renderInventoryMarkdown,
} from "../../scripts/report-worktree-lifecycle.mjs";

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);
const NOW = "2026-07-10T00:10:00.000Z";
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
let tempDirs = [];

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs = [];
});

function commandResult(stdout = "", overrides = {}) {
  return { status: 0, stdout, stderr: "", ...overrides };
}

function registryHintRecord(overrides = {}) {
  return {
    schemaVersion: 1,
    mode: "report",
    taskId: "workflow-overhaul",
    slug: "workflow-overhaul",
    owner: "codex-desktop",
    repoId: "talkpik-v13",
    gitCommonDir: "C:/repo/.git",
    worktreePath: "C:/?뚰겕 tree",
    branch: "codex/workflow-overhaul",
    baseRef: "origin/main",
    baseSha: SHA_A,
    publishedHeadSha: SHA_B,
    pullRequestHint: null,
    state: "PR_OPEN",
    ports: [],
    lastVerification: null,
    lastTransition: null,
    cleanupAuthorized: false,
    revision: 1,
    updatedAt: NOW,
    ...overrides,
  };
}

function worktreeOutput() {
  return [
    "worktree C:/repo",
    `HEAD ${SHA_A}`,
    "branch refs/heads/main",
    "",
    "worktree C:/워크 tree",
    `HEAD ${SHA_B}`,
    "detached",
    "locked user reason",
    "",
  ].join("\0");
}

function stableRunner(overrides = {}) {
  const calls = [];
  const refs = `refs/heads/main\0${SHA_A}\0refs/heads/codex/task\0${SHA_B}\0`;
  const results = [
    commandResult(worktreeOutput()),
    commandResult(refs),
    commandResult(""),
    commandResult("!! node_modules/\0"),
    commandResult(""),
    commandResult("!! .next/\0"),
    commandResult(""),
    commandResult("!! node_modules/\0"),
    commandResult(""),
    commandResult("!! .next/\0"),
    commandResult(worktreeOutput()),
    commandResult(refs),
  ];
  let index = 0;
  const executeGit = (request) => {
    calls.push(request);
    const replacement = overrides[index];
    const result = replacement ?? results[index];
    index += 1;
    return result;
  };
  return { calls, executeGit };
}

describe("NUL-delimited Git porcelain parsers", () => {
  it("parses spaces, Unicode, detached, locked, prunable, and bare records", () => {
    const output =
      worktreeOutput() +
      [
        "worktree C:/old tree",
        `HEAD ${SHA_A}`,
        "branch refs/heads/old",
        "prunable gitdir file points to non-existent location",
        "",
        "worktree C:/bare",
        "bare",
        "",
      ].join("\0");

    expect(parseWorktreePorcelain(output)).toEqual([
      expect.objectContaining({
        worktreePath: "C:/repo",
        headSha: SHA_A,
        branch: "main",
        detached: false,
      }),
      expect.objectContaining({
        worktreePath: "C:/워크 tree",
        detached: true,
        locked: true,
      }),
      expect.objectContaining({ worktreePath: "C:/old tree", prunable: true }),
      expect.objectContaining({ worktreePath: "C:/bare", bare: true }),
    ]);
  });

  it("parses ordinary, untracked, rename, spaces, Unicode, and CRLF paths", () => {
    const status = [
      `1 .M N... 100644 100644 100644 ${SHA_A} ${SHA_B} file with space.txt`,
      "? 새 파일.txt",
      `2 R. N... 100644 100644 100644 ${SHA_A} ${SHA_B} R100 renamed file.txt`,
      "old file.txt",
      `2 C. N... 100644 100644 100644 ${SHA_A} ${SHA_B} C100 copied file.txt`,
      "source file.txt",
      "? windows-name.txt\r\n",
      "",
    ].join("\0");

    expect(parseStatusPorcelainV2(status)).toEqual({
      trackedChanges: ["file with space.txt", "renamed file.txt", "copied file.txt"],
      untrackedFiles: ["새 파일.txt", "windows-name.txt"],
    });
  });

  it("parses ignored matching entries without treating normal status as ignored", () => {
    expect(
      parseIgnoredStatus("!! node_modules/\0!! .env.local\0?? normal.txt\0"),
    ).toEqual(["node_modules/", ".env.local"]);
    expect(
      parseIgnoredStatus("R  renamed.txt\0old-name.txt\0!! .env.local\0"),
    ).toEqual([".env.local"]);
  });

  it("rejects malformed non-empty worktree, status, and ignored records", () => {
    expect(() =>
      parseWorktreePorcelain(
        `worktree C:/repo\0HEAD ${SHA_A}\0unexpected field\0\0`,
      ),
    ).toThrow(/INVALID_WORKTREE_PORCELAIN/);
    expect(() => parseStatusPorcelainV2("unexpected record\0")).toThrow(
      /INVALID_STATUS_PORCELAIN/,
    );
    expect(() => parseIgnoredStatus("unexpected record\0")).toThrow(
      /INVALID_IGNORED_PORCELAIN/,
    );
  });
});

describe("read-only Git invocation contract", () => {
  it("builds exact no-lock, no-shell invocations", () => {
    expect(gitInvocationFor({ operation: "list-worktrees", cwd: "C:/repo" })).toEqual({
      command: "git",
      args: [
        "--no-optional-locks",
        "-C",
        "C:/repo",
        "worktree",
        "list",
        "--porcelain",
        "-z",
      ],
      env: expect.objectContaining({ GIT_OPTIONAL_LOCKS: "0" }),
      shell: false,
    });
    expect(gitInvocationFor({ operation: "status", cwd: "C:/repo" }).args).toEqual([
      "--no-optional-locks",
      "-C",
      "C:/repo",
      "-c",
      "status.showUntrackedFiles=all",
      "status",
      "--porcelain=v2",
      "-z",
      "--untracked-files=all",
      "--ignore-submodules=none",
    ]);
    expect(
      gitInvocationFor({ operation: "ignored-status", cwd: "C:/repo" }).args,
    ).toEqual([
      "--no-optional-locks",
      "-C",
      "C:/repo",
      "-c",
      "status.showUntrackedFiles=all",
      "status",
      "--porcelain=v1",
      "-z",
      "--ignored=matching",
      "--untracked-files=all",
      "--ignore-submodules=none",
    ]);
    expect(gitInvocationFor({ operation: "refs", cwd: "C:/repo" }).args).toEqual([
      "--no-optional-locks",
      "-C",
      "C:/repo",
      "for-each-ref",
      "--format=%(refname)%00%(objectname)%00",
    ]);
  });

  it("rejects arbitrary or mutating operations", () => {
    for (const operation of ["remove-worktree", "prune", "delete-branch", "status; rm"] ) {
      expect(() => assertReadOnlyGitOperation(operation)).toThrow(
        /READ_ONLY_GIT_OPERATION_REQUIRED/,
      );
    }
  });
});

describe("inventory collection", () => {
  it("recognizes valid Codex metadata without returning the owner thread ID", () => {
    const root = mkdtempSync(join(tmpdir(), "v13-codex-owner-"));
    tempDirs.push(root);
    const worktree = join(root, "worktree");
    const gitDir = join(root, "gitdir");
    mkdirSync(worktree, { recursive: true });
    mkdirSync(gitDir, { recursive: true });
    writeFileSync(join(worktree, ".git"), `gitdir: ${gitDir}\n`, "utf8");
    writeFileSync(
      join(gitDir, "codex-thread.json"),
      JSON.stringify({ version: 1, ownerThreadId: "SECRET-THREAD-ID" }),
      "utf8",
    );

    const evidence = readCodexOwnerEvidence(worktree);

    expect(evidence).toEqual({
      owner: "codex-desktop",
      ownerEvidence: "task-metadata",
    });
    expect(JSON.stringify(evidence)).not.toContain("SECRET-THREAD-ID");
  });

  it("rejects corrupt or secret-bearing registry hints with a code-only error", async () => {
    const sentinel = "TOP-SECRET-SENTINEL";
    const runner = stableRunner();
    let caught;

    try {
      await collectWorktreeInventory({
        repoRoot: "C:/repo",
        currentPath: "C:/워크 tree",
        now: NOW,
        executeGit: runner.executeGit,
        registryHints: [
          registryHintRecord({
            worktreePath: "C:/워크 tree",
            owner: sentinel,
            publishedHeadSha: SHA_B,
            pullRequestHint: {
              repository: "owner/repo",
              number: 39,
              state: "MERGED",
              base: "main",
              headSha: SHA_B,
              checkedAt: NOW,
              token: sentinel,
            },
          }),
        ],
      });
    } catch (error) {
      caught = error;
    }

    expect(caught?.code).toBe("REGISTRY_HINT_INVALID");
    expect(String(caught?.message)).not.toContain(sentinel);
  });

  it.each([
    ["terminal state", { state: "CLEANED" }],
    ["secret-bearing revision", { revision: "TOP-SECRET-SENTINEL" }],
    ["invalid update time", { updatedAt: "not-a-time" }],
  ])("rejects a corrupt complete registry envelope: %s", async (_label, overrides) => {
    const runner = stableRunner();
    let caught;

    try {
      await collectWorktreeInventory({
        repoRoot: "C:/repo",
        currentPath: "C:/?뚰겕 tree",
        now: NOW,
        executeGit: runner.executeGit,
        registryHints: [registryHintRecord(overrides)],
      });
    } catch (error) {
      caught = error;
    }

    expect(caught?.code).toBe("REGISTRY_HINT_INVALID");
    expect(String(caught?.message)).not.toContain("TOP-SECRET-SENTINEL");
  });

  it("does not render free-form PR hint values", async () => {
    const sentinel = "TOP-SECRET-SENTINEL";
    const runner = stableRunner();
    const inventory = await collectWorktreeInventory({
      repoRoot: "C:/repo",
      currentPath: "C:/?뚰겕 tree",
      now: NOW,
      executeGit: runner.executeGit,
      registryHints: [
        registryHintRecord({
          worktreePath: parseWorktreePorcelain(worktreeOutput())[1].worktreePath,
          pullRequestHint: {
            repository: `${sentinel}/repo`,
            number: 39,
            state: "MERGED",
            base: sentinel,
            headSha: SHA_B,
            checkedAt: NOW,
          },
        }),
      ],
    });

    expect(renderInventoryJson(inventory)).not.toContain(sentinel);
    expect(inventory.entries[1].pullRequestHint).toEqual({
      number: 39,
      state: "MERGED",
      checkedAt: NOW,
    });
  });

  it("uses the exact transcript, keeps registry hints display-only, and produces no candidates", async () => {
    const runner = stableRunner();
    const inventory = await collectWorktreeInventory({
      repoRoot: "C:/repo",
      currentPath: "C:/워크 tree",
      now: NOW,
      executeGit: runner.executeGit,
      registryHints: [
        registryHintRecord({
          worktreePath: "C:/워크 tree",
          owner: "codex-desktop",
          pullRequestHint: {
            repository: "owner/repo",
            number: 39,
            state: "MERGED",
            base: "main",
            headSha: SHA_B,
            checkedAt: NOW,
          },
        }),
      ],
    });

    expect(runner.calls.map((call) => call.operation)).toEqual([
      "list-worktrees",
      "refs",
      "status",
      "ignored-status",
      "status",
      "ignored-status",
      "status",
      "ignored-status",
      "status",
      "ignored-status",
      "list-worktrees",
      "refs",
    ]);
    expect(inventory.entries).toHaveLength(2);
    expect(inventory.snapshotStable).toBe(true);
    expect(
      inventory.entries.every(
        (entry) => entry.snapshotStable === inventory.snapshotStable,
      ),
    ).toBe(true);
    expect(inventory.entries.every((entry) => entry.cleanupReady === false)).toBe(true);
    expect(
      inventory.entries.some((entry) => entry.disposition === "REVIEW_CANDIDATE"),
    ).toBe(false);
    expect(inventory.entries[1].reasons).toContain("WORKTREE_LOCKED");
    expect(inventory.entries[1].reasons).toContain("LIVE_PR_EVIDENCE_MISSING");
  });

  it("fails closed on command failure, stderr, disappearing paths, or snapshot races", async () => {
    const changedList = worktreeOutput().replace(SHA_B, SHA_A);
    const runner = stableRunner({
      2: commandResult("", { status: 1, stderr: "status failed" }),
      10: commandResult(changedList),
    });

    const inventory = await collectWorktreeInventory({
      repoRoot: "C:/repo",
      currentPath: "C:/워크 tree",
      now: NOW,
      executeGit: runner.executeGit,
      registryHints: [],
    });

    expect(inventory.snapshotStable).toBe(false);
    expect(inventory.entries.every((entry) => entry.disposition !== "REVIEW_CANDIDATE")).toBe(
      true,
    );
    expect(inventory.entries[0].reasons).toEqual(
      expect.arrayContaining(["STATUS_COMMAND_FAILED", "SNAPSHOT_CHANGED"]),
    );
  });

  it("fails closed when status changes between the two read-only scans", async () => {
    const runner = stableRunner({
      6: commandResult("? late-file.txt\0"),
    });

    const inventory = await collectWorktreeInventory({
      repoRoot: "C:/repo",
      currentPath: "C:/?뚰겕 tree",
      now: NOW,
      executeGit: runner.executeGit,
      registryHints: [],
    });

    expect(inventory.snapshotStable).toBe(false);
    expect(inventory.entries[0].statusEvidence).toBe("failed");
    expect(inventory.entries[0].reasons).toEqual(
      expect.arrayContaining(["STATUS_COMMAND_FAILED", "SNAPSHOT_CHANGED"]),
    );
  });

  it.each([
    ["status", 2, "unexpected status record\0", "statusEvidence", "STATUS_COMMAND_FAILED"],
    ["ignored", 3, "unexpected ignored record\0", "ignoredEvidence", "IGNORED_SCAN_FAILED"],
  ])(
    "marks malformed %s output as failed evidence",
    async (_label, transcriptIndex, malformed, evidenceField, reason) => {
      const runner = stableRunner({
        [transcriptIndex]: commandResult(malformed),
      });

      const inventory = await collectWorktreeInventory({
        repoRoot: "C:/repo",
        currentPath: "C:/?뚰겕 tree",
        now: NOW,
        executeGit: runner.executeGit,
        registryHints: [],
      });

      expect(inventory.entries[0][evidenceField]).toBe("failed");
      expect(inventory.entries[0].reasons).toContain(reason);
    },
  );
});

describe("report rendering and capability isolation", () => {
  const inventory = {
    schemaVersion: 1,
    mode: "report",
    generatedAt: NOW,
    repository: "C:/repo",
    snapshotStable: true,
    cleanupReady: false,
    deletionAuthorized: false,
    notice: "review-only; deletion not authorized",
    entries: [
      {
        worktreePath: "C:/repo",
        branch: "main",
        owner: "baseline-checkout",
        disposition: "PRESERVED",
        reasons: ["BASE_CHECKOUT"],
        preserveReasons: ["baseline checkout must remain"],
        nextReviewChecks: ["confirm user-owned changes"],
        cleanupReady: false,
        deletionAuthorized: false,
      },
    ],
  };

  it("renders owner, preservation reason, next checks, and explicit no-cleanup flags", () => {
    const markdown = renderInventoryMarkdown(inventory);
    const json = renderInventoryJson(inventory);

    for (const output of [markdown, json]) {
      expect(output).toContain("baseline-checkout");
      expect(output).toContain("cleanup");
      expect(output).toContain("false");
      expect(output).toContain("deletion not authorized");
      expect(output).not.toMatch(/git\s+worktree\s+(remove|prune)/i);
      expect(output).not.toMatch(/git\s+branch\s+-[dD]/i);
      expect(output).not.toContain("--force");
    }
  });

  it("neutralizes Markdown delimiters and control characters in dynamic paths", () => {
    const unsafeInventory = structuredClone(inventory);
    unsafeInventory.repository = "C:/repo`break|column\r\nnext\u0001";
    unsafeInventory.entries[0].worktreePath = "C:/tree`break|column\r\nnext\u0001";

    const markdown = renderInventoryMarkdown(unsafeInventory);

    expect(markdown).not.toContain("\u0001");
    expect(markdown).not.toContain("`break");
    expect(markdown).toContain("\\|column");
    expect(markdown).not.toContain("\r");
  });

  it("does not import registry writers, network, schedulers, or destructive commands", () => {
    const source = readFileSync(
      resolve(repoRoot, "scripts/report-worktree-lifecycle.mjs"),
      "utf8",
    );

    expect(source).not.toMatch(/task-lifecycle-registry/);
    expect(source).not.toMatch(/node:(http|https|net)/);
    expect(source).not.toMatch(/setInterval|setTimeout|watchFile|watch\(/);
    expect(source).not.toMatch(/worktree\s+remove|worktree\s+prune|branch\s+-[dD]|--force/);
  });

  it("accepts a valid complete record through the real --registry-root CLI path", () => {
    const registryRoot = mkdtempSync(join(tmpdir(), "v13-report-registry-"));
    tempDirs.push(registryRoot);
    writeFileSync(
      join(registryRoot, "workflow-overhaul.json"),
      `${JSON.stringify(registryHintRecord(), null, 2)}\n`,
      "utf8",
    );

    const result = spawnSync(
      process.execPath,
      [
        resolve(repoRoot, "scripts/report-worktree-lifecycle.mjs"),
        "--repo",
        repoRoot,
        "--format",
        "json",
        "--registry-root",
        registryRoot,
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
        timeout: 120_000,
        maxBuffer: 32 * 1024 * 1024,
        windowsHide: true,
      },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      schemaVersion: 1,
      mode: "report",
      cleanupReady: false,
      deletionAuthorized: false,
    });
  }, 120_000);
});
