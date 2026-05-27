import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  checkCommitMessage,
  checkPullRequestBody,
  checkRepositoryState,
  checkPlanFile,
  checkLedgerReviewer,
  checkLedgerArchitecturePass,
  checkPhasePlanArchitectureGate,
  checkLightSpecPresence,
  checkQaGate,
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
    "Ledger: docs/ai-workflow/runs/2026/05/19/20260519-1116-ai-workflow-analysis.md",
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

    await mkdir(join(root, "docs", "ai-workflow", "runs", "2026", "05", "19"), {
      recursive: true,
    });
    const ledgerPath = join(
      root,
      "docs",
      "ai-workflow",
      "runs",
      "2026",
      "05",
      "19",
      "20260519-1116-ai-workflow-analysis.md",
    );
    await writeFile(
      ledgerPath,
      [
        "# Ledger",
        "## Docs Consulted",
        "- a doc",
        "- Untouched relevant docs and reason: none",
        "## Verification State",
        "- Cross-model review: codex (gstack)",
        "## Ledger/File-State Consistency",
        "- yes",
      ].join("\n"),
    );

    const withLedger = await checkRepositoryState({
      root,
      changedFiles: [
        "scripts/ai-workflow-check.mjs",
        ".agents/superpowers/skills/using-superpowers/SKILL.md",
        "docs/ai-workflow/runs/2026/05/19/20260519-1116-ai-workflow-analysis.md",
      ],
    });
    assert.equal(withLedger.ok, true, `expected ok, got: ${withLedger.errors.join(" | ")}`);

    const legacyLedgerPath = join(
      root,
      "docs",
      "ai-workflow",
      "runs",
      "20260519-1116-ai-workflow-analysis.md",
    );
    await writeFile(legacyLedgerPath, "# Legacy ledger\n");

    const legacyLedger = await checkRepositoryState({
      root,
      changedFiles: [
        "scripts/ai-workflow-check.mjs",
        "docs/ai-workflow/runs/20260519-1116-ai-workflow-analysis.md",
      ],
    });
    assert.equal(legacyLedger.ok, false);
    assert.ok(
      legacyLedger.errors.some((error) =>
        error.includes("docs/ai-workflow/runs/YYYY/MM/DD/"),
      ),
    );
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
    "Ledger: docs/ai-workflow/runs/2026/05/19/20260519-1116-ai-workflow-analysis.md",
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

async function testPlanFileEnforcesNonEmptyAndPerRowSubagent() {
  const validPlan = [
    "# Plan",
    "## Out of Scope — Intentional Cuts",
    "- 명확한 이유와 함께 제외 항목",
    "## Smallest Buildable Unit",
    "- 최소 단위 명시",
    "## Tasks",
    "| # | Task | Files | Subagent-eligible? (Y/N + reason) |",
    "| --- | --- | --- | --- |",
    "| 1 | 첫 작업 | x.ts | Y — 독립 |",
    "| 2 | 둘째 | y.ts | N — 의존 |",
  ].join("\n");
  assert.equal(
    checkPlanFile(validPlan, "p.md").ok,
    true,
    `expected valid plan to pass: ${checkPlanFile(validPlan, "p.md").errors.join(" | ")}`,
  );

  const missingCuts = checkPlanFile(
    "# Plan\n## Smallest Buildable Unit\n- x\n",
    "p.md",
  );
  assert.equal(missingCuts.ok, false);
  assert.ok(missingCuts.errors.some((e) => /Out of Scope/.test(e)));

  const emptyCuts = checkPlanFile(
    [
      "# Plan",
      "## Out of Scope — Intentional Cuts",
      "",
      "## Smallest Buildable Unit",
      "- x",
    ].join("\n"),
    "p.md",
  );
  assert.equal(emptyCuts.ok, false);
  assert.ok(emptyCuts.errors.some((e) => /empty/.test(e)));

  const tasksNoTable = checkPlanFile(
    [
      "# Plan",
      "## Out of Scope — Intentional Cuts",
      "- x",
      "## Smallest Buildable Unit",
      "- y",
      "## Tasks",
      "(none)",
    ].join("\n"),
    "p.md",
  );
  assert.equal(tasksNoTable.ok, false);
  assert.ok(tasksNoTable.errors.some((e) => /task table/i.test(e)));

  const noColumn = checkPlanFile(
    [
      "# Plan",
      "## Out of Scope — Intentional Cuts",
      "- x",
      "## Smallest Buildable Unit",
      "- y",
      "## Tasks",
      "| # | Task | Files |",
      "| --- | --- | --- |",
      "| 1 | x | y |",
    ].join("\n"),
    "p.md",
  );
  assert.equal(noColumn.ok, false);
  assert.ok(noColumn.errors.some((e) => /Subagent-eligible/.test(e)));

  const badRow = checkPlanFile(
    [
      "# Plan",
      "## Out of Scope — Intentional Cuts",
      "- x",
      "## Smallest Buildable Unit",
      "- y",
      "## Tasks",
      "| # | Task | Files | Subagent-eligible? |",
      "| --- | --- | --- | --- |",
      "| 1 | x | y.ts | Y |",
    ].join("\n"),
    "p.md",
  );
  assert.equal(badRow.ok, false);
  assert.ok(badRow.errors.some((e) => /reason/.test(e)));

  // tiny plan with no Tasks section — OK
  const noTasks = checkPlanFile(
    [
      "# Plan",
      "## Out of Scope — Intentional Cuts",
      "- x",
      "## Smallest Buildable Unit",
      "- y",
    ].join("\n"),
    "p.md",
  );
  assert.equal(noTasks.ok, true);
}

