# Context Ledger — UI Redesign Cluster 7 (settings / profile)

## Run Metadata

- Run id: 20260605-0920-ui-redesign-cluster7-settings-profile
- Created: 2026-06-05 09:20 (+09:00) · Owner: Claude Code (Opus 4.8, 1M ctx) — coordinator
- Implementation: isolated sub-agent. Human/visual review: delegated to **GPT-5.5 (codex)** with screenshots. Decisions delegated to GPT-5.5.
- Branch: `docs/auth-overview-consolidated-reference`
- Status: **cluster-7 verified** — M1 3 routes @360/768/1280 all ok (0 console/runtime/overlay/antd-deprecation) + static gates + full suite GREEN + GPT-5.5 review (0 P1 / 2 P2 recorded)

## Task

- Apply the validated design system to **settings/profile** (Cluster 7): G-01 `/settings/language`, X-09 `/settings/notifications`, X-05 `/profile`. Visual/structural ONLY.
- Out of scope: admin (frozen); theme global tokens; no new DB schema; PaywallShell/SubscriptionShell (cluster 8); form validation/submit logic. antd deprecations already Codex-swept.

## Docs Consulted

- `docs/ui-redesign/PLAN.md` (§Goal/§A0/gates/공통 규칙), `DESIGN.md` (SPACING, AppCard, never card-in-card, color=meaning, one primary action).
- `src/components/shared/{AppCard,PageHeader}.tsx`, `src/theme/spacing.ts`, `src/styles/global.css` (`.app-workspace-narrow`, `.app-card*`).
- Wireframe specs G-01/X-09/X-05. Pages `settings/{language,notifications}/page.tsx`, `profile/page.tsx` (server).
- `scripts/{dev-route-smoke,ai-workflow-check}.mjs`. `CLAUDE.md`, `docs/ai-development-workflow.md`.
- Memory: project-ui-redesign-pilot-plan, project-dev-smoke-127-cross-origin-no-hydration, feedback-concurrent-agent-worktree.
- Audience: **user** (RLS auth.uid()). Doc conflicts: none. Untouched relevant: `docs/ant-design/08-theme-architecture.md` (no theme change).

## Active Files (commit `37ffc16`, 8 files)

- Pages: `settings/language/page.tsx`, `settings/notifications/page.tsx`, `profile/page.tsx` — each dropped own `<main>` + bare `<h1>` → `<PageHeader>`; language/notifications → `.app-workspace-narrow`; profile kept its 2-col Row/Col data layout.
- Components: `settings/{LanguageForm(×3),NotificationPrefsForm(×4)}`, `profile/{ExamInfoCard(×2),StatusHelpCard(×1)}` Card→AppCard; `profile/ProfileForm` hand-built avatar `<section>` bordered div → `<AppCard size="small" role="region" aria-label>` (SPACING.md gap).
- Card→AppCard ×11; Modal→AppModal 0. NOT touched: admin, theme tokens, Paywall/Subscription shells.

## Verification State

