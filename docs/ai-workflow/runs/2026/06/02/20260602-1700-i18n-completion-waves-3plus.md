# Context Ledger — i18n completion (waves 3+) — finish user-facing string migration

## Run Metadata

- Run id: 20260602-1700-i18n-completion-waves-3plus
- Created: 2026-06-02
- Updated: 2026-06-02
- Main session owner: Claude Code (Opus 4.8 1M) — coordinator + durable context owner
- Host: Claude Code
- Parent run: `docs/ai-workflow/runs/2026/06/02/20260602-1300-ia-autonomous-cleanup-migration-i18n.md`
- Resume source: `reports/ia-verification/runs/20260601-120308/handoffs/20260602-RESUME-2-scope-corrected-i18n.md`
- Status: in progress — executing remaining i18n waves (writing/feedback/reports → library/growth →
  profile/settings/learning → auth-lib/landing/shared/legal). Admin EXCLUDED (out of scope).

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
