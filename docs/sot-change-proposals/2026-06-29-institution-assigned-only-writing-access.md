# 기관 배정 문제만 쓰기 노출 정책 변경 제안

작성일: 2026-06-29

## 제안 요약

기관 소속 사용자(`profiles.affiliation_code`가 비어 있지 않은 사용자)는 `topik_writing_question_institution_exposure`에 자기 기관 코드로 배정된 TOPIK 쓰기 문제만 볼 수 있도록 변경한다. 기관 사용자에게 배정된 문제가 0개이면 문제 목록, 추천, 다음 문제, 약점 추천, 사이드바 51~54, 직접 쓰기 URL, 제출 경로 모두 unavailable 또는 locked 상태가 된다.

비기관 사용자는 기존 공개 문제 접근을 유지한다. 여기서 공개 문제는 `topik_writing_question_institution_exposure` 매핑이 없는 쓰기 문제다.

## 기존 SOT와 충돌하는 지점

- `docs/handoff-institution-member-phase2.md`는 "콘텐츠 접근 권한은 건드리지 않는다"와 "현재 전부 열려 있음"을 전제로 한다.
- `supabase/migrations/20260626110000_writing_institution_visibility_predicate.sql`은 "노출 매핑 없음 = 공개 문제"이며 기관 사용자도 공개 문제와 자기 기관 문제를 함께 볼 수 있다고 정의한다.
- `tests/integration/institution-writing-exposure.test.ts`는 기관 사용자가 공개 문제와 자기 기관 문제를 모두 보는 기대값을 고정한다.

이 제안은 위 결정을 폐기하고, 기관 사용자에 한해 `배정 문제만` 정책을 새 기준으로 삼는다.

## 새 정책 행렬

| 사용자 상태 | 문제 매핑 상태 | 접근 결과 |
| --- | --- | --- |
| 비기관 사용자 | 매핑 없음 | 접근 가능 |
| 비기관 사용자 | 특정 기관 매핑 있음 | 접근 불가 |
| 기관 사용자 | 자기 `affiliation_code`와 매핑됨 | 접근 가능 |
| 기관 사용자 | 매핑 없음 | 접근 불가 |
| 기관 사용자 | 다른 기관에만 매핑됨 | 접근 불가 |
| 모든 사용자 | `materials.question_id` 없음 | 접근 불가 |
| 기관 사용자 | exposure table 없음 | 접근 불가 |
| 비기관 사용자 | exposure table 없음 | 접근 불가 |

## 구현 방향

- 새 migration에서 `public.is_writing_problem_visible_to_caller()`와 `private.is_writing_problem_visible_to_user()`를 재정의한다.
- 기존 `public.filter_visible_writing_problem_ids()`, `public.list_user_problems()`, `private.assert_writing_problem_submittable()`, `private.assert_writing_problem_submittable_for_user()`, `public.create_external_writing_submission()`는 재정의된 predicate를 통해 동일 정책을 따른다.
- 서버 helper/API `GET /api/practice/writing-availability`는 `{ availableTypes, lockedTypes, hasAny }`를 반환한다.
- 추천 유형 탭, 추천 유형 카드, 사이드바 쓰기 51~54는 같은 availability 결과를 사용한다.
- 잠긴 유형은 `/writing/...` 링크를 만들지 않는다.
- 직접 `/writing/...` 접근은 문제 에디터를 렌더링하지 않고 기존 writing empty/unavailable 상태를 보여준다.

## 검증 기준

- 기관 배정 0개 계정에서 `/practice/problems`에 쓰기 문제가 보이지 않는다.
- `/practice/recommendations`의 51~54 탭/카드는 locked 상태이고 카드에 `/writing/...` 링크가 없다.
- 사이드바 51~54는 locked 또는 unavailable 상태다.
- 직접 `/writing/short-answer-writing-51` 접근 시 풀이 에디터가 보이지 않는다.
- 제출 RPC는 기관 미배정 문제를 `problem_not_submittable`로 차단한다.
