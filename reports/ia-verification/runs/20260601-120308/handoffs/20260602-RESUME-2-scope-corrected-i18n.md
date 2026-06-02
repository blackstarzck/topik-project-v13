# RESUME HANDOFF v2 — START HERE (scope-corrected; active work = i18n)

> Self-contained resume point, 2026-06-02. **Supersedes** the earlier
> `20260602-RESUME-fresh-session.md` (that one's "full build incl. admin" roadmap is now
> partly WRONG — see §1). Read this one.

## 0. Read order to restore context
1. `CLAUDE.md` — note the two NEW pinned sections at the top: **"Scope Boundary — Admin (READ FIRST)"** and **"Data Consistency (User ↔ Admin)"**. User replies in **Korean, vibe-coder tone**. Ultracode is on → use the Workflow tool for substantive fan-out; verify everything (don't trust agent self-reports). Fail closed on doc conflicts / secrets / prod / missing approval.
2. `AGENTS.md` (admin-boundary non-negotiable rule added).
3. `docs/admin-scope-boundary.md` + `docs/user-admin-consistency-method.md` (the two governing directives from this session).
4. This session's run ledger (full decision history): `docs/ai-workflow/runs/2026/06/02/20260602-1300-ia-autonomous-cleanup-migration-i18n.md`.
5. `docs/ai-development-workflow.md`.
6. Git: `git log --oneline -8` (HEAD should be `c83c789`, branch `docs/auth-overview-consolidated-reference`, tree clean).

## 1. CRITICAL — what changed this session (scope pivots)
- **ADMIN IS OUT OF SCOPE for this repo.** The real admin app lives in a separate repo:
  `C:\Users\admin\Desktop\workspace\topik-ai` (Vite+React+AntD; rich SoT docs under its
  `docs/specs/` + `docs/page-sync/`). This repo (v13) is the **user-facing** app. The schema
  was designed admin-first; user screens reconcile TO it. **Do NOT build/extend/remediate
  admin (IA H-01/X-08/X-10/X-15) or add admin-oriented migrations.** Do NOT delete the
  existing (frozen, self-contained) admin code either. Full detail: `docs/admin-scope-boundary.md`.
  - This SUPERSEDES the old RESUME handoff + IA-audit "full build incl. admin / org tables".
  - This session BUILT admin X-08/X-10 + a migration (`0ac3c9c`) then **REVERTED it** (`f9eee78`)
    when the owner clarified the boundary. The migration `20260602120500_admin_org_extensions.sql`
    was NEVER applied. Do not resurrect it.
  - Dev-DB note: a PRIOR session already applied org tables (`20260602120300_org.sql`) + admin
    RPCs (`20260602120400`) to the dev Supabase. They are unused by user features (harmless);
    keep-vs-rollback is the owner's call during the future admin-sync phase.
- **User↔Admin data-consistency METHOD is pinned** (`docs/user-admin-consistency-method.md` +
  CLAUDE.md). The filled artifact `docs/user-admin-data-consistency.md` is built **LATER**, when
  user-screen reconciliation work starts (owner choice: "pin method now, build artifact later").
  Do NOT build that artifact pre-emptively.

## 2. DONE this session + committed + GREEN (branch `docs/auth-overview-consolidated-reference`)
Commits a0579fd..HEAD (newest first):
- `c83c789` i18n wave 2 — dashboard + practice clusters (ko/en/vi)
- `45a3f02` i18n wave 1 — auth cluster (ko/en/vi)
- `4b28335` consistency METHOD pinned
- `fd91474` admin repo path recorded
- `20f8b0d` admin out-of-scope boundary pinned
- `f9eee78` REVERT of Phase B admin build
- `0ac3c9c` Phase B admin build (reverted by f9eee78 — ignore)
- `4c41921` cleanup wave (3 orphans deleted, list_user_problems docs synced, flaky-test fix)

**Verified GREEN at HEAD:** typecheck 0, lint 0 errors (20 pre-existing warnings), test 72 files
/ **509 passed** / 3 skipped. Working tree clean.

Also done in `4c41921` (cleanup, still valid — NOT admin):
- Deleted orphans: `learning/DashboardContent.tsx`, `feedback/FeedbackRecommendationCard.tsx`
  (singular), `reports/MetricsTable.tsx` (zero importers).
- Synced `list_user_problems` RPC into C-02 functional-spec + data-usage-index.
- Fixed the flaky integration timeout: root cause was load-induced 5s test timeouts (NOT a
  rejection leak as the old handoff guessed) → `vitest.config.ts testTimeout: 20000`. See memory
  `project-integration-test-load-timeout-flake`.

## 3. ACTIVE WORK = i18n (resume here). Owner: "finish i18n, then start reconciliation."
Migrate user-facing Korean UI strings to next-intl `t()` across ko/en/vi, in waves.
**Admin cluster EXCLUDED** (per §1).

- **DONE clusters:** auth (144 keys), dashboard (39), practice (210). Catalogs
  `messages/{ko,en,vi}.json` = **476 strings each** (parity enforced by
  `tests/lib/i18n/catalog-parity.test.ts`).
- **REMAINING clusters (next waves):** writing + feedback + reports (D/E/R-01); library (F-01);
  growth (X-02); profile + settings (X-05/X-09 — note `settings.language` already done in G-01);
  subscription/paywall (X-03/X-04); landing leftovers (FeatureCard, ProductPreview, page copy);
  shared/system (`src/components/shared/*`, legal pages, route `metadata.title`).
- **AUTH lib gap (follow-up):** `src/lib/auth/error-mapping.ts` (REASON_CONTENT — error-card body +
  `{message}` toasts), `password-strength.ts` labels, `use-email-cooldown.ts` countdown are
  cross-cutting libs still in Korean (out of the auth-component scope). Migrate error-mapping.ts so
  the auth error card + toasts fully localize.

### How to run a wave (proven pipeline — see memory `project-i18n-migration-progress`)
1. Spawn 1 Workflow with N parallel agents, one per cluster, **disjoint write paths**. Each agent:
   migrates its own source + tests to `t()`/`getTranslations`, and WRITES its catalog to
   `messages/_staging/<cluster>.json` (nested namespaces; each leaf = `{ "ko":..,"en":..,"vi":.. }`,
   ko VERBATIM). Agents do NOT edit `messages/{ko,en,vi}.json` and do NOT self-typecheck (fails
   pre-merge — expected). Reuse `common.*` keys where identical. Reference an already-migrated
   example (e.g. `src/components/auth/LoginForm.tsx` client, `src/app/login/page.tsx` server).
   **Avoid `${...}` in the agent-prompt template-literal strings** (it interpolates as JS and the
   script throws — write `{N}` not `${N}`).
2. Coordinator merges: `node scripts/i18n/merge-staging.mjs` (merges staging → 3 catalogs;
   fails closed on malformed leaves).
3. Coordinator verifies: `pnpm -s typecheck` (fix the 2 gotchas below), `pnpm -s test` (full),
   spot-check ko-verbatim + en/vi.
4. `rm -rf messages/_staging` (do NOT commit it); check `next-env.d.ts` not flipped
   (`git checkout next-env.d.ts` + `pnpm exec next typegen` if it did); update the ledger
   (incl. QA Gate + UX/UI Consistency Pass fields — required for UI changes), commit.

### Two gotchas the coordinator MUST fix after merge (agents can't catch them)
- **Dynamic keys:** `t(map[var])` / `` t(`a.${x}.b`) `` are `string`-typed → next-intl strict typing
  rejects them even though the key exists. Cast: `as Parameters<typeof t>[0]`.
- **Server-page getTranslations in integration tests:** an integration test that imports a page
  migrated to `getTranslations` throws "not supported in Client Components" in jsdom. Add to that
  test: `vi.mock("next-intl/server", () => ({ getTranslations: async () => (k)=>k, getLocale: async()=>"ko" }))`.
- Shared test helper: `tests/test-utils/renderWithIntl.tsx` (NextIntlClientProvider ko + antd App).
  Page `metadata.title` → `generateMetadata()`.

### Honest caveats (state these in any completion claim)
- **QA Gate: degraded** — coordinator env cannot boot a dev server. Unit tests verify the ko render
  (ko is verbatim, so ko output unchanged), but **live-browser en/vi rendering + the locale switch
  are UNVERIFIED** — defer to the evidence phase.
- **vi is machine-generated.** Short labels high-confidence; longer copy (e.g.
  `practice.weakness.insights.*`) flagged for **native review**.

## 4. Deferred / blocked (NOT this repo's active work now)
- Evidence phase (screenshots/RLS/locale-switch) — needs a running server + likely owner help.
- External integrations (OAuth/payment/email/Zalo/AI/share/file-upload) — need provider keys.
- X-07 per-card paywall tier — product decision.
- Admin ↔ repo sync — LATER phase, after user screens are done (per the consistency method).

## 5. Environment / tooling notes
- **pnpm 11.x.** `pnpm -s typecheck` / `lint` / `test` are the gates. testTimeout now 20s.
- **Coordinator env CANNOT** boot a long dev server or apply DB migrations (no DDL creds). It CAN
  reach dev Supabase read-only / service-role via `node --env-file=.env.local <script>`.
- **codex cross-model review garbles Korean on Windows** (memory `codex-review-mojibake-windows`):
  use codex for ASCII (SQL/TS logic), a Claude reviewer for Korean copy.
- antd compound components must stay in `"use client"` components (prod React #130 risk).
- Run `node scripts/ai-workflow-check.mjs --repo .` before final reporting (it enforces ledger
  QA Gate + UX/UI Consistency Pass fields when UI files change).

## 6. Key artifacts + memories
- Run ledger: `docs/ai-workflow/runs/2026/06/02/20260602-1300-ia-autonomous-cleanup-migration-i18n.md`.
- Directives: `docs/admin-scope-boundary.md`, `docs/user-admin-consistency-method.md`.
- i18n infra: `tests/test-utils/renderWithIntl.tsx`, `scripts/i18n/merge-staging.mjs`,
  `src/i18n/*`, `messages/{ko,en,vi}.json`, i18n plan
  `docs/ai-workflow/runs/2026/06/02/20260602-i18n-infrastructure-g01.md`.
- Auto-memories (loaded each session): `project-admin-scope-boundary`,
  `project-i18n-migration-progress`, `project-integration-test-load-timeout-flake`,
  `project-wireframe-inventory-blueprint-gotcha`, `codex-review-mojibake-windows`,
  `feedback-ui-completion-requires-dev-server`, `feedback-report-honesty-cross-audit`.
