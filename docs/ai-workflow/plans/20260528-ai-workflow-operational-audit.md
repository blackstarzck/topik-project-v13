# AI Workflow Operational Audit Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development when independent review or fixture-audit slices are delegated, otherwise use superpowers:executing-plans task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify whether `docs/ai-development-workflow.md` works as an operational AI workflow in this repository.

**Architecture:** Treat the audit itself as a non-lightweight workflow task. The executor must create durable evidence first, then verify the documented rules through static checks, checker self-tests, CI-style changed-file simulation, multi-agent packets, and a final report.

**Tech Stack:** Markdown workflow docs, Codex local shell, Node.js ESM scripts, `scripts/ai-workflow-check.mjs`, `scripts/ai-workflow-check.selftest.mjs`, UX/UI and QA fixture scripts.

---

## Docs Consulted

- `.agents/superpowers/skills/using-superpowers/SKILL.md`
- `.codex/skills/executing-plans/SKILL.md`
- `.codex/skills/verification-before-completion/SKILL.md`
- `docs/agent-index.md`
- `docs/ai-development-workflow.md`
- `docs/ai-workflow/planning-contracts.md`
- `docs/ai-workflow/context-and-packets.md`
- `docs/ai-workflow/review-gates.md`
- `docs/ai-workflow/fallback-and-recovery.md`
- `docs/ai-workflow/report-template.md`
- `docs/ai-workflow/agent-packets.md`
- `docs/ai-workflow/git-publication-decision.md`
- `docs/ai-workflow/plans/README.md`
- `.github/workflows/ai-workflow-check.yml`
- `scripts/ai-workflow-check.mjs`
- `scripts/ai-workflow-check.selftest.mjs`
- `scripts/test-uxui-fixtures.mjs`
- `scripts/test-qa-gate-fixtures.mjs`

## Extracted Requirements

- The audit must start with Superpowers, `docs/agent-index.md` routing, and the smallest relevant workflow docs.
- The audit is non-lightweight because it is workflow-governing, multi-agent, and likely to resume; it needs a run ledger.
- Every plan under `docs/ai-workflow/plans/` needs non-empty `Out of Scope — Intentional Cuts` and `Smallest Buildable Unit` sections.
- A `## Tasks` table must include `Subagent-eligible? (Y/N + reason)` and every row must state `Y — <reason>` or `N — <reason>`.
- Multi-agent work must use task/result packets and integrate the results into the central ledger.
- Cross-model review is required for non-trivial plans/doc changes; if unavailable, record degraded mode with a reason.
- `node scripts/ai-workflow-check.mjs --repo .` is required before final reporting when Node is available.
- CI-style validation uses `--changed-files`; local `--repo .` alone is not enough to prove PR behavior.
- UI QA can be skipped for this non-UI audit only if the audit still verifies that UI-change QA/UX gates are enforced by docs and checker logic.
- Final reporting must follow `docs/ai-workflow/report-template.md` and include a Git publication decision.

## Doc Conflicts

- None blocking.
- Stale-doc risk to record during execution: `AGENTS.md` says the repository is still pre-implementation, while current local state contains `package.json` and `src/`.

## Untouched Relevant Docs

- Product, IA, journey, UI, backend, auth, deployment, and domain docs are intentionally out of scope. This audit checks the AI workflow operating contract, not product behavior.

## Problem Statement

The repository has an AI workflow entry point and several enforcement scripts. A successful audit must prove more than "the current repo passes": it must show that the workflow is understandable to agents, that automatic checks catch expected omissions, that manual gates are visible, and that fallback/degraded paths do not weaken quality gates.

## Files Likely To Change During The Audit

- `docs/ai-workflow/plans/20260528-ai-workflow-operational-audit.md`
- `docs/ai-workflow/runs/2026/05/28/YYYYMMDD-HHMM-ai-workflow-operational-audit.md`
- Optional final report artifact under `reports/` only if the executor decides a separate HTML/Markdown report is needed; otherwise the run ledger carries the final report.

## Out of Scope — Intentional Cuts

- No product feature, UI, auth, backend, deployment, or route behavior changes.
- No edits to `scripts/ai-workflow-check.mjs` unless the audit discovers a blocker and the user approves a separate fix plan.
- No production source edits.
- No repo-root temporary fixture debris; disposable checks must use OS temp or a disposable copy/worktree and clean up after themselves.
- No commit, push, or PR unless the user explicitly requests publication after the audit.

## Smallest Buildable Unit

Save this plan plus one run ledger, then run the narrow workflow verification commands against those artifacts:

- `node scripts/sync-agent-skills.mjs --check`
- `node scripts/ai-workflow-check.selftest.mjs`
- `node scripts/test-uxui-fixtures.mjs`
- `node scripts/test-qa-gate-fixtures.mjs`
- `node scripts/ai-workflow-check.mjs --repo .`

This proves that the saved audit artifacts satisfy the current machine-checked workflow contract before the full audit begins.

## Success Criteria

- The audit plan and ledger are machine-checkable.
- The executor can classify every workflow rule as `자동 강제됨`, `문서상 수동 확인 필요`, `증거 부족`, or `충돌 또는 오래된 문서`.
- Positive and negative checker cases are verified.
- CI-style `--changed-files` behavior is tested, not inferred from local `--repo .`.
- Multi-agent review uses task/result packets and ledger integration.
- Plan-review, cross-model review, fallback, QA/UX, and Git publication gates are recorded explicitly.
- Final output follows `docs/ai-workflow/report-template.md`.

## Tasks

