import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const workflow = readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8");
const codeowners = readFileSync(path.join(root, ".github", "CODEOWNERS"), "utf8");
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const vitestConfig = readFileSync(path.join(root, "vitest.config.ts"), "utf8");
const lifecycleTestPaths = [
  "tests/scripts/worktree-lifecycle.test.mjs",
  "tests/scripts/report-worktree-lifecycle.test.mjs",
  "tests/scripts/ai-task-lifecycle-v2.test.mjs",
  "tests/scripts/ai-task-cleanup.test.mjs",
];

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

function jobBlock(jobId) {
  const lines = workflow.split(/\r?\n/u);
  const start = lines.findIndex((line) => line === `  ${jobId}:`);
  if (start < 0) return "";

  let end = start + 1;
  while (end < lines.length && !/^  [a-z0-9-]+:\s*$/u.test(lines[end])) {
    end += 1;
  }
  return lines.slice(start, end).join("\n");
}

function jobStepRunScript(jobId, stepName) {
  const lines = jobBlock(jobId).split(/\r?\n/u);
  const stepStart = lines.findIndex((line) => line === `      - name: ${stepName}`);
  const runStart = lines.findIndex(
    (line, index) => index > stepStart && line === "        run: |",
  );
  if (stepStart < 0 || runStart < 0) return "";

  const scriptLines = [];
  for (const line of lines.slice(runStart + 1)) {
    const indentation = line.match(/^\s*/u)?.[0].length ?? 0;
    if (line.trim() && indentation <= 8) break;
    scriptLines.push(line.startsWith("          ") ? line.slice(10) : line);
  }
  return scriptLines.join("\n");
}

