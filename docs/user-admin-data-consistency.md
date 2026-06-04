# User/Admin Data Consistency Inventory

> Status: initial document-first inventory
>
> Created: 2026-06-04
>
> Scope: v13 user-facing app + separate topik-ai admin app. No live DB CRUD was performed.

## 1. Purpose

This document is the first baseline for reconciling the v13 user-facing app with the separate topik-ai admin app.

The goal is not to decide the final backend schema here. The goal is to make the current state visible:

- which implemented v13 DB objects are used by user-facing pages;
- which v13 pages depend on those objects;
- which topik-ai admin pages and page-sync contracts claim related management surfaces;
- which overlaps are direct, partial, planned, or missing.

This inventory intentionally treats `C:\Users\admin\Desktop\workspace\topik-ai\docs\page-sync` as the primary admin-page source, then uses topik-ai source files and data-source docs only to label the current mock/store/service state.

## 2. Source Priority

| Side | Priority | Sources |
| --- | --- | --- |
| v13 implemented schema | 1 | `docs/development/database-schema.md`, `supabase/migrations/*.sql`, `src/lib/supabase/types.ts` |
| v13 actual page usage | 2 | `src/app`, `src/lib`, `src/components`, plus `docs/Wireframe/data-usage-index.md` |
| topik-ai page contract | 1 | `C:\Users\admin\Desktop\workspace\topik-ai\docs\page-sync\*-page-sync.md` |
| topik-ai data-source state | 2 | `docs/architecture/admin-data-source-transition.md`, `docs/specs/admin-data-contract.md`, `src/features/**` |

## 3. Status Terms

| Status | Meaning |
| --- | --- |
| Direct overlap | Both apps have a clear concept match, but field/table naming may still need mapping. |
| Partial overlap | Admin surface exists, but it manages a broader/narrower or differently named candidate object. |
| Planned/admin candidate | topik-ai has a page-sync candidate or placeholder, but v13 has no implemented user-page dependency yet. |
| Missing admin surface | v13 user pages depend on this data, but topik-ai has no clear current management page. |
| User-owned/support only | Data should generally not be direct admin CRUD; admin may need read/support/diagnostic access only. |
| Internal-only | No B2C direct surface expected. |

## 4. v13 DB Objects Used By User Pages

