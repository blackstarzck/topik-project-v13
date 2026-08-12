import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { runGitHubOwnerAuth } from "./lib/github-owner-auth.mjs";
import { readTaskStatus, writeOwnerAuthResultSidecar } from "./lib/ai-task-lifecycle-v2.mjs";
import {
  finishLifecycleTaskMetricSpan,
  startLifecycleTaskMetricSpan,
} from "./ai-task.mjs";

function cliError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function parseArguments(argv) {
  const options = { owner: null, repoPath: null, branch: null, publishApproved: false, now: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--") continue;
    if (argument === "--publish-approved") {
      if (options.publishApproved) throw cliError("DUPLICATE_ARGUMENT");
      options.publishApproved = true;
    } else if (argument === "--repo") {
      if (options.repoPath !== null) throw cliError("DUPLICATE_ARGUMENT");
      options.repoPath = argv[++index] ?? null;
    } else if (argument === "--owner") {
      if (options.owner !== null) throw cliError("DUPLICATE_ARGUMENT");
      options.owner = argv[++index] ?? null;
    } else if (argument === "--branch") {
      if (options.branch !== null) throw cliError("DUPLICATE_ARGUMENT");
      options.branch = argv[++index] ?? null;
    } else if (argument === "--now") {
      if (options.now !== null) throw cliError("DUPLICATE_ARGUMENT");
      options.now = argv[++index] ?? null;
    } else {
      throw cliError("UNKNOWN_ARGUMENT");
    }
  }
  if (!options.repoPath) throw cliError("REPOSITORY_PATH_REQUIRED");
  if (!options.owner) throw cliError("OWNER_REQUIRED");
  return options;
}

function executeCommand(command, args, options) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024,
    shell: false,
    timeout: options.timeout,
    windowsHide: true,
  });
}

function safeErrorCode(error) {
  return typeof error?.code === "string" && /^[A-Z][A-Z0-9_]*$/u.test(error.code)
    ? error.code
    : "OWNER_AUTH_PREFLIGHT_FAILED";
}

function isMetricContextError(error) {
  return new Set([
    "TASK_METRIC_ACTOR_MISMATCH",
    "TASK_METRIC_TASK_NOT_ACTIVE",
    "TASK_METRIC_TASK_NOT_FOUND",
    "TASK_METRIC_WORKTREE_REQUIRED",
  ]).has(error?.code ?? error?.message);
}

export async function runGitHubOwnerAuthCli({
  argv,
  commandRunner = executeCommand,
  writeStderr = (value) => process.stderr.write(value),
  writeStdout = (value) => process.stdout.write(value),
}) {
  let options = null;
  let metricSpan = null;
  try {
    options = parseArguments(argv);
    if (options.branch !== null) {
      let status = null;
      try {
        status = readTaskStatus({ repoPath: options.repoPath, branch: options.branch });
      } catch {
        status = null;
      }
      try {
        if (!status?.task) throw cliError("TASK_METRIC_TASK_NOT_FOUND");
        metricSpan = startLifecycleTaskMetricSpan({
          repoPath: options.repoPath,
          branch: options.branch,
          actor: status.task.activeActor ?? status.task.handoffFromActor,
          operation: "owner-auth",
        });
      } catch (error) {
        if (!isMetricContextError(error)) {
          writeStderr(`${JSON.stringify({ code: "TASK_METRIC_RECORDING_WARNING" })}\n`);
        }
      }
    }
    const result = await runGitHubOwnerAuth({
      commandRunner,
      owner: options.owner,
      repoPath: options.repoPath,
      publishApproved: options.publishApproved,
      ...(options.now === null ? {} : { now: options.now }),
    });
    if (options.branch !== null) {
      writeOwnerAuthResultSidecar({
        repoPath: options.repoPath,
        branch: options.branch,
        result,
      });
    }
    if (metricSpan !== null) {
      try {
        const metricResult = finishLifecycleTaskMetricSpan({
          repoPath: options.repoPath,
          branch: options.branch,
          spanId: metricSpan.spanId,
          exitCode: 0,
        });
        if (metricResult.exceeded) {
          writeStderr(`${JSON.stringify({ code: "TASK_METRIC_BUDGET_EXCEEDED" })}\n`);
        }
      } catch {
        writeStderr(`${JSON.stringify({ code: "TASK_METRIC_RECORDING_WARNING" })}\n`);
      }
    }
    writeStdout(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (error) {
    if (metricSpan !== null) {
      try {
        const metricResult = finishLifecycleTaskMetricSpan({
          repoPath: options.repoPath,
          branch: options.branch,
          spanId: metricSpan.spanId,
          exitCode: 1,
        });
        if (metricResult.exceeded) {
          writeStderr(`${JSON.stringify({ code: "TASK_METRIC_BUDGET_EXCEEDED" })}\n`);
        }
      } catch {
        writeStderr(`${JSON.stringify({ code: "TASK_METRIC_RECORDING_WARNING" })}\n`);
      }
    }
    writeStderr(`${JSON.stringify({ code: safeErrorCode(error) })}\n`);
    return 1;
  }
}

const isMain =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  process.exitCode = await runGitHubOwnerAuthCli({
    argv: process.argv.slice(2),
  });
}
