# Supabase Table Inventory

> 작성 기준: 2026-06-08
>
> 대상: `talkpik-dev`로 관리되는 TALKPIK 사용자 앱 Supabase 스키마
>
> 성격: 현재 저장소 기준 Supabase 테이블, RPC, 스토리지, 코드 사용처 재고표

## 문서 역할

이 문서는 현재 저장소에서 관리하는 Supabase 스키마의 최신 재고표다.
테이블, 컬럼, RPC, 스토리지 버킷, RLS, Supabase 호출 사용처를 확인할 때
이 문서를 우선한다.

`docs/development/database-schema.md`는 첫 개발 단계에서 사용한 초기 스키마
기준 문서다. 현재 스키마와 다르면 `supabase/migrations/`,
`src/lib/supabase/types.ts`, 실제 `src/` 사용처, 그리고 이 문서를 우선한다.

## 갱신 규칙

사용자 작업 요청의 영향으로 아래 중 하나가 바뀌면 같은 작업 안에서 이 문서를
갱신한다.

- 테이블, 컬럼, 제약조건, 인덱스, RLS 정책이 추가/수정/삭제됨
- RPC, 함수, 트리거, 스토리지 버킷이나 스토리지 정책이 추가/수정/삭제됨
- Supabase 타입 스냅샷이나 마이그레이션 SQL이 바뀜
- `src/`에서 Supabase 호출 사용처가 추가/삭제되거나 화면 영향이 달라짐
- 화면별 DB 데이터 사용 명세와 실제 스키마 관계가 달라짐

admin 관련 테이블은 문서화할 수 있지만, 이 저장소에서 새로 개발하거나 확장하면
안 된다. `docs/admin-scope-boundary.md`가 우선한다.

## 확인 범위

이 문서는 현재 저장소의 Supabase 마이그레이션 SQL, Supabase 타입 스냅샷, 그리고 `src/` 코드의 실제 Supabase 호출 위치를 기준으로 정리했다.

실시간 Supabase DB 직접 조회는 완료하지 못했다. Supabase 커넥터에는 로컬 dev 환경과 다른 프로젝트만 보였고, 로컬 `.env.local`이 가리키는 dev 프로젝트는 커넥터 권한이 없어 조회가 거절됐다. 따라서 아래 내용은 라이브 DB 덤프가 아니라 이 저장소가 관리하는 스키마와 코드 사용처 기준이다.

## 중요한 범위 규칙

이 저장소는 사용자-facing 앱이다. `organizations`, `org_members`, `assignments`, `assignment_submissions` 같은 조직/admin 성격 테이블은 기존에 존재하더라도 현재 개발 확장 대상이 아니다.

admin 관련 스키마와 UI는 문서화/정리 대상일 수 있지만, 이 저장소에서 새로 개발하거나 확장하면 안 된다. 자세한 기준은 `docs/admin-scope-boundary.md`를 따른다.

## 테이블 요약

