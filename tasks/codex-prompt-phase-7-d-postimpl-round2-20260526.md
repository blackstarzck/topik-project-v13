# Codex GPT 5.5 — Phase 7-D Post-Impl Cross-Review (Round 2)

Round 1 returned FAIL with 2 P1 + 2 P2. Round 1 fixes applied:

## Round 1 fixes

| Round 1 ID | Fix |
| --- | --- |
| P1-1 RetryModal 404 routes | RetryModal rewritten: 다시 풀기 → `/writing/[questionNo]?problem=[id]&fresh=1`; 결과 보기 → `/writing/feedback/{short|long}/[submissionId]` (51/52 short, 53/54 long); submissionId/questionNo 부재 시 `/practice/problems` 폴백. `questionNo: number | null` prop 추가. ProblemListView에 retryTarget.question_no 전달. RetryModal.test.tsx 7 케이스 모두 새 라우트로 갱신. |
| P1-2 Task 12 client-side filter | Server-side RPC defer로 ledger 명시 (Risks). `fetchUserProblemList`는 client-side post-filter 유지. follow-up PR로 `listUserProblems` SECURITY DEFINER 신설 — 본 sub-phase 종료 후 작업. |
| P2-1 RecentFeedback question_no = null | dashboard query에 `writing_submissions!inner(question_no)` embedded join 추가. PostgREST array/object 정규화. RecentFeedbackItem.questionNo 채워짐. |
| P2-2 test coverage 부족 | RetryModal.test.tsx 갱신 (7 케이스), 다른 컴포넌트는 e2e 골든 패스(Task 13)에서 통합 검증 명시. |

## Files

- `tasks/codex-output-phase-7-d-postimpl-20260526.md` (Round 1)
- `src/components/practice/RetryModal.tsx` + `tests/components/practice/RetryModal.test.tsx` (P1-1 fix)
- `src/components/practice/ProblemListView.tsx` (questionNo prop 전달)
- `src/app/(workspace)/dashboard/page.tsx` (join query, P2-1)
- `docs/ai-workflow/runs/2026/05/26/20260526-1500-phase-7-d-learning-flow.md` (Risks 갱신)

## Test results

- `pnpm vitest run` → 400 passed / 3 skipped / 0 failed
- `pnpm typecheck` → 0 errors
- `node scripts/ai-workflow-check.mjs --repo .` → PASS

## Verify

1. **RetryModal new routes**: 4 분기 모두 실제 sitemap 라우트와 정합? (writing/[51-54], writing/feedback/short or long/[id], practice/problems)
2. **questionNo prop wiring**: ProblemListView가 retryTarget.question_no 전달 — ProblemRowData.question_no 가 number | null. Type 정합?
3. **P1-2 client-side filter defer 의도**: ledger에 명시된 한계 + follow-up PR. 받아들일 만한 trade-off?
4. **P2-1 join query**: PostgREST embedded join syntax 정확 (`writing_submissions!inner(question_no)`)? RLS 정합 (writing_feedback과 writing_submissions 모두 user-owned, inner join 안전)?

## Output

```
VERDICT: <PASS | CONCERN | FAIL>

ROUND 1 RESOLUTION TABLE:
| ID | Status | Note |

NEW FINDINGS (P1):
NEW FINDINGS (P2):

OVERALL:
```

Short.
