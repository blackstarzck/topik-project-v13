# Cross-Model Plan-Eng-Review · Round 1
# AI Workflow Audit Fixes — Implementation Plan

You are GPT-5 acting as senior plan-eng reviewer on an implementation plan authored by Claude Opus 4.7. This is a strict plan-eng-review per `docs/ai-workflow/review-gates.md` §Plan-Review PASS Gate.

## Context

- **Plan file to review:** `docs/ai-workflow/plans/20260527-1500-ai-workflow-audit-fixes.md`
- **Source audit report:** `reports/ai-workflow-audit-20260527.html` (lists the P0 + P1 issues being fixed)
- **Ledger for this work:** `docs/ai-workflow/runs/2026/05/27/20260527-1500-ai-workflow-audit-fixes.md`
- **Plan purpose:** Fix 3 P0 issues + 5 P1 issues found in an audit of this project's own AI workflow infrastructure (the checker, CI, and supporting docs).

## What to read first (and how to use them)

1. `docs/ai-workflow/planning-contracts.md` — required plan sections (`Out of Scope — Intentional Cuts`, `Smallest Buildable Unit`, `Subagent-eligible` column). Use as the contract the plan must satisfy.
2. `docs/ai-workflow/review-gates.md` — Plan-Review PASS Gate, Round-cap rule, Disagreement resolution, QA Gate, UX/UI Consistency Pass.
3. `docs/ai-development-workflow.md` — entry point + Audience rules.
4. `scripts/ai-workflow-check.mjs` — the checker that the plan is modifying. Read in full.
5. `scripts/ai-workflow-check.selftest.mjs` — the selftest that the plan is modifying. Pay special attention to line 419-429 (the broken assertion the plan fixes).
6. `.github/workflows/ai-workflow-check.yml` — current CI structure that Task 4 modifies.
7. The plan file itself.

## Background — what already shipped vs what the plan does

The audit found:
- **P0-1:** selftest fixture is missing `Audience:` field — `node scripts/ai-workflow-check.selftest.mjs` currently fails at line 429.
- **P0-2:** CI yaml only runs the main checker, not the selftest or two fixture scripts (`test-uxui-fixtures.mjs`, `test-qa-gate-fixtures.mjs`).
- **P0-3:** Untracked ledger `docs/ai-workflow/runs/2026/05/26/20260526-auth-error-callback-ux-review.md` violates the `YYYYMMDD-HHMM-` naming pattern.
- **P1-1:** `UI_CHANGE_PATTERNS` regex `/theme/i` is too broad — matches docs paths.
- **P1-2:** "Untouched relevant docs" is required evidence in 3 docs but the checker doesn't enforce it.
- **P1-3:** QA Gate `failed` without reason passes the checker (only `skipped` is checked).
- **P1-4:** Local checker uses `git status`, CI uses `git diff base..head` — not documented.
- **P1-5:** Audience column requirement in plan task tables is not enforced when light spec phase Audience is `both`.

## Review dimensions

For each dimension, give an explicit verdict (PASS / CONCERN / FAIL) with concrete reasons. Cite exact file:line numbers.

1. **TDD cycle integrity** — Does each implementation task (Task 3-10) have a clear RED step that demonstrably fails before GREEN? Are the assertions specific enough to catch regressions?

2. **Smallest Buildable Unit choice** — Is "P0-1 + P0-2 together" the right SBU? Would a smaller or larger unit be better? The plan argues both must ship together to avoid same-regression risk.

3. **Out of Scope completeness** — What's missing from Out of Scope that *should* be cut? What's wrongly cut and should actually be in scope?

4. **Subagent-eligible classification** — Each row in the task table. Are the Y/N decisions correct? Especially: Tasks 6-10 modify the same file (ai-workflow-check.mjs) — plan marks them N (sequential). Is that right or could some be parallel?

5. **P1-2 regression risk** — The plan claims `Untouched relevant docs` enforcement on *changed ledgers only* won't break existing untouched ledgers. Verify by reading `validateLedger` and `checkRepositoryState` logic in `scripts/ai-workflow-check.mjs`. Is the claim accurate? Are there edge cases?

6. **P1-5 design soundness** — The plan cross-references light spec ↔ plan via `phase-N` slug matching. What's the failure mode when a phase plan exists but no light spec (skip vs error)? Are there simpler approaches? Is `existsSync` import already available in the script?

7. **P0-3 risks** — Renaming an untracked file with assumed timestamp `1700`. Plan says "ask user if uncertain". Is the fallback sufficient? Could the file body (Created/Updated fields) provide the actual time?

8. **Verification Strategy completeness** — Plan §Verification Strategy lists 8 gates. Are any missing? Is Architecture Pass correctly marked n/a (this is workflow infrastructure, not a domain phase)?

9. **Acceptance Criteria measurability** — Are they bind-test? Anything unverifiable?

10. **Known Risks** — R1-R6. Anything missed? Especially: what happens if `codex exec` in Task 0/2/12 fails or hangs?

## Output format

Open with a single verdict block:

```
VERDICT: PASS | CONCERN | FAIL
SUMMARY: <2-3 sentences>
```

Then for each dimension:

```
### <n>. <name>
Verdict: PASS | CONCERN | FAIL
Finding: <specific finding with file:line cites>
Suggested fix: <if not PASS, exact text or code change>
```

End with a "## Cross-cutting concerns" section for anything not covered by the 10 dimensions.

## Discipline

- Cite exact file:line numbers when pointing at issues. The plan is at `docs/ai-workflow/plans/20260527-1500-ai-workflow-audit-fixes.md`.
- Do not propose scope expansion — challenge whether scope is right.
- If a P1 item should arguably be deferred or escalated, say so.
- If something in the plan is actually fine and you'd accept it, mark PASS — don't manufacture concerns.
- Round-cap: this is round 1 of max 5 (this work touches workflow-governing files). After 3 rounds without PASS, escalate to user.

Begin.
