# Codex GPT 5.5 — Phase 7 Plan Pre-Review (round 1)

The Opus 4.7 agent wrote Phase 7 plan for fixing the 13 P0/P1 findings from the Implementation Coverage Audit. The fix proposals (per-item options) already went through 1 Codex review + 2 user decisions and are 100% consensus. This review is on the plan SHAPE — does it correctly translate the consensus into a buildable phase plan?

## Files to read

- **Plan to review**: `docs/ai-workflow/plans/20260524-phase-7-coverage-gap-fill.md`
- **Light Spec (companion)**: `docs/ai-workflow/light-specs/phase-7-coverage-gap-fill.md`
- **Consensus source**: `docs/ai-workflow/proposals/20260523-coverage-audit-fix-proposals.md` (13건 합의 + 사용자 결정 통합본)
- **Audit report**: `reports/implementation-coverage-audit-20260523.html` (§11 합의서)
- **Past Phase 6 pattern** (for plan format reference): `docs/ai-workflow/plans/20260521-phase-6-admin-library-hardening.md` + `docs/ai-workflow/runs/2026/05/21/20260521-1800-phase-6-admin-library-hardening.md`
- **Workflow contracts**: `docs/ai-workflow/planning-contracts.md`, `docs/ai-workflow/review-gates.md`

## What to verify

1. **Consensus → plan mapping fidelity**: Every fix decision in `docs/ai-workflow/proposals/20260523-coverage-audit-fix-proposals.md` should be reflected in the plan's task table. Spot-check at least 4 tasks against their proposal source (e.g. P0-2 hard/recommended limits, P0-4 3-state checklist, P1-5 3-trigger model, P0-3 LongFormEditor scope).

2. **Sub-phase split feasibility**: Plan suggests 7-A / 7-B / 7-C / 7-D / 7-E split (§11). Verify each sub-phase is genuinely buildable as a separate PR without secret/session cleanup risk (the Round-2 issue from the audit plan review).

3. **Files Likely To Change completeness**: 13 tasks should touch all files needed. Identify any file Opus forgot.

4. **Architecture Pass risk**: Plan claims audience=user only. Verify no task accidentally touches admin code paths or files in `src/lib/admin/`, `src/components/admin/`, `src/app/(workspace)/admin/`.

5. **Out of Scope completeness**: Verify every Tier 2 OOS item from Phase 6 ledger is explicitly excluded. Flag if any leak into a task.

6. **Subagent-eligible rationale**: 11 tasks marked Y. Each "Y — <reason>" claim should be valid (genuinely independent or genuinely parallel-safe). Spot-check at least 3.

7. **TDD enforceability**: Plan claims TDD mandatory. Verify Test Strategy §5 actually names testable surfaces per task.

8. **Risks coverage**: 8 risks listed. Identify any missing (e.g. dependency on Supabase Mailpit availability across machines, LongFormEditor's draft persistence schema impact).

## PASS criteria

All criteria from `docs/ai-workflow/planning-contracts.md`:
- `## Out of Scope — Intentional Cuts` non-empty ✓
- `## Smallest Buildable Unit` non-empty ✓
- Tasks table with `Subagent-eligible? (Y/N + reason)` column ✓
- Audience column with `user | admin | both | n/a` ✓ (all rows `user`)
- Required Output Before Coding fields (Docs consulted, Problem statement, Files likely to change, Test strategy, Known risks, Acceptance criteria, Verification Strategy)

Plus:
- No false negatives vs the 13-item consensus
- Sub-phase split actually safe (no PR boundary cleanup risk)
- Audience boundary verified (no admin contamination)

## Output format

```
VERDICT: <PASS | CONCERN | FAIL>

CONSENSUS-TO-PLAN MAPPING:
| Proposal ID | Mapped to Task # | Faithful? (YES/NO + 1-line) |
| --- | --- | --- |
| P0-1 | Task 1 | ... |
| P0-2 | Task 2 | ... |
| ...(13 rows)... |

SUB-PHASE SPLIT FEASIBILITY:
- 7-A (Task 0): <safe? + reasoning>
- 7-B (Task 1): <safe? + reasoning>
- 7-C (Task 2+3+4+9): <safe? + reasoning>
- 7-D (Task 5+6+7+8+11+12): <safe? + reasoning>
- 7-E (Task 10+13): <safe? + reasoning>

NEW FINDINGS (P1 must fix):
| ID | Section | Issue | Suggested fix |

NEW FINDINGS (P2 advisory):
| ID | Section | Issue | Suggested fix |

MISSED FILES:
- <list any file Opus forgot, or "none">

OOS / AUDIENCE / TIER-2 LEAKS:
- <list leaks, or "none">

OVERALL RECOMMENDATION:
- <PASS as-is | revise with these P1s | proceed sub-phase by sub-phase>
```

Be strict. Phase 7 affects ~15-22 days of work; getting the plan right saves rework.
