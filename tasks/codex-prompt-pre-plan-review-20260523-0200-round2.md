# Codex GPT 5.5 Pre-Plan Review — Round 2

You previously reviewed this plan in Round 1 (2026-05-23 01:20 KST) and returned VERDICT: FAIL with 4 P1, 3 P2, and 3 MISSED-BY-OPUS findings. Your output was saved at `tasks/codex-output-pre-plan-review-20260523-0100.md`.

The plan author (Claude Code Opus 4.7) has produced **rev1** to address every P1 and P2 you raised. Your job in this round is to verify the fixes are real, not paper-only, and to surface any new issues introduced by rev1.

## Files to read

- **Plan rev1**: `docs/ai-workflow/plans/20260523-0100-implementation-coverage-audit.md`
- **Round 1 ledger entry**: `docs/ai-workflow/runs/2026/05/23/20260523-0100-implementation-coverage-audit-plan.md`
- **Your Round 1 output**: `tasks/codex-output-pre-plan-review-20260523-0100.md`

## What changed in rev1 (author's claim — verify)

| Round 1 finding | rev1 fix claim | Verify by reading |
| --- | --- | --- |
| P1-1 (grade normalization missing) | §5.6 normalization table added (PRESENT→PASS, MISSING→FAIL, WIRED→PASS, MOCKED→PARTIAL, etc.) + §5.7 grade caps (BLOCKED→YELLOW max, MOCKED→Data PARTIAL, OOS→excluded, BREAKS→ORANGE max) | §5.6 + §5.7 — check the table covers all five dimensions and the caps are deterministic |
| P1-2 (seed.sql ↔ R-6 conflict) | §7.1.2 split: `seed.sql` = domain rows only (no auth.users); auth users created via `scripts/audit-setup/seed-dev-users.mjs` using `supabase.auth.admin.createUser` API with service role key (.env.local, gitignored) | §7.1.2 — check no place still says `seed.sql` writes auth.users; check service role key handling is sound |
| P1-3 (dev-login leak risk) | §7.1.3 primary = Playwright storageState (NO app route created). Fallback (if route needed) = NODE_ENV + `notFound()` dual guard. Task 7 = 3-step Finish verification (`git diff`, `rg`, build route manifest) | §7.1.3 + Task 7 — check Primary truly removes the route; check Fallback verification is enforceable |
| P1-4 (fixture false-positive) | R-9 added. §5.6 grade caps: MOCKED→PARTIAL. §5.7 reporting rule: Browser-with-fixture vs Implementation-data-wiring 2-column separation. Remote Supabase schema status reported separately | §5.6 / §5.7 / §12 R-9 — check the 2-column separation is actually mandatory, not advisory |
| P2-1 (SBU still too big) | §4 SBU 3-split: SBU-A = Task 2 only (zero external dep), SBU-B = Task 1+3+4 (Supabase + browser), SBU-C = Task 5+6+7+8. §11 restated | §4 + §11 — check SBU-A really has zero external dependency |
| P2-2 (Playwright Windows-specific) | R-8 rewritten with 5 mitigations: browser install / explicit baseURL / wait-on health / screenshot retry / failure log | §12 R-8 — check the mitigations are concrete and Windows-aware |
| P2-3 (Audience all `both`) | Task 3 split into 3a–3e (5 batches): 3a public+user, 3b user, 3c user, 3d user, 3e admin | §10 Tasks table — check audience boundaries match `docs/sitemap.md` Audience map (line 64-68) |

## PASS criteria for Round 2

The same 8 criteria from Round 1, plus:

9. **No paper-only fixes**: Each P1 fix must be enforceable (not just described). E.g. "Finish verification 3-step" must specify *who runs it* and *what blocks the commit*.

10. **No new contradictions introduced by rev1**: Rev1 changes are large (SBU split, seed strategy rewrite, dev-login removal). Cross-check that downstream sections (Tasks table, Risks, Acceptance Criteria, Verification Strategy) are all consistent with the rev1 changes.

11. **Acceptance Criteria still match the task table**: §13 was not changed in rev1. Verify it still aligns with the new 8-row task table (especially the new sub-task IDs 3a-3e).

12. **Verification Strategy §9 still valid**: §9 was not changed. Verify the gate decisions still hold given SBU split.

## Output format (same as Round 1)

```
VERDICT: <PASS | CONCERN | FAIL>

ROUND-1 RESOLUTION TABLE (mandatory — show each Round 1 finding's status):
| Round 1 ID | Status (RESOLVED / PARTIAL / UNRESOLVED) | Evidence (file:line in rev1) | Note |
| --- | --- | --- | --- |
| P1-1 | ... | ... | ... |
| P1-2 | ... | ... | ... |
| P1-3 | ... | ... | ... |
| P1-4 | ... | ... | ... |
| P2-1 | ... | ... | ... |
| P2-2 | ... | ... | ... |
| P2-3 | ... | ... | ... |

NEW FINDINGS (P1 — must fix):
| ID | Section | Issue | Evidence | Suggested fix |

NEW FINDINGS (P2 — advisory):
| ID | Section | Issue | Evidence | Suggested fix |

CONSISTENCY CHECK (Acceptance Criteria, Verification Strategy, Tasks alignment):
- §13 vs §10: <consistent | inconsistent — describe>
- §9 vs §4 SBU split: <consistent | inconsistent — describe>
- §11 SBU restated vs §4: <consistent | inconsistent — describe>

VERIFICATION (what you actually read in rev1):
- Files opened:
- Spot-checks performed:

OVERALL RECOMMENDATION:
- <one paragraph: PASS as-is | CONCERN with explicit accepts | revise with these P1s>
```

Be strict. The plan author has spent two rounds on this; the next step is execution affecting real Supabase data and real code. A loose PASS here means production-affecting fixes get into the repo.
