# v13 admin ownership transfer to topik-ai proposal

## Purpose

v13 is the user-facing app. topik-ai is the admin app. This proposal records the admin ownership transfer boundary without editing active v13 SOT files directly.

Core decisions:

- v13 keeps user-facing objects and owner-read paths.
- topik-ai owns admin schema objects, admin RPCs, and admin notification dispatch/attempt operations.
- v13 keeps the transition email worker only until the topik-ai production worker is verified.
- future admin SQL changes must be authored in topik-ai, not v13.
- Active SOT changes require user approval before direct edits.

## Impact

| Area | Impact | Decision |
| --- | --- | --- |
| DB schema | Medium | v13 historical admin island objects are already removed by a forward migration. Do not rewrite the migration chain. |
| v13 user app | Low | Keep `notification_settings`, `user_notifications`, and owner-read `notification_delivery_attempts`. |
| topik-ai admin app | Medium | Admin notification dispatch/history, admin user/status, operation/community/commerce/system objects belong to topik-ai. |
| Shared user/admin data | Medium | Billing, legal consent, and profile demographic fields stay v13-owned unless a separate SOT decision moves DDL ownership. topik-ai may read them for admin workflows. |
| Email worker | High | The worker uses provider credentials and service-role access, so the production owner must be topik-ai server runtime. |
| SOT docs | Medium | v13 `docs/Wireframe/data-usage-index.md` still needs approved cleanup for removed/admin-owned objects. |
| Migration maintenance | Medium | Keep v13 applied migration history intact for now, quarantine historical admin migration meaning in docs/checks, and plan a later migration baseline squash after production handoff. |

## Required SOT checklist

### v13

- [x] `AGENTS.md` - v13 is user-facing; admin feature expansion is out of scope.
- [x] `README.md` - v13 runtime and deployment baseline.
- [x] `supabase/migrations/INDEX.md` - v13 migration chain and admin island removal migration.
- [x] `docs/scope-decisions/2026-06-17-ai-deferred-and-mvp-scope.md` - MVP and deferred scope boundary.
- [x] `docs/Wireframe/data-usage-index.md` - active SOT terms that still need approved cleanup.
- [x] `docs/Wireframe/31-X-09-notification-settings/functional-spec.md` - v13 notification settings/history contract.
- [x] `docs/Wireframe/31-X-09-notification-settings/description.md` - v13 notification settings screen description.

### topik-ai

- [x] `AGENTS.md` - admin repo work and documentation rules.
- [x] `supabase/README.md` - `supabase/migrations` vs `supabase/migrations-admin` and tracker separation.
- [x] `docs/architecture/shared-supabase-schema-ownership.md` - owner/writer/reader matrix.
- [x] `docs/specs/admin-data-contract.md` - admin data contract.
- [x] `docs/specs/admin-data-usage-map.md` - admin page data source map.
- [x] `docs/specs/notification-contract.md` - notification dispatch/attempt status contract.
- [x] `docs/page-sync/message-history-page-sync.md` - Message history page-sync.
- [x] `docs/page-sync/message-inapp-page-sync.md` - in-app message send page-sync.
- [x] `docs/notification-feature-implementation-phase-guide.md` equivalent: current file is `docs/알림-기능-구현-페이즈-가이드.md`.

## Phase 0. Baseline verification

Status: local verification is complete.

Evidence:

- v13 `supabase/migrations/20260609130000_remove_v13_admin_island.sql` removes historical admin problem/org objects.
- topik-ai `supabase/migrations-admin/` is the migration home for admin operation objects.
- topik-ai `supabase/migrations/` owns TOPIK writing authoring/review namespace.
- v13 notification user-facing objects remain in v13/shared owner-read scope.

Verification commands:

- topik-ai `npm run check:transfer-sot-checklist`
- topik-ai `npm run check:migration-boundary`
- topik-ai `npm run harness:admin-boundary:local`
- v13 `pnpm harness:admin-boundary`

## Phase 1. topik-ai-owned admin objects

topik-ai/admin-owned:

