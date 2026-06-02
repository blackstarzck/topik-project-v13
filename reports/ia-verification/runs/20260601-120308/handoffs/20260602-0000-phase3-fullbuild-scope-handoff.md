# Remediation Phase 3 — Full-build scope mapped + migrations designed (resume point)

- handoffId: ho-20260602-0000-phase3-fullbuild
- createdAt: 2026-06-02T00:00:00Z
- createdBy: Claude (Opus 4.8) — root coordinator
- scope: User escalated scope to "implement EVERY documented feature" (description.md + functional-spec.md are mandatory). Full conformance discovery + central migration design done.
- supersedes: ho-20260601-1830-phase2-implementation

## Scope (conformance discovery wpcmhpjxd — 190 gaps total)
- component-only: 144 | db-migration: 20 | external-provider: 8 | i18n-catalog: 2 | evidence-only: 11 | already-built: 5
- Full digest: reports/ia-verification/runs/20260601-120308/_digest-discovery.mjs output (saved tool-result bra8cdv5y.txt). Raw: tasks/wpcmhpjxd.output.

## Migrations DESIGNED (5 files, NOT applied) — supabase/migrations/
- 20260602120000_handle_new_user_display_name.sql (reviewed by coordinator — clean)
- 20260602120100_billing.sql (subscriptions, subscription_plans+seed, payment_history)
- 20260602120200_notifications_and_settings.sql (notification_settings, notification_log, profiles.learning_locale + content_prefs)
- 20260602120300_org.sql — NET-NEW SCOPE (organizations, org_members, assignments, assignment_submissions)
- 20260602120400_admin_and_user_rpcs.sql (get_admin_users, get_admin_user_stats, admin_set_user_status, admin_update_problem, admin_delete_problem, admin_(add/remove)_problem_asset, get_admin_audit_logs, extend get_admin_org_dashboard, list_user_problems)
- INDEX.md rows 26-30 added (marked written-not-applied).

## Apply path (CANNOT apply from coordinator env — like the admin-elevation SQL)
- No supabase CLI on PATH; .env.local has NO DB password / PAT (only service-role key, which cannot run DDL via PostgREST). Project IS linked (supabase/.temp/project-ref=fglggyfvzjdsbyckinqa dev).
- USER applies: `supabase db push` (project linked; applies the 5 pending files in order) OR paste each file in dev Dashboard SQL Editor. Report errors back; iterate.

## Migration RISKS to verify on apply (from designer)
- auth.users SELECT inside SECURITY DEFINER (get_admin_users/_stats) — confirm migration owner has access on the project (is_email_confirmed precedent suggests yes).
- get_admin_org_dashboard return-shape: drop+recreate (4->6 cols, additive); safe in a migration txn — confirm no concurrent dependency.
- Org bootstrap gap: RLS blocks creating the FIRST org (no member yet) -> needs a service_role/SECURITY DEFINER create-org RPC (NOT built; follow-up).
- New public tables may need explicit GRANT to authenticated if not auto-exposed by the Data API.

## Decision reversals / notes
- F-M1: user's "build everything" REVERSES the earlier browser-print supersede (rec-005) — the documented PDF export MODAL (options/preview/consent/filename) is now IN scope. Must revert the deferred-scope.md OOS F-M1 note + the ia-catalog.ts F-M1 relabel. export_files table already exists (no migration).
- Class-A description.md honest-reality notes are now moot for the items being fully built; re-evaluate rec-006.

## External-provider items (build UI+model+seam, STUB external call)
- Social OAuth (A-01/A-02), transactional email at scale (auth), real AI/LLM for D-M2+feedback (currently mock), payment gateway (X-03/X-04), email/Zalo delivery (X-09), notice/bulk send (X-08/X-10). User: give keys to wire the external leg.

## i18n (G-01) — large cross-cutting
- Full UI i18n (next-intl/i18next) + ko/en/vi catalogs so ui_locale actually re-renders. Build infra + ko baseline + locale wiring now; en/vi translation = content task.

## NEXT (build plan, multi-wave)
1. USER applies the 5 migrations on dev (foundation for billing/admin/notif/G-01/C-02 component work).
2. Coordinator runs COMPONENT BUILD WAVES (workflow, per cluster). Wave A = migration-INDEPENDENT (X-01 landing regions, auth polish, A-03/B-01/X-02 regions, C/D/E/R/X-07 regions, F-01 panels+pagination, F-M1 modal, X-05 avatar, admin sidenav+audit-log surfacing). Wave B = migration-DEPENDENT (X-03/X-04 billing UI, X-09 persistence, G-01 prefs, C-02 RPC pagination, H-01/X-08/X-10 detail panels+bulk+RPC wiring).
3. i18n infra workstream.
4. External seams (stubbed) + integration points.
5. EVIDENCE PHASE (coordinator drives a fresh session: prod build + server + Playwright coverage screenshots + RLS + owner-negative seed) per user direction, then audit regeneration + final verify + closeout.

## State preserved
- Phase 2 code (24 FIXED) + green verification (typecheck/lint/489 tests) intact.
- Fixtures: admin roles elevated+verified, problems 51-54 + student learning_goal seeded+verified. owner-negative still pending (coordinator, evidence phase).