| 영역 | 테이블 | 생성/수정 SQL 근거 | 설명 | 핵심 구조 | 현재 사용처 |
|---|---|---|---|---|---|
| 사용자 | `profiles` | 생성: [20260520120100_profiles_goals.sql](../supabase/migrations/20260520120100_profiles_goals.sql) `create table if not exists public.profiles`<br>확장: [notification_prefs](../supabase/migrations/20260521141000_phase_6_notification_prefs.sql), [bio](../supabase/migrations/20260526170000_phase_7_profile_bio.sql), [learning_locale/content_prefs](../supabase/migrations/20260602120200_notifications_and_settings.sql) | Supabase Auth 사용자와 1:1로 연결되는 프로필 | `id`, 이름, 아바타, 언어, 권한, 플랜, 상태, 알림/콘텐츠 설정 | 로그인 후 프로필, 설정, 언어, 권한, 관리자 가드 |
| 사용자 | `learning_goals` | [20260520120100_profiles_goals.sql](../supabase/migrations/20260520120100_profiles_goals.sql) `create table if not exists public.learning_goals` | 사용자의 TOPIK 학습 목표 | `user_id`, TOPIK 레벨, 목표 급수, 시험일, 약점 영역 | 온보딩, 프로필, 학습 대시보드 |
| 문제 | `problems` | [20260520120200_problems.sql](../supabase/migrations/20260520120200_problems.sql) `create table if not exists public.problems` | 문제 카탈로그 | 문제 영역, TOPIK 레벨, 지문, 자료, 정답/루브릭, 공개 상태 | 문제 목록, 추천, 쓰기 화면, 관리자 문제 관리 |
| 문제 | `problem_assets` | [20260520120200_problems.sql](../supabase/migrations/20260520120200_problems.sql) `create table if not exists public.problem_assets` | 문제에 연결된 이미지/오디오 | `problem_id`, storage path, asset type, 정렬 순서 | 쓰기 문제 자료, 관리자 문제 에셋 |
| 풀이 | `problem_attempts` | [20260520120300_attempts.sql](../supabase/migrations/20260520120300_attempts.sql) `create table if not exists public.problem_attempts` | 읽기/듣기 객관식 풀이 기록 | 정답 선택, 점수, 상태, 북마크, 소요 시간 | 다음 문제 추천, 재시도 |
| 쓰기 | `writing_drafts` | [20260520120400_writing.sql](../supabase/migrations/20260520120400_writing.sql) `create table if not exists public.writing_drafts` | 자동저장되는 쓰기 초안 | 답안 텍스트/json, 글자수, 저장 상태, 저장 시각 | 쓰기 초안 저장/조회, 대시보드 |
| 쓰기 | `writing_submissions` | [20260520120400_writing.sql](../supabase/migrations/20260520120400_writing.sql) `create table if not exists public.writing_submissions` | 최종 제출된 쓰기 답안 | 초안, 문제, 답안, 글자수, 피드백 상태 | 피드백, 서재, 성장, 비교 리포트 |
| 피드백 | `writing_feedback` | [20260520120500_feedback.sql](../supabase/migrations/20260520120500_feedback.sql) `create table if not exists public.writing_feedback` | AI 피드백 총평 | 총점, 요약, 모델, 원본 AI 결과 | 피드백 화면, 대시보드, 성장, 약점 |
| 피드백 | `feedback_dimension_scores` | [20260520120500_feedback.sql](../supabase/migrations/20260520120500_feedback.sql) `create table if not exists public.feedback_dimension_scores` | 항목별 점수 | 문법/어휘/구조/내용 등 차원별 점수 | 약점 추천, 성장 차트, 피드백 상세 |
| 피드백 | `sentence_feedback` | [20260520120500_feedback.sql](../supabase/migrations/20260520120500_feedback.sql) `create table if not exists public.sentence_feedback` | 문장별 첨삭 | 원문, 수정문, 코멘트 | 장문 피드백 상세 |
| 리포트 | `comparison_reports` | [20260520120500_feedback.sql](../supabase/migrations/20260520120500_feedback.sql) `create table if not exists public.comparison_reports` | 이전/현재 답안 비교 리포트 | 현재 제출, 이전 제출, 지표, 서술형 분석 | 비교 리포트, PDF export, 서재 |
| 추천 | `recommendation_runs` | [20260520120600_recommendations.sql](../supabase/migrations/20260520120600_recommendations.sql) `create table if not exists public.recommendation_runs` | 추천 생성 실행 묶음 | 추천 출처, 생성 사유, 생성/만료 시각 | 추천 화면, 추천 생성 로직 |
| 추천 | `recommendation_items` | [20260520120600_recommendations.sql](../supabase/migrations/20260520120600_recommendations.sql) `create table if not exists public.recommendation_items` | 추천된 개별 문제 | 문제, 순위, 추천 이유, 예상 시간, 상태 | 대시보드 추천, 약점/다음 문제 |
| 서재 | `library_items` | [20260520120700_library_events_exports.sql](../supabase/migrations/20260520120700_library_events_exports.sql) `create table if not exists public.library_items` | 사용자가 저장한 문제/제출/리포트/export | 다형 FK, 메모, 태그, 저장 시각 | 내 서재, 저장/삭제 |
| 활동 | `study_events` | [20260520120700_library_events_exports.sql](../supabase/migrations/20260520120700_library_events_exports.sql) `create table if not exists public.study_events` | 학습 이벤트 로그 | 이벤트 타입, 발생 시각, 관련 문제/제출/풀이 | 성장, export, 학습 이벤트 |
| 파일 | `export_files` | [20260520120700_library_events_exports.sql](../supabase/migrations/20260520120700_library_events_exports.sql) `create table if not exists public.export_files` | PDF 등 생성 파일 메타데이터 | source, storage path, 옵션, 상태 | PDF export, 내 서재 |
| 알림 | `notification_settings` | [20260602120200_notifications_and_settings.sql](../supabase/migrations/20260602120200_notifications_and_settings.sql) `create table if not exists public.notification_settings` | 사용자 리마인더 설정 | 시간, 요일, 채널, 타임존 | 알림 설정 화면 |
| 알림 | `notification_log` | [20260602120200_notifications_and_settings.sql](../supabase/migrations/20260602120200_notifications_and_settings.sql) `create table if not exists public.notification_log` | 알림 발송 이력 | 채널, 템플릿, 상태, 발송 시각 | 알림 설정 화면의 최근 이력 |
| 결제 | `subscription_plans` | [20260602120100_billing.sql](../supabase/migrations/20260602120100_billing.sql) `create table if not exists public.subscription_plans` | 플랜 카탈로그 | 플랜키, 주기, 가격, 기능, 추천 여부 | Paywall |
| 결제 | `subscriptions` | [20260602120100_billing.sql](../supabase/migrations/20260602120100_billing.sql) `create table if not exists public.subscriptions` | 사용자 구독 상태 | 사용자, 플랜, 상태, 기간, provider id | 구독 관리 |
| 결제 | `payment_history` | [20260602120100_billing.sql](../supabase/migrations/20260602120100_billing.sql) `create table if not exists public.payment_history` | 결제 이력 | 금액, 통화, 상태, 영수증 URL | 구독 관리 |
| 관리자 | `admin_audit_logs` | [20260520120800_audit.sql](../supabase/migrations/20260520120800_audit.sql) `create table if not exists public.admin_audit_logs` | 관리자 작업 감사 로그(보존 — 쓰기 admin RPC는 2026-06-09 제거) | 관리자, action, target, diff/payload | RLS load-bearing(보존) |
| ~~조직~~ | ~~`organizations`/`org_members`/`assignments`/`assignment_submissions`~~ | ❌ 2026-06-09 제거 ([`20260609130000_remove_v13_admin_island.sql`](../supabase/migrations/20260609130000_remove_v13_admin_island.sql)) | v13 admin 섬 철거 시 drop(미사용) | — | 제거됨 |
| 법무 | `legal_documents` | [20260608120000_legal_documents_and_consents.sql](../supabase/migrations/20260608120000_legal_documents_and_consents.sql) `create table if not exists public.legal_documents` | 버전별 약관/개인정보 문서(append-only) | 문서타입(terms/privacy), 버전, 로케일, 본문, 상태, 시행일 | 가입 약관(A-01), 약관(X-13), 개인정보(X-14) |
| 법무 | `user_consents` | [20260608120000_legal_documents_and_consents.sql](../supabase/migrations/20260608120000_legal_documents_and_consents.sql) `create table if not exists public.user_consents` | 사용자 동의 원장(immutable) | 사용자, 문서, 타입/버전, 동의 출처, 동의 시각 | 가입 동의, 재동의(X-13) |