| # | Task | Files | Audience | Subagent-eligible? (Y/N + reason) |
| --- | --- | --- | --- | --- |
| 1 | Create audit ledger and record startup evidence | `docs/ai-workflow/runs/2026/05/28/*.md` | n/a | N - central context owner must do this |
| 2 | Extract workflow acceptance checklist | docs listed above | n/a | Y - read-only checklist review |
| 3 | Map docs claims to checker enforcement | `scripts/ai-workflow-check.mjs`, workflow docs | n/a | Y - independent static audit |
| 4 | Verify existing checker self-tests and fixtures | `scripts/ai-workflow-check.selftest.mjs`, fixture scripts | n/a | Y - command/output verification slice |
| 5 | Run CI-style changed-file simulations | OS temp or disposable copy/worktree | n/a | N - tightly coupled to verification evidence and cleanup |
| 6 | Multi-agent review and debate | task/result packets in ledger | n/a | N - coordinator must integrate all packets |
| 7 | Tie-break unresolved disagreements | ledger decisions section | n/a | Y - independent critic/verifier can advise |
| 8 | Write final report and Git publication decision | run ledger, optional report artifact | n/a | N - final accountability belongs to main session |

## Execution Steps

- [ ] **Step 1: Start ledger before audit work**

  Create `docs/ai-workflow/runs/2026/05/28/YYYYMMDD-HHMM-ai-workflow-operational-audit.md` from `context-ledger-template.md`.

  Expected: ledger contains `## Docs Consulted`, `## Verification State`, `## Ledger/File-State Consistency`, and non-empty `Cross-model review:`.

- [ ] **Step 2: Record startup and scope**

  Record docs consulted, extracted requirements, no blocking doc conflicts, untouched relevant docs, current branch, dirty scope, and stale-doc risk.

  Expected: the ledger can be read without hidden chat context.

- [ ] **Step 3: Build workflow rule matrix**

  Classify rules into:

  - `자동 강제됨`
  - `문서상 수동 확인 필요`
  - `증거 부족`
  - `충돌 또는 오래된 문서`

  Expected: every major rule in `docs/ai-development-workflow.md` and WF-00 docs is represented.

- [ ] **Step 4: Verify local workflow scripts**

  Run:

  ```powershell
  node scripts/sync-agent-skills.mjs --check
  node scripts/ai-workflow-check.selftest.mjs
  node scripts/test-uxui-fixtures.mjs
  node scripts/test-qa-gate-fixtures.mjs
  node scripts/ai-workflow-check.mjs --repo .
  ```

  Expected: all commands exit 0. If a command fails, classify via `fallback-and-recovery.md` and do not claim the workflow works.

- [ ] **Step 5: Verify negative and CI-style cases**

  Use OS temp or a disposable copy/worktree to check that failures occur for:

  - missing `Cross-model review:` in a ledger
  - UI changed file without `UX/UI Consistency Pass`
  - UI changed file without `QA Gate`
  - plan missing `Out of Scope — Intentional Cuts`
  - plan missing `Smallest Buildable Unit`
  - task table missing `Subagent-eligible`
  - PR body missing Git publication decision fields
  - commit message missing Lore trailers

  Expected: each negative case fails for the expected reason.

- [ ] **Step 6: Dispatch independent reviewers**

  Send task packets with `Audience: n/a`, exact read scope, no write scope, expected result packet format, and ledger path.

  Expected: every child response is a result packet and is integrated into the ledger.

- [ ] **Step 7: Resolve debate and tie-break**

  Apply quantitative evidence first. For unresolved qualitative disagreements, request an independent critic/verifier. If a commitment-level decision remains, record A/B options and escalate to the user.

  Expected: tie-break advice never overrides active docs or user authority.

- [ ] **Step 8: Final report and publication decision**

  Fill the report-template sections in the ledger or a separate report artifact. Record:

  ```text
  Git publication decision: no-commit
  Reason: user requested local plan/artifact save and audit preparation, not publication
  Branch: docs/auth-overview-consolidated-reference
  Upstream: origin/docs/auth-overview-consolidated-reference
  Dirty scope: existing unrelated dirty files plus audit artifacts
  Review status: degraded if no true cross-model reviewer is available
  Verification status: passed/degraded/failed based on actual commands
  Ledger: docs/ai-workflow/runs/2026/05/28/YYYYMMDD-HHMM-ai-workflow-operational-audit.md
  Fallback status: none or documented fallback
  Next git action: none
  ```

  Expected: final report is evidence-backed and does not claim more than verified.

## Verification Strategy

- TDD status: not applicable for saving this plan; no production behavior code is changed.
- Cross-model review: required for the full audit; if only Codex-local reviewers are available, record degraded mode with reason.
- Plan-Review PASS Gate: required before executing the full audit if a reviewer returns FAIL.
- Code/Doc Review: required before claiming the audit result complete.
- Architecture Pass: not applicable unless the audit becomes phase completion work.
- UX/UI Consistency Pass: skipped for this non-UI plan save; full audit still verifies UI gate enforcement through changed-file simulation.
- QA Gate: skipped for this non-UI plan save; full audit still verifies QA Gate enforcement through changed-file simulation.
- Finish: run fresh verification commands and `node scripts/ai-workflow-check.mjs --repo .` before final reporting.

## Risks

- The repository already has unrelated dirty and untracked files; the audit must isolate intended artifacts in its dirty-scope record.
- Local `--repo .` checks use working-tree state, while CI uses PR diff; both paths must be verified.
- Same-model subagents do not satisfy true cross-model review; this must be recorded as degraded unless another model/host reviews.
- A checker PASS can create false confidence if manual gates are not audited.
