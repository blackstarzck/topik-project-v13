import { randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

export const PIPELINE_REPOSITORY_PROFILES = Object.freeze({
  origin: Object.freeze({
    authLogin: "blackstarzck",
    owner: "blackstarzck",
    repository: "topik-project-v13",
  }),
  collab: Object.freeze({
    authLogin: "guestkeduall-design",
    owner: "keduall",
    repository: "topik-project-v13",
  }),
});

const DEFAULT_STALE_LEASE_MS = 15 * 60_000;
const SWEEP_LIMITS = Object.freeze({
  maxTasks: 10,
  maxRuntimeMs: 10 * 60_000,
});

function normalizeWindowsPath(value) {
  return path.resolve(value).replaceAll("/", "\\").toLowerCase();
}

function existingAncestors(targetPath) {
  const absolute = path.resolve(targetPath);
  const parsed = path.parse(absolute);
  const relativeParts = absolute
    .slice(parsed.root.length)
    .split(path.sep)
    .filter(Boolean);
  const paths = [parsed.root];
  let cursor = parsed.root;
  for (const part of relativeParts) {
    cursor = path.join(cursor, part);
    if (!existsSync(cursor)) break;
    paths.push(cursor);
  }
  return paths;
}

function assertNoReparseTraversal(targetPath, label) {
  for (const candidate of existingAncestors(targetPath)) {
    const stat = lstatSync(candidate);
    if (stat.isSymbolicLink()) {
      throw new Error(`${label} traverses a symbolic link or reparse point.`);
    }
    if (process.platform === "win32") {
      const resolved = realpathSync.native(candidate);
      if (normalizeWindowsPath(resolved) !== normalizeWindowsPath(candidate)) {
        throw new Error(`${label} traverses a symbolic link or reparse point.`);
      }
    }
  }
}

function validLeaseRecord(value) {
  return (
    value?.schemaVersion === "TaskSweepLeaseV1" &&
    Number.isSafeInteger(value.pid) &&
    value.pid > 0 &&
    Number.isSafeInteger(value.acquiredAtMs) &&
    value.acquiredAtMs >= 0 &&
    typeof value.nonce === "string" &&
    /^[a-f0-9-]{36}$/iu.test(value.nonce) &&
    Object.keys(value).sort().join("\0") ===
      ["schemaVersion", "pid", "acquiredAtMs", "nonce"].sort().join("\0")
  );
}

function sameLease(left, right) {
  return (
    validLeaseRecord(left) &&
    validLeaseRecord(right) &&
    left.pid === right.pid &&
    left.acquiredAtMs === right.acquiredAtMs &&
    left.nonce === right.nonce
  );
}

export function acquireTaskSweepLease({
  lockPath,
  nowMs = Date.now(),
  pid = process.pid,
  staleAfterMs = DEFAULT_STALE_LEASE_MS,
  beforeStaleQuarantine = () => {},
  isPidAlive = (candidatePid) => {
    try {
      process.kill(candidatePid, 0);
      return true;
    } catch {
      return false;
    }
  },
}) {
  if (!path.isAbsolute(lockPath)) {
    throw new Error("Task sweep lock path must be absolute.");
  }
  assertNoReparseTraversal(path.dirname(lockPath), "Task sweep lock");
  mkdirSync(path.dirname(lockPath), { recursive: true });
  assertNoReparseTraversal(path.dirname(lockPath), "Task sweep lock");

  if (existsSync(lockPath)) {
    let existing;
    try {
      existing = JSON.parse(readFileSync(lockPath, "utf8"));
    } catch {
      return { acquired: false, blocker: "INVALID_LOCK" };
    }
    if (!validLeaseRecord(existing)) {
      return { acquired: false, blocker: "INVALID_LOCK" };
    }
    const stale = nowMs - existing.acquiredAtMs >= staleAfterMs;
    if (!stale || isPidAlive(existing.pid)) {
      return { acquired: false, blocker: "DUPLICATE_SWEEP" };
    }
    beforeStaleQuarantine();
    const quarantinePath = `${lockPath}.stale-${randomUUID()}`;
    try {
      renameSync(lockPath, quarantinePath);
    } catch (error) {
      if (error?.code === "ENOENT" || error?.code === "EEXIST") {
        return { acquired: false, blocker: "LOCK_RACE" };
      }
      throw error;
    }
    let quarantined;
    try {
      quarantined = JSON.parse(readFileSync(quarantinePath, "utf8"));
    } catch {
      quarantined = null;
    }
    if (!sameLease(existing, quarantined)) {
      if (!existsSync(lockPath)) renameSync(quarantinePath, lockPath);
      return { acquired: false, blocker: "LOCK_RACE" };
    }
    unlinkSync(quarantinePath);
  }

  let descriptor;
  const nonce = randomUUID();
  try {
    descriptor = openSync(lockPath, "wx", 0o600);
    writeFileSync(
      descriptor,
      `${JSON.stringify({
        schemaVersion: "TaskSweepLeaseV1",
        pid,
        acquiredAtMs: nowMs,
        nonce,
      })}\n`,
    );
    closeSync(descriptor);
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    if (error?.code === "EEXIST") {
      return { acquired: false, blocker: "DUPLICATE_SWEEP" };
    }
    throw error;
  }

  let released = false;
  return {
    acquired: true,
    release() {
      if (released) return;
      released = true;
      if (!existsSync(lockPath)) return;
      let current;
      try {
        current = JSON.parse(readFileSync(lockPath, "utf8"));
      } catch {
        return;
      }
      if (
        validLeaseRecord(current) &&
        current.pid === pid &&
        current.acquiredAtMs === nowMs &&
        current.nonce === nonce
      ) {
        unlinkSync(lockPath);
      }
    },
  };
}

function validateRepositoryProfile(profile) {
  if (!profile || typeof profile !== "object") {
    throw new Error("Repository profile is required.");
  }
  const exact = Object.values(PIPELINE_REPOSITORY_PROFILES).find(
    (candidate) =>
      candidate.authLogin === profile.authLogin &&
      candidate.owner === profile.owner &&
      candidate.repository === profile.repository,
  );
  if (
    !exact ||
    Object.keys(profile).sort().join("\0") !==
      Object.keys(exact).sort().join("\0")
  ) {
    throw new Error("Repository profile is not approved.");
  }
  return exact;
}

function commandSucceeded(result) {
  return Boolean(result && result.exitCode === 0);
}

function safeLogin(result) {
  if (!commandSucceeded(result)) return null;
  const login = String(result.stdout ?? "").trim();
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/u.test(login)
    ? login
    : null;
}

function commandOptions(timeout, signal) {
  return {
    shell: false,
    timeout,
    windowsHide: true,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    ...(signal ? { signal } : {}),
  };
}

async function safeGh(runCommand, args, { signal, timeoutMs = 20_000 } = {}) {
  if (args[0] === "auth" && args[1] === "token") {
    throw new Error("Reading GitHub authentication tokens is prohibited.");
  }
  if (signal?.aborted || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return { stdout: "", stderr: "", exitCode: 1 };
  }
  try {
    return await runCommand(
      "gh",
      args,
      commandOptions(Math.min(20_000, timeoutMs), signal),
    );
  } catch {
    return { stdout: "", stderr: "", exitCode: 1 };
  }
}

export async function withRepositoryAuth({
  profile,
  localAppData = process.env.LOCALAPPDATA,
  runCommand,
  operation,
  nowMs = Date.now(),
  pid = process.pid,
  staleAfterMs = DEFAULT_STALE_LEASE_MS,
  isPidAlive,
  signal,
  timeoutMs = 20_000,
  cleanupTimeoutMs = 5_000,
}) {
  const safeProfile = validateRepositoryProfile(profile);
  if (typeof localAppData !== "string" || !path.isAbsolute(localAppData)) {
    throw new Error(
      "LocalAppData is required for the host-wide authentication lock.",
    );
  }
  assertNoReparseTraversal(localAppData, "LocalAppData");
  const hostLockRoot = path.join(localAppData, "TalkpikPipeline", "locks");
  if (typeof runCommand !== "function" || typeof operation !== "function") {
    throw new Error(
      "Authentication requires injected command and operation functions.",
    );
  }
  const lease = acquireTaskSweepLease({
    lockPath: path.join(hostLockRoot, ".auth-github.com.lock"),
    nowMs,
    pid,
    staleAfterMs,
    ...(isPidAlive ? { isPidAlive } : {}),
  });
  if (!lease.acquired) {
    return {
      result: "PRESERVED",
      blocker: "AUTH_LOCKED",
      message: "Repository auth is locked.",
    };
  }

  let originalLogin = null;
  let restoreNeeded = false;
  let restoreFailed = false;
  let outcome;
  let pendingError = null;
  const authStartedAt = Date.now();
  const remainingAuthMs = () =>
    Math.max(0, timeoutMs - (Date.now() - authStartedAt));
  const runGh = (args) =>
    safeGh(runCommand, args, { signal, timeoutMs: remainingAuthMs() });
  try {
    originalLogin = safeLogin(
      await runGh(["api", "user", "--jq", ".login"]),
    );
    if (!originalLogin) {
      outcome = {
        result: "PRESERVED",
        blocker: "AUTH_UNAVAILABLE",
        message: "GitHub account authentication is unavailable.",
      };
    } else if (
      originalLogin.toLowerCase() !== safeProfile.authLogin.toLowerCase()
    ) {
      restoreNeeded = true;
      const switchResult = await runGh([
        "auth",
        "switch",
        "--hostname",
        "github.com",
        "--user",
        safeProfile.authLogin,
      ]);
      if (!commandSucceeded(switchResult)) {
        outcome = {
          result: "PRESERVED",
          blocker: "AUTH_UNAVAILABLE",
          message: "GitHub account authentication is unavailable.",
        };
      }
    }
    if (!outcome) {
      const verifiedLogin = safeLogin(
        await runGh(["api", "user", "--jq", ".login"]),
      );
      if (
        verifiedLogin?.toLowerCase() !== safeProfile.authLogin.toLowerCase()
      ) {
        outcome = {
          result: "PRESERVED",
          blocker: "AUTH_UNAVAILABLE",
          message: "GitHub account authentication is unavailable.",
        };
      }
    }
    if (!outcome) {
      const permission = await runGh([
        "api",
        `repos/${safeProfile.owner}/${safeProfile.repository}`,
        "--jq",
        ".permissions.push",
      ]);
      if (
        !commandSucceeded(permission) ||
        String(permission.stdout ?? "").trim() !== "true"
      ) {
        outcome = {
          result: "PRESERVED",
          blocker: "AUTH_PERMISSION_DENIED",
          message:
            "The selected GitHub account lacks repository push permission.",
        };
      }
    }
    if (!outcome) {
      try {
        outcome = {
          result: "AUTHENTICATED",
          value: await operation({ signal, timeoutMs: remainingAuthMs() }),
        };
      } catch (error) {
        if (signal?.aborted || error?.name === "TaskSweepBudgetExceeded") {
          pendingError = error;
        } else {
          outcome = {
            result: "PRESERVED",
            blocker: "AUTH_OPERATION_FAILED",
            message: "The authenticated repository operation failed.",
          };
        }
      }
    }
  } finally {
    if (restoreNeeded && originalLogin) {
      const cleanupController = new AbortController();
      const cleanupStartedAt = Date.now();
      const cleanupTimer = setTimeout(
        () => cleanupController.abort(),
        cleanupTimeoutMs,
      );
      const cleanupRunGh = (args) =>
        safeGh(runCommand, args, {
          signal: cleanupController.signal,
          timeoutMs: Math.max(
            0,
            cleanupTimeoutMs - (Date.now() - cleanupStartedAt),
          ),
        });
      try {
        const restoreResult = await cleanupRunGh([
          "auth",
          "switch",
          "--hostname",
          "github.com",
          "--user",
          originalLogin,
        ]);
        const restoredLogin = commandSucceeded(restoreResult)
          ? safeLogin(
              await cleanupRunGh(["api", "user", "--jq", ".login"]),
            )
          : null;
        restoreFailed =
          restoredLogin?.toLowerCase() !== originalLogin.toLowerCase();
      } finally {
        clearTimeout(cleanupTimer);
      }
    }
    lease.release();
  }

  const authRestoreFailure = {
    result: "PRESERVED",
    blocker: "AUTH_RESTORE_FAILED",
    message: "The original GitHub account could not be restored.",
  };
  if (pendingError) {
    if (restoreFailed && pendingError instanceof Error) {
      pendingError.authRestoreFailure = authRestoreFailure;
    }
    throw pendingError;
  }
  if (restoreFailed) {
    return {
      result: "PRESERVED",
      blocker: "AUTH_RESTORE_FAILED",
      message: "The original GitHub account could not be restored.",
    };
  }
  return outcome;
}

class TaskSweepBudgetExceeded extends Error {
  constructor(pendingOperation = null) {
    super("Task sweep runtime budget was exhausted.");
    this.name = "TaskSweepBudgetExceeded";
    this.pendingOperations = pendingOperation
      ? [Promise.resolve(pendingOperation)]
      : [];
  }
}

async function runWithinTaskSweepBudget({
  operation,
  deadlineMs,
  now,
  setTimeoutFn,
  clearTimeoutFn,
}) {
  const remainingMs = Math.max(0, deadlineMs - now());
  if (remainingMs <= 0) throw new TaskSweepBudgetExceeded();
  const controller = new AbortController();
  let operationPromise;
  try {
    operationPromise = Promise.resolve(
      operation({ signal: controller.signal, timeoutMs: remainingMs }),
    );
  } catch (error) {
    operationPromise = Promise.reject(error);
  }
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeoutFn(() => {
      controller.abort();
      reject(new TaskSweepBudgetExceeded(operationPromise));
    }, remainingMs);
  });
  try {
    return await Promise.race([operationPromise, timeoutPromise]);
  } finally {
    clearTimeoutFn(timer);
  }
}

