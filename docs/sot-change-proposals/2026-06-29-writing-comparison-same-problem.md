# Writing comparison same-problem invariant

## 요청 배경

사용자 기획 의도는 R-01 비교 리포트가 서로 다른 문제를 비교하는 것이 아니라, 같은 문제를 여러 번 풀었을 때 제출본 간 성장 변화를 비교하는 것이다. 기존 SOT는 "현재 제출과 이전 제출 비교"만 명시해 `problem_id` 동일성 조건이 빠져 있었다.

## 제안 결정

- 비교 리포트의 비교 단위는 `writing_submissions.problem_id`다.
- `current_submission_id`와 `previous_submission_id`가 모두 존재하면 두 제출은 반드시 같은 `problem_id`를 가져야 한다.
- `previous_submission_id`가 없으면 단일 제출 리포트로 생성할 수 있다.
- 같은 `problem_id`의 문제는 여러 번 풀 수 있어야 한다. 중복 방지는 `(user_id, problem_id)`가 아니라 draft/submit 재시도 단위에서만 적용한다.
- 피드백 화면에서 비교 리포트로 진입할 때 기본 비교 대상은 같은 `problem_id`의 직전 완료 제출이다.
- 사용자가 비교 대상을 바꾸는 UX가 추가될 때 후보 목록은 같은 `problem_id`의 본인 제출만 보여준다.

## 구현 브리프

- `createComparisonReportAction`은 명시 선택, parent 선택, 자동 fallback 모두에서 동일 `problem_id`만 허용한다.
- `public.create_comparison_report_with_metrics`는 caller ownership과 함께 동일 `problem_id`를 검증한다.
- `comparison_reports` 직접 insert/update 경로도 trigger guard로 동일 `problem_id`를 강제한다.

## 관련 파일

- `src/lib/writing/server-actions.ts`
- `supabase/migrations/20260629153000_enforce_same_problem_comparison.sql`
- `tests/lib/writing/server-actions.test.ts`
- `tests/lib/supabase/comparison-report-same-problem.test.ts`

## 수용 기준

- 다른 `problem_id`의 명시 `previous_id`로 비교 리포트를 만들 수 없다.
- `parent_submission_id`가 다른 `problem_id`를 가리키면 비교 대상으로 쓰지 않는다.
- 자동 이전 제출 선택은 같은 `problem_id`의 완료 제출만 선택한다.
- DB RPC와 `comparison_reports` 테이블 guard 모두 다른 `problem_id` 비교 저장을 거부한다.
- 같은 `problem_id`의 여러 제출은 계속 허용된다.