| v13 DB/RPC/storage object | Implemented role / key fields | User-facing pages using it | Usage | Admin-management implication |
| --- | --- | --- | --- | --- |
| `profiles` | Auth mirror, user status, role, locale, plan label, avatar path, profile fields | `/dashboard`, `/growth`, `/profile`, `/settings/language`, `/settings/notifications`, `/onboarding/learning-goal`, auth/onboarding guards | Read/write by user for allowed fields; trusted role/status admin-only by RLS | Direct overlap with topik-ai `Users > 회원 목록/상세`, but v13 table is `profiles` while topik-ai candidate is `users`. |
| `learning_goals` | User TOPIK level, target grade, exam date, weekly goal, weak areas | `/onboarding/learning-goal`, `/dashboard`, `/profile` | Read/write by owner | Missing clear admin surface; likely support/read-only or user self-service unless product defines admin goal management. |
| `problems` | Problem catalog, writing prompts, rubric, publish/review/visibility | `/writing/*`, `/practice/problems`, `/practice/recommendations`, `/practice/next`, `/practice/weakness`, `/library` | Read in user flows; admin/RLS may manage catalog | Direct high-priority overlap with topik-ai `Assessment > TOPIK 쓰기 문제은행`, but table/field names differ. |
| `problem_assets` + `problem-assets` storage | Problem image/audio assets | `/writing/*` | Read | Partial overlap; topik-ai question bank currently centers JSON review documents, not explicit `problem_assets` management. |
| `problem_attempts` | Objective problem attempts, correctness, bookmark, time | `/practice/next`, `/practice/problems`, growth/weakness derivations | Read/write by owner | Missing admin surface; support/analytics only unless moderation/reporting scope is added. |
| `recommendation_runs` | Recommendation batch source and summary | `/practice/recommendations`, `/growth`, `/practice/weakness` | Read | Missing admin surface; operational analytics/config candidate. |
| `recommendation_items` | Recommended problem, rank, reason, weakness tags, status | `/practice/recommendations`, `/practice/next`, `/practice/problems`, `/practice/weakness` | Read/update status | Missing admin surface; should normally be service-generated/user-owned, not direct CRUD. |
| `writing_drafts` | Mutable writing autosave draft | `/writing/*`, `/practice/next`, `/dashboard`, `/practice/problems` | Read/write by owner | User-owned/support only; direct admin CRUD would be risky. |
| `writing_submissions` | Immutable final writing submission | `/writing/*`, `/writing/feedback/*`, `/writing/reports/[id]/compare`, `/library`, `/dashboard`, `/practice/next` | Insert/read by owner; update blocked except service-side status | User-owned/support only; topik-ai `Users > 회원 상세` can become a read/support surface but is not a true CRUD match. |
| `writing_feedback` | Submission-level AI feedback | `/dashboard`, `/growth`, `/practice/weakness`, `/writing/feedback/*`, `/library`, `/practice/next` | Read; service/RPC writes | Missing admin surface; admin likely needs diagnostics and review, not direct CRUD. |
| `feedback_dimension_scores` | Dimension scores and weakness levels | `/practice/weakness`, `/writing/feedback/*`, `/growth`, `/library`, `/practice/next` | Read/derived-read | Missing admin surface; analytics/support candidate. |
| `sentence_feedback` | Sentence-level corrections | `/writing/feedback/*` | Read | Missing admin surface; support-only candidate. |
| `comparison_reports` | Submission comparison metrics/narrative | `/writing/reports/[id]/compare`, `/library` | Read/write via RPC | User-owned/support only; no current topik-ai surface. |
| `library_items` | Saved attempts/submissions/reports/exports/problems | `/library`, feedback save flows | Read/write by owner | User-owned/support only; no current topik-ai surface. |
| `study_events` | Study activity ledger | `/dashboard`, `/growth`, `/library`, `/practice/next`, writing/feedback/export flows | Insert/read/derived-read | Partial overlap with topik-ai dashboard/analytics; likely aggregate/read-only admin use. |
| `export_files` + `generated-exports` storage | Generated PDF/export metadata and file path | `/library`, PDF export modal/feedback/report flows | Read/write by owner | User-owned/support only; no direct admin page. |
| `subscription_plans` | Active plan catalog | `/paywall`, `/subscription` | Read; admin/service manages catalog | Partial overlap with topik-ai Commerce, but topik-ai `commerce_products/packages` and coupons are not the same table. |
| `subscriptions` | Per-user subscription state | `/paywall`, `/subscription`, profile/status shells | Read by owner/admin; service writes | Partial overlap with topik-ai `Commerce > 결제 내역`, `Users > 회원 상세`; exact subscription management page missing. |
| `payment_history` | Per-user receipts/charge attempts | `/subscription` | Read by owner/admin; service writes | Partial overlap with topik-ai `Commerce > 결제 내역/환불 관리`; v13 has no separate `commerce_refunds` table yet. |
| `notification_settings` | Per-user reminder schedule/channels | `/settings/notifications` | Read/write by owner | Partial overlap with topik-ai Message targeting; direct per-user settings admin page missing. |
| `notification_log` | Notification delivery ledger | `/settings/notifications` | Read by owner/admin; service writes | Partial overlap with topik-ai `Messages > 발송 이력`; naming and recipient model need mapping. |
| `avatars` storage | Profile avatar files | `/profile` | Read/write by owner | Partial overlap with user profile admin support; no explicit topik-ai avatar asset management. |
| `get_dashboard_kpi` RPC | User dashboard/growth KPI aggregation | `/dashboard`, `/growth` | Read RPC | Admin equivalent is topik-ai dashboard/analytics aggregates, not CRUD. |
| `list_user_problems` RPC | User-scoped problem list with filters/paging | `/practice/problems` | Read RPC | Admin equivalent should manage source `problems`, not this user-scoped RPC. |
| `submit_writing_with_feedback` RPC | Atomic submission + initial feedback rows | `/writing/short-answer-writing-51`, `/writing/answer-writing-52`, `/writing/long-form-writing-53`, `/writing/essay-writing-54` | Write RPC | Not an admin CRUD surface; admin may need audit/debug only. |
| `create_comparison_report_with_metrics` RPC | Creates comparison report | `/writing/reports/[id]/compare` | Write RPC | Not an admin CRUD surface. |

