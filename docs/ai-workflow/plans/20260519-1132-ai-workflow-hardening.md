# AI Workflow Hardening Implementation Plan

> For agentic workers: execute inline in the main session because the user explicitly requested the hardening changes and no disjoint child-agent scope is needed.

**Goal:** Add machine-checkable workflow evidence gates so AI agents are less likely to skip docs, ledger, review, verification, or git publication evidence.

**Architecture:** Use a dependency-free Node.js checker that validates PR bodies, commit messages, and repository workflow evidence. Keep the checker runnable without `package.json`, then wire it into GitHub Actions and document when agents must use it.

**Tech Stack:** Node.js ESM, GitHub Actions, Markdown workflow docs.

---

## Task 1: Add Checker Test And Implementation

**Files:**
- Create: `scripts/ai-workflow-check.selftest.mjs`
- Create: `scripts/ai-workflow-check.mjs`

- [x] Write the self-test first, importing the missing checker module.
- [x] Run `node scripts/ai-workflow-check.selftest.mjs`.
- [x] Confirm RED failure with `ERR_MODULE_NOT_FOUND`.
- [x] Implement the checker exports and CLI.
- [x] Run the self-test until it passes.

## Task 2: Add PR CI Gate

**Files:**
- Create: `.github/workflows/ai-workflow-check.yml`
- Modify: `.github/pull_request_template.md`

- [x] Add a pull request workflow that writes PR body and changed-file inputs.
- [x] Run `node scripts/ai-workflow-check.mjs --repo . --changed-files <file> --pr-body <file>` in CI.
- [x] Add an AI workflow checker field to the PR template.

## Task 3: Harden Workflow Documentation

**Files:**
- Modify: `docs/ai-development-workflow.md`
- Modify: `docs/agent-index.md`
- Modify: `docs/ai-workflow/git-publication-decision.md`
- Modify: `docs/ai-workflow/report-template.md`

- [x] Document the machine-checkable evidence gate.
- [x] Narrow the no-runnable-test-surface TDD exception after `src/` or `package.json` exists.
- [x] Add examples for non-trivial ledger-required work.
- [x] Add degraded self-review checklist requirements.
- [x] Add checker evidence fields to final reports and git publication guidance.

## Task 4: Verify

**Files:**
- Update: `docs/ai-workflow/runs/20260519-1116-ai-workflow-analysis.md`

- [ ] Run the self-test.
- [ ] Run the workflow checker against intended changed files and a filled PR-body fixture.
- [ ] Run `git diff --check` on touched files.
- [ ] Run a self-review checklist and update the ledger.