## 스토리지 버킷

| 버킷 | 용도 | 코드 사용처 |
|---|---|---|
| `avatars` | 프로필 이미지 | 프로필 아바타 업로드/공개 URL |
| `problem-assets` | 문제 이미지/오디오 | 문제 자료 표시 |
| `generated-exports` | PDF 등 생성 파일 | export 파일 저장 |

## 주요 RPC와 함수

| 함수 | 설명 | 사용처 |
|---|---|---|
| `submit_writing_with_feedback` | 쓰기 제출과 초기 피드백 레코드 생성을 묶는 RPC | 쓰기 제출 server action |
| `create_comparison_report_with_metrics` | 비교 리포트 생성 | 비교 리포트 생성 server action |
| `get_dashboard_kpi` | 대시보드 KPI 조회 | 학습 KPI |
| `list_user_problems` | 사용자 문제 목록 조회. 쓰기 상태는 `writing_drafts`/`writing_submissions` 기준으로 계산하고 lifecycle 상태를 함께 반환 | 문제 목록 화면 |
| ~~`admin_*` / `get_admin_*`~~ (11개) | ❌ **2026-06-09 제거** — 문제 쓰기·사용자관리·조직·감사조회 admin RPC 전부 drop ([`20260609130000_remove_v13_admin_island.sql`](../supabase/migrations/20260609130000_remove_v13_admin_island.sql)). 문제는 외부 API에서 검수완료로 수급, v13은 노출제어만. | 제거됨 |

