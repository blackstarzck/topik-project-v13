import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { validateArtifactManifestV2 } from "./artifact-manifest-v2.mjs";

const DEFAULT_POLICY_PATH = "config/artifact-hygiene-policy.json";
const WORK_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const EVIDENCE_FOLDER = /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function git(rootDir, args) {
  return spawnSync("git", args, {
    cwd: rootDir,
    encoding: "buffer",
    windowsHide: true,
  });
}

function zPaths(buffer) {
  return buffer
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((entry) => entry.replaceAll("\\", "/"));
}

function normalizedAbsolute(value) {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function isLinkOrReparse(target) {
  try {
    const status = lstatSync(target);
    if (status.isSymbolicLink()) return true;
    return normalizedAbsolute(realpathSync.native(target)) !== normalizedAbsolute(target);
  } catch {
    return true;
  }
}

function unsafePathSegment(relativePath) {
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
    segments.some((segment) => segment === "" || segment === "." || segment === "..") ||
    path.posix.normalize(relativePath) !== relativePath
  );
}

function addedPath(relativePath, basePaths) {
  return !basePaths.has(relativePath);
}

function ephemeralPath(relativePath) {
  const lower = relativePath.toLowerCase();
  const segments = lower.split("/");
  const basename = segments.at(-1);
  return (
    /\.(?:log|pid|tmp|temp|trace)$/u.test(basename) ||
    /(?:^|[-_.])screenshot(?:[-_.]|$)/u.test(basename) ||
    segments.some((segment) => ["screenshot", "screenshots", "tmp", "temp"].includes(segment))
  );
}

function evidenceLikePath(relativePath) {
  return /\.(?:png|jpe?g|gif|webp|svg|mp4|mov|webm|html?|pdf|trace|har|zip)$/iu.test(relativePath);
}

function scriptApprovalRequired(relativePath, indexMode) {
  const lower = relativePath.toLowerCase();
  const standardSource = lower.startsWith("src/") || lower.startsWith("tests/");
  const suspicious = /(?:^|[/_.-])(?:one-off|debug|experiment|experimental|temp|temporary|investigation)(?:[/_.-]|$)/u.test(lower);
  const shellScript = /\.(?:ps1|sh|cmd|bat)$/u.test(lower);
  const programScript = /\.(?:js|mjs|cjs|ts|mts|cts)$/u.test(lower);
  return lower.startsWith("scripts/") || shellScript || indexMode === "100755" || suspicious || (programScript && !standardSource);
}

function inspectPathSafety(rootDir, relativePath, addViolation) {
  if (unsafePathSegment(relativePath)) {
    addViolation("PATH_UNSAFE", relativePath);
    return;
  }
  const segments = relativePath.split("/");
  let target = rootDir;
  for (const segment of segments) {
    target = path.join(target, segment);
    if (!existsSync(target)) return;
    if (isLinkOrReparse(target)) {
      addViolation("PATH_LINK_OR_REPARSE", relativePath);
      return;
    }
  }
}

function validatePolicy(policy, policyLabel, addViolation) {
  if (
    policy?.schemaVersion !== 1 ||
    policy?.kind !== "ArtifactHygienePolicy" ||
    !Array.isArray(policy.rootAllowlist) ||
    !Array.isArray(policy.legacyOnlyRoots) ||
    !Array.isArray(policy.approvedProductionPaths)
  ) {
    addViolation("POLICY_INVALID", policyLabel);
    return undefined;
  }
  const allEntries = [...policy.rootAllowlist, ...policy.legacyOnlyRoots];
  if (
    allEntries.some(
      (entry) =>
        typeof entry !== "string" ||
        entry.length === 0 ||
        entry.includes("/") ||
        entry.includes("\\") ||
        entry === "." ||
        entry === "..",
    )
  ) {
    addViolation("POLICY_INVALID", policyLabel);
    return undefined;
  }
  const allowlistLower = policy.rootAllowlist.map((entry) => entry.toLowerCase());
  const legacyLower = policy.legacyOnlyRoots.map((entry) => entry.toLowerCase());
  if (
    new Set(allowlistLower).size !== allowlistLower.length ||
    new Set(legacyLower).size !== legacyLower.length ||
    policy.legacyOnlyRoots.some(
      (entry) => !allowlistLower.includes(entry.toLowerCase()),
    )
  ) {
    addViolation("POLICY_CASE_COLLISION", policyLabel);
    return undefined;
  }
  const productionLower = policy.approvedProductionPaths.map((entry) =>
    String(entry).toLowerCase(),
  );
  if (
    policy.approvedProductionPaths.some(
      (entry) =>
        typeof entry !== "string" ||
        unsafePathSegment(entry) ||
        false,
    ) ||
    new Set(productionLower).size !== productionLower.length
  ) {
    addViolation("POLICY_INVALID", policyLabel);
    return undefined;
  }
  return policy;
}

