#!/usr/bin/env node
// Learner migration authoring freeze guard.
//
// `supabase/migrations/*.sql` is frozen at the watermark below. That history was
// adopted byte for byte into topik-ai (`supabase/migrations-v13/`), which now owns
// both authoring and remote apply for the learner namespace. Editing a frozen file
// here breaks the parity proof that adoption rests on, and authoring a new one here
// splits ownership again.
//
// Still allowed under `supabase/migrations/`:
//   * `down/**`   rollback assets for migrations authored before the freeze
//   * `INDEX.md`  documentation of the existing history
//
// Refused: adding, editing, renaming or deleting a forward migration.
//
// There is deliberately no override switch. A violation is resolved by moving the
// file to topik-ai, not by renegotiating the watermark.

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const LEARNER_FREEZE_WATERMARK = "20260729120000";
export const ARCHIVE_TARGET = "topik-ai supabase/migrations-v13/";

const FORWARD_DIR = "supabase/migrations/";
const FORWARD_FILE = /^supabase\/migrations\/(\d{14})_[a-z0-9_]+\.sql$/u;
const SHA_PATTERN = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/iu;

export function isExemptPath(filePath) {
  return (
    filePath.startsWith(`${FORWARD_DIR}down/`)
    || filePath === `${FORWARD_DIR}INDEX.md`
  );
}

export function evaluateMigrationFreeze(entries) {
  const violations = [];
  let inspected = 0;

  for (const entry of entries) {
    if (!entry.path.startsWith(FORWARD_DIR)) continue;
    if (isExemptPath(entry.path)) continue;
    inspected += 1;

    const match = FORWARD_FILE.exec(entry.path);
    if (!match) {
      violations.push(
        `${entry.path}: unexpected file under ${FORWARD_DIR} (${entry.status}). `
        + "Only forward migrations, down/ rollbacks and INDEX.md belong here.",
      );
      continue;
    }

    if (entry.status === "A") {
      violations.push(
        `${entry.path}: new forward migration authored here. Learner authoring is frozen `
        + `at ${LEARNER_FREEZE_WATERMARK}; author it in ${ARCHIVE_TARGET} with a timestamp `
        + "above the watermark instead.",
      );
      continue;
    }

    if (entry.status === "R" || entry.status === "C") {
      violations.push(
        `${entry.path}: ${entry.status === "R" ? "renamed" : "copied"} to ${entry.renamedTo}. `
        + "Frozen history keeps its exact name — the adopted archive is matched by name and bytes.",
      );
      continue;
    }

    violations.push(
      `${entry.path}: frozen history changed (${entry.status}). `
      + (match[1] <= LEARNER_FREEZE_WATERMARK
        ? "This file is adopted byte for byte in the archive, so editing it breaks the parity proof. "
        : "")
      + "Fix it forward from topik-ai instead.",
    );
  }

  return { violations, inspected };
}

export function parseNameStatusZ(stdout) {
  const fields = String(stdout ?? "").split("\0").filter(Boolean);
  const entries = [];
  for (let index = 0; index < fields.length;) {
    const status = fields[index][0];
    // With -z, renames and copies emit three fields: status, source, destination.
    if (status === "R" || status === "C") {
      entries.push({ status, path: fields[index + 1], renamedTo: fields[index + 2] });
      index += 3;
      continue;
    }
    entries.push({ status, path: fields[index + 1] });
    index += 2;
  }
  return entries;
}

function changedEntriesFromGit(rootDir, baseRef) {
  if (!SHA_PATTERN.test(baseRef)) {
    throw new Error("Migration freeze base ref is invalid.");
  }
  const result = spawnSync(
    "git",
    ["diff", "--name-status", "-z", "-M", `${baseRef}...HEAD`, "--", FORWARD_DIR],
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
    throw new Error("Migration freeze changed-path inventory failed.");
  }
  return parseNameStatusZ(result.stdout);
}

function main() {
  const baseRef = process.env.MIGRATION_FREEZE_BASE_REF;
  if (baseRef === undefined || baseRef.length === 0) {
    // No base ref means there is no diff to judge (local run, or a push to a fresh
    // ref). This is a diff gate, so staying quiet is correct rather than failing.
    console.log(
      `Learner migration freeze guard skipped: no MIGRATION_FREEZE_BASE_REF (watermark ${LEARNER_FREEZE_WATERMARK}).`,
    );
    return 0;
  }

  const { violations, inspected } = evaluateMigrationFreeze(
    changedEntriesFromGit(process.cwd(), baseRef),
  );

  if (violations.length > 0) {
    console.error(`Learner migration freeze violated (watermark ${LEARNER_FREEZE_WATERMARK}):\n`);
    for (const issue of violations) console.error(`  - ${issue}`);
    console.error(
      `\nWhy: this history is adopted byte for byte in ${ARCHIVE_TARGET}, which owns `
      + "learner authoring and apply. See supabase/README.md.",
    );
    return 1;
  }

  console.log(
    `Learner migration freeze holds (watermark ${LEARNER_FREEZE_WATERMARK}; `
    + `${inspected} forward path(s) inspected, down/ and INDEX.md exempt).`,
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
