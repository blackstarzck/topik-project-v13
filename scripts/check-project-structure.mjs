import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const requiredOwnerPaths = [
  "AGENTS.md",
  "README.md",
  ".claude/CLAUDE.md",
  "DESIGN.md",
  "TESTING.md",
  "docs/prd.md",
  "docs/operations/README.md",
  "docs/operations/ai-development-pipeline.md",
  "docs/operations/client-resilience-policy.md",
  "docs/operations/cross-repo-recovery-boundary.md",
  "docs/operations/environment-and-agent-safety.md",
  "docs/operations/system-reporting-handoff.md",
  "docs/operations/topik-ai-migration-evidence-handoff.md",
  "docs/operations/topik-ai-operations-handoff.md",
  "docs/operations/topik-ai-notification-migration-order-handoff.md",
  "docs/operations/topik-ai-pdf-request-identity-cutover-handoff.md",
  "docs/operations/topik-ai-writing-pdf-metrics-handoff.md",
  "docs/operations/writing-submission-gate-runbook.md",
  "docs/swagger-api/",
  "docs/supabase/README.md",
  "docs/supabase/database-api-contract.md",
  "docs/supabase/security-and-ownership.md",
  "docs/qa/README.md",
  "supabase/README.md",
  "supabase/migrations/INDEX.md",
];

const docsAllowlist = new Map([
  ["prd.md", "file"],
  ["operations", "directory"],
  ["refactoring", "directory"],
  ["swagger-api", "directory"],
  ["supabase", "directory"],
  ["qa", "directory"],
]);
const qaAllowlist = new Map([
  ["README.md", "file"],
  ["plan", "directory"],
  ["reports", "directory"],
]);
const operationsAllowlist = new Map([
  ["README.md", "file"],
  ["ai-development-pipeline.md", "file"],
  ["client-resilience-policy.md", "file"],
  ["cross-repo-recovery-boundary.md", "file"],
  ["environment-and-agent-safety.md", "file"],
  ["system-reporting-handoff.md", "file"],
  ["topik-ai-migration-evidence-handoff.md", "file"],
  ["topik-ai-operations-handoff.md", "file"],
  ["topik-ai-notification-migration-order-handoff.md", "file"],
  ["topik-ai-pdf-request-identity-cutover-handoff.md", "file"],
  ["topik-ai-writing-pdf-metrics-handoff.md", "file"],
  ["writing-submission-gate-runbook.md", "file"],
]);
const activeDirectoryRoots = [
  ".github",
  "config",
  "src",
  "scripts",
  "tests",
  "docs/operations",
  "docs/supabase",
  ".codex/skills",
  ".claude/skills",
];
const scannedExtensions = new Set([
  ".css",
  ".md",
  ".json",
  ".js",
  ".cjs",
  ".cts",
  ".html",
  ".mjs",
  ".mts",
  ".sh",
  ".ps1",
  ".cmd",
  ".bat",
  ".ts",
  ".tsx",
  ".yml",
  ".yaml",
  ".toml",
  ".txt",
]);
const retiredIdentifiers = [
  ["check", "sot", "registry"].join("-"),
  ["sot", "registry"].join("-"),
  ["generate", "sot", "index"].join(":"),
  ["report", "sot", "registry"].join(":"),
];
const retiredDocsTopLevel = new Set(
  [
    "agent-workflow",
    "ai-workflow",
    "ant-design",
    "design-redesign",
    "development-core-planning",
    "flow",
    "future-considerations",
    "redesign-test",
    "scope-decisions",
    "sot-change-proposals",
    "superpowers",
    "todo",
    "Wireframe",
    "handoff-institution-member-phase2.md",
    "handoff-password-reset-template-topik-ai.md",
    "handoff-pdf-export-quota-topik-ai.md",
    "ia.md",
    "admin-integration-plan.md",
    "pdf-export-real-file-brief-20260612.md",
    "INDEX.md",
    "metadata-tag-schema-rule.md",
    "sot-registry.json",
    "user-communication-style.md",
  ].map((entry) => entry.toLowerCase()),
);
const referenceScanExemptions = new Set([
  "scripts/check-project-structure.mjs",
  "tests/fixtures/project-structure-retired-references.json",
]);
const pipelineContractImplementationPaths = Object.freeze([
  "config/artifact-hygiene-policy.json",
  "config/security-audit-baseline.json",
  "package.json",
  "scripts/ai-pipeline-executor.mjs",
  "scripts/ai-release.mjs",
  "scripts/ai-task.mjs",
  "scripts/ai-validation-evidence.mjs",
  "scripts/check-project-structure.mjs",
  "scripts/security-artifact-audit.mjs",
  "scripts/lib/ai-release-executor.mjs",
  "scripts/lib/ai-release-git.mjs",
  "scripts/lib/ai-release-promotion.mjs",
  "scripts/lib/ai-release-vercel.mjs",
  "scripts/lib/ai-task-sweep.mjs",
  "scripts/lib/ai-task-lifecycle-v3.mjs",
  "scripts/lib/ai-task-v3-adapter.mjs",
  "scripts/lib/ai-validation-evidence.mjs",
  "scripts/lib/security-artifact-audit.mjs",
]);
const pipelineContractDocumentationPaths = Object.freeze([
  ".codex/skills/finishing-a-development-branch/SKILL.md",
  "README.md",
  "docs/operations/README.md",
  "docs/operations/ai-development-pipeline.md",
]);

