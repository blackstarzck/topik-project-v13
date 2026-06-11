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

### 06 — June

#### 02 (화) — Conformance: billing / notifications / settings / admin RPC + 조직(net-new)

> ⚠ 본 5개 마이그레이션은 **작성만 완료** 상태이며 coordinator 검토·적용 전입니다. 특히 26번(`org.sql`)은 Tier 1 MVP 스키마에 없던 **net-new scope**라 적용 전 IA 스펙 대조 확인 필요.

| # | timestamp | 파일 | 영역 |
| ---:| --- | --- | --- |
| 26 | `12:00:00` | [`20260602120000_handle_new_user_display_name.sql`](./20260602120000_handle_new_user_display_name.sql) | `handle_new_user()` 재정의 — `profiles.display_name` 를 `raw_user_meta_data->>'display_name'` (nullif empty) 로 시드. 트리거 바인딩 idempotent 재선언 |
| 27 | `12:01:00` | [`20260602120100_billing.sql`](./20260602120100_billing.sql) | `subscription_plans`(public read), `subscriptions`(owner read + platform_admin read), `payment_history`(owner read) + RLS + updated_at 트리거 + 예시 플랜 3종 seed (월/분기/연, KRW placeholder, `__seed` 태그) |
| 28 | `12:02:00` | [`20260602120200_notifications_and_settings.sql`](./20260602120200_notifications_and_settings.sql) | `notification_settings`(owner-all), `notification_log`(owner read) + `profiles.learning_locale`/`profiles.content_prefs` 컬럼(G-01). 기존 `notification_prefs` 3-boolean 유지 |
| 29 | `12:03:00` | [`20260602120300_org.sql`](./20260602120300_org.sql) | **NET-NEW**: `organizations`, `org_members`, `assignments`, `assignment_submissions` + `private.is_org_member/is_org_manager` 헬퍼 + org-scoped RLS (X-08/X-10) |
| 30 | `12:04:00` | [`20260602120400_admin_and_user_rpcs.sql`](./20260602120400_admin_and_user_rpcs.sql) | Admin RPC: `get_admin_users`, `get_admin_user_stats`, `admin_set_user_status`, `admin_update_problem`, `admin_delete_problem`, `admin_add_problem_asset`, `admin_remove_problem_asset`, `get_admin_audit_logs` + `get_admin_org_dashboard` 확장(drop→recreate, 4→6 컬럼 additive) + `list_user_problems`(C-02, SECURITY INVOKER) |

#### 08 (월) — Conformance decisions #2/#4 backing schema (✅ 2026-06-09 적용 완료)

> ✅ **적용 완료(2026-06-09)**: 31·32는 라이브 dev DB에 적용됨. 적용 당시 31(legal)이 누락돼 있던 것을 발견해 함께 적용했고, `schema_migrations`도 백필. wireframe-db-conformance 결정 #2·#4 확정에 따른 사용자 화면 backing 스키마. 둘 다 admin 소유 공유 영역(`admin-data-contract` 이름 정합은 LATER admin-build 단계). 근거: [`../../docs/ai-workflow/runs/2026/06/08/20260608-conformance-decisions-finalized.md`](../../docs/ai-workflow/runs/2026/06/08/20260608-conformance-decisions-finalized.md).

