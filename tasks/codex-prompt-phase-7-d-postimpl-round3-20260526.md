# Codex GPT 5.5 — Phase 7-D Post-Impl Cross-Review (Round 3)

Round 2 returned FAIL with 1 P1 (submissionId not propagated to RetryModal). Round 2 fix applied:

## Round 2 fix

- `src/lib/practice/types.ts` — `ProblemRowWithState`에 `latestSubmissionId: string | null` 추가.
- `src/lib/practice/queries.ts` — `fetchUserSolveMap`에 submission `id` + `submitted_at` select 추가 + `latestSubmissionByProblem: Map<problem_id, submission_id>` 빌드. `submitted_at desc` 정렬로 첫 iteration이 최신 submission. `fetchUserProblemList` enriched row에 `latestSubmissionId` 채움.
- `src/components/practice/ProblemListView.tsx` — `<RetryModal submissionId={retryTarget.latestSubmissionId ?? undefined}>` 전달.

## Test results

- `pnpm vitest run` → 400 passed / 3 skipped
- `pnpm typecheck` → 0 errors

## Verify

1. Submitted 문제 클릭 → RetryModal "결과 보기" → `/writing/feedback/{short|long}/[latestSubmissionId]` route?
2. submitted but somehow null submissionId edge case → fallback `/practice/problems` (acceptable)
3. submitted_at desc 정렬이 데이터 100건 넘어가도 안정?
4. RLS: writing_submissions select는 user_id RLS로 안전?

## Output

```
VERDICT: <PASS | CONCERN | FAIL>

ROUND 2 RESOLUTION:
| ID | Status | Note |

NEW FINDINGS:

OVERALL:
```

Round 3 — 본 phase에서 처음 발견한 wiring 결함. fix가 단순. PASS 또는 CONCERN-accept 권장.
