# 기관 배정 문제 노출 정책 변경 제안

작성일: 2026-06-29

정정일: 2026-06-29

## 제안 요약

TOPIK 쓰기 문제 노출 정책은 사용자 기관 코드 유무로 나눈다.

- 비기관 사용자: `profiles.affiliation_code`가 비어 있으면 기본 TOPIK 쓰기 문제 풀 전체를 볼 수 있다. 문제나 문항이 특정 기관에 매핑되어 있어도 비기관 사용자에게는 숨기지 않는다.
- 기관 사용자: `profiles.affiliation_code`가 있으면 `topik_writing_question_institution_exposure`에 자기 기관 코드로 배정된 문항만 볼 수 있다. 배정된 문항이 없으면 문제 목록, 추천, 다음 문제, 약점 추천, 사이드바 51~54, 직접 쓰기 URL, 제출 경로가 unavailable 또는 locked 상태가 된다.

## 기존 SOT와 충돌하는 지점

- `docs/handoff-institution-member-phase2.md`는 "콘텐츠 접근 권한은 건드리지 않는다"와 "현재 전부 열려 있음"을 전제로 한다.
- `supabase/migrations/20260626110000_writing_institution_visibility_predicate.sql`은 "노출 매핑 없음 = 공개 문제"이며 기관 사용자도 공개 문제와 자기 기관 문제를 함께 볼 수 있다고 정의한다.
- `supabase/migrations/20260629110000_institution_assigned_only_writing_access.sql`은 비기관 사용자를 매핑 없는 공개 문제로 제한해, 사용자 확정 정책과 반대로 동작한다.

이 제안은 사용자 확정 정책에 따라 비기관 사용자의 전체 노출을 복구하고, 기관 사용자에게만 배정 문항 제한을 적용한다.

## 새 정책 행렬

| 사용자 상태 | 문제 매핑 상태 | 접근 결과 |
| --- | --- | --- |
| 비기관 사용자 | 매핑 없음 | 접근 가능 |
| 비기관 사용자 | 특정 기관 매핑 있음 | 접근 가능 |
| 기관 사용자 | 자기 `affiliation_code`와 매핑됨 | 접근 가능 |
| 기관 사용자 | 매핑 없음 | 접근 불가 |
| 기관 사용자 | 다른 기관에만 매핑됨 | 접근 불가 |
| 비기관 사용자 | `materials.question_id` 없음 | 접근 가능 |
| 기관 사용자 | `materials.question_id` 없음 | 접근 불가 |
| 비기관 사용자 | exposure table 없음 | 접근 가능 |
| 기관 사용자 | exposure table 없음 | 접근 불가 |

## 구현 방향

- 새 migration에서 `public.is_writing_problem_visible_to_caller()`와 `private.is_writing_problem_visible_to_user()`를 다시 정의한다.
- 기존 `public.filter_visible_writing_problem_ids()`, `public.list_user_problems()`, `private.assert_writing_problem_submittable()`, `private.assert_writing_problem_submittable_for_user()`, `public.create_external_writing_submission()`는 재정의된 predicate를 통해 동일 정책을 따른다.
- 서버 helper/API `GET /api/practice/writing-availability`는 `{ availableTypes, lockedTypes, hasAny }`를 반환하고, 추천 화면과 사이드바는 같은 availability 결과를 사용한다.
- 잠긴 유형은 `/writing/...` 링크를 만들지 않는다.
- 직접 `/writing/...` 접근은 문제 에디터를 렌더링하지 않고 기존 writing empty/unavailable 상태를 보여준다.

## 검증 기준

- 비기관 계정은 기관 매핑이 있는 문제까지 포함해 쓰기 문제 목록에서 볼 수 있다.
- 기관 계정은 자기 기관 코드에 매핑된 문항만 볼 수 있다.
- 배정 0개 기관 계정은 `/practice/problems`에서 해당 쓰기 문제가 보이지 않는다.
- 배정 0개 기관 계정은 `/practice/recommendations`의 51~54 유형 카드가 locked 상태이고 `/writing/...` 링크가 없다.
- 배정 0개 기관 계정은 사이드바 51~54가 locked 또는 unavailable 상태다.
- 배정 0개 기관 계정이 직접 `/writing/short-answer-writing-51`에 접근하면 문제 에디터가 보이지 않는다.
- 제출 RPC는 기관 미배정 사용자의 미배정 문제 제출을 `problem_not_submittable`로 차단한다.
