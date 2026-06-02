# RESUME HANDOFF — IA full-feature build (START HERE in a fresh session)

> Self-contained resume point. The previous session's context grew large; continue from here.

## 0. Read order to restore context
1. `CLAUDE.md` + `AGENTS.md` — project rules. **User replies: Korean, "vibe coder" tone.** Ultracode is on → use the Workflow tool for substantive fan-out; verify everything (don't trust agent self-reports on suspicious claims). Fail closed on doc conflicts / secrets / prod / missing approval.
2. `docs/ai-development-workflow.md`.
3. **This file.**
4. Run ledger (full decision history, ~20 decisions): `docs/ai-workflow/runs/2026/06/01/20260601-1701-ia-remediation-full-ceremony.md`.
5. Current git state: `git log --oneline -6` (HEAD should be `b9cc970`, working tree clean).

## 1. What this run is
- Building/remediating IA against audit run **`reports/ia-verification/runs/20260601-120308`** (now **39 IA**; X-13..X-17 were added by a parallel Codex session for real-but-undocumented routes /terms /privacy /admin /password-reset/confirm /auth/callback-fragment).
- **User mandate: implement EVERY feature documented in each screen's `docs/Wireframe/<NN>/description.md` + `functional-spec.md`** (the spec is the contract). External-provider legs are built to the seam + honest-stubbed pending keys. Full ceremony. Work in fresh sessions with handoffs.
- Key user decisions (see ledger): sync docs+impl; full build; **DB-fixture seeding + admin role elevation authorized on dev**; `ui-ux-pro-max` installed locally; **F-M1 supersede REVERSED (build the modal); org tables in scope**.

## 2. DONE + committed + GREEN (4 commits this session, branch `docs/auth-overview-consolidated-reference`)
- `32d349f` full build to 39-IA conformance + 5 migrations (102 src files)
- `5997c2c` X-13..X-17 docs validated + impl conformance
- `483f4a2` follow-up wave: R-02/X-07 views + app-shell nav/guards + library finish + A-03 form
- `b9cc970` next-intl i18n infrastructure + pnpm `allowBuilds` fix
- **Verified green via normal pnpm path:** `pnpm -s typecheck` (0), `pnpm -s lint` (0 errors; ~19 pre-existing warnings), `pnpm -s test` (71 files pass / 2 skipped). Working tree CLEAN at `b9cc970`.
- **Migrations APPLIED + VERIFIED on dev** (Supabase ref `fglggyfvzjdsbyckinqa`, `SUPABASE_ENV_LABEL=dev`): subscriptions/subscription_plans(+3 seed)/payment_history; notification_settings/notification_log + `profiles.learning_locale`/`content_prefs`; organizations/org_members/assignments/assignment_submissions; 9 admin/user RPCs + `list_user_problems`; `handle_new_user` display_name. Confirmed by `_verify-migrations.mjs`.
- **Dev fixtures verified:** admin roles elevated (content/org/platform_admin via `_verify-admin-roles.mjs`); writing problems 51-54 published + student `learning_goal` (`_seed-dev-fixtures.mjs`). **PENDING: owner-negative** (2nd learner + cross-owner rows) for E-01/E-02/R-01/F-01/X-05/X-10 RLS evidence — coordinator can seed via service-role (write a `_seed-owner-negative.mjs`).

## 3. Environment / tooling notes (IMPORTANT)
- **pnpm 11.1.3.** Build-script approvals live in `pnpm-workspace.yaml` `allowBuilds` (already resolved: @parcel/watcher/@swc/core=false). If a reinstall nags `ERR_PNPM_IGNORED_BUILDS`, prefix `CI=true`.
- **Coordinator env CAN reach dev Supabase** (read-only verify + service-role seeding work via `node --env-file=.env.local <script>`). **DDL (migrations) CANNOT be applied from coordinator env** (no supabase CLI / DB password) → **USER applies migrations** via `supabase db push` (project linked, dev) or Dashboard SQL Editor. Same for admin role-elevation SQL.
- **Known FLAKY test:** `tests/integration/writing-flow.test.ts > notFound questionId=99` — nondeterministic test-isolation pollution; passes in isolation + on re-run; route guard intact, NOT a regression. (Follow-up: harden integration-test isolation — a learning-flow Supabase mock leaks an unhandled rejection across the shared worker.)
- Stale `next dev` (PID 47864) may hold `.next/dev` locks → run `pnpm exec next typegen` if typecheck shows a stale `routes.d.ts` error.
- "use client" + antd compound components (Typography.Title, Form.Item, etc.) in a server component → prod-only React #130 crash. Always preserve.

## 4. REMAINING WORK — precise next actions (pick a phase; each is a fresh workflow)
1. **Migration EXTENSION + admin finish (small).** Design SQL: (a) `get_admin_org_dashboard` 4th KPI = assignment submission-rate (aggregate `assignments`/`assignment_submissions`); (b) a **create-organization bootstrap RPC** (org RLS blocks the first org — no member yet). USER applies. Then admin follow-up: X-08 assignment-rate wiring, X-10 org-affiliation column + bulk reactivate/role-change. (Files: `supabase/migrations/`, `src/components/admin/**`, `src/app/(workspace)/admin/**`.)
2. **EVIDENCE phase** (needs running app — coordinator may not boot a long server; user help likely). Order: (i) seed owner-negative (coordinator, service-role); (ii) `pnpm build` + start server; (iii) rebuild storageState with the server up (`pnpm test:ia:storage-state --apply`); (iv) `pnpm test:e2e:ia` coverage → 360/768/1280 screenshots for all 39 + admin renders under elevated roles + RLS + i18n ko/en/vi switch; (v) regenerate `ia-implementation-audit.json` (`pnpm test:ia:merge` + `test:ia:validate`). This flips audit labels to PASS.
3. **i18n incremental string migration** — cluster-by-cluster per `docs/ai-workflow/runs/2026/06/02/20260602-i18n-infrastructure-g01.md` (auth→dashboard→practice→writing/feedback→library→growth→profile/settings→subscription→admin→landing leftovers→shared). Each batch: add ko(verbatim)+en+vi keys, swap to `t()`, re-run `tests/lib/i18n/catalog-parity.test.ts`. Page `metadata.title` needs `generateMetadata()`.
4. **Cleanup.** Delete orphaned files AFTER confirming zero importers: `src/components/learning/DashboardContent.tsx`, old `src/components/feedback/FeedbackRecommendationCard.tsx` (singular), `src/components/reports/MetricsTable.tsx`. Apply 2 proposed doc edits (`docs/Wireframe/data-usage-index.md` + `docs/Wireframe/06-C-02-problem-list/functional-spec.md` for `list_user_problems` RPC). Harden the writing-flow test isolation.
5. **External integrations (need USER keys), currently honest stubs:** social OAuth (A-01/A-02), payment gateway (X-03/X-04), email/Zalo send (X-09, X-12/X-06 at scale), real async AI worker (D-M2 + feedback generation, currently mock), share (R-01), problem-asset file upload (H-01), org notify/export (X-08/X-10).
6. **OPEN product decision:** X-07 per-card recommendation paywall lock needs an intermediate paid tier (currently binary free/paid; page hard-gates free users so per-card lock has no tier to express). Needs product/plan-model decision.

## 5. Key artifacts (pointers)
- Audit findings: `reports/ia-verification/runs/20260601-120308/ia-implementation-audit.json` (per-IA labels + topGaps).
- Run-control: same dir → `remediation-run-state.json`, `write-lock-registry.json`, `cross-ia-lifecycle-items.json`, `reconciliation-items.json` (rec-005 F-M1 reversed→build; rec-006 spec decisions), `supabase-fixture-manifest.json`.
- Verify/seed scripts (re-runnable, `node --env-file=.env.local <path>`): `_verify-admin-roles.mjs`, `_seed-dev-fixtures.mjs`, `_verify-migrations.mjs`. Backlog digests: `_digest-discovery.mjs` (190-gap conformance inventory), `_digest-build.mjs` (follow-up remaining).
- i18n plan: `docs/ai-workflow/runs/2026/06/02/20260602-i18n-infrastructure-g01.md`.
- Prior handoffs (chronological): `reports/.../20260601-120308/handoffs/` (preflight-stop → phase0-foundation → phase2-implementation → phase3-fullbuild-scope → **this RESUME**).
- IA-to-specialist routing: `docs/ai-execution-plans/ia-remediation-multi-agent/review-profiles/ia-review-profile-map.json` (39 rows incl. X-13..X-17 if regenerated; currently 34 + the 5 new pages exist as docs).

## 6. Orchestration pattern that worked
Per-cluster agents over disjoint write-lock paths (the 6 audit shards: public-auth, onboarding-dashboard, practice-writing, feedback-reports-recommendations, library-settings-billing, admin — plus practice-components, app-shell, legal, learning for cross-cluster work). Each agent: edit only its paths; wire real data via the migrations/RPCs; stub external legs honestly; propose shared/doc/test/migration changes (coordinator applies); keep typecheck green. Coordinator then runs `pnpm -s typecheck && lint && test`, fixes lint anti-patterns via proper refactor (no rule-disable), reconciles broken tests by root cause (regression vs intended), commits. Workflow template scripts persisted under the session dir.
