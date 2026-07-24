import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import {
  ValidationEvidenceError,
  checkValidationEvidence,
  computeApprovedWorkflowDigest,
  createValidationEvidenceV1,
  evaluateValidationEvidence,
  getApprovedValidationWorkflowDefinition,
  listValidationEvidence,
  readValidationEvidence,
  recordApprovedValidationEvidence,
  resolveGitCommonDir,
  runValidationEvidenceCli,
  validateValidationEvidenceV1,
  validationEvidenceStoragePath,
  writeValidationEvidence,
} from "../../scripts/lib/ai-validation-evidence.mjs";

const HEAD_SHA = "1".repeat(40);
const BASE_SHA = "2".repeat(40);
const WORKFLOW_DIGEST = "3".repeat(64);
const NOW = "2026-07-23T00:00:00.000Z";
const roots = [];

function tempRoot() {
  const root = mkdtempSync(path.join(tmpdir(), "talkpik-validation-evidence-"));
  roots.push(root);
  return root;
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function input(overrides = {}) {
  return {
    headSha: HEAD_SHA,
    baseSha: BASE_SHA,
    workflowDigest: WORKFLOW_DIGEST,
    result: "SUCCESS",
    complete: true,
    durationMs: 1234,
    recordedAt: NOW,
    revision: 1,
    ...overrides,
  };
}

function createBareGitCommonDir() {
  const root = tempRoot();
  const commonDir = path.join(root, ".git");
  mkdirSync(commonDir);
  return commonDir;
}

function createApprovedWorkflowRepo() {
  const repoPath = tempRoot();
  mkdirSync(path.join(repoPath, ".git"));
  const workflow = getApprovedValidationWorkflowDefinition("pipeline-v3.1-black-pr-full");
  for (const relativePath of workflow.digestFiles) {
    const target = path.join(repoPath, relativePath);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, `fixture:${relativePath}\n`);
  }
  return { repoPath, workflow };
}

function trustedGitSpawn({ dirty = false, headSha = HEAD_SHA, baseSha = BASE_SHA } = {}) {
  return (_command, args) => {
    const operation = args.slice(3);
    if (operation[0] === "--git-common-dir") {
      return { status: 0, stdout: ".git\n", stderr: "" };
    }
    if (operation[0] === "--verify" && operation[1] === "HEAD^{commit}") {
      return { status: 0, stdout: `${headSha}\n`, stderr: "" };
    }
    if (operation[0] === "--verify" && operation[1] === "origin/main^{commit}") {
      return { status: 0, stdout: `${baseSha}\n`, stderr: "" };
    }
    if (operation[0] === "--porcelain=v1") {
      return { status: 0, stdout: dirty ? " M source.ts\n" : "", stderr: "" };
    }
    throw new Error(`unexpected git operation: ${operation.join(" ")}`);
  };
}

afterEach(() => {
  roots.length = 0;
});