## 테이블별 간단 구조

### `profiles`

사용자 프로필과 권한/상태의 중심 테이블이다. `auth.users.id`와 1:1로 연결된다.

핵심 컬럼: `id`, `display_name`, `nickname`, `avatar_path`, `ui_locale`, `app_role`, `plan_label`, `status`, `notification_prefs`, `bio`, `learning_locale`, `content_prefs`, `created_at`, `updated_at`

주요 사용처: `src/lib/auth/profile.ts`, `src/lib/settings/*`, `src/app/(workspace)/profile/page.tsx`, `src/lib/auth/admin-guard.ts`

### `learning_goals`

사용자의 TOPIK 학습 목표를 저장한다.

핵심 컬럼: `user_id`, `topik_level`, `target_grade`, `exam_date`, `weekly_goal_minutes`, `weak_areas`, `is_active`, `updated_at`

주요 사용처: `src/lib/learning/*`, `src/app/(workspace)/onboarding/learning-goal/*`, `src/app/(workspace)/profile/page.tsx`

### `problems`

AI 생성 문제와 관리자 curated 문제를 함께 담는 문제 카탈로그다.

핵심 컬럼: `id`, `source`, `author_id`, `domain`, `question_no`, `topik_level`, `difficulty`, `title`, `prompt`, `materials`, `answer_key`, `rubric`, `explanation`, `tags`, `publish_status`, `review_status`, `lifecycle_status`, `lifecycle_reason`, `expires_at`, `visibility`

주요 사용처: `src/lib/practice/*`, `src/app/(workspace)/practice/*`, `src/app/(workspace)/writing/_components/WritingQuestionRoute.tsx`, `src/lib/admin/*`

쓰기 51~54번 화면은 `materials`/`answer_key`/`rubric` JSONB를 직접 렌더링하지 않고 `src/lib/writing/problem-normalizer.ts`의 `NormalizedWritingProblem`으로 정규화해서 사용한다.

### `problem_assets`

문제에 붙은 이미지나 오디오 파일 경로를 저장한다.

핵심 컬럼: `id`, `problem_id`, `storage_path`, `asset_type`, `sort_order`

주요 사용처: `src/app/(workspace)/writing/_components/WritingQuestionRoute.tsx`, `src/components/admin/AdminProblemAssetsManager.tsx`

### `problem_attempts`

읽기/듣기 같은 객관식 풀이 시도를 저장한다. 쓰기 제출은 `writing_submissions`가 담당한다.

핵심 컬럼: `id`, `user_id`, `problem_id`, `selected_answer`, `is_correct`, `score`, `status`, `started_at`, `submitted_at`, `bookmarked`, `time_spent_seconds`

