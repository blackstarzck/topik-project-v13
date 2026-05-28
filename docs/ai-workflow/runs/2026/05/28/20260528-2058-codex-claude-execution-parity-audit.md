# Context Ledger: Codex / Claude Execution Parity Audit

## Run Metadata

- Run id: 20260528-2058-codex-claude-execution-parity-audit
- Created: 2026-05-28 20:58 +09:00
- Updated: 2026-05-28 21:07 +09:00
- Main session owner: Codex
- Host: Codex
- Status: complete

## Task

- User goal: Run the project-local Codex / Claude execution-parity audit plan for this repository only.
- Accepted scope: Read-only audit of `.codex`, `.claude`, `.agents`, workflow docs, checker scripts, CI workflow, and prior audit evidence; create this run ledger and a Korean HTML report under `reports/`.
- Out of scope: Repairing or modifying `.codex`, `.claude`, `.agents`, scripts, CI, workflow docs, source files, settings, committing, pushing, or opening a PR.
- Current next action: none

## Docs Consulted

- Exact files read:
  - `.agents/superpowers/skills/using-superpowers/SKILL.md`
  - `.codex/skills/verification-before-completion/SKILL.md`
  - `docs/agent-index.md`
  - `docs/ai-development-workflow.md`
  - `docs/ai-workflow/plans/codex-claude-execution-parity-audit.md`
  - `docs/ai-workflow/planning-contracts.md`
  - `docs/ai-workflow/context-and-packets.md`
  - `docs/ai-workflow/review-gates.md`
  - `docs/ai-workflow/fallback-and-recovery.md`
  - `docs/ai-workflow/harness-and-skills.md`
  - `docs/ai-workflow/agent-packets.md`
  - `docs/ai-workflow/context-ledger-template.md`
  - `docs/ai-workflow/report-template.md`
  - `AGENTS.md`
  - `CLAUDE.md`
  - `.claude/settings.local.json`
  - `.codex/superpowers/.codex-plugin/plugin.json`
  - `.codex/superpowers/.claude-plugin/plugin.json`
  - `.codex/superpowers/hooks/hooks.json`
  - `.codex/superpowers/hooks/session-start`
  - `scripts/sync-agent-skills.mjs`
  - `scripts/ai-workflow-check.mjs`
  - `.github/workflows/ai-workflow-check.yml`
  - `package.json`
  - `docs/ai-workflow/runs/2026/05/22/20260522-0920-codex-claude-workflow-evaluation.md`
  - `docs/ai-workflow/runs/2026/05/28/20260528-2037-codex-claude-execution-parity-plan-save.md`
  - `docs/ai-workflow/plans/20260527-1500-ai-workflow-audit-fixes.md`
  - `docs/ai-workflow/runs/2026/05/27/20260527-1500-ai-workflow-audit-fixes.md`
  - `docs/ai-workflow/runs/2026/05/27/20260527-1700-ai-workflow-audit-fixes-execution.md`
  - `reports/codex-claude-workflow-evaluation.html`
  - `reports/opus-vs-codex-workflow-consensus.html`
  - `reports/ai-workflow-audit-20260527.html`
- Extracted requirements:
  - Use Superpowers first, then `docs/agent-index.md`, then the smallest relevant document set.
  - Treat `docs/ai-workflow/plans/codex-claude-execution-parity-audit.md` as the authoritative procedure for this run.
  - Produce one run ledger under `docs/ai-workflow/runs/YYYY/MM/DD/` and one Korean HTML audit report under `reports/`.
  - Do not repair `.codex`, `.claude`, `.agents`, scripts, CI, workflow docs, source files, or settings during this audit.
  - Skill mirrors must be exact-sync for canonical project, practical, and Superpowers skills.
  - GStack host skill names may differ when they route to the same workflow gate.
  - `AGENTS.md` and `CLAUDE.md` must preserve the same execution meaning: startup, docs selection, ledger, fail-closed, fallback, review gates, and Korean communication style.
  - Broad host permissions must not weaken fail-closed rules.
  - Verification commands from the audit plan must be run and their output read.
  - Parity defects must be separated from shared workflow health defects.
