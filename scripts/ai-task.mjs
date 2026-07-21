#!/usr/bin/env node

import {
  handoffTask,
  readLegacyCodexHints,
  readTaskStatus,
  resumeTask,
  startTask,
} from "./lib/ai-task-lifecycle-v2.mjs";
import {
  cleanupTask,
  finalizeTask,
  registerTaskRuntime,
} from "./lib/ai-task-cleanup.mjs";

const COMMANDS = new Set(["start", "status", "handoff", "resume", "runtime", "finalize", "cleanup"]);
const VALUE_FLAGS = new Set([
  "repo",
  "branch",
  "actor",
  "to",
  "now",
  "base-sha",
  "codex-home",
  "repo-id",
  "approval",
  "ports",
  "pids",
  "locks",
]);

function cliError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function parseArguments(argv) {
  const [command, ...tokens] = argv;
  if (!COMMANDS.has(command)) throw cliError("TASK_COMMAND_REQUIRED");
  const values = {};
  for (let index = 0; index < tokens.length; index += 2) {
    const flag = tokens[index];
    const value = tokens[index + 1];
    if (!flag?.startsWith("--") || value === undefined || value.startsWith("--")) {
      throw cliError("INVALID_TASK_ARGUMENTS");
    }
    const name = flag.slice(2);
    if (!VALUE_FLAGS.has(name) || Object.hasOwn(values, name)) {
      throw cliError("INVALID_TASK_ARGUMENTS");
    }
    values[name] = value;
  }
  if (!values.repo || !values.branch) throw cliError("TASK_REPO_AND_BRANCH_REQUIRED");
  return { command, values };
}

function required(values, name) {
  if (!values[name]) throw cliError(`TASK_${name.replaceAll("-", "_").toUpperCase()}_REQUIRED`);
  return values[name];
}

function commaList(value) {
  return typeof value === "string" && value.length > 0
    ? value.split(",").map((entry) => entry.trim()).filter(Boolean)
    : [];
}

function integerList(value, kind) {
  const values = commaList(value).map((entry) => Number(entry));
  if (values.some((entry) => !Number.isInteger(entry) || entry <= 0)) {
    throw cliError(`TASK_${kind}_INVALID`);
  }
  return values;
}

async function run(argv) {
  const { command, values } = parseArguments(argv);
  const common = { repoPath: values.repo, branch: values.branch };
  const now = values.now ?? new Date().toISOString();
  if (command === "start") {
    return startTask({
      ...common,
      actor: required(values, "actor"),
      now,
      expectedBaseSha: values["base-sha"] ?? null,
    });
  }
  if (command === "status") {
    const status = readTaskStatus(common);
    const codexHome = values["codex-home"] ?? process.env.CODEX_HOME;
    const repoId = values["repo-id"];
    return {
      ...status,
      legacyHints:
        typeof codexHome === "string" && typeof repoId === "string"
          ? readLegacyCodexHints({ codexHome, repoId })
          : [],
    };
  }
  if (command === "handoff") {
    return handoffTask({
      ...common,
      actor: required(values, "actor"),
      toActor: required(values, "to"),
      now,
    });
  }
  if (command === "resume") {
    return resumeTask({ ...common, actor: required(values, "actor"), now });
  }
  if (command === "runtime") {
    return registerTaskRuntime({
      ...common,
      ports: integerList(values.ports, "PORTS"),
      pids: integerList(values.pids, "PIDS"),
      lockPaths: commaList(values.locks),
      now,
    });
  }
  if (command === "finalize") return finalizeTask(common);
  return cleanupTask({
    ...common,
    approval: required(values, "approval"),
    now,
  });
}

try {
  process.stdout.write(`${JSON.stringify(await run(process.argv.slice(2)), null, 2)}\n`);
} catch (error) {
  const code =
    typeof error?.code === "string" && /^[A-Z0-9_:.-]+$/.test(error.code)
      ? error.code
      : typeof error?.message === "string" && /^[A-Z0-9_:.-]+$/.test(error.message)
        ? error.message
        : "TASK_COMMAND_FAILED";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}
