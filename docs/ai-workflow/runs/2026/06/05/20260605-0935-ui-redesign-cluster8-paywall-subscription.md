# Context Ledger — UI Redesign Cluster 8 (paywall / subscription)

## Run Metadata

- Run id: 20260605-0935-ui-redesign-cluster8-paywall-subscription
- Created: 2026-06-05 09:35 (+09:00) · Owner: Claude Code (Opus 4.8, 1M ctx) — coordinator
- Implementation: isolated sub-agent. Human/visual review: delegated to **GPT-5.5 (codex)** with screenshots. Decisions delegated to GPT-5.5.
- Branch: `docs/auth-overview-consolidated-reference`
- Status: **cluster-8 verified** — M1 2 routes @360/768/1280 all ok (0 console/runtime/overlay/antd-deprecation) + static gates + full suite GREEN + GPT-5.5 review (1 P1 = non-bug timing artifact / 1 P2 FIXED)

## Task

- Apply the validated design system to **paywall/subscription** (Cluster 8): X-03 `/paywall`, X-04 `/subscription`. Visual/structural ONLY — billing/checkout/plan logic untouched.
- Out of scope: admin (frozen); theme tokens; no new DB schema. antd deprecations already Codex-swept.

## Docs Consulted

- `docs/ui-redesign/PLAN.md` (§Goal/§A0/gates/공통 규칙), `DESIGN.md` (SPACING, AppCard, never card-in-card, color=meaning, one primary action, flat buttons).
- `src/components/shared/{AppCard,AppModal,PageHeader}.tsx`, `src/theme/spacing.ts`, `src/styles/global.css`.
- Wireframe specs X-03/X-04. Pages `paywall/page.tsx`, `subscription/page.tsx` (server delegators). `billing-data.ts` (data).
- `scripts/{dev-route-smoke,ai-workflow-check}.mjs`. `CLAUDE.md`, `docs/ai-development-workflow.md`.
- Memory: project-ui-redesign-pilot-plan, project-dev-smoke-127-cross-origin-no-hydration, feedback-concurrent-agent-worktree.
- Audience: **user** (RLS auth.uid()). Doc conflicts: none. Untouched relevant: `docs/ant-design/08-theme-architecture.md`.

## Active Files

- Commit `6e09dfb` (cluster-8 UI, 2 files): `PaywallShell.tsx` (4 Card→AppCard, main dropped, title→PageHeader, content-width const), `SubscriptionShell.tsx` (4 Card→AppCard, 1 Modal→AppModal, main dropped, title→PageHeader, content-width const).
- Commit `5368bb1` (GPT-5.5 P2 fix, 2 files): IA-code Tag (X-03/X-04) moved OUT of the PageHeader `title` (h1) to header metadata above it (both shells).
- Card→AppCard ×8; Modal→AppModal ×1; 2 PageHeader; 2 `<main>` dropped; 2 maxWidth:1040 escape hatches. Pages unchanged (server delegators). NOT touched: admin, theme tokens, billing logic, plan recommended-border selected-state (preserved).

## Verification State

