# RESUME HANDOFF v4 — START HERE (i18n CLOSED; next phase = user↔admin reconciliation)

> Self-contained resume point, 2026-06-02. **Supersedes `20260602-RESUME-3-i18n-complete.md`.**
> i18n is done + verified (incl. the runtime-error fix). This session starts the **user↔admin
> data-consistency (reconciliation)** phase — specifically **Phase 0 (diagnostic)**.

## 0. Read order to restore context (do this first)
1. `CLAUDE.md` — pinned sections: **"Scope Boundary — Admin (READ FIRST)"**, **"Data Consistency
   (User ↔ Admin)"**, and the **7-part development-status format** (use it for every user-facing
   status reply). Reply in **Korean, vibe-coder tone**. Ultracode is on → use the **Workflow** tool
   for substantive fan-out; **verify, don't trust** agent self-reports. Fail closed on doc conflicts /
   shared-schema changes / missing owner approval.
2. `docs/user-admin-consistency-method.md` — **the governing METHOD for this phase. Re-read fully.**
3. `docs/admin-scope-boundary.md` — admin is owned in a separate repo; **do NOT build/extend/delete
   admin code in v13.** Reconciliation = reading admin docs + reconciling USER screens/docs to the
   existing schema. It is NOT "build admin".
4. Run ledger (full history of i18n + this work): `docs/ai-workflow/runs/2026/06/02/20260602-1700-i18n-completion-waves-3plus.md`.
5. `AGENTS.md` + `docs/ai-development-workflow.md` (workflow gates, ledger rules).
6. Git: `git log --oneline -6`. HEAD = `2783fe3`, branch `docs/auth-overview-consolidated-reference`,
   tree clean. Commits are **local only** (not pushed); push only when the owner asks.

## 1. STATUS — i18n is DONE + browser-verified (do not redo)
- All user-facing UI chrome migrated to next-intl (ko/en/vi); catalog `messages/{ko,en,vi}.json` =
  **1318 strings each** (parity, no empties). Commits `a4ecf2a`→`2783fe3`.
- Verified in a real browser: public routes 18/18 (ko/en/vi); authed workspace routes 11/11 in en
  AND 11/11 in vi; `<html lang>` switches; 0 errors. Prod build + dev (Turbopack) both clean.
- The owner-reported `/` runtime error ("NextIntlClientProvider context not found") was fixed:
  root cause = **missing next-intl global `timeZone`** (now `DEFAULT_TIME_ZONE="Asia/Seoul"` in
  `src/i18n/locales.ts`, wired into `getRequestConfig` + `NextIntlClientProvider` + `renderWithIntl`).
  Also fixed a pre-existing dashboard React #418 (raw `toLocaleString` day-period) via tz+`hour12:false`.
- GREEN: typecheck 0, lint 0 err (20 pre-existing warnings), test 570 pass / 3 skip.
- **Open i18n follow-ups (NOT reconciliation — track separately):**
  - In-app locale **Save button** (`/settings/language`) live browser check (router.refresh path) —
    I verified locale switching via cookie/profile, not the Save click.
  - **vi** machine-translated long copy → native review; **legal** (`legal.terms.*`/`legal.privacy.*`)
    en+vi → legal review before launch.
  - `.next` was left clean and all local dev servers stopped — `pnpm dev` starts fresh.