- Doc conflicts: none with the user's audit request. Audit findings include stale shared project-state wording in `AGENTS.md` and `CLAUDE.md`.
- Untouched relevant docs and reason:
  - `docs/prd.md`, `docs/spec.md`, `docs/IA/**`, `docs/ant-design/**`, `docs/development/**` product and implementation specs were not read because this audit concerns AI execution harness parity, not product behavior.

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 2026-05-28 20:58 +09:00 | Treat this as a read-only audit with generated evidence artifacts only. | The user's request explicitly prohibits repairs without separate authorization. | User request; audit plan |
| 2026-05-28 20:58 +09:00 | Classify `.claude/settings.local.json` as a parity defect surface, not merely documentation. | It grants `defaultMode: bypassPermissions` and allows destructive/external/dependency-changing commands that Codex in this run cannot execute under the same approval policy. | `.claude/settings.local.json`; environment policy |
| 2026-05-28 20:58 +09:00 | Classify stale "pre-implementation" wording as a shared workflow health defect. | Both host entry files contain the stale premise while `src/` and `package.json` exist. | `AGENTS.md`; `CLAUDE.md`; `git status`; `package.json` |
| 2026-05-28 20:58 +09:00 | Treat GStack `gstack-*` versus short Claude names as a documented safe difference. | All required pairs exist and expose equivalent `name:` metadata and gate mapping. | GStack mapping checklist |
| 2026-05-28 20:58 +09:00 | Treat prior mojibake concern as not reproduced as a file-content defect in this run. | `Select-String` read Korean lines from `CLAUDE.md` correctly; raw console display can still render mojibake. | `CLAUDE.md`; prior consensus report |

## Active Files

- Files expected to change:
  - `docs/ai-workflow/runs/2026/05/28/20260528-2058-codex-claude-execution-parity-audit.md`
  - `reports/codex-claude-execution-parity-audit-20260528.html`
- Files inspected:
  - Host instructions, skill mirrors, Superpowers plugin metadata and hooks, Claude local settings, checker scripts, CI workflow, prior audit ledgers/reports.
- Files changed:
  - `docs/ai-workflow/runs/2026/05/28/20260528-2058-codex-claude-execution-parity-audit.md`
  - `reports/codex-claude-execution-parity-audit-20260528.html`
- Files explicitly not to touch:
  - `.codex/**`
  - `.claude/**`
  - `.agents/**`
  - `scripts/**`
  - `.github/**`
  - `docs/ai-workflow/plans/**`
  - Existing workflow docs
  - Source files
  - Settings files

## Agent Assignments

Use `docs/ai-workflow/agent-packets.md` for packet details.

| Agent | Role | Scope | Status | Packet location or summary |
| --- | --- | --- | --- | --- |
| Codex main session | Auditor / report writer | Execute read-only parity audit and produce ledger/report | complete | No child agents used |

## Child Result Packets

No child agents were used in this run.

## Verification State

- Required checks:
  - `node -v`
  - `git status --porcelain --untracked-files=all`
  - `node scripts/sync-agent-skills.mjs --check`
  - `node scripts/ai-workflow-check.selftest.mjs`
  - `node scripts/test-uxui-fixtures.mjs`
  - `node scripts/test-qa-gate-fixtures.mjs`
  - `node scripts/ai-workflow-check.mjs --repo .`
  - CI-style workflow check with explicit changed-files input for this audit's changed files.
- Checks run:
  - `node -v`
  - `git status --porcelain --untracked-files=all`
  - `node -e "const p=require('./package.json'); ..."`
  - `node scripts/sync-agent-skills.mjs --check`
  - `node scripts/ai-workflow-check.selftest.mjs`
  - `node scripts/test-uxui-fixtures.mjs`
  - `node scripts/test-qa-gate-fixtures.mjs`
  - `node scripts/ai-workflow-check.mjs --repo .`
  - GStack mapping existence/metadata checklist.
  - `.claude/settings.local.json` permission classification by inspection.
  - `.codex/superpowers` plugin/hook inspection.
  - Final CI-style changed-files check after artifact creation.
