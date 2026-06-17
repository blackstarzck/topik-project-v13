# B-01 홈 대시보드 기능명세

## 화면 목적

현재 학습 상태와 다음 행동을 한 화면에서 보여준다.

## 사용자와 권한

- Audience: user
- 권한 기준: 로그인한 사용자만 접근하며 user-owned table은 auth.uid() 기반 RLS가 기준이다.

## 진입/이탈 흐름

- Route: `/dashboard`
- Route type: page
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 진입 경로: A-02 로그인 성공, A-03 온보딩 완료, `/auth/callback` 성공, X-03 학습 복귀.
- 이탈 경로: 추천 학습은 C-01, 최근 첨삭은 F-01, 목표/성장 카드는 X-02, 알림은 X-09, 설정은 G-01, 프로필은 X-05, 멤버십/구독 관리는 X-04로 이동한다.
- 화면 내부 동작: KPI, 추천 문제, 최근 피드백, 알림 카드, 멤버십 상태를 확인한다.

## 주요 기능

- KPI 요약
- 이어쓰기
- 추천 문제
- 최근 피드백
- 시험/알림 보조 영역

## 상태/오류

- 신규 사용자 빈 상태, 추천 없음, KPI 로드 실패

## 데이터 사용

- 아래 표는 현재 문서화된 DB/스토리지/RPC 사용 근거다.

### DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `rpc:public.get_dashboard_kpi` | - | rpc | 대시보드 KPI 요약을 만든다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/learning/kpi.ts`<br>`supabase/migrations/20260521140000_phase_6_rpc_and_admin.sql` | none |
| `profiles` | `id`, `display_name`, `plan_label`, `status` | read | 대시보드 사용자 표시와 권한 상태에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/app/(workspace)/profile/page.tsx`<br>`src/lib/auth/profile.ts`<br>`src/lib/settings/mutations.ts` | none |
| `learning_goals` | `topik_level`, `target_grade`, `exam_date`, `weekly_goal_minutes` | read | 목표 달성률과 다음 행동 안내에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/learning/mutations.ts`<br>`src/lib/learning/queries.ts`<br>`src/lib/learning/server.ts`<br>`supabase/migrations/20260520120100_profiles_goals.sql` | none |
| `writing_feedback` | `submission_id`, `score_total`, `generated_at` | read | 최근 첨삭과 점수 요약에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/app/(workspace)/dashboard/page.tsx`<br>`src/lib/practice/next.ts`<br>`src/lib/writing/queries.ts`<br>`src/lib/writing/server-actions.ts`<br>`src/lib/writing/server.ts` | none |
| `writing_drafts` | `problem_id`, `autosave_status`, `updated_at` | read | 이어 쓸 문제와 자동저장 상태에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/app/(workspace)/dashboard/page.tsx`<br>`src/lib/practice/queries.ts`<br>`src/lib/writing/mutations.ts`<br>`src/lib/writing/queries.ts`<br>`src/lib/writing/server.ts` | none |
| `study_events` | `event_type`, `occurred_at`, `payload` | derived-read | 학습 연속성, 오늘 활동, 이벤트 기반 KPI에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/events/study-events.ts`<br>`src/lib/export/pdf-export.ts`<br>`supabase/migrations/20260520120700_library_events_exports.sql` | Derived usage inferred from current source/domain docs. |
| `recommendation_runs` | `source_type`, `reason_summary` | read | 추천 묶음의 출처와 설명에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `supabase/migrations/20260520120600_recommendations.sql` | none |
| `recommendation_items` | `problem_id`, `rank`, `reason`, `status` | read/update | 추천 카드와 클릭/완료 상태에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/practice/next.ts`<br>`src/lib/practice/queries.ts`<br>`src/lib/practice/weakness.ts`<br>`supabase/migrations/20260520120600_recommendations.sql` | none |
| `user_notifications` | `id`, `template_key`, `category`, `title`, `body`, `link_url`, `read_at`, `created_at` | read/update | 일정/알림 보조 영역(№4)의 최신 5건 알림 피드. 클릭 시 `read_at` 기록 후 `link_url` 이동. | authenticated user; auth.uid() owner select + `read_at`만 owner update | `src/components/dashboard/DashboardAlertsCard.tsx`<br>`src/components/notifications/notifications-data.ts`<br>`supabase/migrations/20260612160000_user_notifications.sql` | none |

## 현재 구현 상태

- dashboard page에서 실제 Supabase 읽기가 있으며 일부 추천 영역은 source module 기반으로 보강되어야 한다.
- 일정/알림 보조 영역(№4) — **2026-06-12 구현**: `user_notifications` 최신 5건 피드(category 구분 태그, 클릭=읽음+이동, 로드 실패 시 재시도+알림 설정 CTA) — `DashboardAlertsCard`.

## 코드 구현 근거

- `DashboardPage` - `src/app/(workspace)/dashboard/page.tsx`
- `DashboardHeader` - `src/components/dashboard/DashboardHeader.tsx`
- `DashboardBody` - `src/components/dashboard/DashboardBody.tsx`
- `DashboardAlertsCard` - `src/components/dashboard/DashboardAlertsCard.tsx`
- `DashboardRecommendations` - `src/components/dashboard/DashboardRecommendations.tsx`
- `RecentFeedbackCard` - `src/components/learning/RecentFeedbackCard.tsx`
- `getDashboardKpi` - `src/lib/learning/kpi.ts`
- `getNextProblemBundle` - `src/lib/practice/next.ts`

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
