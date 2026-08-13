import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  ADAPTER_PROFILE_IDENTITIES,
  adapterIdentity,
  autoCleanupTaskV3Adapter,
  runRepositorySweepV3,
  sweepTasksV3Adapter,
} from "../../scripts/lib/ai-task-v3-adapter.mjs";
import { parseRepositoryIdentity } from "../../scripts/lib/ai-task-lifecycle-v3.mjs";
import {
  copyV2SweepCandidates,
  runTaskLifecycleCommand,
} from "../../scripts/ai-task.mjs";

const NOW = "2026-07-23T09:00:00.000Z";
const HEAD = "1".repeat(40);
const MAIN = "2".repeat(40);
const STG = "3".repeat(40);

function record(overrides = {}) {
  return {
    taskId: "task-adapter",
    branch: { name: "feat/adapter", type: "feat", slug: "adapter" },
    headSha: HEAD,
    repoProfile: {
      remote: "origin",
      repositoryIdentity: "github.com/blackstarzck/topik-project-v13",
      authLogin: "blackstarzck",
    },
    workspace: { kind: "shared-slot", ownership: "managed" },
    state: "MERGED",
    updatedAt: NOW,
    ...overrides,
  };
}

function commandResult(stdout = "", exitCode = 0) {
  return { stdout, stderr: "", exitCode };
}

function originHarness({
  task = record(),
  prHead = HEAD,
  remoteSha = HEAD,
  login = "blackstarzck",
  pushStatus = 0,
} = {}) {
  const calls = [];
  let remoteExists = remoteSha !== null;
  const runCommand = vi.fn(async (file, args, options) => {
    calls.push({ file, args, options });
    if (file !== "gh") throw new Error("unexpected async command");
    if (args.join(" ") === "api user --jq .login") return commandResult(login);
    if (args[0] === "api" && args[1] === "repos/blackstarzck/topik-project-v13") {
      return commandResult("true");
    }
    if (args[0] === "pr" && args[1] === "list") {
      // 실제 gh 는 --head 에 "<owner>:<branch>" 형식을 지원하지 않는다(`gh pr list --help`).
      // 그 형식을 넘기면 조용히 빈 목록을 준다. 스텁도 같게 동작해야 조회 인자 결함이 드러난다.
      const head = args[args.indexOf("--head") + 1];
      if (head !== task.branch.name) return commandResult("[]");
      return commandResult(JSON.stringify([{
        baseRefName: "main",
        headRefName: task.branch.name,
        headRefOid: prHead,
        headRepository: {
          name: "topik-project-v13",
          nameWithOwner: "blackstarzck/topik-project-v13",
        },
        mergedAt: NOW,
        mergeCommit: { oid: MAIN },
      }]));
    }
    throw new Error(`unexpected gh command: ${args.join(" ")}`);
  });
  const gitRunner = vi.fn((_cwd, args) => {
    calls.push({ file: "git", args });
    const command = args.join(" ");
    if (command === "remote get-url origin") {
      return { status: 0, stdout: "git@github.com:blackstarzck/topik-project-v13.git" };
    }
    if (command === "rev-parse --git-common-dir") {
      return { status: 0, stdout: path.resolve("C:/repo/.git") };
    }
    if (command.startsWith("fetch --prune origin ")) return { status: 0, stdout: "" };
    if (command === "rev-parse --verify origin/main^{commit}") {
      return { status: 0, stdout: MAIN };
    }
    if (command.startsWith("merge-base --is-ancestor ")) return { status: 0, stdout: "" };
    if (command === `ls-remote --heads origin refs/heads/${task.branch.name}`) {
      return {
        status: 0,
        stdout: remoteExists ? `${remoteSha}\trefs/heads/${task.branch.name}` : "",
      };
    }
    if (command.startsWith("push --force-with-lease=")) {
      if (pushStatus === 0) remoteExists = false;
      return { status: pushStatus, stdout: "" };
    }
    return { status: 1, stdout: "" };
  });
  return { calls, runCommand, gitRunner };
}