describe("ValidationEvidenceV1 schema and reuse", () => {
  test("creates a closed, fingerprinted, secret-safe record", () => {
    const record = createValidationEvidenceV1(input());

    expect(record).toMatchObject({
      schemaVersion: 1,
      recordType: "ValidationEvidenceV1",
      headSha: HEAD_SHA,
      baseSha: BASE_SHA,
      workflowDigest: WORKFLOW_DIGEST,
      result: "SUCCESS",
      complete: true,
      durationMs: 1234,
      recordedAt: NOW,
      revision: 1,
    });
    expect(record.fingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.stringify(record)).not.toMatch(/command|environment|output|token|secret/iu);
    expect(validateValidationEvidenceV1(record)).toEqual([]);
  });

  test("reuses only a complete SUCCESS for the exact key", () => {
    const expected = {
      headSha: HEAD_SHA,
      baseSha: BASE_SHA,
      workflowDigest: WORKFLOW_DIGEST,
    };

    expect(evaluateValidationEvidence(createValidationEvidenceV1(input()), expected)).toEqual({
      reusable: true,
      code: "REUSABLE",
    });
    expect(
      evaluateValidationEvidence(
        createValidationEvidenceV1(input({ result: "FAILED" })),
        expected,
      ),
    ).toEqual({ reusable: false, code: "RESULT_NOT_SUCCESS" });
    expect(
      evaluateValidationEvidence(
        createValidationEvidenceV1(input({ complete: false })),
        expected,
      ),
    ).toEqual({ reusable: false, code: "INCOMPLETE" });
    expect(
      evaluateValidationEvidence(createValidationEvidenceV1(input()), {
        ...expected,
        baseSha: "4".repeat(40),
      }),
    ).toEqual({ reusable: false, code: "STALE_EVIDENCE" });
  });

  test("rejects unknown fields, schema drift, secret-looking keys, and upper-case keys", () => {
    const record = createValidationEvidenceV1(input());

    expect(validateValidationEvidenceV1({ ...record, command: "pnpm test" })).toContainEqual({
      code: "UNKNOWN_FIELD",
      path: "command",
    });
    expect(validateValidationEvidenceV1({ ...record, token: "redacted" })).toContainEqual({
      code: "SECRET_FIELD",
      path: "token",
    });
    expect(validateValidationEvidenceV1({ ...record, schemaVersion: 2 })).toContainEqual({
      code: "INVALID_SCHEMA",
      path: "schemaVersion",
    });
    expect(() =>
      createValidationEvidenceV1(input({ headSha: "A".repeat(40) })),
    ).toThrowError("VALIDATION_EVIDENCE_INVALID");
    expect(() =>
      createValidationEvidenceV1(input({ headSha: "../outside" })),
    ).toThrowError("VALIDATION_EVIDENCE_INVALID");
    expect(() =>
      createValidationEvidenceV1({ ...input(), command: "pnpm test" }),
    ).toThrowError("VALIDATION_EVIDENCE_INVALID");
    expect(() =>
      createValidationEvidenceV1({ ...input(), token: "must-not-be-accepted" }),
    ).toThrowError("VALIDATION_EVIDENCE_INVALID");
  });
});

describe("ValidationEvidenceV1 registry", () => {
  test("writes atomically, reads by exact key, and enforces fingerprint CAS", () => {
    const gitCommonDir = createBareGitCommonDir();
    const first = createValidationEvidenceV1(input());
    writeValidationEvidence({ gitCommonDir, record: first });

    expect(
      readValidationEvidence({
        gitCommonDir,
        headSha: HEAD_SHA,
        baseSha: BASE_SHA,
        workflowDigest: WORKFLOW_DIGEST,
      }),
    ).toEqual(first);
    expect(() => writeValidationEvidence({ gitCommonDir, record: first })).toThrowError(
      "VALIDATION_EVIDENCE_EXISTS",
    );

    const second = createValidationEvidenceV1(
      input({ durationMs: 1400, revision: 2 }),
    );
    expect(() =>
      writeValidationEvidence({
        gitCommonDir,
        record: second,
        expectedFingerprint: "f".repeat(64),
      }),
    ).toThrowError("VALIDATION_EVIDENCE_STALE");
    writeValidationEvidence({
      gitCommonDir,
      record: second,
      expectedFingerprint: first.fingerprint,
    });
    expect(readFileSync(validationEvidenceStoragePath(gitCommonDir, second), "utf8")).toContain(
      second.fingerprint,
    );
  });

  test("rejects a concurrent writer lock without changing the record", () => {
    const gitCommonDir = createBareGitCommonDir();
    const record = createValidationEvidenceV1(input());
    const target = validationEvidenceStoragePath(gitCommonDir, record);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(`${target}.lock`, "occupied", { flag: "wx" });

    expect(() => writeValidationEvidence({ gitCommonDir, record })).toThrowError(
      "VALIDATION_EVIDENCE_LOCKED",
    );
    expect(existsSync(target)).toBe(false);
  });

  test("rejects symlink or reparse traversal in the registry", () => {
    const gitCommonDir = createBareGitCommonDir();
    const outside = tempRoot();
    const registry = path.join(gitCommonDir, "talkpik-validation");
    try {
      symlinkSync(outside, registry, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (error?.code === "EPERM") return;
      throw error;
    }

    expect(() =>
      writeValidationEvidence({
        gitCommonDir,
        record: createValidationEvidenceV1(input()),
      }),
    ).toThrowError("VALIDATION_REGISTRY_PATH_UNSAFE");
  });

  test("check is read-only when the registry and evidence do not exist", () => {
    const gitCommonDir = createBareGitCommonDir();
    const registry = path.join(gitCommonDir, "talkpik-validation");

    expect(
      checkValidationEvidence({
        gitCommonDir,
        headSha: HEAD_SHA,
        baseSha: BASE_SHA,
        workflowDigest: WORKFLOW_DIGEST,
      }),
    ).toEqual({ reusable: false, code: "NOT_FOUND" });
    expect(existsSync(registry)).toBe(false);
  });

  test("listing rejects malformed evidence instead of trusting it", () => {
    const gitCommonDir = createBareGitCommonDir();
    const record = createValidationEvidenceV1(input());
    const target = validationEvidenceStoragePath(gitCommonDir, record);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, JSON.stringify({ ...record, output: "unsafe" }));

    expect(() => listValidationEvidence({ gitCommonDir })).toThrowError(
      "VALIDATION_EVIDENCE_INVALID",
    );
  });
});