- Latest results:
  - Node: `v24.15.0`.
  - Package engine: `>=24 <25`.
  - GitHub Actions workflow Node: `22`.
  - Git status: many pre-existing modified/untracked files; this run only added the audit ledger and report.
  - Skill mirror sync: PASS, `PASS agent skill mirrors are in sync`.
  - Checker self-test: PASS, `ai-workflow-check self-test passed`.
  - UX/UI fixture tests: PASS, `5/5 fixtures PASS`.
  - QA Gate fixture tests: PASS, `5/5 fixtures PASS`.
  - Repository workflow checker before artifact creation: PASS, `PASS repository state`.
  - Final repository workflow checker after artifact creation: FAIL due unrelated untracked ledger `docs/ai-workflow/runs/2026/05/28/20260528-2100-ia-verification-phase-5-fixes.md` missing `## Ledger/File-State Consistency`.
  - GStack mapping: all eight planned Codex/Claude pairs exist and map to the same gate.
  - Final CI-style changed-files check: PASS after adding this ledger/report.
- Known failures:
  - Full-repository workflow check now fails on an unrelated ledger outside this audit's accepted write scope: `docs/ai-workflow/runs/2026/05/28/20260528-2100-ia-verification-phase-5-fixes.md`.
- Skipped checks and reason:
  - TDD: skipped - read-only audit and generated report, no production behavior.
  - Browser/visual QA: skipped - static HTML report, no app UI route or browser flow.
  - Independent Claude review: skipped/degraded - not available in this Codex automation run.
- Cross-model review: degraded - single Codex automation run; prior cross-model evidence was consulted, but no new independent Claude Code reviewer was invoked for this report.
- Architecture Pass: skipped - not a phase ledger or production architecture change.
- Light Spec: skipped - not phase-sized implementation.
- UX/UI Consistency Pass: skipped - report/ledger-only audit artifact, no UI source files changed.
  - Tokens: skipped - same reason.
  - Components: skipped - same reason.
  - A11y: skipped - same reason.
  - Responsive: skipped - same reason.
- QA Gate: skipped - no browser/user flow changed.

## Fallback State

- Normal path blocked: independent Claude Code cross-model reviewer unavailable in this Codex automation run.
- Failure class: degraded-mode.
- Fallback used: manual self-review checklist, prior cross-model audit evidence, and fresh local verification commands.
- Evidence collected: all audit-plan verification commands run and read; prior audit ledgers/reports consulted; host settings and skill surfaces inspected.
- Completion allowed: yes for this audit artifact, because this run's changed-files check passes and the full-repository failure is unrelated to the accepted scope. The unrelated ledger remains a repository health blocker for any broader completion claim.
- Remaining fallback risk: an independent Claude Code reviewer may reprioritize findings, especially host-permission severity.

## Ledger/File-State Consistency

- Files changed match accepted scope: yes.
- Docs consulted match implemented behavior: yes.
- Child result packets integrated: not applicable.
- Verification state current: yes.
- Remaining risks listed: yes.

## Risks And Follow-Up

- Remaining risks:
  - Existing unrelated working-tree changes are extensive and were not audited as product/code correctness.
  - Full-repository workflow checker currently fails on an unrelated untracked ledger missing `## Ledger/File-State Consistency`.
  - `.claude/settings.local.json` broad permissions remain unchanged by this audit.
  - `AGENTS.md` and `CLAUDE.md` stale project-state wording remains unchanged by this audit.
  - Node version mismatch remains unchanged by this audit.
  - Cross-model review for this report is degraded.
- Assumptions:
  - The stable audit plan path is authoritative for this automated run.
  - The audit report should not include fixes or direct edits beyond the two allowed artifacts.
- Follow-up needed:
  - Separate implementation request to narrow Claude permissions.
  - Separate implementation request to update stale project-state wording.
  - Separate implementation request to align CI Node with `package.json` engines or document why checker-only CI intentionally stays on Node 22.
