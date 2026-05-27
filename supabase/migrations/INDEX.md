# Migrations Index — 연/월/일 트리

본 문서는 `supabase/migrations/` 의 SQL 파일을 **연 → 월 → 일** 트리 구조로 정리한 시각적 인덱스입니다.

실제 SQL 파일은 **Supabase CLI 호환을 위해 `supabase/migrations/` 디렉토리 바로 아래에 flat 으로 위치**합니다 (CLI는 하위 폴더 SQL을 스캔하지 않음). 본 문서는 가독성을 위한 메타 정리입니다.

명명 규칙·idempotency·CLI 적용 명령은 [`../README.md`](../README.md) 참조.
테이블 컬럼·RLS·ER 등 스키마 상세는 [`../../docs/development/database-schema.md`](../../docs/development/database-schema.md) 참조.

---

## 2026

### 05 — May

#### 20 (화) — Tier 1 MVP 초기 스키마 + 보강 round-2

##### Round 1 · Tier 1 MVP 초기 스키마 (12개)

| # | timestamp | 파일 | 영역 |
| ---:| --- | --- | --- |
| 1 | `12:00:00` | [`20260520120000_extensions_and_schemas.sql`](./20260520120000_extensions_and_schemas.sql) | `pgcrypto`, `citext`, `private` schema |
| 2 | `12:01:00` | [`20260520120100_profiles_goals.sql`](./20260520120100_profiles_goals.sql) | `profiles`, `learning_goals` |
| 3 | `12:02:00` | [`20260520120200_problems.sql`](./20260520120200_problems.sql) | `problems`, `problem_assets` |
| 4 | `12:03:00` | [`20260520120300_attempts.sql`](./20260520120300_attempts.sql) | `problem_attempts` |
| 5 | `12:04:00` | [`20260520120400_writing.sql`](./20260520120400_writing.sql) | `writing_drafts`, `writing_submissions` |
| 6 | `12:05:00` | [`20260520120500_feedback.sql`](./20260520120500_feedback.sql) | `writing_feedback`, `feedback_dimension_scores`, `sentence_feedback`, `comparison_reports` |
| 7 | `12:06:00` | [`20260520120600_recommendations.sql`](./20260520120600_recommendations.sql) | `recommendation_runs`, `recommendation_items` |
| 8 | `12:07:00` | [`20260520120700_library_events_exports.sql`](./20260520120700_library_events_exports.sql) | `library_items`, `study_events`, `export_files` |
| 9 | `12:08:00` | [`20260520120800_audit.sql`](./20260520120800_audit.sql) | `admin_audit_logs` |
| 10 | `12:09:00` | [`20260520120900_functions.sql`](./20260520120900_functions.sql) | `private.is_admin`, `touch_updated_at`, `supersede_active_draft` |
| 11 | `12:10:00` | [`20260520121000_triggers.sql`](./20260520121000_triggers.sql) | `updated_at` autoupdate, draft 승격 |
| 12 | `12:11:00` | [`20260520121100_rls_policies.sql`](./20260520121100_rls_policies.sql) | 17 테이블 RLS enable + force + 정책 |

근거 ledger: [`../../docs/ai-workflow/runs/2026/05/20/20260520-1530-schema-implementation.md`](../../docs/ai-workflow/runs/2026/05/20/20260520-1530-schema-implementation.md)

##### Round 2 · 마이그레이션 보강 (4개)

| # | timestamp | 파일 | 영역 |
| ---:| --- | --- | --- |
| 13 | `12:12:00` | [`20260520121200_storage_buckets.sql`](./20260520121200_storage_buckets.sql) | `avatars`, `problem-assets`, `generated-exports` buckets |
| 14 | `12:13:00` | [`20260520121300_storage_policies.sql`](./20260520121300_storage_policies.sql) | `storage.objects` RLS 정책 9개 |
| 15 | `12:14:00` | [`20260520121400_profiles_protected_columns.sql`](./20260520121400_profiles_protected_columns.sql) | `app_role`/`plan_label`/`status` 변경 차단 트리거 |
| 16 | `12:15:00` | [`20260520121500_submission_status_function.sql`](./20260520121500_submission_status_function.sql) | `feedback_status` 상태 머신 (service_role 전용) |

근거 ledger: 동일 ledger의 `Round-2 (마이그레이션 보강)` 섹션

#### 21 (수) — Phase 2 auth bootstrap trigger + Phase 5 writing RPC + Phase 6 hardening

| # | timestamp | 파일 | 영역 |
| ---:| --- | --- | --- |
| 17 | `12:00:00` | [`20260521120000_auth_user_profile_bootstrap.sql`](./20260521120000_auth_user_profile_bootstrap.sql) | `auth.users → public.profiles` INSERT 트리거 (`121100:46` 주석의 self-inconsistency 해소) |
| 18 | `13:00:00` | [`20260521130000_phase_5_writing_rpc.sql`](./20260521130000_phase_5_writing_rpc.sql) | Phase 5 SECURITY DEFINER RPC: `submit_writing_with_feedback`, `create_comparison_report_with_metrics` |
| 19 | `14:00:00` | [`20260521140000_phase_6_rpc_and_admin.sql`](./20260521140000_phase_6_rpc_and_admin.sql) | Phase 6: admin role helpers (`is_platform_admin/is_content_admin/is_org_admin`) + profile policy narrowing + writing_submissions explicit deny + `assert_submission_payload` validator + library/export/event ownership-strict RLS + `get_dashboard_kpi` + `admin_change_user_role` + `admin_toggle_problem_publish` + `submit_writing_with_feedback` validator hookup + `get_admin_org_dashboard` |
| 20 | `14:10:00` | [`20260521141000_phase_6_notification_prefs.sql`](./20260521141000_phase_6_notification_prefs.sql) | Phase 6: `profiles.notification_prefs jsonb not null default '{}' + object check` |