## 5. v13 User Pages To DB Objects

| User page / route | Visible management point from the user screen | v13 DB/RPC/storage objects | Admin sync need |
| --- | --- | --- | --- |
| `/dashboard` | User profile state, recent feedback, draft continuation, KPI cards | `profiles`, `learning_goals`, `writing_feedback`, `writing_drafts`, `recommendation_runs`, `recommendation_items`, `study_events`, `get_dashboard_kpi` | Mostly support/analytics; do not treat dashboard aggregate as CRUD source. |
| `/growth` | Study trend, score trend, weak area trend | `writing_feedback`, `feedback_dimension_scores`, `study_events`, `profiles`, `get_dashboard_kpi` | topik-ai analytics can mirror aggregate views; no direct CRUD. |
| `/profile` | Profile, avatar, learning goal display/edit | `profiles`, `learning_goals`, `avatars` | topik-ai Users can support account/profile state; user-editable fields need boundary rules. |
| `/settings/language` | UI/learning locale and content preferences | `profiles` | Missing exact admin surface; user self-service. |
| `/settings/notifications` | Reminder settings, channels, delivery history | `profiles`, `notification_settings`, `notification_log` | Partial overlap with Message templates/groups/history; per-user preferences remain user-owned. |
| `/onboarding/learning-goal` | Initial target level/goal setup | `profiles`, `learning_goals` | Missing exact admin surface; likely read/support only. |
| `/practice/recommendations` | Recommended problem types/items | `recommendation_runs`, `recommendation_items`, `problems` | Admin needs source problem catalog management; recommendation result CRUD is not a normal admin task. |
| `/practice/problems` | Problem list, filters, progress/draft/recommendation state | `list_user_problems`, `problems`, `problem_assets`, `problem_attempts`, `writing_drafts`, `writing_submissions`, `recommendation_items` | topik-ai question bank can manage catalog; user progress/draft is support-only. |
| `/practice/next` | Next problem recommendation, attempt/submission history | `recommendation_items`, `problem_attempts`, `problems`, `writing_submissions`, `writing_feedback`, `feedback_dimension_scores`, `profiles`, `study_events` | Catalog maps to admin; generated recommendation/user history does not. |
| `/practice/weakness` | Weakness-based recommendations and feedback summary | `profiles`, `writing_feedback`, `feedback_dimension_scores`, `recommendation_runs`, `recommendation_items`, `problems` | Analytics/support candidate; no direct CRUD. |
| `/writing/short-answer-writing-51` and `/writing/answer-writing-52` | Writing problem prompt, autosave, submit | `problems`, `problem_assets`, `writing_drafts`, `writing_submissions`, `study_events`, `submit_writing_with_feedback` | Strong catalog overlap with topik-ai question bank for question 51/52. |
| `/writing/long-form-writing-53` and `/writing/essay-writing-54` | Long-form writing prompt, autosave, submit | `problems`, `problem_assets`, `writing_drafts`, `writing_submissions`, `study_events`, `submit_writing_with_feedback` | Strong catalog overlap with topik-ai question bank for question 53/54. |
| `/writing/feedback/short/[id]`, `/writing/feedback/long/[id]` | AI feedback details and sentence feedback | `writing_submissions`, `writing_feedback`, `feedback_dimension_scores`, `sentence_feedback`, `study_events`, `library_items`, `export_files` | User-owned output; admin should likely inspect/support, not edit. |
| `/writing/reports/[id]/compare` | Comparison report generation/view | `writing_submissions`, `writing_feedback`, `feedback_dimension_scores`, `comparison_reports`, `study_events`, `create_comparison_report_with_metrics` | User-owned generated artifact; no current topik-ai management page. |
| `/library` | Saved submissions/problems/reports/exports | `library_items`, `writing_submissions`, `writing_feedback`, `feedback_dimension_scores`, `comparison_reports`, `problems`, `export_files`, `study_events` | User-owned/support only. |
| `/paywall` | Plan catalog and current plan state | `subscription_plans`, `subscriptions`, `profiles` | Partial Commerce overlap; plan catalog admin page is not clearly implemented. |
| `/subscription` | Current subscription and payment history | `subscription_plans`, `subscriptions`, `payment_history`, `profiles` | Partial overlap with Commerce payments/refunds and Users detail. |

