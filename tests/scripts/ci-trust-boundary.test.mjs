import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const workflow = readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8");
const codeowners = readFileSync(path.join(root, ".github", "CODEOWNERS"), "utf8");

describe("CI trusted UI contract boundary", () => {
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
});
