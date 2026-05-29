# IA Specialist Checklists Documentation Ledger

## Run

- Date: 2026-05-29
- Owner: Codex
- Scope: docs-only IA remediation workflow documentation.
- Status: complete

## User Request

Create the separate documentation set for the IA remediation process using the conflict-resolution approach already discussed:

- Do not rewrite the original IA implementation verification execution plan.
- Create a separate execution plan for IA remediation.
- Add specialist checklist docs and the IA-to-checklist profile map.
- Include the audit report impact as input priority and queue guidance.
- Get a separate agent review before closeout.

## Docs Consulted

- `AGENTS.md`
- `.codex/skills/executing-plans/SKILL.md`
- `docs/agent-index.md`
- `docs/user-communication-style.md`
- `docs/ai-development-workflow.md`
- `docs/ai-workflow/context-and-packets.md`
- `docs/ai-workflow/agent-packets.md`
- `docs/ai-workflow/review-gates.md`
- `docs/ai-workflow/fallback-and-recovery.md`
- `docs/ai-workflow/context-ledger-template.md`
- `docs/ai-workflow/README.md`
- `docs/ai-workflow/ia-page-implementation-verification.md`
- `docs/IA/README.md`
- `docs/sitemap.md`
- `reports/ia-verification/runs/20260528-141731/ia-audit-report.html`
- `reports/ia-verification/runs/20260528-141731/ia-implementation-audit.json`
- `.agents/superpowers/skills/using-superpowers/SKILL.md`
- `C:\Users\admin\.codex\skills\.system\skill-installer\SKILL.md`
- `C:\Users\admin\.codex\skills\ui-ux-pro-max\SKILL.md`
- Untouched relevant docs:
  - `docs/ai-workflow/ia-implementation-verification-execution-plan.md` - intentionally left unchanged because this task creates a separate remediation execution document.
- Untouched relevant docs and reason:
  - `docs/ai-workflow/ia-implementation-verification-execution-plan.md` - upstream audit execution plan, not the target for checklist wiring.

## Decisions

- Keep `docs/ai-workflow/ia-implementation-verification-execution-plan.md` unchanged.
- Add `docs/ai-workflow/ia-remediation-multi-agent-execution-plan.md` as the separate orchestration document for remediation work.
- Treat the HTML audit report as human-readable triage only.
- Treat machine-readable audit JSON as the source that controls final labels and closeout.
- Route each IA through one IA execution agent, with optional specialist agents selected from the profile map.
- Add a monitor role concept in the remediation execution plan, read-only and reporting to the coordinator.
- Require cross-IA flow impacts to use an explicit lifecycle instead of being silently handled inside a single IA task.
- Apply cross-agent review findings by adding the standard packet extension template, monitor packet/result contract, `carried-forward` lifecycle state, and audit JSON/profile metadata authority split.
- Added a Mermaid workflow diagram to `docs/ai-workflow/ia-remediation-multi-agent-execution-plan.md` so the coordinator, IA execution agent, specialists, monitor, evidence refresh, cross-IA lifecycle, and completion gate are visible in one flow.
- Applied the second review/debate/tie-breaker result: execution must start with Phase 0 preflight, persisted run state, dispatch budget, heartbeat/timeouts, write locks, explicit flow-edge manual evidence, and coordinator-owned final verification.
- Added tool/MCP/plugin/skill policy so every agent packet declares allowed tools, required skills, tool preflight status, fallbacks, and evidence.
- Installed `ui-ux-pro-max` into `C:\Users\admin\.codex\skills\ui-ux-pro-max` from `nextlevelbuilder/ui-ux-pro-max-skill` path `.claude/skills/ui-ux-pro-max`.
- Required UX/UI specialists to use `ui-ux-pro-max` for UI structure, visual design, interaction, accessibility, responsive, or perceived-quality review.
- Added fixed handoff-note checkpoints so a dead or hung session can be resumed from run artifacts.
- Added execution-slice and workslop controls so agents receive compact role-specific packets instead of the entire workflow document.

## Files Changed

- Added `docs/ai-workflow/ia-remediation-multi-agent-execution-plan.md`.
- Added `docs/ai-workflow/ia-specialist-checklists/`.
- Added `docs/ai-workflow/ia-review-profiles/`.
- Updated `docs/ai-workflow/README.md` for discoverability.
- Added `docs/ai-workflow/ia-specialist-checklists/11-monitor-agent-checklist.md` after cross-agent review.
- Installed host skill outside the repository:
  - `C:\Users\admin\.codex\skills\ui-ux-pro-max`

