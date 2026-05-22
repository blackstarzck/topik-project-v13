#!/usr/bin/env node
// PR B Task 4 — UX/UI Consistency Pass fixture 회귀 테스트.
// 5개 fixture를 각각 예상 결과와 비교. 1개라도 빗나가면 exit 1.

import { readFile } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkUxuiConsistencyPass,
  internals,
} from "./ai-workflow-check.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");
const FIXTURE_DIR = join(
  REPO_ROOT,
  "docs",
  "ai-workflow",
  "fixtures",
  "uxui-consistency-pass",
);

const cases = [
  {
    file: "fx-01-passes.md",
    changedFiles: ["src/app/foo.tsx"],
    expectedNeedsUxui: true,
    expectedCheckOk: true,
  },
  {
    file: "fx-02-missing-field.md",
    changedFiles: ["src/app/foo.tsx"],
    expectedNeedsUxui: true,
    expectedCheckOk: false,
    expectedErrorIncludes: "missing 'UX/UI Consistency Pass:' parent field",
  },
  {
    file: "fx-03-empty-value.md",
    changedFiles: ["src/app/foo.tsx"],
    expectedNeedsUxui: true,
    expectedCheckOk: false,
    expectedErrorIncludes: "Tokens",
  },
  {
    file: "fx-04-skipped-no-reason.md",
    changedFiles: ["src/app/foo.tsx"],
    expectedNeedsUxui: true,
    expectedCheckOk: false,
    expectedErrorIncludes: "Tokens",
  },
  {
    file: "fx-05-test-only-change.md",
    changedFiles: ["src/app/foo.test.tsx", "src/app/bar.spec.ts"],
    expectedNeedsUxui: false,
    expectedCheckOk: null,
  },
];

let failures = 0;
let passes = 0;

for (const c of cases) {
  const content = await readFile(join(FIXTURE_DIR, c.file), "utf8");
  const needs = internals.needsUxuiConsistencyPass(c.changedFiles);

  if (needs !== c.expectedNeedsUxui) {
    console.error(
      `FAIL ${c.file}: needsUxuiConsistencyPass expected ${c.expectedNeedsUxui}, got ${needs}`,
    );
    failures += 1;
    continue;
  }

  if (!c.expectedNeedsUxui) {
    console.log(`PASS ${c.file} (auto-exempt verified)`);
    passes += 1;
    continue;
  }

  const result = checkUxuiConsistencyPass(content);

  if (result.ok !== c.expectedCheckOk) {
    console.error(
      `FAIL ${c.file}: checkUxuiConsistencyPass expected ok=${c.expectedCheckOk}, got ok=${result.ok}. Errors: ${result.errors.join(" | ")}`,
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
