# Context Ledger — i18n completion (waves 3+) — finish user-facing string migration

## Run Metadata

- Run id: 20260602-1700-i18n-completion-waves-3plus
- Created: 2026-06-02
- Updated: 2026-06-02
- Main session owner: Claude Code (Opus 4.8 1M) — coordinator + durable context owner
- Host: Claude Code
- Parent run: `docs/ai-workflow/runs/2026/06/02/20260602-1300-ia-autonomous-cleanup-migration-i18n.md`
- Resume source: `reports/ia-verification/runs/20260601-120308/handoffs/20260602-RESUME-2-scope-corrected-i18n.md`
- Status: COMPLETE — waves 3-6 done (writing/feedback/reports → library/growth →
  profile/settings/learning → auth-lib/landing/shared/legal). All in-scope user-facing UI chrome
  migrated to next-intl (ko/en/vi); catalog 1318 strings ×3 (parity). Admin EXCLUDED (out of scope).
  Remaining live Korean is all accounted-for/justified (see Final Completeness Accounting).
  Deferred to evidence phase: live-browser en/vi render + locale switch (no dev server here).

## Task

- User goal: "finish i18n" — migrate all REMAINING user-facing Korean UI strings to next-intl
  `t()`/`getTranslations` across ko/en/vi, in waves, then start user↔admin reconciliation.
- Accepted scope (this run): all in-scope unmigrated clusters (see Active Files). Each string →
  ko VERBATIM + en + vi (vi machine-gen, flagged for native review), guarded by
  `tests/lib/i18n/catalog-parity.test.ts`. Parallel cluster agents (disjoint write paths) stage
  catalogs to `messages/_staging/<cluster>.json`; coordinator merges + fixes typing gotchas +
  verifies + commits per wave.
- Out of scope:
  - **Admin cluster** (`src/components/admin/*`, `src/app/(workspace)/admin/*`, `admin/format.ts`) —
    frozen/out-of-scope per `docs/admin-scope-boundary.md`.
  - **Dead-code orphans** (no importer): `src/components/learning/{KpiSummary,AlertsCard,
    EmptyDashboard,RecommendationCard}.tsx` — do NOT migrate (waste on dead code); flagged for a
    future cleanup task (live dashboard uses `dashboard/DashboardKpiSummary`+`DashboardAlertsCard`).
  - Browser/locale-switch evidence (no dev server in coordinator env), external integrations.

## Docs Consulted

- Exact files read:
  - `CLAUDE.md` (admin boundary + consistency pins + Korean tone), `AGENTS.md`.
  - `docs/admin-scope-boundary.md`, `docs/user-admin-consistency-method.md`.
  - Resume handoff `20260602-RESUME-2-scope-corrected-i18n.md`.
  - Parent ledger `20260602-1300-ia-autonomous-cleanup-migration-i18n.md`.
  - i18n infra plan + remaining-migration plan `20260602-i18n-infrastructure-g01.md`.
  - `scripts/i18n/merge-staging.mjs`, `messages/ko.json`.
  - Source samples for scope verification (LoginForm/DashboardHeader/ProblemListView comments;
    `lib/auth/error-mapping.ts`; `legal/TermsContent.tsx`; routes.ts; learning importers).
- Extracted requirements:
  - ko strings VERBATIM (keep unit tests green); en natural; vi machine-gen flagged.
  - Non-component `.ts` modules (error-mapping, lib/writing services, *-data.ts) can't call
    `useTranslations` → expose KEYS/constants, resolve `t()` at the rendering component
    (wave-2 `validateSearch → reasonKey` precedent).
  - Coordinator must fix 2 post-merge gotchas agents can't: (1) dynamic-key casts
    `as Parameters<typeof t>[0]`; (2) `next-intl/server` mock in integration tests importing a
    `getTranslations` server page. Page `metadata.title` → `generateMetadata()`.
