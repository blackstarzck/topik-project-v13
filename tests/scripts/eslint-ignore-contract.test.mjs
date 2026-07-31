import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { ESLint } from "eslint";
import prettier from "prettier";

// Files ESLint would actually try to parse. Anything else in a gitignored
// directory (logs, screenshots, snapshots) is irrelevant to the lint gate.
const LINTABLE_EXTENSION = /\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts)$/;

// Upper bound on directory entries visited while looking for leaked files, so a
// runaway ignored directory can never turn this test into a full-disk walk.
const WALK_BUDGET = 5000;

const repositoryRoot = process.cwd();
const eslint = new ESLint({ cwd: repositoryRoot });

function gitIgnoredEntries() {
  const result = spawnSync(
    "git",
    ["ls-files", "--others", "--ignored", "--exclude-standard", "--directory"],
    { cwd: repositoryRoot, encoding: "utf8", windowsHide: true },
  );
  if (result.status !== 0) {
    throw new Error(`git ls-files failed: ${result.stderr}`);
  }
  return result.stdout.split("\n").filter(Boolean);
}

function collectLintableFiles(directory, budget, accumulator = []) {
  if (budget.remaining <= 0) return accumulator;
  let entries;
  try {
    entries = readdirSync(path.resolve(repositoryRoot, directory), {
      withFileTypes: true,
    });
  } catch {
    // Ignored directories are volatile local state; a vanished path is not a defect.
    return accumulator;
  }
  for (const entry of entries) {
    if (budget.remaining-- <= 0) return accumulator;
    const relativePath = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectLintableFiles(relativePath, budget, accumulator);
    } else if (LINTABLE_EXTENSION.test(entry.name)) {
      accumulator.push(relativePath);
    }
  }
  return accumulator;
}

describe("eslint ignore contract", () => {
  // Regression guard: `.worktrees/` is gitignored but was missing from the
  // ESLint config, so `eslint .` linted every sibling task worktree and failed
  // with thousands of errors from throwaway scripts. The nested `.scratch/`
  // case matters on its own because `globalIgnores` patterns are anchored to
  // the config root, so a bare `.scratch/**` never reaches a nested one.
  it("ignores sibling task worktrees including their nested throwaway scripts", async () => {
    const paths = [
      ".worktrees/shared-dev/src/app/page.tsx",
      ".worktrees/shared-dev/tests/lib/example.test.ts",
      ".worktrees/shared-dev/.scratch/diagnostic.mjs",
      ".worktrees/any-task-name/.scratch/nested/deep.js",
    ];
    for (const candidate of paths) {
      await expect(eslint.isPathIgnored(candidate)).resolves.toBe(true);
    }
  });

  // The ESLint and Prettier ignore lists use different pattern semantics
  // (root-anchored globs vs gitignore syntax), so "they mirror each other" only
  // holds while both are asserted. Prettier must skip sibling worktrees too.
  it("keeps the prettier ignore list aligned for sibling task worktrees", async () => {
    const info = await prettier.getFileInfo(
      ".worktrees/shared-dev/src/app/page.tsx",
      { ignorePath: path.join(repositoryRoot, ".prettierignore") },
    );
    expect(info.ignored).toBe(true);
  });

  // The general invariant behind the regression: whatever git refuses to track
  // must never reach the lint gate. This is checked against real on-disk state,
  // so it also covers gitignored directories nobody has thought of yet.
  it("never lints a file that git ignores", async () => {
    const budget = { remaining: WALK_BUDGET };
    const leaked = [];

    for (const entry of gitIgnoredEntries()) {
      if (entry.endsWith("/")) {
        // A covered directory needs no walk: an ignore pattern for the
        // directory applies to everything beneath it.
        if (await eslint.isPathIgnored(`${entry}__ignore_probe__.ts`)) continue;
        for (const file of collectLintableFiles(entry, budget)) {
          if (!(await eslint.isPathIgnored(file))) leaked.push(file);
        }
      } else if (LINTABLE_EXTENSION.test(entry)) {
        if (!(await eslint.isPathIgnored(entry))) leaked.push(entry);
      }
    }

    expect(leaked).toEqual([]);
  });
});