async function testLedgerReviewerFieldRequired() {
  const valid =
    "## Verification State\n- Cross-model review: codex (gstack)\n";
  assert.equal(checkLedgerReviewer(valid).ok, true);

  const degraded =
    "## Verification State\n- Cross-model review: degraded — codex unavailable\n";
  assert.equal(checkLedgerReviewer(degraded).ok, true);

  const missing = "## Verification State\n- Checks run: none\n";
  const r = checkLedgerReviewer(missing);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /Cross-model review/.test(e)));

  const emptyValue = "## Verification State\n- Cross-model review:\n";
  const r2 = checkLedgerReviewer(emptyValue);
  assert.equal(r2.ok, false);
}

async function testLedgerArchitecturePassRequiredOnComplete() {
  const valid = "- Architecture Pass: passed\n";
  assert.equal(checkLedgerArchitecturePass(valid, true).ok, true);

  const skipped = "- Architecture Pass: skipped — non-implementation phase\n";
  assert.equal(checkLedgerArchitecturePass(skipped, true).ok, true);

  const missing = "Status: complete\n";
  const r = checkLedgerArchitecturePass(missing, true);
  assert.equal(r.ok, false);

  // phase not complete → not required
  assert.equal(checkLedgerArchitecturePass(missing, false).ok, true);
}

async function testPhasePlanArchitectureGateValidatesEachRow() {
  const valid = [
    "| Phase | Name | Scope | Completion Gate |",
    "| --- | --- | --- | --- |",
    "| 1 | foo | s | tests pass and Architecture Pass |",
    "| 2 | bar | s | lint pass and Architecture Pass |",
  ].join("\n");
  assert.equal(checkPhasePlanArchitectureGate(valid).ok, true);

  const missingRow = [
    "| Phase | Name | Scope | Completion Gate |",
    "| --- | --- | --- | --- |",
    "| 1 | foo | s | tests pass and Architecture Pass |",
    "| 2 | bar | s | lint pass |",
  ].join("\n");
  const r = checkPhasePlanArchitectureGate(missingRow);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /row 2|Phase 2/i.test(e)));

  // Architecture Pass in prose, not in table — fails
  const proseOnly = [
    "Some prose about Architecture Pass.",
    "| Phase | Name | Scope | Completion Gate |",
    "| --- | --- | --- | --- |",
    "| 1 | foo | s | tests pass |",
  ].join("\n");
  assert.equal(checkPhasePlanArchitectureGate(proseOnly).ok, false);

  // no phase contract table — OK
  const noPhase =
    "# Plan\n## Tasks\n| # | Task |\n| --- | --- |\n| 1 | x |\n";
  assert.equal(checkPhasePlanArchitectureGate(noPhase).ok, true);
}