- `topik_writing_*`
- `get_admin_users`
- `admin_set_user_status`
- `admin_list_audit_logs`
- `admin_set_admin_app_role`
- `admin_list_admin_app_roles`
- `notification_templates`
- `notification_groups`
- `notification_dispatches`
- `notification_delivery_attempts` admin write/read path
- `operation_notices`
- `operation_faqs`
- `operation_faq_curations`
- `operation_faq_metrics`
- `operation_events`
- `operation_policies`
- `operation_policy_histories`
- `community_posts`
- `community_post_admin_notes`
- `community_reports`
- `commerce_point_policies`
- `commerce_point_ledgers`
- `commerce_point_expirations`
- `commerce_coupons`
- `commerce_coupon_subscription_templates`
- `commerce_refunds`
- `system_metadata_groups`
- `system_metadata_group_items`
- `system_logs`
- `admin_audit_logs`

v13-owned objects that topik-ai may read or reference for admin workflows:

- `profiles`
- `profiles.nationality`
- `subscription_plans`
- `subscriptions`
- `payment_history`
- `legal_documents`
- `user_consents`

Boundary notes:

- `profiles.nationality` remains a v13 profile column. topik-ai `get_admin_users` may expose it in the Users list, but topik-ai must not create a parallel profile-demographic table without a separate SOT decision.
- `subscription_plans`, `subscriptions`, and `payment_history` remain v13 billing/paywall/user-account objects. topik-ai commerce objects such as `commerce_refunds` are admin workflow records and currently record intent only for v13 payment history integration.
- `legal_documents` and `user_consents` remain v13 auth/consent objects. topik-ai Users reads consent status for admin review, but legal document publication and user consent capture remain user-facing scope unless approved separately.

Removed/historical v13 admin island objects:

- `admin_update_problem`
- `admin_delete_problem`
- `admin_add_problem_asset`
- `admin_remove_problem_asset`
- `admin_toggle_problem_publish`
- `admin_change_user_role`
- `get_admin_user_stats`
- `get_admin_audit_logs`
- `get_admin_org_dashboard`
- `organizations`
- `org_members`
- `assignments`
- `assignment_submissions`
- `private.is_org_member`
- `private.is_org_manager`
- `is_org_member`
- `is_org_manager`

## Phase 2. v13 active SOT cleanup proposal

Status: user approval required.

Target:

- `docs/Wireframe/data-usage-index.md`

Direction:

- Do not describe removed admin RPCs/tables as current v13 user-facing objects.
- Classify objects removed by `20260609130000_remove_v13_admin_island.sql` as historical admin island objects.
- Classify `get_admin_users` and `admin_set_user_status` as topik-ai `migrations-admin` owned RPCs.
- Classify `admin_audit_logs` as a topik-ai admin audit sink.
- Keep `notification_delivery_attempts` as shared: topik-ai admin write/read, v13 owner-read history only.

Verification:

- v13 `pnpm check:admin-boundary`
- v13 `pnpm check:notification-owner-read`
- Active doc warnings remain until this proposal is approved and active SOT is updated.

## Phase 2B. Migration directory cross-check

| Source | Evidence | Ownership decision |
| --- | --- | --- |
| v13 `20260602120300_org.sql` | `organizations`, `org_members`, `assignments`, `assignment_submissions`, org helper creation | Historical admin island, not current v13 user-facing scope. |
| v13 `20260609130000_remove_v13_admin_island.sql` | admin problem/user/org RPC and org table removal | Forward migration that defines the current v13 boundary. |
| v13 notification migrations | `notification_settings`, `user_notifications`, `user_marketing_consent`, `notification_delivery_attempts` | Retained as v13 user-facing or shared owner-read scope. |
| v13 billing migrations | `subscription_plans`, `subscriptions`, `payment_history` | Retained as v13 user-facing billing/paywall/account scope. topik-ai commerce/refund records reference these without FK or direct mutation. |
| v13 legal consent migrations | `legal_documents`, `user_consents` | Retained as v13 auth/consent scope. topik-ai Users may read consent status. |
| v13 profile migrations | `profiles.nationality` | Retained as v13 profile scope. topik-ai Users may read as an admin directory field. |
| topik-ai `supabase/migrations` | TOPIK writing question/tag/admin authoring namespace | topik-ai authoring/review ownership. |
| topik-ai `supabase/migrations-admin` | notification, operation, community, commerce, system, admin-users, audit-read tables/RPCs | topik-ai admin domain ownership. |

Critic check:

- Do not treat every topik-ai object as a v13 removal target. `notification_delivery_attempts` is shared.
- Historical migrations are not current ownership proof; use forward removal migrations and current source.
- Do not remove the v13 transition route before topik-ai production cron and actual attempt state transitions are verified.

