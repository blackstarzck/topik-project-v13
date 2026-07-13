import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const workflow = readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8");
const codeowners = readFileSync(path.join(root, ".github", "CODEOWNERS"), "utf8");

describe("CI trusted UI contract boundary", () => {
  it("does not persist checkout credentials before candidate code runs", () => {
    expect(workflow.match(/uses: actions\/checkout@v4/gu)).toHaveLength(2);
    expect(workflow.match(/persist-credentials: false/gu)).toHaveLength(2);
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
