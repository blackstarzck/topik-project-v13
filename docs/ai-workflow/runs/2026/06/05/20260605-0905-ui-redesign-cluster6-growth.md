# Context Ledger — UI Redesign Cluster 6 (growth)

## Run Metadata

- Run id: 20260605-0905-ui-redesign-cluster6-growth
- Created: 2026-06-05 09:05 (+09:00)
- Main session owner: Claude Code (Opus 4.8, 1M ctx) — coordinator
- Implementation: isolated sub-agent (understand + surgical edits + self static-gates)
- Human/visual review: delegated to **GPT-5.5 (codex)** with screenshots attached (per user directive)
- Decisions delegated to GPT-5.5 per user directive
- Branch: `docs/auth-overview-consolidated-reference`
- Status: **cluster-6 verified** — M1 both routes @360/768/1280 all ok (paywall branch; 0 console/runtime/overlay/antd-deprecation) + static gates + full suite GREEN + GPT-5.5 review (2 P1 FIXED / 2 P2 recorded)
- Resume guide: `20260604-1945-handoff-ui-redesign-resume.md`; smoke-harness fix ledger `20260604-2130-…`

## Task

- Apply the validated design system to the **growth cluster** (Cluster 6): X-02 `/growth`, X-07 `/practice/weakness`.
  Visual/structural ONLY — never copy/i18n/behavior/routes/data/props/paywall-gate-logic.
- Out of scope (absolute): admin (frozen); theme global tokens; no new DB schema. antd deprecations were ALREADY
  swept by the concurrent Codex session (committed `b67ad3b`), so this cluster did no deprecation migration.

## Docs Consulted

- `docs/ui-redesign/PLAN.md` (§Goal, §A0, M1–M6/C1, 확장 로드맵, 공통 규칙). `DESIGN.md` (SPACING, AppCard/.app-surface,
  NEVER card-in-card → `.app-card-compact`, color=meaning, flat buttons, one primary action, dark=darkAlgorithm).
- `src/components/shared/{AppCard,PageHeader}.tsx`, `src/theme/spacing.ts`, `src/styles/global.css` (`.app-card-compact`).
- Wireframe specs for X-02 / X-07. Route pages `growth/page.tsx`, `practice/weakness/page.tsx` (server; paywall gate).
- `scripts/{dev-route-smoke,ai-workflow-check}.mjs`, `scripts/hooks/require-ui-smoke.mjs`.
- `CLAUDE.md`, `docs/ai-development-workflow.md`. Memory: project-ui-redesign-pilot-plan,
  project-dev-smoke-127-cross-origin-no-hydration, feedback-ui-completion-requires-dev-server, feedback-concurrent-agent-worktree.
- Audience: **user** (growth/weakness are user-facing, RLS auth.uid()-scoped; no admin). Doc conflicts: none.
- Untouched relevant docs: `docs/ant-design/08-theme-architecture.md` (no theme-token change).

## Active Files

- Changed (commit `a2b20ab`, 6 files): `growth/{GrowthDashboard,GrowthTrendChart}`, `practice/{WeaknessView,DiagnosticCard,
  DimensionTabs}`, `app/(workspace)/practice/weakness/page.tsx`.
- Changed (commit `8d5a9f0`, GPT-5.5 P1 fixes, 2 files): `growth/GrowthDashboard.tsx` (title → PageHeader),
  `app/(workspace)/practice/weakness/page.tsx` (locked panel → AppCard).
- Card→AppCard ×18 + 1 card-in-card → `.app-card-compact` row (GrowthDashboard recommend list); weakness page dropped
  2 duplicate `<main>` + bare `<h1>` → PageHeader in BOTH unlocked and locked branches.
- NOT touched: admin (frozen); theme global tokens; paywall-gate logic.

## Verification State

