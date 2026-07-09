# F-01 저장 문제 다시 풀기 액션 보완 제안

상태: 후속 보완 제안. 기존 active SOT를 직접 수정하지 않고, `2026-07-09-library-problems-action-menu.md`의 저장 문제 읽기 전용/다시 풀기 제거 수용 기준을 보완한다.

## 배경

`2026-07-01-library-problems-all-view.md`는 `/library/problems` 혼합 리스트에서 저장 문제 row가 제목, 사용 가능/불가 상태, 다시 풀기 액션을 유지한다고 정의한다.

`2026-07-09-library-problems-action-menu.md`는 저장 답안 row의 action menu를 도입하면서 저장 문제 북마크 row/card를 읽기 전용으로 재정의하고, 저장 문제의 기존 다시 풀기 버튼을 제거한다고 적었다. 이 문서는 자체적으로 `2026-07-01-library-problems-all-view.md`와 충돌한다고 기록한다.

## 보완 제안

- 저장 답안(`submission`) row/card는 feedback page로 이동 가능한 경우 action menu를 제공한다.
- 저장 문제(`problem`) row/card와 `LibrarySavedProblemsTab`은 action menu를 제공하지 않는다.
- 저장 문제는 직접 다시 풀기 액션을 유지한다.
- 사용 가능한 저장 문제는 `writingProblemHref({ questionNo, problemId, fresh: true })` 링크를 제공한다.
- 사용할 수 없거나 `question_no`가 없는 저장 문제는 `retryUnavailable` 비활성 버튼을 제공한다.
- hard-unavailable 저장 문제의 제목/메타데이터 비노출, badge/reason/opacity 정책은 유지한다.

## 수용 기준

- `/library/problems` list view의 사용 가능한 저장 문제 row에 `다시 풀기` 링크가 보인다.
- `/library/problems` card view의 사용 가능한 저장 문제 card에 `다시 풀기` 링크가 보인다.
- `LibrarySavedProblemsTab`의 사용 가능한 저장 문제 row에 `다시 풀기` 링크가 보인다.
- soft-unavailable/hard-unavailable 저장 문제에는 `다시 풀 수 없음` 비활성 버튼이 보이고, retry link는 보이지 않는다.
- 저장 답안 action menu의 PDF/다음 문제/비교 리포트/다시 풀기 계약은 그대로 유지한다.

## 대체한 문구

이 제안은 `2026-07-09-library-problems-action-menu.md`의 아래 방향을 대체한다.

- 저장 문제 북마크 row/card를 완전 읽기 전용으로 유지한다는 설명
- 저장 문제의 기존 직접 `다시 풀기` 버튼을 `/library/problems`와 `LibrarySavedProblemsTab` 양쪽에서 제거한다는 설명
- 저장 문제 row/card에 다시 풀기 액션이 보이지 않는다는 수용 기준

