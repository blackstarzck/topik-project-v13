import path from "node:path";

const GITHUB_HOST = "github.com";
const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/u;
export const OWNER_AUTH_COMMAND_TIMEOUT_MS = 30_000;

function ownerAuthError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function assertOwner(owner) {
  if (typeof owner !== "string" || !OWNER_PATTERN.test(owner)) {
    throw ownerAuthError("INVALID_OWNER");
  }
}

function parseUrlOrigin(remoteUrl) {
  let parsed;
  try {
    parsed = new URL(remoteUrl);
  } catch {
    return null;
  }
  if (!new Set(["https:", "ssh:"]).has(parsed.protocol)) return null;
  if (parsed.protocol === "https:" && (parsed.username || parsed.password)) {
    return null;
  }
  return { host: parsed.hostname, repositoryPath: parsed.pathname };
}

function parseScpOrigin(remoteUrl) {
  const match = /^(?:[^@/\s]+@)?([^:/\s]+):([^/\s]+\/[^/\s]+)$/u.exec(
    remoteUrl,
  );
  if (!match) return null;
  return { host: match[1], repositoryPath: match[2] };
}

export function parseGitHubOrigin(remoteUrl) {
  if (typeof remoteUrl !== "string") {
    throw ownerAuthError("ORIGIN_URL_UNSUPPORTED");
  }
  const normalized = remoteUrl.trim();
  const parsed = parseUrlOrigin(normalized) ?? parseScpOrigin(normalized);
  if (!parsed) throw ownerAuthError("ORIGIN_URL_UNSUPPORTED");

  const host = parsed.host.toLowerCase();
  if (host !== GITHUB_HOST) {
    throw ownerAuthError("ORIGIN_HOST_UNSUPPORTED");
  }
  const segments = parsed.repositoryPath
    .replace(/^\/+|\/+$/gu, "")
    .split("/");
  if (segments.length !== 2 || !segments[1].replace(/\.git$/u, "")) {
    throw ownerAuthError("ORIGIN_URL_UNSUPPORTED");
  }
  const owner = segments[0];
  assertOwner(owner);
  return { host, owner };
}

function normalizeOutput(value) {
  return Buffer.isBuffer(value) ? value.toString("utf8") : String(value ?? "");
}

function runCommand(commandRunner, request, failureCode) {
  let result;
  try {
    result = commandRunner(request.command, request.args, {
      cwd: request.cwd,
      timeout: OWNER_AUTH_COMMAND_TIMEOUT_MS,
    });
  } catch {
    throw ownerAuthError(failureCode);
  }
  if (
    !result ||
    result.error ||
    result.signal ||
    result.status !== 0
  ) {
    throw ownerAuthError(failureCode);
  }
  return normalizeOutput(result.stdout).trim();
}

export async function runGitHubOwnerAuth({ commandRunner, owner, repoPath }) {
  assertOwner(owner);
  if (typeof repoPath !== "string" || repoPath.trim() === "") {
    throw ownerAuthError("REPOSITORY_PATH_REQUIRED");
  }
  if (typeof commandRunner !== "function") {
    throw ownerAuthError("COMMAND_RUNNER_REQUIRED");
  }

  const resolvedRepoPath = path.resolve(repoPath);
  const originUrl = runCommand(
    commandRunner,
    {
      command: "git",
      args: ["remote", "get-url", "origin"],
      cwd: resolvedRepoPath,
    },
    "ORIGIN_LOOKUP_FAILED",
  );
  const origin = parseGitHubOrigin(originUrl);
  if (origin.owner !== owner) {
    throw ownerAuthError("ORIGIN_OWNER_MISMATCH");
  }

  runCommand(
    commandRunner,
    {
      command: "gh",
      args: [
        "auth",
        "switch",
        "--hostname",
        origin.host,
        "--user",
        owner,
      ],
      cwd: resolvedRepoPath,
    },
    "OWNER_AUTH_SWITCH_FAILED",
  );
  const authenticatedLogin = runCommand(
    commandRunner,
    {
      command: "gh",
      args: [
        "api",
        "user",
        "--hostname",
        origin.host,
        "--jq",
        ".login",
      ],
      cwd: resolvedRepoPath,
    },
    "OWNER_AUTH_VERIFY_FAILED",
  );
  if (authenticatedLogin.toLowerCase() !== owner.toLowerCase()) {
    throw ownerAuthError("AUTHENTICATED_LOGIN_MISMATCH");
  }

  return {
    status: "OWNER_AUTHENTICATED",
    host: origin.host,
    owner,
    manualApprovalRequired: false,
  };
}
