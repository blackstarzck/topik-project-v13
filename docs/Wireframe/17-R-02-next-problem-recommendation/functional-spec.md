# R-02 다음 문제 추천 기능명세

## 화면 목적

피드백 이후 바로 이어 풀 문제를 제안한다.

## 사용자와 권한

- Audience: user
- 권한 기준: 로그인한 사용자만 접근하며 user-owned table은 auth.uid() 기반 RLS가 기준이다.

## 진입/이탈 흐름

- Route: `/practice/next`
- Route type: page
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 진입 경로: E-01/E-02 피드백 화면 또는 R-01 비교 리포트의 다음 문제 CTA.
- 이탈 경로: 추천 시작 또는 카드 선택 시 C-02 문제 목록/선택 흐름으로 이동하고, 유료 잠금은 X-03 페이월로 이어진다.
- 화면 내부 동작: 추천 카드 확인, 대체 문제 탐색, 추천 소비 로그 기록을 처리한다.

## 주요 기능

- 추천 카드
- 추천 이유
- 예상 시간
- 문제 목록/작성 이동

## 상태/오류

- 추천 없음, 문제 비공개

## 데이터 사용

- 아래 표는 현재 문서화된 DB/스토리지/RPC 사용 근거다.

### DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `recommendation_items` | `problem_id`, `rank`, `reason`, `weakness_tags`, `status` | read/update | 다음 문제 추천 카드와 클릭 상태에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/practice/next.ts`<br>`src/lib/practice/queries.ts`<br>`src/lib/practice/weakness.ts`<br>`supabase/migrations/20260520120600_recommendations.sql` | none |
| `problems` | `id`, `question_no`, `difficulty`, `title`, `tags` | read | 추천 대상 문제 정보를 표시한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/library/queries.ts`<br>`src/lib/library/server.ts`<br>`src/lib/practice/next.ts` | none |
| `writing_submissions` | `problem_id`, `submitted_at` | derived-read | 최근 제출 흐름을 추천 근거로 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/library/queries.ts`<br>`src/lib/library/server.ts`<br>`src/lib/practice/next.ts`<br>`src/lib/practice/queries.ts`<br>`src/lib/writing/queries.ts` | Derived usage inferred from current source/domain docs. |
| `writing_feedback` | `score_total`, `generated_at` | derived-read | 최근 첨삭 결과를 추천 근거로 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/app/(workspace)/dashboard/page.tsx`<br>`src/lib/practice/next.ts`<br>`src/lib/writing/queries.ts`<br>`src/lib/writing/server-actions.ts`<br>`src/lib/writing/server.ts` | Derived usage inferred from current source/domain docs. |
| `feedback_dimension_scores` | `dimension`, `weakness_level` | derived-read | 취약 영역 추천 근거에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/practice/next.ts`<br>`src/lib/practice/weakness.ts`<br>`src/lib/writing/queries.ts`<br>`src/lib/writing/server-actions.ts`<br>`src/lib/writing/server.ts` | Derived usage inferred from current source/domain docs. |

## 현재 구현 상태

- 추천 상태 업데이트가 필요하다.

## 코드 구현 근거

- `PracticeNextPage` - `src/app/(workspace)/practice/next/page.tsx`
- `NextProblemView`, `handleStart` - `src/components/practice/NextProblemView.tsx`
- `getNextProblemBundle` - `src/lib/practice/next.ts`
- `consumeRecommendationItem` - `src/lib/practice/consume.ts`
- `logStudyEvent` - `src/lib/events/study-events.ts`

## 미구현/불일치

- 현재 확인된 gap은 DB/source inventory 기준으로 문서에 기록된 항목뿐이다.

## 추가 발견 후보

- 코드 구현 근거와 DB/source inventory가 바뀌면 구현 상태 문구를 갱신한다.
- 새 migration이나 Supabase 호출이 추가되면 DB 데이터 사용 명세를 다시 생성한다.
- 불확실성이 표시된 데이터는 제품 결정 또는 후속 구현 전까지 후보로만 취급한다.

## 수용 기준

- 이 화면의 주요 CTA와 상태가 Wireframe description과 route map에 맞게 설명되어 있다.
- 위 DB 데이터 사용 명세의 모든 객체가 `docs/Wireframe/data-usage-index.md`에도 역색인되어 있다.
- 확정할 수 없는 기능 또는 데이터는 구현된 것처럼 쓰지 않고 gap/candidate로 남긴다.
- user/admin/public 권한 경계가 `docs/ia.md`와 화면 기능명세의 audience와 맞는다.
