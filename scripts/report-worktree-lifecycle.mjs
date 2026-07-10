import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { classifyWorktreeSnapshot } from "./lib/worktree-lifecycle.mjs";
import { extractRegistryDisplayHint } from "./lib/task-lifecycle-schema.mjs";

const READ_ONLY_OPERATIONS = new Set([
  "list-worktrees",
  "refs",
  "status",
  "ignored-status",
]);
const MAX_HINT_BYTES = 64 * 1024;
const REPORT_NOTICE = "review-only; deletion not authorized";

function reportError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

export function assertReadOnlyGitOperation(operation) {
  if (!READ_ONLY_OPERATIONS.has(operation)) {
    throw reportError("READ_ONLY_GIT_OPERATION_REQUIRED");
  }
}

export function gitInvocationFor({ operation, cwd }) {
  assertReadOnlyGitOperation(operation);
  if (typeof cwd !== "string" || cwd.length === 0) {
    throw reportError("GIT_CWD_REQUIRED");
  }
  const prefix = ["--no-optional-locks", "-C", cwd];
  let args;
  if (operation === "list-worktrees") {
    args = [...prefix, "worktree", "list", "--porcelain", "-z"];
  } else if (operation === "refs") {
    args = [
      ...prefix,
      "for-each-ref",
      "--format=%(refname)%00%(objectname)%00",
    ];
  } else if (operation === "status") {
    args = [
      ...prefix,
      "-c",
      "status.showUntrackedFiles=all",
      "status",
      "--porcelain=v2",
      "-z",
      "--untracked-files=all",
      "--ignore-submodules=none",
    ];
  } else {
    args = [
      ...prefix,
      "-c",
      "status.showUntrackedFiles=all",
      "status",
      "--porcelain=v1",
      "-z",
      "--ignored=matching",
      "--untracked-files=all",
      "--ignore-submodules=none",
    ];
  }
  return {
    command: "git",
    args,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    shell: false,
  };
}

