# C-01 문제 유형 추천 기능명세

## 화면 목적

학습자 상태에 맞는 문제 유형과 이유를 제안한다.

## 사용자와 권한

- Audience: user
- 권한 기준: 로그인한 사용자만 접근하며 user-owned table은 auth.uid() 기반 RLS가 기준이다.

## 진입/이탈 흐름

- Route: `/practice/recommendations`
- Route type: page
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 진입 경로: B-01 홈 대시보드의 추천 학습 CTA.
- 이탈 경로: 유형 카드 선택 또는 추천 유형 시작 시 C-02 문제 목록으로 이동한다.
- 화면 내부 동작: 문제 유형 필터를 바꾸고 추천 카드와 안내 문구를 확인한다.

## 주요 기능

- 추천 묶음 표시
- 추천 이유
- 유형 선택
- 문제 목록 이동

## 상태/오류

- 추천 없음, 취약 데이터 부족

## 데이터 사용

- 아래 표는 현재 문서화된 DB/스토리지/RPC 사용 근거다.

### DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `recommendation_runs` | `source_type`, `reason_summary`, `created_at` | read | 추천이 어떤 근거로 만들어졌는지 보여준다. | authenticated user; auth.uid() owner RLS where user-owned | `supabase/migrations/20260520120600_recommendations.sql` | none |
| `recommendation_items` | `problem_id`, `rank`, `reason`, `weakness_tags` | read/update | 추천 유형과 선택 상태를 제공한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/practice/next.ts`<br>`src/lib/practice/queries.ts`<br>`src/lib/practice/weakness.ts`<br>`supabase/migrations/20260520120600_recommendations.sql` | none |
| `feedback_dimension_scores` | `dimension`, `score`, `weakness_level` | derived-read | 취약 영역 기반 추천 근거가 된다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/practice/next.ts`<br>`src/lib/practice/weakness.ts`<br>`src/lib/writing/queries.ts`<br>`src/lib/writing/server-actions.ts`<br>`src/lib/writing/server.ts` | Derived usage inferred from current source/domain docs. |
| `problems` | `id`, `domain`, `question_no`, `topik_level`, `difficulty`, `tags` | read | 추천 문제 후보를 조회한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/library/queries.ts`<br>`src/lib/library/server.ts`<br>`src/lib/practice/next.ts` | none |

## 현재 구현 상태

- 추천 데이터는 recommendation_*와 feedback_dimension_scores를 함께 확인해야 한다.

## 코드 구현 근거

- `RecommendationsPage` - `src/app/(workspace)/practice/recommendations/page.tsx`
- `RecommendationsView` - `src/components/practice/RecommendationsView.tsx`
- `useRecommendationBundle`, `fetchRecommendationBundle` - `src/components/practice/recommendations-data.ts`
- `writingProblemHref` - `src/lib/writing/routes.ts`

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
