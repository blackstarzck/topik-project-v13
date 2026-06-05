# Context Ledger — UI Redesign Cluster (P) public / legal (FINAL)

## Run Metadata

- Run id: 20260605-0950-ui-redesign-cluster-public-legal
- Created: 2026-06-05 09:50 (+09:00) · Owner: Claude Code (Opus 4.8, 1M ctx) — coordinator
- Implementation: isolated sub-agent. Human/visual review: delegated to **GPT-5.5 (codex)** with screenshots. Decisions delegated to GPT-5.5.
- Branch: `docs/auth-overview-consolidated-reference`
- Status: **public/legal verified** — M1 3 routes @360/768/1280 all ok (anonymous; 0 console/runtime/overlay/antd-deprecation) + static gates + full suite GREEN + GPT-5.5 review (0 P1 / 3 P2 recorded). **This is the LAST cluster — all user-facing clusters now done.**

## Task

- Apply the validated design system to the **public/legal** screens: X-01 `/` (landing), X-13 `/terms`, X-14 `/privacy`. Visual/structural ONLY — all legal copy unchanged.
- Out of scope: admin (frozen); theme tokens; no new DB schema. antd deprecations already Codex-swept.

## Docs Consulted

- `src/app/login/page.tsx` (public-page reference pattern: PublicShell + PageContainer + AppCard). `DESIGN.md`. `docs/ui-redesign/PLAN.md`.
- `src/components/shared/{PublicShell,PageContainer,AppCard,PageHeader}.tsx`, `src/theme/spacing.ts`, `src/styles/global.css`.
- Wireframe specs X-01/X-13/X-14. `scripts/{dev-route-smoke,ai-workflow-check}.mjs`. `CLAUDE.md`, `docs/ai-development-workflow.md`.
- Memory: project-ui-redesign-pilot-plan, project-dev-smoke-127-cross-origin-no-hydration, feedback-concurrent-agent-worktree.
- Audience: **user** (public, pre-auth). Doc conflicts: none. Untouched relevant: `docs/ant-design/08-theme-architecture.md`.

## Active Files (commit `3faa778`, 6 files)

- Pages: `app/page.tsx` (landing), `app/terms/page.tsx`, `app/privacy/page.tsx` — bare `<main>` wrappers → `PublicShell` + `PageContainer` (the public `<main>` landmark). Landing = `default`(1040), hero kept full-bleed. Legal = `narrow`(480) + AppCard. Existing h1s preserved (hero `Title level=1`, legal headings) — no double-h1.
- Components: `landing/FeatureCard` (Card→AppCard), `landing/ProductPreview` (Card→AppCard ×2), `legal/TermsContent` (Card→AppCard, dropped redundant inline maxWidth/margin now owned by PageContainer).
- Card→AppCard ×4; Modal→AppModal 0. 1 inline-number escape (privacy scope-note marginTop 12, preserved value). NOT touched: admin, theme tokens, legal copy.

## Verification State