- Checks re-run by the coordinator (A0 — judgment = machine reality, not the sub-agent's report):
  - `node scripts/ai-workflow-check.mjs --repo . --check-inline-styles --check-antd-deprecations` → PASS + M4 + M6 (exit 0). No inline-number escapes needed.
  - `pnpm typecheck` → exit 0. `pnpm lint` → 0 errors (pre-existing warnings only; no new unused imports from the PageHeader swap).
  - `pnpm vitest run` growth+practice+lib/practice+weakness-flow → green (GrowthChrome, WeaknessView, etc.).
  - `pnpm test` (full) → **707 passed | 3 skipped (99 files)** — no regressions.
  - **M1 dev-route-smoke** (real running dev :3000, now HYDRATING via allowedDevOrigins; student.json), headSha `8d5a9f0` == HEAD,
    `/growth` + `/practice/weakness` × @360/768/1280 = 6 visits: **all ok=true, fatal=false, redirected=false, reasons=[],
    overlayText="", pageErrors=[]**; consoleErrors = HMR-noise only → real console errors 0, **antd deprecation 0**, status 200.
  - `node scripts/ai-workflow-check.mjs --repo . --check-smoke` → M3 PASS (fresh, headSha == HEAD). admin diff empty.
  - **Coordinator self visual inspection** (read PNGs): @1280 both routes render the PAYWALL/LOCKED branch (free-plan student) —
    PageHeader h1 ("성장 대시보드" / "약점 보강") + a calm flat locked AppCard (lock icon + body + one primary "플랜 업그레이드"
    + secondary CTA). After the P1 fix the weakness locked panel is a shared AppCard, visually consistent with /growth's locked card.
    @360 sidebar collapses to the hamburger, content full-width (shell now hydrates). No card-in-card, no horizontal scroll.
- **Cross-model review: COMPLETED via GPT-5.5 (codex) — visual review with 4 screenshots** (`codex exec -i growth-{360,1280}.png
  practice_weakness-{360,1280}.png -s read-only`, medium). Verdict: **NEEDS FIXES, 2 P1 / 2 P2.**
  - [P1] #1 — `/growth` title was `Typography.Title level={3}` (h3) not a PageHeader h1. **FIXED** (`8d5a9f0`): GrowthDashboard title → `<PageHeader>`.
  - [P1] #2 — `/practice/weakness` locked panel was a hand-built bordered `<div>` with inline magic numbers, not the shared surface.
    **FIXED** (`8d5a9f0`): locked panel → `<AppCard>` (server-safe plain-Card wrapper; inner notice kept plain HTML+Link for RSC #130 safety).
  - [P2] #1 — `.app-card-compact` uses `padding: 12px 16px` (12 off the 8-scale; DESIGN.md card-compact = 16). **RECORDED, not fixed**:
    it is a SHARED `global.css` hook used by other clusters (dashboard) → a deliberate token-alignment pass with cross-screen re-verify, not a cluster-6-local change.
  - [P2] #2 — growth mobile locked card: antd `Result` adds oversized vertical padding + an awkward Korean title break. **RECORDED, not fixed** (advisory polish; antd-component-owned padding).
  - On-spec (GPT-5.5): CTA hierarchy correct (one primary upgrade + one secondary); 360 sidebar collapse + no horizontal scroll; AppCard swaps non-destructive; card-in-card → `.app-card-compact` directionally correct.
  - (Korean copy NOT evaluated — unchanged + image-based visual judgment is mojibake-immune.)
- UX/UI Consistency Pass: passed
  - Tokens: no new inline magic numbers (M4 PASS). Locked-panel inline border/radius/padding removed in favor of the AppCard surface.
  - Components: bare antd `Card` → `AppCard` ×18; 1 card-in-card → `.app-card-compact`; `Typography.Title` page title → `PageHeader`
    (×2: growth + weakness); locked `<div>` → `AppCard`. No `Modal` in cluster. No new antd deprecations (Codex pre-swept; M6 PASS).
  - A11y: weakness page dropped 2 duplicate `<main>` (Layout.Content is the landmark); PageHeader renders semantic `<header>`+singular h1
    on both routes; aria/role/data-testid preserved.
  - Responsive: M1 @360/768/1280 all ok=true; shell collapses to hamburger at 360 (hydration fixed); cards stack with no horizontal scroll.
- QA Gate: passed — real dev app M1 on both routes @360/768/1280 (0 console/runtime/overlay/antd-deprecation); growth+practice unit +
  707 full-suite green; admin diff empty; GPT-5.5 P1s fixed.
- **Honest gap — UNLOCKED branch not runtime-smoked.** The seeded test student is FREE-plan, so both routes render the paywall/locked
  branch (accepted as cluster-6 acceptance evidence per GPT-5.5 D3=A: 200, 0 errors). The unlocked branch (full GrowthDashboard KPI cards +
  GrowthTrendChart; full WeaknessView + DiagnosticCard + DimensionTabs) is NOT runtime-reachable without a paid-plan session (which needs an
  authorized DB write) — covered by typecheck + the growth/weakness unit tests + the AppCard pattern proven at runtime on clusters 1-5.
- **Deferred (honest): clean `pnpm build`** — dev reused for M1. #130 risk ≈ 0 (pages stay server components; AppCard server-safe;
  locked panel uses plain Card + plain-HTML inner content). Run when dev is free.

## Ledger/File-State Consistency

- Commits this run: `a2b20ab` (cluster-6 UI, 6 files), `8d5a9f0` (GPT-5.5 P1 fixes, 2 files). Evidence commit (this ledger + smoke-result.json + screenshots) follows.
- smoke-result.json headSha `8d5a9f0` == HEAD (Stop-hook fresh; `.smoke-skip` absent — gate restored after the earlier collision).
- Working tree after evidence commit = clean.

## Risks And Follow-Up

- [P2] `.app-card-compact` 12px → 16px (DESIGN.md alignment) — SHARED `global.css` hook; do as a dedicated token pass with dashboard re-verify.
- [P2] growth mobile locked-card `Result` padding — advisory polish.
- Unlocked growth/weakness branch: seed a paid-plan session + runtime-smoke when authorized.
- Clean prod build (the one un-run §Goal step) — run when dev is free.
- Remaining clusters: 7 settings/profile (G-01 /settings/language, X-09 /settings/notifications, X-05 /profile) → 8 paywall/subscription
  (X-03 /paywall, X-04 /subscription) → public/legal (X-01 /, X-13 /terms, X-14 /privacy).
