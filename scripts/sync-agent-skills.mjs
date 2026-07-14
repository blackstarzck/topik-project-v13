#!/usr/bin/env node

import { lstat, mkdir, readFile, readdir, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const sourceRoot = path.join(repoRoot, ".codex", "skills");
const mirrorRoot = path.join(repoRoot, ".claude", "skills");
const GENERATED_MARKER = "<!-- GENERATED CANONICAL SKILL PROXY: DO NOT EDIT -->";

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
];

if (await exists(path.join(sourceRoot, "gstack"))) {
  skillGroups.push({ label: "GStack", names: ["gstack"] });
}

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
    await stat(targetPath);
    return true;
  } catch {
    return false;
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
  try {
    const proxyStat = await lstat(proxyPath);
    if (!proxyStat.isFile() || proxyStat.isSymbolicLink()) {
      failures.push(`Unsafe proxy: .claude/skills/${skillName}/SKILL.md`);
      return;
    }
    actual = await readFile(proxyPath, "utf8");
  } catch {
    // A missing proxy is handled below.
  }

  if (actual === expected) {
    synced.push(`ok .claude/skills/${skillName}/SKILL.md`);
    return;
  }
  if (checkOnly) {
    failures.push(`Out of sync: .claude/skills/${skillName}/SKILL.md`);
    return;
  }
  await writeFile(proxyPath, expected, "utf8");
  synced.push(`wrote .claude/skills/${skillName}/SKILL.md`);
}

async function assertNoStaleGeneratedProxies(canonicalNames) {
  let entries = [];
  try {
    entries = await readdir(mirrorRoot, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || canonicalNames.has(entry.name)) continue;
    const skillPath = path.join(mirrorRoot, entry.name, "SKILL.md");
    try {
      const content = await readFile(skillPath, "utf8");
      if (content.includes(GENERATED_MARKER)) {
        failures.push(`Stale generated proxy: .claude/skills/${entry.name}/SKILL.md`);
      }
    } catch {
      // Unrelated local Claude skill content is outside this sync contract.
    }
  }
}

for (const legacyRoot of [path.join(repoRoot, ".agents", "skills"), path.join(repoRoot, ".agents", "superpowers")]) {
  if (await exists(legacyRoot)) failures.push(`Legacy skill root still exists: ${path.relative(repoRoot, legacyRoot)}`);
}

const canonicalNames = new Set(skillGroups.flatMap((group) => group.names));
for (const skillName of canonicalNames) await syncProxy(skillName);
await assertNoStaleGeneratedProxies(canonicalNames);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(checkOnly ? "PASS agent skill proxies are in sync" : synced.join("\n"));