function readPolicy(rootDir, policyPath, addViolation) {
  const relativePolicy = policyPath.replaceAll("\\", "/");
  if (unsafePathSegment(relativePolicy)) {
    addViolation("POLICY_PATH_UNSAFE", relativePolicy);
    return undefined;
  }
  const target = path.join(rootDir, ...relativePolicy.split("/"));
  if (!existsSync(target) || isLinkOrReparse(target)) {
    addViolation("POLICY_UNAVAILABLE", relativePolicy);
    return undefined;
  }
  let policy;
  try {
    policy = JSON.parse(readFileSync(target, "utf8"));
  } catch {
    addViolation("POLICY_INVALID", relativePolicy);
    return undefined;
  }
  return validatePolicy(policy, relativePolicy, addViolation);
}

function policyExpands(workspacePolicy, trustedPolicy) {
  return ["rootAllowlist", "legacyOnlyRoots", "approvedProductionPaths"].some(
    (field) => {
      const trusted = new Set(trustedPolicy[field].map((entry) => entry.toLowerCase()));
      return workspacePolicy[field].some(
        (entry) => !trusted.has(entry.toLowerCase()),
      );
    },
  );
}

function readManifest(rootDir, folderPath, newEvidence, addViolation) {
  const approvedEvidence = new Set();
  const manifestRelative = `${folderPath}/artifact-manifest.json`;
  const manifestTarget = path.join(rootDir, ...manifestRelative.split("/"));
  if (!existsSync(manifestTarget)) {
    for (const evidencePath of newEvidence) {
      addViolation("EVIDENCE_MANIFEST_MISSING", evidencePath);
    }
    return approvedEvidence;
  }
  if (isLinkOrReparse(manifestTarget) || !lstatSync(manifestTarget).isFile()) {
    addViolation("EVIDENCE_MANIFEST_INVALID", manifestRelative);
    return approvedEvidence;
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestTarget, "utf8"));
  } catch {
    addViolation("EVIDENCE_MANIFEST_INVALID", manifestRelative);
    return approvedEvidence;
  }
  const folderSlug = folderPath.split("/").at(-1).slice(11);
  if (validateArtifactManifestV2(manifest, { folderSlug }).length > 0) {
    addViolation("EVIDENCE_MANIFEST_INVALID", manifestRelative);
    return approvedEvidence;
  }

  const entries = new Map();
  const lowerEntries = new Map();
  for (const entry of manifest.files) {
    const artifactPath = entry?.path;
    if (
      unsafePathSegment(artifactPath)
    ) {
      addViolation("MANIFEST_PATH_UNSAFE", String(artifactPath ?? "<missing>"));
      continue;
    }
    const lower = artifactPath.toLowerCase();
    if (lowerEntries.has(lower)) {
      addViolation("MANIFEST_CASE_COLLISION", artifactPath);
      continue;
    }
    lowerEntries.set(lower, artifactPath);
    entries.set(artifactPath, entry);
  }

  for (const [artifactPath, entry] of entries) {
    const relativePath = `${folderPath}/${artifactPath}`;
    const target = path.join(rootDir, ...relativePath.split("/"));
    if (
      !existsSync(target) ||
      isLinkOrReparse(target) ||
      !lstatSync(target).isFile()
    ) {
      addViolation("MANIFEST_FILE_NOT_REGULAR", relativePath);
      continue;
    }
    const actualHash = createHash("sha256").update(readFileSync(target)).digest("hex");
    if (actualHash !== entry.sha256) {
      addViolation("MANIFEST_HASH_MISMATCH", relativePath);
    } else {
      approvedEvidence.add(relativePath);
    }
  }

  for (const relativePath of newEvidence) {
    const localPath = relativePath.slice(folderPath.length + 1);
    if (!entries.has(localPath)) {
      addViolation("EVIDENCE_FILE_UNREGISTERED", relativePath);
    }
  }
  return approvedEvidence;
}