describe("Git and CLI adapters", () => {
  test("resolves the common directory with shell disabled and poisoned GIT variables removed", () => {
    const repoPath = tempRoot();
    const gitCommonDir = path.join(repoPath, ".git");
    mkdirSync(gitCommonDir);
    const previous = process.env.GIT_DIR;
    process.env.GIT_DIR = path.join(repoPath, "poison");
    let invocation;
    try {
      const resolved = resolveGitCommonDir({
        repoPath,
        spawn(command, args, options) {
          invocation = { command, args, options };
          return { status: 0, stdout: ".git\n", stderr: "" };
        },
      });

      expect(resolved.toLowerCase()).toBe(gitCommonDir.toLowerCase());
      expect(invocation.command).toBe("git");
      expect(invocation.args).toEqual(["-C", path.resolve(repoPath), "rev-parse", "--git-common-dir"]);
      expect(invocation.options.shell).toBe(false);
      expect(invocation.options.env.GIT_DIR).toBeUndefined();
      expect(invocation.options.env.GIT_TERMINAL_PROMPT).toBe("0");
    } finally {
      if (previous === undefined) delete process.env.GIT_DIR;
      else process.env.GIT_DIR = previous;
    }
  });

  test("approved recorder derives exact Git context, workflow digest, duration, and SUCCESS", () => {
    const { repoPath, workflow } = createApprovedWorkflowRepo();
    const invocations = [];
    const record = recordApprovedValidationEvidence({
      repoPath,
      workflowId: workflow.id,
      now: () => new Date(NOW),
      monotonicNow: (() => {
        const values = [500, 975];
        return () => values.shift();
      })(),
      spawn: trustedGitSpawn(),
      commandRunner(command, args, options) {
        invocations.push({ command, args, options });
        return { status: 0 };
      },
    });

    expect(record).toMatchObject({
      headSha: HEAD_SHA,
      baseSha: BASE_SHA,
      workflowDigest: computeApprovedWorkflowDigest({
        repoPath,
        workflowId: workflow.id,
      }),
      result: "SUCCESS",
      complete: true,
      durationMs: 475,
    });
    expect(invocations).toHaveLength(workflow.steps.length);
    expect(invocations.every(({ command }) => command === "node")).toBe(true);
    expect(invocations.every(({ options }) => options.shell === false)).toBe(true);
    expect(JSON.stringify(record)).not.toMatch(/command|environment|output|token|secret/iu);
  });

  test("workflow digest changes when a fixed workflow definition file changes", () => {
    const { repoPath, workflow } = createApprovedWorkflowRepo();
    const first = computeApprovedWorkflowDigest({ repoPath, workflowId: workflow.id });
    writeFileSync(path.join(repoPath, workflow.digestFiles[0]), "changed\n");
    const second = computeApprovedWorkflowDigest({ repoPath, workflowId: workflow.id });

    expect(first).toMatch(/^[a-f0-9]{64}$/u);
    expect(second).toMatch(/^[a-f0-9]{64}$/u);
    expect(second).not.toBe(first);
  });

  test("records non-reusable incomplete evidence if Git context changes during validation", () => {
    const { repoPath, workflow } = createApprovedWorkflowRepo();
    let changed = false;
    const record = recordApprovedValidationEvidence({
      repoPath,
      workflowId: workflow.id,
      now: () => new Date(NOW),
      monotonicNow: (() => {
        const values = [10, 20];
        return () => values.shift();
      })(),
      spawn(command, args, options) {
        return trustedGitSpawn({
          headSha: changed ? "4".repeat(40) : HEAD_SHA,
        })(command, args, options);
      },
      commandRunner() {
        changed = true;
        return { status: 0 };
      },
    });

    expect(record).toMatchObject({
      headSha: HEAD_SHA,
      result: "FAILED",
      complete: false,
    });
    expect(
      evaluateValidationEvidence(record, {
        headSha: HEAD_SHA,
        baseSha: BASE_SHA,
        workflowDigest: record.workflowDigest,
      }),
    ).toEqual({ reusable: false, code: "INCOMPLETE" });
  });

  test("public recorder rejects dirty state and caller-supplied result or SHA fields", () => {
    const { repoPath, workflow } = createApprovedWorkflowRepo();
    expect(() =>
      recordApprovedValidationEvidence({
        repoPath,
        workflowId: workflow.id,
        spawn: trustedGitSpawn({ dirty: true }),
        commandRunner: () => ({ status: 0 }),
      }),
    ).toThrowError("VALIDATION_WORKTREE_DIRTY");
    expect(() =>
      recordApprovedValidationEvidence({
        repoPath,
        workflowId: workflow.id,
        result: "SUCCESS",
        headSha: HEAD_SHA,
        workflowDigest: WORKFLOW_DIGEST,
        spawn: trustedGitSpawn(),
        commandRunner: () => ({ status: 0 }),
      }),
    ).toThrowError("VALIDATION_RECORDER_INPUT_INVALID");
  });

  test("approved recorder derives FAILED from the command exit code and never reuses it", () => {
    const { repoPath, workflow } = createApprovedWorkflowRepo();
    const record = recordApprovedValidationEvidence({
      repoPath,
      workflowId: workflow.id,
      now: () => new Date(NOW),
      monotonicNow: (() => {
        const values = [100, 155];
        return () => values.shift();
      })(),
      spawn: trustedGitSpawn(),
      commandRunner: () => ({ status: 1 }),
    });
    expect(record.result).toBe("FAILED");
    expect(record.complete).toBe(false);
    expect(
      checkValidationEvidence({
        gitCommonDir: path.join(repoPath, ".git"),
        headSha: HEAD_SHA,
        baseSha: BASE_SHA,
        workflowDigest: computeApprovedWorkflowDigest({
          repoPath,
          workflowId: workflow.id,
        }),
      }),
    ).toEqual({ reusable: false, code: "INCOMPLETE" });
  });

  test("CLI record, check, and status derive context and emit only safe summaries", () => {
    const { repoPath, workflow } = createApprovedWorkflowRepo();
    const spawn = trustedGitSpawn();
    const lines = [];
    const dependencies = {
      spawn,
      now: () => new Date(NOW),
      monotonicNow: (() => {
        const values = [100, 1000];
        return () => values.shift();
      })(),
      commandRunner: () => ({ status: 0 }),
      stdout: (line) => lines.push(JSON.parse(line)),
      stderr: () => {},
    };

    expect(
      runValidationEvidenceCli(
        [
          "record",
          "--repo",
          repoPath,
          "--workflow",
          workflow.id,
        ],
        dependencies,
      ),
    ).toBe(0);
    expect(
      runValidationEvidenceCli(
        [
          "check",
          "--repo",
          repoPath,
          "--workflow",
          workflow.id,
        ],
        dependencies,
      ),
    ).toBe(0);
    expect(
      runValidationEvidenceCli(["status", "--repo", repoPath], dependencies),
    ).toBe(0);
    expect(lines.map((entry) => entry.action)).toEqual(["record", "check", "status"]);
    expect(JSON.stringify(lines)).not.toMatch(/command|environment|output|token|secret/iu);
  });

  test("CLI record exits non-zero when the approved workflow fails", () => {
    const { repoPath, workflow } = createApprovedWorkflowRepo();
    const lines = [];
    const exitCode = runValidationEvidenceCli(
      [
        "record",
        "--repo",
        repoPath,
        "--workflow",
        workflow.id,
      ],
      {
        spawn: trustedGitSpawn(),
        now: () => new Date(NOW),
        monotonicNow: (() => {
          const values = [100, 200];
          return () => values.shift();
        })(),
        commandRunner: () => ({ status: 1 }),
        stdout: (line) => lines.push(JSON.parse(line)),
        stderr: () => {},
      },
    );

    expect(exitCode).toBe(2);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      action: "record",
      result: "FAILED",
      complete: false,
    });
  });

  test("CLI rejects caller-supplied result, SHA, digest, duration, and unknown arguments", () => {
    const stderr = [];
    const dependencies = {
      stdout: () => {},
      stderr: (line) => stderr.push(line),
    };
    expect(
      runValidationEvidenceCli(
        [
          "record",
          "--repo",
          tempRoot(),
          "--head",
          HEAD_SHA,
          "--base",
          BASE_SHA,
          "--workflow",
          "pipeline-v3.1-black-pr-full",
          "--result",
          "SUCCESS",
        ],
        dependencies,
      ),
    ).toBe(1);
    expect(runValidationEvidenceCli(["status", "--repo", tempRoot(), "--output", "x"], dependencies))
      .toBe(1);
    expect(
      runValidationEvidenceCli(
        [
          "record",
          "--repo",
          tempRoot(),
          "--workflow",
          "pipeline-v3.1-black-pr-full",
          "--head",
          HEAD_SHA,
        ],
        dependencies,
      ),
    ).toBe(1);
    expect(stderr.every((line) => !line.includes("x"))).toBe(true);
  });
});

test("storage key is an exact digest of the head, base, and workflow tuple", () => {
  const gitCommonDir = createBareGitCommonDir();
  const record = createValidationEvidenceV1(input());
  const expectedKey = digest(
    JSON.stringify({
      baseSha: BASE_SHA,
      headSha: HEAD_SHA,
      workflowDigest: WORKFLOW_DIGEST,
    }),
  );
  expect(path.basename(validationEvidenceStoragePath(gitCommonDir, record))).toBe(
    `${expectedKey}.json`,
  );
});

test("exports a stable typed error without leaking rejected values", () => {
  try {
    createValidationEvidenceV1(input({ result: "not-a-secret-but-invalid" }));
    throw new Error("expected failure");
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationEvidenceError);
    expect(error.message).toBe("VALIDATION_EVIDENCE_INVALID");
    expect(error.message).not.toContain("not-a-secret-but-invalid");
  }
});
