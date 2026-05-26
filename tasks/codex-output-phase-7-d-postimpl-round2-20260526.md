VERDICT: FAIL

ROUND 1 RESOLUTION TABLE:
| ID | Status | Note |
| --- | --- | --- |
| P1-1 | FAIL | `RetryModal` 내부 라우트는 맞지만 실제 `ProblemListView`가 `submissionId`를 전달하지 않습니다. 제출 완료 row에서 “결과 보기”는 항상 `/practice/problems` 폴백으로 갑니다. |
| P1-2 | ACCEPTED | 작업 일지에 한계와 follow-up RPC가 명시되어 있어 이번 sub-phase trade-off로는 수용 가능. |
| P2-1 | PASS | `writing_submissions!inner(question_no)`는 FK 기준으로 맞고, 양쪽 RLS도 owner-select라 안전합니다. |
| P2-2 | PASS | `RetryModal` 단위 테스트 7개는 갱신됨. 통합 검증은 Task 13로 넘긴 상태. |

NEW FINDINGS (P1):
- `src/components/practice/ProblemListView.tsx:177-184`: `<RetryModal>`에 `submissionId`를 넘기지 않음.
  - `src/lib/practice/types.ts:62-64`의 `ProblemRowWithState`에도 submission id가 없음.
  - `src/lib/practice/queries.ts:58-73`도 `writing_submissions.id`를 조회하지 않고 `problem_id`만 조회함.
  - 결과: submitted 상태에서도 feedback route로 못 가고 fallback만 실행.

NEW FINDINGS (P2):
- 없음.

OVERALL:
라우트 자체와 `questionNo` 타입 배선은 맞습니다. 하지만 실제 리스트 → 모달 → 결과 보기 흐름이 아직 깨져서 PASS 불가입니다. 해결하려면 submitted 문제의 최신 `writing_submissions.id`를 `ProblemRowWithState`에 실어 `RetryModal submissionId`로 전달해야 합니다.

Docs consulted: `docs/agent-index.md`, `docs/ai-development-workflow.md`, `docs/sitemap.md`, `docs/spec.md`, `docs/development/backend-auth.md`, `docs/ai-workflow/review-gates.md`, `docs/ai-workflow/context-and-packets.md`.