## Active Files

- Files expected to change:
  - `docs/ai-workflow/ia-remediation-multi-agent-execution-plan.md`
  - `docs/ai-workflow/ia-specialist-checklists/`
  - `docs/ai-workflow/ia-review-profiles/`
  - `docs/ai-workflow/README.md`
  - `docs/ai-workflow/runs/2026/05/29/20260529-1602-ia-specialist-checklists.md`
- Files inspected:
  - `docs/ai-workflow/ia-page-implementation-verification.md`
  - `docs/IA/README.md`
  - `docs/sitemap.md`
  - `reports/ia-verification/runs/20260528-141731/ia-audit-report.html`
  - `reports/ia-verification/runs/20260528-141731/ia-implementation-audit.json`
- Files changed:
  - `docs/ai-workflow/ia-remediation-multi-agent-execution-plan.md`
  - `docs/ai-workflow/ia-specialist-checklists/README.md`
  - `docs/ai-workflow/ia-specialist-checklists/00-shared-rating-rubric.md`
  - `docs/ai-workflow/ia-specialist-checklists/01-coordinator-checklist.md`
  - `docs/ai-workflow/ia-specialist-checklists/02-ia-shard-reviewer-checklist.md`
  - `docs/ai-workflow/ia-specialist-checklists/03-ux-ui-reviewer-checklist.md`
  - `docs/ai-workflow/ia-specialist-checklists/04-form-error-reviewer-checklist.md`
  - `docs/ai-workflow/ia-specialist-checklists/05-hosted-surface-reviewer-checklist.md`
  - `docs/ai-workflow/ia-specialist-checklists/06-security-data-reviewer-checklist.md`
  - `docs/ai-workflow/ia-specialist-checklists/07-ai-ux-reviewer-checklist.md`
  - `docs/ai-workflow/ia-specialist-checklists/08-ops-policy-reviewer-checklist.md`
  - `docs/ai-workflow/ia-specialist-checklists/09-automation-owner-checklist.md`
  - `docs/ai-workflow/ia-specialist-checklists/10-reconciliation-final-verifier-checklist.md`
  - `docs/ai-workflow/ia-specialist-checklists/11-monitor-agent-checklist.md`
  - `docs/ai-workflow/ia-review-profiles/README.md`
  - `docs/ai-workflow/ia-review-profiles/ia-review-profile-map.json`
  - `docs/ai-workflow/README.md`
  - `docs/ai-workflow/runs/2026/05/29/20260529-1602-ia-specialist-checklists.md`
- Files explicitly not to touch:
  - `docs/ai-workflow/ia-implementation-verification-execution-plan.md`

## Verification Log

Initial checks:

- `node` JSON parse/profile validation: pass, 34 IA rows.
- `rg -n "ia-specialist-checklists|ia-review-profiles" docs/ai-workflow`: pass, references found.
- `rg -n "TODO|TBD|fill in|later" docs/ai-workflow/ia-specialist-checklists docs/ai-workflow/ia-review-profiles`: pass, no placeholder markers found.
- `node scripts/ai-workflow-check.mjs --repo .`: failed before ledger shape update; required sections added in this ledger revision.

## Verification State

- Required checks:
  - JSON parse/profile validation.
  - Reference discoverability search.
  - Placeholder-marker search.
  - Manual link existence check.
  - `node scripts/ai-workflow-check.mjs --repo .`.
- Checks run:
  - JSON parse/profile validation.
  - Reference discoverability search.
  - Placeholder-marker search.
  - First workflow check.
  - Manual markdown link existence check.
  - Final workflow check after review fixes.
  - Cross-agent review and re-review.
  - `ui-ux-pro-max` install check and install from GitHub.
  - Workflow document section search after tool/handoff/workslop additions.
- Latest results:
  - JSON/profile/reference/placeholder/link checks passed.
  - `node scripts/ai-workflow-check.mjs --repo .` passed after fixes.
  - Final critic re-review passed.
  - `ui-ux-pro-max` installed successfully.
- Known failures:
  - None outstanding. Historical failures were fixed: ledger shape, monitor packet inheritance, cross-IA carried state, metadata authority split, and monitor contract detail.
- Skipped checks and reason:
  - None.