- Doc conflicts: none new.
- Untouched relevant docs and reason: `docs/prd.md`, `docs/spec.md`, `docs/flow/user-flow.md` —
  no product/flow change (pure string externalization).

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 2026-06-02T17:00Z | Verified GREEN-baseline + scope by scan, NOT by trusting handoff | honesty rule; `scripts/i18n/scan-unmigrated.mjs` counts Korean on non-comment lines → true unmigrated set (113 files; minus admin/orphans = in-scope). Confirmed auth/dashboard/practice "DONE" = real (leftover Korean there is comments only). | scan |
| 2026-06-02T17:05Z | learning/{KpiSummary,AlertsCard,EmptyDashboard,RecommendationCard} = orphans → skip migrate | grep: zero importers in src (only self-definitions). Live dashboard uses dashboard/* equivalents. Migrating dead code is waste; deletion is a separate cleanup task. | grep |
| 2026-06-02T17:05Z | Legal pages (Terms/privacy) = safe to machine-translate | code comments declare them non-binding pre-legal-review placeholders, replaced before launch → standard vi-flag, no special escalation. | TermsContent.tsx |
| 2026-06-02T17:40Z | WAVE 3 (writing+feedback+reports) DONE + GREEN | 1 Workflow, 3 parallel agents (disjoint paths). writing 129 keys / 13 comp + 3 pages; feedback 94 / 10 comp; reports 49 / 5 comp + 1 page. 272 keys merged (catalog 476→748 ×3, parity held). 4 existing tests → renderWithIntl + 3 new chrome tests. Coordinator fixes: 1 dynamic-key cast (DetailedFeedbackPanel `label.${k}`); 1 parity fail (reports.kpi.suffixCount en was "" → "categories", coherent with title "Changed categories"). Verified: typecheck 0, lint 0 err, test 530 pass/3 skip; scan clean (only justified leftovers); ko verbatim independently confirmed (34 strings byte-for-byte; 28 verifier hits were tokenization artifacts + DB-keys); en/vi coordinator-reviewed, no gross errors. | this run |
| 2026-06-02T17:40Z | DEFER service-layer content generators (NOT migrate now) | `src/lib/writing/feedback-service.ts` + `comparison-service.ts` synthesize Korean feedback/comparison PROSE consumed by feedback/reports screens. These are placeholder content generators for the DEFERRED AI feature; localizing generated prose via static ICU catalog is wrong architecture (real fix = locale-aware generation when AI lands). Agents flagged them in serviceLayerStrings; left untouched per scope. Component CHROME around them is fully localized; null-fallbacks externalized. | agent flags + coordinator |
| 2026-06-02T17:40Z | Keep ConditionsPanel 3 Korean lines | Verified: defaultWeightFormatter ko fallback (line 31) never renders — component always injects `(w)=>t("weightSuffix",{weight})` at line 108. `obj.조건`/`obj.평가기준` (lines 70/72) are Korean-named DB-field accessors for the admin-first rubric JSON (data contract, not UI). Correct to leave. | code read |
| 2026-06-02T18:10Z | WAVE 4 (library+growth) DONE + GREEN | 1 Workflow, 2 parallel agents. library 140 keys / 10 comp + 1 page + library-enrich-data (statusBadge→{labelKey,color}); growth 72 keys / 4 comp + insights.ts (key-expose) + 1 page. 212 keys merged (catalog 748→960 ×3, parity). 3 new chrome tests + ExportPdfButton test updated. Verified: typecheck 0 (no extra casts needed — agents applied them), lint 0 err, test 542 pass/3 skip; scan clean (only review-set-data.ts 2 guards); ko verbatim confirmed (20 strings); en/vi reviewed (ICU + next-intl rich-text `<plan>` tag preserved across locales). | this run |
| 2026-06-02T18:10Z | FIX wave-3 regression: 4 Chrome tests imported ephemeral messages/_staging/ | ReportsChrome (committed in a4ecf2a) + GrowthChrome/LibraryChrome/ExportPdfButton imported `messages/_staging/<x>.json` (the agents' "flatten staged leaves" test pattern). Staging is deleted before commit → committed test referenced a missing file (wave-3 a4ecf2a left ReportsChrome broken-in-isolation; only undetected because I deleted staging AFTER the wave-3 test run). FIX: repoint all 4 tests to the merged `messages/ko.json`. PROCESS FIX: now delete staging BEFORE the full-test gate (not after), so a staging dependency fails the gate. Verified test 542 pass with staging absent. | this run |
| 2026-06-02T18:10Z | Keep review-set-data.ts 2 Korean Error throws | "선택한 항목이 없습니다"/"로그인이 필요합니다" are defensive guards in a non-component data module; practically unreachable (create button disabled when nothing selected; RLS+requireUser gate auth server-side). Surfaced only via err.message fallback. Externalizing (sentinel error + component t()) is wasted effort on dead paths. Flagged, left. | agent flag + coordinator |
| 2026-06-02T18:40Z | WAVE 5 (profile + settings/subscription/paywall + learning/onboarding) DONE + GREEN | 1 Workflow, 3 parallel agents. profile 70 keys; settings/subscription/paywall 139 (settings.notifications + subscription + paywall; billing-data cadenceLabel→cadenceLabelKey key-expose); learning-onboarding 46 (dashboard.recentFeedback/upcomingExam extend existing dashboard ns + new onboarding ns; avatar-upload + zod-message + weak-area key-expose). 255 keys merged (catalog 960→1216 ×3, parity). Tests all read messages/ko.json (staging-import lesson held — 0 staging refs). Reused common.save/cancel. typecheck 0 (all casts applied by agents), lint 0 err, test 555 pass/3 skip (staging deleted FIRST). scan clean (only the 4 orphans + G-01 language-page false-positive). ko verbatim confirmed (17 strings). en/vi reviewed, high quality, ICU preserved. PURE string externalization — no subscription/payment/profile status/enum/plan VALUE changed (shared-entity semantics intact; consistency-safe). | this run |

| 2026-06-02T19:10Z | WAVE 6 (FINAL: auth-lib + landing + shared + legal) DONE + GREEN | 1 Workflow, 4 parallel agents. auth-lib 41 keys (REASON_CONTENT → locale-free data + auth.error.<reason>.*; 5 message consumers updated; use-email-cooldown label→auth.cooldown.label; password-strength dead duplicate labels REMOVED — live labels already in auth.strength.* from wave 1; updated error-mapping.test.ts). landing 21 (ProductPreview + page.tsx generateMetadata; FeatureCard had no Korean). shared 8 (shared.error/notFound/loading/unsavedGuard; AppNotFound+AppLoading converted server→client). legal 30 (legal.terms.*/privacy.*; ALL flagged for legal+native review). 100 keys merged. | this run |
| 2026-06-02T19:15Z | FINAL completeness scan caught 2 real misses from wave-1/G-01 "DONE" | (1) `Hero.tsx` hardcoded `alt="TALKPIK 학습 도우미 캐릭터"` (a11y) → `t("heroMascotAlt")`; (2) `settings/language/page.tsx` static `metadata.title:"언어 설정 — TALKPIK"` → async `generateMetadata()` + `settings.language.metaTitle`. Added 2 keys ×3 locales. Confirms value of the full-repo scan over trusting prior "DONE". Catalog 1216→1318 ×3. | full-repo scan |
| 2026-06-02T19:15Z | NOTE: shared agent made AppNotFound+AppLoading client components | The ONLY non-"string-literal→t()" change in the whole effort: AppNotFound.tsx + AppLoading.tsx went server→client ("use client" + useTranslations), matching AppError (already client). Valid (client comps render fine as not-found UI / loading Suspense fallback); typecheck + tests green; aligns with the antd-compound-in-server-component React #130 caution. Runtime render of /not-found + loading deferred to evidence phase. | agent + coordinator |