## 6. topik-ai Page-Sync Inventory

| topik-ai page-sync page | Route | Primary table candidate | Current mock/source state | page-sync user-screen claim | v13 actual overlap |
| --- | --- | --- | --- | --- | --- |
| Dashboard > 대시보드 | `/dashboard` | `dashboard_metrics` or aggregate views | Page/dashboard aggregate surface | Internal-only KPI | Partial with v13 `study_events`, billing/payment/notification aggregates; no CRUD. |
| Users > 회원 목록 | `/users` | `users` | `users-service.ts` + `mock-users.ts` + query store; PASS in admin contract | My page account info, login/access guard | Direct overlap with v13 `profiles`; table name and auth email source need mapping. |
| Users > 회원 상세 | `/users/:userId` | `users`, `user_activities`, `user_payments`, `user_community_posts`, `user_access_logs`, `user_admin_memos` | `mock-users` plus page-local derived tab data; FAIL in admin contract | Profile, payment history, community activity | Partial with `profiles`, `payment_history`, `study_events`, submissions; detailed aggregates need explicit service. |
| Users > 강사 관리 | `/users/groups` | `instructors`, `instructor_courses` | `instructors-service.ts` + `mock-instructors.ts`; PASS | Instructor profile/course detail | No current v13 user-page overlap found. |
| Users > 추천인 관리 | `/users/referrals` | `referrals`, `referral_relations`, `referral_reward_ledgers` | `referrals-service.ts` + `mock-referrals.ts`; PASS | Referral code, invite, reward/points | Planned/admin candidate; no current v13 referral DB object found. |
| Community > 게시글 관리 | `/community/posts` | `community_posts`, `community_post_admin_notes` | Page-local `initialRows`; FAIL | Community list/detail/profile posts | No current v13 community page overlap found. |
| Community > 신고 관리 | `/community/reports` | `community_reports` | Page-local `initialRows`; FAIL | Community post visibility/account access | No current v13 community page overlap found. |
| Message > 메일 | `/messages/mail` | `message_templates` | `messages-service.ts` + `message-store.ts`; PASS | Email inbox/admin mail | Partial with notification delivery only; v13 currently exposes settings/log, not admin mail templates. |
| Message > 푸시 | `/messages/push` | `message_templates` | `messages-service.ts` + `message-store.ts`; PASS | App/web push notification | Partial with v13 `notification_settings` and `notification_log`. |
| Message > 대상 그룹 | `/messages/groups` | `message_groups`, `message_group_rules` | `messages-service.ts` + `message-store.ts` + segment schema; PASS | Mail/push recipients | Partial; v13 has no segment/group DB object yet. |
| Message > 발송 이력 | `/messages/history` | `message_histories`, `message_history_recipients` | `messages-service.ts` + `message-store.ts`; PASS | Email/push delivery results | Partial with v13 `notification_log`; recipient model differs. |
| Operation > 공지사항 | `/operation/notices` | `operation_notices` | `notices-service.ts` + `operation-store.ts`; PASS | Notice list/detail/home/my page notice | Planned/admin candidate; no current v13 notice table/page found. |
| Operation > FAQ | `/operation/faq` | `operation_faqs`, `operation_faq_curations`, `operation_faq_metrics` | `faqs-service.ts` + `operation-store.ts` + schema; PASS | Help/FAQ/payment help | Planned/admin candidate; no current v13 FAQ table/page found. |
| Operation > 이벤트 | `/operation/events` | `operation_events` | `events-service.ts` + `operation-store.ts`; PASS | Event list/detail/promotion landing | Planned/admin candidate; no current v13 event table/page found. |
| Operation > 정책 관리 | `/operation/policies` | `operation_policies`, `operation_policy_histories` | `policies-service.ts` + `policy-store.ts`; PASS | Signup terms, refund policy, policy links | Planned/admin candidate; v13 has auth/paywall pages but no implemented policy tables found. |
| Operation > 챗봇 설정 | `/operation/chatbot` | `operation_chatbot_scenarios`, `operation_chatbot_rules` | Placeholder page-sync/route candidate | Web/app chatbot | Planned/admin candidate; no current v13 overlap. |
| Commerce > 결제 내역 | `/commerce/payments` | `commerce_payments` | `commerce-store.ts` initial payments | My page payment history/subscription status/receipt | Partial with v13 `payment_history`, `subscriptions`. |
| Commerce > 환불 관리 | `/commerce/refunds` | `commerce_refunds` | `commerce-store.ts` initial refunds | Payment/refund status | Partial; v13 has `payment_history.status='refunded'` but no separate refund table. |
| Commerce > 쿠폰 관리 | `/commerce/coupons` | `commerce_coupons`, `commerce_coupon_subscription_templates` | `coupons-service.ts` + `coupon-store.ts`; PASS | Coupon box/payment discount/promotion | Planned/admin candidate; no current v13 coupon table found. |
| Commerce > 포인트 관리 | `/commerce/points` | `commerce_point_policies`, `commerce_point_ledgers`, `commerce_point_expirations` | `points-service.ts` + `point-store.ts` + schema; WARN/placeholder lineage in docs | Point wallet/reward/expiration | Planned/admin candidate; no current v13 point table found. |
| Commerce > 이커머스 관리 | `/commerce/store` | `commerce_products`, `commerce_packages` | Placeholder page-sync/route candidate | Product list/package/checkout | Partial with v13 `subscription_plans`, but naming and scope differ. |
| Assessment > TOPIK 쓰기 문제은행 | `/assessment/question-bank` | `assessment_questions`, `assessment_question_reviews`, `assessment_question_histories` | `assessment-question-bank-service.ts` + store/schema + JSON fixture `valid_questions_97items_2026-03-27.json`; PASS-style | TOPIK writing exam/problem/result surfaces | Direct high-priority overlap with v13 `problems`, `problem_assets`, writing pages. |
| Assessment > EPS TOPIK | `/assessment/question-bank/eps-topik` | `assessment_eps_topik_sets`, `assessment_eps_topik_questions` | Placeholder page-sync/route candidate | EPS exam/result screens | No current v13 EPS-specific overlap found. |
| Assessment > 레벨 테스트 | `/assessment/level-tests` | `assessment_level_tests`, `assessment_level_test_results` | Placeholder page-sync/route candidate | Level test start/result/recommendation | No current v13 level-test table/page found. |
| Content > 콘텐츠 관리 | `/content/library` | `content_items` | Placeholder page-sync/route candidate | Learning content list/detail | No current v13 content catalog table found outside `problems`. |
| Content > 배지 | `/content/badges` | `content_badges` | Placeholder page-sync/route candidate | My page achievements/profile | No current v13 badge table found. |
| Content > 단어장 | `/content/vocabulary` | `vocabulary_categories`, `vocabulary_entries` | Placeholder page-sync/route candidate | Vocabulary learning | No current v13 vocabulary table found. |
| Content > 소나기 | `/content/vocabulary/sonagi` | `vocabulary_sonagi_sets` | Placeholder page-sync/route candidate | Sonagi learning | No current v13 overlap found. |
| Content > 객관식 선택 | `/content/vocabulary/multiple-choice` | `vocabulary_multiple_choice_questions` | Placeholder page-sync/route candidate | Quiz/objective learning | Partial concept with v13 `problems`/`problem_attempts`, but no vocabulary-specific object. |
| Content > 학습 미션 | `/content/missions` | `learning_missions`, `learning_mission_rewards` | Placeholder page-sync/route candidate | Mission/reward/my achievements | No current v13 mission/reward table found. |
| Analytics > 통계 개요 | `/analytics/overview` | `analytics_metrics` or aggregate views | Page aggregate surface | Mostly internal operational metrics | Partial with v13 `study_events`, billing, notification, writing feedback aggregates. |
| System > 관리자 계정 | `/system/admins` | `admin_accounts` | `permission-store.ts` initial admins | Internal-only | Internal-only, no v13 B2C overlap. |
| System > 권한 관리 | `/system/permissions` | `system_roles`, `system_permissions` | `permission-store.ts` | Internal-only | Internal-only; may map to v13 admin role concepts only, not B2C. |
| System > 메타데이터 관리 | `/system/metadata` | `system_metadata_groups`, `system_metadata_items` | `system-metadata-service.ts` + store | Linked user surfaces by metadata group | Partial future cross-cutting surface; no direct v13 table. |
| System > 감사 로그 | `/system/audit-logs` | `audit_logs` | Merges permission/coupon/assessment/metadata audits and mock users | Internal evidence | Partial with v13 `admin_audit_logs`; topik-ai should own admin audit in final admin backend. |
| System > 시스템 로그 | `/system/logs` | `system_logs` | Page-local static rows | Internal-only | Internal-only. |

