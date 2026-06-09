# Admin Scope Boundary — READ BEFORE TOUCHING ANY admin CODE

> **Authoritative project directive. Established 2026-06-02 by the project owner.**
> This supersedes any earlier handoff / IA-audit instruction that treated admin
> screens (H-01, X-08, X-10, X-15) as in-scope for active build in this repo.

## ✅ 2026-06-09 — v13 admin ISLAND REMOVED (owner decision)

> The owner exercised the "keep vs roll back" call this doc reserved for them
> (see "Current admin code" §). **The entire v13 admin island was removed.**
>
> **New data flow (owner clarification 2026-06-09):** the **admin (topik-ai)** fetches
> problems/questions from an EXTERNAL / third-party API (ALREADY REVIEW-COMPLETE),
> applies the management point (**exposure: public/private**), and **writes them to the
> Supabase DB**. **v13 only READS** that data (read-only consumer). So v13 needs NO
> problem CRUD, NO review workflow, and NO admin user/org management here — those
> belong to the admin (topik-ai), not v13.
>
> **Removed (code + DB):**
> - Code: `src/app/(workspace)/admin/*`, `src/components/admin/*`, `src/lib/admin/*`,
>   `src/lib/auth/admin-guard.ts`, the admin nav in `src/lib/routes.ts`/`SidebarNav`,
>   and the admin tests (`tests/components/admin/*`, `tests/lib/admin/*`,
>   `tests/integration/admin-*`).
> - DB (migration `20260609130000_remove_v13_admin_island.sql`): 11 admin RPCs
>   (`admin_update_problem`/`delete`/`add_asset`/`remove_asset`/`toggle_problem_publish`/
>   `change_user_role`/`set_user_status`/`get_admin_users`/`get_admin_user_stats`/
>   `get_admin_audit_logs`/`get_admin_org_dashboard`), the 4 org tables
>   (`organizations`/`org_members`/`assignments`/`assignment_submissions`), and the org
>   helpers (`private.is_org_member`/`is_org_manager`).
>
> **PRESERVED (load-bearing — the whole app depends on these):** `profiles.app_role`
> (+ 4-role enum), `admin_audit_logs` (table), `private.is_admin`/`is_content_admin`/
> `is_org_admin`/`is_platform_admin` (RLS helpers; `is_platform_admin` alone gates 12
> policies), and all user RPCs/tables.
>
> **Consequence for the topik-ai integration plan**: the plan in
> [`admin-integration-plan.md`](admin-integration-plan.md) assumed topik-ai would
> *reuse v13's admin RPCs* and that v13 problems are admin-authored. Both premises are
> now void for problems (external API source). That plan needs revision before any
> topik-ai↔v13 problem wiring. (Members/payments overlap is unaffected by this change.)
>
> The rest of this document is retained as historical context for the boundary that
> held until 2026-06-09.

## ⚠️ OVERLAP INTEGRATION GATE — OPEN (2026-06-08, owner-approved)

The owner opened the **overlap-only** integration gate. The rule below still holds
for everything EXCEPT the three overlap domains, which are now in active work:

- **Now allowed (overlap only)**: connecting the separate **topik-ai** admin app's
  data/backend to v13's Supabase for **members/profiles**, **problems/question-bank**,
  and **payments (read-only)** — per phased plan A(auth)→B(members)→C(problems)→D(payments).
  topik-ai **UI is NOT ported**; only its data layer reconciles TO v13's schema.
- **Still frozen (do NOT build)**: instructor, referral, coupon, points, community,
  message, operation, system-metadata, analytics — v13 has no schema for these.
  **STOP_AT_ESCALATION_GATE** until a later owner approval.
- **Gate decisions (2026-06-08)**: (1) overlap gate OPEN, start Phase A; (2) D-A role
  model = build a **permission-key layer enforced at RPC/RLS, scoped to shared-entity
  keys only** (v13 keeps its 4 app_roles); (3) dev Supabase connection = **read-first**
  (writes go through audit RPCs, staged). **`withdraw`(탈퇴)→deleted write stays BLOCKED**
  until the owner settles withdraw semantics (D-F). All enum mappings remain **PROPOSED ONLY**.
- **Still forbidden in THIS repo**: adding admin-oriented schema/migrations, building
  admin UI/screens here. The integration code lives in **topik-ai** (separate repo);
  v13 changes are limited to owner-approved **additive** schema/RPC for overlap (a
  separate approval per change, e.g. Phase C columns).
- **Source of truth**: design [`docs/admin-integration-plan.md`](admin-integration-plan.md) §11,
  handoff + confirmation under `docs/ai-workflow/runs/2026/06/08/` (`20260608-handoff-admin-integration.md`,
  `20260608-ch3-facts-confirmation.md`).

## The rule (one line)

**This repo is the USER-FACING app. Do NOT build, extend, or "remediate" admin
features here right now. Admin is owned elsewhere and gets reconciled LATER.**

## Why

1. **Admin has a separate source-of-truth implementation in a different local
   folder/repo.** The admin code that exists in *this* repo is NOT the
   authoritative admin implementation.
