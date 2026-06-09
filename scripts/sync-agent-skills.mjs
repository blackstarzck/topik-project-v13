#!/usr/bin/env node

import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const mirrorRoots = [
  path.join(repoRoot, '.codex', 'skills'),
  path.join(repoRoot, '.claude', 'skills'),
];

const skillSets = [
  {
    label: 'TALKPIK',
    sourceRoot: path.join(repoRoot, '.agents', 'skills'),
    names: [
      'talkpik-orchestrator',
      'talkpik-next-bootstrap',
      'talkpik-ui-system',
      'talkpik-wireframe-ui-audit',
      'talkpik-state-data',
      'talkpik-supabase-boundary',
      'talkpik-quality-gate',
    ],
    unexpectedMirrorPrefix: 'talkpik-',
    mode: 'skill-md',
  },
  {
    label: 'Practical',
    sourceRoot: path.join(repoRoot, '.agents', 'skills'),
    names: [
      'next-best-practices',
      'next-cache-components',
      'next-upgrade',
      'vercel-composition-patterns',
      'deploy-to-vercel',
      'vercel-react-best-practices',
      'vercel-react-native-skills',
      'vercel-react-view-transitions',
      'vercel-cli-with-tokens',
      'web-design-guidelines',
      'supabase',
      'supabase-postgres-best-practices',
      'ant-design',
      'playwright-skill',
      'vitest-testing',
      'react-hook-form-zod',
    ],
    mode: 'directory',
  },
  {
    label: 'Superpowers',
    sourceRoot: path.join(repoRoot, '.agents', 'superpowers', 'skills'),
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
    mode: 'skill-md',
  },
];

const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check');
const listOnly = args.has('--list');

if (args.has('--help') || args.has('-h')) {
  console.log(`Usage: node scripts/sync-agent-skills.mjs [--check|--list]

Copies canonical TALKPIK and practical project skills from .agents/skills into
host-specific mirrors, and canonical Superpowers skills from
.agents/superpowers/skills into host-specific .codex/skills and .claude/skills
mirrors.

Options:
  --check  verify mirrors are in sync without writing files
  --list   print canonical skill names
`);
  process.exit(0);
}

if (listOnly) {
  for (const skillSet of skillSets) {
    console.log(`# ${skillSet.label}`);
    console.log(skillSet.names.join('\n'));
  }
  process.exit(0);
}

const failures = [];
const synced = [];

async function assertNoUnexpectedMirrors(root, skillSet) {
  if (!skillSet.unexpectedMirrorPrefix) {
    return;
  }

  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return;
  }

  const allowed = new Set(skillSet.names);
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith(skillSet.unexpectedMirrorPrefix)) {
      continue;
    }

    if (!allowed.has(entry.name)) {
      failures.push(`Unexpected ${skillSet.label} skill mirror: ${path.relative(repoRoot, path.join(root, entry.name))}`);
    }
  }
}

async function readSkill(skillSet, skillName) {
  const sourcePath = path.join(skillSet.sourceRoot, skillName, 'SKILL.md');
  try {
    return await readFile(sourcePath, 'utf8');
  } catch (error) {
    failures.push(`Missing canonical ${skillSet.label} skill: ${path.relative(repoRoot, sourcePath)} (${error.code ?? error.message})`);
    return null;
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

async function syncSkill(skillName, content, mirrorRoot) {
  const mirrorPath = path.join(mirrorRoot, skillName, 'SKILL.md');

  let current = null;
  try {
    current = await readFile(mirrorPath, 'utf8');
  } catch {
    current = null;
  }

  if (current === content) {
    synced.push(`ok ${path.relative(repoRoot, mirrorPath)}`);
    return;
  }

  if (checkOnly) {
    failures.push(`Out of sync: ${path.relative(repoRoot, mirrorPath)}`);
    return;
  }

  await mkdir(path.dirname(mirrorPath), { recursive: true });
  await writeFile(mirrorPath, content, 'utf8');
  synced.push(`wrote ${path.relative(repoRoot, mirrorPath)}`);
}

async function syncDirectory(skillSet, skillName, mirrorRoot) {
  const sourceDir = path.join(skillSet.sourceRoot, skillName);
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

for (const skillSet of skillSets) {
  for (const mirrorRoot of mirrorRoots) {
    await assertNoUnexpectedMirrors(mirrorRoot, skillSet);
  }

  for (const skillName of skillSet.names) {
    if (skillSet.mode === 'directory') {
      for (const mirrorRoot of mirrorRoots) {
        await syncDirectory(skillSet, skillName, mirrorRoot);
      }
      continue;
    }

    const content = await readSkill(skillSet, skillName);
    if (content === null) {
      continue;
    }

    for (const mirrorRoot of mirrorRoots) {
      await syncSkill(skillName, content, mirrorRoot);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(checkOnly ? 'PASS agent skill mirrors are in sync' : synced.join('\n'));
