# Codex GPT 5.5 — Phase 7-C Post-Implementation Cross-Review

Phase 7-C (Tasks 2/3/4/9) just shipped. TOPIK 51~54 글쓰기 시험 환경 재현.

## Files

- **Plan rev3 Tasks 2/3/4/9**: `docs/ai-workflow/plans/20260524-phase-7-coverage-gap-fill.md`
- **Ledger**: `docs/ai-workflow/runs/2026/05/26/20260526-1100-phase-7-c-writing-exam-env.md`
- **Consensus (P0-2/3/4 + P1-5)**: `docs/ai-workflow/proposals/20260523-coverage-audit-fix-proposals.md`

## What was done

### Task 2 (P0-2) char limit
- `src/lib/writing/constants.ts` — CHAR_LIMITS 16값 (51 hard 10-120, 52 10-160, 53 hard 120-300 + recommended 200-300, 54 hard 300-700 + recommended 600-700) + isCountSubmittable + isCountInRecommendedRange + getCharLimit
- `src/components/writing/WritingEditor.tsx` — limit.hardMax maxLength + inRecommended 시각 표시 + submittable submit 조건
- Tests: `tests/lib/writing/constants.test.ts` 10/10

### Task 3 (P0-3) 53번 LongFormEditor
- `src/components/writing/LongFormEditor.tsx` — 53번 (Tabs 도입/전개/마무리 + ManuscriptPreview) / 54번 (textarea + EssayChecklist) 분기
- `src/components/writing/SectionEditor.tsx` — 단일 textarea wrapper with label + aria-label
- `src/components/writing/ManuscriptPreview.tsx` — 20-char grid, monospace, 최소 5 줄
- `src/components/writing/WritingPageContent.tsx` — isLongForm(questionNo) ? LongFormEditor : WritingEditor 분기. problem.materials/prompt 전달
- `src/lib/writing/server.ts` — getWritingProblem이 prompt + materials select. WritingProblem 타입 확장. WritingProblemMaterials union: chart / text / null
- `src/lib/writing/types.ts` — LongFormQuestion53Json + LongFormQuestion54Json + LongFormDraftJson union + isLongFormDraftJson guard + combine53Sections helper + emptyChecklist + ESSAY_CHECKLIST_KEYS + ChecklistItemStatus + EssayChecklistKey
- answer_json 스키마: 53={_v:"53.v1", sections:{intro,body,conclusion}}, 54={_v:"54.v1", text, checklist}
- Tests: **컴포넌트 단위 테스트는 7-E e2e 통합 흡수로 위임** (LongFormEditor/SectionEditor/ManuscriptPreview/server.test.ts/integration test 미작성)

### Task 4 (P0-4) EssayChecklist 3-state
- `src/components/writing/EssayChecklist.tsx` — 6 IA 항목 (intro/body/conclusion/evidence/connectors/topic_fit) wrapper
- `src/components/writing/ChecklistRow.tsx` — Segmented 3-state (unchecked/warning/complete) per row
- LongFormEditor 54번 분기에 grid layout으로 통합 (`gridTemplateColumns: "1fr 320px"`)
- Tests: ChecklistRow (2) + EssayChecklist (2)

### Task 9 (P1-5) AutosaveWarningModal
- `src/components/writing/AutosaveWarningModal.tsx` — 3 trigger (save_failure / disable_attempt / exit_with_dirty) × 3 action (onKeep / onRetry / onProceed). Trigger별 title/body 분기. disable_attempt에서는 retry 비활성
- `src/components/writing/WritingEditor.tsx` — onError 시 setWarningTrigger("save_failure"). onRetry → scheduleSave 재호출
- Tests: AutosaveWarningModal (6 케이스)

## Test results

- `pnpm vitest run tests/components/writing/ tests/lib/writing/` → 9 files / 39 tests PASS
- `pnpm vitest run` (full) → 388 passed / 3 skipped / 0 failed
- `pnpm typecheck` → 0 errors
- `pnpm lint` → 0 errors
- `node scripts/ai-workflow-check.mjs --repo .` → PASS