function inspectPipelineContractCoupling(changedPaths, errors) {
  if (changedPaths === null) return;
  if (
    !Array.isArray(changedPaths) ||
    changedPaths.some(
      (entry) =>
        typeof entry !== "string" ||
        entry.length === 0 ||
        entry.includes("\\") ||
        path.isAbsolute(entry) ||
        entry.split("/").some((segment) => segment === ".."),
    )
  ) {
    errors.push("Pipeline contract changed-path inventory is invalid.");
    return;
  }
  const changed = new Set(changedPaths);
  const implementationChanged = pipelineContractImplementationPaths.some(
    (entry) => changed.has(entry),
  );
  const documentationChanged = pipelineContractDocumentationPaths.some(
    (entry) => changed.has(entry),
  );
  if (implementationChanged !== documentationChanged) {
    errors.push(
      "Pipeline v3.1 implementation and owner documentation must change together.",
    );
  }
}

// Learner migration authoring freeze.
//
// `supabase/migrations/*.sql` is frozen at this watermark. That history was adopted
// byte for byte into topik-ai (`supabase/migrations-v13/`), which now owns both
// authoring and remote apply for the learner namespace. Editing a frozen file here
// breaks the parity proof adoption rests on; authoring a new one here splits
// ownership again.
//
// Still allowed: `down/**` (rollback assets for pre-freeze migrations) and
// `INDEX.md` (documentation of the existing history).
//
// There is deliberately no override switch. A violation is resolved by moving the
// file to topik-ai, not by renegotiating the watermark.
export const LEARNER_FREEZE_WATERMARK = "20260729120000";
export const LEARNER_ARCHIVE_TARGET = "topik-ai supabase/migrations-v13/";

const LEARNER_FORWARD_DIR = "supabase/migrations/";
const LEARNER_FORWARD_FILE =
  /^supabase\/migrations\/(\d{14})_[a-z0-9_]+\.sql$/u;

export function isLearnerFreezeExemptPath(filePath) {
  return (
    filePath.startsWith(`${LEARNER_FORWARD_DIR}down/`) ||
    filePath === `${LEARNER_FORWARD_DIR}INDEX.md`
  );
}

export function parseNameStatusZ(stdout) {
  const fields = String(stdout ?? "")
    .split("\0")
    .filter(Boolean);
  const entries = [];
  for (let index = 0; index < fields.length; ) {
    const status = fields[index][0];
    // With -z, renames and copies emit three fields: status, source, destination.
    if (status === "R" || status === "C") {
      entries.push({
        status,
        path: fields[index + 1],
        renamedTo: fields[index + 2],
      });
      index += 3;
      continue;
    }
    entries.push({ status, path: fields[index + 1] });
    index += 2;
  }
  return entries;
}

