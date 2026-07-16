#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { link, lstat, mkdir, open, readFile, readdir, realpath, rename, unlink } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const sourceRoot = path.join(repoRoot, ".codex", "skills");
const mirrorRoot = path.join(repoRoot, ".claude", "skills");
const GENERATED_MARKER = "<!-- GENERATED CANONICAL SKILL PROXY: DO NOT EDIT -->";
const FRONTEND_DESIGN_FILES = new Set([
  "SKILL.md",
  "UPSTREAM_SKILL.md",
  "SOURCE.md",
  "LICENSE.txt",
]);

const skillGroups = [
  {
    label: "Superpowers",
    names: [
      "brainstorming",
      "dispatching-parallel-agents",
      "executing-plans",
      "finishing-a-development-branch",
      "receiving-code-review",
      "requesting-code-review",
      "subagent-driven-development",
      "systematic-debugging",
      "test-driven-development",
      "using-git-worktrees",
      "using-superpowers",
      "verification-before-completion",
      "writing-plans",
      "writing-skills",
    ],
  },
  {
    label: "Project local",
    names: ["frontend-design"],
  },
];

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");
const listOnly = args.has("--list");
const failures = [];
const synced = [];

if (args.has("--help") || args.has("-h")) {
  console.log(`Usage: node scripts/sync-agent-skills.mjs [--check|--list]

Generates tracked Claude SKILL.md entrypoints that load the canonical skills
from .codex/skills. Relative references remain anchored to the canonical skill
directory instead of being duplicated into host-specific mirrors.

Options:
  --check  verify proxies are in sync without writing files
  --list   print canonical skill names
`);
  process.exit(0);
}

if (listOnly) {
  for (const group of skillGroups) {
    console.log(`# ${group.label}`);
    console.log(group.names.join("\n"));
  }
  process.exit(0);
}

async function exists(targetPath) {
  try {
    await lstat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function assertExactCanonicalSkills(canonicalNames) {
  let entries;
  try {
    entries = await readdir(sourceRoot, { withFileTypes: true });
  } catch {
    failures.push("Missing canonical skill root: .codex/skills");
    return;
  }

  const repoReal = await realpath(repoRoot);
  const sourceRootStat = await lstat(sourceRoot);
  const sourceRootReal = await realpath(sourceRoot);
  if (
    !sourceRootStat.isDirectory() ||
    sourceRootStat.isSymbolicLink() ||
    !isWithin(repoReal, sourceRootReal)
  ) {
    failures.push("Unsafe canonical skill root: .codex/skills");
    return;
  }

  const actualNames = new Set(entries.map((entry) => entry.name));
  for (const entry of entries) {
    if (!canonicalNames.has(entry.name)) {
      failures.push(`Unknown canonical skill: .codex/skills/${entry.name}`);
    }
  }

  for (const skillName of canonicalNames) {
    if (!actualNames.has(skillName)) {
      failures.push(`Missing canonical skill directory: .codex/skills/${skillName}`);
      continue;
    }
    const skillDirectory = path.join(sourceRoot, skillName);
    const skillStat = await lstat(skillDirectory);
    let skillReal = null;
    try {
      skillReal = await realpath(skillDirectory);
    } catch {
      // The unsafe directory error below owns this failure.
    }
    if (
      !skillStat.isDirectory() ||
      skillStat.isSymbolicLink() ||
      !skillReal ||
      !isWithin(sourceRootReal, skillReal)
    ) {
      failures.push(`Unsafe canonical skill directory: .codex/skills/${skillName}`);
      continue;
    }
    await assertSafeCanonicalTree(skillName, skillDirectory, skillReal, true);
  }
}

async function assertSafeCanonicalTree(skillName, directory, skillRootReal, isSkillRoot) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    failures.push(`Unreadable canonical skill directory: ${relativeRepoPath(directory)}`);
    return;
  }

  if (skillName === "frontend-design" && isSkillRoot) {
    const actualNames = new Set(entries.map((entry) => entry.name));
    for (const entry of entries) {
      if (!FRONTEND_DESIGN_FILES.has(entry.name)) {
        failures.push(`Unexpected frontend-design entry: ${relativeRepoPath(path.join(directory, entry.name))}`);
      }
    }
    for (const expectedName of FRONTEND_DESIGN_FILES) {
      if (!actualNames.has(expectedName)) {
        failures.push(`Missing frontend-design entry: .codex/skills/frontend-design/${expectedName}`);
        continue;
      }
      const expectedPath = path.join(directory, expectedName);
      try {
        const expectedStat = await lstat(expectedPath);
        if (!expectedStat.isFile() || expectedStat.isSymbolicLink()) {
          failures.push(
            `Frontend-design entry must be a regular file: ${relativeRepoPath(expectedPath)}`,
          );
        }
      } catch {
        failures.push(
          `Frontend-design entry must be a regular file: ${relativeRepoPath(expectedPath)}`,
        );
      }
    }
  }

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    let entryStat;
    let entryReal;
    try {
      entryStat = await lstat(entryPath);
      if (
        entryStat.isSymbolicLink() ||
        (!entryStat.isFile() && !entryStat.isDirectory())
      ) {
        failures.push(`Unsafe canonical skill entry: ${relativeRepoPath(entryPath)}`);
        continue;
      }
      entryReal = await realpath(entryPath);
    } catch {
      failures.push(`Unsafe canonical skill entry: ${relativeRepoPath(entryPath)}`);
      continue;
    }

    if (!isWithin(skillRootReal, entryReal)) {
      failures.push(`Unsafe canonical skill entry: ${relativeRepoPath(entryPath)}`);
      continue;
    }

    if (entryStat.isDirectory()) {
      await assertSafeCanonicalTree(skillName, entryPath, skillRootReal, false);
    }
  }
}