function executeReadOnlyGit(request) {
  const invocation = gitInvocationFor(request);
  const output = spawnSync(invocation.command, invocation.args, {
    cwd: request.cwd,
    env: invocation.env,
    shell: invocation.shell,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    status: output.status ?? 1,
    stdout: output.stdout ?? "",
    stderr: output.stderr ?? "",
  };
}

function normalizeOutput(value) {
  return Buffer.isBuffer(value) ? value.toString("utf8") : String(value ?? "");
}

function cleanPath(value) {
  return value.replace(/\r?\n$/, "");
}

export function parseWorktreePorcelain(output) {
  const tokens = normalizeOutput(output).split("\0");
  const records = [];
  let current = null;
  const finish = () => {
    if (!current) return;
    records.push({
      worktreePath: current.worktreePath,
      headSha: current.headSha ?? null,
      branch: current.branch ?? null,
      detached: current.detached ?? false,
      bare: current.bare ?? false,
      locked: current.locked ?? false,
      lockReason: current.lockReason ?? null,
      prunable: current.prunable ?? false,
      prunableReason: current.prunableReason ?? null,
    });
    current = null;
  };

  for (const rawToken of tokens) {
    const token = cleanPath(rawToken);
    if (token === "") {
      finish();
      continue;
    }
    if (token.startsWith("worktree ")) {
      finish();
      current = { worktreePath: token.slice("worktree ".length) };
      continue;
    }
    if (!current) throw reportError("INVALID_WORKTREE_PORCELAIN");
    if (token.startsWith("HEAD ")) current.headSha = token.slice("HEAD ".length);
    else if (token.startsWith("branch refs/heads/")) {
      current.branch = token.slice("branch refs/heads/".length);
    } else if (token === "detached") current.detached = true;
    else if (token === "bare") current.bare = true;
    else if (token === "locked" || token.startsWith("locked ")) {
      current.locked = true;
      current.lockReason = token === "locked" ? null : token.slice("locked ".length);
    } else if (token === "prunable" || token.startsWith("prunable ")) {
      current.prunable = true;
      current.prunableReason = token === "prunable" ? null : token.slice("prunable ".length);
    } else throw reportError("INVALID_WORKTREE_PORCELAIN");
  }
  finish();
  if (records.some((record) => !record.worktreePath)) {
    throw reportError("INVALID_WORKTREE_PORCELAIN");
  }
  return records;
}

function pathFromStatusRecord(record, startIndex) {
  return cleanPath(record.split(" ").slice(startIndex).join(" "));
}

export function parseStatusPorcelainV2(output) {
  const tokens = normalizeOutput(output).split("\0");
  const trackedChanges = [];
  const untrackedFiles = [];
  let skipRenameSource = false;

  for (const rawToken of tokens) {
    if (skipRenameSource) {
      skipRenameSource = false;
      continue;
    }
    const token = cleanPath(rawToken);
    if (!token || token.startsWith("# ")) continue;
    if (token.startsWith("? ")) {
      untrackedFiles.push(cleanPath(token.slice(2)));
    } else if (token.startsWith("1 ")) {
      trackedChanges.push(pathFromStatusRecord(token, 8));
    } else if (token.startsWith("2 ")) {
      trackedChanges.push(pathFromStatusRecord(token, 9));
      skipRenameSource = true;
    } else if (token.startsWith("u ")) {
      trackedChanges.push(pathFromStatusRecord(token, 10));
    } else {
      throw reportError("INVALID_STATUS_PORCELAIN");
    }
  }
  return { trackedChanges, untrackedFiles };
}

export function parseIgnoredStatus(output) {
  const ignoredEntries = [];
  let skipRenameSource = false;
  for (const rawToken of normalizeOutput(output).split("\0")) {
    const token = cleanPath(rawToken);
    if (skipRenameSource) {
      if (!token) throw reportError("INVALID_IGNORED_PORCELAIN");
      skipRenameSource = false;
      continue;
    }
    if (!token) continue;
    if (token.startsWith("!! ")) {
      ignoredEntries.push(token.slice(3));
    } else if (!/^[ MADRCU?]{2} /.test(token)) {
      throw reportError("INVALID_IGNORED_PORCELAIN");
    } else if (/[RC]/.test(token.slice(0, 2))) {
      skipRenameSource = true;
    }
  }
  if (skipRenameSource) throw reportError("INVALID_IGNORED_PORCELAIN");
  return ignoredEntries;
}

function commandSucceeded(result) {
  return result?.status === 0 && normalizeOutput(result.stderr).trim() === "";
}

function comparablePath(value) {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function samePath(first, second) {
  return comparablePath(first) === comparablePath(second);
}

function stableSnapshot(firstWorktrees, secondWorktrees, firstRefs, secondRefs) {
  if (!commandSucceeded(firstRefs) || !commandSucceeded(secondRefs)) return false;
  if (normalizeOutput(firstRefs.stdout) !== normalizeOutput(secondRefs.stdout)) return false;
  if (firstWorktrees.length !== secondWorktrees.length) return false;
  const serialize = (records) =>
    records.map((record) => ({
      path: comparablePath(record.worktreePath),
      head: record.headSha,
      branch: record.branch,
      detached: record.detached,
      bare: record.bare,
      locked: record.locked,
      prunable: record.prunable,
    }));
  return JSON.stringify(serialize(firstWorktrees)) === JSON.stringify(serialize(secondWorktrees));
}

function hintForPath(registryHints, worktreePath) {
  return registryHints.find(
    (hint) => typeof hint?.worktreePath === "string" && samePath(hint.worktreePath, worktreePath),
  );
}

export function readCodexOwnerEvidence(worktreePath) {
  try {
    const dotGitPath = path.join(worktreePath, ".git");
    const dotGitStats = statSync(dotGitPath);
    if (!dotGitStats.isFile() || dotGitStats.size > 4096) return null;
    const dotGit = readFileSync(dotGitPath, "utf8").trim();
    if (!dotGit.startsWith("gitdir: ")) return null;
    const gitDirValue = dotGit.slice("gitdir: ".length);
    const gitDir = path.isAbsolute(gitDirValue)
      ? path.resolve(gitDirValue)
      : path.resolve(worktreePath, gitDirValue);
    const metadataPath = path.join(gitDir, "codex-thread.json");
    const metadataStats = statSync(metadataPath);
    if (!metadataStats.isFile() || metadataStats.size > 4096) return null;
    const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
    const keys = Object.keys(metadata).sort();
    if (
      keys.length !== 2 ||
      keys[0] !== "ownerThreadId" ||
      keys[1] !== "version" ||
      metadata.version !== 1 ||
      typeof metadata.ownerThreadId !== "string" ||
      metadata.ownerThreadId.length === 0 ||
      metadata.ownerThreadId.length > 256
    ) {
      return null;
    }
    return { owner: "codex-desktop", ownerEvidence: "task-metadata" };
  } catch {
    return null;
  }
}

function branchOwnership(worktrees, branch) {
  if (!branch) return "unknown";
  return worktrees.filter((worktree) => worktree.branch === branch).length === 1
    ? "exclusive"
    : "conflict";
}

function pathOwnership(worktrees, worktreePath) {
  return worktrees.filter((worktree) => samePath(worktree.worktreePath, worktreePath)).length === 1
    ? "exclusive"
    : "conflict";
}

export async function collectWorktreeInventory({
  repoRoot,
  currentPath = repoRoot,
  now = new Date().toISOString(),
  executeGit = executeReadOnlyGit,
  registryHints = [],
}) {
  let displayHints;
  try {
    displayHints = registryHints.map(extractRegistryDisplayHint);
  } catch {
    throw reportError("REGISTRY_HINT_INVALID");
  }
  const initialListResult = await executeGit({ operation: "list-worktrees", cwd: repoRoot });
  if (!commandSucceeded(initialListResult)) {
    throw reportError("WORKTREE_LIST_FAILED");
  }
  const initialRefsResult = await executeGit({ operation: "refs", cwd: repoRoot });
  const initialWorktrees = parseWorktreePorcelain(initialListResult.stdout);
  if (initialWorktrees.length === 0) throw reportError("WORKTREE_LIST_EMPTY");

  const firstInspections = [];
  for (const worktree of initialWorktrees) {
    firstInspections.push({
      status: await executeGit({
        operation: "status",
        cwd: worktree.worktreePath,
      }),
      ignored: await executeGit({
        operation: "ignored-status",
        cwd: worktree.worktreePath,
      }),
    });
  }
  const secondInspections = [];
  for (const worktree of initialWorktrees) {
    secondInspections.push({
      status: await executeGit({
        operation: "status",
        cwd: worktree.worktreePath,
      }),
      ignored: await executeGit({
        operation: "ignored-status",
        cwd: worktree.worktreePath,
      }),
    });
  }
  const inspectionStable = firstInspections.every((first, index) => {
    const second = secondInspections[index];
    return (
      commandSucceeded(first.status) &&
      commandSucceeded(second.status) &&
      normalizeOutput(first.status.stdout) === normalizeOutput(second.status.stdout) &&
      commandSucceeded(first.ignored) &&
      commandSucceeded(second.ignored) &&
      normalizeOutput(first.ignored.stdout) === normalizeOutput(second.ignored.stdout)
    );
  });

  const snapshots = [];
  for (const [index, worktree] of initialWorktrees.entries()) {
    const firstInspection = firstInspections[index];
    const secondInspection = secondInspections[index];
    let statusEvidence =
      commandSucceeded(firstInspection.status) &&
      commandSucceeded(secondInspection.status) &&
      normalizeOutput(firstInspection.status.stdout) ===
        normalizeOutput(secondInspection.status.stdout)
        ? "complete"
        : "failed";
    let ignoredEvidence =
      commandSucceeded(firstInspection.ignored) &&
      commandSucceeded(secondInspection.ignored) &&
      normalizeOutput(firstInspection.ignored.stdout) ===
        normalizeOutput(secondInspection.ignored.stdout)
        ? "complete"
        : "failed";
    let status = { trackedChanges: [], untrackedFiles: [] };
    let ignoredEntries = [];
    if (statusEvidence === "complete") {
      try {
        status = parseStatusPorcelainV2(secondInspection.status.stdout);
      } catch {
        statusEvidence = "failed";
      }
    }
    if (ignoredEvidence === "complete") {
      try {
        ignoredEntries = parseIgnoredStatus(secondInspection.ignored.stdout);
      } catch {
        ignoredEvidence = "failed";
      }
    }

    const hint = hintForPath(displayHints, worktree.worktreePath);
    const codexOwner = readCodexOwnerEvidence(worktree.worktreePath);
    const isBaseCheckout = index === 0;
    const isCurrent = samePath(worktree.worktreePath, currentPath);
    const owner =
      codexOwner?.owner ??
      hint?.owner ??
      (isBaseCheckout ? "baseline-checkout" : isCurrent ? "current-task" : null);
    const ownerEvidence =
      codexOwner?.ownerEvidence ??
      (hint
        ? "registry-hint"
        : isBaseCheckout
          ? "baseline-checkout"
          : isCurrent
            ? "current-process"
            : "unknown");

    snapshots.push({
      worktreePath: worktree.worktreePath,
      branch: worktree.branch,
      headSha: worktree.headSha,
      detached: worktree.detached,
      isCurrent,
      isBaseCheckout,
      owner,
      ownerEvidence,
      statusEvidence,
      ignoredEvidence,
      trackedChanges: status.trackedChanges,
      untrackedFiles: status.untrackedFiles,
      ignoredEntries,
      branchOwnership: branchOwnership(initialWorktrees, worktree.branch),
      pathOwnership: pathOwnership(initialWorktrees, worktree.worktreePath),
      worktreeFlags: {
        bare: worktree.bare,
        locked: worktree.locked,
        prunable: worktree.prunable,
      },
      pullRequestHint: hint?.pullRequestHint ?? null,
      livePullRequestEvidence: null,
      publishedHeadSha: hint?.publishedHeadSha ?? null,
      processState: "unknown",
      portState: "unknown",
      fileLockState: "unknown",
      snapshotStable: false,
    });
  }

  const finalListResult = await executeGit({ operation: "list-worktrees", cwd: repoRoot });
  const finalRefsResult = await executeGit({ operation: "refs", cwd: repoRoot });
  let finalWorktrees = [];
  if (commandSucceeded(finalListResult)) {
    try {
      finalWorktrees = parseWorktreePorcelain(finalListResult.stdout);
    } catch {
      finalWorktrees = [];
    }
  }
  const snapshotStable =
    inspectionStable &&
    commandSucceeded(initialRefsResult) &&
    commandSucceeded(finalListResult) &&
    stableSnapshot(
      initialWorktrees,
      finalWorktrees,
      initialRefsResult,
      finalRefsResult,
    );

  const entries = snapshots.map((snapshot) => {
    const stableSnapshotEntry = { ...snapshot, snapshotStable };
    return {
      ...stableSnapshotEntry,
      ...classifyWorktreeSnapshot(stableSnapshotEntry, { now }),
    };
  });

  return {
    schemaVersion: 1,
    mode: "report",
    generatedAt: now,
    repository: repoRoot,
    snapshotStable,
    cleanupReady: false,
    deletionAuthorized: false,
    notice: REPORT_NOTICE,
    entries,
  };
}

function markdownCell(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replaceAll("`", "'")
    .replaceAll("|", "\\|");
}

export function renderInventoryMarkdown(inventory) {
  const counts = inventory.entries.reduce((summary, entry) => {
    summary[entry.disposition] = (summary[entry.disposition] ?? 0) + 1;
    return summary;
  }, {});
  const lines = [
    "# Worktree Lifecycle Report",
    "",
    `- Mode: \`${markdownCell(inventory.mode)}\``,
    `- Generated: ${markdownCell(inventory.generatedAt)}`,
    `- Repository: \`${markdownCell(inventory.repository)}\``,
    `- Snapshot stable: \`${inventory.snapshotStable}\``,
    `- cleanupReady: \`${inventory.cleanupReady}\``,
    `- deletionAuthorized: \`${inventory.deletionAuthorized}\``,
    `- Notice: ${markdownCell(inventory.notice)}`,
    `- Counts: ${Object.entries(counts)
      .map(([key, value]) => `${markdownCell(key)}=${value}`)
      .join(", ")}`,
    "",
    "| Worktree | Branch | Owner | Disposition | Reasons |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const entry of inventory.entries) {
    lines.push(
      `| \`${markdownCell(entry.worktreePath)}\` | \`${markdownCell(entry.branch ?? "detached")}\` | ${markdownCell(entry.owner)} | ${entry.disposition} | ${markdownCell(entry.reasons.join(", "))} |`,
    );
  }
  lines.push("", "## Preservation and next review checks", "");
  for (const entry of inventory.entries) {
    lines.push(`### \`${markdownCell(entry.worktreePath)}\``, "");
    lines.push(`- Owner: ${markdownCell(entry.owner)}`);
    lines.push(`- cleanupReady: ${entry.cleanupReady}`);
    lines.push(`- deletionAuthorized: ${entry.deletionAuthorized}`);
    lines.push(
      `- Preserve: ${markdownCell(entry.preserveReasons.join("; ") || "none recorded")}`,
    );
    lines.push(
      `- Next review: ${markdownCell(entry.nextReviewChecks.join("; ") || "none recorded")}`,
      "",
    );
  }
  return `${lines.join("\n")}\n`;
}

export function renderInventoryJson(inventory) {
  return `${JSON.stringify(inventory, null, 2)}\n`;
}

function readRegistryHints(registryRoot) {
  if (!registryRoot) return [];
  if (!existsSync(registryRoot)) throw reportError("REGISTRY_HINT_ROOT_MISSING");
  const candidates = [];
  for (const entry of readdirSync(registryRoot, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".json")) {
      candidates.push(path.join(registryRoot, entry.name));
    } else if (entry.isDirectory()) {
      for (const child of readdirSync(path.join(registryRoot, entry.name), {
        withFileTypes: true,
      })) {
        if (child.isFile() && child.name.endsWith(".json")) {
          candidates.push(path.join(registryRoot, entry.name, child.name));
        }
      }
    }
  }
  return candidates.map((filePath) => {
    const fileStats = statSync(filePath);
    if (!fileStats.isFile() || fileStats.size > MAX_HINT_BYTES) {
      throw reportError("REGISTRY_HINT_INVALID");
    }
    try {
      return JSON.parse(readFileSync(filePath, "utf8"));
    } catch {
      throw reportError("REGISTRY_HINT_INVALID");
    }
  });
}

function parseArguments(argv) {
  const options = { repo: process.cwd(), format: "markdown", registryRoot: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--repo") options.repo = argv[++index];
    else if (arg === "--format") options.format = argv[++index];
    else if (arg === "--registry-root") options.registryRoot = argv[++index];
    else throw reportError("UNKNOWN_ARGUMENT");
  }
  if (!options.repo || !["markdown", "json"].includes(options.format)) {
    throw reportError("INVALID_ARGUMENT");
  }
  return options;
}

async function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    const inventory = await collectWorktreeInventory({
      repoRoot: path.resolve(options.repo),
      currentPath: process.cwd(),
      registryHints: readRegistryHints(options.registryRoot),
    });
    process.stdout.write(
      options.format === "json"
        ? renderInventoryJson(inventory)
        : renderInventoryMarkdown(inventory),
    );
  } catch (error) {
    process.stderr.write(`worktree lifecycle report failed: ${error?.code ?? "UNKNOWN_ERROR"}\n`);
    process.exitCode = 1;
  }
}

const isMain =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) await main();
