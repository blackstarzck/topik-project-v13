# F-01 `/library/problems` 문제 액션 메뉴 제안

## 대상 SOT

- `docs/sot-change-proposals/2026-07-01-library-problems-all-view.md`
- `docs/sot-change-proposals/2026-07-04-library-problems-filter-panel.md`
- `docs/Wireframe/18-F-01-my-library/description.md`
- `docs/Wireframe/18-F-01-my-library/functional-spec.md`
- `docs/Wireframe/14-E-01-short-answer-feedback/functional-spec.md`
- `docs/Wireframe/15-E-02-long-form-feedback/functional-spec.md`

## 변경 이유

`/library/problems`는 저장 답안과 저장 문제를 같은 목록에 보여주지만, 현재 저장 문제 row에는 직접 `다시 풀기`
버튼이 있고 저장 답안 row에는 피드백 이후 작업을 바로 실행하는 메뉴가 없다. 사용자는 저장 답안에서 PDF,
다음 문제, 비교 리포트, 다시 풀기를 한 곳에서 실행해야 하고, 저장 문제 북마크는 `submission_id`가 없어 PDF
또는 비교 리포트의 기준 답안이 될 수 없다.

## 제안 범위

- 저장 답안(`submission`) 중 피드백 페이지로 이동 가능한 row에 더보기 액션 메뉴를 제공한다.
- 메뉴 항목은 `PDF 내보내기`, `다음 문제 풀기`, `비교 리포트`, `다시 풀기` 순서로 제공한다.
- `pending`/`analyzing`처럼 피드백 페이지로 이동할 수 없는 저장 답안 row에는 메뉴를 숨긴다.
- 저장 문제(`problem`) 북마크 row/card는 읽기 전용으로 유지한다.
- 저장 문제의 기존 직접 `다시 풀기` 버튼은 `/library/problems`와 `LibrarySavedProblemsTab` 양쪽에서 제거한다.
- `soft_unavailable`/`hard_unavailable`의 제목, 사유, opacity, metadata 비노출 정책은 유지한다.
- 새 DB 테이블, migration, Supabase RPC는 추가하지 않는다.

## 액션 계약

| 항목 | 동작 |
| --- | --- |
| PDF 내보내기 | `exportPdfWithPrintFallback({ sourceType: "submission", sourceId })`를 호출한다. |
| 다음 문제 풀기 | 목록 row별 next lookup을 만들지 않고 `/practice/next`로 이동한다. |
| 비교 리포트 | `useCreateComparisonReport({ current_id })` 성공 후 `/writing/reports/{reportId}/compare`로 이동한다. |
| 다시 풀기 | `writingProblemHref({ questionNo, problemId, fresh: true, retrySubmissionId })`로 이동한다. |

## 수용 기준

- `/library/problems` list/card의 저장 답안 완료 row에는 icon-only 더보기 버튼이 보인다.
- 더보기 버튼은 AntD `Dropdown` click trigger를 사용하고, 메뉴는 위 4개 항목을 순서대로 표시한다.
- PDF/다음 문제/비교 리포트/다시 풀기 동작이 각각 위 액션 계약을 따른다.
- 분석 대기/분석 중 저장 답안 row에는 더보기 버튼이 보이지 않는다.
- 저장 문제 row/card에는 더보기 메뉴, PDF, 비교 리포트, 다시 풀기 액션이 보이지 않는다.
- `LibrarySavedProblemsTab`에서도 저장 문제 retry link 또는 disabled retry button이 재등장하지 않는다.
- ko/en/vi 3개 로케일에 `library.problemsList.actionMenu.*` 문구가 존재한다.
- unavailable 저장 문제의 badge/reason/opacity/metadata 비노출 정책은 유지된다.

## Active SOT 충돌

- `2026-07-01-library-problems-all-view.md`는 저장 문제 row의 다시 풀기 액션 유지를 수용 기준으로 둔다.
- 이 제안은 저장 문제 북마크를 읽기 전용으로 재정의하고, 다시 풀기 액션을 저장 답안 메뉴로 이동한다.
- active SOT와 선행 제안 문서는 직접 수정하지 않고 이 변경 제안을 승인 후보로 남긴다.