function relativeRepoPath(targetPath) {
  return path.relative(repoRoot, targetPath).split(path.sep).join("/");
}

async function assertExactClaudeProxies(canonicalNames) {
  if (!(await exists(mirrorRoot))) return;

  const mirrorStat = await lstat(mirrorRoot);
  const mirrorReal = await realpath(mirrorRoot);
  const repoReal = await realpath(repoRoot);
  if (
    !mirrorStat.isDirectory() ||
    mirrorStat.isSymbolicLink() ||
    !isWithin(repoReal, mirrorReal)
  ) {
    failures.push("Unsafe Claude skill root: .claude/skills");
    return;
  }

  const entries = await readdir(mirrorRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!canonicalNames.has(entry.name)) {
      failures.push(`Unknown Claude skill: .claude/skills/${entry.name}`);
      continue;
    }

    const skillDirectory = path.join(mirrorRoot, entry.name);
    const skillStat = await lstat(skillDirectory);
    let skillReal = null;
    try {
      skillReal = await realpath(skillDirectory);
    } catch {
      // The unsafe directory error below owns this failure.
    }
    if (
      !skillStat.isDirectory() ||
      skillStat.isSymbolicLink() ||
      !skillReal ||
      !isWithin(mirrorReal, skillReal)
    ) {
      failures.push(`Unsafe Claude skill directory: .claude/skills/${entry.name}`);
      continue;
    }

    const proxyEntries = await readdir(skillDirectory, { withFileTypes: true });
    for (const proxyEntry of proxyEntries) {
      if (proxyEntry.name !== "SKILL.md") {
        failures.push(
          `Unexpected Claude proxy entry: .claude/skills/${entry.name}/${proxyEntry.name}`,
        );
        continue;
      }
      const proxyPath = path.join(skillDirectory, proxyEntry.name);
      const proxyStat = await lstat(proxyPath);
      if (!proxyStat.isFile() || proxyStat.isSymbolicLink()) {
        failures.push(`Unsafe proxy: .claude/skills/${entry.name}/SKILL.md`);
      }
    }
  }
}

function extractFrontmatter(content, skillName) {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---/u);
  if (!match || !new RegExp(`^name:\\s*${skillName}\\s*$`, "mu").test(match[0])) {
    throw new Error(`Invalid canonical frontmatter: .codex/skills/${skillName}/SKILL.md`);
  }
  return match[0].replaceAll("\r\n", "\n");
}

function renderProxy(frontmatter, skillName) {
  const canonicalPath = `../../../.codex/skills/${skillName}/SKILL.md`;
  return `${frontmatter}\n\n${GENERATED_MARKER}\n\n# Canonical skill entrypoint\n\nBefore taking any task action, read the canonical SKILL.md completely at \`${canonicalPath}\` and follow it as the authoritative instruction body. Resolve every relative reference, script, template, and asset from \`../../../.codex/skills/${skillName}/\`, not from this proxy directory.\n`;
}