2. **The data schema was designed admin-first** — before the user-facing screens,
   and without considering user-facing needs. So the direction is:
   **user-facing screens reconcile TO the existing schema.** Do not reshape the
   schema for user screens, and especially do not add *admin-oriented* schema
   (org tables, admin KPIs/RPCs, etc.).
3. The admin pages' **schema, features, purpose, and expected pages are already
   documented**. Admin ↔ this-repo synchronization is a deliberate **LATER**
   phase, done after all user-facing screens are complete, using that
   documentation. Not now.

## What this means in practice

- **Active scope NOW** = user-facing screens + making them consistent with the
  existing (admin-first) schema.
- **Deferred (do not work on now)**: IA codes **H-01** (admin problem mgmt),
  **X-08** (org admin dashboard), **X-10** (admin user mgmt), **X-15** (admin
  index), and any new admin-oriented migration. If the active docs / a handoff
  tell you to build these, **stop and defer** — this boundary wins.
- **Do not delete the existing admin code either.** See "Current admin code"
  below — it is a safe frozen island. Removal is a decision for the sync phase.
- If a user-facing screen genuinely needs a schema change, treat it as a
  **reconciliation** question (adapt the screen to the schema; only change schema
  with explicit owner approval), not a free-form migration.

## Current admin code in this repo (investigation 2026-06-02)

Verified state so the next session does not have to re-derive it:

- **UI / lib / routes are a self-contained island.** `grep` confirmed **zero**
  non-admin `src/**` files import `@/components/admin/*`, `@/lib/admin/*`, or
  `@/lib/auth/admin-guard`. So freezing or removing the admin UI does not break
  any user-facing feature.
  - Components: `src/components/admin/*` (~20 files: AdminHub, AdminUsersConsole,
    AdminProblem*, AdminOrg*, AdminUser*, admin-rpc.ts, format.ts).
  - Routes: `src/app/(workspace)/admin/{layout,page,problems,org,users}.tsx` +
    `actions.ts`, guarded by `requirePlatformAdmin/ContentAdmin/OrgAdmin`.
  - Lib: `src/lib/admin/*` (queries, server, mutations, server-actions, types,
    org-dashboard) + `src/lib/auth/admin-guard.ts`.
  - The app side-nav (`src/lib/routes.ts` / `SidebarNav`) links the admin routes
    behind role gates — so if you ever DO remove admin UI, drop those nav entries
    in the same change (otherwise dead links).
- **The admin SCHEMA is foundational/shared — do NOT remove it.** `profiles.app_role`,
  `admin_audit_logs`, and the `private.is_*_admin` RLS helpers underpin core auth
  + RLS (e.g. the profile protect-columns admin bypass). These are load-bearing
  for the whole app, not admin-only.
- **Recently-added NET-NEW org schema** — `supabase/migrations/20260602120300_org.sql`
  (organizations / org_members / assignments / assignment_submissions) + the admin
  RPCs in `20260602120400_admin_and_user_rpcs.sql` — were added in a prior session
  under the now-walked-back "full build incl. admin" mandate, and were applied to
  the **dev** Supabase project. They are currently **unused by any user-facing
  feature** (harmless), but they are admin-oriented and should be **reviewed /
  reconciled during the admin sync phase** (keep vs roll back is the owner's call).
  Do not build more on top of them now.

## Admin documentation (the reference for the LATER sync)

- **Admin implementation + its source-of-truth docs live in a separate repo:
  `C:\Users\admin\Desktop\workspace\topik-ai`** (a Vite + React + AntD admin
  console; separate git repo; NOT Next.js). It covers a MUCH broader admin domain
  than v13's user scope: Dashboard, Users, Community, Message, Operation, Commerce,
  Assessment, Content, Analytics, System.
- Key admin SoT docs there (read-only reference for the sync):
  - `docs/architecture/admin-overview.md` — top-level SoT (terms, menu/routes, roles, stack).
  - `docs/specs/admin-data-contract.md` — entity / table-candidate / field / enum / status
    naming contract. NB: admin has NO real migrations — this candidate contract is the
    admin-side schema reference.
  - `docs/specs/admin-data-usage-map.md` — **B2C (user-facing) exposure map** (admin's own
    view of which admin data surfaces to users).
  - `docs/page-sync/*.md` — per-admin-page sync docs, explicitly written to align with
    user-screen development (each lists related admin/user pages + CRUD candidates).
  - `docs/specs/admin-page-gap-register.md`, `admin-action-log.md` (audit Target contract).
- In THIS repo, the admin wireframes are `docs/Wireframe/{21-H-01,30-X-08,32-X-10,37-X-15}/`.
- Reconciliation axis: admin = documented *candidate contract* (no real DB); v13 = concrete
  `supabase/migrations`. The LATER sync aligns the two for OVERLAPPING entities only
  (users/profiles, assessment/problems+writing, etc.) — see the cross-app consistency doc
  when it exists.

## History note

- 2026-06-02: a session extended X-08/X-10 + added an admin-oriented migration
  (`20260602120500_admin_org_extensions.sql`) following the old "full build"
  handoff. On the owner clarifying this boundary, that work was **reverted**
  (commit reverting `0ac3c9c`); the migration was never applied.
