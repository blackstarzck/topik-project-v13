# Codex GPT 5.5 — Phase 7-C Post-Impl Cross-Review (Round 2)

Round 1 returned CONCERN with 4 P1 + 1 P2. All 4 P1 have been fixed; P2-1 is explicitly recorded as a defer to Phase 7-D in the ledger.

## Files

- **Round 1 output**: `tasks/codex-output-phase-7-c-postimpl-20260526.md`
- **Ledger (updated)**: `docs/ai-workflow/runs/2026/05/26/20260526-1100-phase-7-c-writing-exam-env.md`

## Round 1 fixes applied (verify)

| Round 1 ID | Fix claim | Verify in |
| --- | --- | --- |
| P1-1 stale closure in scheduleSave | `scheduleSave(nextJson, nextText)` signature changed. All callers (onSection53Change / onText54Change / onChecklist54Change) build `nextState` + `nextJson` synchronously and pass them in, so the closure no longer captures stale React state. | `src/components/writing/LongFormEditor.tsx` scheduleSave + the 3 callers |
| P1-2 isLongFormDraftJson too weak | Strict shape guard: validates sections (3 keys, all strings) for 53.v1; validates text + 6 checklist keys with status in ALLOWED_STATUS for 54.v1. | `src/lib/writing/types.ts` isLongFormDraftJson + new tests `tests/lib/writing/long-form-types.test.ts` (10 cases) |
| P1-3 onConfirmSubmit missing answer_json | onConfirmSubmit now passes `answer_json: JSON.parse(JSON.stringify(buildAnswerJson()))`. submitWritingAction (SubmitWritingInput) accepts `answer_json?: Record<string, unknown> | null`. | `LongFormEditor.tsx` onConfirmSubmit + `src/lib/writing/server-actions.ts:12-17` |
| P1-4 53 materials seed missing | `supabase/seed.sql` 53번 row now includes a `materials` jsonb with `{chart:{type:'bar', data:[...]}}`. Other writing rows pass `null` explicitly. | `supabase/seed.sql` |
| P2-1 D-M3 wiring partial | Acknowledged in ledger Cross-model review section: disable_attempt + exit_with_dirty trigger callers (autosave toggle UI / router exit handler) are explicit Phase 7-D scope. Modal component is ready. | ledger |

## Test results

- `pnpm vitest run` → 402 (399 passed + 3 skipped)
- `pnpm typecheck` → 0 errors
- `node scripts/ai-workflow-check.mjs --repo .` → PASS
- New tests: `tests/lib/writing/long-form-types.test.ts` 10/10 (covers strict guard + combine53Sections edge cases + emptyChecklist invariants)

## Your task — verify

1. **All 4 P1 substantively resolved** (not paper-only). Spot-check each fix in the actual code.

2. **No regressions introduced by the fixes** — especially P1-1 (scheduleSave signature change) could break edge cases. Look at the 3 caller sites + initial render path.

3. **answer_json round-trip semantics**: onConfirmSubmit now sends answer_json. Confirm submitWritingAction → submit_writing_v1 RPC → writing_submissions.answer_json receives it correctly (or note any gap).

4. **D-M3 P2-1 defer acceptable**: Phase 7-D scope vs leaving 7-C "complete" — is the ledger language clear enough that an executor of 7-D will know to add the disable/exit trigger callers?

5. **Schema-vs-impl** (still missing tests): server.test.ts materials select + LongFormEditor unit test + integration round-trip. These were not added in this revision. Should at least one of them block PASS, or all defer to 7-E?

## Output

```
VERDICT: <PASS | CONCERN | FAIL>

ROUND 1 RESOLUTION TABLE:
| ID | Status (RESOLVED / PARTIAL / UNRESOLVED) | Evidence | Note |

NEW FINDINGS (P1):
NEW FINDINGS (P2):

OVERALL:
```

Short. Focus on whether the 4 P1 fixes are real and complete.
