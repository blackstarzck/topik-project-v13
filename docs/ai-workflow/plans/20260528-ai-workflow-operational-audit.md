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
- `docs/ai-workflow/harness-and-skills.md`
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
- Host execution differs: Codex uses `.codex/skills` and Codex GStack skill names such as `gstack-review`, while Claude Code uses `.claude/skills` and Claude skill names such as `review`.
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

## Host Execution Matrix

This audit must verify both the shared workflow contract and the host-specific execution paths.

| Area | Codex local baseline | Claude Code baseline | Audit expectation |
| --- | --- | --- | --- |
| Startup skill | Use native skill discovery when available; otherwise read `.agents/superpowers/skills/using-superpowers/SKILL.md` | Invoke `using-superpowers` after mirrors are synced | Both paths must satisfy Mandatory Startup before planning, editing, or reporting |
| Skill mirror | `.codex/skills/` generated from `.agents` | `.claude/skills/` generated from `.agents` | `node scripts/sync-agent-skills.mjs --check` must pass or degraded mode must be recorded |
| Review gate | `gstack-review` or equivalent Codex review path | `review` or equivalent Claude review path | True cross-model review pairs Codex implementer with Claude reviewer, or records degraded mode |
| Plan review | `gstack-plan-eng-review`, `gstack-plan-design-review`, `gstack-plan-ceo-review` | `plan-eng-review`, `plan-design-review`, `plan-ceo-review` | FAIL requires revision and same-reviewer re-review until PASS or accepted CONCERN |
| QA gate | `gstack-qa` / `gstack-qa-only`, or local Browser/Playwright fallback when appropriate | `qa` / `qa-only` | UI work needs app boot and changed path exercise, not only typecheck/build |
| Ship gate | `gstack-ship` for release-sized Codex work | `ship` for release-sized Claude work | Release-sized work must use the matching host gate or record degraded fallback |
| Delegation | Codex native subagents with task/result packets | Claude Task tool or equivalent with task/result packets | Child agents are execution surfaces; the main session owns durable ledger integration |
| Fallback | Record unavailable host capability as degraded and run equivalent local checklist | Same | Fallback never weakens a quality gate |

Host parity does not mean identical commands. It means each host can follow the same repository contract with its own skill names, tool surface, packet format, and fallback record.

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
| 5 | Compare Codex vs Claude execution paths | `docs/ai-workflow/harness-and-skills.md`, host skill mirrors | n/a | Y - read-only host parity audit |
| 6 | Run CI-style changed-file simulations | OS temp or disposable copy/worktree | n/a | N - tightly coupled to verification evidence and cleanup |
| 7 | Multi-agent review and debate | task/result packets in ledger | n/a | N - coordinator must integrate all packets |
| 8 | Tie-break unresolved disagreements | ledger decisions section | n/a | Y - independent critic/verifier can advise |
| 9 | Write final report and Git publication decision | run ledger, optional report artifact | n/a | N - final accountability belongs to main session |

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

- [ ] **Step 5: Verify host execution parity**

  Compare Codex and Claude Code execution paths from `docs/ai-workflow/harness-and-skills.md`.

  Required checks:

  - Codex startup path is explicit.
  - Claude Code startup path is explicit.
  - Codex/Claude review skill names are mapped.
  - Codex/Claude plan-review skill names are mapped.
  - Codex/Claude QA and ship skill names are mapped.
  - Cross-model review is defined as a real different-model/host pairing, not same-model subagents.
  - Missing host capability routes to degraded fallback with evidence.

  Expected: the final report can state whether each host can execute the same repository workflow without guessing command names or review gates.

- [ ] **Step 6: Verify negative and CI-style cases**

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

- [ ] **Step 7: Dispatch independent reviewers**

  Send task packets with `Audience: n/a`, exact read scope, no write scope, expected result packet format, and ledger path.

  Expected: every child response is a result packet and is integrated into the ledger.

- [ ] **Step 8: Resolve debate and tie-break**

  Apply quantitative evidence first. For unresolved qualitative disagreements, request an independent critic/verifier. If a commitment-level decision remains, record A/B options and escalate to the user.

  Expected: tie-break advice never overrides active docs or user authority.

- [ ] **Step 9: Final report and publication decision**

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
- Host execution parity: required; Codex and Claude Code paths must be checked separately against `docs/ai-workflow/harness-and-skills.md`.
- Architecture Pass: not applicable unless the audit becomes phase completion work.
- UX/UI Consistency Pass: skipped for this non-UI plan save; full audit still verifies UI gate enforcement through changed-file simulation.
- QA Gate: skipped for this non-UI plan save; full audit still verifies QA Gate enforcement through changed-file simulation.
- Finish: run fresh verification commands and `node scripts/ai-workflow-check.mjs --repo .` before final reporting.

## Risks

- The repository already has unrelated dirty and untracked files; the audit must isolate intended artifacts in its dirty-scope record.
- Local `--repo .` checks use working-tree state, while CI uses PR diff; both paths must be verified.
- Same-model subagents do not satisfy true cross-model review; this must be recorded as degraded unless another model/host reviews.
- Codex and Claude Code use different skill names and tool surfaces; the audit must verify both rather than assuming one host's commands transfer to the other.
- A checker PASS can create false confidence if manual gates are not audited.
