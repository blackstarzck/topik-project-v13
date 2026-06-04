# Context Ledger — UI Redesign Cluster 4 (feedback / reports)

## Run Metadata

- Run id: 20260604-1915-ui-redesign-cluster4-feedback-reports
- Created: 2026-06-04 19:15 (+09:00) · Updated: 2026-06-04 19:40
- Main session owner: Claude Code (Opus 4.8, 1M ctx) — coordinator + durable context owner
- Host: Claude Code · Effort: ultracode (workflows by default)
- Branch: `docs/auth-overview-consolidated-reference` (do NOT switch)
- Status: **cluster-4 verified (M1 3/4 routes + static gates + full suite GREEN)** — R-01 comparison route
  not runtime-smoked (no seeded report; see Verification) — clean prod build deferred — human visual review pending
- Resume guides: `20260604-1830-handoff…md`, prior cluster ledger `20260604-1845-…cluster3-writing.md`

## Task

- Apply the validated pilot design system to the **feedback / reports cluster** (Cluster 4) per
  `docs/ui-redesign/PLAN.md` §확장 로드맵. Visual/structural ONLY — never copy/i18n/behavior/routes/data.
- Screens: E-01 `/writing/feedback/short/[id]`, E-02 `/writing/feedback/long/[id]`,
  R-01 `/writing/reports/[id]/compare`, R-02 `/practice/next`, + **D-M2 AnalysisLoadingModal** (deferred from C3).
- Out of scope (absolute): admin (frozen); theme global tokens; no new DB schema.

## Docs Consulted

- `docs/ui-redesign/PLAN.md` (§Goal, §A0, M1–M6/C1, 확장 로드맵, 공통 규칙). `DESIGN.md` (visual SoT: SPACING,
  AppCard/.app-surface, never card-in-card → `.app-card-compact`, color=meaning, dark=darkAlgorithm).
- `src/components/shared/{AppCard,AppModal,PageHeader}.tsx` (thin pass-through APIs). `src/theme/spacing.ts`.
- Wireframe specs `docs/Wireframe/{14,15,16,17}-*/{description,functional-spec}.md` (read in understand workflow).
- Route pages: `feedback/short/[id]`, `feedback/long/[id]`, `reports/[id]/compare`, `practice/next` (notFound on bad id).
- `src/lib/writing/comparison-service.ts` (ComparisonMetrics), `scripts/audit-setup/verify-seed-data.mjs`
  (deterministic seeded student submissions: `a0d17000-…051` q51/short, `…053` q53/long, all feedback_status=complete),
  `supabase/migrations/20260520120500_feedback.sql` (comparison_reports schema), `scripts/ai-workflow-check.mjs`
  (M4 per-line `// ai-check: allow-inline-number` escape hatch — must be on the SAME line as the number).
- `scripts/dev-route-smoke.mjs`, `scripts/hooks/require-ui-smoke.mjs`. `CLAUDE.md`, `docs/ai-development-workflow.md`.
- Memory: project-ui-redesign-pilot-plan, feedback-ui-completion-requires-dev-server, feedback-concurrent-agent-worktree,
  project-antd-compound-server-component-react130.
- Audience: **user** (feedback/reports/next are user-facing, RLS auth.uid()-scoped; no admin).
- Doc conflicts: none.
- Untouched relevant docs: `docs/ant-design/08-theme-architecture.md` (not editing theme; rules pre-encoded in
  AppCard/PageHeader I reuse). `docs/user-admin-consistency-method.md` (no shared-entity schema read/write; visual only).

## Progress log

- Precondition: `git status` clean of concurrent Codex work (ambient/inherited only). HEAD b19f4b5.
- Understand: read-only Workflow fan-out (4 agents) → DS edit-lists. Located D-M2 = `feedback/AnalysisLoadingModal`
  (Card-based, NOT antd Modal). Found R-02 also renders SummaryCardRow + AlternativeCardsGrid (added to scope).
- Seeding investigation: ad-hoc service-role DB read was correctly DENIED by the safety classifier (PII enumeration).
  Respected it — used the student-session dev-smoke (200-vs-404) to confirm seed state instead. Seed verified present
  by the E-01/E-02 smoke returning 200 (not notFound).
