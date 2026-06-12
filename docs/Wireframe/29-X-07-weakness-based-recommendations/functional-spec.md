# X-07 약점 기반 추천 기능명세

## 화면 목적

첨삭 결과에서 약한 영역을 찾아 맞춤 문제를 추천한다.

## 사용자와 권한

- Audience: user
- 권한 기준: 로그인한 사용자만 접근하며 user-owned table은 auth.uid() 기반 RLS가 기준이다.

## 진입/이탈 흐름

- Route: `/practice/weakness`
- Route type: page
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 진입 경로: X-02 성장 대시보드 또는 R-01 비교 리포트의 약점 인사이트 CTA.
- 이탈 경로: 추천 문제 시작은 C-02 문제 목록/선택 흐름으로 이동한다.
- 화면 내부 동작: 약점 탭, 진단 카드, 추천 카드, 인사이트 확인, 추천 소비 로그 기록을 처리한다.

## 주요 기능

- 취약 영역 요약
- 추천 문제
- 추천 이유
- 상태 업데이트

## 상태/오류

- 첨삭 데이터 없음, 추천 없음

## 데이터 사용

- 아래 표는 현재 문서화된 DB/스토리지/RPC 사용 근거다.

### DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `feedback_dimension_scores` | `dimension`, `score`, `weakness_level`, `summary` | read | 취약 영역 계산에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/practice/next.ts`<br>`src/lib/practice/weakness.ts`<br>`src/lib/writing/queries.ts`<br>`src/lib/writing/server-actions.ts`<br>`src/lib/writing/server.ts` | none |
| `recommendation_items` | `problem_id`, `rank`, `reason`, `weakness_tags`, `status` | read/update | 약점 기반 추천 목록과 상태에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/practice/next.ts`<br>`src/lib/practice/queries.ts`<br>`src/lib/practice/weakness.ts`<br>`supabase/migrations/20260520120600_recommendations.sql` | none |
| `problems` | `id`, `domain`, `question_no`, `difficulty`, `tags` | read | 추천 문제 상세 표시와 필터에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/admin/queries.ts`<br>`src/lib/admin/server.ts`<br>`src/lib/library/queries.ts`<br>`src/lib/library/server.ts`<br>`src/lib/practice/next.ts` | none |

## 현재 구현 상태

- feedback_dimension_scores와 recommendation_items가 핵심이다.

## 코드 구현 근거

- `PracticeWeaknessPage` - `src/app/(workspace)/practice/weakness/page.tsx`
- `WeaknessView`, `handleRecommendationClick` - `src/components/practice/WeaknessView.tsx`
- `DimensionTabs` - `src/components/practice/DimensionTabs.tsx`
- `DiagnosticCard` - `src/components/practice/DiagnosticCard.tsx`
- `getDimensionTabSummaries`, `getWeakDimensions`, `getWeaknessRecommendations` - `src/lib/practice/weakness.ts`
- `consumeRecommendationItem`, `logStudyEvent` - `src/lib/practice/consume.ts`, `src/lib/events/study-events.ts`

## 미구현/불일치

- 현재 확인된 gap은 DB/source inventory 기준으로 문서에 기록된 항목뿐이다.

## 추가 발견 후보

- 코드 구현 근거와 DB/source inventory가 바뀌면 구현 상태 문구를 갱신한다.
- 새 migration이나 Supabase 호출이 추가되면 DB 데이터 사용 명세를 다시 생성한다.

## 수용 기준

- 이 화면의 주요 CTA와 상태가 Wireframe description과 route map에 맞게 설명되어 있다.
- 위 DB 데이터 사용 명세의 모든 객체가 `docs/Wireframe/data-usage-index.md`에도 역색인되어 있다.
- 확정할 수 없는 기능 또는 데이터는 구현된 것처럼 쓰지 않고 gap/candidate로 남긴다.
- user/admin/public 권한 경계가 `docs/sitemap.md` audience와 맞는다.