주요 사용처: `src/lib/practice/next.ts`, `src/components/practice/*`

### `writing_drafts`

쓰기 화면의 자동저장 초안이다.

핵심 컬럼: `id`, `user_id`, `problem_id`, `question_no`, `answer_text`, `answer_json`, `char_count`, `autosave_status`, `last_saved_at`, `created_at`, `updated_at`

주요 사용처: `src/lib/writing/mutations.ts`, `src/lib/writing/queries.ts`, `src/lib/writing/server.ts`, `src/app/(workspace)/dashboard/page.tsx`

### `writing_submissions`

최종 제출된 쓰기 답안이다. 제출 후 수정/삭제가 막힌 immutable 성격으로 설계되어 있다.

핵심 컬럼: `id`, `user_id`, `problem_id`, `draft_id`, `question_no`, `answer_text`, `answer_json`, `char_count`, `submitted_at`, `feedback_status`, `parent_submission_id`

주요 사용처: `src/lib/writing/*`, `src/lib/library/*`, `src/lib/practice/*`, `src/app/(workspace)/dashboard/page.tsx`, `src/app/(workspace)/growth/page.tsx`

### `writing_feedback`

쓰기 제출에 대한 AI 총평 레코드다.

핵심 컬럼: `submission_id`, `user_id`, `status`, `score_total`, `score_max`, `overall_summary`, `ai_model`, `ai_model_version`, `raw_ai_result`, `generated_at`

주요 사용처: `src/lib/writing/*`, `src/app/(workspace)/dashboard/page.tsx`, `src/app/(workspace)/growth/page.tsx`, `src/app/(workspace)/practice/weakness/page.tsx`

### `feedback_dimension_scores`

문법, 어휘, 구조, 내용 등 피드백 차원별 점수를 저장한다.

핵심 컬럼: `id`, `submission_id`, `user_id`, `dimension`, `score`, `score_max`, `summary`, `weakness_level`

주요 사용처: `src/lib/practice/weakness.ts`, `src/lib/practice/next.ts`, `src/lib/writing/*`, `src/app/(workspace)/library/page.tsx`

### `sentence_feedback`

문장별 원문, 수정문, 코멘트를 저장한다.

핵심 컬럼: `id`, `submission_id`, `user_id`, `sentence_index`, `original_text`, `corrected_text`, `comment`

주요 사용처: `src/lib/writing/queries.ts`, `src/lib/writing/server.ts`

### `comparison_reports`

현재 제출과 이전 제출을 비교한 결과를 저장한다.

핵심 컬럼: `id`, `user_id`, `current_submission_id`, `previous_submission_id`, `metrics`, `narrative`, `ai_model`, `generated_at`

주요 사용처: `src/lib/writing/server.ts`, `src/lib/library/*`, `src/lib/export/pdf-export.ts`

### `recommendation_runs`

추천이 생성된 한 번의 실행 단위를 저장한다.

핵심 컬럼: `id`, `user_id`, `source_type`, `source_id`, `reason_summary`, `created_at`, `expires_at`

주요 사용처: `src/components/practice/recommendations-data.ts`, `src/lib/practice/next.ts`, `src/lib/practice/weakness.ts`

### `recommendation_items`

추천 실행에서 나온 개별 추천 문제를 저장한다.

핵심 컬럼: `id`, `run_id`, `user_id`, `problem_id`, `rank`, `reason`, `estimated_minutes`, `weakness_tags`, `status`

주요 사용처: `src/lib/practice/*`, `src/app/(workspace)/dashboard/page.tsx`, `src/components/practice/*`

### `library_items`

내 서재에 저장한 문제, 제출, 리포트, export 등을 다형 FK로 저장한다.

핵심 컬럼: `id`, `user_id`, `item_type`, `attempt_id`, `submission_id`, `report_id`, `export_id`, `problem_id`, `note`, `tags`, `saved_at`

주요 사용처: `src/lib/library/*`, `src/app/(workspace)/library/page.tsx`, `src/components/library/*`