근거 ledger:
- 17: [`../../docs/ai-workflow/runs/2026/05/20/20260520-1800-phase-2-data-and-auth-foundation.md`](../../docs/ai-workflow/runs/2026/05/20/20260520-1800-phase-2-data-and-auth-foundation.md)
- 18: [`../../docs/ai-workflow/runs/2026/05/21/20260521-1700-phase-5-writing-feedback.md`](../../docs/ai-workflow/runs/2026/05/21/20260521-1700-phase-5-writing-feedback.md)
- 19-20: [`../../docs/ai-workflow/runs/2026/05/21/20260521-1800-phase-6-admin-library-hardening.md`](../../docs/ai-workflow/runs/2026/05/21/20260521-1800-phase-6-admin-library-hardening.md)

#### 26 (화) — Phase 7 profile bio + Phase 8 cleanup 함수

| # | timestamp | 파일 | 영역 |
| ---:| --- | --- | --- |
| 21 | `17:00:00` | [`20260526170000_phase_7_profile_bio.sql`](./20260526170000_phase_7_profile_bio.sql) | Phase 7: `profiles.bio` column |
| 22 | `18:00:00` | [`20260526180000_cleanup_unconfirmed_users.sql`](./20260526180000_cleanup_unconfirmed_users.sql) | Phase 8: `private.cleanup_unconfirmed_users(retention_days, dry_run, max_batch)` SECURITY DEFINER 함수 (storage.objects + auth.users 정리, profiles는 FK CASCADE). pg_cron 자동 스케줄은 23번 마이그레이션에서 별도 등록 |

#### 27 (수) — Phase 8 follow-up · pg_cron 자동 스케줄 + Storage hardening

| # | timestamp | 파일 | 영역 |
| ---:| --- | --- | --- |
| 23 | `11:00:00` | [`20260527110000_register_cleanup_cron.sql`](./20260527110000_register_cleanup_cron.sql) | Phase 8 follow-up: `cleanup_unconfirmed_users` pg_cron job (매일 04:00 UTC, idempotent unschedule-then-register). jobname은 원격에 이미 등록된 이름과 일치(2026-05-27 사용자 Dashboard 조회로 확인). pg_cron extension 미설치 환경에서는 fail 없이 skip (raise notice). v1 보고서 자체 검수(Codex GPT-5)에서 22번 마이그레이션의 cron 자동 스케줄 주장이 실제 미등록임을 적발 후 source-of-truth 통합 |
| 24 | `11:30:00` | [`20260527113000_storage_email_confirmed_hardening.sql`](./20260527113000_storage_email_confirmed_hardening.sql) | Phase 8 follow-up P1: `private.is_email_confirmed(uid)` SECURITY DEFINER helper + storage.objects RLS 정책 강화(avatars/exports owner_insert/update에 email_confirmed_at IS NOT NULL 조건 추가). 이메일 미인증 사용자의 파일 업로드 차단 |
| 25 | `14:00:00` | [`20260527140000_cleanup_retention_floor.sql`](./20260527140000_cleanup_retention_floor.sql) | Phase 8 follow-up v2.3 P0: `private.cleanup_unconfirmed_users` 재정의 — retention_days < 30 + dry_run=false 시 raise exception. dry_run preview는 허용. v1 "30일 미만 절대 안 건드림" 주장의 코드 정공법 보호 (Codex 검수 적발 후 fix). 권한 revoke 재선언 포함 |

근거 ledger:
- 22-25: [`../../reports/phase-8-implementation-report-20260527.html`](../../reports/phase-8-implementation-report-20260527.html) (Phase 8 v2.x 자체 검수 정정 + follow-up)

---

## 새 마이그레이션을 추가할 때

1. **timestamp 결정**: 현재 시각 KST를 `YYYYMMDDHHMMSS` 형식으로. 예) 2026-06-05 09:30:00 → `20260605093000`.
2. **파일 작성**: `supabase/migrations/<timestamp>_<짧은_설명>.sql` 로 flat 위치에 둠. 하위 폴더 만들지 말 것 — Supabase CLI가 못 본다.
3. **본 INDEX.md 갱신**: 해당 날짜 섹션에 표 한 줄 추가. 새 연/월/일이면 트리 헤더 (`### 06`, `#### 05`) 부터 추가.
4. **`supabase/README.md`** 의 요약 정보가 영향받으면 같이 갱신.
5. **정본 spec(`docs/development/database-schema.md`)** 도 같이 갱신: §5 Migration Index 표, §1 테이블 컬럼 표, §7 invariants.
6. **ai-workflow ledger**: 비-trivial 작업이면 `docs/ai-workflow/runs/YYYY/MM/DD/` 에 ledger 추가하고 본 INDEX의 해당 항목에 ledger 링크 명시.

## 빠른 검증 체크리스트

- [ ] timestamp 가 기존 마지막 파일보다 큰가?
- [ ] 파일명에 한글·공백·대문자 없는가? (소문자 + snake_case)
- [ ] SQL이 idempotent (`if not exists`, `or replace`, `drop ... if exists`)?
- [ ] FK 참조 테이블이 이전 timestamp 파일에 존재하는가?
- [ ] RLS-적용 대상이라면 RLS enable + force + 정책이 같은 또는 후속 마이그레이션에 있는가?
- [ ] INDEX.md / README.md / database-schema.md 세 곳을 모두 갱신했는가?