## Phase 2C. Migration maintenance decision

Status: approved direction, implementation pending.

Decision:

- Short term: historical admin migration quarantine. Keep the existing v13 migration files in place because they are already part of the v13 DB replay chain, but treat admin/org SQL inside them as historical and no longer current v13 ownership.
- Short term: future admin SQL changes must be authored in topik-ai. v13 must not receive new admin tables, admin RPCs, admin notification dispatch writers, or admin operation/community/commerce/system migrations.
- Medium term: migration baseline squash. After topik-ai production worker handoff and v13 active SOT cleanup are verified, prepare a separate baseline migration plan that rewrites v13 bootstrap history to the current user-facing schema and removes the historical admin island from the new baseline.

Why not move old v13 admin SQL files directly to topik-ai:

- They are executable v13 migration history, not just reference documents.
- Moving only selected historical files would split the v13 replay chain across repos and make fresh v13 DB bootstrap harder to reason about.
- topik-ai should own current and future admin DDL/RPC changes, while v13 keeps its historical replay chain until a deliberate baseline squash replaces it.

Baseline squash prerequisites:

- topik-ai production worker verification is complete.
- `npm run harness:admin-transfer:local` passes from topik-ai.
- topik-ai `npm run harness:admin-boundary:production` passes.
- v13 active SOT no longer describes removed admin RPCs/tables as current v13 user-facing objects.
- A new v13 baseline plan identifies the exact current user-facing tables, functions, policies, storage buckets, and seed data to keep.
- Existing dev/prod Supabase migration history handling is explicitly documented before removing or archiving old migration files.

Proposed verification for the future baseline phase:

- Generate current schema snapshot before and after the baseline replacement.
- Diff retained user-facing objects: profiles, writing, attempts, feedback, recommendations, library/events/exports, billing, legal consent, notification settings/feed/history owner-read, storage, and user RPCs.
- Confirm excluded historical admin objects: org tables, admin problem RPCs, admin user/status RPCs, admin org dashboard RPCs.
- Run v13 `pnpm harness:admin-boundary`.
- Run topik-ai `npm run harness:admin-transfer:local`.

## Phase 3. Notification email worker ownership transfer

Status: topik-ai worker implementation and local verification are complete; production verification is pending.

Current decision:

- topik-ai `api/notifications/dispatch-email.ts` is the server-only worker surface.
- Vercel Cron uses `GET /api/notifications/dispatch-email` with `Authorization: Bearer ${CRON_SECRET}`.
- Manual verification uses `POST /api/notifications/dispatch-email` with `x-worker-secret`.
- v13 `src/app/api/notifications/dispatch-email/route.ts` remains only as a transition endpoint until topik-ai production worker verification is complete.

Completed local verification:

- topik-ai worker auth boundary unit test.
- Vercel Cron `GET` dispatch success unit test.
- Resend 2xx-only `sent` bookkeeping unit test.
- client source secret boundary check.
- client bundle secret leak check.
- v13 app/client direct caller absence check.
- v13 owner-read delivery history boundary check.

Production transfer checklist:

