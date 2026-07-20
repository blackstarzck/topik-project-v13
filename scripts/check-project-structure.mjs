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
  "CLAUDE.md",
  "DESIGN.md",
  "TESTING.md",
  "docs/prd.md",
  "docs/operations/README.md",
  "docs/operations/client-resilience-policy.md",
  "docs/operations/cross-repo-recovery-boundary.md",
  "docs/operations/environment-and-agent-safety.md",
  "docs/operations/topik-ai-operations-handoff.md",
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
  ["client-resilience-policy.md", "file"],
  ["cross-repo-recovery-boundary.md", "file"],
  ["environment-and-agent-safety.md", "file"],
  ["topik-ai-operations-handoff.md", "file"],
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

export function evaluateProjectStructure({ rootDir = process.cwd() } = {}) {
  const errors = [];
  if (!existsSync(rootDir))
    return { errors: [`Project root does not exist: ${rootDir}`] };
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
  const result = evaluateProjectStructure();
  if (result.errors.length > 0) {
    for (const error of result.errors) process.stderr.write(`- ${error}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write("Project structure contract passed.\n");
  }
}