- Coordinator re-ran (A0): `ai-workflow-check --check-inline-styles --check-antd-deprecations` → PASS + M4 + M6 (exit 0). `pnpm typecheck` → 0. `pnpm lint` → 0 errors (24 pre-existing warnings; 0 in scope files). `pnpm vitest run` landing+legal → 6 pass. `pnpm test` (full) → **707 passed | 3 skipped (99 files)**.
- **M1 dev-route-smoke** (real dev :3000, hydrating; **ANONYMOUS** — `--auth __none__`, since the landing may redirect authed users), headSha `3faa778` == HEAD, `/` + `/terms` + `/privacy` × @360/768/1280 = 9 visits: **all ok=true, reasons=[], overlay="", pageErrors=[], no redirect (final=/route)**; real console errors 0, **antd deprecation 0**, status 200. `--check-smoke` → M3 PASS. admin diff empty.
- **Coordinator self visual inspection**: `/` @1280 = LandingHeader (logo + nav + 로그인/무료 시작) + hero (🐤 + "TOPIK 글쓰기, AI와 함께 끝까지" h1 + 무료 시작 primary) + 4 feature AppCards (AI 첨삭/실전 문제/성장 리포트/라이브러리) + "미리 보기" ProductPreview AppCards. `/terms` @1280 = centered AppCard (narrow) with the placeholder 이용약관 copy — readable Korean line length for the current short content. Flat white surfaces, no card-in-card, no horizontal scroll. @360 stacks cleanly.
- **Cross-model review: COMPLETED via GPT-5.5 (codex), 4 screenshots** (`-i root-{360,1280} terms-1280 privacy-1280`). Verdict: **MINOR ISSUES, 0 P1 / 3 P2.**
  - On-spec (GPT-5.5): landmark correct (PageContainer = single `<main>`, PublicShell adds none, one h1/page); AppCard usage on-spec, no card-in-card; preview cards calm; no loud color/overflow/shadow/horizontal-scroll at 1280/360.
  - [P2] #1 — landing 4 feature cards render `3 + 1` (auto-fit grid leaves a gap). **RECORDED**: pre-existing grid layout; changing to 4-up/2x2 alters the wireframe-specified structure → landing-polish follow-up.
  - [P2] #2 — header `무료 시작` and hero `무료 시작` both render as primary in the first viewport (two primary CTAs for one action). **RECORDED**: pre-existing; the fix (header secondary on landing only) adds landing-specific conditional logic + touches LandingHeader (outside this cluster's edits) → landing-polish follow-up.
  - [P2] #3 — legal `narrow`(480) is tight for real legal prose (original pages were ~720-760). **RECORDED**: current copy is short placeholder + reads fine at 480; PageContainer has no ~720 size (narrow 480 / default 1040); widen to ~720 when real legal copy lands → follow-up.
  - (Korean copy not evaluated — unchanged + image-based judgment mojibake-immune.)
- UX/UI Consistency Pass: passed
  - Tokens: no new inline magic numbers (M4 PASS); 1 documented `// ai-check: allow-inline-number` (privacy scope-note 12, value preserved).
  - Components: bare antd `Card` → `AppCard` ×4; public pages → `PublicShell` + `PageContainer`; existing h1s preserved. No Modal. No new antd deprecations (M6 PASS).
  - A11y: 3 bare `<main>` replaced by `PageContainer` (single `<main>` per public page); single h1 per page; no double-landmark.
  - Responsive: M1 @360/768/1280 all ok=true; landing/legal stack cleanly with no horizontal scroll.
- QA Gate: passed — real dev app M1 (anonymous) on 3 public routes @360/768/1280 (0 console/runtime/overlay/antd-deprecation); landing+legal unit + 707 full-suite green; admin diff empty; GPT-5.5 0 P1.
- **Deferred (honest): clean `pnpm build`** — dev reused; #130 risk ≈ 0 (public pages server components; AppCard/PublicShell/PageContainer server-safe; pilot proved the public pattern). Run when dev free.

## Ledger/File-State Consistency

- Commit this run: `3faa778` (public/legal UI, 6 files). Evidence commit (this ledger + smoke-result.json + 9 screenshots) follows.
- smoke-result.json headSha `3faa778` == HEAD. Concurrent-session artifacts present + left untouched: `.smoke-skip`, `harness-removal-plan.html`, `…/20260605-0940-harness-removal-plan-review.md`.
- Working tree after evidence commit = clean (aside from the concurrent artifacts).

## Risks And Follow-Up

- **Landing-polish pass (3 recommended P2s):** (1) feature grid 3+1 → 4-up or 2x2; (2) header vs hero dual primary CTA → header secondary on landing; (3) legal width 480 → ~720 for real legal prose. All deliberate-decision items (touch pre-existing layout / LandingHeader / PageContainer sizing).
- Clean prod build (the one un-run §Goal step) — run when dev free.
- **ALL user-facing clusters now done** (pilot + C1 auth → C2 practice → C3 writing → C4 feedback/reports → C5 library → C6 growth → C7 settings/profile → C8 paywall/subscription → public/legal). Remaining program-level items: human eyeball of dark mode; clean prod build; M1/M3 CI wiring; the cross-cutting smoke-harness `allowedDevOrigins` fix (done) is the key integrity upgrade this session.
- Multi-agent worktree: a concurrent session is drafting a "harness-removal plan" — heads-up for the owner; our M1 smoke harness is what just caught the real `/library` loop, so removing it would lose that signal.