function inspectEvidence(rootDir, candidates, basePaths, addViolation) {
  const approvedEvidence = new Set();
  const prefix = "docs/qa/reports/";
  const grouped = new Map();
  for (const relativePath of candidates) {
    if (!relativePath.startsWith(prefix) || !addedPath(relativePath, basePaths)) continue;
    const suffix = relativePath.slice(prefix.length);
    const segments = suffix.split("/");
    if (segments.length === 1) {
      if (!relativePath.toLowerCase().endsWith(".md")) {
        addViolation("EVIDENCE_LOCATION_INVALID", relativePath);
      }
      continue;
    }
    const folder = segments[0];
    if (!EVIDENCE_FOLDER.test(folder)) {
      addViolation("EVIDENCE_LOCATION_INVALID", relativePath);
      continue;
    }
    if (segments.slice(1).join("/") === "artifact-manifest.json") {
      continue;
    }
    const folderPath = `${prefix}${folder}`;
    const paths = grouped.get(folderPath) ?? [];
    paths.push(relativePath);
    grouped.set(folderPath, paths);
  }
  for (const [folderPath, newEvidence] of grouped) {
    for (const relativePath of readManifest(
      rootDir,
      folderPath,
      newEvidence,
      addViolation,
    )) {
      approvedEvidence.add(relativePath);
    }
  }
  return approvedEvidence;
}

