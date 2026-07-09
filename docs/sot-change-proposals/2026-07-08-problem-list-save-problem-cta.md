# C-02 문제 목록: 저장 문제 CTA 노출 제안

## 제안 배경

`/library/problems`의 "저장 문제"는 제출하지 않은 임시 답안이 아니라 `library_items.item_type = 'problem'`로 보관한 문제를 뜻한다. 현재 문제 풀이 화면 상단의 "저장"은 `writing_drafts`에 답안을 임시 저장하는 동작이라, 사용자가 "저장 문제"와 혼동할 수 있다.

## 제안 변경

- C-02 문제 목록의 각 문제 행에 "문제 저장" CTA를 노출한다.
- CTA는 기존 `library_items` 저장 모델을 사용하며, 저장 대상은 `item_type = 'problem'`, `problem_id = problems.id`이다.
- 이미 저장된 문제는 "저장됨" 상태로 표시하고 중복 저장을 막는다.
- 쓰기 화면 상단의 답안 저장 버튼은 "임시 저장"으로 표시해 `writing_drafts` 저장임을 명확히 한다.

## 비범위

- DB schema, RLS, migration 변경은 하지 않는다.
- `/library/problems`의 "저장 답안"과 "저장 문제" 분류 의미는 바꾸지 않는다.
- 제출 답안 저장(`item_type = 'submission'`) 흐름은 바꾸지 않는다.

## 수용 기준

- `/practice/problems`에서 문제를 저장하면 `/library/problems`의 저장 문제 목록에 나타난다.
- 쓰기 화면에서 답안을 "임시 저장"해도 문제 저장 목록에는 자동 추가되지 않는다.
- 저장 문제와 저장 답안 필터는 기존처럼 분리되어 동작한다.