## Final Completeness Accounting (whole-repo scan after wave 6)

36 files still contain live Korean — EVERY one accounted for:
- **24 admin files** (`src/components/admin/*`, `src/app/(workspace)/admin/*`) — OUT OF SCOPE (frozen per `docs/admin-scope-boundary.md`).
- **2 service-layer content generators** (`src/lib/writing/feedback-service.ts`, `comparison-service.ts`) — DEFERRED to AI-integration (locale-aware generation, not static catalog).
- **4 dead orphans** (`learning/{KpiSummary,AlertsCard,EmptyDashboard,RecommendationCard}`) — no importers; future cleanup, not i18n.
- **4 justified non-UI**: `lib/routes.ts` (dead `label:` fields; live nav uses `labelKey`+t()), `writing/ConditionsPanel.tsx` (dead formatter fallback + Korean DB-field accessors 조건/평가기준), `library/review-set-data.ts` (2 unreachable guard Errors), `hooks/useUnsavedChangesGuard.ts` (DEFAULT_MESSAGE fallback; ZERO callers; key exposed for future use).
- = ALL in-scope user-facing UI chrome is migrated. No unjustified Korean remains.

## Active Files

- In-scope clusters (migrate; disjoint agent write-paths):
  - **Wave 3 — writing**: `src/components/writing/*` (LongFormEditor, AutosaveWarningModal,
    SubmissionConfirmModal, HelpPanel, ConditionsPanel, WritingEditor, EssayChecklist, AutosaveBadge,
    ChecklistRow, ManuscriptPreview, WritingPageContent, ReferenceMaterials, QuestionPrompt,
    SectionEditor) + `src/app/(workspace)/writing/**/page.tsx` + `src/lib/writing/*`
    (feedback-service, comparison-service, types, constants, server) [key-expose pattern].
  - **Wave 3 — feedback**: `src/components/feedback/*` (FeedbackRecommendationCards,
    AnalysisLoadingModal, DetailedFeedbackPanel, DimensionCardGrid, NextActionBar, SaveToLibraryButton,
    SentenceFeedbackList, FeedbackPageContent, FeedbackSummary, AnalysisCharacter).
  - **Wave 3 — reports**: `src/components/reports/*` (ScoreComparisonChart, ComparisonReportView,
    DimensionComparisonCards, ComparisonKpiBlock, SubmissionDiffPanel) + compare page.
  - **Wave 4 — library**: `src/components/library/*` + `src/app/(workspace)/library/page.tsx`.
  - **Wave 4 — growth**: `src/components/growth/*` + `src/app/(workspace)/growth/page.tsx`.
  - **Wave 5 — profile**: `src/components/profile/*` + profile page.
  - **Wave 5 — settings/subscription/paywall**: `src/components/settings/{SubscriptionShell,
    NotificationPrefsForm,PaywallShell,billing-data,learning-settings-data}` + subscription/paywall/
    notifications pages.
  - **Wave 5 — learning-live + onboarding**: `learning/{RecentFeedbackCard,UpcomingExamCard,
    LearningGoalForm}` + onboarding/learning-goal/*.
  - **Wave 6 — auth-lib-gap**: `src/lib/auth/error-mapping.ts` (REASON_CONTENT → keys), `src/components/auth/password-strength.ts`, `src/lib/auth/use-email-cooldown.ts`.
  - **Wave 6 — landing+shared+legal**: `landing/{ProductPreview,FeatureCard}`, `src/app/page.tsx`,
    `shared/{AppError,AppNotFound,AppLoading}`, `legal/TermsContent.tsx`, `app/{privacy,terms}/page.tsx`.
- Files explicitly NOT to touch: `src/components/admin/*`, `src/app/(workspace)/admin/*`,
  `src/components/admin/format.ts`, the 4 learning orphans, `supabase/migrations/*`, env/secrets.

## Verification State

- Baseline (2026-06-02, this session, VERIFIED): typecheck 0, lint 0 err (20 pre-existing warnings),
  test 72 files / 509 pass / 3 skip. (= prior HEAD c83c789 state.)
- Per-wave gate: merge-staging → typecheck (fix casts) → lint → full test → catalog-parity →
  ko-verbatim + en/vi copy review (Claude reviewer; codex garbles Korean on Windows) → commit.
- **Wave 3 result (2026-06-02): typecheck 0, lint 0 err (20 pre-existing warnings), test 75 files /
  530 pass / 3 skip (+21 new chrome tests). Catalog 748 strings ×3 (parity, no empties).**
  Completeness: `scripts/i18n/scan-unmigrated.mjs` shows writing/feedback/reports component chrome
  fully migrated; only justified leftovers remain (2 service-layer generators = deferred; 3
  ConditionsPanel lines = dead fallback + DB-keys). ko-verbatim independently verified (34 strings
  byte-for-byte). en/vi reviewed by coordinator, no gross errors; vi long-copy flagged
  (~33 keys, e.g. writing.help.*, feedback.recommendations.reco.*.reason, reports.comparison.*).
- **Wave 4 result (2026-06-02): typecheck 0, lint 0 err (20 pre-existing warnings), test 77 files /
  542 pass / 3 skip (staging deleted BEFORE this run — proves no staging dependency). Catalog 960
  strings ×3 (parity, no empties).** library/growth component chrome fully migrated; only
  review-set-data.ts (2 unreachable guards) remains. ko-verbatim independently verified (20 strings
  byte-for-byte; 18 verifier hits were tokenization artifacts). en/vi reviewed, high quality,
  ICU + rich-text tags preserved; vi flagged (~22 keys: library.pdf.*, growth.insights.*, etc.).
  Also repaired the wave-3 ReportsChrome staging-import regression (+3 other wave-4 tests) → all
  read messages/ko.json now.
- **Wave 5 result (2026-06-02): typecheck 0, lint 0 err, test 80 files / 555 pass / 3 skip (staging
  deleted before test). Catalog 1216 strings ×3 (parity, no empties).** profile/settings/
  subscription/paywall/onboarding + dashboard learning-cards fully migrated; only the 4 learning
  orphans (skipped) + G-01 language-page false-positive remain. ko verbatim (17 strings). en/vi
  reviewed; vi flagged (~20 keys: subscription.policy.*, paywall.*, onboarding.goalForm.*, etc.).
  Consistency-safe: no shared-entity (subscriptions/payment_history/profiles) enum/status/plan
  value changed — pure string externalization.
- **Wave 6 result — FINAL (2026-06-02): typecheck 0, lint 0 err, test 83 files / 566 pass / 3 skip.
  Catalog 1318 strings ×3 (parity, no empties).** auth-lib/landing/shared/legal migrated + 2 G-01
  misses fixed (Hero alt, language metaTitle). Fixed 1 test bug: TermsContent.test.tsx missing
  `afterEach(cleanup)` → DOM accumulation across same-component renders (added cleanup). ko verbatim
  (the 1 verifier miss was removal of dead duplicate password-strength labels, fully covered by
  auth.strength.* from wave 1). en/vi reviewed, high quality (incl. accurate legal-reference
  phrasing). vi flagged: all legal.* body copy + auth.error.* longer messages (~30 keys).
- **LEGAL flag (strong): all `legal.terms.*` / `legal.privacy.*` en+vi need HUMAN/LEGAL review
  before launch** — these are non-binding placeholders, but machine-translated legal-style copy
  must not ship unreviewed.
- **VERIFICATION PHASE (owner chose "검증 단계 먼저", 2026-06-02) — pushed as far as the no-browser
  env allows:**
  1. **Prod build `pnpm build` → exit 0**: ALL routes compile for production (writing/feedback/
     reports/library/growth/profile/settings/subscription/paywall/onboarding/privacy/terms/…). No
     prod-only RSC/React #130 error — validates the migration + the AppNotFound/AppLoading
     server→client conversion.
  2. **Translation-completeness static check**: of 1318 leaves, exactly **1** en/vi value still
     contains Hangul and equals ko — `settings.language.optionKo = "한국어 (Korean)"`, which is
     CORRECT (Korean option shown in its own script in every locale). ⇒ zero accidental
     untranslated strings; en/vi content completeness is real, not just key-parity.
  3. **Locale-render smoke test** (`tests/lib/i18n/locale-render.test.tsx`, 4/4): AppError +
     AppNotFound render in en AND vi and the ko baseline string is ABSENT when switched — proves
     next-intl actually resolves+renders the en/vi catalogs at render time (not just parity).
  - STILL DEFERRED (needs running server / humans): live-browser locale switch (router.refresh +
    `<html lang>` + no hydration mismatch); vi native review; legal en+vi legal review.
- Cross-model review: codex N/A for Korean copy on Windows (`codex-review-mojibake-windows`) →
  coordinator (Claude) reviewed ko-verbatim (objective string check) + en/vi accuracy.
- QA Gate: degraded — no dev server/browser in coordinator env (`feedback-ui-completion-requires-dev-server`) | full unit suite 530 passed/3 skipped incl. the wave-3 writing/feedback/reports chrome tests rendering via `renderWithIntl` on the ko baseline + catalog-parity test (ko/en/vi identical key sets, no empties) + independent ko-verbatim string check (34 strings byte-for-byte) + scan-unmigrated (no live Korean except justified) | live-browser en/vi rendering + runtime locale switch on writing/feedback/reports screens UNVERIFIED — defer to evidence phase (boot server, switch locale, confirm render + no hydration mismatch); vi long-copy keys need native review.
- UX/UI Consistency Pass: PASSED — i18n string externalization only (Korean literals → `t()`
  resolving to identical ko text); no visual/layout change.
  - Tokens: unchanged (no theme/token/CSS edits).
  - Components: unchanged (antd components + DOM identical; only string literals → `t()`/
    `getTranslations`; `"use client"` preserved; recharts dataKey switched ko→stable-English with
    localized legend via `name` prop so rendered legend stays translated, data shape locale-stable).
  - A11y: aria-labels + messages externalized to `t()` with identical ko text; no regression.
  - Responsive: unchanged (no layout/style edits).

## Verification Phase — real-browser QA + hydration fix (2026-06-02, post-completion)

Owner reported a runtime error at `/` ("useTranslations ... NextIntlClientProvider not found")
and asked for full-scope Playwright verification. Outcome:

- **The reported error was NOT an i18n code bug.** A verification-phase `pnpm build` overwrote the
  shared `.next/` while the owner's `next dev` (Turbopack) server was live → mixed `.next` (prod
  `BUILD_ID`/manifests + stale `turbopack-*.js`) → `/_next/static/chunks/*` 500 → broken hydration
  surfaced as the next-intl context error. Memory `project-pnpm-build-clobbers-dev-server`. Recovery
  = stop dev → `rm -rf .next` → `pnpm dev`. Prod (separate port) was clean, proving the code.
- **Browser QA (Playwright, prod `pnpm start`):**
  - PUBLIC routes (`/`, `/login`, `/sign-up`, `/password-reset`, `/privacy`, `/terms`) × ko/en/vi =
    **18/18**: correct-language render, `<html lang>` switches via `NEXT_LOCALE` cookie, 0 errors.
  - AUTHED workspace routes (student session, profile `ui_locale` flipped en/vi via service role,
    restored to ko after): **11/11 in en AND 11/11 in vi** — dashboard/practice/writing/library/
    growth/profile/settings/subscription/paywall/onboarding all render in the right language, 0 errors.
  - Translation completeness static check: of 1318 leaves, only `settings.language.optionKo`
    ("한국어 (Korean)") is intentionally ko in en/vi → zero accidental untranslated strings.
- **FOUND + FIXED a real (pre-existing) hydration bug — React #418 on `/dashboard`:** the KPI
  "업데이트: {time}" formatted via `toLocaleString("ko-KR", {hour…})`. Node's ICU renders the ko-KR
  day-period as "PM"/"AM" while the browser renders "오후"/"오전" → text mismatch. ALSO timezone-
  dependent. Fix: pin `timeZone: "Asia/Seoul"` + `hour12: false` (24h, no day-period) → deterministic
  across server+client. Verified: `/dashboard` now 0 errors in ko AND en. NOT introduced by the i18n
  string work (the date calls were unchanged by it). Files: `DashboardKpiSummary.tsx`,
  `RecentFeedbackCard.tsx` (tz pin; date-only), and preventively the same proven pattern in
  `DiagnosticCard.tsx` + `NotificationPrefsForm.tsx` (conditional renders, not browser-reproduced).
- Seed-data note: dashboard recommendation RSC prefetches 404 on problem UUIDs not in the test DB
  (`33333333…`, `22222222…`) — environment data gap, not a code bug.

- QA Gate (this verification phase): **PASSED (browser-verified)** | Playwright over prod build:
  public 18/18 (ko/en/vi) + authed 11/11 (en) + 11/11 (vi), 0 page/console/5xx errors after the
  #418 fix; typecheck 0, lint 0 err, unit test 570 pass/3 skip | RESIDUAL: live locale-switch via the
  in-app settings UI (router.refresh path) was exercised via cookie/profile, not the Save button;
  vi copy + legal copy still need native/legal review; the owner's own `next dev` needs the `.next`
  recovery (couldn't restart their process from here).

## Root-cause CORRECTION — the `/` error was a missing next-intl global `timeZone` (2026-06-02)

After the owner pasted the actual dev stack trace (`LandingHeader.tsx:30` ← `HomePage`, Next 16.2.6
Turbopack), a clean dev reproduction (own `next dev`, fresh `.next`, server log captured) showed the
REAL server-side error:

> `Error: ENVIRONMENT_FALLBACK: There is no \`timeZone\` configured ... Consider adding a global default`
> `at LandingHeader (src/components/landing/LandingHeader.tsx:30:28)`

- **Root cause:** next-intl v4 requires a global `timeZone`. Without it, it throws ENVIRONMENT_FALLBACK
  at the first `useTranslations()` call. In dev/Turbopack this failed the landing server render →
  React client-fallback → the surfaced "NextIntlClientProvider context not found" (matches hint #1).
  Prod only WARNED (my earlier prod QA returned 200), which is why prod QA masked it — and why my
  first theory (the `.next` clobber) was incomplete. The clobber was a real but secondary/compounding
  factor; the durable bug is the missing `timeZone`.
- **Fix:** add a shared `DEFAULT_TIME_ZONE = "Asia/Seoul"` (`src/i18n/locales.ts`) and pass it to BOTH
  `getRequestConfig` (`src/i18n/request.ts`, server formatters) AND `NextIntlClientProvider`
  (`src/app/providers.tsx`, client formatters). Also mirrored in `tests/test-utils/renderWithIntl.tsx`.
  Server config alone was NOT enough — the client provider also needs it (that's why ENVIRONMENT_FALLBACK
  persisted until providers.tsx was fixed).
- **Verified (clean dev, Turbopack — the owner's environment):** fresh dev-server log shows
  ENVIRONMENT_FALLBACK count = 0; Playwright over the dev server: `/`, `/login`, `/sign-up`, `/privacy`
  all HTTP 200, lang=ko, ZERO page/console errors. typecheck 0, lint 0 err, unit test 570 pass/3 skip.
- **Owner recovery (their current clobbered dev state):** still `Remove-Item -Recurse -Force .next` +
  `pnpm dev` once, to clear the prior mixed `.next`; the code fix prevents the error recurring.
- The earlier per-component `toLocaleString` tz+hour12 fixes (commit b9f2fa7) remain valid and
  complementary: those address RAW `new Date().toLocaleString()` (which ignores next-intl config); the
  global `timeZone` covers next-intl's own formatters.

## Ledger/File-State Consistency

- Files changed match accepted scope: yes. Wave 3 = 32 source files (writing/feedback/reports
  components + 4 route pages) + 4 tests modified + 3 new chrome tests, all within the declared
  in-scope clusters. No admin file touched; no orphan migrated; no `src/lib/**` edited; no
  `supabase/migrations` change. Coordinator-only edits: 1 dynamic-key cast + 1 parity-fix value.
- Docs consulted match implemented behavior: yes (catalog reflects ko-verbatim source strings;
  deferred service-layer generators recorded with rationale).
- Child result packets integrated: yes — 3 agent packets reviewed; their serviceLayerStrings,
  viFlagged, and leftoverKorean claims were independently verified by the coordinator (scan +
  ko-verbatim check + code reads of ConditionsPanel + the suffixCount parity fix).
- Verification state current: yes — typecheck 0, lint 0 err, test 530 pass/3 skip, parity green,
  scan clean. Staging dir removed (not committed); next-env.d.ts clean.
- Remaining risks listed: yes (below).

## Risks And Follow-Up

- vi machine-generated → native review needed (esp. long copy: feedback insights, growth, legal).
- Large surface → rely on parity test + scan-unmigrated re-run to prove completeness per wave.
- 4 learning orphans + dead routes.ts `label:` fields → future cleanup task (not i18n).
- DEFERRED with AI-integration phase: `src/lib/writing/feedback-service.ts` +
  `comparison-service.ts` (service-layer Korean prose generators) — localize via locale-aware
  generation when the real AI feedback lands, NOT via static catalog.