describe("V3 production autocleanup adapter", () => {
  it("resolves an exact origin/main merged PR and deletes a matching remote ref with a SHA lease", async () => {
    const task = record();
    const harness = originHarness({ task });
    const captured = [];

    const result = await autoCleanupTaskV3Adapter({
      repoPath: "C:/repo",
      branch: task.branch.name,
      now: NOW,
      readRecord: () => task,
      runCommand: harness.runCommand,
      gitRunner: harness.gitRunner,
      localAppData: "C:/Users/test/AppData/Local",
      withAuth: async ({ operation, localAppData }) => {
        expect(localAppData).toBe("C:/Users/test/AppData/Local");
        return {
          result: "AUTHENTICATED",
          value: await operation({}),
        };
      },
      cleanupRecord: (input) => {
        captured.push(input.mergeEvidence);
        expect(input.deleteRemoteBranch({
          branch: task.branch.name,
          expectedSha: HEAD,
        })).toEqual({ deleted: true });
        expect(input.verifyRemoteBranchAbsent({
          branch: task.branch.name,
        })).toBe(true);
        return { result: "CLEANED", blocker: null };
      },
    });

    expect(result).toEqual({ result: "CLEANED", blocker: null });
    expect(captured).toEqual([expect.objectContaining({
      source: "github-pr",
      authLogin: "blackstarzck",
      repositoryIdentity: "github.com/blackstarzck/topik-project-v13",
      headSha: HEAD,
      mainSha: MAIN,
      remoteBranch: { exists: true, sha: HEAD },
      production: null,
    })]);
    const deletion = harness.calls.find((call) => call.file === "git" && call.args[0] === "push");
    expect(deletion.args).toContain(
      `--force-with-lease=refs/heads/${task.branch.name}:${HEAD}`,
    );
    const ghCall = harness.calls.find((call) => call.file === "gh");
    expect(ghCall.options).toMatchObject({
      shell: false,
      env: expect.objectContaining({
        GH_PROMPT_DISABLED: "1",
        GIT_TERMINAL_PROMPT: "0",
      }),
    });
    expect(ghCall.options.env).not.toHaveProperty("GIT_DIR");
  });

  it("accepts a merged PR whose head branch lives in this repository and refuses an identical fork PR", async () => {
    // --head 는 브랜치 이름만 받으므로 fork 의 동명 브랜치도 목록에 들어온다. 삭제 판단의
    // 근거이므로 head 저장소가 이 저장소인지 확인해야 한다.
    const forkHarness = (headRepositoryNameWithOwner) => {
      const task = record();
      let remoteExists = true;
      const runCommand = vi.fn(async (file, args) => {
        if (file !== "gh") throw new Error("unexpected async command");
        if (args.join(" ") === "api user --jq .login") return commandResult("blackstarzck");
        if (args[0] === "api" && args[1] === "repos/blackstarzck/topik-project-v13") {
          return commandResult("true");
        }
        if (args[0] === "pr" && args[1] === "list") {
          const head = args[args.indexOf("--head") + 1];
          if (head !== task.branch.name) return commandResult("[]");
          return commandResult(JSON.stringify([{
            baseRefName: "main",
            headRefName: task.branch.name,
            headRefOid: HEAD,
            mergedAt: NOW,
            mergeCommit: { oid: MAIN },
            headRepository: {
              name: "topik-project-v13",
              nameWithOwner: headRepositoryNameWithOwner,
            },
          }]));
        }
        throw new Error(`unexpected gh command: ${args.join(" ")}`);
      });
      const gitRunner = vi.fn((_cwd, args) => {
        const command = args.join(" ");
        if (command === "remote get-url origin") {
          return { status: 0, stdout: "git@github.com:blackstarzck/topik-project-v13.git" };
        }
        if (command === "rev-parse --git-common-dir") {
          return { status: 0, stdout: path.resolve("C:/repo/.git") };
        }
        if (command.startsWith("fetch --prune origin ")) return { status: 0, stdout: "" };
        if (command === "rev-parse --verify origin/main^{commit}") {
          return { status: 0, stdout: MAIN };
        }
        if (command.startsWith("merge-base --is-ancestor ")) return { status: 0, stdout: "" };
        if (command === `ls-remote --heads origin refs/heads/${task.branch.name}`) {
          return {
            status: 0,
            stdout: remoteExists ? `${HEAD}\trefs/heads/${task.branch.name}` : "",
          };
        }
        if (command.startsWith("push --force-with-lease=")) {
          remoteExists = false;
          return { status: 0, stdout: "" };
        }
        return { status: 1, stdout: "" };
      });
      return { task, runCommand, gitRunner };
    };

    const run = async (nameWithOwner) => {
      const harness = forkHarness(nameWithOwner);
      return autoCleanupTaskV3Adapter({
        repoPath: "C:/repo",
        branch: harness.task.branch.name,
        now: NOW,
        readRecord: () => harness.task,
        runCommand: harness.runCommand,
        gitRunner: harness.gitRunner,
        withAuth: async ({ operation }) => ({
          result: "AUTHENTICATED",
          value: await operation({}),
        }),
        cleanupRecord: () => ({ result: "CLEANED", blocker: null }),
      });
    };

    expect(await run("blackstarzck/topik-project-v13"))
      .toEqual({ result: "CLEANED", blocker: null });
    expect(await run("attacker/topik-project-v13"))
      .toMatchObject({ result: "PRESERVED", blocker: "MERGED_MAIN_PR_NOT_FOUND" });
  });

  it("uses a released PromotionRun as mandatory production evidence for collab/main", async () => {
    const task = record({
      repoProfile: {
        remote: "origin",
        repositoryIdentity: "github.com/keduall/topik-project-v13",
        authLogin: "guestkeduall-design",
      },
    });
    const captured = [];
    const runCommand = vi.fn(async (_file, args) => {
      if (args.join(" ") === "api user --jq .login") {
        return commandResult("guestkeduall-design");
      }
      if (args[0] === "api" && args[1] === "repos/keduall/topik-project-v13") {
        return commandResult("true");
      }
      if (args[0] === "pr") {
        return commandResult(JSON.stringify([{
          baseRefName: "main",
          headRefName: "stg",
          headRefOid: STG,
          headRepository: {
            name: "topik-project-v13",
            nameWithOwner: "keduall/topik-project-v13",
          },
          mergedAt: NOW,
          mergeCommit: { oid: MAIN },
        }]));
      }
      throw new Error(`unexpected command: ${args.join(" ")}`);
    });
    const gitRunner = vi.fn((_cwd, args) => {
      const command = args.join(" ");
      if (command === "remote get-url collab") {
        return { status: 0, stdout: "https://github.com/keduall/topik-project-v13.git" };
      }
      if (command === "rev-parse --git-common-dir") {
        return { status: 0, stdout: path.resolve("C:/repo/.git") };
      }
      if (command.startsWith("fetch --prune collab ")) return { status: 0, stdout: "" };
      if (command === "rev-parse --verify collab/main^{commit}") {
        return { status: 0, stdout: MAIN };
      }
      if (command.startsWith("merge-base --is-ancestor ")) return { status: 0, stdout: "" };
      if (command === `ls-remote --heads collab refs/heads/${task.branch.name}`) {
        return { status: 0, stdout: "" };
      }
      return { status: 1, stdout: "" };
    });

    const result = await autoCleanupTaskV3Adapter({
      repoPath: "C:/repo",
      branch: task.branch.name,
      now: NOW,
      readRecord: () => task,
      runCommand,
      gitRunner,
      withAuth: async ({ operation }) => ({
        result: "AUTHENTICATED",
        value: await operation({}),
      }),
      findPromotionEvidence: () => ({
        candidateSha: HEAD,
        stgSha: STG,
        mainSha: MAIN,
        mergedAt: NOW,
        productionReady: true,
      }),
      cleanupRecord: (input) => {
        captured.push(input.mergeEvidence);
        return { result: "RELEASED", blocker: null };
      },
    });

    expect(result.result).toBe("RELEASED");
    expect(captured[0]).toMatchObject({
      source: "promotion",
      mainSha: MAIN,
      headSha: HEAD,
      production: { ready: true, commitSha: MAIN },
    });
  });

  it("fails closed for an unapproved repository profile before authentication or network", async () => {
    const runCommand = vi.fn();
    const result = await autoCleanupTaskV3Adapter({
      repoPath: "C:/repo",
      branch: "feat/adapter",
      now: NOW,
      readRecord: () => record({
        repoProfile: {
          remote: "origin",
          repositoryIdentity: "github.com/other/repository",
          authLogin: "attacker",
        },
      }),
      runCommand,
      gitRunner: vi.fn(),
    });

    expect(result).toMatchObject({
      result: "PRESERVED",
      blocker: "REPOSITORY_PROFILE_UNAPPROVED",
    });
    expect(runCommand).not.toHaveBeenCalled();
  });

  it("does not fall back to V2 when the V3 registry cannot be safely read", async () => {
    const runCommand = vi.fn();
    const result = await autoCleanupTaskV3Adapter({
      repoPath: "C:/repo",
      branch: "feat/adapter",
      now: NOW,
      readRecord: () => {
        throw new Error("corrupt v3 registry");
      },
      runCommand,
      gitRunner: vi.fn(),
    });
    expect(result).toMatchObject({
      result: "PRESERVED",
      blocker: "V3_REGISTRY_UNAVAILABLE",
    });
    expect(result).not.toHaveProperty("handled", false);
    expect(runCommand).not.toHaveBeenCalled();
  });

  it("preserves wrong account, stale PR SHA, and a remotely moved branch", async () => {
    const wrongAccount = originHarness({ login: "someone-else" });
    const wrong = await autoCleanupTaskV3Adapter({
      repoPath: "C:/repo",
      branch: "feat/adapter",
      now: NOW,
      readRecord: () => record(),
      runCommand: wrongAccount.runCommand,
      gitRunner: wrongAccount.gitRunner,
      withAuth: async () => ({
        result: "PRESERVED",
        blocker: "AUTH_UNAVAILABLE",
      }),
    });
    expect(wrong).toMatchObject({ result: "PRESERVED", blocker: "AUTH_UNAVAILABLE" });

    const stale = originHarness({ prHead: "9".repeat(40) });
    const staleResult = await autoCleanupTaskV3Adapter({
      repoPath: "C:/repo",
      branch: "feat/adapter",
      now: NOW,
      readRecord: () => record(),
      runCommand: stale.runCommand,
      gitRunner: stale.gitRunner,
      withAuth: async ({ operation }) => ({
        result: "AUTHENTICATED",
        value: await operation({}),
      }),
    });
    expect(staleResult).toMatchObject({
      result: "PRESERVED",
      blocker: "MERGED_MAIN_PR_NOT_FOUND",
    });

    const moved = originHarness({ remoteSha: HEAD, pushStatus: 1 });
    const movedResult = await autoCleanupTaskV3Adapter({
      repoPath: "C:/repo",
      branch: "feat/adapter",
      now: NOW,
      readRecord: () => record(),
      runCommand: moved.runCommand,
      gitRunner: moved.gitRunner,
      withAuth: async ({ operation }) => ({
        result: "AUTHENTICATED",
        value: await operation({}),
      }),
      cleanupRecord: ({ deleteRemoteBranch }) => {
        const deletion = deleteRemoteBranch({
          branch: "feat/adapter",
          expectedSha: HEAD,
        });
        return deletion.deleted
          ? { result: "CLEANED", blocker: null }
          : { result: "PRESERVED", blocker: "REMOTE_DELETE_NOT_CONFIRMED" };
      },
    });
    expect(movedResult).toMatchObject({
      result: "PRESERVED",
      blocker: "REMOTE_DELETE_NOT_CONFIRMED",
    });
  });

  it("delegates isolated tasks to V2 and requires the V2 registry to confirm CLEANED", async () => {
    const task = record({
      workspace: { kind: "isolated", ownership: "managed" },
    });
    const harness = originHarness({ task, remoteSha: null });
    const v2AutoCleanup = vi.fn(async () => ({ status: "CLEANED" }));
    const reconciled = { state: "CLEANED", taskId: task.taskId };
    const reconcileIsolated = vi.fn(() => reconciled);

    const result = await autoCleanupTaskV3Adapter({
      repoPath: "C:/repo",
      branch: task.branch.name,
      now: NOW,
      readRecord: () => task,
      runCommand: harness.runCommand,
      gitRunner: harness.gitRunner,
      withAuth: async ({ operation }) => ({
        result: "AUTHENTICATED",
        value: await operation({}),
      }),
      v2AutoCleanup,
      reconcileIsolated,
    });

    expect(v2AutoCleanup).toHaveBeenCalledWith(expect.objectContaining({
      repoPath: "C:/repo",
      branch: task.branch.name,
    }));
    expect(reconcileIsolated).toHaveBeenCalledWith(expect.objectContaining({
      v2Result: { status: "CLEANED" },
    }));
    expect(result).toMatchObject({
      result: "CLEANED",
      v3Task: reconciled,
    });
  });

  it("surfaces the V2 blockers so the report names the real reason", async () => {
    const task = record({ workspace: { kind: "isolated", ownership: "managed" } });
    const harness = originHarness({ task, remoteSha: null });
    const v2AutoCleanup = vi.fn(async () => ({
      result: "PRESERVED",
      blockers: ["RUNTIME_REGISTRATION_REQUIRED"],
    }));
    const reconcileIsolated = vi.fn(() => ({
      state: "PRESERVED",
      taskId: task.taskId,
      blockers: ["V2_CLEANUP_NOT_CONFIRMED", "RUNTIME_REGISTRATION_REQUIRED"],
    }));

    const result = await autoCleanupTaskV3Adapter({
      repoPath: "C:/repo",
      branch: task.branch.name,
      now: NOW,
      readRecord: () => task,
      runCommand: harness.runCommand,
      gitRunner: harness.gitRunner,
      withAuth: async ({ operation }) => ({
        result: "AUTHENTICATED",
        value: await operation({}),
      }),
      v2AutoCleanup,
      reconcileIsolated,
    });

    // 단일 blocker 계약은 유지하고, 실제 이유는 배열로 함께 보고한다.
    expect(result).toMatchObject({
      result: "PRESERVED",
      blocker: "V2_CLEANUP_NOT_CONFIRMED",
      blockers: ["V2_CLEANUP_NOT_CONFIRMED", "RUNTIME_REGISTRATION_REQUIRED"],
    });
  });

  it("reports the fresh V2 reason even when the record is already terminal", async () => {
    // PRESERVED 는 종단 상태라 reconcileDelegatedCleanupV3 가 조기 반환하고 blocker 를
    // 다시 계산하지 않는다. 이미 막힌 record 를 재시도할 때도 운영자가 현재 이유를 봐야 한다.
    const task = record({ workspace: { kind: "isolated", ownership: "managed" } });
    const harness = originHarness({ task, remoteSha: null });
    const v2AutoCleanup = vi.fn(async () => ({
      result: "PRESERVED",
      blockers: ["RUNTIME_REGISTRATION_REQUIRED"],
    }));
    const reconcileIsolated = vi.fn(() => ({
      state: "PRESERVED",
      taskId: task.taskId,
      blockers: ["V2_CLEANUP_NOT_CONFIRMED"],
    }));

    const result = await autoCleanupTaskV3Adapter({
      repoPath: "C:/repo",
      branch: task.branch.name,
      now: NOW,
      readRecord: () => task,
      runCommand: harness.runCommand,
      gitRunner: harness.gitRunner,
      withAuth: async ({ operation }) => ({
        result: "AUTHENTICATED",
        value: await operation({}),
      }),
      v2AutoCleanup,
      reconcileIsolated,
    });

    expect(result.blockers).toContain("RUNTIME_REGISTRATION_REQUIRED");
    expect(result.blocker).toBe("V2_CLEANUP_NOT_CONFIRMED");
  });

  it("caps the reported blockers at the record limit without dropping the fresh V2 reason", async () => {
    // record blocker 는 최대 32개다. 여기에 V2 이유를 그냥 이어붙이면 상한을 넘고,
    // 뒤에서 자르면 정작 필요한 최신 이유가 사라진다.
    const task = record({ workspace: { kind: "isolated", ownership: "managed" } });
    const harness = originHarness({ task, remoteSha: null });
    const staleBlockers = Array.from({ length: 32 }, (_, index) => `STALE_${index}`);
    const v2AutoCleanup = vi.fn(async () => ({
      result: "PRESERVED",
      blockers: ["RUNTIME_REGISTRATION_REQUIRED"],
    }));
    const reconcileIsolated = vi.fn(() => ({
      state: "PRESERVED",
      taskId: task.taskId,
      blockers: staleBlockers,
    }));

    const result = await autoCleanupTaskV3Adapter({
      repoPath: "C:/repo",
      branch: task.branch.name,
      now: NOW,
      readRecord: () => task,
      runCommand: harness.runCommand,
      gitRunner: harness.gitRunner,
      withAuth: async ({ operation }) => ({
        result: "AUTHENTICATED",
        value: await operation({}),
      }),
      v2AutoCleanup,
      reconcileIsolated,
    });

    expect(result.blockers.length).toBeLessThanOrEqual(32);
    expect(result.blockers).toContain("RUNTIME_REGISTRATION_REQUIRED");
    expect(result.blocker).toBe("V2_CLEANUP_NOT_CONFIRMED");
    expect(new Set(result.blockers).size).toBe(result.blockers.length);
  });

  it("keeps a thrown V2 failure visible instead of discarding it", async () => {
    const task = record({ workspace: { kind: "isolated", ownership: "managed" } });
    const harness = originHarness({ task, remoteSha: null });
    const v2AutoCleanup = vi.fn(async () => {
      throw Object.assign(new Error("boom"), { code: "TASK_RECORD_CHANGED" });
    });
    const reconcileIsolated = vi.fn(({ v2Result }) => ({
      state: "PRESERVED",
      taskId: task.taskId,
      blockers: ["V2_CLEANUP_NOT_CONFIRMED", ...(v2Result?.blockers ?? [])],
    }));

    const result = await autoCleanupTaskV3Adapter({
      repoPath: "C:/repo",
      branch: task.branch.name,
      now: NOW,
      readRecord: () => task,
      runCommand: harness.runCommand,
      gitRunner: harness.gitRunner,
      withAuth: async ({ operation }) => ({
        result: "AUTHENTICATED",
        value: await operation({}),
      }),
      v2AutoCleanup,
      reconcileIsolated,
    });

    // 예외를 삼키지 않고 안전한 코드로 바꿔 병합 경로에 넘긴다.
    expect(reconcileIsolated).toHaveBeenCalledWith(expect.objectContaining({
      v2Result: expect.objectContaining({ blockers: ["TASK_RECORD_CHANGED"] }),
    }));
    expect(result.blockers).toContain("TASK_RECORD_CHANGED");
  });
});