async function canonicalSkill(skillName) {
  const sourcePath = path.join(sourceRoot, skillName, "SKILL.md");
  const sourceStat = await lstat(sourcePath);
  const sourceReal = await realpath(sourcePath);
  const rootReal = await realpath(sourceRoot);
  if (
    !sourceStat.isFile() ||
    sourceStat.isSymbolicLink() ||
    !sourceReal.startsWith(`${rootReal}${path.sep}`)
  ) {
    throw new Error(`Unsafe canonical skill: .codex/skills/${skillName}/SKILL.md`);
  }
  const content = await readFile(sourcePath, "utf8");
  return renderProxy(extractFrontmatter(content, skillName), skillName);
}

function isWithin(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

async function safeMirrorSkillDirectory(skillName) {
  const repoReal = await realpath(repoRoot);
  const claudeRoot = path.join(repoRoot, ".claude");
  for (const directory of [claudeRoot, mirrorRoot]) {
    if (!(await exists(directory))) {
      if (checkOnly) throw new Error(`Missing Claude skill root: ${path.relative(repoRoot, directory)}`);
      await mkdir(directory);
    }
    const directoryStat = await lstat(directory);
    const directoryReal = await realpath(directory);
    if (
      !directoryStat.isDirectory() ||
      directoryStat.isSymbolicLink() ||
      !isWithin(repoReal, directoryReal)
    ) {
      throw new Error(`Unsafe Claude skill root: ${path.relative(repoRoot, directory)}`);
    }
  }

  const mirrorReal = await realpath(mirrorRoot);
  const skillDirectory = path.join(mirrorRoot, skillName);
  if (!(await exists(skillDirectory))) {
    if (checkOnly) throw new Error(`Missing Claude skill directory: .claude/skills/${skillName}`);
    await mkdir(skillDirectory);
  }
  const skillStat = await lstat(skillDirectory);
  const skillReal = await realpath(skillDirectory);
  if (
    !skillStat.isDirectory() ||
    skillStat.isSymbolicLink() ||
    !isWithin(mirrorReal, skillReal)
  ) {
    throw new Error(`Unsafe Claude skill directory: .claude/skills/${skillName}`);
  }
  return skillDirectory;
}

async function syncProxy(skillName) {
  let expected;
  try {
    expected = await canonicalSkill(skillName);
  } catch (error) {
    failures.push(error.message);
    return;
  }

  let skillDirectory;
  try {
    skillDirectory = await safeMirrorSkillDirectory(skillName);
  } catch (error) {
    failures.push(error.message);
    return;
  }
  const proxyPath = path.join(skillDirectory, "SKILL.md");
  let actual = null;
  let targetStat = null;
  try {
    targetStat = await lstat(proxyPath);
    if (!targetStat.isFile() || targetStat.isSymbolicLink()) {
      failures.push(`Unsafe proxy: .claude/skills/${skillName}/SKILL.md`);
      return;
    }
    actual = await readFile(proxyPath, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") {
      failures.push(`Unreadable proxy: .claude/skills/${skillName}/SKILL.md`);
      return;
    }
  }

  if (actual === expected) {
    synced.push(`ok .claude/skills/${skillName}/SKILL.md`);
    return;
  }
  if (checkOnly) {
    failures.push(`Out of sync: .claude/skills/${skillName}/SKILL.md`);
    return;
  }
  try {
    await writeProxyAtomically({
      skillName,
      skillDirectory,
      proxyPath,
      expected,
      targetStat,
    });
  } catch (error) {
    failures.push(error.message);
    return;
  }
  synced.push(`wrote .claude/skills/${skillName}/SKILL.md`);
}

async function writeProxyAtomically({
  skillName,
  skillDirectory,
  proxyPath,
  expected,
  targetStat,
}) {
  const targetExisted = targetStat !== null;
  const mode = targetExisted ? targetStat.mode & 0o777 : 0o644;
  await assertSafeProxyWriteState(skillName, skillDirectory, null, targetExisted);

  const tempName = `.SKILL.md.codex-${process.pid}-${randomUUID()}.tmp`;
  const tempPath = path.join(skillDirectory, tempName);
  let handle = null;
  let tempNeedsCleanup = false;
  try {
    handle = await open(tempPath, "wx", mode);
    tempNeedsCleanup = true;
    await handle.writeFile(expected, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;

    await assertSafeProxyWriteState(skillName, skillDirectory, tempName, targetExisted);
    if (targetExisted) {
      await rename(tempPath, proxyPath);
      tempNeedsCleanup = false;
    } else {
      await link(tempPath, proxyPath);
      await unlink(tempPath);
      tempNeedsCleanup = false;
    }

    await assertSafeProxyWriteState(skillName, skillDirectory, null, true);
    const finalContent = await readFile(proxyPath, "utf8");
    if (finalContent !== expected) {
      throw new Error(`Atomic proxy verification failed: .claude/skills/${skillName}/SKILL.md`);
    }
    await syncDirectoryBestEffort(skillDirectory);
  } finally {
    if (handle) await handle.close();
    if (tempNeedsCleanup) await cleanupOwnedTemp(skillDirectory, tempPath);
  }
}

async function assertSafeProxyWriteState(
  skillName,
  skillDirectory,
  allowedTempName,
  targetShouldExist,
) {
  const mirrorReal = await realpath(mirrorRoot);
  const directoryStat = await lstat(skillDirectory);
  const directoryReal = await realpath(skillDirectory);
  if (
    !directoryStat.isDirectory() ||
    directoryStat.isSymbolicLink() ||
    !isWithin(mirrorReal, directoryReal)
  ) {
    throw new Error(`Unsafe Claude skill directory: .claude/skills/${skillName}`);
  }

  const entries = await readdir(skillDirectory, { withFileTypes: true });
  const allowedNames = new Set(["SKILL.md"]);
  if (allowedTempName) allowedNames.add(allowedTempName);
  for (const entry of entries) {
    const entryPath = path.join(skillDirectory, entry.name);
    if (!allowedNames.has(entry.name)) {
      throw new Error(`Unexpected Claude proxy entry: ${relativeRepoPath(entryPath)}`);
    }
    const entryStat = await lstat(entryPath);
    const entryReal = await realpath(entryPath);
    if (
      !entryStat.isFile() ||
      entryStat.isSymbolicLink() ||
      !isWithin(directoryReal, entryReal)
    ) {
      throw new Error(`Unsafe proxy write entry: ${relativeRepoPath(entryPath)}`);
    }
  }

  const hasTarget = entries.some((entry) => entry.name === "SKILL.md");
  const hasTemp = allowedTempName
    ? entries.some((entry) => entry.name === allowedTempName)
    : false;
  if (hasTarget !== targetShouldExist || (allowedTempName && !hasTemp)) {
    throw new Error(`Proxy changed during write: .claude/skills/${skillName}/SKILL.md`);
  }
}

async function cleanupOwnedTemp(skillDirectory, tempPath) {
  if (path.dirname(tempPath) !== skillDirectory) {
    throw new Error("Refusing to clean a proxy temp outside its owned directory");
  }
  try {
    const tempStat = await lstat(tempPath);
    const directoryReal = await realpath(skillDirectory);
    const tempReal = await realpath(tempPath);
    if (
      !tempStat.isFile() ||
      tempStat.isSymbolicLink() ||
      !isWithin(directoryReal, tempReal)
    ) {
      throw new Error(`Unsafe proxy temp cleanup: ${relativeRepoPath(tempPath)}`);
    }
    await unlink(tempPath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function syncDirectoryBestEffort(directory) {
  if (process.platform === "win32") return;
  let directoryHandle = null;
  try {
    directoryHandle = await open(directory, "r");
    await directoryHandle.sync();
  } finally {
    if (directoryHandle) await directoryHandle.close();
  }
}

for (const legacyRoot of [path.join(repoRoot, ".agents", "skills"), path.join(repoRoot, ".agents", "superpowers")]) {
  if (await exists(legacyRoot)) failures.push(`Legacy skill root still exists: ${path.relative(repoRoot, legacyRoot)}`);
}

const canonicalNames = new Set(skillGroups.flatMap((group) => group.names));
await assertExactCanonicalSkills(canonicalNames);
await assertExactClaudeProxies(canonicalNames);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

for (const skillName of canonicalNames) await syncProxy(skillName);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(checkOnly ? "PASS agent skill proxies are in sync" : synced.join("\n"));