### `study_events`

학습 활동 이벤트 로그다.

핵심 컬럼: `id`, `user_id`, `event_type`, `occurred_at`, `problem_id`, `submission_id`, `attempt_id`, `session_id`, `payload`

주요 사용처: `src/lib/events/study-events.ts`, `src/app/(workspace)/growth/page.tsx`, `src/lib/export/pdf-export.ts`

### `export_files`

PDF 등 생성 파일의 메타데이터를 저장한다.

핵심 컬럼: `id`, `user_id`, `source_type`, `source_id`, `storage_path`, `options`, `status`, `created_at`, `ready_at`

주요 사용처: `src/lib/export/pdf-export.ts`, `src/lib/library/*`, `src/components/library/*`

### `notification_settings`

사용자별 리마인더 시간, 요일, 채널, 타임존을 저장한다.

핵심 컬럼: `user_id`, `reminder_time`, `reminder_days`, `channels`, `timezone`, `updated_at`

주요 사용처: `src/components/settings/learning-settings-data.ts`, `src/components/settings/NotificationPrefsForm.tsx`

### `notification_log`

알림 발송 이력을 저장한다. 사용자는 본인 이력만 읽고, 쓰기는 서비스 역할에서 수행하는 구조다.

핵심 컬럼: `id`, `user_id`, `channel`, `template_key`, `status`, `payload`, `sent_at`, `created_at`

주요 사용처: `src/components/settings/learning-settings-data.ts`, `src/components/settings/NotificationPrefsForm.tsx`

### `subscription_plans`

Paywall에서 보여줄 플랜 카탈로그다.

핵심 컬럼: `plan_key`, `name`, `cadence`, `price_cents`, `currency`, `features`, `recommended`, `active`, `created_at`, `updated_at`

주요 사용처: `src/components/settings/billing-data.ts`, `src/components/settings/PaywallShell.tsx`

### `subscriptions`

사용자의 구독 상태를 저장한다.

핵심 컬럼: `id`, `user_id`, `plan_key`, `billing_cadence`, `status`, `current_period_start`, `current_period_end`, `cancel_at`, `provider`, `provider_subscription_id`, `created_at`, `updated_at`

주요 사용처: `src/components/settings/billing-data.ts`, `src/components/settings/SubscriptionShell.tsx`

### `payment_history`

결제 이력과 영수증 링크를 저장한다.

핵심 컬럼: `id`, `user_id`, `subscription_id`, `amount_cents`, `currency`, `status`, `receipt_url`, `paid_at`, `created_at`

주요 사용처: `src/components/settings/billing-data.ts`, `src/components/settings/SubscriptionShell.tsx`

### `admin_audit_logs`

관리자 작업 감사 로그. **보존(load-bearing 인접)** — append-only. 2026-06-09 v13 admin 섬 제거로 이 테이블에 쓰던 admin RPC들은 drop됐지만, 테이블 자체와 `private.is_*_admin` 기반 정책은 유지된다.

핵심 컬럼: `id`, `admin_user_id`, `action`, `target_table`, `target_id`, `diff`, `payload`, `created_at`

주요 사용처: 현재 직접 쓰기 없음(admin RPC 제거). 보존 사유는 [`admin-scope-boundary.md`](admin-scope-boundary.md) 2026-06-09 § 참조.

> **조직 테이블(`organizations`/`org_members`/`assignments`/`assignment_submissions`)은 2026-06-09 제거됨.**
> v13 admin 섬과 함께 drop(미사용). 근거: [`20260609130000_remove_v13_admin_island.sql`](../supabase/migrations/20260609130000_remove_v13_admin_island.sql).

## 근거 파일

- `supabase/migrations/INDEX.md`
- `supabase/migrations/*.sql`
- `docs/development/database-schema.md`
- `docs/development/backend-auth.md`
- `docs/admin-scope-boundary.md`
- `src/lib/supabase/types.ts`
- `src/` Supabase 호출 위치 검색 결과