describe("V3 sweep and CLI routing", () => {
  it("does zero auth or network work when there are no active V3 candidates", async () => {
    const runCommand = vi.fn();
    const result = await sweepTasksV3Adapter({
      repoPath: "C:/repo",
      now: NOW,
      discoverTasks: () => [],
      runCommand,
    });
    expect(result).toMatchObject({ result: "NO_ACTIVE_TASKS", attempted: 0 });
    expect(runCommand).not.toHaveBeenCalled();
  });

  it("exposes the same zero-network sweep as the task sweep entrypoint", async () => {
    const runCommand = vi.fn();
    const result = await runRepositorySweepV3({
      repoPath: "C:/repo",
      now: NOW,
      discoverTasks: () => [],
      runCommand,
    });
    expect(result).toMatchObject({ result: "NO_ACTIVE_TASKS", attempted: 0 });
    expect(runCommand).not.toHaveBeenCalled();
  });

  it("runs active candidates through the sweep budget and forwards the host auth root", async () => {
    const cleanupTask = vi.fn(async ({ localAppData, signal, timeoutMs }) => {
      expect(localAppData).toBe("C:/Users/test/AppData/Local");
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(timeoutMs).toBe(12_345);
      return { result: "PRESERVED", blocker: "AUTH_UNAVAILABLE" };
    });
    const runSweep = vi.fn(async ({
      repositories,
      listActiveManagedTasks,
      withAuth,
      processTask,
    }) => {
      const tasks = listActiveManagedTasks({ repository: repositories[0] });
      expect(tasks[0]).toMatchObject({
        ownership: "managed",
        resourceOwnership: "adopted",
      });
      await withAuth({
        repository: repositories[0],
        operation: () => processTask({
          repository: repositories[0],
          task: tasks[0],
          signal: new AbortController().signal,
          timeoutMs: 12_345,
        }),
      });
      return { result: "COMPLETED", examined: 1, attempted: 1, deferred: 0 };
    });
    const result = await runRepositorySweepV3({
      repoPath: "C:/repo",
      now: NOW,
      localAppData: "C:/Users/test/AppData/Local",
      discoverTasks: () => [{
        taskId: "task-adapter",
        branch: "feat/adapter",
        ownership: "adopted",
      }],
      gitRunner: (_cwd, args) => args.join(" ") === "rev-parse --git-common-dir"
        ? { status: 0, stdout: path.resolve("C:/repo/.git") }
        : { status: 1, stdout: "" },
      runSweep,
      cleanupTask,
    });

    expect(runSweep).toHaveBeenCalledTimes(1);
    expect(cleanupTask).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      result: "COMPLETED",
      attempted: 1,
      results: [{
        taskId: "task-adapter",
        result: "PRESERVED",
        blocker: "AUTH_UNAVAILABLE",
      }],
    });
  });

  it("copies legacy V2 candidates, reconciles them, and runs only the bounded V3 sweep", async () => {
    const direct = vi.fn(async () => ({ handled: true, result: { result: "CLEANED" } }));
    const directResult = await runTaskLifecycleCommand(
      {
        command: "autocleanup",
        values: { repo: "C:/repo", branch: "feat/adapter", now: NOW },
      },
      { runV3Autocleanup: direct },
    );
    expect(directResult).toEqual({ result: "CLEANED" });

    const v2Sweep = vi.fn(async () => ({ status: "COMPLETED", inspected: 1 }));
    const order = [];
    const copyV2ForSweep = vi.fn(() => {
      order.push("copy");
      return { inspected: 1, copied: 1, reused: 0, preserved: 0, results: [] };
    });
    const reconcileV3 = vi.fn(() => {
      order.push("reconcile");
      return { inspected: 1, cleaned: 0, preserved: 0, unchanged: 1, results: [] };
    });
    const v3Sweep = vi.fn(async () => ({ result: "COMPLETED", attempted: 1 }));
    const sweepResult = await runTaskLifecycleCommand(
      { command: "sweep", values: { repo: "C:/repo" } },
      {
        copyV2ForSweep,
        reconcileV3,
        runV2Sweep: v2Sweep,
        runV3Sweep: async (input) => {
          order.push("sweep");
          return v3Sweep(input);
        },
      },
    );
    expect(sweepResult).toMatchObject({
      schemaVersion: 3,
      recordType: "TaskSweepCommandResultV3",
      result: "COMPLETED",
      v2Migration: { copied: 1 },
      v3: { result: "COMPLETED", attempted: 1 },
    });
    expect(order).toEqual(["copy", "reconcile", "sweep"]);
    expect(v2Sweep).not.toHaveBeenCalled();
    expect(v3Sweep).toHaveBeenCalledTimes(1);
  });

  it("copies a V2-only direct autocleanup before entering the account-restoring V3 adapter", async () => {
    const calls = [];
    const runV3Autocleanup = vi.fn(async () => {
      calls.push("v3");
      return calls.length === 1
        ? { handled: false }
        : { handled: true, result: { result: "CLEANED" } };
    });
    const migrateStartedTask = vi.fn(() => {
      calls.push("copy");
      return { record: { taskId: "task-v2-copy" }, reused: false };
    });

    const result = await runTaskLifecycleCommand(
      {
        command: "autocleanup",
        values: { repo: "C:/repo", branch: "fix/v2-only", now: NOW },
      },
      { runV3Autocleanup, migrateStartedTask },
    );

    expect(result).toEqual({ result: "CLEANED" });
    expect(calls).toEqual(["v3", "copy", "v3"]);
    // The entry point resolves --repo once because the v2 delegation accepts
    // absolute paths only. This asserts the normalized value is forwarded as is.
    expect(migrateStartedTask).toHaveBeenCalledWith({
      repoPath: path.resolve("C:/repo"),
      branch: "fix/v2-only",
      now: NOW,
    });
  });

  it("reports the V2 copy failure code in both blocker fields", async () => {
    const runV3Autocleanup = vi.fn(async () => ({ handled: false }));
    const migrateStartedTask = vi.fn(() => {
      throw Object.assign(new Error("invalid"), { code: "V2_RECORD_INVALID" });
    });

    const result = await runTaskLifecycleCommand(
      {
        command: "autocleanup",
        values: { repo: "C:/repo", branch: "fix/v2-copy-failed", now: NOW },
      },
      { runV3Autocleanup, migrateStartedTask },
    );

    // 세 곳의 결과 생성 지점이 같은 형태를 내보내야 호출자가 blockers 를 믿고 읽을 수 있다.
    expect(result).toMatchObject({
      result: "PRESERVED",
      blocker: "V2_RECORD_INVALID",
      blockers: ["V2_RECORD_INVALID"],
    });
  });

  it("copies only valid active V2 candidates that do not already have a V3 record", () => {
    const candidates = [
      { taskId: "feat-existing", branch: "feat/existing" },
      { taskId: "fix-copy", branch: "fix/copy" },
      { taskId: "docs-preserve", branch: "docs/preserve" },
    ];
    const migrateV2Task = vi.fn(({ branch }) => {
      if (branch === "docs/preserve") throw Object.assign(new Error("invalid"), { code: "V2_RECORD_INVALID" });
      return { record: { taskId: "task-copy" }, reused: false };
    });
    const report = copyV2SweepCandidates(
      { repoPath: "C:/repo", now: NOW },
      {
        enumerateV2Tasks: () => candidates,
        readV3ByBranch: ({ branch }) => branch === "feat/existing"
          ? { taskId: "task-existing" }
          : null,
        migrateV2Task,
      },
    );

    expect(report).toMatchObject({
      schemaVersion: 1,
      recordType: "TaskRecordV2SweepCopyV1",
      inspected: 3,
      copied: 1,
      reused: 1,
      preserved: 1,
    });
    expect(report.results).toEqual([
      { taskId: "feat-existing", branch: "feat/existing", result: "REUSED" },
      { taskId: "fix-copy", branch: "fix/copy", result: "COPIED" },
      {
        taskId: "docs-preserve",
        branch: "docs/preserve",
        result: "PRESERVED",
        blocker: "V2_RECORD_INVALID",
      },
    ]);
    expect(migrateV2Task).toHaveBeenCalledTimes(2);
  });
});