- Cross-model review: passed - critic agents `019e72a6-42ba-7113-8b42-9ec1f4483001`, `019e72ac-a4e7-7d61-a107-134935c706e0`, and `019e72af-d062-70f2-99ac-c31f965dc975`; final verdict PASS.
- Second review/debate/tie-breaker cycle: passed after fixes - review agents `019e72ba-b873-70a2-994d-e163912b9226`, `019e72ba-f1ae-7c13-9851-a37028975f38`, `019e72bb-2c40-7800-aa21-ef82652846ab`, tie-breaker `019e72c0-71d2-7c11-8456-220c678e25b2`, and final patch reviewer `019e72c5-6b42-7d92-ae66-6f35be113fab`; final verdict PASS.
- Tool/handoff/workslop amendment review: degraded - focused docs-only amendment verified by workflow checker and section search; no new separate review agent was spawned for this amendment.
- Architecture Pass: skipped - docs-only workflow documentation change, no architecture implementation.
- UX/UI Consistency Pass: skipped - no product UI files changed.
- QA Gate: skipped - no runnable product behavior changed.

## Review Log

- Cross-agent review by critic agent `019e72a6-42ba-7113-8b42-9ec1f4483001`: REJECT before fixes.
- Finding 1 fixed: IA task packets now explicitly extend `docs/ai-workflow/agent-packets.md` and include standard plus IA-specific fields.
- Finding 2 fixed: cross-IA closeout now uses explicit `carried-forward` lifecycle state with owner, risk, due trigger, affected IA, and required evidence.
- Finding 3 fixed: read-only monitor agent now has cadence, task fields, result fields, escalation thresholds, and a dedicated checklist.
- Finding 4 fixed: audit JSON now controls label evidence only; route/audience/route type/pack metadata comes from active docs and profile rows.
- Re-review by critic agent `019e72ac-a4e7-7d61-a107-134935c706e0`: REJECT before final fix.
- Re-review finding fixed: monitor task and result packets now explicitly extend the standard packet templates and include monitor-specific fields.
- Final re-review by critic agent `019e72af-d062-70f2-99ac-c31f965dc975`: PASS, no findings.
- Second review round:
  - Critic agent `019e72ba-b873-70a2-994d-e163912b9226`: REJECT; identified infinite requeue, missing flow-edge tooling, shared ownership, cross-IA loops, monitor bottleneck, dirty-worktree false conflicts, and final verifier ambiguity.
  - Architect agent `019e72ba-f1ae-7c13-9851-a37028975f38`: BLOCK; identified missing queue state machine, dispatch budget, heartbeat/timeout policy, cross-IA scheduling, final verifier ownership, workflow gates, and manual flow-edge fallback.
  - Verifier agent `019e72bb-2c40-7800-aa21-ef82652846ab`: PARTIAL; simulated likely stalls from human-confirmation mismatch, absent flow-edge artifacts, hosted-surface trigger failures, security fixture gaps, ambiguous PARTIAL rows, and missing fresh task packets.
  - Discussion consensus: use lightweight JSON/ledger artifacts, not a heavy orchestration engine; add run-control safeguards before remediation implementation.
  - Tie-breaker agent `019e72c0-71d2-7c11-8456-220c678e25b2`: REVISE; required atomic queue claim/lease, run closeout states, dispatch budget, heartbeat/timeout policy, write locks, Phase 0 preflight, manual flow-edge evidence schema, and coordinator-owned final verifier.
  - Final patch reviewer `019e72c5-6b42-7d92-ae66-6f35be113fab`: REVISE; remaining issues were `waiting_specialist` timeout recovery and atomic claim file-write sequence.
  - Final patch reviewer findings fixed: added specialist timeout transition to `requeue_requested` or `blocked_terminal`, P0 alert for timed-out specialists, and atomic temp-file/rename/re-read claim sequence.
  - Final patch re-review by agent `019e72c5-6b42-7d92-ae66-6f35be113fab`: PASS; no remaining must-fix document gaps and no plausible unresolved hang/bottleneck from timeout, queue, lease, write-lock, flow-edge, or final-verifier rules.

## Fallback State

- Normal path blocked: no.
- Failure class: none.
- Fallback used: none.
- Evidence collected: JSON/profile/reference/placeholder checks.
- Completion allowed: yes.
- Remaining fallback risk: the tool/handoff/workslop amendment has not received a separate fresh agent review.

## Ledger/File-State Consistency

- Files changed match accepted scope: yes.
- Docs consulted match implemented behavior: yes.
- Child result packets integrated: yes.
- Verification state current: yes.
- Remaining risks listed: yes.

## Remaining Risks

- The current repository contains unrelated dirty files that are outside this docs task.
- Some existing docs displayed mojibake during inspection; this task avoids rewriting those sections.
- Codex may need a restart before the newly installed `ui-ux-pro-max` skill appears in native skill discovery.