## What you must verify

1. **Consensus match**:
   - CHAR_LIMITS 16 values match the agreed Plan rev3 Task 2 values exactly?
   - 53 sections 3-tab + ManuscriptPreview + chart materials wired per consensus?
   - 54 checklist is 6 items × 3-state segmented (NOT boolean) per Codex Round 1 P0-4 fix?
   - AutosaveWarningModal has 3 trigger × 3 action per Codex Round 1 P1-5 fix?

2. **answer_json persistence schema**:
   - `_v` versioning present?
   - `combine53Sections` correctly produces single answer_text for submit RPC?
   - `isLongFormDraftJson` guards malformed JSON?
   - `emptyChecklist` produces all 6 keys with "unchecked"?
   - Are these structures backward-compatible with existing writing_drafts (answer_json was nullable)?

3. **WritingEditor / LongFormEditor separation**:
   - 51/52 still routed to WritingEditor, 53/54 to LongFormEditor (via WritingPageContent isLongForm branch)?
   - Both editors use the same CHAR_LIMITS + isCountSubmittable contract?
   - Both wire to the same useUpsertDraft / useSubmitWriting mutations (no divergence)?
   - LongFormEditor's `feedback/long/:id` redirect after submit — correct for both 53 and 54?

4. **D-M3 trigger wiring**:
   - save_failure: yes, autosave onError triggers modal — verified
   - disable_attempt: WritingEditor has no autosave toggle UI in this sub-phase. Modal trigger code path exists but no caller. **Is this acceptable as "modal ready, trigger added when toggle UI ships"? Or should it be wired now?**
   - exit_with_dirty: WritingEditor has no router-event / beforeunload handler in this sub-phase. **Is this acceptable as "Phase 7-D wiring" or should it be in 7-C?** Plan rev3 R-7 noted race condition risk.

5. **Deferred work explicit**:
   - LongFormEditor/SectionEditor/ManuscriptPreview unit tests deferred to 7-E e2e. OK?
   - `tests/integration/long-form-draft-persistence.test.ts` deferred. OK?
   - server.test.ts materials select unit test deferred. OK?

6. **Architecture**:
   - audience: user maintained (no admin code touched)?
   - All new files under `src/components/writing/` or `src/lib/writing/`?

## Output format

```
VERDICT: <PASS | CONCERN | FAIL>

CONSENSUS MATCH:
| Task | Item | Match? |
| --- | --- | --- |
| 2 | CHAR_LIMITS 16 values | YES/NO + cite |
| 3 | 53 3-tab + ManuscriptPreview + materials | YES/NO |
| 4 | 6 items × 3-state segmented | YES/NO |
| 9 | 3 trigger × 3 action | YES/NO |

PERSISTENCE SCHEMA:
- _v versioning: <verified>
- combine53Sections submit text: <verified>
- isLongFormDraftJson guard: <verified>
- backward compat with nullable answer_json: <verified>

D-M3 WIRING COMPLETENESS:
- save_failure: wired
- disable_attempt: <wired/not-wired/acceptable defer + reason>
- exit_with_dirty: <wired/not-wired/acceptable defer + reason>

DEFERRED WORK ACCEPTABILITY:
- LongFormEditor/etc unit tests defer to 7-E: <acceptable | concern + reason>
- integration test defer: <acceptable | concern>
- server.test.ts defer: <acceptable | concern>

FINDINGS (P1):
| ID | Section | Issue | Suggested fix |

FINDINGS (P2):
| ID | Section | Issue | Suggested fix |

OVERALL:
- <PASS — sub-phase 7-C complete | CONCERN with accept | revise>
```

Be tight. 7-C is large but follows 7-A/B patterns. Focus on consensus match + persistence schema + D-M3 wiring completeness.