- Implement: ~30 `<Card>`→`<AppCard>` across 14 components; `/practice/next` page double-main + `<h1>`→`<PageHeader>`;
  2 design-value consts with `// ai-check: allow-inline-number` (maxWidth 480, styles.body.paddingTop 0).
- **Commit `3df0535`** (cluster-4 UI, 15 files). M1 dev-smoke at that HEAD.

## Active Files

- Changed (commit `3df0535`, 15 files): reports/{ComparisonReportView,ComparisonKpiBlock,DimensionComparisonCards,
  SubmissionDiffPanel,ScoreComparisonChart}, feedback/{FeedbackSummary,DimensionCardGrid,DetailedFeedbackPanel,
  SentenceFeedbackList,FeedbackRecommendationCards,AnalysisLoadingModal}, practice/{SummaryCardRow,NextProblemView,
  AlternativeCardsGrid}, app/(workspace)/practice/next/page.tsx.
- NOT changed (no Card/Modal): feedback/{FeedbackPageContent,FeedbackPendingPanel,NextActionBar,SaveToLibraryButton,
  AnalysisCharacter}. Pre-existing inline numbers on untouched lines left as-is (delta-exempt).
- NOT touched: admin (frozen); theme global tokens.

## Verification State

- Checks run at HEAD `3df0535` (cluster-4 UI commit):
  - `pnpm typecheck` → GREEN (exit 0) — all AppCard/PageHeader imports resolve, no orphan Card.
  - `pnpm lint` → exit 0 (21 pre-existing warnings; 0 errors).
  - `node scripts/ai-workflow-check.mjs --repo . --check-inline-styles --check-antd-deprecations` → M4 PASS + M6 PASS.
    Two design-value literals escaped with same-line `// ai-check: allow-inline-number` (AnalysisLoadingModal maxWidth
    480 = content max-width off the SPACING scale; DetailedFeedbackPanel styles.body.paddingTop 0 = intentional flush).
  - `pnpm vitest run tests/components/feedback tests/components/reports tests/components/practice` → 40/40 PASS.
  - `pnpm test` (full suite) → **706 passed | 3 skipped (98 files: 96 passed | 2 skipped)** — no regressions.
  - **M1 dev-route-smoke** (real running dev :3000, student.json), headSha `3df0535` = HEAD, 3 routes × @360/768/1280 = 9 visits:
    `/practice/next` (R-02, static), `/writing/feedback/short/a0d17000-…051` (E-01), `/writing/feedback/long/a0d17000-…053`
    (E-02) — **all ok=true, fatal=false, redirected=false, reasons=[], overlayText="", pageErrors=[]**; consoleErrors =
    HMR-websocket dev-noise only (filtered) → real console errors 0, **antd deprecation 0**; status 200. Seeded
    submissions (feedback_status=complete) render the REAL feedback (not the pending modal). Artifact: smoke-result.json + 9 screenshots.
  - **Self visual inspection** (@1280): R-02 (PageHeader "다음 문제" h1 + SummaryCardRow 3 AppCards + primary recommendation
    AppCard + fixed bottom bar), E-01 (FeedbackSummary AppCard 60/100 + DimensionCardGrid 4 AppCards + recommendation
    AppCard + NextActionBar), E-02 (+ DetailedFeedbackPanel Collapse with Progress, flush top via styles.body.paddingTop:0).
    All white AppCard surfaces on calm canvas — consistent with clusters 1-3.
  - `node scripts/ai-workflow-check.mjs --repo . --check-smoke` → M3 PASS (testedRoutes ⊇ requiredRoutes, fresh headSha).
  - admin diff (`git diff --name-only -- src/components/admin "src/app/(workspace)/admin"`) → empty.
