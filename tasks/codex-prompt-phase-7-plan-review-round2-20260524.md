# Codex GPT 5.5 — Phase 7 Plan Pre-Review (round 2)

Round 1 (CONCERN, 8 P1 + 4 P2) → rev1. This is Round 2 of 5.

## Files to read

- **Plan rev1**: `docs/ai-workflow/plans/20260524-phase-7-coverage-gap-fill.md`
- **Round 1 output**: `tasks/codex-output-phase-7-plan-review-20260524.md`
- **Companion light spec**: `docs/ai-workflow/light-specs/phase-7-coverage-gap-fill.md`
- **Consensus source**: `docs/ai-workflow/proposals/20260523-coverage-audit-fix-proposals.md`

## What changed in rev1 (verify)

| Round 1 finding | rev1 fix claim | Where to verify |
| --- | --- | --- |
| P1-PLAN-1 P0-2 exact limits | Task 2 row now lists 51/52/53/54 hardMin/hardMax/recommendedMin/recommendedMax | Task table Task 2 |
| P1-PLAN-2 wrong file paths | Task 6 → `src/lib/practice/next.ts`. Task 12 → `src/lib/practice/queries.ts` | Task table Task 6, 12 |
| P1-PLAN-3 writing/server.ts missing | Task 3 row now lists `src/lib/writing/server.ts` + materials select extension + LongFormDraftJson type | Task 3 |
| P1-PLAN-4 P1-6 missing typed/data surfaces | Task 10 row now lists `src/lib/supabase/types.ts`, `src/lib/settings/{types,server,mutations}.ts`, `src/app/(workspace)/profile/page.tsx` | Task 10 |
| P1-PLAN-5 TDD not enforceable | §5 Test Strategy rewritten with per-task RED test surface table (13 rows + paths) | §5 |
| P1-PLAN-6 LongFormEditor draft persistence | Task 3 row defines `answer_json` schema for 53 sections + 54 checklist with `_v` field | Task 3 |
| P1-PLAN-7 OOS incomplete + Task 13 e2e | OOS section adds OOS-4/6/8/12 + Task 13 row notes "OOS-4 partial reopen for golden-path only" | Out of Scope + Task 13 |
| P1-PLAN-8 Subagent-eligible wrong | Tasks 2/4/5/9/12 flipped from Y to N where shared-file/dependency exists; §11 sub-phase split now has internal sequencing | Task table + §11 |
| P2-PLAN-1 Mailpit risk | R-9 added | §6/§10 |
| P2-PLAN-2 redirect URLs | R-10 added (URL builder helper `src/lib/auth/redirect-url.ts`) | §6/§10 |
| P2-PLAN-3 53 chart materials seed | Task 13 row notes `supabase/seed.sql` chart materials addition | Task 13 |
| P2-PLAN-4 checker policy block | Not applicable to plan content (Codex internal) | — |

## PASS criteria for Round 2

Same as Round 1, plus:

9. **Round 1 P1s all resolved**: Each P1-PLAN-1..8 fix claim must be verifiable in the plan file. Spot-check at least 5.
10. **No paper-only fixes**: e.g. P1-PLAN-1 should have actual CHAR_LIMITS values (not just "values listed"). P1-PLAN-2 should cite actual file paths.
11. **Sub-phase internal sequencing**: Verify 7-C/7-D internal task order in §11 matches the dependency reasoning in task table Subagent-eligible column.
12. **No new contradictions**: rev1 made many small fixes — cross-check downstream sections for consistency.

## Output format

```
VERDICT: <PASS | CONCERN | FAIL>

ROUND-1 RESOLUTION TABLE (mandatory):
| Round 1 ID | Status (RESOLVED / PARTIAL / UNRESOLVED) | Evidence (line ref in rev1) | Note |

NEW FINDINGS (P1):
| ID | Section | Issue | Suggested fix |

NEW FINDINGS (P2):
| ID | Section | Issue | Suggested fix |

CONSISTENCY CHECK:
- Task table ↔ §11 sub-phase sequencing: <consistent | inconsistent>
- Task table ↔ §5 test strategy: <consistent | inconsistent>
- Task table ↔ §4 Files Likely To Change: <consistent | inconsistent>

OVERALL RECOMMENDATION:
- <PASS as-is | CONCERN with explicit accepts | revise>
```

Be strict on paper-only fixes. Round 1 issues should be substantively resolved, not just acknowledged.