## 7. Cross-App Mapping Matrix

| v13 object / surface | v13 user pages | topik-ai admin candidate | Current fit | Main gap before real CRUD validation |
| --- | --- | --- | --- | --- |
| `profiles` | Profile, settings, dashboard, auth guards | Users > 회원 목록, Users > 회원 상세 | Direct overlap | Map `profiles.id/display_name/nickname/status/plan_label/app_role` to topik-ai `User` fields; decide where email comes from (`auth.users` vs mock `users`). |
| `learning_goals` | Onboarding, dashboard, profile | Users > 회원 상세 maybe future profile tab | Missing admin surface | Decide whether admin should manage goals or only inspect support state. |
| `problems` | Practice/writing/library/recommendations | Assessment > TOPIK 쓰기 문제은행 | Direct overlap | Map topik-ai `assessment_questions` JSON fixture fields to v13 `problems.prompt/materials/rubric/answer_key/publish_status/review_status/visibility`. |
| `problem_assets` | Writing pages | Assessment > TOPIK 쓰기 문제은행 | Partial overlap | Add explicit asset handling if question assets must be managed; current topik-ai fixture is document-centric. |
| `problem_attempts` | Practice/next/problems/growth | Analytics or Users detail candidate | Missing admin surface | Determine support/analytics requirements; avoid direct user progress CRUD by default. |
| `recommendation_runs/items` | Recommendations, next, weakness | Analytics/content candidate only | Missing admin surface | Clarify whether admin manages recommendation rules/config or only observes generated recommendations. |
| `writing_drafts` | Writing pages, dashboard, practice list | None | User-owned/support only | If support needs draft inspection, define read-only path and privacy boundary. |
| `writing_submissions` | Writing feedback/report/library | Users > 회원 상세 candidate | Partial overlap | Build a user-detail aggregate contract before real DB wiring; keep submissions immutable. |
| `writing_feedback` and feedback detail tables | Feedback, growth, weakness, next | Analytics or Users detail candidate | Missing admin surface | Decide if admin review/diagnostic page is needed for AI feedback quality and support. |
| `comparison_reports` | Compare report, library | None | User-owned/support only | Define read-only support path only if needed. |
| `library_items` | Library and feedback save flows | None | User-owned/support only | No direct admin CRUD recommended unless CS support scope requires it. |
| `study_events` | Dashboard, growth, library, writing/export events | Dashboard, Analytics overview, Users detail | Partial overlap | Need aggregate views or event explorer; raw event mutation should stay service/user-owned. |
| `export_files` | Library/PDF export flows | None | User-owned/support only | Decide if failed export support queue is needed. |
| `subscription_plans` | Paywall, subscription | Commerce > 이커머스 관리, maybe coupons | Partial overlap | Decide whether topik-ai manages plan catalog as `subscription_plans` or commerce products/packages. |
| `subscriptions` | Paywall, subscription, profile shells | Commerce > 결제 내역, Users > 회원 상세 | Partial overlap | Separate subscription state from payment transactions in admin model. |
| `payment_history` | Subscription payment history | Commerce > 결제 내역, 환불 관리 | Partial overlap | v13 has receipts and status; topik-ai has payment/refund candidates. Refund schema must be reconciled. |
| `notification_settings` | Notification settings | Message > 대상 그룹/mail/push | Partial overlap | User preference settings and admin campaign targeting are different; do not merge blindly. |
| `notification_log` | Notification settings history | Message > 발송 이력 | Partial overlap | Map log fields, recipients, message templates, and delivery status. |
| `avatars` | Profile avatar | Users > 회원 상세 candidate | Partial overlap | Decide whether admin can view/change avatars; default should be read/support only. |
| Admin audit/log concepts | v13 frozen admin docs/migrations only | System > 감사 로그 | Partial/internal | topik-ai audit log should become the admin SoT; v13 in-app admin remains out of active scope. |

