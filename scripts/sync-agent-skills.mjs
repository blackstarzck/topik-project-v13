#!/usr/bin/env node

import { cp, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const sourceRoot = path.join(repoRoot, '.codex', 'skills');
const mirrorRoots = [path.join(repoRoot, '.claude', 'skills')];

const skillGroups = [
  {
    label: 'Superpowers',
    names: [
      'brainstorming',
      'dispatching-parallel-agents',
      'executing-plans',
      'finishing-a-development-branch',
      'receiving-code-review',
      'requesting-code-review',
      'subagent-driven-development',
      'systematic-debugging',
      'test-driven-development',
      'using-git-worktrees',
      'using-superpowers',
      'verification-before-completion',
      'writing-plans',
      'writing-skills',
    ],
  },
];

if (await exists(path.join(sourceRoot, 'gstack'))) {
  skillGroups.push({
    label: 'GStack',
    names: ['gstack'],
  });
}

const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check');
const listOnly = args.has('--list');
const failures = [];
const synced = [];

if (args.has('--help') || args.has('-h')) {
  console.log(`Usage: node scripts/sync-agent-skills.mjs [--check|--list]

Copies canonical Superpowers and optional gstack skills from .codex/skills into
host-specific mirrors. Product, stack, and implementation guidance lives in
AGENTS.md and docs/ instead of extra Codex runtime skills.

Options:
  --check  verify mirrors are in sync without writing files
  --list   print canonical skill names
`);
  process.exit(0);
}

if (listOnly) {
  for (const group of skillGroups) {
    console.log(`# ${group.label}`);
    console.log(group.names.join('\n'));
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

async function listFiles(root, current = root, options = {}) {
  const { recordMissing = true } = options;
  let entries;
  try {
    entries = await readdir(current, { withFileTypes: true });
  } catch (error) {
    if (recordMissing) {
      failures.push(`Missing skill directory: ${path.relative(repoRoot, current)} (${error.code ?? error.message})`);
    }
    return null;
  }

  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      const nested = await listFiles(root, entryPath, options);
      if (nested === null) {
        return null;
      }
      files.push(...nested);
      continue;
    }

    if (entry.isFile()) {
      files.push(path.relative(root, entryPath).split(path.sep).join('/'));
    }
  }

  files.sort();
  return files;
}

async function assertLegacySkillRootsRemoved() {
  const legacyRoots = [
    path.join(repoRoot, '.agents', 'skills'),
    path.join(repoRoot, '.agents', 'superpowers'),
  ];

  for (const legacyRoot of legacyRoots) {
    if (await exists(legacyRoot)) {
      failures.push(`Legacy skill root still exists: ${path.relative(repoRoot, legacyRoot)}`);
    }
  }
}

async function syncDirectory(skillName, mirrorRoot) {
  const sourceDir = path.join(sourceRoot, skillName);
  const mirrorDir = path.join(mirrorRoot, skillName);
  const sourceFiles = await listFiles(sourceDir);

  if (sourceFiles === null) {
    return;
  }

  const mirrorFiles = await listFiles(mirrorDir, mirrorDir, { recordMissing: false });
  let inSync = mirrorFiles !== null && sourceFiles.length === mirrorFiles.length;

  if (inSync) {
    for (let index = 0; index < sourceFiles.length; index += 1) {
      if (sourceFiles[index] !== mirrorFiles[index]) {
        inSync = false;
        break;
      }

      const sourceContent = await readFile(path.join(sourceDir, sourceFiles[index]));
      const mirrorContent = await readFile(path.join(mirrorDir, mirrorFiles[index]));
      if (!sourceContent.equals(mirrorContent)) {
        inSync = false;
        break;
      }
    }
  }

  if (inSync) {
    synced.push(`ok ${path.relative(repoRoot, mirrorDir)}`);
    return;
  }

  if (checkOnly) {
    failures.push(`Out of sync: ${path.relative(repoRoot, mirrorDir)}`);
    return;
  }

  await rm(mirrorDir, { recursive: true, force: true });
  await mkdir(path.dirname(mirrorDir), { recursive: true });
  await cp(sourceDir, mirrorDir, { recursive: true });
  synced.push(`wrote ${path.relative(repoRoot, mirrorDir)}`);
}

await assertLegacySkillRootsRemoved();

for (const group of skillGroups) {
  for (const skillName of group.names) {
    for (const mirrorRoot of mirrorRoots) {
      await syncDirectory(skillName, mirrorRoot);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(checkOnly ? 'PASS agent skill mirrors are in sync' : synced.join('\n'));
