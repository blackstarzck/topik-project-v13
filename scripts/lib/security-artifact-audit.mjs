import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, realpathSync } from "node:fs";
import path from "node:path";

const COMMAND_TIMEOUT_MS = 10_000;
const COMMAND_MAX_BUFFER_BYTES = 8 * 1024 * 1024;
const DEFAULT_REFS = Object.freeze(["origin/main", "collab/main"]);
const DEFAULT_EVIDENCE_ALLOWLIST = Object.freeze([]);
const DEFAULT_ROOT_IMAGE_ALLOWLIST = Object.freeze([]);
const REF_PATTERN =
  /^(?!-)(?!.*(?:\.\.|@\{|\/\/|[~^:?*[\]\\\s]))[A-Za-z0-9][A-Za-z0-9._/-]*[A-Za-z0-9]$/u;
const ROOT_TEMP_EXTENSION = /\.(?:bak|log|pid|temp|tmp)$/iu;
const IMAGE_EXTENSION = /\.(?:avif|bmp|gif|ico|jpe?g|png|svg|tiff?|webp)$/iu;
const QA_UI_EVIDENCE_EXTENSION = /\.(?:jpe?g|png|webp)$/iu;
const STATIC_ASSET_EXTENSION =
  /\.(?:avif|bmp|gif|ico|jpe?g|mp3|mp4|otf|pdf|png|svg|tiff?|ttf|wav|webm|webp|woff2?)$/iu;
const SCRIPT_EXTENSION = /\.(?:bat|cjs|cmd|cts|js|mjs|mts|ps1|py|sh|ts)$/iu;
const TEMPORARY_SCRIPT_MARKER =
  /(?:^|[-_.])(?:debug|experiment|one-off|scratch|temp|temporary|tmp)(?:[-_.]|$)/iu;

function auditError(code) {
  return Object.assign(new Error(code), { code });
}

function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function normalizedAbsolute(value) {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function assertRepositoryPath(repoPath) {
  if (typeof repoPath !== "string" || repoPath.length === 0) {
    throw auditError("REPOSITORY_PATH_INVALID");
  }
  const resolved = path.resolve(repoPath);
  let status;
  let realPath;
  try {
    status = lstatSync(resolved);
    realPath = realpathSync.native(resolved);
  } catch {
    throw auditError("REPOSITORY_PATH_INVALID");
  }
  if (
    status.isSymbolicLink() ||
    normalizedAbsolute(realPath) !== normalizedAbsolute(resolved)
  ) {
    throw auditError("REPOSITORY_PATH_SYMLINK");
  }
  if (!status.isDirectory()) {
    throw auditError("REPOSITORY_PATH_INVALID");
  }
  return realPath;
}

function commandOptions(cwd) {
  return {
    cwd,
    encoding: "buffer",
    env: {},
    maxBuffer: COMMAND_MAX_BUFFER_BYTES,
    shell: false,
    timeout: COMMAND_TIMEOUT_MS,
    windowsHide: true,
  };
}

export function executeSecurityArtifactCommand(command, args, options) {
  return spawnSync(command, args, options);
}

function runGit(commandRunner, cwd, args, failureCode) {
  let result;
  try {
    result = commandRunner("git", args, commandOptions(cwd));
  } catch {
    throw auditError(failureCode);
  }
  if (result?.status !== 0 || result.error || result.signal) {
    throw auditError(failureCode);
  }
  return Buffer.isBuffer(result.stdout)
    ? result.stdout
    : Buffer.from(result.stdout ?? "", "utf8");
}

function decodeUtf8(buffer, failureCode) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw auditError(failureCode);
  }
}

function unsafeTreePath(relativePath) {
  if (
    typeof relativePath !== "string" ||
    relativePath.length === 0 ||
    relativePath.includes("\\") ||
    path.posix.isAbsolute(relativePath) ||
    /^[A-Za-z]:/u.test(relativePath)
  ) {
    return true;
  }
  const segments = relativePath.split("/");
  return (
    segments.some(
      (segment) => segment.length === 0 || segment === "." || segment === "..",
    ) || path.posix.normalize(relativePath) !== relativePath
  );
}

function treePaths(buffer) {
  const decoded = decodeUtf8(buffer, "TREE_PATH_INVALID");
  const paths = decoded.split("\0");
  if (paths.at(-1) === "") paths.pop();
  if (paths.some(unsafeTreePath)) {
    throw auditError("TREE_PATH_INVALID");
  }
  return paths;
}