## 2. THIS PHASE — user↔admin reconciliation (Phase 0 diagnostic)
The owner sequenced this AFTER i18n ("finish i18n → reconciliation"). The METHOD is pinned in
`docs/user-admin-consistency-method.md`; the filled ARTIFACT is built **now** (this is when the
method's "build later" arrives). **Do NOT skip reading the method doc.**

**Phase 0 deliverable** (per the method's "Process → Phase 0"): create
`docs/user-admin-data-consistency.md` with:
1. **Shared-entity table** — one row per overlapping entity: `canonical name | admin contract ref |
   v13 migration+table | user screens (R/W) | admin pages (R/W) | agreed fields/status/enum |
   RLS/ownership | mismatches/decisions`.
2. **Status/enum glossary** — every shared status/enum + agreed values + where each side uses it
   (highest-risk surface: e.g. problem `publish_status`/visibility, profile `status` + `app_role`,
   submission/feedback status, subscription/payment status, cadence).
3. **Open-conflict register** — mirror `topik-ai/docs/specs/admin-page-gap-register.md`; one row per
   unresolved naming/semantic/ownership conflict + owner decision.
Phase 0 = produce the overlapping-entity list + the FIRST mismatch list + seed the skeleton + the
enum glossary. (It's a LIVING doc; per-screen reconciliation + a final verification pass come later.)

## 3. INPUTS (all verified to exist 2026-06-02)
- **Admin SoT (read-only reference) — separate repo `C:\Users\admin\Desktop\workspace\topik-ai`:**
  - `docs/specs/admin-data-contract.md` — entity/table-candidate/field/enum/status naming contract
    (admin has NO real migrations → this candidate contract is the admin-side schema SoT). **Anchor
    all naming here.**
  - `docs/specs/admin-data-usage-map.md` — admin's B2C (user-facing) exposure map.
  - `docs/specs/admin-page-gap-register.md`, `admin-action-log.md`, `admin-page-tables.md`.
  - `docs/page-sync/*.md` — per-admin-page sync docs (built to align with user-screen dev; each lists
    related admin/user pages + CRUD candidates). Most relevant to v13 overlap: `assessment-question-bank*`,
    `commerce-payments`, `commerce-refunds`, plus any users/members page-sync.
  - `docs/architecture/admin-overview.md`, `admin-data-source-transition.md`.
- **v13 concrete schema (the only real, applied schema):** `supabase/migrations/*.sql` (+ `INDEX.md`).
  Verified the overlap entities are present: `profiles` (+`app_role`,`ui_locale`,`status`),
  `problems`, `writing_submissions`, `writing_feedback`, `subscriptions`, `payment_history`
  (billing in `20260602120100_billing.sql`).
- **Expected overlap (from the method doc) to reconcile:** Users/회원 ↔ `profiles`; Assessment/문제은행
  ↔ `problems`(+assets/publish_status/visibility); Writing submissions/feedback ↔
  `writing_submissions`/`writing_feedback`/attempts; Commerce/결제 ↔ `subscriptions`/`payment_history`.
  Non-overlapping admin domains (store/community/messaging/system logs) are OUT of v13 scope.

## 4. GUARDRAILS (fail closed)
- **Do NOT change shared schema to make a user screen work.** Reconcile the screen/doc TO the existing
  schema; escalate genuine schema gaps to the owner for approval. Never alter shared
  status/enum/field meanings without owner sign-off.
- **Admin code in v13 stays frozen** (don't build/extend/delete). Reconciliation touches: the new
  consistency artifact (docs), and — only when per-screen work starts — user-facing screens/docs.
- **Phase 0 is read + document only** (no code changes). Safe to start autonomously.
- Open item for the owner during this phase: the net-new org schema
  (`supabase/migrations/20260602120300_org.sql` + admin RPCs `20260602120400`) was applied to the dev
  DB by a prior session but is unused by user features — keep-vs-rollback is the owner's call. Surface
  it; don't act unilaterally.

## 5. Environment / tooling / workflow
- pnpm 11.x. Gates: `pnpm -s typecheck` / `lint` / `test` (testTimeout 20s). Phase 0 is docs-only
  (no code), so the main gate is doc accuracy + owner review on conflicts.
- Create a NEW run ledger under `docs/ai-workflow/runs/2026/06/02/` (or the current date) from
  `docs/ai-workflow/templates/context-ledger-template.md`. Run `node scripts/ai-workflow-check.mjs
  --repo .` before final reporting.
- codex garbles Korean on Windows (`codex-review-mojibake-windows`) → use a Claude reviewer for any
  Korean copy/judgement; codex is fine for ASCII (SQL/enum names).
- Reconciliation reads a SEPARATE repo's docs — read-only; don't write into `topik-ai`.

## 6. Key artifacts + memories
- Method: `docs/user-admin-consistency-method.md`. Boundary: `docs/admin-scope-boundary.md`.
- Artifact to CREATE: `docs/user-admin-data-consistency.md` (does not exist yet — Phase 0 creates it).
- Auto-memories: `project-admin-scope-boundary`, `project-i18n-migration-progress` (i18n done +
  6 gotchas incl. global timeZone), `project-pnpm-build-clobbers-dev-server`,
  `project-integration-test-load-timeout-flake`, `project-antd-compound-server-component-react130`,
  `project-wireframe-inventory-blueprint-gotcha`, `codex-review-mojibake-windows`,
  `feedback-ui-completion-requires-dev-server`, `feedback-report-honesty-cross-audit`,
  `feedback-docs-only-gate-rightsizing`, `feedback-env-active-vs-rotation-comment`.