export function evaluateLearnerMigrationFreeze(entries) {
  const violations = [];
  for (const entry of entries) {
    if (!entry.path.startsWith(LEARNER_FORWARD_DIR)) continue;
    if (isLearnerFreezeExemptPath(entry.path)) continue;

    const match = LEARNER_FORWARD_FILE.exec(entry.path);
    if (!match) {
      violations.push(
        `${entry.path}: unexpected file under ${LEARNER_FORWARD_DIR} (${entry.status}). ` +
          "Only forward migrations, down/ rollbacks and INDEX.md belong here.",
      );
      continue;
    }

    if (entry.status === "A") {
      violations.push(
        `${entry.path}: new forward migration authored here. Learner authoring is frozen ` +
          `at ${LEARNER_FREEZE_WATERMARK}; author it in ${LEARNER_ARCHIVE_TARGET} with a ` +
          "timestamp above the watermark instead.",
      );
      continue;
    }

    if (entry.status === "R" || entry.status === "C") {
      violations.push(
        `${entry.path}: ${entry.status === "R" ? "renamed" : "copied"} to ${entry.renamedTo}. ` +
          "Frozen history keeps its exact name — the adopted archive is matched by name and bytes.",
      );
      continue;
    }

    violations.push(
      `${entry.path}: frozen history changed (${entry.status}). ` +
        (match[1] <= LEARNER_FREEZE_WATERMARK
          ? "This file is adopted byte for byte in the archive, so editing it breaks the parity proof. "
          : "") +
        "Fix it forward from topik-ai instead.",
    );
  }
  return violations;
}

function inspectLearnerMigrationFreeze(changedEntries, errors) {
  if (changedEntries === null) return;
  for (const violation of evaluateLearnerMigrationFreeze(changedEntries)) {
    errors.push(`Learner migration freeze: ${violation}`);
  }
}

function learnerMigrationEntriesFromGit(rootDir) {
  const baseRef = process.env.PROJECT_STRUCTURE_BASE_REF;
  if (baseRef === undefined || baseRef.length === 0) return null;
  if (!/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/iu.test(baseRef)) {
    throw new Error("Learner migration freeze base ref is invalid.");
  }
  // -M so a rename of frozen history is reported as a rename, not add + delete.
  const result = spawnSync(
    "git",
    [
      "diff",
      "--name-status",
      "-z",
      "-M",
      `${baseRef}...HEAD`,
      "--",
      LEARNER_FORWARD_DIR,
    ],
    {
      cwd: rootDir,
      encoding: "utf8",
      env: {
        PATH: process.env.PATH ?? "",
        SystemRoot: process.env.SystemRoot ?? "",
        WINDIR: process.env.WINDIR ?? "",
      },
      maxBuffer: 4 * 1024 * 1024,
      shell: false,
      timeout: 10_000,
      windowsHide: true,
    },
  );
  if (result.status !== 0 || result.error || result.signal) {
    throw new Error("Learner migration freeze inventory failed.");
  }
  return parseNameStatusZ(result.stdout);
}

function pipelineChangedPathsFromGit(rootDir) {
  const baseRef = process.env.PROJECT_STRUCTURE_BASE_REF;
  if (baseRef === undefined || baseRef.length === 0) return null;
  if (!/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/iu.test(baseRef)) {
    throw new Error("Pipeline contract base ref is invalid.");
  }
  const result = spawnSync(
    "git",
    ["diff", "--name-only", "-z", `${baseRef}...HEAD`, "--"],
    {
      cwd: rootDir,
      encoding: "utf8",
      env: {
        PATH: process.env.PATH ?? "",
        SystemRoot: process.env.SystemRoot ?? "",
        WINDIR: process.env.WINDIR ?? "",
      },
      maxBuffer: 4 * 1024 * 1024,
      shell: false,
      timeout: 10_000,
      windowsHide: true,
    },
  );
  if (result.status !== 0 || result.error || result.signal) {
    throw new Error("Pipeline contract changed-path inventory failed.");
  }
  return String(result.stdout ?? "")
    .split("\0")
    .filter(Boolean);
}

