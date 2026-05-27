#!/usr/bin/env node
// PR C — QA Gate fixture 회귀 테스트.
// 5개 fixture: PASS / missing FAIL / degraded bare FAIL / degraded with triple PASS / failed bare FAIL.

import { readFile } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkQaGate, internals } from "./ai-workflow-check.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");
const FIXTURE_DIR = join(
  REPO_ROOT,
  "docs",
  "ai-workflow",
  "fixtures",
  "qa-gate",
);

const cases = [
  {
    file: "fx-01-passes.md",
    changedFiles: ["src/app/library/page.tsx"],
    expectedNeedsUi: true,
    expectedCheckOk: true,
  },
  {
    file: "fx-02-missing-field.md",
    changedFiles: ["src/app/admin/users/page.tsx"],
    expectedNeedsUi: true,
    expectedCheckOk: false,
    expectedErrorIncludes: "missing 'QA Gate:' field",
  },
  {
    file: "fx-03-degraded-bare.md",
    changedFiles: ["src/app/settings/page.tsx"],
    expectedNeedsUi: true,
    expectedCheckOk: false,
    expectedErrorIncludes: "pipe-separated triple",
  },
  {
    file: "fx-04-degraded-with-triple.md",
    changedFiles: ["src/components/Profile.tsx"],
    expectedNeedsUi: true,
    expectedCheckOk: true,
  },
  {
    file: "fx-05-failed-bare.md",
    changedFiles: ["src/app/dashboard/page.tsx"],
    expectedNeedsUi: true,
    expectedCheckOk: false,
    expectedErrorIncludes: "'failed' requires a reason",
  },
];

let failures = 0;
let passes = 0;

for (const c of cases) {
  const content = await readFile(join(FIXTURE_DIR, c.file), "utf8");
  const needs = internals.needsUxuiConsistencyPass(c.changedFiles);

  if (needs !== c.expectedNeedsUi) {
    console.error(
      `FAIL ${c.file}: needsUi expected ${c.expectedNeedsUi}, got ${needs}`,
    );
    failures += 1;
    continue;
  }

  const result = checkQaGate(content, { phaseComplete: false });

  if (result.ok !== c.expectedCheckOk) {
    console.error(
      `FAIL ${c.file}: checkQaGate expected ok=${c.expectedCheckOk}, got ok=${result.ok}. Errors: ${result.errors.join(" | ")}`,
    );
    failures += 1;
    continue;
  }

  if (
    c.expectedErrorIncludes &&
    !result.errors.some((e) => e.includes(c.expectedErrorIncludes))
  ) {
    console.error(
      `FAIL ${c.file}: expected error containing "${c.expectedErrorIncludes}", got: ${result.errors.join(" | ")}`,
    );
    failures += 1;
    continue;
  }

  console.log(`PASS ${c.file}`);
  passes += 1;
}

console.log(`\n${passes}/${cases.length} fixtures PASS`);
if (failures > 0) {
  console.error(`${failures} fixture(s) failed`);
  process.exit(1);
}
