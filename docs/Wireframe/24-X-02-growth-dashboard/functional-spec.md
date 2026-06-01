# X-02 성장 대시보드 기능명세

## 화면 목적

학습자의 성장 추세와 취약 변화를 보여준다.

## 진입/이탈 흐름

- Route: `/growth`
- Route type: page
- Audience: user
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 이탈: 다음 CTA, 상위 목록, 인증 오류, 권한 오류, 또는 빈 상태 CTA로 이동한다.

## 주요 기능

- 추세 그래프
- 점수 변화
- 학습 시간
- 취약 영역

## 상태/오류/권한

- 데이터 부족, 기간 필터 없음
- 권한 기준: 로그인한 사용자만 접근하며 user-owned table은 auth.uid() 기반 RLS가 기준이다.

## 현재 구현 상태

- study_events와 feedback 기반 파생 지표를 명확히 표시한다.
- 실제 구현 여부는 `src/**`, IA 감사 산출물, 이 문서의 DB 근거를 함께 확인한다.

## 미구현/불일치

- 현재 확인된 gap은 DB/source inventory 기준으로 문서에 기록된 항목뿐이다.

## 추가 발견 후보

- IA 감사 결과와 source-map이 바뀌면 구현 상태 문구를 갱신한다.
- 새 migration이나 Supabase 호출이 추가되면 DB 데이터 사용 명세를 다시 생성한다.
- 불확실성이 표시된 데이터는 제품 결정 또는 후속 구현 전까지 후보로만 취급한다.

## DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `rpc:public.get_dashboard_kpi` | - | rpc | 성장 지표 일부를 재사용할 수 있다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/learning/kpi.ts`<br>`supabase/migrations/20260521140000_phase_6_rpc_and_admin.sql` | none |
| `study_events` | `event_type`, `occurred_at`, `payload` | derived-read | 학습 추세와 활동 그래프에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/events/study-events.ts`<br>`src/lib/export/pdf-export.ts`<br>`supabase/migrations/20260520120700_library_events_exports.sql` | Derived usage inferred from current source/domain docs. |
| `writing_feedback` | `score_total`, `generated_at` | derived-read | 점수 추세에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/app/(workspace)/dashboard/page.tsx`<br>`src/lib/practice/next.ts`<br>`src/lib/writing/queries.ts`<br>`src/lib/writing/server-actions.ts`<br>`src/lib/writing/server.ts` | Derived usage inferred from current source/domain docs. |
| `feedback_dimension_scores` | `dimension`, `score`, `weakness_level` | derived-read | 영역별 성장/취약 분석에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/practice/next.ts`<br>`src/lib/practice/weakness.ts`<br>`src/lib/writing/queries.ts`<br>`src/lib/writing/server-actions.ts`<br>`src/lib/writing/server.ts` | Derived usage inferred from current source/domain docs. |
| `problem_attempts` | `is_correct`, `submitted_at`, `time_spent_seconds` | derived-read | 풀이 정확도와 학습 시간 지표에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/practice/next.ts`<br>`supabase/migrations/20260520120300_attempts.sql`<br>`tests/integration/rls-smoke.test.ts` | Derived usage inferred from current source/domain docs. |

## 수용 기준

- 이 화면의 주요 CTA와 상태가 Wireframe description과 route map에 맞게 설명되어 있다.
- 위 DB 데이터 사용 명세의 모든 객체가 `docs/Wireframe/data-usage-index.md`에도 역색인되어 있다.
- 확정할 수 없는 기능 또는 데이터는 구현된 것처럼 쓰지 않고 gap/candidate로 남긴다.
- user/admin/public 권한 경계가 `docs/sitemap.md` audience와 맞는다.

## 검증 근거

- Description: `docs/Wireframe/24-X-02-growth-dashboard/description.md`
- Wireframe: `docs/Wireframe/24-X-02-growth-dashboard/wireframe.png`
- Route map: `docs/sitemap.md`
- Active user flow: `docs/flow/user-flow.md`
- DB inventory: `reports/wireframe-functional-specs/runs/20260601-1542/data-inventory.json`
- Evidence: `src/lib/learning/kpi.ts`
- Evidence: `supabase/migrations/20260521140000_phase_6_rpc_and_admin.sql`
- Evidence: `src/lib/events/study-events.ts`
- Evidence: `src/lib/export/pdf-export.ts`
- Evidence: `supabase/migrations/20260520120700_library_events_exports.sql`
- Evidence: `src/app/(workspace)/dashboard/page.tsx`
- Evidence: `src/lib/practice/next.ts`
- Evidence: `src/lib/writing/queries.ts`
- Evidence: `src/lib/writing/server-actions.ts`
- Evidence: `src/lib/writing/server.ts`
- Evidence: `supabase/migrations/20260520120500_feedback.sql`
- Evidence: `src/lib/practice/weakness.ts`
