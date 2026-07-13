import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const workflow = readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8");
const codeowners = readFileSync(path.join(root, ".github", "CODEOWNERS"), "utf8");

function checkoutStepBlocks(source) {
  const lines = source.split(/\r?\n/u);
  const blocks = [];

  for (const [index, line] of lines.entries()) {
    const usesMatch = line.match(/^(\s*)uses:\s*actions\/checkout@v4\s*$/u);
    if (!usesMatch) continue;

    const stepIndent = Math.max(0, usesMatch[1].length - 2);
    const stepPrefix = `${" ".repeat(stepIndent)}- `;
    let start = index;
    while (start >= 0 && !lines[start].startsWith(stepPrefix)) start -= 1;
    if (start < 0) continue;

    let end = index + 1;
    while (end < lines.length) {
      const nextLine = lines[end];
      const nextIndent = nextLine.match(/^\s*/u)?.[0].length ?? 0;
      if (nextLine.trim() && nextIndent <= stepIndent) break;
      end += 1;
    }
    blocks.push({ lines: lines.slice(start, end), propertyIndent: usesMatch[1].length });
  }

  return blocks;
}

function disablesCheckoutCredentialPersistence({ lines, propertyIndent }) {
  const propertyPrefix = " ".repeat(propertyIndent);
  const valuePrefix = " ".repeat(propertyIndent + 2);
  const withIndex = lines.findIndex((line) => line === `${propertyPrefix}with:`);
  if (withIndex < 0) return false;

  for (const line of lines.slice(withIndex + 1)) {
    const lineIndent = line.match(/^\s*/u)?.[0].length ?? 0;
    if (line.trim() && lineIndent <= propertyIndent) break;
    if (line === `${valuePrefix}persist-credentials: false`) return true;
  }

  return false;
}

describe("CI trusted UI contract boundary", () => {
  it("does not persist checkout credentials before candidate code runs", () => {
    const checkoutSteps = checkoutStepBlocks(workflow);

    expect(checkoutSteps).toHaveLength(2);
    for (const checkoutStep of checkoutSteps) {
      expect(disablesCheckoutCredentialPersistence(checkoutStep)).toBe(true);
    }
  });

  it("does not accept a misplaced credential setting outside checkout with", () => {
    const tamperedWorkflow = workflow
      .replace("          persist-credentials: false", "          persist-credentials: true")
      .replace("          fetch-depth: 0", "          fetch-depth: 0\n        env:\n          persist-credentials: false");

    const checkoutSteps = checkoutStepBlocks(tamperedWorkflow);

    expect(checkoutSteps).toHaveLength(2);
    expect(checkoutSteps.some(disablesCheckoutCredentialPersistence)).toBe(true);
    expect(checkoutSteps.every(disablesCheckoutCredentialPersistence)).toBe(false);
  });

  it("runs the trusted check before enabling the candidate package manager", () => {
    const trustedCheck = workflow.indexOf("Check UI contract diff baseline");
    const corepack = workflow.indexOf("Enable corepack (pnpm)");
    const install = workflow.indexOf("Install dependencies");

    expect(trustedCheck).toBeGreaterThan(0);
    expect(corepack).toBeGreaterThan(trustedCheck);
    expect(install).toBeGreaterThan(corepack);
  });

  it("materializes the base runner in a fresh runner-owned directory", () => {
    expect(workflow).toContain('umask 077');
    expect(workflow).toContain('mktemp -d "${RUNNER_TEMP}/ui-contract.XXXXXXXX"');
    expect(workflow).toContain('trap \'rm -rf "${trusted_root}"\' EXIT');
    expect(workflow).toContain('git ls-tree');
    expect(workflow).toContain('100644');
    expect(workflow).not.toContain('trusted_root=".ui-contract-trusted-runner"');
  });

  it("uses only a base-owned minimal npm runtime before candidate install", () => {
    expect(workflow).toContain("config/ui-contract-runtime/package.json");
    expect(workflow).toContain("config/ui-contract-runtime/package-lock.json");
    expect(workflow).toContain("npm ci --ignore-scripts --no-audit --no-fund");
    expect(workflow).toContain("npm_config_userconfig");
    expect(workflow).toContain("BOOTSTRAP_NOT_INDEPENDENTLY_TAMPER_PROOF");
    expect(codeowners).toMatch(/^\/config\/ui-contract-runtime\/\s+@blackstarzck$/mu);
  });

  it("requires owner review for every workflow enforcement surface", () => {
    for (const ownedPath of [
      "/.claude/skills/",
      "/CLAUDE.md",
      "/scripts/sync-agent-skills.mjs",
      "/scripts/lib/task-lifecycle-registry.mjs",
      "/scripts/lib/task-lifecycle-schema.mjs",
      "/scripts/lib/worktree-lifecycle.mjs",
      "/scripts/report-worktree-lifecycle.mjs",
    ]) {
      expect(codeowners).toContain(`${ownedPath} @blackstarzck`);
    }
  });
});
