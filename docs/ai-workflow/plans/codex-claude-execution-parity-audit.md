# Codex / Claude Execution Parity Audit Plan

## Summary

- Goal: Audit whether `.codex` and `.claude` lead agents through the same task execution rules, review gates, reporting requirements, and safety behavior.
- Decision standard: Exact folder and file names do not need to match. Execution semantics must match: same canonical source, same startup sequence, same fail-closed behavior, same verification gates, and same evidence reporting.
- Deliverables:
  - One run ledger under `docs/ai-workflow/runs/2026/05/28/`
  - One Korean HTML audit report under `reports/`
  - A prioritized list of defects and follow-up proposals

## Codex Automation Use

- Stable reference path: `docs/ai-workflow/plans/codex-claude-execution-parity-audit.md`.
- Scope: use this document only for this repository's `.codex` / `.claude` execution-parity audit.
- Automation behavior: run the audit and produce evidence; do not repair `.codex`, `.claude`, `.agents`, scripts, CI, or workflow docs unless a separate implementation request explicitly authorizes fixes.
- Required outputs for every automated run:
  - a run ledger under `docs/ai-workflow/runs/YYYY/MM/DD/`,
  - a Korean HTML report under `reports/`,
  - verification command results,
  - parity defects separated from shared workflow health defects.
- Safety boundary: broad host permissions never override `AGENTS.md` fail-closed rules for destructive, credential-risk, external-production, or scope-changing actions.

## Docs Consulted

- `.agents/superpowers/skills/using-superpowers/SKILL.md`
- `docs/agent-index.md`
- `docs/ai-development-workflow.md`
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
- `scripts/sync-agent-skills.mjs`
- `.github/workflows/ai-workflow-check.yml`
- `reports/codex-claude-workflow-evaluation.html`
- `reports/opus-vs-codex-workflow-consensus.html`

## Extracted Requirements

- Every agent task starts with Superpowers, then `docs/agent-index.md`, then the smallest relevant document set.
- `.agents` is the canonical source for project skills; `.codex/skills` and `.claude/skills` are host-specific mirrors.
- Codex GStack skills use `gstack-*` names; Claude Code GStack skills use short names. Name differences are acceptable only when they route to the same workflow gate.
- Non-trivial work requires a run ledger.
- Cross-model review is required for code changes and non-trivial plan or doc changes. If unavailable, record degraded mode with evidence and remaining risk.
- Final reports must include verification commands, remaining risks, document conflicts, untouched relevant docs, and ledger state.

## Doc Conflicts

- No direct conflict with the user's audit request.
- Audit risk to inspect: `AGENTS.md` and `CLAUDE.md` still contain pre-implementation wording while `src/` and `package.json` exist. This may be identical between hosts but still unhealthy for the workflow.

## Untouched Relevant Docs

- Product, IA, UI, Supabase, and deployment specs are intentionally not read for this audit because the task concerns AI execution harness parity, not product behavior.

## Out of Scope — Intentional Cuts

- Do not fix `.codex`, `.claude`, `.agents`, scripts, CI, or workflow documents during this audit run.
- Do not commit, push, or open a pull request.
- Do not run destructive commands or mutate host settings.
- Do not judge product feature correctness, UI completeness, Supabase behavior, or deployment readiness.
- Do not require byte-for-byte equality for files whose host-specific names or wrappers are intentionally different.

## Smallest Buildable Unit

The smallest useful slice is a read-only parity audit that:

- creates a run ledger,
- inspects the canonical skill source and both host mirrors,
- classifies exact-file parity versus execution-semantic parity,
- checks Claude and Codex permission/safety surfaces,
- runs local workflow verification, and
- writes a single HTML report with pass, concern, and defect findings.

This slice is complete without fixing any defect it finds.

## Audit Scope

- Canonical and mirrored skills:
  - `.agents/skills`
  - `.agents/superpowers/skills`
  - `.codex/skills`
  - `.claude/skills`
- Host execution settings:
  - `AGENTS.md`
  - `CLAUDE.md`
  - `.claude/settings.local.json`
  - `.codex/superpowers`
  - `.codex/superpowers/hooks`
- Verification and CI:
  - `scripts/sync-agent-skills.mjs`
  - `scripts/ai-workflow-check.mjs`
  - `scripts/ai-workflow-check.selftest.mjs`
  - `scripts/test-uxui-fixtures.mjs`
  - `scripts/test-qa-gate-fixtures.mjs`
  - `.github/workflows/ai-workflow-check.yml`
- Prior evidence:
  - `docs/ai-workflow/runs/2026/05/22/20260522-0920-codex-claude-workflow-evaluation.md`
  - `reports/codex-claude-workflow-evaluation.html`
  - `reports/opus-vs-codex-workflow-consensus.html`

## Parity Rules

| Surface | Required comparison | Pass condition |
| --- | --- | --- |
| TALKPIK skills | exact mirror sync | `sync-agent-skills --check` passes |
| Practical skills | exact mirror sync | `sync-agent-skills --check` passes |
| Superpowers skills | exact mirror sync | `sync-agent-skills --check` passes |
| GStack host skills | role mapping, not hash parity | Codex `gstack-*` and Claude short names route to the same gate |
| `AGENTS.md` and `CLAUDE.md` | execution meaning | same startup, docs, ledger, fail-closed, review, and report behavior |
| Host permissions | safety effect | broad permissions do not weaken fail-closed rules |
| CI/checker scripts | evidence enforcement | local and CI-style checks enforce the same required fields |