function historyPathEvidence(buffer) {
  const tokens = decodeUtf8(buffer, "HISTORY_PATH_INVALID").split("\0");
  const evidenceByPath = new Map();
  let currentCommit = null;
  let expectsPath = false;
  let scannedPathCount = 0;

  for (const token of tokens) {
    if (token.length === 0) continue;
    const commitMatch = /^COMMIT:([0-9a-f]{40}|[0-9a-f]{64})$/iu.exec(token);
    if (commitMatch !== null && !expectsPath) {
      currentCommit = commitMatch[1];
      continue;
    }
    if (!expectsPath) {
      const metadata = token.startsWith("\n:") ? token.slice(1) : token;
      if (currentCommit === null || !metadata.startsWith(":")) {
        throw auditError("HISTORY_PATH_INVALID");
      }
      expectsPath = true;
      continue;
    }
    if (unsafeTreePath(token)) {
      throw auditError("HISTORY_PATH_INVALID");
    }
    const commitHashes = evidenceByPath.get(token) ?? new Set();
    commitHashes.add(sha256(currentCommit));
    evidenceByPath.set(token, commitHashes);
    scannedPathCount += 1;
    expectsPath = false;
  }
  if (expectsPath) {
    throw auditError("HISTORY_PATH_INVALID");
  }
  return { evidenceByPath, scannedPathCount };
}

function validateRefs(refs) {
  if (
    !Array.isArray(refs) ||
    refs.length === 0 ||
    refs.some(
      (ref) =>
        typeof ref !== "string" ||
        ref.length > 255 ||
        !REF_PATTERN.test(ref) ||
        ref.endsWith(".") ||
        ref.endsWith("/") ||
        ref.includes("/."),
    )
  ) {
    throw auditError("REF_INVALID");
  }
  const normalized = [...new Set(refs)].sort(compareText);
  if (normalized.length !== refs.length) {
    throw auditError("REF_INVALID");
  }
  return normalized;
}

function validateRootImageAllowlist(entries) {
  if (
    !Array.isArray(entries) ||
    entries.some(
      (entry) =>
        typeof entry !== "string" ||
        entry.length === 0 ||
        entry.includes("/") ||
        entry.includes("\\") ||
        !IMAGE_EXTENSION.test(entry),
    )
  ) {
    throw auditError("ROOT_IMAGE_ALLOWLIST_INVALID");
  }
  const normalized = entries.map((entry) => entry.toLowerCase());
  if (new Set(normalized).size !== normalized.length) {
    throw auditError("ROOT_IMAGE_ALLOWLIST_INVALID");
  }
  return new Set(normalized);
}

function validateEvidenceAllowlist(entries) {
  if (
    !Array.isArray(entries) ||
    entries.some(
      (entry) =>
        typeof entry !== "string" ||
        unsafeTreePath(entry) ||
        !entry.toLowerCase().startsWith("docs/qa/reports/") ||
        !QA_UI_EVIDENCE_EXTENSION.test(entry),
    )
  ) {
    throw auditError("EVIDENCE_ALLOWLIST_INVALID");
  }
  const normalized = entries.map((entry) => entry.toLowerCase());
  if (new Set(normalized).size !== normalized.length) {
    throw auditError("EVIDENCE_ALLOWLIST_INVALID");
  }
  return new Set(normalized);
}

function matchingRule(
  relativePath,
  rootImageAllowlist,
  evidenceAllowlist,
) {
  const lower = relativePath.toLowerCase();
  const segments = lower.split("/");
  const basename = segments.at(-1);
  const directorySegments = segments.slice(0, -1);
  const isQaReport = lower.startsWith("docs/qa/reports/");
  const isStaticAsset =
    lower.startsWith("public/") || lower.startsWith("src/assets/");
  if (/^\.env(?:\.|$)/iu.test(basename)) return "TRACKED_ENV_FILE";
  if (directorySegments.includes(".scratch")) return "TRACKED_SCRATCH_PATH";
  if (directorySegments.includes(".tmp")) return "TRACKED_TMP_PATH";
  if (directorySegments.includes("artifacts")) return "TRACKED_ARTIFACT_PATH";
  if (ROOT_TEMP_EXTENSION.test(relativePath)) return "ROOT_TEMP_FILE";
  if (/^supabase\/migrations\/[^/]+\.sql$/u.test(lower)) return null;
  if (/\.sql$/iu.test(relativePath)) return "UNAPPROVED_SQL_PATH";
  if (
    SCRIPT_EXTENSION.test(relativePath) &&
    (isQaReport || TEMPORARY_SCRIPT_MARKER.test(basename))
  ) {
    return "TEMPORARY_SCRIPT_PATH";
  }
  if (evidenceAllowlist.has(lower)) return null;
  if (isQaReport && QA_UI_EVIDENCE_EXTENSION.test(relativePath)) return null;
  if (isStaticAsset && STATIC_ASSET_EXTENSION.test(relativePath)) return null;
  if (
    directorySegments.some((segment) =>
      new Set(["screenshot", "screenshots"]).has(segment),
    ) ||
    /(?:^|[-_.])screenshot(?:[-_.]|$)/iu.test(basename)
  ) {
    return "INTERMEDIATE_SCREENSHOT_PATH";
  }
  if (
    IMAGE_EXTENSION.test(relativePath) &&
    (relativePath.includes("/") || !rootImageAllowlist.has(lower))
  ) {
    return "ROOT_IMAGE_NOT_ALLOWLISTED";
  }
  return null;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertRepositoryRoot(commandRunner, repoPath) {
  const rootOutput = runGit(
    commandRunner,
    repoPath,
    ["rev-parse", "--show-toplevel"],
    "REPOSITORY_LOOKUP_FAILED",
  );
  const rootPath = decodeUtf8(rootOutput, "REPOSITORY_LOOKUP_FAILED").trim();
  if (
    rootPath.length === 0 ||
    normalizedAbsolute(rootPath) !== normalizedAbsolute(repoPath)
  ) {
    throw auditError("REPOSITORY_PATH_ESCAPE");
  }
}

function resolveRef(commandRunner, repoPath, ref) {
  const output = runGit(
    commandRunner,
    repoPath,
    ["rev-parse", "--verify", `${ref}^{commit}`],
    "REF_LOOKUP_FAILED",
  );
  const resolved = decodeUtf8(output, "REF_LOOKUP_FAILED").trim();
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/iu.test(resolved)) {
    throw auditError("REF_LOOKUP_FAILED");
  }
  return resolved;
}

