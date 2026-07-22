import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { runGitHubOwnerAuth } from "./lib/github-owner-auth.mjs";
import { writeOwnerAuthResultSidecar } from "./lib/ai-task-lifecycle-v2.mjs";

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

export async function runGitHubOwnerAuthCli({
  argv,
  commandRunner = executeCommand,
  writeStderr = (value) => process.stderr.write(value),
  writeStdout = (value) => process.stdout.write(value),
}) {
  try {
    const options = parseArguments(argv);
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
    writeStdout(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (error) {
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
