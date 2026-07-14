# F-01 `/library/problems` 문제 액션 메뉴 제안

## 대상 SOT

- `docs/sot-change-proposals/2026-07-01-library-problems-all-view.md`
- `docs/sot-change-proposals/2026-07-04-library-problems-filter-panel.md`
- `docs/Wireframe/18-F-01-my-library/description.md`
- `docs/Wireframe/18-F-01-my-library/functional-spec.md`
- `docs/Wireframe/14-E-01-short-answer-feedback/functional-spec.md`
- `docs/Wireframe/15-E-02-long-form-feedback/functional-spec.md`

## 변경 이유

`/library/problems`는 `submission`, `problem`, `draft` 세 종류를 같은 목록에 보여준다. 사용자는 모든 문제
아이템이 같은 행/카드 디자인으로 보이고, 각 아이템에서 실행할 수 있는 작업은 더보기 메뉴 한 곳에 모이기를
원한다. 저장 답안은 PDF, 다음 문제, 비교 리포트, 다시 풀기를 제공하고, 저장 문제와 임시 저장은 각각 가능한
단일 작업을 더보기 메뉴 안에 둔다.

## 제안 범위

- `/library/problems`의 item kind는 `submission`, `problem`, `draft` 세 종류로 해석한다.
- 세 kind 모두 동일한 행/카드 chrome을 사용하고, 사용자 작업은 icon-only 더보기 액션 메뉴에 모은다.
- 저장 답안(`submission`) 중 피드백 페이지로 이동 가능한 row/card에는 더보기 액션 메뉴를 제공한다.
- 저장 답안 메뉴 항목은 `PDF 내보내기`, `다음 문제 풀기`, `비교 리포트`, `다시 풀기` 순서로 제공한다.
- `pending`/`analyzing`처럼 피드백 페이지로 이동할 수 없는 저장 답안 row에는 메뉴를 숨긴다.
- 저장 문제(`problem`) row/card는 직접 `다시 풀기` 버튼을 노출하지 않고, 더보기 메뉴 안에 `다시 풀기`를 둔다.
- 저장 문제(`problem`) row/card는 제목에 문제 타이틀을 그대로 사용하고, `북마크`를 짧은 상태 태그로 표시한다. 문제 본문/타이틀을 보조 본문으로 반복하지 않는다.
- 저장 문제(`problem`) row/card의 보조 본문은 사용자의 답안이 있을 때만 최신 활성 draft 답안 또는 최신 submission 답안을 표시한다. 북마크만 있고 답안이 없으면 보조 본문은 비운다.
- 임시 저장(`draft`) row/card는 직접 `이어쓰기` 버튼을 노출하지 않고, 더보기 메뉴 안에 `이어쓰기`를 둔다.
- 기존 `LibrarySavedProblemsTab`의 직접 `다시 풀기` 버튼은 이번 `/library/problems` 통합 UI 범위에 포함하지 않는다.
- `soft_unavailable`/`hard_unavailable`의 제목, 사유, opacity, metadata 비노출 정책은 유지한다.
- 새 DB 테이블은 추가하지 않는다. 단, Supabase RPC `list_user_library_problem_items()`는 사용자가 볼 수 있는 저장 문제에 한해 `answer_text` 미리보기를 반환하도록 재정의한다. 숨김/비공개 문제는 기존처럼 제목, 번호, 답안 미리보기를 노출하지 않는다.

## 액션 계약

| 항목 | 동작 |
| --- | --- |
| PDF 내보내기 | `exportPdfWithPrintFallback({ sourceType: "submission", sourceId })`를 호출한다. |
| 다음 문제 풀기 | 목록 row별 next lookup을 만들지 않고 `/practice/next`로 이동한다. |
| 비교 리포트 | `useCreateComparisonReport({ current_id })` 성공 후 `/writing/reports/{reportId}/compare`로 이동한다. |
| 저장 답안 다시 풀기 | `writingProblemHref({ questionNo, problemId, fresh: true, retrySubmissionId })`로 이동한다. |
| 저장 문제 다시 풀기 | `writingProblemHref({ questionNo, problemId })`로 이동한다. `canRetry = false` 또는 `question_no = null`이면 메뉴 항목은 disabled 처리한다. |
| 임시 저장 이어쓰기 | `writingProblemHref({ questionNo, problemId })`로 이동한다. `question_no = null`이면 메뉴 항목은 disabled 처리한다. |

## 수용 기준

- `/library/problems` list/card의 `submission`, `problem`, `draft` item은 같은 행/카드 chrome을 사용한다.
- 완료된 저장 답안 row/card에는 icon-only 더보기 버튼이 보이고, 메뉴는 저장 답안용 4개 항목을 순서대로 표시한다.
- 저장 문제 row/card에는 icon-only 더보기 버튼이 보이고, 메뉴는 `다시 풀기` 항목을 표시한다.
- 저장 문제 row/card 제목은 문제 타이틀이며 `북마크` 태그가 함께 표시된다.
- 저장 문제 row/card는 답안이 있을 때만 답안 미리보기를 제목 아래에 표시하고, 답안이 없으면 제목 아래를 비운다.
- 임시 저장 row/card에는 icon-only 더보기 버튼이 보이고, 메뉴는 `이어쓰기` 항목을 표시한다.
- 더보기 버튼은 AntD `Dropdown` click trigger를 사용한다.
- PDF/다음 문제/비교 리포트/저장 답안 다시 풀기/저장 문제 다시 풀기/임시 저장 이어쓰기가 각각 위 액션 계약을 따른다.
- 분석 대기/분석 중 저장 답안 row에는 더보기 버튼이 보이지 않는다.
- ko/en/vi 3개 로케일에 `library.problemsList.actionMenu.*` 문구가 존재한다.
- unavailable 저장 문제의 badge/reason/opacity/metadata 비노출 정책은 유지된다.

## Active SOT 충돌

- `2026-07-01-library-problems-all-view.md`는 저장 문제 row의 다시 풀기 액션 유지를 수용 기준으로 둔다.
- 이 제안은 저장 문제의 다시 풀기 액션 자체는 유지하되, `/library/problems`에서는 직접 버튼이 아니라 더보기 메뉴 안으로 이동한다.
- 기존 `LibrarySavedProblemsTab`은 아직 active F-01 탭형 자료 관리 UI의 잔존 구현이므로, 별도 SOT 확정 전까지 이번 변경의 직접 대상에서 제외한다.
- active SOT와 선행 제안 문서는 직접 수정하지 않고 이 변경 제안을 승인 후보로 남긴다.