async function testLightSpecPresenceCheckedForPhaseLedgers() {
  await withTempRepo(async (root) => {
    await mkdir(join(root, "docs", "ai-workflow", "light-specs"), {
      recursive: true,
    });

    // phase ledger by filename, missing Light Spec field → fail
    const ledgerBodyNoLS = "## Run Metadata\n- Status: active\n";
    const r1 = await checkLightSpecPresence(
      root,
      ledgerBodyNoLS,
      "docs/ai-workflow/runs/2026/05/20/20260520-1200-phase-4-learning-core.md",
    );
    assert.equal(r1.ok, false);
    assert.ok(r1.errors.some((e) => /Light Spec.*required/i.test(e)));

    // phase ledger by body marker, missing Light Spec → fail
    const ledgerBodyPhaseMarker = "## Task\n- Phase: 4-learning-core\n";
    const r2 = await checkLightSpecPresence(
      root,
      ledgerBodyPhaseMarker,
      "docs/ai-workflow/runs/2026/05/20/20260520-1200-other.md",
    );
    assert.equal(r2.ok, false);

    // Light Spec referenced but file missing → fail
    const ledgerWithMissingLS = [
      "Phase: 4-learning-core",
      "Light Spec: docs/ai-workflow/light-specs/phase-4-learning-core.md",
    ].join("\n");
    const r3 = await checkLightSpecPresence(
      root,
      ledgerWithMissingLS,
      "docs/ai-workflow/runs/2026/05/20/20260520-1200-other.md",
    );
    assert.equal(r3.ok, false);
    assert.ok(r3.errors.some((e) => /does not exist/.test(e)));

    // light spec file present → OK
    await writeFile(
      join(root, "docs", "ai-workflow", "light-specs", "phase-4-learning-core.md"),
      "# Phase 4 light spec\n\nAudience: user\n",
    );
    const r4 = await checkLightSpecPresence(
      root,
      ledgerWithMissingLS,
      "docs/ai-workflow/runs/2026/05/20/20260520-1200-other.md",
    );
    assert.equal(r4.ok, true);

    // Audience missing → fail (regression guard for the bug that broke self-test silently)
    await writeFile(
      join(root, "docs", "ai-workflow", "light-specs", "phase-5-no-audience.md"),
      "# Phase 5 light spec (no audience)\n",
    );
    const r6 = await checkLightSpecPresence(
      root,
      [
        "Phase: 5-no-audience",
        "Light Spec: docs/ai-workflow/light-specs/phase-5-no-audience.md",
      ].join("\n"),
      "docs/ai-workflow/runs/2026/05/20/20260520-1200-other.md",
    );
    assert.equal(r6.ok, false);
    assert.ok(r6.errors.some((e) => /Audience/i.test(e)));

    // non-phase ledger — OK regardless
    const nonPhaseBody = "## Task\n- Goal: docs touchup\n";
    const r5 = await checkLightSpecPresence(
      root,
      nonPhaseBody,
      "docs/ai-workflow/runs/2026/05/20/20260520-1200-docs-touchup.md",
    );
    assert.equal(r5.ok, true);
  });
}

async function testRepositoryStateValidatesLedgerEvenWhenNoLedgerRequired() {
  await withTempRepo(async (root) => {
    await mkdir(join(root, "docs", "ai-workflow", "runs", "2026", "05", "20"), {
      recursive: true,
    });
    const ledgerRel =
      "docs/ai-workflow/runs/2026/05/20/20260520-1200-update.md";
    // ledger with all old sections but missing Cross-model review → must fail
    await writeFile(
      join(root, ledgerRel),
      [
        "# Ledger",
        "## Docs Consulted",
        "- some doc",
        "## Verification State",
        "- Checks run: yes",
        "## Ledger/File-State Consistency",
        "- yes",
      ].join("\n"),
    );

    const r = await checkRepositoryState({
      root,
      changedFiles: [ledgerRel],
    });
    assert.equal(r.ok, false);
    assert.ok(
      r.errors.some((e) => /Cross-model review/.test(e)),
      `expected Cross-model review error in: ${r.errors.join(" | ")}`,
    );
  });
}