export function auditSecurityArtifacts({
  evidenceAllowlist = DEFAULT_EVIDENCE_ALLOWLIST,
  repoPath,
  refs = DEFAULT_REFS,
  rootImageAllowlist = DEFAULT_ROOT_IMAGE_ALLOWLIST,
  commandRunner = executeSecurityArtifactCommand,
} = {}) {
  const repositoryRoot = assertRepositoryPath(repoPath);
  const auditedRefs = validateRefs(refs);
  const allowedEvidence = validateEvidenceAllowlist(evidenceAllowlist);
  const allowedRootImages = validateRootImageAllowlist(rootImageAllowlist);
  assertRepositoryRoot(commandRunner, repositoryRoot);

  const candidates = [];
  const snapshots = [];
  let scannedPathCount = 0;
  for (const ref of auditedRefs) {
    const resolvedRef = resolveRef(commandRunner, repositoryRoot, ref);
    snapshots.push({
      ref,
      commitHash: sha256(resolvedRef),
    });
    const tipInventory = treePaths(
      runGit(
        commandRunner,
        repositoryRoot,
        ["ls-tree", "-r", "-z", "--name-only", resolvedRef],
        "REF_LOOKUP_FAILED",
      ),
    );
    const historyEvidence = historyPathEvidence(
      runGit(
        commandRunner,
        repositoryRoot,
        [
          "log",
          "--format=COMMIT:%H%x00",
          "--raw",
          "-z",
          "--no-renames",
          "--root",
          "-m",
          resolvedRef,
          "--",
        ],
        "HISTORY_LOOKUP_FAILED",
      ),
    );
    scannedPathCount += historyEvidence.scannedPathCount;
    const auditedPaths = new Set([
      ...tipInventory,
      ...historyEvidence.evidenceByPath.keys(),
    ]);
    for (const relativePath of auditedPaths) {
      const rule = matchingRule(
        relativePath,
        allowedRootImages,
        allowedEvidence,
      );
      if (rule !== null) {
        const commitHashes = [
          ...(historyEvidence.evidenceByPath.get(relativePath) ?? []),
        ].sort(compareText);
        if (commitHashes.length === 0) {
          throw auditError("HISTORY_PATH_INVALID");
        }
        candidates.push({
          ref,
          path: relativePath,
          rule,
          historyCommitCount: commitHashes.length,
          commitHashes,
        });
      }
    }
  }

  const findings = candidates
    .map((candidate) => ({
      ...candidate,
      pathHash: sha256(candidate.path),
    }))
    .sort((left, right) =>
      compareText(
        `${left.ref}\0${left.path}\0${left.rule}`,
        `${right.ref}\0${right.path}\0${right.rule}`,
      ),
    );
  const payload = {
    schemaVersion: 1,
    recordType: "SecurityArtifactAuditV1",
    refs: auditedRefs,
    snapshots: snapshots.sort((left, right) =>
      compareText(left.ref, right.ref),
    ),
    findings,
    summary: {
      refCount: auditedRefs.length,
      scannedPathCount,
      findingCount: findings.length,
    },
  };
  return {
    ...payload,
    fingerprint: sha256(JSON.stringify(payload)),
  };
}