- **R-01 `/writing/reports/[id]/compare` — NOT runtime-smoked (honest gap):** no seeded comparison_reports row exists
  (verify-seed-data.mjs explicitly defers it), and seeding one needs an elevated service-role DB WRITE which the safety
  classifier flags + is out of this task's authorized scope. R-01's ComparisonReportView is covered by typecheck +
  the reports component test (ReportsChrome) + the identical Card→AppCard pattern proven at runtime on E-01/E-02/R-02.
  To smoke R-01, a future run should seed a comparison_reports row (current `…055` vs previous `…051`) with user authorization.
- **@360 shell crowding (pre-existing, not a cluster-4 regression):** at 360px the WorkspaceShell sidebar stays inline
  (does not collapse to the mobile drawer), so authed-page content is narrow and text wraps heavily. Same across clusters
  1-3 screenshots; the writing/feedback cards themselves stack 1-col correctly with no horizontal scroll. Shell mobile-nav
  is a separate follow-up (not this cluster's components).
- **Deferred (honest): clean `pnpm build`** — dev reused for M1 (M5 blocks build-while-dev). #130 risk ≈ 0 (AppCard
  server-safe; all touched files "use client"; no new server-rendered compound antd). Run when dev is free.
- Cross-model review: degraded — single session; codex disqualified (한글 mojibake; copy UNCHANGED so moot). Substitute:
  machine gates (M4/M6/M3) + real-app M1 (3 routes) + 40 unit + 706 full-suite + direct screenshot inspection + 4-agent understand.
- UX/UI Consistency Pass: passed
  - Tokens: no new inline magic numbers (M4 PASS). 2 design-value literals (maxWidth 480, paddingTop 0) escaped with
    documented `// ai-check: allow-inline-number` (off-SPACING-scale / intentional 0), not tokenized to avoid changing values.
  - Components: bare antd `Card` → shared `AppCard` (.app-card/.app-surface) ×~30 across 14 feedback/reports/practice
    components; `/practice/next` bare `<h1>` → `PageHeader` (h1 a11y); no antd `Modal` in cluster (AnalysisLoadingModal is
    Card-based); `Descriptions bordered` / `Statistic` untouched (no new deprecations); pre-existing card-in-card kept 1:1 (not restructured).
  - A11y: removed the duplicate `<main>` on `/practice/next` (antd Layout.Content is the main landmark) — same fix as
    clusters 1-2; PageHeader renders semantic `<header>`+h1; aria-label/role/data-testid preserved.
  - Responsive: M1 @360/768/1280 all ok=true; cards stack 1-col at 360 with no horizontal scroll (shell sidebar crowding noted above).
- QA Gate: passed — real dev app M1 on R-02 + E-01 + E-02 @360/768/1280 (0 console errors, 0 antd deprecation); 40 unit +
  706 full-suite green; admin diff empty. (R-01 covered by unit + typecheck + pattern, not runtime — documented above.)
- **Human visual review (#3): PENDING — non-substitutable gate. 9 screenshots in `docs/ui-redesign/pilot-shots/`
  (light; dark mode low-risk — no theme-token change). Awaiting user sign-off.**

## Ledger/File-State Consistency

- Commits this run: `3df0535` (cluster-4 UI, 15 files). Evidence commit (this ledger + smoke-result.json + 9 screenshots) follows.
- smoke-result.json headSha `3df0535` == cluster-4 UI commit HEAD (Stop-hook fresh; `.smoke-skip` absent).
- Working tree after evidence commit = only ambient/inherited (below).

## Ambient / inherited dirty files — NOT mine, do not commit

next-env.d.ts, src/app/layout.tsx, docs/ui-redesign/pilot-shots/dashboard-{360,768,1280}.png, errors/, fonts/pretendard/,
verify-landing.mjs, verify-pilot.mjs.

## Risks And Follow-Up

- R-01 comparison route: seed a comparison_reports row + M1-smoke it (with user authorization for the DB write).
- Clean prod build (the one un-run §Goal step) — run when dev is free.
- WorkspaceShell mobile-nav at ≤360 (sidebar doesn't collapse) — pre-existing, affects all authed pages; shell/header follow-up.
- Remaining clusters: 5 library (F-01, F-M1 PdfExportModal→AppModal) → 6 growth → 7 settings → 8 paywall → public/legal.