- Coordinator re-ran (A0): `ai-workflow-check --check-inline-styles --check-antd-deprecations` → PASS + M4 + M6 (exit 0; no inline-number escapes). `pnpm typecheck` → 0. `pnpm lint` → 0 errors (24 pre-existing warnings; the `ProfileForm avatarPath` unused warning is pre-existing state-hook debt, not introduced). `pnpm vitest run` settings+profile → 6 files / 32 pass. `pnpm test` (full) → **707 passed | 3 skipped (99 files)**.
- **M1 dev-route-smoke** (real dev :3000, hydrating; student.json), headSha `37ffc16` == HEAD, `/settings/language` + `/settings/notifications` + `/profile` × @360/768/1280 = 9 visits: **all ok=true, reasons=[], overlay="", pageErrors=[]**; consoleErrors = HMR-noise only → real console errors 0, **antd deprecation 0**, status 200.
- `ai-workflow-check --check-smoke` → M3 PASS (fresh). admin diff empty.
- **Coordinator self visual inspection** (@1280): /profile = PageHeader "프로필" h1 + 2-col (form left: email/name/nickname/bio + avatar AppCard w/ image-change + info Alert; right: 목표 시험 + 계정 상태 AppCards). language/notifications forms in `.app-workspace-narrow` with section AppCards; notifications Tabs/Switch/TimePicker/weekday CheckableTags render cleanly inside AppCards. @360 sidebar collapses to hamburger, full-width. All flat white surfaces, no card-in-card.
- **Cross-model review: COMPLETED via GPT-5.5 (codex), 4 screenshots** (`-i settings_language-1280 settings_notifications-1280 profile-1280 profile-360`). Verdict: **MINOR ISSUES, 0 P1 / 2 P2.**
  - On-spec (GPT-5.5): no card-in-card (Alert-in-AppCard is fine); PageHeader singular h1, no duplicate `<main>`; language/notifications sensibly constrained; profile 2-col + 360 readable, sidebar collapsed, no horizontal overflow; notifications controls clean; no loud color/shadow noise.
  - [P2] #1 — LanguageForm help `<ul>` `paddingLeft: 18` is off the 8-scale. **RECORDED, not fixed**: pre-existing value on an untouched line; tokenizing (18→16/24) would CHANGE the visual value (PLAN rule: never change a visual value to fit a token).
  - [P2] #2 — ProfileForm avatar `AppCard size="small"` is visually tighter than the other profile cards. **RECORDED, not fixed**: intentional compact sub-region (preserves the original `<section>` padding); default padding would change the value.
  - (Korean copy not evaluated — unchanged + image-based judgment is mojibake-immune.)
- UX/UI Consistency Pass: passed
  - Tokens: no new inline magic numbers (M4 PASS); ProfileForm avatar gap uses `SPACING.md`.
  - Components: bare antd `Card` → `AppCard` ×11; bare `<h1>` page title → `PageHeader` ×3; hand-built bordered `<section>` → `AppCard`. No Modal. No new antd deprecations (M6 PASS).
  - A11y: 3 duplicate `<main>` dropped (Layout.Content is the landmark); PageHeader semantic `<header>`+singular h1 per page; avatar AppCard keeps `role="region"`+aria-label; aria/data-testid preserved.
  - Responsive: M1 @360/768/1280 all ok=true; shell collapses to hamburger at 360; forms/cards stack with no horizontal scroll.
- QA Gate: passed — real dev app M1 on 3 routes @360/768/1280 (0 console/runtime/overlay/antd-deprecation); settings+profile unit + 707 full-suite green; admin diff empty; GPT-5.5 0 P1.
- **Deferred (honest): clean `pnpm build`** — dev reused; #130 risk ≈ 0 (pages server components; AppCard server-safe). Run when dev free.

## Ledger/File-State Consistency

- Commit this run: `37ffc16` (cluster-7 UI, 8 files). Evidence commit (this ledger + smoke-result.json + 9 screenshots) follows.
- smoke-result.json headSha `37ffc16` == HEAD. A concurrent session's `.smoke-skip` is present (moot for our committed+smoked work; left untouched per multi-agent protocol).
- Working tree after evidence commit = clean (aside from the other session's `.smoke-skip`).

## Risks And Follow-Up

- [P2] LanguageForm `<ul>` paddingLeft 18 (off-scale) + [P2] avatar AppCard size parity — advisory; revisit in a deliberate polish/token pass.
- Clean prod build (un-run §Goal step) — run when dev free.
- Multi-agent worktree: 2-3 sessions active; another left `.smoke-skip` (moot). Keep `git status` before every commit; never `git add -A`.
- Remaining clusters: 8 paywall/subscription (X-03 /paywall, X-04 /subscription) → public/legal (X-01 /, X-13 /terms, X-14 /privacy).