- [ ] topik-ai Vercel project link exists.
- [ ] topik-ai production runtime env is configured: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NOTIFICATION_WORKER_SECRET`, `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`, `SITE_URL`.
- [ ] operator smoke env is configured: `TOPIK_AI_PRODUCTION_URL`.
- [ ] topik-ai `npm run check:vercel-worker-readiness -- --strict-env` passes.
- [ ] topik-ai `npm run check:notification-worker-smoke -- --dispatch` passes. This checks unauthenticated 401, authenticated cron GET 2xx, and authenticated manual POST 2xx.
- [ ] topik-ai `npm run check:notification-production-evidence -- --require` passes.
- [ ] topik-ai `npm run harness:admin-boundary:production` passes. This runs local boundary, strict readiness, authenticated worker smoke `--dispatch`, and required evidence `--require`.
- [x] non-mutating Supabase cross-app state check: `npm run check:notification-cross-app-state` passes.
- [ ] actual `notification_delivery_attempts` state moves from `pending` to `sent` or failure bookkeeping state.
- [ ] topik-ai admin history verifies the state.
- [ ] v13 X-09 owner-read history verifies only the logged-in user's scope.
- [x] local UI smoke: topik-ai `npx playwright test tests/e2e/message-source.spec.ts` passes.
- [x] local UI smoke: v13 `pnpm exec playwright test tests/e2e/screens/notification-settings.spec.ts --project=desktop-1280` passes.
- [x] local UI smoke: v13 `pnpm exec playwright test tests/e2e/screens/notification-settings.spec.ts --project=mobile-360` passes.
- [ ] after verification, decide whether to remove the v13 transition route.

## Phase 4. v13-retained user-facing/shared objects

v13 retained objects:

- `profiles`
- `profiles.nationality`
- `subscription_plans`
- `subscriptions`
- `payment_history`
- `legal_documents`
- `user_consents`
- `notification_settings`
- `user_notifications`
- `user_marketing_consent`
- `notification_delivery_attempts` owner-read path

Verification:

- v13 notification filters and dashboard alerts use `user_notifications`.
- v13 X-09 recent delivery history reads `notification_delivery_attempts` by `user_id`.
- topik-ai admin history uses `notification_dispatches` and `notification_delivery_attempts` in admin read scope.
- topik-ai Users can read v13-owned profile, billing, and consent facts through admin RPCs, but those reads do not transfer table DDL ownership.
- topik-ai Commerce refund workflows record admin intent around `payment_history`; v13 payment state mutation remains unverified and out of this transfer phase.

## Current verification commands

### topik-ai

```bash
npm run check:transfer-sot-checklist
npm run check:migration-boundary
npm run check:client-source-secrets
npm run check:notification-cross-app-state
npm run harness:admin-boundary:local
npm run build
npm run check:client-secrets
npm run test:unit -- client-bundle-secret-leaks notification-worker-smoke notification-cross-app-state client-source-secret-boundary transfer-sot-checklist migration-ownership-boundary message-history-boundary vercel-worker-readiness notification-dispatch-email-worker
npm run harness:check
npm run check:vercel-worker-readiness -- --strict-env
npm run check:notification-worker-smoke -- --dispatch
npm run check:notification-production-evidence -- --require
npm run harness:admin-boundary:production
npx playwright test tests/e2e/message-source.spec.ts
```

### v13

```bash
pnpm check:admin-boundary
pnpm check:notification-owner-read
pnpm check:notification-transition-route
pnpm harness:admin-boundary
pnpm typecheck
pnpm exec playwright test tests/e2e/screens/notification-settings.spec.ts --project=desktop-1280
pnpm exec playwright test tests/e2e/screens/notification-settings.spec.ts --project=mobile-360
```

## Acceptance criteria

- [ ] v13 active SOT no longer describes removed admin RPCs/tables as current user-facing objects.
- [x] topik-ai SOT describes migration home and admin object ownership.
- [x] v13 user-facing objects and owner-read shared paths are preserved.
- [x] v13 X-09 delivery history remains `notification_delivery_attempts.user_id = auth user` owner-read.
- [x] v13 billing, legal consent, and profile demographic tables/columns are classified as v13-owned read/reference dependencies, not topik-ai DDL transfer targets.
- [x] service-role/provider keys are not exposed to browser-visible source/bundle in local checks.
- [x] cross-app state check reads shared/admin notification table and recent attempt `status`/`sent_at` consistency without mutation.
- [x] local e2e smoke exists for topik-ai message history and v13 X-09 notification settings.
- [ ] production worker smoke and cross-app state transition are verified.
- [ ] after production verification, v13 transition route retirement decision is recorded.

## Evidence

- v13 `supabase/migrations/20260609130000_remove_v13_admin_island.sql`: removes v13 admin RPC and org tables.
- v13 `supabase/migrations/20260612160000_user_notifications.sql`: v13 user notification feed.
- v13 `supabase/migrations/20260602120100_billing.sql`: v13 billing/paywall/account tables.
- v13 `supabase/migrations/20260608120000_legal_documents_and_consents.sql`: v13 legal consent tables.
- v13 `supabase/migrations/20260617195000_profiles_nationality.sql`: v13 profile nationality column.
- topik-ai `supabase/README.md`: separates `topik_writing_schema_migrations` and `admin_schema_migrations`.
- topik-ai `docs/architecture/shared-supabase-schema-ownership.md`: domain-based owner matrix.
- topik-ai `docs/runbooks/notification-worker-production-verification.md`: production verification runbook.
- Vercel docs: Vercel Cron invokes a server-side function path from `vercel.json`.
