import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  PIPELINE_REPOSITORY_PROFILES,
  acquireTaskSweepLease,
  runTaskSweep,
  withRepositoryAuth,
} from "../../scripts/lib/ai-task-sweep.mjs";

const tempRoots = [];

function makeRoot(prefix = "talkpik-task-sweep-") {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function commandRecorder(next = () => ({
  stdout: "",
  stderr: "",
  exitCode: 0,
})) {
  const calls = [];
  return {
    calls,
    async runCommand(command, args, options) {
      calls.push({ command, args, options });
      return next({ command, args, options });
    },
  };
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("repository authentication for one-shot task sweep", () => {
  it("uses the fixed repository-to-account profiles", () => {
    expect(PIPELINE_REPOSITORY_PROFILES).toEqual({
      origin: {
        authLogin: "blackstarzck",
        owner: "blackstarzck",
        repository: "topik-project-v13",
      },
      collab: {
        authLogin: "guestkeduall-design",
        owner: "keduall",
        repository: "topik-project-v13",
      },
    });
  });

  it("switches, verifies push permission, runs once, and restores the original account", async () => {
    const root = makeRoot();
    const outputs = [
      { stdout: "blackstarzck\n", stderr: "", exitCode: 0 },
      { stdout: "", stderr: "", exitCode: 0 },
      { stdout: "guestkeduall-design\n", stderr: "", exitCode: 0 },
      { stdout: "true\n", stderr: "", exitCode: 0 },
      { stdout: "", stderr: "", exitCode: 0 },
      { stdout: "blackstarzck\n", stderr: "", exitCode: 0 },
    ];
    const recorder = commandRecorder(() => outputs.shift());

    const result = await withRepositoryAuth({
      profile: PIPELINE_REPOSITORY_PROFILES.collab,
      localAppData: root,
      runCommand: recorder.runCommand,
      operation: async () => "done",
    });

    expect(result).toEqual({ result: "AUTHENTICATED", value: "done" });
    expect(recorder.calls.map((call) => call.args)).toEqual([
      ["api", "user", "--jq", ".login"],
      [
        "auth",
        "switch",
        "--hostname",
        "github.com",
        "--user",
        "guestkeduall-design",
      ],
      ["api", "user", "--jq", ".login"],
      ["api", "repos/keduall/topik-project-v13", "--jq", ".permissions.push"],
      [
        "auth",
        "switch",
        "--hostname",
        "github.com",
        "--user",
        "blackstarzck",
      ],
      ["api", "user", "--jq", ".login"],
    ]);
    for (const call of recorder.calls) {
      expect(call.options.shell).toBe(false);
      expect(call.options.timeout).toBeGreaterThan(0);
      expect(call.args.join(" ")).not.toMatch(/auth\s+token/iu);
    }
  });

  it.each([
    {
      outputs: [
        {
          stdout: "secret-looking-output",
          stderr: "credential-helper-secret",
          exitCode: 1,
        },
      ],
      blocker: "AUTH_UNAVAILABLE",
    },
    {
      outputs: [
        { stdout: "blackstarzck\n", stderr: "", exitCode: 0 },
        { stdout: "blackstarzck\n", stderr: "", exitCode: 0 },
        { stdout: "false\n", stderr: "", exitCode: 0 },
      ],
      blocker: "AUTH_PERMISSION_DENIED",
    },
  ])("preserves without exposing auth output: $blocker", async ({
    outputs,
    blocker,
  }) => {
    const root = makeRoot();
    const recorder = commandRecorder(() => outputs.shift());
    let operationCalls = 0;

    const result = await withRepositoryAuth({
      profile: PIPELINE_REPOSITORY_PROFILES.origin,
      localAppData: root,
      runCommand: recorder.runCommand,
      operation: async () => {
        operationCalls += 1;
      },
    });

    expect(result).toMatchObject({ result: "PRESERVED", blocker });
    expect(operationCalls).toBe(0);
    expect(JSON.stringify(result)).not.toMatch(
      /secret-looking-output|credential-helper-secret/u,
    );
  });

  it("uses one host-wide github.com auth lock", async () => {
    const root = makeRoot();
    const outputs = [
      { stdout: "blackstarzck\n", stderr: "", exitCode: 0 },
      { stdout: "", stderr: "", exitCode: 0 },
      { stdout: "guestkeduall-design\n", stderr: "", exitCode: 0 },
      { stdout: "true\n", stderr: "", exitCode: 0 },
      { stdout: "", stderr: "", exitCode: 0 },
      { stdout: "blackstarzck\n", stderr: "", exitCode: 0 },
    ];
    const firstRecorder = commandRecorder(() => outputs.shift());
    const secondRecorder = commandRecorder();
    let releaseOperation;
    let signalStarted;
    const operationStarted = new Promise((resolve) => {
      signalStarted = resolve;
    });
    const operationGate = new Promise((resolve) => {
      releaseOperation = resolve;
    });

    const first = withRepositoryAuth({
      profile: PIPELINE_REPOSITORY_PROFILES.collab,
      localAppData: root,
      runCommand: firstRecorder.runCommand,
      operation: async () => {
        signalStarted();
        await operationGate;
        return "done";
      },
    });
    await operationStarted;
    const second = await withRepositoryAuth({
      profile: PIPELINE_REPOSITORY_PROFILES.origin,
      localAppData: root,
      runCommand: secondRecorder.runCommand,
      operation: async () => "must-not-run",
    });

    expect(second).toMatchObject({
      result: "PRESERVED",
      blocker: "AUTH_LOCKED",
    });
    expect(secondRecorder.calls).toHaveLength(0);
    releaseOperation();
    await expect(first).resolves.toEqual({
      result: "AUTHENTICATED",
      value: "done",
    });
  });
});

describe("one-shot task sweep lease and budget", () => {
  it("rejects a duplicate live worker and reclaims a stale dead lock", () => {
    const root = makeRoot();
    const lockPath = path.join(root, "sweep.lock");
    const first = acquireTaskSweepLease({
      lockPath,
      nowMs: 1_000,
      pid: 100,
      isPidAlive: () => true,
    });

    expect(
      acquireTaskSweepLease({
        lockPath,
        nowMs: 2_000,
        pid: 200,
        isPidAlive: () => true,
      }),
    ).toEqual({ acquired: false, blocker: "DUPLICATE_SWEEP" });
    first.release();

    writeFileSync(
      lockPath,
      `${JSON.stringify({
        schemaVersion: "TaskSweepLeaseV1",
        pid: 100,
        acquiredAtMs: 1_000,
        nonce: "11111111-1111-4111-8111-111111111111",
      })}\n`,
    );
    const reclaimed = acquireTaskSweepLease({
      lockPath,
      nowMs: 1_000 + 16 * 60_000,
      pid: 200,
      staleAfterMs: 15 * 60_000,
      isPidAlive: () => false,
    });
    expect(reclaimed.acquired).toBe(true);
    reclaimed.release();
  });

  it("rejects a lock path that traverses a symlink or junction", () => {
    const root = makeRoot();
    const target = path.join(root, "target");
    const linked = path.join(root, "linked");
    writeFileSync(target, "not-a-directory");
    symlinkSync(target, linked, "file");

    expect(() =>
      acquireTaskSweepLease({
        lockPath: path.join(linked, "sweep.lock"),
      }),
    ).toThrow(/symbolic link|reparse/iu);
  });

  it("makes no auth or network call when no managed task is active", async () => {
    const root = makeRoot();
    let authCalls = 0;
    let processCalls = 0;
    const result = await runTaskSweep({
      lockPath: path.join(root, "sweep.lock"),
      repositories: [{ remote: "origin", root }],
      listActiveManagedTasks: async () => [],
      withAuth: async () => {
        authCalls += 1;
      },
      processTask: async () => {
        processCalls += 1;
      },
    });

    expect(result).toMatchObject({
      result: "NO_ACTIVE_TASKS",
      examined: 0,
      attempted: 0,
    });
    expect(authCalls).toBe(0);
    expect(processCalls).toBe(0);
  });

  it("processes at most ten managed tasks sequentially", async () => {
    const root = makeRoot();
    const tasks = Array.from({ length: 12 }, (_, index) => ({
      taskId: `task-${index}`,
      ownership: "managed",
    }));
    let inFlight = 0;
    let maxInFlight = 0;
    const processed = [];

    const result = await runTaskSweep({
      lockPath: path.join(root, "sweep.lock"),
      repositories: [{ remote: "origin", root }],
      listActiveManagedTasks: async () => tasks,
      withAuth: async ({ operation }) => operation(),
      processTask: async ({ task }) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        processed.push(task.taskId);
        inFlight -= 1;
      },
    });

    expect(result).toMatchObject({
      result: "COMPLETED",
      examined: 12,
      attempted: 10,
      deferred: 2,
    });
    expect(processed).toHaveLength(10);
    expect(maxInFlight).toBe(1);
  });

  it("keeps its lease until an uncooperative timed-out operation settles", async () => {
    const root = makeRoot();
    const lockPath = path.join(root, "sweep.lock");
    let settleDiscovery;
    const discoveryGate = new Promise((resolve) => {
      settleDiscovery = resolve;
    });

    const first = await runTaskSweep({
      lockPath,
      repositories: [{ remote: "origin", root }],
      listActiveManagedTasks: async () => discoveryGate,
      withAuth: async () => {
        throw new Error("must not run");
      },
      processTask: async () => {
        throw new Error("must not run");
      },
      setTimeoutFn: (callback) => {
        queueMicrotask(callback);
        return 1;
      },
      clearTimeoutFn: () => {},
    });

    expect(first).toMatchObject({
      result: "PRESERVED",
      blocker: "OPERATION_TERMINATION_PENDING",
      leaseHeld: true,
    });
    expect(existsSync(lockPath)).toBe(true);
    const second = await runTaskSweep({
      lockPath,
      repositories: [],
      listActiveManagedTasks: async () => [],
      withAuth: async () => {},
      processTask: async () => {},
    });
    expect(second).toEqual({
      result: "PRESERVED",
      blocker: "DUPLICATE_SWEEP",
    });

    settleDiscovery([]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(existsSync(lockPath)).toBe(false);
    expect(() => JSON.parse(readFileSync(lockPath, "utf8"))).toThrow();
  });
});