## 8. Immediate Findings

| Finding | Evidence | Impact |
| --- | --- | --- |
| topik-ai question bank is the clearest first reconciliation slice. | v13 writing pages use `problems`/`problem_assets`; topik-ai has `Assessment > TOPIK 쓰기 문제은행` with service/store/schema/97-item JSON fixture. | This is the best first document-to-implementation mapping candidate before live CRUD. |
| User account data overlaps, but table names and ownership differ. | v13 implemented table is `profiles`; topik-ai page-sync uses `users`. | A mapping contract is needed before wiring admin user management. |
| Billing overlaps are partial, not exact. | v13 has `subscription_plans`, `subscriptions`, `payment_history`; topik-ai has `commerce_payments`, `commerce_refunds`, `commerce_products/packages`. | Admin Commerce cannot be assumed to manage v13 billing without a reconciliation spec. |
| Notification overlaps are conceptually close but model boundaries differ. | v13 has per-user `notification_settings` and `notification_log`; topik-ai Message has templates, groups, histories. | Campaign/admin messaging and user notification preferences need separate contracts. |
| Many topik-ai page-sync surfaces are planned/admin candidates without v13 backing tables. | Content, FAQ, notices, events, points, referrals, vocabulary, badges, missions have page-sync contracts but no matching v13 implemented DB usage found in this pass. | Do not treat these as current v13 management gaps unless product scope confirms those user pages exist. |
| Many v13 user-owned artifacts lack admin pages. | Drafts, submissions, feedback, library, reports, exports are implemented user surfaces. | Admin access should be read/support/diagnostic by default, not CRUD. |
| Existing topik-ai implementation quality varies by module. | Admin data-source docs mark Users/Message/Operation/Coupons/Assessment mostly service-backed, but Community and Users detail still page-local or derived. | Real DB validation should not start from page-local data modules until source boundaries are fixed or explicitly accepted. |

