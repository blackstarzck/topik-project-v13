import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  checkCommitMessage,
  checkPullRequestBody,
  checkRepositoryState,
} from "./ai-workflow-check.mjs";

async function withTempRepo(testFn) {
  const root = await mkdtemp(join(tmpdir(), "ai-workflow-check-"));
  try {
    await testFn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function testPullRequestBodyRequiresEvidenceSections() {
  const validBody = [
    "## Summary",
    "- Harden workflow gates",
    "## Why",
    "- Prevent missed verification",
    "## Docs Consulted",
    "- docs/ai-development-workflow.md",
    "## Review",
    "- Review status: self-review completed",
    "## Verification",
    "- Commands/checks run: node scripts/ai-workflow-check.selftest.mjs",
    "- Results: pass",
    "## Git Publication Decision",
    "Git publication decision: local-commit",
    "Reason: local hardening only",
    "Branch: main",
    "Upstream: origin/main",
    "Dirty scope: intended files only",
    "Review status: completed",
    "Verification status: passed",
    "Ledger: docs/ai-workflow/runs/20260519-1116-ai-workflow-analysis.md",
    "Fallback status: none",
    "Next git action: none",
    "## Risks And Skipped Checks",
    "- none",
  ].join("\n");

  const validResult = checkPullRequestBody(validBody);
  assert.equal(validResult.ok, true);

  const invalidResult = checkPullRequestBody("## Summary\n- Missing evidence");
  assert.equal(invalidResult.ok, false);
  assert.ok(
    invalidResult.errors.some((error) =>
      error.includes("missing required section: ## Docs Consulted"),
    ),
  );
}

async function testRepositoryStateRequiresLedgerWhenImplementationFilesChange() {
  await withTempRepo(async (root) => {
    await writeFile(join(root, "scripts-change.txt"), "placeholder");

    const missingLedger = await checkRepositoryState({
      root,
      changedFiles: ["scripts/ai-workflow-check.mjs"],
    });
    assert.equal(missingLedger.ok, false);
    assert.ok(
      missingLedger.errors.some((error) =>
        error.includes("implementation/config workflow changes require a run ledger"),
      ),
    );

    const missingAgentsLedger = await checkRepositoryState({
      root,
      changedFiles: [".agents/superpowers/skills/using-superpowers/SKILL.md"],
    });
    assert.equal(missingAgentsLedger.ok, false);
    assert.ok(
      missingAgentsLedger.errors.some((error) =>
        error.includes("implementation/config workflow changes require a run ledger"),
      ),
    );

    const ledgerPath = join(
      root,
      "docs",
      "ai-workflow",
      "runs",
      "20260519-1116-ai-workflow-analysis.md",
    );
    await writeFile(
      ledgerPath,
      [
        "# Ledger",
        "## Docs Consulted",
        "## Verification State",
        "## Ledger/File-State Consistency",
      ].join("\n"),
    ).catch(async (error) => {
      if (error.code !== "ENOENT") throw error;
      await import("node:fs/promises").then(({ mkdir }) =>
        mkdir(join(root, "docs", "ai-workflow", "runs"), { recursive: true }),
      );
      await writeFile(
        ledgerPath,
        [
          "# Ledger",
          "## Docs Consulted",
          "## Verification State",
          "## Ledger/File-State Consistency",
        ].join("\n"),
      );
    });

    const withLedger = await checkRepositoryState({
      root,
      changedFiles: [
        "scripts/ai-workflow-check.mjs",
        ".agents/superpowers/skills/using-superpowers/SKILL.md",
        "docs/ai-workflow/runs/20260519-1116-ai-workflow-analysis.md",
      ],
    });
    assert.equal(withLedger.ok, true);
  });
}

async function testRepositoryStateRunsAgentSkillMirrorCheck() {
  await withTempRepo(async (root) => {
    await mkdir(join(root, "scripts"), { recursive: true });
    const syncScript = join(root, "scripts", "sync-agent-skills.mjs");

    await writeFile(
      syncScript,
      "console.error('mirror drift'); process.exit(1);\n",
    );

    const failingResult = await checkRepositoryState({
      root,
      changedFiles: [],
    });
    assert.equal(failingResult.ok, false);
    assert.ok(
      failingResult.errors.some((error) =>
        error.includes("agent skill mirrors are not in sync"),
      ),
    );

    await writeFile(syncScript, "console.log('PASS');\n");

    const passingResult = await checkRepositoryState({
      root,
      changedFiles: [],
    });
    assert.equal(passingResult.ok, true);
  });
}

async function testCommitMessageRequiresLoreTrailers() {
  const validMessage = [
    "docs(workflow): harden ai workflow gates",
    "",
    "Constraint: Workflow requires verification evidence",
    "Rejected: More prose only | machine checks catch omissions earlier",
    "Confidence: high",
    "Scope-risk: narrow",
    "Directive: Keep workflow checks runnable without package install",
    "Tested: node scripts/ai-workflow-check.selftest.mjs",
    "Not-tested: GitHub Actions runtime not executed locally",
    "Publication-decision: local-commit",
    "Review: self-review",
    "Ledger: docs/ai-workflow/runs/20260519-1116-ai-workflow-analysis.md",
  ].join("\n");

  assert.equal(checkCommitMessage(validMessage).ok, true);

  const invalidMessage = "docs: missing trailers\n\nTested: nothing";
  const invalidResult = checkCommitMessage(invalidMessage);
  assert.equal(invalidResult.ok, false);
  assert.ok(
    invalidResult.errors.some((error) =>
      error.includes("missing required trailer: Constraint"),
    ),
  );
}

await testPullRequestBodyRequiresEvidenceSections();
await testRepositoryStateRequiresLedgerWhenImplementationFilesChange();
await testRepositoryStateRunsAgentSkillMirrorCheck();
await testCommitMessageRequiresLoreTrailers();

console.log("ai-workflow-check self-test passed");
