# User ↔ Admin Data Consistency — METHOD (high importance)

> **What this is:** the agreed *method* for keeping v13 user-facing screens
> consistent with the admin app, plus the importance/pin rules. Established
> 2026-06-02 by the project owner (chose "pin the method now; build the actual
> artifact later when user-screen reconciliation work starts").
>
> **What this is NOT:** the filled consistency artifact. That artifact
> (`docs/user-admin-data-consistency.md`) is created LATER, when reconciliation
> work begins — do not build it now.
>
> Read together with [`docs/admin-scope-boundary.md`](admin-scope-boundary.md)
> (admin is owned in a separate repo; do not build/extend admin here).

## Why consistency is a first-class concern

v13 (this repo) is the **user-facing** app. The **admin** app lives in a separate
repo (`C:\Users\admin\Desktop\workspace\topik-ai`) and was built first; the data
**schema was designed admin-first**. User screens therefore must reconcile TO the
existing schema, and user/admin views of the SAME data must agree on field
meanings, status/enum values, and ownership (who may read/write). Drift here is
silent and expensive (e.g. a status enum the user screen doesn't expect, or a
field the admin renames).

## Source-of-truth anchoring (who wins on what)

- **Schema naming / entities / fields / enums / status / audit Target**: the admin
  contract is the design SoT — `topik-ai/docs/specs/admin-data-contract.md`
  (a *candidate* contract; admin has no real migrations) + `admin-action-log.md`.
- **Concrete schema as built**: v13 `supabase/migrations/*` (the only place with a
  real, applied schema). When the admin candidate contract and the v13 migration
  disagree, that is a reconciliation item — decide the canonical per entity; prefer
  adapting the user screen / the doc over changing shared schema, and never change
  shared schema without owner approval.
- **B2C exposure**: `topik-ai/docs/specs/admin-data-usage-map.md` (admin's own map of
  which admin data surfaces to users) — pair v13 user screens against it.
- **Per-page detail**: `topik-ai/docs/page-sync/*.md` (already written to sync with
  user-screen development; each lists related admin/user pages + CRUD candidates).

## Scope: OVERLAP only

The admin domain is far broader than v13 (Users, Community, Message, Operation,
Commerce, Assessment, Content, Analytics, System). Reconcile only the **entities
both apps touch**. Current expected overlap for v13's TOPIK-writing scope:

- Users/회원 ↔ `profiles` (+ auth, app_role, status, plan_label)
- Assessment/문제은행 ↔ `problems` (+ `problem_assets`, publish_status/visibility)
- Writing submissions/feedback ↔ `writing_submissions` / `writing_feedback` / attempts
- Commerce/결제 ↔ `subscriptions` / `payment_history` (if v13 keeps billing)
- (anything a user screen reads that an admin page also writes)

Non-overlapping admin domains (commerce store, community, messaging, system logs,
etc.) are out of scope for v13 reconciliation.

## The planned artifact (build LATER, not now)

When user-screen reconciliation work starts, create
`docs/user-admin-data-consistency.md` with:

1. **Shared-entity table** — one row per overlapping entity:
   `canonical name | admin contract ref | v13 migration + table | user screens (R/W) |
   admin pages (R/W) | agreed fields/status/enum | RLS/ownership | mismatches/decisions`.
2. **Status/enum glossary** — the highest-risk consistency surface. Every shared
   status/enum with its agreed values + where each side uses it (e.g. problem
   `publish_status`, profile `status` active/blocked, submission `feedback_status`).
3. **Open-conflict register** — mirrors `topik-ai/docs/specs/admin-page-gap-register.md`;
   each unresolved naming/semantic/ownership conflict + owner decision.

## Process (when work runs)

1. **Phase 0 — diagnostic (one focused pass):** read the admin contract docs above +
   v13 migrations; produce the overlapping-entity list + the first mismatch list;
   seed the artifact skeleton + the enum glossary.
2. **Per user-screen:** before/while building or reconciling a user screen, check it
   against the artifact; fix mismatches (adapt screen/doc; flag any shared-schema
   change for owner approval); mark the row reconciled + verified.
3. **Final pass:** a verification sweep; the artifact becomes the pinned cross-app SoT.

It is a **living** document (maintained as screens are built), with a final
verification pass — not a single post-hoc audit.

## Importance / pin rules

- This method is **high importance**. Before touching any user screen that reads or
  writes a **shared** entity (the overlap list above), consult this method (and the
  artifact once it exists).
- Do NOT add admin-oriented schema/migrations to reconcile a user screen — reconcile
  the screen TO the schema; escalate genuine schema gaps to the owner.
- Keep terminology aligned with `admin-data-contract.md` so both apps share one
  vocabulary.