async function testRepositoryStateDoesNotForceArchPassOnNonPhaseLedger() {
  await withTempRepo(async (root) => {
    await mkdir(join(root, "docs", "ai-workflow", "runs", "2026", "05", "20"), {
      recursive: true,
    });
    // non-phase complete ledger: no `Phase: ...` marker, no `phase-N` in filename
    const ledgerRel =
      "docs/ai-workflow/runs/2026/05/20/20260520-1400-meta-workflow.md";
    await writeFile(
      join(root, ledgerRel),
      [
        "# Ledger",
        "## Run Metadata",
        "- Status: complete",
        "## Docs Consulted",
        "- some doc",
        "- Untouched relevant docs and reason: none",
        "## Verification State",
        "- Cross-model review: codex",
        "## Ledger/File-State Consistency",
        "- yes",
      ].join("\n"),
    );

    const r = await checkRepositoryState({
      root,
      changedFiles: [ledgerRel],
    });
    assert.equal(
      r.ok,
      true,
      `expected non-phase complete ledger to pass without Arch Pass: ${r.errors.join(" | ")}`,
    );
  });
}

async function testRepositoryStateForcesArchPassOnPhaseCompleteLedger() {
  await withTempRepo(async (root) => {
    await mkdir(join(root, "docs", "ai-workflow", "runs", "2026", "05", "20"), {
      recursive: true,
    });
    await mkdir(join(root, "docs", "ai-workflow", "light-specs"), {
      recursive: true,
    });
    await writeFile(
      join(root, "docs/ai-workflow/light-specs/phase-2-data.md"),
      "# Phase 2\n",
    );
    // phase ledger by filename, complete, missing Architecture Pass
    const ledgerRel =
      "docs/ai-workflow/runs/2026/05/20/20260520-1400-phase-2-data.md";
    await writeFile(
      join(root, ledgerRel),
      [
        "# Ledger",
        "## Run Metadata",
        "- Status: complete",
        "## Docs Consulted",
        "- some doc",
        "## Verification State",
        "- Cross-model review: codex",
        "- Light Spec: docs/ai-workflow/light-specs/phase-2-data.md",
        "## Ledger/File-State Consistency",
        "- yes",
      ].join("\n"),
    );

    const r = await checkRepositoryState({
      root,
      changedFiles: [ledgerRel],
    });
    assert.equal(r.ok, false);
    assert.ok(
      r.errors.some((e) => /Architecture Pass/.test(e)),
      `expected Architecture Pass error: ${r.errors.join(" | ")}`,
    );
  });
}