| # | timestamp | 파일 | 영역 |
| ---:| --- | --- | --- |
| 31 | `12:00:00` | [`20260608120000_legal_documents_and_consents.sql`](./20260608120000_legal_documents_and_consents.sql) | `legal_documents`(버전별 약관/개인정보, published 공개 read + admin all), `user_consents`(per-user 동의 ledger, append-only owner read+insert) + RLS + updated_at 트리거. 약관 동의 영속화(#2=B). admin `operation_policies`/`requiresConsent` 의미 매핑 |
| 32 | `12:01:00` | [`20260608120100_problems_lifecycle_expiry.sql`](./20260608120100_problems_lifecycle_expiry.sql) | `problems` additive 컬럼: `lifecycle_status`(active/inactive/expired, C-02 배지·행 비활성), `lifecycle_reason`(사유), `expires_at`(문제 전용 만료, `recommendation_runs.expires_at`와 분리) + 부분 인덱스. 만료 *기준* 미정 → 컬럼만, 자동만료 로직 없음(#4) |

#### 08 (월) — Wireframe writing problem fixture seed (DB 적용 완료)

| # | timestamp | 파일 | 영역 |
| ---:| --- | --- | --- |
| 33 | `12:02:00` | [`20260608120200_seed_writing_problem_fixtures.sql`](./20260608120200_seed_writing_problem_fixtures.sql) | Wireframe 08~11 JSON 기반 `problems` seed 466개. `materials.seed_source='wireframe_problem_fixtures'` + `source_file` + `source_item_id`로 중복 방지. 검수 통과분은 published/public/approved, 미통과분은 draft/private/pending. 스키마 변경 없음. |

#### 08 (월) — Admin integration Phase C: 문제은행 정합 컬럼 + 감사 메모 (✅ 적용 완료)

> Admin(topik-ai) 쓰기 문제은행 정합. GPT-5.5 교차검토 D-B/D-C 결정 반영. 둘 다 additive·idempotent, PROPOSED(코드 확정 전 CHECK 없음). 2026-06-09 적용 확인. 근거: [`../../docs/admin-integration-plan.md`](../../docs/admin-integration-plan.md).

| # | timestamp | 파일 | 영역 |
| ---:| --- | --- | --- |
| 35 | `12:03:00` | [`20260608120300_problems_topic_category_review_workflow.sql`](./20260608120300_problems_topic_category_review_workflow.sql) | `problems` additive 컬럼 `topic_category_code`(D-B: 주제 분류, `domain` 영역과 구분) + `review_workflow_status`(D-C: 진행 검수단계, `review_status` 최종결과와 분리) + `admin_update_problem` allowlist 13키 확장. nullable·CHECK 없음(PROPOSED). |
| 36 | `12:04:00` | [`20260608120400_admin_update_problem_audit_note.sql`](./20260608120400_admin_update_problem_audit_note.sql) | `admin_update_problem` create-or-replace: 예약 patch 키 `__note`(컬럼 아님)를 추출해 `admin_audit_logs.payload`에 `{"review_note":...}`로 기록. 시그니처 불변, 기존 동작 보존. 검수 사유/메모의 감사 보관. |

#### 09 (화) — User problem list writing state RPC (✅ 적용 완료)

| # | timestamp | 파일 | 영역 |
| ---:| --- | --- | --- |
| 34 | `12:00:00` | [`20260609120000_list_user_problems_writing_state.sql`](./20260609120000_list_user_problems_writing_state.sql) | `list_user_problems` 재정의. 사용자 문제 목록에서 쓰기 진행 상태를 `writing_drafts`/`writing_submissions` 기준으로 계산하고 `solve_state`, `latest_submission_id`, feedback/lifecycle/publish/review 상태를 additive 반환한다. `published` 문제만 노출하고 lifecycle 비활성/만료는 행 비활성 근거로 반환한다. |

#### 09 (화) — v13 admin 섬 제거 (✅ 적용 완료, 소유자 결정)

> 문제는 외부 API에서 **검수 완료** 상태로 수급 → v13은 노출제어(공개/비공개+만료)만. v13 admin CRUD/검수/사용자·조직 관리 불필요 → 코드 + DB 동반 제거. 보존: `app_role`·`admin_audit_logs`·`private.is_*_admin`. 배경: [`../../docs/admin-scope-boundary.md`](../../docs/admin-scope-boundary.md) 2026-06-09 §.

| # | timestamp | 파일 | 영역 |
| ---:| --- | --- | --- |
| 37 | `13:00:00` | [`20260609130000_remove_v13_admin_island.sql`](./20260609130000_remove_v13_admin_island.sql) | admin RPC 11개(`admin_update_problem`·`delete`·`add/remove_problem_asset`·`toggle_problem_publish`·`change_user_role`·`set_user_status`·`get_admin_users`·`get_admin_user_stats`·`get_admin_audit_logs`·`get_admin_org_dashboard`) drop + org 테이블 4개(`organizations`·`org_members`·`assignments`·`assignment_submissions`) drop(cascade) + org 헬퍼 2개(`private.is_org_member`·`is_org_manager`) drop. **보존**: `app_role`·`admin_audit_logs`·`is_*_admin`. forward-only·idempotent. |

#### 10 (수) — Google OAuth 약관 게이트 seed (작성 완료)

| # | timestamp | 파일 | 영역 |
| ---:| --- | --- | --- |
| 38 | `10:40:17` | [`20260610104017_seed_initial_legal_documents.sql`](./20260610104017_seed_initial_legal_documents.sql) | `/auth/consent`가 참조할 `terms`/`privacy` published placeholder 문서를 `ko/en/vi` 로케일별 seed. 스키마 변경 없음. `on conflict (doc_type, version, locale) do nothing`으로 idempotent. |

---

## 새 마이그레이션을 추가할 때

1. **timestamp 결정**: 현재 시각 KST를 `YYYYMMDDHHMMSS` 형식으로. 예) 2026-06-05 09:30:00 → `20260605093000`.
2. **파일 작성**: `supabase/migrations/<timestamp>_<짧은_설명>.sql` 로 flat 위치에 둠. 하위 폴더 만들지 말 것 — Supabase CLI가 못 본다.
3. **본 INDEX.md 갱신**: 해당 날짜 섹션에 표 한 줄 추가. 새 연/월/일이면 트리 헤더 (`### 06`, `#### 05`) 부터 추가.
4. **`supabase/README.md`** 의 요약 정보가 영향받으면 같이 갱신.
5. **정본 spec(`docs/development/database-schema.md`)** 도 같이 갱신: §5 Migration Index 표, §1 테이블 컬럼 표, §7 invariants.

## 빠른 검증 체크리스트

- [ ] timestamp 가 기존 마지막 파일보다 큰가?
- [ ] 파일명에 한글·공백·대문자 없는가? (소문자 + snake_case)
- [ ] SQL이 idempotent (`if not exists`, `or replace`, `drop ... if exists`)?
- [ ] FK 참조 테이블이 이전 timestamp 파일에 존재하는가?
- [ ] RLS-적용 대상이라면 RLS enable + force + 정책이 같은 또는 후속 마이그레이션에 있는가?
- [ ] INDEX.md / README.md / database-schema.md 세 곳을 모두 갱신했는가?