- Coordinator re-ran (A0): `ai-workflow-check --check-inline-styles --check-antd-deprecations` → PASS + M4 + M6 (exit 0). `pnpm typecheck` → 0. `pnpm lint` → 0 errors (24 pre-existing warnings; 0 in scope files). `pnpm vitest run tests/components/settings` → 13 pass. `pnpm test` (full) → **707 passed | 3 skipped (99 files)**.
- **M1 dev-route-smoke** (real dev :3000, hydrating; student.json), headSha `5368bb1` == HEAD, `/paywall` + `/subscription` × @360/768/1280 = 6 visits: **all ok=true, reasons=[], overlay="", pageErrors=[]**; consoleErrors = HMR-noise only → real console errors 0, **antd deprecation 0**, status 200. `--check-smoke` → M3 PASS. admin diff empty.
- **Coordinator self visual inspection** (@1280 + @360): /paywall = PageHeader "구독 시작하기" + 3 plan AppCards (월간 ₩9,900 / 분기 ₩26,700 추천 w/ blue selected border + primary button / 연간 ₩99,000) + 구독 혜택 + 결제 안내 cards; /subscription = PageHeader "구독 관리" + 현재 구독 / 결제 이력(empty) / 도움말 AppCards + "구독 시작하기" primary. Flat white surfaces, no card-in-card, recommended-plan emphasis = blue border + 추천 tag + primary button (color+text=meaning, not color-alone). @360 sidebar collapses to hamburger; plan cards stack 1-col, full-width, no horizontal scroll.
- **Cross-model review: COMPLETED via GPT-5.5 (codex), 4 screenshots** (`-i paywall-{360,1280} subscription-{360,1280}`). Verdict: **NEEDS FIXES, 1 P1 / 1 P2.**
  - [P1] — "/paywall @360 stuck in skeleton (no plans/primary action)." **INVESTIGATED → NON-BUG (smoke cold-compile timing artifact).** The smoke visits @360 FIRST (cold Next dev route compile), so the client plan-query hadn't resolved by the fixed 1200ms screenshot → it captured the (legitimate, plan-card-shaped) loading skeleton; @768/@1280 (warm) showed full plans. **Confirmed**: re-smoking `/paywall @360` on the now-warm route renders the FULL plan list (월간/분기/연간 + 혜택 + 안내 + CTAs), sidebar collapsed, no horizontal scroll. Not a real defect; the skeleton is a valid DESIGN.md layout-matched loading state that resolves.
  - [P2] — IA-code Tag (X-03/X-04) was inside the PageHeader `title` → part of the h1 accessible name (a regression the sub-agent's PageHeader conversion introduced). **FIXED** (`5368bb1`): Tag moved out of `title` to header metadata above it (kept per GPT-5.5's "keep the code, render outside the title" directive). h1 accessible name is now just the page title.
  - On-spec (GPT-5.5): plan cards one shared AppCard surface, no card-in-card; recommended emphasis calm (border + "추천" text, not color-alone); duplicate `<main>` removal correct; subscription cards calm/aligned at 1280 + readable at 360; AppModal swap clean; 360 hamburger + no horizontal scroll.
  - (Korean copy not evaluated — unchanged + image-based judgment mojibake-immune.)
- UX/UI Consistency Pass: passed
  - Tokens: no new inline magic numbers (M4 PASS); 2 documented `// ai-check: allow-inline-number` for the 1040px content-width caps (off-scale, value preserved).
  - Components: bare antd `Card` → `AppCard` ×8; antd `Modal` → `AppModal` ×1 (policy modal); `Title` page title → `PageHeader` ×2; recommended-plan selected-state border preserved (color=meaning). No new antd deprecations (M6 PASS).
  - A11y: 2 duplicate `<main>` dropped (Layout.Content is the landmark); PageHeader semantic `<header>`+singular h1; IA-code Tag moved out of the h1 accessible name; danger/ok modal button props preserved.
  - Responsive: M1 @360/768/1280 all ok=true; shell collapses to hamburger at 360; plan cards stack with no horizontal scroll.
- QA Gate: passed — real dev app M1 on 2 routes @360/768/1280 (0 console/runtime/overlay/antd-deprecation); settings unit + 707 full-suite green; admin diff empty; GPT-5.5 0 real P1 (the flagged P1 was a smoke timing artifact, confirmed non-bug).
- **Deferred (honest): clean `pnpm build`** — dev reused; #130 risk ≈ 0 (shells are "use client"; pages server delegators; AppCard/AppModal proven). Run when dev free.

## Ledger/File-State Consistency

- Commits this run: `6e09dfb` (cluster-8 UI), `5368bb1` (P2 fix). Evidence commit (this ledger + smoke-result.json + screenshots) follows.
- smoke-result.json headSha `5368bb1` == HEAD. A concurrent session's `.smoke-skip` is present (moot; left untouched per multi-agent protocol).
- Working tree after evidence commit = clean (aside from the other session's `.smoke-skip`).

## Risks And Follow-Up

- /paywall mobile cold-load: the skeleton is correct; if the cold client-plan-query feels slow, consider SSR-ing the plan list (separate perf follow-up, not a redesign concern).
- IA-code Tag (X-03/X-04) shown to users: all other clusters omit IA codes; kept per GPT-5.5 directive but a candidate for removal in a content-cleanup pass.
- Clean prod build (un-run §Goal step) — run when dev free.
- Remaining: **public/legal** (X-01 `/` landing, X-13 `/terms`, X-14 `/privacy`) — public pages → `PublicShell`/`PageContainer`; landing is plain-CSS hero; legal is static semantic HTML.