async function testLedgerRequiresUntouchedRelevantDocs() {
  await withTempRepo(async (root) => {
    await mkdir(join(root, "docs", "ai-workflow", "runs", "2026", "05", "27"), {
      recursive: true,
    });
    const baseSections = [
      "## Verification State",
      "- Cross-model review: degraded — solo",
      "## Ledger/File-State Consistency",
      "- yes",
    ].join("\n");

    // (A) missing entirely → FAIL
    const missingRel = "docs/ai-workflow/runs/2026/05/27/20260527-1200-missing.md";
    await writeFile(
      join(root, missingRel),
      ["## Docs Consulted", "- Exact files read: a.md", baseSections].join("\n"),
    );
    const rMissing = await checkRepositoryState({ root, changedFiles: [missingRel] });
    assert.equal(rMissing.ok, false);
    assert.ok(rMissing.errors.some((e) => /Untouched relevant docs/i.test(e)),
      `(A) missing must raise error, got: ${rMissing.errors.join(" | ")}`);

    // (B) same-line value 'none' → must NOT raise Untouched error (other errors may exist)
    const sameLineRel = "docs/ai-workflow/runs/2026/05/27/20260527-1201-same.md";
    await writeFile(
      join(root, sameLineRel),
      [
        "## Docs Consulted",
        "- Exact files read: a.md",
        "- Untouched relevant docs and reason: none",
        baseSections,
      ].join("\n"),
    );
    const rSame = await checkRepositoryState({ root, changedFiles: [sameLineRel] });
    assert.ok(
      !rSame.errors.some((e) => /Untouched relevant docs/i.test(e)),
      `(B) same-line 'none' must not raise error: ${rSame.errors.join(" | ")}`,
    );

    // (C) header + indented bullets → must NOT raise Untouched error
    const indentedRel = "docs/ai-workflow/runs/2026/05/27/20260527-1202-indent.md";
    await writeFile(
      join(root, indentedRel),
      [
        "## Docs Consulted",
        "- Exact files read: a.md",
        "- Untouched relevant docs and reason:",
        "  - `docs/foo.md` — out of scope for this work",
        "  - `docs/bar.md` — not relevant",
        baseSections,
      ].join("\n"),
    );
    const rIndent = await checkRepositoryState({ root, changedFiles: [indentedRel] });
    assert.ok(
      !rIndent.errors.some((e) => /Untouched relevant docs/i.test(e)),
      `(C) indented bullets must not raise error: ${rIndent.errors.join(" | ")}`,
    );

    // (D) header with colon but no content → FAIL
    const emptyHeaderRel = "docs/ai-workflow/runs/2026/05/27/20260527-1203-empty.md";
    await writeFile(
      join(root, emptyHeaderRel),
      [
        "## Docs Consulted",
        "- Exact files read: a.md",
        "- Untouched relevant docs and reason:",
        "",
        baseSections,
      ].join("\n"),
    );
    const rEmpty = await checkRepositoryState({ root, changedFiles: [emptyHeaderRel] });
    assert.equal(rEmpty.ok, false);
    assert.ok(rEmpty.errors.some((e) => /Untouched relevant docs/i.test(e)),
      `(D) empty header must raise error, got: ${rEmpty.errors.join(" | ")}`);
  });
}

async function testUiChangeDetectionDoesNotMatchDocsOnlyPaths() {
  const checkerModule = await import("./ai-workflow-check.mjs");
  const { needsUxuiConsistencyPass } = checkerModule.internals;

  // docs path with "theme" must NOT trigger UI gate
  assert.equal(
    needsUxuiConsistencyPass(["docs/ant-design/08-theme-architecture.md"]),
    false,
    "docs path with 'theme' should not trigger UI gate",
  );

  // tasks/ path with "theme" must NOT trigger UI gate
  assert.equal(
    needsUxuiConsistencyPass(["tasks/theme-refactor-verify/foo.html"]),
    false,
    "tasks path with 'theme' should not trigger UI gate",
  );

  // src/theme/ — MUST trigger
  assert.equal(
    needsUxuiConsistencyPass(["src/theme/index.ts"]),
    true,
    "src/theme/ path should trigger UI gate",
  );

  // src/styles/ — still triggers (covered by another pattern)
  assert.equal(
    needsUxuiConsistencyPass(["src/styles/foo.css"]),
    true,
    "src/styles/ path should trigger UI gate via .css or src/styles pattern",
  );
}