export async function runTaskSweep({
  lockPath,
  repositories,
  listActiveManagedTasks,
  withAuth,
  processTask,
  nowMs = Date.now(),
  pid = process.pid,
  staleAfterMs = DEFAULT_STALE_LEASE_MS,
  isPidAlive,
  now = () => Date.now(),
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
}) {
  if (
    !Array.isArray(repositories) ||
    typeof listActiveManagedTasks !== "function"
  ) {
    throw new Error("Task sweep repositories and discovery are required.");
  }
  if (typeof withAuth !== "function" || typeof processTask !== "function") {
    throw new Error("Task sweep auth and task processors are required.");
  }

  const startedAt = now();
  const deadlineMs = startedAt + SWEEP_LIMITS.maxRuntimeMs;
  const lease = acquireTaskSweepLease({
    lockPath,
    nowMs,
    pid,
    staleAfterMs,
    ...(isPidAlive ? { isPidAlive } : {}),
  });
  if (!lease.acquired) {
    return { result: "PRESERVED", blocker: "DUPLICATE_SWEEP" };
  }

  const discovered = [];
  let attempted = 0;
  let deferLeaseRelease = false;
  try {
    for (const repository of repositories) {
      const tasks = await runWithinTaskSweepBudget({
        deadlineMs,
        now,
        setTimeoutFn,
        clearTimeoutFn,
        operation: ({ signal, timeoutMs }) =>
          listActiveManagedTasks({ repository, signal, timeoutMs }),
      });
      for (const task of tasks) {
        if (task?.ownership === "managed") {
          discovered.push({ repository, task });
        }
      }
    }
    if (discovered.length === 0) {
      return {
        result: "NO_ACTIVE_TASKS",
        examined: 0,
        attempted: 0,
        deferred: 0,
      };
    }
    for (const candidate of discovered) {
      if (attempted >= SWEEP_LIMITS.maxTasks) break;
      await runWithinTaskSweepBudget({
        deadlineMs,
        now,
        setTimeoutFn,
        clearTimeoutFn,
        operation: ({ signal, timeoutMs }) =>
          withAuth({
            repository: candidate.repository,
            signal,
            timeoutMs,
            operation: async () =>
              runWithinTaskSweepBudget({
                deadlineMs,
                now,
                setTimeoutFn,
                clearTimeoutFn,
                operation: (taskBudget) =>
                  processTask({ ...candidate, ...taskBudget }),
              }),
          }),
      });
      attempted += 1;
    }
  } catch (error) {
    if (error instanceof TaskSweepBudgetExceeded) {
      if (error.pendingOperations.length > 0) {
        deferLeaseRelease = true;
        void Promise.allSettled(error.pendingOperations).finally(() =>
          lease.release(),
        );
        return {
          result: "PRESERVED",
          blocker: "OPERATION_TERMINATION_PENDING",
          examined: discovered.length,
          attempted,
          deferred: Math.max(0, discovered.length - attempted),
          leaseHeld: true,
        };
      }
      return {
        result: "BUDGET_EXHAUSTED",
        examined: discovered.length,
        attempted,
        deferred: Math.max(0, discovered.length - attempted),
      };
    }
    throw error;
  } finally {
    if (!deferLeaseRelease) lease.release();
  }
  return {
    result: "COMPLETED",
    examined: discovered.length,
    attempted,
    deferred: Math.max(0, discovered.length - attempted),
  };
}