function normalizedPath(value) {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function isLinkOrReparse(target, status) {
  if (status.isSymbolicLink()) return true;
  try {
    return (
      normalizedPath(realpathSync.native(target)) !== normalizedPath(target)
    );
  } catch {
    return true;
  }
}

function inspectRequiredOwner(rootDir, relativePath, errors) {
  const expectsDirectory = relativePath.endsWith("/");
  const canonicalRelative = expectsDirectory
    ? relativePath.slice(0, -1)
    : relativePath;
  const target = path.join(rootDir, canonicalRelative);
  if (!existsSync(target)) {
    errors.push(`Missing required owner: ${relativePath}`);
    return;
  }
  const status = lstatSync(target);
  if (isLinkOrReparse(target, status)) {
    errors.push(
      `Required owner must not be symbolic or reparse path: ${relativePath}`,
    );
    return;
  }
  if (expectsDirectory ? !status.isDirectory() : !status.isFile()) {
    errors.push(
      `Required owner has the wrong filesystem type: ${relativePath}`,
    );
  }
}

function inspectDocsTopLevel(rootDir, errors) {
  const docsRoot = path.join(rootDir, "docs");
  if (!existsSync(docsRoot)) {
    errors.push("Missing docs directory.");
    return;
  }
  const docsStatus = lstatSync(docsRoot);
  if (!docsStatus.isDirectory() || isLinkOrReparse(docsRoot, docsStatus)) {
    errors.push(
      "docs must be a regular directory, not a symbolic or reparse path.",
    );
    return;
  }

  for (const entry of readdirSync(docsRoot, { withFileTypes: true })) {
    const expectedType = docsAllowlist.get(entry.name);
    const target = path.join(docsRoot, entry.name);
    if (!expectedType) {
      errors.push(`Unknown docs top-level entry: docs/${entry.name}`);
      continue;
    }
    const status = lstatSync(target);
    if (isLinkOrReparse(target, status)) {
      errors.push(`docs/${entry.name} must not be symbolic or reparse path.`);
      continue;
    }
    if (
      (expectedType === "file" && !status.isFile()) ||
      (expectedType === "directory" && !status.isDirectory())
    ) {
      errors.push(`docs/${entry.name} has the wrong filesystem type.`);
    }
  }
}

function inspectQaRoot(rootDir, errors) {
  const qaRoot = path.join(rootDir, "docs", "qa");
  if (!existsSync(qaRoot)) {
    errors.push("Missing required QA directory: docs/qa");
    return;
  }

  const qaStatus = lstatSync(qaRoot);
  if (!qaStatus.isDirectory() || isLinkOrReparse(qaRoot, qaStatus)) {
    errors.push(
      "docs/qa must be a regular directory, not a symbolic or reparse path.",
    );
    return;
  }

  const seen = new Set();
  for (const entry of readdirSync(qaRoot, { withFileTypes: true })) {
    seen.add(entry.name);
    const expectedType = qaAllowlist.get(entry.name);
    const target = path.join(qaRoot, entry.name);
    if (!expectedType) {
      errors.push(`Unknown docs/qa root entry: docs/qa/${entry.name}`);
      continue;
    }
    const status = lstatSync(target);
    if (isLinkOrReparse(target, status)) {
      errors.push(
        `docs/qa/${entry.name} must not be symbolic or reparse path.`,
      );
      continue;
    }
    if (
      (expectedType === "file" && !status.isFile()) ||
      (expectedType === "directory" && !status.isDirectory())
    ) {
      errors.push(`docs/qa/${entry.name} has the wrong filesystem type.`);
    }
  }

  for (const required of qaAllowlist.keys()) {
    if (!seen.has(required)) {
      errors.push(`Missing required QA entry: docs/qa/${required}`);
    }
  }
}

function inspectOperationsRoot(rootDir, errors) {
  const operationsRoot = path.join(rootDir, "docs", "operations");
  if (!existsSync(operationsRoot)) {
    errors.push("Missing required operations directory: docs/operations");
    return;
  }

  const operationsStatus = lstatSync(operationsRoot);
  if (
    !operationsStatus.isDirectory() ||
    isLinkOrReparse(operationsRoot, operationsStatus)
  ) {
    errors.push(
      "docs/operations must be a regular directory, not a symbolic or reparse path.",
    );
    return;
  }

  const seen = new Set();
  for (const entry of readdirSync(operationsRoot, { withFileTypes: true })) {
    seen.add(entry.name);
    const expectedType = operationsAllowlist.get(entry.name);
    const target = path.join(operationsRoot, entry.name);
    if (!expectedType) {
      errors.push(
        `Unknown docs/operations root entry: docs/operations/${entry.name}`,
      );
      continue;
    }
    const status = lstatSync(target);
    if (isLinkOrReparse(target, status)) {
      errors.push(
        `docs/operations/${entry.name} must not be symbolic or reparse path.`,
      );
      continue;
    }
    if (!status.isFile()) {
      errors.push(
        `docs/operations/${entry.name} has the wrong filesystem type.`,
      );
    }
  }

  for (const required of operationsAllowlist.keys()) {
    if (!seen.has(required)) {
      errors.push(
        `Missing required operations entry: docs/operations/${required}`,
      );
    }
  }
}

function shouldScanFile(file) {
  const basename = path.basename(file).toLowerCase();
  return (
    scannedExtensions.has(path.extname(file).toLowerCase()) ||
    [
      ".env.example",
      ".gitignore",
      ".prettierignore",
      ".eslintignore",
      "codeowners",
    ].includes(basename)
  );
}

function hasExternalUriScheme(prefix) {
  if (prefix.startsWith("//")) return true;
  const scheme = /^([a-z][a-z0-9+.-]*):/iu.exec(prefix);
  if (!scheme) return false;
  return !(scheme[1].length === 1 && /^[a-z]:[\\/]/iu.test(prefix));
}

function staticStringLiterals(source) {
  const literals = [];
  const dynamicTemplates = [];
  for (let start = 0; start < source.length; start += 1) {
    const quote = source[start];
    if (quote !== '"' && quote !== "'" && quote !== "`") continue;

    let value = "";
    let escaped = false;
    let dynamic = false;
    let closed = false;
    let cursor = start + 1;
    for (; cursor < source.length; cursor += 1) {
      const character = source[cursor];
      if (escaped) {
        value += character;
        escaped = false;
        continue;
      }
      if (character === "\\") {
        value += character;
        escaped = true;
        continue;
      }
      if (quote === "`" && character === "$" && source[cursor + 1] === "{") {
        dynamic = true;
      }
      if (character === quote) {
        closed = true;
        break;
      }
      value += character;
    }
    if (closed) {
      const normalized = value.replaceAll("\\", "/");
      if (dynamic) dynamicTemplates.push(normalized);
      else literals.push(normalized);
    }
    if (closed) start = cursor;
  }
  return { dynamicTemplates, literals };
}

function findReferenceErrors(file, rootDir, errors) {
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    errors.push(`Unable to read active file: ${path.relative(rootDir, file)}`);
    return;
  }
  const relativeFile = path.relative(rootDir, file).replaceAll("\\", "/");
  const docsPattern = /docs[\\/]+(?:\.[\\/]+)*([A-Za-z0-9._-]+)/giu;
  for (const match of content.matchAll(docsPattern)) {
    let tokenStart = match.index - 1;
    while (
      tokenStart >= 0 &&
      !/[\s"'`()\[\]{}=<>]/u.test(content[tokenStart])
    ) {
      tokenStart -= 1;
    }
    const tokenPrefix = content.slice(tokenStart + 1, match.index);
    if (hasExternalUriScheme(tokenPrefix)) continue;
    if (retiredDocsTopLevel.has(match[1].toLowerCase())) {
      errors.push(
        `Forbidden docs reference in ${relativeFile}: docs/${match[1]}`,
      );
    }
  }
  for (const identifier of retiredIdentifiers) {
    if (content.includes(identifier)) {
      errors.push(
        `Retired structure reference in ${relativeFile}: ${identifier}`,
      );
    }
  }

  const constructorPattern = /\b(?:(?:path)\s*\.\s*)?(?:join|resolve)\s*\(/giu;
  for (const call of content.matchAll(constructorPattern)) {
    const argumentsStart = (call.index ?? 0) + call[0].length;
    let cursor = argumentsStart;
    let depth = 1;
    let quote = null;
    let escaped = false;
    for (; cursor < content.length && depth > 0; cursor += 1) {
      const character = content[cursor];
      if (quote) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === quote) quote = null;
        continue;
      }
      if (character === '"' || character === "'" || character === "`") {
        quote = character;
      } else if (character === "(") depth += 1;
      else if (character === ")") depth -= 1;
    }
    if (depth !== 0) continue;

    const argumentsText = content.slice(argumentsStart, cursor - 1);
    const { dynamicTemplates, literals } = staticStringLiterals(argumentsText);
    const docsIndex = literals.findIndex(
      (literal) => literal.toLowerCase() === "docs",
    );
    const hasDynamicDocsPrefix = dynamicTemplates.some((literal) =>
      /^(?:\.\/)?docs(?:\/|$)/iu.test(literal),
    );
    if (docsIndex < 0 && !hasDynamicDocsPrefix) continue;
    const retired =
      docsIndex < 0
        ? undefined
        : literals
            .slice(docsIndex + 1)
            .map((literal) => literal.replace(/^\.\//u, "").split("/")[0])
            .find((literal) => retiredDocsTopLevel.has(literal.toLowerCase()));
    if (retired) {
      errors.push(
        `Forbidden docs reference in ${relativeFile}: docs/${retired} (split path construction)`,
      );
    } else if (
      dynamicTemplates.length > 0 &&
      (docsIndex >= 0 || hasDynamicDocsPrefix)
    ) {
      errors.push(
        `Forbidden dynamic docs path in ${relativeFile}: dynamic docs path construction cannot be verified statically`,
      );
    }
  }
}

function parseNulPaths(output) {
  return output
    .split("\0")
    .filter(Boolean)
    .map((entry) => entry.replaceAll("\\", "/"));
}

function gitInventory(rootDir) {
  const options = {
    cwd: rootDir,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  };
  const candidates = spawnSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    options,
  );
  if (candidates.error || candidates.signal || candidates.status !== 0)
    return null;
  const tracked = spawnSync("git", ["ls-files", "-z", "--cached"], options);
  if (tracked.error || tracked.signal || tracked.status !== 0) return null;
  const deleted = spawnSync("git", ["ls-files", "-z", "--deleted"], options);
  if (deleted.error || deleted.signal || deleted.status !== 0) return null;
  return {
    candidates: parseNulPaths(candidates.stdout),
    tracked: new Set(parseNulPaths(tracked.stdout)),
    deleted: new Set(parseNulPaths(deleted.stdout)),
  };
}

function isActiveRelativePath(relative) {
  if (!relative.includes("/")) return shouldScanFile(relative);
  if (
    relative === "docs/prd.md" ||
    relative === "docs/qa/README.md" ||
    relative.startsWith("docs/qa/plan/") ||
    relative === "supabase/README.md" ||
    relative === "supabase/migrations/INDEX.md"
  ) {
    return true;
  }
  if (
    relative.startsWith(".claude/") &&
    !relative.slice(".claude/".length).includes("/")
  ) {
    return shouldScanFile(relative);
  }
  return activeDirectoryRoots.some(
    (directory) =>
      relative === directory || relative.startsWith(`${directory}/`),
  );
}

function isSensitiveRuntimePath(relative) {
  const normalized = relative.toLowerCase();
  return (
    normalized === ".env.local" ||
    normalized === ".claude/settings.local.json" ||
    normalized === ".scratch/student-state.json" ||
    normalized.startsWith("tests/e2e/auth-state/")
  );
}

function gitActiveFiles(rootDir, errors, inventory) {
  const files = [];
  for (const relative of inventory.candidates) {
    if (inventory.deleted.has(relative)) continue;
    if (isSensitiveRuntimePath(relative)) {
      errors.push(
        `Sensitive runtime path must not appear in Git inventory: ${relative}`,
      );
      continue;
    }
    if (!isActiveRelativePath(relative)) continue;
    const target = path.join(rootDir, relative);
    let status;
    try {
      status = lstatSync(target);
    } catch {
      errors.push(
        `Active Git inventory path is missing or dangling: ${relative}`,
      );
      continue;
    }
    if (isLinkOrReparse(target, status)) {
      errors.push(
        `Active path must not be symbolic or reparse path: ${relative}`,
      );
      continue;
    }
    if (status.isFile() && shouldScanFile(target)) files.push(target);
  }
  return files;
}

function activeFiles(rootDir, errors) {
  const inventory = gitInventory(rootDir);
  if (!inventory) {
    errors.push(
      "Unable to produce Git inventory; active content scan was stopped.",
    );
    return [];
  }
  return gitActiveFiles(rootDir, errors, inventory);
}

export function evaluateProjectStructure({
  rootDir = process.cwd(),
  changedPaths = null,
  changedEntries = null,
} = {}) {
  const errors = [];
  if (!existsSync(rootDir))
    return { errors: [`Project root does not exist: ${rootDir}`] };
  inspectPipelineContractCoupling(changedPaths, errors);
  inspectLearnerMigrationFreeze(changedEntries, errors);
  inspectDocsTopLevel(rootDir, errors);
  inspectOperationsRoot(rootDir, errors);
  inspectQaRoot(rootDir, errors);
  for (const owner of requiredOwnerPaths)
    inspectRequiredOwner(rootDir, owner, errors);
  for (const file of activeFiles(rootDir, errors))
    if (
      !referenceScanExemptions.has(
        path.relative(rootDir, file).replaceAll("\\", "/"),
      )
    ) {
      findReferenceErrors(file, rootDir, errors);
    }
  return { errors };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  // Vercel's build container stopped shipping the .git directory (builder 56 -> 58
  // in 2026-08), so the inventory-based contract cannot run there and prebuild
  // killed every deployment - including redeploys of the production sha. The
  // contract is enforced in CI and by the promotion gate, which pin the exact sha
  // the build receives, so re-checking inside the build container adds nothing.
  // The skip requires BOTH VERCEL=1 and a missing inventory; every other
  // environment keeps failing closed exactly as before.
  if (process.env.VERCEL === "1" && gitInventory(process.cwd()) === null) {
    process.stdout.write(
      "Project structure contract skipped: Git inventory is unavailable in the Vercel build container; the contract is enforced in CI and the promotion gate.\n",
    );
    process.exit(0);
  }
  let changedPaths = null;
  let changedEntries = null;
  let changedPathError = null;
  try {
    changedPaths = pipelineChangedPathsFromGit(process.cwd());
    changedEntries = learnerMigrationEntriesFromGit(process.cwd());
  } catch (error) {
    changedPathError = error.message;
  }
  const result = evaluateProjectStructure({ changedPaths, changedEntries });
  if (changedPathError !== null) result.errors.unshift(changedPathError);
  if (result.errors.length > 0) {
    for (const error of result.errors) process.stderr.write(`- ${error}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write("Project structure contract passed.\n");
  }
}
