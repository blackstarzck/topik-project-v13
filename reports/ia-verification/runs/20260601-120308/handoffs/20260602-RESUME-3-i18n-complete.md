# RESUME HANDOFF v3 — START HERE (i18n COMPLETE; next = browser-verify + reconciliation)

> Self-contained resume point, 2026-06-02. **Supersedes `20260602-RESUME-2-scope-corrected-i18n.md`**
> (that one's "active work = i18n / remaining clusters" is now DONE). Read this one.

## 0. Read order to restore context
1. `CLAUDE.md` — pinned: **Admin out-of-scope (READ FIRST)** + **Data Consistency (User↔Admin)** +
   **7-part development-status format** (use it for status replies; added mid-session by a Codex run).
   Reply in Korean, vibe-coder tone. Ultracode on → Workflow tool for fan-out; verify, don't trust.
2. `docs/admin-scope-boundary.md` + `docs/user-admin-consistency-method.md` (governing directives).
3. This session's ledger (full decision history): `docs/ai-workflow/runs/2026/06/02/20260602-1700-i18n-completion-waves-3plus.md`.
4. Git: `git log --oneline -7` — HEAD should be `96f65e9`, branch `docs/auth-overview-consolidated-reference`, tree clean. Commits NOT pushed (local only; push only when owner asks).

## 1. STATUS — i18n is COMPLETE (all in-scope user-facing clusters)
- **All user-facing UI chrome migrated to next-intl (ko/en/vi).** Catalog `messages/{ko,en,vi}.json`
  = **1318 strings each** (parity enforced, no empties). Waves 1-2 (prior session): auth/dashboard/
  practice. Waves 3-6 (this session): writing/feedback/reports, library/growth, profile/settings/
  subscription/paywall/onboarding, auth-lib/landing/shared/legal + 2 G-01 misses (Hero alt, language metaTitle).
- **Verified GREEN at HEAD `96f65e9`:** typecheck 0, lint 0 err (20 pre-existing warnings), test
  **570 passed / 3 skipped**, `pnpm build` exit 0 (all routes), catalog-parity green.
- **Verification done (no-browser env):** prod build ✓ · translation-completeness static check (only
  the intentional `한국어 (Korean)` remains) ✓ · locale-render smoke test `tests/lib/i18n/locale-render.test.tsx`
  (en/vi actually render, ko absent on switch) ✓.
- This session's commits: `a4ecf2a` `823b11a` `9af245c` `a8daa31` `96f65e9`.

## 2. Remaining live Korean = ALL justified (not unfinished work)
Run `node scripts/i18n/scan-unmigrated.mjs` to re-confirm. The ~36 files it lists are:
admin (24, OUT OF SCOPE/frozen) · `lib/writing/{feedback-service,comparison-service}` (server content
generators → DEFERRED to AI-integration, locale-aware generation not static catalog) · 4 learning
orphans (dead, no importers) · `routes.ts` dead `label:` fields · `ConditionsPanel` dead fallback +
`obj.조건/평가기준` DB-field accessors · `review-set-data.ts` 2 unreachable guard Errors ·
`useUnsavedChangesGuard` DEFAULT_MESSAGE (0 callers). Full accounting in the §1 ledger.

## 3. DEFERRED — needs a running server or humans (owner picked "verify, then resume with server")
- **BROWSER LOCALE-SWITCH VERIFICATION (do this when a dev server is up — owner will help boot it).**
  Steps (`pnpm dev`, then in a browser):
  1. Log in → `/settings/language` → choose **English**, Save → side-nav, app header, dashboard,
     practice/writing/feedback/reports/library/growth/profile/settings/subscription screens re-render
     in English **without a manual reload** (router.refresh path), and `<html lang>` becomes `en`.
  2. Repeat for **Tiếng Việt**.
  3. Anonymous visitor with `NEXT_LOCALE=en` cookie → landing renders in English.
  4. A user whose `profiles.ui_locale=vi` lands in Vietnamese on first authenticated render (profile beats cookie).
  5. No hydration-mismatch warning in console (SSR lang == client locale).
  Memory `feedback-ui-completion-requires-dev-server`: a dev server boot is REQUIRED before claiming
  UI completion — this is the one step the coordinator env could not do.
- **vi native review** — vi is machine-generated; long copy flagged across waves (search the §1
  ledger `viFlagged`: feedback insights, growth, subscription policy, auth.error longer messages, etc.).
- **legal review (strong)** — all `legal.terms.*` / `legal.privacy.*` en+vi must get human/legal
  review before launch (non-binding placeholders today, but don't ship machine-translated legal copy).

## 4. NEXT PHASE (after/with verification) — user↔admin reconciliation
Owner sequence was "finish i18n → reconciliation". i18n is done. Reconciliation has NOT started.
- Method is pinned: `docs/user-admin-consistency-method.md`. The artifact `docs/user-admin-data-consistency.md`
  is built WHEN reconciliation work starts (Phase 0 diagnostic: read `topik-ai/docs/specs/admin-data-contract.md`
  + `admin-data-usage-map.md` + v13 `supabase/migrations/*` → overlapping-entity list + first mismatch
  list + enum glossary). Code-free read+document task; safe to start anytime.
- Admin app repo: `C:\Users\admin\Desktop\workspace\topik-ai` (separate; Vite+React+AntD).

## 5. Environment / tooling notes
- pnpm 11.x. Gates: `pnpm -s typecheck` / `lint` / `test` (testTimeout 20s). `pnpm build` works here
  (one-shot); a long-running `pnpm dev` server does NOT (env kills it) — that's the browser-verify blocker.
- i18n pipeline (proven): 1 Workflow w/ parallel cluster agents → stage `messages/_staging/<cluster>.json`
  → `node scripts/i18n/merge-staging.mjs` → typecheck(casts)/lint → **delete staging FIRST** → full test
  → `scan-unmigrated.mjs` completeness → ko-verbatim + en/vi review → commit. Gotchas in memory
  `project-i18n-migration-progress` (dynamic-key cast, server getTranslations test mock, NO `_staging`
  import in tests, `afterEach(cleanup)` required, no empty-string locale values).
- codex garbles Korean on Windows → use a Claude reviewer for Korean copy (`codex-review-mojibake-windows`).
- `node scripts/ai-workflow-check.mjs --repo .` before final reporting (enforces ledger QA Gate +
  UX/UI Consistency Pass when UI files change).

## 6. Key artifacts + memories
- Ledger: `docs/ai-workflow/runs/2026/06/02/20260602-1700-i18n-completion-waves-3plus.md` (full detail + Final Completeness Accounting).
- i18n infra: `scripts/i18n/{merge-staging,scan-unmigrated}.mjs`, `tests/test-utils/renderWithIntl.tsx`,
  `tests/lib/i18n/{catalog-parity,locale-resolution,locale-render}.test.tsx`, `src/i18n/*`, `messages/*`.
- Auto-memories: `project-admin-scope-boundary`, `project-i18n-migration-progress` (now: all clusters
  done + 5 gotchas), `project-pnpm-build-clobbers-dev-server` (NEW), `project-integration-test-load-timeout-flake`,
  `project-antd-compound-server-component-react130`, `codex-review-mojibake-windows`,
  `feedback-ui-completion-requires-dev-server`, `feedback-report-honesty-cross-audit`.

## 7. UPDATE — browser verification DONE (2026-06-02, post-handoff)

Owner reported a runtime error at `/` ("useTranslations ... NextIntlClientProvider not found") and
asked for full-scope Playwright verification. Findings:

- **ROOT CAUSE of the error = NOT an i18n bug.** A verification-phase `pnpm build` had overwritten the
  shared `.next/` while the owner's `next dev` (Turbopack) server was running → `.next` mixed state
  (prod `BUILD_ID`/manifests + stale `turbopack-*.js`) → `/_next/static/chunks/*` 500 → broken
  hydration surfaced as the next-intl context error. See memory `project-pnpm-build-clobbers-dev-server`.
  **Recovery: stop the dev server → `rm -rf .next` → `pnpm dev`.** (Not yet executed — owner's dev
  server was still live; don't `rm .next` under a running dev server.)
- **PROD is clean (proven):** `pnpm build` + `pnpm start` on a separate port → Playwright over all
  PUBLIC routes (`/`, `/login`, `/sign-up`, `/password-reset`, `/privacy`, `/terms`) × **ko/en/vi**
  = **18/18 pass**: correct-language render, `<html lang>` switches via `NEXT_LOCALE` cookie, 0
  page/console/5xx errors. This is the first real-browser proof the locale switch works end-to-end.
- **Authed workspace routes (student session `tests/e2e/auth-state/student.json`, valid until Jun 8):**
  15/17 render 200 clean. `/dashboard` + `/library` also render fully (200, full content) — earlier
  "timeout" was just `networkidle` never settling (RSC prefetches). Authed pages render in **ko**
  because the test profile's `ui_locale` overrides the cookie (`resolveLocale`: profile → cookie → ko);
  to browser-verify en/vi on authed screens, set the test profile's `ui_locale` (service-role) or use
  a profile with `ui_locale=null`.
- **Two SEPARATE, PRE-EXISTING findings (NOT from i18n string work, NOT yet fixed):**
  1. `/dashboard` React #418 hydration mismatch — from `toLocaleDateString('ko-KR')` in
     `RecentFeedbackCard`/`UpcomingExamCard` (server/client timezone). i18n waves left these date
     calls unchanged. Fix candidate: format dates deterministically (fixed tz/locale) or render
     client-only.
  2. Dashboard recommendation RSC prefetches 404 on problem UUIDs (`33333333…`, `22222222…`) and a
     `/practice` link — seed-data gaps in the test DB, not code bugs.
- New committed regression test: `tests/lib/i18n/locale-render.test.tsx` (en/vi actually render).