async function testLightSpecPathMustBeUnderLightSpecsDirOrExplicitlySkipped() {
  await withTempRepo(async (root) => {
    // phase ledger pointing outside light-specs dir → fail
    const badPath = ["Phase: 2-data", "Light Spec: docs/random.md"].join("\n");
    const r1 = await checkLightSpecPresence(
      root,
      badPath,
      "docs/ai-workflow/runs/2026/05/20/20260520-1400-other.md",
    );
    assert.equal(r1.ok, false);
    assert.ok(
      r1.errors.some((e) => /docs\/ai-workflow\/light-specs/.test(e)),
      `expected path-restriction error: ${r1.errors.join(" | ")}`,
    );

    // phase ledger with "skipped — reason" → OK
    const skipped = [
      "Phase: 2-data",
      "Light Spec: skipped — phase already complete in legacy workflow",
    ].join("\n");
    const r2 = await checkLightSpecPresence(
      root,
      skipped,
      "docs/ai-workflow/runs/2026/05/20/20260520-1400-other.md",
    );
    assert.equal(
      r2.ok,
      true,
      `expected skipped-with-reason to pass: ${r2.errors.join(" | ")}`,
    );

    // bare "skipped" without reason → fail
    const skippedNoReason = ["Phase: 2-data", "Light Spec: skipped"].join("\n");
    const r3 = await checkLightSpecPresence(
      root,
      skippedNoReason,
      "docs/ai-workflow/runs/2026/05/20/20260520-1400-other.md",
    );
    assert.equal(r3.ok, false);
    assert.ok(
      r3.errors.some((e) => /reason/i.test(e)),
      `expected reason-required error: ${r3.errors.join(" | ")}`,
    );

    // single-character reason is allowed (regex must not require 2+ chars)
    const shortReason = ["Phase: 2-data", "Light Spec: skipped — x"].join("\n");
    const r4 = await checkLightSpecPresence(
      root,
      shortReason,
      "docs/ai-workflow/runs/2026/05/20/20260520-1400-other.md",
    );
    assert.equal(
      r4.ok,
      true,
      `expected single-char reason to pass: ${r4.errors.join(" | ")}`,
    );
  });
}

async function testPlanRequiresAudienceColumnWhenLightSpecIsBoth() {
  await withTempRepo(async (root) => {
    await mkdir(join(root, "docs", "ai-workflow", "light-specs"), { recursive: true });
    await mkdir(join(root, "docs", "ai-workflow", "plans"), { recursive: true });

    // light spec with Audience: both
    await writeFile(
      join(root, "docs/ai-workflow/light-specs/phase-9-mixed.md"),
      "# Phase 9\n\nAudience: both\n",
    );

    // plan WITHOUT Audience column
    const planRel = "docs/ai-workflow/plans/20260601-phase-9-mixed.md";
    await writeFile(
      join(root, planRel),
      [
        "# Phase 9 Plan",
        "## Out of Scope — Intentional Cuts",
        "- x",
        "## Smallest Buildable Unit",
        "- y",
        "## Tasks",
        "| # | Task | Files | Subagent-eligible? (Y/N + reason) |",
        "| --- | --- | --- | --- |",
        "| 1 | foo | s | Y — independent |",
      ].join("\n"),
    );

    const r = await checkRepositoryState({ root, changedFiles: [planRel] });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => /Audience column/i.test(e)),
      `expected Audience column error, got: ${r.errors.join(" | ")}`);
  });
}

async function testPlanDoesNotRequireAudienceColumnWhenLightSpecIsSingle() {
  await withTempRepo(async (root) => {
    await mkdir(join(root, "docs", "ai-workflow", "light-specs"), { recursive: true });
    await mkdir(join(root, "docs", "ai-workflow", "plans"), { recursive: true });

    await writeFile(
      join(root, "docs/ai-workflow/light-specs/phase-9-mixed.md"),
      "# Phase 9\n\nAudience: user\n",
    );
    const planRel = "docs/ai-workflow/plans/20260601-phase-9-mixed.md";
    await writeFile(
      join(root, planRel),
      [
        "# Phase 9 Plan",
        "## Out of Scope — Intentional Cuts",
        "- x",
        "## Smallest Buildable Unit",
        "- y",
        "## Tasks",
        "| # | Task | Files | Subagent-eligible? (Y/N + reason) |",
        "| --- | --- | --- | --- |",
        "| 1 | foo | s | Y — independent |",
      ].join("\n"),
    );
    const r = await checkRepositoryState({ root, changedFiles: [planRel] });
    assert.ok(
      !r.errors.some((e) => /Audience column/i.test(e)),
      `single audience must not require Audience column: ${r.errors.join(" | ")}`,
    );
  });
}