describe("V3 record identity is the identity the adapter approves", () => {
  it("accepts the exact identity shape the v3 lifecycle writes for both approved repositories", () => {
    for (const [remoteUrl, expected] of [
      ["https://github.com/blackstarzck/topik-project-v13.git", "blackstarzck/topik-project-v13"],
      ["https://github.com/keduall/topik-project-v13.git", "keduall/topik-project-v13"],
      ["git@github.com:blackstarzck/topik-project-v13.git", "blackstarzck/topik-project-v13"],
    ]) {
      const produced = parseRepositoryIdentity(remoteUrl).identity;
      expect(adapterIdentity(produced)).toBe(expected);
      expect(ADAPTER_PROFILE_IDENTITIES).toContain(expected);
    }
  });

  it("refuses identities that are not exactly a github.com owner and repository", () => {
    for (const value of [
      "blackstarzck/topik-project-v13",
      "local/test/topik-project-v13",
      "evil.com/blackstarzck/topik-project-v13",
      "github.com/blackstarzck",
      "github.com/blackstarzck/topik-project-v13/extra",
      "",
      null,
      undefined,
      42,
    ]) {
      expect(adapterIdentity(value)).toBeNull();
    }
  });

  it("preserves a merged managed task instead of approving it when the identity is unapproved", async () => {
    const task = record({
      repoProfile: {
        remote: "origin",
        repositoryIdentity: "local/test/topik-project-v13",
        authLogin: "local",
      },
    });
    const harness = originHarness({ task });

    const result = await autoCleanupTaskV3Adapter({
      repoPath: "C:/repo",
      branch: task.branch.name,
      now: NOW,
      readRecord: () => task,
      runCommand: harness.runCommand,
      gitRunner: harness.gitRunner,
      localAppData: "C:/Users/test/AppData/Local",
      withAuth: async () => {
        throw new Error("authentication must not be attempted for an unapproved identity");
      },
      cleanupRecord: () => {
        throw new Error("cleanup must not run for an unapproved identity");
      },
    });

    expect(result.result).toBe("PRESERVED");
    expect(result.blocker).toBe("REPOSITORY_PROFILE_UNAPPROVED");
  });
});