export function evaluateArtifactHygiene({
  rootDir = process.cwd(),
  baseRef = process.env.ARTIFACT_HYGIENE_BASE_REF || "origin/main",
  policyPath = DEFAULT_POLICY_PATH,
  trustedPolicy,
} = {}) {
  const violations = [];
  const seenViolations = new Set();
  const addViolation = (code, violationPath) => {
    const safePath = String(violationPath).replaceAll("\\", "/");
    const key = `${code}\0${safePath}`;
    if (!seenViolations.has(key)) {
      seenViolations.add(key);
      violations.push({ code, path: safePath });
    }
  };
  const resolvedRoot = path.resolve(rootDir);
  const workspacePolicy = readPolicy(resolvedRoot, policyPath, addViolation);
  const policy = trustedPolicy
    ? validatePolicy(trustedPolicy, "<trusted-base-policy>", addViolation)
    : workspacePolicy;
  if (
    workspacePolicy &&
    policy &&
    trustedPolicy &&
    policyExpands(workspacePolicy, policy)
  ) {
    addViolation("POLICY_EXPANSION_UNTRUSTED", policyPath);
  }
  if (!policy) {
    return { ok: false, baseRef, violations };
  }
  if (
    typeof baseRef !== "string" ||
    (baseRef !== "origin/main" && !/^[0-9a-f]{40}$/iu.test(baseRef))
  ) {
    addViolation("BASE_REF_INVALID", "<invalid>");
    return { ok: false, baseRef: "<invalid>", violations };
  }

  const resolvedBase = git(resolvedRoot, ["rev-parse", "--verify", `${baseRef}^{commit}`]);
  if (resolvedBase.status !== 0) {
    addViolation("BASE_REF_INVALID", "<unresolved>");
    return { ok: false, baseRef: "<unresolved>", violations };
  }
  const baseSha = resolvedBase.stdout.toString("utf8").trim();
  const baseInventory = git(resolvedRoot, [
    "ls-tree",
    "-r",
    "-z",
    "--name-only",
    baseSha,
  ]);
  const candidateInventory = git(resolvedRoot, [
    "ls-files",
    "-z",
    "--cached",
    "--others",
    "--exclude-standard",
  ]);
  const indexInventory = git(resolvedRoot, ["ls-files", "-s", "-z"]);
  if (baseInventory.status !== 0 || candidateInventory.status !== 0 || indexInventory.status !== 0) {
    addViolation("GIT_INVENTORY_FAILED", ".");
    return { ok: false, baseRef, baseSha, violations };
  }
  const basePaths = new Set(zPaths(baseInventory.stdout));
  const candidates = zPaths(candidateInventory.stdout);
  const indexModes = new Map(
    zPaths(indexInventory.stdout).map((entry) => {
      const match = /^(\d+) [a-f0-9]+ \d+\t(.+)$/u.exec(entry);
      return match ? [match[2], match[1]] : [entry, ""];
    }),
  );
  const allowlist = new Set(policy.rootAllowlist.map((entry) => entry.toLowerCase()));
  const canonicalRoots = new Map(
    policy.rootAllowlist.map((entry) => [entry.toLowerCase(), entry]),
  );
  const legacyRoots = new Set(policy.legacyOnlyRoots.map((entry) => entry.toLowerCase()));
  const approvedProductionPaths = new Set(policy.approvedProductionPaths);
  const approvedEvidence = inspectEvidence(
    resolvedRoot,
    candidates,
    basePaths,
    addViolation,
  );
  const legacyDiff = git(resolvedRoot, [
    "diff",
    "--name-status",
    "-z",
    "--no-renames",
    baseSha,
    "--",
    ...policy.legacyOnlyRoots,
  ]);
  if (legacyDiff.status !== 0) {
    addViolation("GIT_INVENTORY_FAILED", "<legacy-diff>");
  }
  const legacyChanges = zPaths(legacyDiff.stdout);
  for (let index = 0; index + 1 < legacyChanges.length; index += 2) {
    const status = legacyChanges[index];
    const changedPath = legacyChanges[index + 1];
    if (status !== "D" && basePaths.has(changedPath)) {
      addViolation("LEGACY_PATH_MODIFIED", changedPath);
    }
  }

  const candidateByLower = new Map();
  for (const relativePath of candidates) {
    const lower = relativePath.toLowerCase();
    const prior = candidateByLower.get(lower);
    if (prior && prior !== relativePath) {
      addViolation("PATH_CASE_COLLISION", relativePath);
    } else {
      candidateByLower.set(lower, relativePath);
    }
  }
  const baseByLower = new Map([...basePaths].map((entry) => [entry.toLowerCase(), entry]));

  const reportedRoots = new Set();
  for (const relativePath of candidates) {
    inspectPathSafety(resolvedRoot, relativePath, addViolation);
    const rootEntry = relativePath.split("/")[0];
    if (!allowlist.has(rootEntry.toLowerCase()) && !reportedRoots.has(rootEntry.toLowerCase())) {
      reportedRoots.add(rootEntry.toLowerCase());
      addViolation("ROOT_ENTRY_NOT_ALLOWED", rootEntry);
    }
    const canonicalRoot = canonicalRoots.get(rootEntry.toLowerCase());
    if (canonicalRoot && canonicalRoot !== rootEntry) {
      addViolation("ROOT_ENTRY_CASE_VARIANT", rootEntry);
    }
    if (
      relativePath.toLowerCase().startsWith(".codex/work/") &&
      !relativePath.startsWith(".codex/work/")
    ) {
      addViolation("WORK_PATH_CASE_VARIANT", relativePath);
    }
    if (
      relativePath.toLowerCase().startsWith("docs/qa/reports/") &&
      !relativePath.startsWith("docs/qa/reports/")
    ) {
      addViolation("EVIDENCE_PATH_CASE_VARIANT", relativePath);
    }
    const baseCase = baseByLower.get(relativePath.toLowerCase());
    if (baseCase && baseCase !== relativePath) {
      addViolation("PATH_CASE_VARIANT", relativePath);
    }
    if (
      legacyRoots.has(rootEntry.toLowerCase()) &&
      addedPath(relativePath, basePaths)
    ) {
      addViolation("LEGACY_PATH_ADDED", relativePath);
    }
    if (relativePath.startsWith(".codex/work/")) {
      const slug = relativePath.split("/")[2];
      if (!WORK_SLUG.test(slug ?? "")) {
        addViolation("WORK_SLUG_INVALID", relativePath);
      }
      addViolation("WORK_PATH_TRACKED", relativePath);
    } else if (
      addedPath(relativePath, basePaths) &&
      ephemeralPath(relativePath) &&
      !approvedEvidence.has(relativePath)
    ) {
      addViolation("EPHEMERAL_PATH_TRACKED", relativePath);
    }
    const isAdded = addedPath(relativePath, basePaths);
    const isApprovedProduction = approvedProductionPaths.has(relativePath);
    if (isAdded && scriptApprovalRequired(relativePath, indexModes.get(relativePath)) && !isApprovedProduction) {
      addViolation("PRODUCTION_PATH_NOT_APPROVED", relativePath);
    }
    if (isAdded && evidenceLikePath(relativePath) && !approvedEvidence.has(relativePath) && !isApprovedProduction) {
      addViolation("EVIDENCE_LIKE_PATH_UNAPPROVED", relativePath);
    }
  }

  const ignoreCheck = git(resolvedRoot, [
    "check-ignore",
    "--no-index",
    "-q",
    "--",
    ".codex/work/artifact-hygiene-probe/session.log",
  ]);
  if (ignoreCheck.status !== 0) {
    addViolation("WORK_PATH_NOT_IGNORED", ".codex/work/<slug>/");
  }

  violations.sort((left, right) =>
    `${left.code}\0${left.path}`.localeCompare(`${right.code}\0${right.path}`),
  );
  return {
    ok: violations.length === 0,
    baseRef,
    baseSha,
    summary: {
      candidatePathCount: candidates.length,
      legacyBaselinePathCount: [...basePaths].filter((entry) =>
        legacyRoots.has(entry.split("/")[0].toLowerCase()),
      ).length,
      violationCount: violations.length,
    },
    violations,
  };
}
