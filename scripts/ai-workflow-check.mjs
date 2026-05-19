#!/usr/bin/env node

import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const REQUIRED_PR_SECTIONS = [
  "## Summary",
  "## Why",
  "## Docs Consulted",
  "## Review",
  "## Verification",
  "## Git Publication Decision",
  "## Risks And Skipped Checks",
];

const REQUIRED_GIT_DECISION_FIELDS = [
  "Git publication decision:",
  "Reason:",
  "Branch:",
  "Upstream:",
  "Dirty scope:",
  "Review status:",
  "Verification status:",
  "Ledger:",
  "Fallback status:",
  "Next git action:",
];

const REQUIRED_LORE_TRAILERS = [
  "Constraint",
  "Rejected",
  "Confidence",
  "Scope-risk",
  "Directive",
  "Tested",
  "Not-tested",
  "Publication-decision",
  "Review",
  "Ledger",
];

const REQUIRED_LEDGER_SECTIONS = [
  "## Docs Consulted",
  "## Verification State",
  "## Ledger/File-State Consistency",
];

const IMPLEMENTATION_OR_WORKFLOW_PATTERNS = [
  /^scripts\//,
  /^\.github\//,
  /^\.claude\/settings(?:\.local)?\.json$/,
  /^AGENTS\.md$/,
  /^CLAUDE\.md$/,
  /^docs\/ai-development-workflow\.md$/,
  /^docs\/agent-index\.md$/,
  /^docs\/ai-workflow\//,
];

const LEDGER_PATTERN = /^docs\/ai-workflow\/runs\/\d{8}-\d{4}-.+\.md$/;

function normalizePathForCheck(path) {
  return normalize(path).split(sep).join("/");
}

function okResult(errors = [], warnings = []) {
  return { ok: errors.length === 0, errors, warnings };
}

function sectionContent(markdown, heading) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) return null;

  const contentLines = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^##\s+/.test(line)) break;
    contentLines.push(line);
  }

  return contentLines.join("\n").trim();
}

export function checkPullRequestBody(body) {
  const errors = [];

  for (const section of REQUIRED_PR_SECTIONS) {
    const content = sectionContent(body, section);
    if (content === null) {
      errors.push(`pull request body missing required section: ${section}`);
    } else if (content.length === 0) {
      errors.push(`pull request body has empty required section: ${section}`);
    }
  }

  for (const field of REQUIRED_GIT_DECISION_FIELDS) {
    const fieldPattern = new RegExp(
      `^\\s*${field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\S+`,
      "im",
    );
    if (!fieldPattern.test(body)) {
      errors.push(`pull request body missing git decision field value: ${field}`);
    }
  }

  return okResult(errors);
}

export function checkCommitMessage(message) {
  const errors = [];
  const firstLine = message.split(/\r?\n/, 1)[0] ?? "";
  const conventionalCommitPattern =
    /^(feat|fix|docs|test|refactor|perf|build|ci|chore|style|revert)(\([^)]+\))?(!)?: .+/;

  if (!conventionalCommitPattern.test(firstLine)) {
    errors.push("commit message header must follow Conventional Commits");
  }

  for (const trailer of REQUIRED_LORE_TRAILERS) {
    const trailerPattern = new RegExp(`^${trailer}:\\s*\\S+`, "im");
    if (!trailerPattern.test(message)) {
      errors.push(`commit message missing required trailer: ${trailer}`);
    }
  }

  return okResult(errors);
}

async function readGitChangedFiles(root) {
  const status = spawnSync("git", ["status", "--porcelain"], {
    cwd: root,
    encoding: "utf8",
  });

  if (status.status !== 0) {
    throw new Error(status.stderr || "git status --porcelain failed");
  }

  return status.stdout
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .map((file) => {
      const renameParts = file.split(" -> ");
      return normalizePathForCheck(renameParts.at(-1) ?? file);
    });
}

async function findExistingLedgers(root) {
  const runsDir = join(root, "docs", "ai-workflow", "runs");
  if (!existsSync(runsDir)) return [];

  const entries = await readdir(runsDir);
  return entries
    .filter((entry) => /^\d{8}-\d{4}-.+\.md$/.test(entry))
    .map((entry) => normalizePathForCheck(join("docs", "ai-workflow", "runs", entry)));
}

async function fileExists(root, relativePath) {
  try {
    const stats = await stat(join(root, relativePath));
    return stats.isFile();
  } catch {
    return false;
  }
}