function runBashScript(source, environment = {}) {
  const shellQuote = (value) => `'${String(value).replaceAll("'", `'\\''`)}'`;
  const exports = Object.entries(environment).map(([name, value]) => {
    if (!/^[A-Z][A-Z0-9_]*$/u.test(name)) throw new Error(`invalid env name: ${name}`);
    return `export ${name}=${shellQuote(value)}`;
  });
  const encoded = Buffer.from([...exports, source].join("\n"), "utf8").toString(
    "base64",
  );
  return spawnSync("bash", ["-c", `printf %s ${encoded} | base64 -d | bash`], {
    encoding: "utf8",
  });
}

function bashTimingHarness(startSetup, script) {
  return [
    'summary_path="$(mktemp)"',
    'trap \'rm -f "$summary_path"\' EXIT',
    'GITHUB_STEP_SUMMARY="$summary_path"',
    startSetup,
    script,
    'cat "$summary_path"',
  ].join("\n");
}

function topLevelBlock(source, key) {
  const lines = source.split(/\r?\n/u);
  const start = lines.findIndex((line) => line === `${key}:`);
  if (start < 0) return "";

  let end = start + 1;
  while (end < lines.length && (!lines[end].trim() || /^\s/u.test(lines[end]))) {
    end += 1;
  }
  return lines.slice(start, end).join("\n");
}

function concurrencyPolicy(source) {
  const block = topLevelBlock(source, "concurrency");
  const properties = Object.create(null);
  for (const line of block.split(/\r?\n/u).slice(1)) {
    const match = line.match(/^  ([a-z-]+):\s*(.+)$/u);
    if (match) properties[match[1]] = match[2];
  }
  return properties;
}

function configGlobPatterns(configSource, key) {
  const block = configSource.match(new RegExp(`${key}:\\s*\\[([\\s\\S]*?)\\]`, "u"));
  return block ? [...block[1].matchAll(/"([^"]+)"/gu)].map((match) => match[1]) : [];
}

function fullTestCoversLifecycle(testScript, configSource) {
  const includes = configGlobPatterns(configSource, "include");
  const excludes = configGlobPatterns(configSource, "exclude");
  return (
    testScript.trim() === "vitest run" &&
    lifecycleTestPaths.every(
      (relativePath) =>
        includes.some((pattern) => path.matchesGlob(relativePath, pattern)) &&
        !excludes.some((pattern) => path.matchesGlob(relativePath, pattern)),
    )
  );
}

describe("CI trusted UI contract boundary", () => {
  it("covers pull request state transitions, merge queues, and main pushes", () => {
    expect(workflow).toMatch(/\n\s*pull_request:\s*\n/u);
    expect(topLevelBlock(workflow, "on")).toContain(
      "types: [opened, synchronize, reopened, ready_for_review, converted_to_draft]",
    );
    expect(workflow).toMatch(/\n\s*merge_group:\s*\n/u);
    expect(workflow).toMatch(/\n\s*push:\s*\n\s*branches:\s*\[main\]/u);
    expect(workflow).not.toMatch(/collab/u);
    expect(concurrencyPolicy(workflow)).toMatchObject({
      group: expect.stringContaining("github.event.pull_request.number"),
      "cancel-in-progress": "${{ github.event_name == 'pull_request' }}",
    });
    for (const jobId of ["verify", "lifecycle-windows"]) {
      expect(jobBlock(jobId)).toContain("github.event.pull_request.draft == false");
    }

    const missingDraftTransition = workflow.replace(", converted_to_draft", "");
    expect(topLevelBlock(missingDraftTransition, "on")).not.toContain(
      "converted_to_draft",
    );
  });

  it("does not persist checkout credentials before candidate code runs", () => {
    const checkoutSteps = checkoutStepBlocks(workflow);

    expect(checkoutSteps).toHaveLength(3);
    for (const checkoutStep of checkoutSteps) {
      expect(disablesCheckoutCredentialPersistence(checkoutStep)).toBe(true);
    }
  });

  it("does not accept a misplaced credential setting outside checkout with", () => {
    const tamperedWorkflow = workflow
      .replace("          persist-credentials: false", "          persist-credentials: true")
      .replace("          fetch-depth: 0", "          fetch-depth: 0\n        env:\n          persist-credentials: false");

    const checkoutSteps = checkoutStepBlocks(tamperedWorkflow);

    expect(checkoutSteps).toHaveLength(3);
    expect(checkoutSteps.some(disablesCheckoutCredentialPersistence)).toBe(true);
    expect(checkoutSteps.every(disablesCheckoutCredentialPersistence)).toBe(false);
  });

  it("cancels only superseded runs for the same pull request", () => {
    const expectedPolicy = {
      group:
        "ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.event.merge_group.head_sha || github.ref }}",
      "cancel-in-progress": "${{ github.event_name == 'pull_request' }}",
    };

    expect(concurrencyPolicy(workflow)).toEqual(expectedPolicy);

    const wrongFallback = workflow.replace(
      expectedPolicy.group,
      "ci-${{ github.workflow }}-${{ github.ref }}",
    );
    expect(concurrencyPolicy(wrongFallback)).not.toEqual(expectedPolicy);

    const neverCancel = workflow.replace(
      expectedPolicy["cancel-in-progress"],
      "${{ false }}",
    );
    expect(concurrencyPolicy(neverCancel)).not.toEqual(expectedPolicy);

    const decoyOutsideConcurrency = [
      "name: decoy",
      "jobs:",
      "  fake:",
      `    group: ${expectedPolicy.group}`,
      `    cancel-in-progress: ${expectedPolicy["cancel-in-progress"]}`,
    ].join("\n");
    expect(concurrencyPolicy(decoyOutsideConcurrency)).toEqual({});
  });

  it("runs heavy required jobs only for ready pull requests and merge groups", () => {
    for (const jobId of ["verify", "lifecycle-windows"]) {
      const job = jobBlock(jobId);
      expect(job).toContain("github.event_name != 'push'");
      expect(job).toContain("github.event.pull_request.draft == false");
    }

    expect(jobBlock("verify")).toContain("name: typecheck / test / lint / build");
    expect(jobBlock("lifecycle-windows")).toContain(
      "name: report-only worktree lifecycle / windows",
    );
  });

  it("uses a dependency-free nonrequired integrity job for main pushes", () => {
    const integrityJob = jobBlock("main-integrity");

    expect(integrityJob).toContain("if: github.event_name == 'push'");
    expect(integrityJob).toContain("name: main branch integrity (nonrequired)");
    expect(integrityJob).toContain("node scripts/check-project-structure.mjs");
    expect(integrityJob).toContain("node scripts/check-agent-skill-policy.mjs");
    expect(integrityJob).toContain("node scripts/sync-agent-skills.mjs --check");
    expect(integrityJob).not.toContain("corepack");
    expect(integrityJob).not.toContain("pnpm install");
    expect(integrityJob).not.toContain("pnpm test");
    expect(integrityJob).not.toContain("pnpm build");
  });

  it("aggregates the three event-specific jobs into one stable required check", () => {
    const requiredJob = jobBlock("required");

    expect(requiredJob).toContain("name: CI required");
    expect(requiredJob).toContain("if: ${{ always() }}");
    expect(requiredJob).toContain(
      "needs: [verify, lifecycle-windows, main-integrity]",
    );
    expect(requiredJob).toContain("runs-on: ubuntu-latest");
    expect(requiredJob).toContain("timeout-minutes: 2");
    expect(requiredJob).toContain("CI_EVENT_NAME: ${{ github.event_name }}");
    expect(requiredJob).toContain(
      "CI_PULL_REQUEST_DRAFT: ${{ github.event.pull_request.draft }}",
    );
    expect(requiredJob).toContain("CI_VERIFY_RESULT: ${{ needs.verify.result }}");
    expect(requiredJob).toContain(
      "CI_LIFECYCLE_WINDOWS_RESULT: ${{ needs.lifecycle-windows.result }}",
    );
    expect(requiredJob).toContain(
      "CI_MAIN_INTEGRITY_RESULT: ${{ needs.main-integrity.result }}",
    );
    expect(requiredJob).not.toContain("actions/checkout");
    expect(requiredJob).not.toContain("actions/setup-node");
    expect(requiredJob).not.toContain("corepack");
    expect(requiredJob).not.toContain("pnpm");
    expect(requiredJob).not.toContain("continue-on-error");
  });

  it("accepts only the expected predecessor results for each supported event", () => {
    const script = jobStepRunScript("required", "Require expected CI results");
    expect(script).not.toBe("");

    const runRequired = ({
      eventName,
      draft = "",
      verify,
      windows,
      integrity,
    }) =>
      runBashScript(script, {
        CI_EVENT_NAME: eventName,
        CI_PULL_REQUEST_DRAFT: draft,
        CI_VERIFY_RESULT: verify,
        CI_LIFECYCLE_WINDOWS_RESULT: windows,
        CI_MAIN_INTEGRITY_RESULT: integrity,
      });

    for (const scenario of [
      {
        eventName: "pull_request",
        draft: "true",
        verify: "skipped",
        windows: "skipped",
        integrity: "skipped",
      },
      {
        eventName: "pull_request",
        draft: "false",
        verify: "success",
        windows: "success",
        integrity: "skipped",
      },
      {
        eventName: "merge_group",
        verify: "success",
        windows: "success",
        integrity: "skipped",
      },
      {
        eventName: "push",
        verify: "skipped",
        windows: "skipped",
        integrity: "success",
      },
    ]) {
      const result = runRequired(scenario);
      expect(result.status, `${JSON.stringify(scenario)}\n${result.stderr}`).toBe(0);
    }

    for (const scenario of [
      // Draft PRs must not run any predecessor.
      {
        eventName: "pull_request",
        draft: "true",
        verify: "success",
        windows: "skipped",
        integrity: "skipped",
      },
      // Ready PRs and merge groups require both full suites.
      {
        eventName: "pull_request",
        draft: "false",
        verify: "failure",
        windows: "success",
        integrity: "skipped",
      },
      {
        eventName: "merge_group",
        verify: "success",
        windows: "cancelled",
        integrity: "skipped",
      },
      // Main pushes require the lightweight integrity job only.
      {
        eventName: "push",
        verify: "skipped",
        windows: "success",
        integrity: "success",
      },
      {
        eventName: "push",
        verify: "skipped",
        windows: "skipped",
        integrity: "failure",
      },
      // Unknown events, unknown draft state, missing values, and unexpected skips fail closed.
      {
        eventName: "workflow_dispatch",
        verify: "success",
        windows: "success",
        integrity: "skipped",
      },
      {
        eventName: "pull_request",
        draft: "",
        verify: "success",
        windows: "success",
        integrity: "skipped",
      },
      {
        eventName: "merge_group",
        verify: "skipped",
        windows: "success",
        integrity: "skipped",
      },
      {
        eventName: "push",
        verify: "skipped",
        windows: "skipped",
        integrity: "",
      },
    ]) {
      const result = runRequired(scenario);
      expect(result.status, JSON.stringify(scenario)).not.toBe(0);
    }
  });

  it("records observed service time without inventing queue time", () => {
    for (const jobId of ["verify", "lifecycle-windows"]) {
      const job = jobBlock(jobId);
      expect(job).toContain("CI_SERVICE_STARTED_EPOCH");
      expect(job).toContain("GITHUB_STEP_SUMMARY");
      expect(job).toContain("service_time_seconds");
      expect(job).toContain("queue_time_seconds: unavailable");
      expect(job).toContain("GitHub run API");
    }

    expect(jobBlock("verify")).toContain("shell: bash");
    expect(jobBlock("lifecycle-windows")).toContain("shell: pwsh");
  });

  it("reports unavailable service time when the start epoch is invalid", () => {
    const verifyJob = jobBlock("verify");
    expect(verifyJob).toContain("CI_SERVICE_STARTED_EPOCH:-");
    expect(verifyJob).toContain("=~ ^[1-9][0-9]{0,14}$");
    expect(verifyJob).toContain("started_epoch <= ended_epoch");
    expect(verifyJob).toContain("ended_epoch - started_epoch");
    expect(verifyJob).not.toContain("10#$started_epoch");
    expect(verifyJob).toContain(
      'service_time_line="- service_time_seconds: unavailable"',
    );

    const windowsJob = jobBlock("lifecycle-windows");
    expect(windowsJob).toContain("[long]::TryParse");
    expect(windowsJob).toContain("$startedEpoch -gt 0");
    expect(windowsJob).toContain("$startedEpoch -le $endedEpoch");
    expect(windowsJob).toContain(
      '$serviceTimeLine = "- service_time_seconds: unavailable"',
    );
  });

  it("executes the Bash timing guard safely for missing, invalid, and valid epochs", () => {
    const script = jobStepRunScript("verify", "Summarize CI timing");
    expect(script).not.toBe("");

    for (const startEpoch of [undefined, "not-a-number"]) {
      const startSetup =
        startEpoch === undefined
          ? "unset CI_SERVICE_STARTED_EPOCH"
          : `CI_SERVICE_STARTED_EPOCH=${startEpoch}`;
      const result = runBashScript(bashTimingHarness(startSetup, script));

      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain("service_time_seconds: unavailable");
    }

    const validStart = String(Math.floor(Date.now() / 1000) - 1);
    const validResult = runBashScript(
      bashTimingHarness(`CI_SERVICE_STARTED_EPOCH=${validStart}`, script),
    );
    expect(validResult.status, validResult.stderr).toBe(0);
    expect(validResult.stdout).toMatch(/service_time_seconds: \d+/u);
    expect(validResult.stdout).not.toContain("service_time_seconds: unavailable");
  });

  it("runs the trusted check before enabling the candidate package manager", () => {
    const trustedCheck = workflow.indexOf("Check UI contract diff baseline");
    const artifactCheck = workflow.indexOf("Check artifact hygiene diff baseline (trusted)");
    const corepack = workflow.indexOf("Enable corepack (pnpm)");
    const install = workflow.indexOf("Install dependencies");

    expect(trustedCheck).toBeGreaterThan(0);
    expect(artifactCheck).toBeGreaterThan(trustedCheck);
    expect(corepack).toBeGreaterThan(artifactCheck);
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
    expect(workflow).toContain('mktemp -d "${RUNNER_TEMP}/artifact-hygiene.XXXXXXXX"');
    expect(workflow).toContain('git show "${ARTIFACT_HYGIENE_BASE_SHA}:${repo_path}"');
    expect(workflow).toContain('node "${trusted_root}/scripts/run-trusted-artifact-hygiene.mjs"');
    expect(workflow).toContain('"scripts/lib/artifact-manifest-v2.mjs"');
    expect(workflow).toContain("--allow-bootstrap");
  });

  it("pins the trusted artifact baseline for every supported event", () => {
    expect(workflow).toContain("github.event.pull_request.base.sha");
    expect(workflow).toContain("github.event.merge_group.base_sha");
    expect(workflow).toContain("github.event.before");
    expect(workflow).toContain("ARTIFACT_BASE_EVENT_UNSUPPORTED");
  });

  it("gates trusted artifact bootstrap for pull requests and merge groups", () => {
    expect(workflow).toContain("pull_request)");
    expect(workflow).toContain("merge_group)");
    expect(workflow).toContain(
      "github.event.pull_request.head.sha || vars.ARTIFACT_HYGIENE_BOOTSTRAP_APPROVED_HEAD_SHA",
    );
    expect(workflow).toContain("ARTIFACT_HYGIENE_WORKSPACE_HEAD_SHA: ${{ github.sha }}");
    expect(workflow).toContain('git merge-base --is-ancestor "${ARTIFACT_HYGIENE_BASE_SHA}" HEAD');
    expect(workflow).toContain("ARTIFACT_BOOTSTRAP_PARTIAL_BASE");
    expect(workflow).toContain("vars.ARTIFACT_HYGIENE_BOOTSTRAP_APPROVED_HEAD_SHA");
    expect(workflow).toContain("ARTIFACT_BOOTSTRAP_EXTERNAL_APPROVAL_REQUIRED");
    const candidateBinding =
      "ARTIFACT_HYGIENE_CANDIDATE_HEAD_SHA: ${{ github.event.pull_request.head.sha || vars.ARTIFACT_HYGIENE_BOOTSTRAP_APPROVED_HEAD_SHA }}";
    const candidateArgument =
      '--candidate-head-sha "${ARTIFACT_HYGIENE_CANDIDATE_HEAD_SHA}"';
    const candidateBindingIndex = workflow.indexOf(candidateBinding);
    const candidateArgumentIndex = workflow.indexOf(
      candidateArgument,
      candidateBindingIndex,
    );
    expect(candidateBindingIndex).toBeGreaterThan(-1);
    expect(candidateArgumentIndex).toBeGreaterThan(candidateBindingIndex);
    expect(workflow).toContain("workspace_head_sha");
    expect(workflow).toContain("ARTIFACT_BOOTSTRAP_WORKSPACE_HEAD_MISMATCH");
    expect(workflow).toContain(
      "ARTIFACT_HYGIENE_PR_BASE_REF: ${{ github.event.pull_request.base.ref }}",
    );
    expect(workflow).toContain(
      "ARTIFACT_HYGIENE_MERGE_GROUP_BASE_REF: ${{ github.event.merge_group.base_ref }}",
    );
    expect(workflow).toContain(
      '[[ "${ARTIFACT_HYGIENE_PR_BASE_REF}" == "main" ]]',
    );
    expect(workflow).toContain(
      '[[ "${ARTIFACT_HYGIENE_MERGE_GROUP_BASE_REF}" == "refs/heads/main" ]]',
    );
    expect(workflow).toContain("ARTIFACT_BOOTSTRAP_TARGET_NOT_MAIN");
  });

  it("keeps lifecycle coverage in Windows and the Linux full test suite", () => {
    expect(workflow.match(/run: pnpm check:worktree-lifecycle/gu)).toHaveLength(
      1,
    );
    expect(workflow.match(/run: pnpm check:task-lifecycle/gu)).toHaveLength(1);
    expect(jobBlock("verify")).toContain("run: pnpm test");
    expect(fullTestCoversLifecycle(packageJson.scripts.test, vitestConfig)).toBe(true);

    for (const relativePath of lifecycleTestPaths) {
      expect(readFileSync(path.join(root, relativePath), "utf8").length).toBeGreaterThan(0);
    }

    expect(fullTestCoversLifecycle("vitest run tests/unit", vitestConfig)).toBe(false);
    expect(
      fullTestCoversLifecycle(
        packageJson.scripts.test,
        vitestConfig.replace(
          'include: ["tests/**/*.{test,spec}.{ts,tsx,mjs}"]',
          'include: ["tests/unit/**/*.{test,spec}.{ts,tsx,mjs}"]',
        ),
      ),
    ).toBe(false);
    expect(
      fullTestCoversLifecycle(
        packageJson.scripts.test,
        vitestConfig.replace(
          "exclude: [",
          'exclude: [\n      "tests/scripts/ai-task-cleanup.test.mjs",',
        ),
      ),
    ).toBe(false);
    expect(
      fullTestCoversLifecycle(
        packageJson.scripts.test,
        vitestConfig.replace(
          "exclude: [",
          'exclude: [\n      "tests/scripts/ai-task-*.test.mjs",',
        ),
      ),
    ).toBe(false);
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
      "/.claude/CLAUDE.md",
      "/scripts/sync-agent-skills.mjs",
      "/scripts/lib/task-lifecycle-registry.mjs",
      "/scripts/lib/task-lifecycle-schema.mjs",
      "/scripts/lib/worktree-lifecycle.mjs",
      "/scripts/report-worktree-lifecycle.mjs",
      "/scripts/run-trusted-artifact-hygiene.mjs",
      "/scripts/lib/artifact-hygiene.mjs",
      "/scripts/lib/ai-task-lifecycle-v2.mjs",
      "/scripts/lib/ai-task-cleanup.mjs",
      "/scripts/ai-task.mjs",
      "/scripts/check-github-owner-auth.mjs",
      "/scripts/lib/github-owner-auth.mjs",
      "/package.json",
    ]) {
      expect(codeowners).toContain(`${ownedPath} @blackstarzck`);
    }
  });
});
