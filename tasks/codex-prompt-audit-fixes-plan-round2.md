# Cross-Model Plan-Eng-Review · Round 2
# AI Workflow Audit Fixes — Implementation Plan (after revision)

You are GPT-5 acting as senior plan-eng reviewer. This is round 2 of the Plan-Review PASS Gate (round-cap 5 — workflow-governing change). In round 1 you returned **FAIL** with 5 specific findings. The plan author (Claude Opus 4.7) has revised the plan. Your job: judge whether each round-1 finding is resolved + check whether the revision introduced new issues.

## Files

- **Plan (revised):** `docs/ai-workflow/plans/20260527-1500-ai-workflow-audit-fixes.md`
- **Ledger:** `docs/ai-workflow/runs/2026/05/27/20260527-1500-ai-workflow-audit-fixes.md`
- **Round 1 review (your previous output):** `tasks/codex-runs/audit-fixes-plan-review-round1.txt`
- **Round 1 prompt (for context):** `tasks/codex-prompt-audit-fixes-plan-round1.md`

## Your round-1 findings (verbatim verdicts)

1. **TDD cycle integrity** — FAIL — Tasks 4/5/9 are not RED→GREEN; mark as TDD exceptions per review-gates.md L20-25.
2. **SBU** — PASS.
3. **Out of Scope** — CONCERN — add cut about "unifying local git-status with CI base..head".
4. **Subagent-eligible** — PASS.
5. **P1-2 regression risk** — FAIL — proposed regex requires same-line value; project ledger/template use header + indented bullets shape; would break own ledger/template.
6. **P1-5 design** — CONCERN — silently returns null on missing light spec; should fail-closed.
7. **P0-3 risks** — CONCERN — hard-coded `1700`; ledger has only date; use fs mtime or `1200` sentinel with explicit ledger rationale.
8. **Verification Strategy** — CONCERN — missing commit-message check despite AC mentioning Lore trailers; add Task 11 step or remove AC.
9. **Acceptance Criteria** — CONCERN — "4/4 or 5/5" qa-gate is ambiguous; pick one.
10. **Known Risks** — FAIL — missing R7 about Codex CLI failure/hang.

## What the revision did

Per the ledger Decisions entry at `docs/ai-workflow/runs/2026/05/27/20260527-1500-ai-workflow-audit-fixes.md:43-44` (2026-05-27 15:50):
1. Verification Strategy table now marks Tasks 4/5/9 as TDD exceptions with substitute verification methods.
2. Out of Scope table got a new row about not unifying local/CI checker input semantics.
3. Task 7 redesigned: regex single-line approach replaced with a line-by-line parser that accepts (A) same-line value, (B) header + indented bullets, rejects (C) empty header followed by blank.
4. Task 10 redesigned: `resolvePlanAudienceFromLightSpec` now returns `{ found, audience, missingLightSpec, phaseNum }`; `validatePlanFile` fails-closed when a `phase-N` plan exists but no matching light spec.
5. Task 5 redesigned: timestamp determined by user-provided → fs mtime → `1200` sentinel; ledger Decisions captures rationale.
6. Task 11 Step 3 added: validate a representative commit message with `--commit-message`.
7. Acceptance Criteria pinned to qa-gate **5/5 PASS**; fixture `fx-05-failed-bare.md` is created in Task 8 Step 1b.
8. R7 added covering Codex CLI failure/timeout/hang with degraded + fail-closed escalation.

## What to verify in round 2

For each of the 10 round-1 dimensions, output one of:

- **RESOLVED** — the revision adequately addresses the round-1 finding
- **PARTIALLY RESOLVED** — revision is in the right direction but has a remaining gap (specify exactly)
- **NOT RESOLVED** — revision missed the point or introduced a new bug
- **REGRESSION** — revision introduced a new issue not present in round 1

Cite exact `file:line` for any claim. Read the actual revised plan — do not rely on the ledger summary alone.

Specific checks I want from you:

- **§5 (P1-2)**: read the new parser code in the plan and trace it against `docs/ai-workflow/context-ledger-template.md:21-27` and `docs/ai-workflow/runs/2026/05/27/20260527-1500-ai-workflow-audit-fixes.md:48-51`. Does it accept both shapes correctly? Does it reject the empty case correctly?
- **§6 (P1-5)**: read the new fail-closed code. Does it correctly emit the error message when a `phase-N` plan exists but no matching `phase-N-*.md` light spec? Is the slug regex `^phase-${phaseNum}[-_.]` precise enough (e.g., would it incorrectly match `phase-12` when looking for `phase-1`)?
- **§10 (R7)**: read the new R7 wording. Does it explicitly forbid PASS on degraded-only? Does it specify timeout and stderr capture?

## Output format

Open with:

```
ROUND 2 VERDICT: PASS | CONCERN | FAIL
SUMMARY: <2-3 sentences>
RESOLVED: <count>/10
NEW ISSUES: <count>
```

Then per dimension:

```
### <n>. <name>
Status: RESOLVED | PARTIALLY RESOLVED | NOT RESOLVED | REGRESSION
Evidence: <file:line cites>
Remaining gap (if any): <specific>
```

Then a "## New Issues / Regressions" section if any, and a "## Final recommendation" section: PASS to proceed to implementation, or CONCERN with specifically what is needed, or FAIL with revise + round 3.

## Discipline

- Round-cap: this is round 2 of max 5. Round 3 needs revision; round 4 needs careful judgment; round 5 = escalate to user.
- If a remaining gap is purely cosmetic (typo, naming, slug nit), say PASS and note as cosmetic in cross-cutting concerns — don't FAIL on those.
- If you find a NEW issue the revision introduced, flag it clearly with REGRESSION.

Begin.