## 9. Suggested Slices For The Next Investigation

| Slice | Scope | Why this order |
| --- | --- | --- |
| 1 | `problems` / `problem_assets` vs topik-ai `Assessment > TOPIK 쓰기 문제은행` | Highest direct user-visible content overlap and already has a concrete JSON fixture. |
| 2 | `profiles` / auth account state vs topik-ai `Users > 회원 목록/상세` | Core account management overlap; requires careful ownership and RLS mapping. |
| 3 | `subscription_plans`, `subscriptions`, `payment_history` vs topik-ai Commerce | Revenue/support critical, but current models are not one-to-one. |
| 4 | `notification_settings`, `notification_log` vs topik-ai Message | Close conceptual overlap, but admin campaigns and user preferences must stay distinct. |
| 5 | user-owned learning artifacts: submissions, feedback, library, exports, study events | Likely support/analytics surfaces rather than CRUD; privacy and immutability rules should be designed first. |
| 6 | topik-ai planned content/operation/community surfaces with no v13 backing table | Defer until matching user pages or product scope are confirmed. |

## 10. Verification Notes

- This pass did not write real DB data and did not run CRUD validation.
- This pass did not modify topik-ai source or docs.
- v13 in-app admin code was intentionally ignored as an implementation target because `docs/admin-scope-boundary.md` says admin sync is owned in the separate topik-ai folder.
- `docs/Wireframe/data-usage-index.md` already reports schema-document drift against later migrations; this document therefore uses both the schema doc and migration/source inspection for billing/notification objects.