## GStack Mapping To Verify

| Codex skill | Claude Code skill | Gate |
| --- | --- | --- |
| `gstack-office-hours` | `office-hours` | scope/product clarification |
| `gstack-plan-ceo-review` | `plan-ceo-review` | product/business plan review |
| `gstack-plan-design-review` | `plan-design-review` | UX/design plan review |
| `gstack-plan-eng-review` | `plan-eng-review` | engineering plan review |
| `gstack-review` | `review` | code/doc review |
| `gstack-qa` | `qa` | interactive QA |
| `gstack-qa-only` | `qa-only` | report-only QA |
| `gstack-ship` | `ship` | release/finish gate |

## Tasks

| # | Task | Files / scope | Subagent-eligible? (Y/N + reason) |
| --- | --- | --- | --- |
| 1 | Create audit run ledger | `docs/ai-workflow/runs/2026/05/28/` | N - main session owns durable context |
| 2 | Re-collect previous audit evidence | `docs/ai-workflow/runs/**`, `reports/**` | Y - read-only evidence search |
| 3 | Check canonical skill mirror sync | `.agents/**`, `.codex/skills/**`, `.claude/skills/**`, `scripts/sync-agent-skills.mjs` | Y - read-only command and inspection |
| 4 | Verify GStack mapping table | `.codex/skills/gstack-*`, `.claude/skills/*`, `docs/ai-workflow/harness-and-skills.md` | Y - isolated read-only mapping review |
| 5 | Compare startup and fail-closed instructions | `AGENTS.md`, `CLAUDE.md`, `docs/ai-development-workflow.md` | Y - read-only semantic comparison |
| 6 | Classify host permission risks | `.claude/settings.local.json`, `.codex/**` | Y - read-only settings classification |
| 7 | Run workflow verification commands | scripts and repo status | N - main session should read and integrate all outputs |
| 8 | Write HTML audit report | `reports/codex-claude-execution-parity-audit-20260528.html` | N - final synthesis depends on all findings |

## Execution Steps

1. Create the run ledger at `docs/ai-workflow/runs/2026/05/28/20260528-HHMM-codex-claude-execution-parity-audit.md`.
2. Use `rg` to find previous Codex/Claude/workflow audit evidence in `docs/ai-workflow/runs/`, `reports/`, `docs/ai-workflow/plans/`, and `tasks/`.
3. Run `node scripts/sync-agent-skills.mjs --check` and record whether canonical mirrors are exactly synchronized.
4. Build a GStack mapping checklist from the table above and verify each pair has equivalent purpose and gate language.
5. Compare `AGENTS.md` and `CLAUDE.md` for startup sequence, docs selection, ledger requirements, fail-closed rules, fallback handling, cross-model review, and Korean communication style.
6. Inspect `.claude/settings.local.json` and classify allowed commands as:
   - destructive,
   - external,
   - dependency-changing,
   - credential-risk,
   - low-risk local inspection.
7. Inspect `.codex/superpowers` and `.codex/superpowers/hooks` to identify Codex-specific hook behavior or missing equivalent Claude behavior.
8. Separate findings into:
   - parity defect: Codex and Claude behave differently,
   - workflow health defect: both behave the same but the shared rule is stale or unsafe,
   - documented difference: behavior differs by host but remains safe and intentional.
9. Run verification commands and record exact pass/fail status in the ledger.
10. Write the Korean HTML report using the project communication style: one-line conclusion, three scoreboard cards, priority actions, and glossary.

## Verification Plan

Run these commands and read their output:

```powershell
node -v
git status --porcelain --untracked-files=all
node scripts/sync-agent-skills.mjs --check
node scripts/ai-workflow-check.selftest.mjs
node scripts/test-uxui-fixtures.mjs
node scripts/test-qa-gate-fixtures.mjs
node scripts/ai-workflow-check.mjs --repo .
```

Also run a CI-style workflow check with an explicit changed-files input for this audit's changed files. If a PR body check is required, use a temporary PR body file that includes the planned final report fields.

Record Node version mismatch as a defect candidate when local `package.json` engine requirements and CI Node setup differ.

## Report Structure

The final HTML report goes to:

`reports/codex-claude-execution-parity-audit-20260528.html`

Required sections:

- one-line conclusion,
- three-card scoreboard,
- priority findings,
- each finding as "무슨 일? / 왜 문제? / 고치는 법?",
- verification command results,
- docs consulted,
- untouched relevant docs,
- remaining risks,
- glossary.

## Assumptions

- "Must be identical" means execution-semantic parity, not byte-for-byte folder parity.
- The audit may identify defects, but fixing them is a separate task.
- If independent cross-model review is unavailable, the ledger records degraded mode and the report names the remaining risk.

## Prior Plan Review Result

A separate critic agent reviewed the first plan and returned `FAIL`. This v2 plan incorporates the required changes:

- expanded scope to `.codex/superpowers`, hooks, and previous ledger evidence,
- file-group-specific parity rules,
- explicit permission-risk classification,
- full GStack mapping table,
- CI-style verification,
- separate parity defects from shared workflow health defects.