async function validateLedger(root, ledgerPath, errors) {
  if (!(await fileExists(root, ledgerPath))) {
    errors.push(`ledger path does not exist: ${ledgerPath}`);
    return;
  }

  const content = await readFile(join(root, ledgerPath), "utf8");
  for (const section of REQUIRED_LEDGER_SECTIONS) {
    if (!content.includes(section)) {
      errors.push(`ledger missing required section ${section}: ${ledgerPath}`);
    }
  }
}

function needsLedger(changedFiles) {
  return changedFiles.some((file) => {
    const normalized = normalizePathForCheck(file);
    if (LEDGER_PATTERN.test(normalized)) return false;
    return IMPLEMENTATION_OR_WORKFLOW_PATTERNS.some((pattern) =>
      pattern.test(normalized),
    );
  });
}

export async function checkRepositoryState({
  root = process.cwd(),
  changedFiles,
} = {}) {
  const resolvedRoot = resolve(root);
  const files = (changedFiles ?? (await readGitChangedFiles(resolvedRoot))).map(
    normalizePathForCheck,
  );
  const errors = [];
  const warnings = [];

  if (needsLedger(files)) {
    const changedLedgers = files.filter((file) => LEDGER_PATTERN.test(file));
    if (changedLedgers.length === 0) {
      errors.push(
        "implementation/config workflow changes require a run ledger in docs/ai-workflow/runs/",
      );
    }

    for (const ledger of changedLedgers) {
      await validateLedger(resolvedRoot, ledger, errors);
    }
  }

  const existingLedgers = await findExistingLedgers(resolvedRoot);
  if (existingLedgers.length === 0) {
    warnings.push("no run ledgers found under docs/ai-workflow/runs/");
  }

  return okResult(errors, warnings);
}

async function readTextFile(path) {
  return readFile(resolve(path), "utf8");
}

function parseArgs(argv) {
  const options = {
    root: process.cwd(),
    prBodyPath: null,
    commitMessagePath: null,
    changedFilesPath: null,
    checkRepo: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--repo") {
      options.checkRepo = true;
      const next = argv[index + 1];
      if (next && !next.startsWith("--")) {
        options.root = next;
        index += 1;
      }
    } else if (arg === "--pr-body") {
      options.prBodyPath = argv[++index];
    } else if (arg === "--commit-message") {
      options.commitMessagePath = argv[++index];
    } else if (arg === "--changed-files") {
      options.changedFilesPath = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }

  if (
    !options.checkRepo &&
    !options.prBodyPath &&
    !options.commitMessagePath &&
    !options.help
  ) {
    options.checkRepo = true;
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  node scripts/ai-workflow-check.mjs --repo .
  node scripts/ai-workflow-check.mjs --pr-body path/to/pr-body.md
  node scripts/ai-workflow-check.mjs --commit-message path/to/message.txt

Options can be combined. --changed-files accepts a newline-delimited file list for
repo checks; otherwise git status --porcelain is used.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const results = [];

  if (options.prBodyPath) {
    results.push({
      label: "pull request body",
      result: checkPullRequestBody(await readTextFile(options.prBodyPath)),
    });
  }

  if (options.commitMessagePath) {
    results.push({
      label: "commit message",
      result: checkCommitMessage(await readTextFile(options.commitMessagePath)),
    });
  }

  if (options.checkRepo) {
    let changedFiles;
    if (options.changedFilesPath) {
      changedFiles = (await readTextFile(options.changedFilesPath))
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    }

    results.push({
      label: "repository state",
      result: await checkRepositoryState({
        root: options.root,
        changedFiles,
      }),
    });
  }

  let exitCode = 0;
  for (const { label, result } of results) {
    if (result.ok) {
      console.log(`PASS ${label}`);
    } else {
      exitCode = 1;
      console.error(`FAIL ${label}`);
      for (const error of result.errors) {
        console.error(`- ${error}`);
      }
    }

    for (const warning of result.warnings ?? []) {
      console.warn(`WARN ${label}: ${warning}`);
    }
  }

  process.exitCode = exitCode;
}

const executedPath = process.argv[1] ? resolve(process.argv[1]) : "";
const currentPath = fileURLToPath(import.meta.url);
if (executedPath === currentPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

export const internals = {
  REQUIRED_PR_SECTIONS,
  REQUIRED_GIT_DECISION_FIELDS,
  REQUIRED_LORE_TRAILERS,
  REQUIRED_LEDGER_SECTIONS,
  needsLedger,
  sectionContent,
};