async function testPlanFailsClosedWhenLightSpecMissing() {
  await withTempRepo(async (root) => {
    await mkdir(join(root, "docs", "ai-workflow", "light-specs"), { recursive: true });
    await mkdir(join(root, "docs", "ai-workflow", "plans"), { recursive: true });

    // NOTE: NO light spec written for phase-99
    const planRel = "docs/ai-workflow/plans/20260601-phase-99-orphan.md";
    await writeFile(
      join(root, planRel),
      [
        "# Phase 99 Plan",
        "## Out of Scope — Intentional Cuts",
        "- x",
        "## Smallest Buildable Unit",
        "- y",
        "## Tasks",
        "| # | Task | Files | Subagent-eligible? (Y/N + reason) |",
        "| --- | --- | --- | --- |",
        "| 1 | foo | s | Y — independent |",
      ].join("\n"),
    );
    const r = await checkRepositoryState({ root, changedFiles: [planRel] });
    assert.equal(r.ok, false, "phase-N plan without matching light spec must fail");
    assert.ok(
      r.errors.some((e) => /phase 99.*light-specs.*phase-99/i.test(e)),
      `expected missing-light-spec error for phase 99, got: ${r.errors.join(" | ")}`,
    );
  });
}

async function testNonPhasePlanSkipsLightSpecCheck() {
  await withTempRepo(async (root) => {
    await mkdir(join(root, "docs", "ai-workflow", "plans"), { recursive: true });
    const planRel = "docs/ai-workflow/plans/20260601-1200-meta-workflow.md";
    await writeFile(
      join(root, planRel),
      [
        "# Meta Plan",
        "## Out of Scope — Intentional Cuts",
        "- x",
        "## Smallest Buildable Unit",
        "- y",
      ].join("\n"),
    );
    const r = await checkRepositoryState({ root, changedFiles: [planRel] });
    assert.ok(
      !r.errors.some((e) => /light-specs/i.test(e)),
      `non-phase plan must not raise missing-light-spec error: ${r.errors.join(" | ")}`,
    );
  });
}

async function testQaGateBareFailedRequiresReason() {
  const ledgerWithBareFailed = "- QA Gate: failed\n";
  const r = checkQaGate(ledgerWithBareFailed);
  assert.equal(r.ok, false);
  assert.ok(
    r.errors.some((e) => /failed.*reason/i.test(e)),
    `expected QA Gate failed reason error, got: ${r.errors.join(" | ")}`,
  );

  // sanity: 'failed — reason' must PASS
  const ledgerWithReason = "- QA Gate: failed — dev server returned 500\n";
  const r2 = checkQaGate(ledgerWithReason);
  assert.equal(
    r2.ok,
    true,
    `'failed — reason' must pass, got errors: ${r2.errors.join(" | ")}`,
  );
}

await testPullRequestBodyRequiresEvidenceSections();
await testRepositoryStateRequiresLedgerWhenImplementationFilesChange();
await testRepositoryStateRunsAgentSkillMirrorCheck();
await testCommitMessageRequiresLoreTrailers();
await testPlanFileEnforcesNonEmptyAndPerRowSubagent();
await testLedgerReviewerFieldRequired();
await testLedgerArchitecturePassRequiredOnComplete();
await testPhasePlanArchitectureGateValidatesEachRow();
await testLightSpecPresenceCheckedForPhaseLedgers();
await testRepositoryStateValidatesLedgerEvenWhenNoLedgerRequired();
await testRepositoryStateDoesNotForceArchPassOnNonPhaseLedger();
await testRepositoryStateForcesArchPassOnPhaseCompleteLedger();
await testLightSpecPathMustBeUnderLightSpecsDirOrExplicitlySkipped();
await testLedgerRequiresUntouchedRelevantDocs();
await testUiChangeDetectionDoesNotMatchDocsOnlyPaths();
await testQaGateBareFailedRequiresReason();
await testPlanRequiresAudienceColumnWhenLightSpecIsBoth();
await testPlanDoesNotRequireAudienceColumnWhenLightSpecIsSingle();
await testPlanFailsClosedWhenLightSpecMissing();
await testNonPhasePlanSkipsLightSpecCheck();

console.log("ai-workflow-check self-test passed");
