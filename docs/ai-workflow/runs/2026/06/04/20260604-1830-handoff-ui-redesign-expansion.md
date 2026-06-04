# HANDOFF — UI Redesign Expansion (Wireframe pages)

> ⛔ **SUPERSEDED (2026-06-04 19:45).** This was the cluster-2→3 snapshot. The current resume guide
> (clusters 1–4 done, next = cluster 5 library) is **`20260604-1945-handoff-ui-redesign-resume.md`** — read that instead.
> Kept for history only.

> **Read this first when resuming the Wireframe design-system expansion in a new session.**
> Created 2026-06-04 18:30 (+09:00) · Owner: Claude Code (Opus 4.8). Branch: `docs/auth-overview-consolidated-reference`.

## TL;DR (resume in 60s)

- **Goal (`/goal`):** apply the validated pilot design system to every user-facing screen in `docs/Wireframe/`, cluster by cluster, per `docs/ui-redesign/PLAN.md`.
- **Done + committed + real-app-verified:** pilot (`/login`, `/dashboard`) → **Cluster 1 (auth/onboarding, 7 screens)** → **Cluster 2 (practice + AppModal)** → **Cluster 3 (writing; `1b94306`+`36a4064`; M1 4 routes GREEN)** → **Cluster 4 (feedback/reports; `3df0535` UI + `555bb0c` evidence; M1 R-02 + E-01 + E-02 @360/768/1280 GREEN with seeded ids)**.
- **Next:** **Cluster 5 = library** (F-01 `/library`; F-M1 PdfExportModal → AppModal). Then growth (X-02 `/growth`, X-07 `/practice/weakness`) → settings → paywall → public/legal.
- **Cluster 4 notes:** D-M2 `AnalysisLoadingModal` is Card-based (no antd Modal). **R-01 `/writing/reports/[id]/compare` was NOT runtime-smoked** — no seeded `comparison_reports` row and seeding it needs an elevated service-role DB write (safety-classifier flagged + out of scope); covered by typecheck + reports unit test + the AppCard pattern proven on E-01/E-02/R-02. To smoke R-01 later, seed a comparison report (current `…055` vs previous `…051`, both q51 seeded) with user authorization. Seeded student submissions for E-01/E-02 smoke: `a0d17000-…051` (q51/short), `…053` (q53/long), feedback_status=complete (`scripts/audit-setup/verify-seed-data.mjs`). Cluster-4 ledger: `20260604-1915-ui-redesign-cluster4-feedback-reports.md`.
- **Cluster 3 note:** resolved the concurrent-Codex writing route-rename (`e7494e4`, user-approved) + a pre-existing stale library test (`19f0d30`). `.smoke-skip` removed (Stop hook live).
- **Known pre-existing (not a cluster regression):** at ≤360px the WorkspaceShell sidebar stays inline (doesn't collapse to the mobile drawer) → authed-page content is narrow. Affects all authed pages since cluster 1; a shell/header mobile-nav follow-up, not the per-cluster component work.
- **How:** follow "The expansion recipe" below. Each cluster = surgical edits → static gates → **real-app M1 dev-smoke (PowerShell)** → commit code → commit evidence. Admin is **frozen** (never touch).
- **The machine gates judge reality, not your report** (PLAN §A0). "Done" = gate exit codes + M1 ok, not a claim.

## Resume reading order

1. `CLAUDE.md` + `docs/ai-development-workflow.md` (workflow, lanes, gates).
2. `docs/ui-redesign/PLAN.md` — **§Goal** (machine-derivable), **§강제성 A0**, gates **M1–M6/C1** table, **§확장 로드맵** (cluster order), §공통 규칙 (#14 use-client, M4, M6).
3. `DESIGN.md` (root) — the **visual** source of truth (8-based SPACING, calm/flat, color=meaning, dark=darkAlgorithm, 9 approved `--app-*` bridge tokens).
4. **This handoff.**
5. Cluster ledger: `docs/ai-workflow/runs/2026/06/04/20260604-1642-ui-redesign-expansion-cluster1-auth.md` (clusters 1 + 2 + the concurrent-Codex reconciliation).
6. Memory: `project-ui-redesign-pilot-plan`, `feedback-ui-completion-requires-dev-server`, `project-antd-compound-server-component-react130`, `project-pnpm-build-clobbers-dev-server`, `feedback-concurrent-agent-worktree`.
7. `git log --oneline -12` and `git status --short` (confirm state below).

## Committed state (branch `docs/auth-overview-consolidated-reference`, do NOT switch)

| commit | what |
|---|---|
| `bda3790` (older) | pilot: /login + /dashboard + shell on the shared design system |
| `3bef425` | fix: pre-existing typecheck debt (read-pilot-goal test missing `@ts-expect-error`) |
| `c29f48b` | **Cluster 1** auth/onboarding UI (7 screens) |
| `cbb8285` | Cluster 1 M1 evidence + 19 screenshots |
| `2825c5a` | **Codex session** route-nav audit (static /writing/51..54, writingProblemHref, dev-preview removed) — committed by me to keep HEAD consistent |
| `b5b345e` | **Cluster 2** practice UI + **AppModal** (first modal cluster) |
| `c96d821` | Cluster 2 M1 evidence + 6 screenshots |

`git log` HEAD should be `c96d821` (unless work continued). All committed work is gate-verified.

## Shared design-system primitives (already built — reuse, don't recreate)

`src/components/shared/`: `PublicShell`, `PageContainer` (the single `<main>`, sizes narrow=480/default=1040/wide=1280), `PageHeader` (semantic `<header>`+`<h1>`, no copy of its own), `AppCard` (antd Card + `.app-card`/`.app-surface` hooks, server-safe), `AppDrawer`, **`AppModal`** (antd Modal + `.app-modal` hook, `"use client"`). Tokens: `src/theme/spacing.ts` → `SPACING {xs:4,sm:8,md:16,lg:24,xl:32}`. Layout CSS hooks live in `src/styles/global.css` (`.app-page-container*`, `.app-page-header*`, `.app-public-shell*`, `.app-card-compact`, **`.app-workspace-narrow`**).

## The expansion recipe (apply to EACH cluster)

1. **Understand:** for each screen in the cluster, read `docs/Wireframe/NN-CODE-name/description.md` + `functional-spec.md` + the current `src/app/.../page.tsx` and its rendered components. (A read-only `Explore`/Workflow fan-out per screen producing a structured edit-list works well and saves context — see the cluster-1/2 understand workflows.)
2. **Edit surgically (visual/structural ONLY — never change copy/i18n keys/behavior/routes/data):**
   - **Public (pre-auth) page** → `<PublicShell><PageContainer size="narrow"><AppCard>{form}</AppCard></PageContainer></PublicShell>` (mirror `src/app/login/page.tsx`).
   - **Authed page** (inside `WorkspaceShell`) → **DO NOT use PageContainer** (antd `Layout.Content` already renders the `<main>` landmark; a 2nd `<main>` is an a11y bug). For a constrained form use `<div className="app-workspace-narrow">`; data/list pages render directly into Content (full width). Use `<PageHeader title=… subtitle=… />` for the page h1.
   - **Bare antd `<Card>` → `<AppCard>`** (drop ad-hoc inline `maxWidth`/`margin`; preserve `aria-*`/`role`/`data-testid`/`textAlign`). Remove `Card` from the antd import.
   - **antd `<Modal>` → `<AppModal>`** (forwards all props; adds `.app-modal`). Remove `Modal` from the antd import.
   - **Migrate every antd deprecation that RENDERS on the route** (M1 catches runtime warnings): `<Space direction>`→`orientation`; `bodyStyle/headStyle`→`styles.*`; `Tabs.TabPane`→`items`; `dropdownClassName`→`popupClassName`; `Statistic valueStyle`→`styles.content`. **NOTE: antd 6.4.3 `Descriptions` uses boolean `bordered` — that is CORRECT, NOT deprecated; do not "migrate" it to `variant`.**
   - **`"use client"`** on any component rendering compound antd (Modal/Form/Tabs/Typography-destructure/Radio.Group/Descriptions/Steps/Skeleton.Button).
3. **Static gates (dev server stays up; these don't touch `.next`):**
   - `node scripts/ai-workflow-check.mjs --repo . --check-inline-styles --check-antd-deprecations` (M4 + M6) → exit 0
   - `pnpm typecheck` → 0 · `pnpm lint` → 0 errors · `pnpm vitest run <touched test dirs>` → green
4. **Commit the cluster code** (so the smoke is fresh at the UI-commit HEAD — the Stop hook checks `smoke.headSha == HEAD`). Stage ONLY your files.
5. **Real-app M1 dev-smoke (THE acceptance gate) — run via PowerShell, not Bash:**
   ```
   node scripts/dev-route-smoke.mjs --routes /a,/b --viewports 360,768,1280 --auth tests/e2e/auth-state/student.json --port 3000
   ```
   Confirm every `perRouteResult[].ok === true`, `reasons:[]`, no `overlayText`, 0 antd deprecation in consoleErrors (HMR-websocket noise is filtered and fine). Then `node scripts/ai-workflow-check.mjs --repo . --check-smoke` (M3) + `git diff --name-only -- src/components/admin "src/app/(workspace)/admin"` (admin diff must be EMPTY).
6. **Look at the screenshots yourself** (`docs/ui-redesign/pilot-shots/`) — don't trust ok=true alone (project's #1 lesson).
7. **Commit evidence** (smoke-result.json + the cluster's screenshots; NOT the inherited `dashboard-*.png`). Update the ledger + memory.
8. **Human visual review** (`#3`, non-substitutable per PLAN/memory) — surface screenshots; dark mode too.

## Critical traps (all hit this session)

- **Git Bash mangles `--routes /a,/b`** (turns leading `/` into `C:/Program Files/Git/...`). **Run dev-route-smoke via the PowerShell tool.**
- **Dev server is shared/running on :3000** — M1 **reuses** it. **Never run `pnpm build` while dev is up** (corrupts `.next`; M5 preflight blocks it). The one un-run §Goal step is the clean prod build — run it only when dev is down (`dev 정지 → rm -rf .next → pnpm build`), then restart dev. #130 risk is ~0 (server pages delegate to client; only server-rendered antd is `<Space>`, same as the dashboard pilot).
- **M4 only flags BARE numeric literals** in `width/height/min*/max*/padding*/margin*/gap/borderRadius/top/right/bottom/left/inset`. **String values (`margin:"8px 0"`) and `fontSize/opacity/zIndex/flex*`/`borderWidth`/`size` are NOT flagged** (strings are stripped before matching). So only tokenize bare numbers on lines you actually touch/re-indent; module-scope constants (srOnlyStyle, chipStyle) stay safe if untouched. **Never change a visual VALUE to fit a token** (e.g. don't turn 80→32 or 12→16) — use a named constant or `// ai-check: allow-inline-number <reason>` if you must keep an off-scale number.
- **Stop hook (`scripts/hooks/require-ui-smoke.mjs`)** blocks turn-end if UI changed without a fresh, all-ok M1 artifact at HEAD. Order is **edit → commit → smoke**. Evidence/docs commits don't reset it (UI_RE = `src/...`). `.smoke-skip` sentinel = intentional defer.
- **Transient redirect routes** (e.g. `/auth/callback-fragment`) make `classifyRouteResult` set `ok:false` (any redirect = reason). **Exclude them from the canonical smoke** (like C1 excludes admin/dynamic) and verify separately.
- **Dynamic `[id]`/`[questionId]` routes** (feedback/reports) are excluded by C1 and not directly visitable — M1 needs a real id (seed one, or smoke a static variant). Writing is now static `/writing/51..54` (Codex), so it IS smokeable.
- **Concurrent multi-agent worktree:** the user runs **Claude + Codex in parallel** on the same tree. **Always `git status` (full) before committing** to catch another agent's uncommitted changes; commit by concern; never `git add -A`; ambient files (below) go in no commit. See `feedback-concurrent-agent-worktree`.

## Ambient / inherited dirty files — do NOT commit (not part of any cluster)

`next-env.d.ts` (Next auto-gen), `src/app/layout.tsx` (prior-session `suppressHydrationWarning` extension fix — decide separately), `docs/ui-redesign/pilot-shots/dashboard-{360,768,1280}.png` (prior session), `errors/` (a debug screenshot), `fonts/pretendard/` (abandoned? DESIGN.md uses system-ui — confirm w/ user before using/removing), `verify-landing.mjs` + `verify-pilot.mjs` (legacy `/dev-preview` scratch). None are mine; surfaced for the user to decide.

## Remaining clusters + screen → route/file map (admin EXCLUDED: H-01, X-08, X-10, X-15)

| # | cluster | screens (IA → route) | notes |
|---|---|---|---|
| **3** | **writing** | D-01..D-04 writing pages (route names **IN FLUX** — see ⚠️); D-M1 SubmissionConfirmModal, D-M2 AnalysisLoadingModal, D-M3 AutosaveWarningModal | editor/conditions/references UI; the 3 modals → **AppModal**; `Descriptions`/`Steps`/`Spin` present. Codex left editor *visuals* to us. **⚠️ The Codex session was actively renaming the writing routes at handoff time** (`/writing/51..54` → `/writing/short-answer-writing-51`, `answer-writing-52`, `long-form-writing-53`, `essay-writing-54`, + touching `WritingPageContent`/`FeedbackPageContent`/`reports/[id]/compare`). **Re-derive the actual writing routes from `src/app/(workspace)/writing/` at resume — do not trust these names.** Coordinate with / let the Codex route work settle + commit first. |
| 4 | feedback/reports | E-01 `/writing/feedback/short/[id]`, E-02 `/writing/feedback/long/[id]`, R-01 `/writing/reports/[id]/compare`, R-02 `/practice/next` | **dynamic `[id]`** → seed a real submission id for M1, or smoke `/practice/next` (static) + unit-test the [id] views. |
| 5 | library | F-01 `/library`, F-M1 PdfExportModal → AppModal | Codex added `question_no` to library views. |
| 6 | growth | X-02 `/growth`, X-07 `/practice/weakness` | weakness has a server paywall gate (plain HTML branch). `GrowthDashboard` uses `Statistic` (watch `valueStyle`). |
| 7 | settings/profile | G-01 `/settings/language`, X-09 `/settings/notifications`, X-05 `/profile` | forms → `.app-workspace-narrow` + AppCard. notifications uses Tabs/Switch/TimePicker. |
| 8 | paywall/subscription | X-03 `/paywall`, X-04 `/subscription` | client shells (PaywallShell/SubscriptionShell). |
| (P) | public/legal | X-01 `/` (landing), X-13 `/terms`, X-14 `/privacy` | public → PublicShell; landing is plain-CSS hero; legal is static semantic HTML. |

(Full current src/app route tree + per-screen DS status was mapped in the cluster-1 understand pass — re-run a quick Explore if needed.)

## Open follow-ups / honest gaps

- **Human visual review of clusters 1 + 2** is still PENDING (screenshots in `pilot-shots/`). Confirm card/spacing patterns BEFORE scaling further — they propagate to ~25 more screens (they are conservative extensions of the approved pilot, so low rework risk).
- **Clean prod build** not run this session (dev was up) — run when dev is free.
- **Dark mode** verified only by parity test + low-risk reasoning (no theme-token change); eyeball it in review.
- **M1/M3 CI wiring** (browser + auth) still deferred (only M4/M6 are wired in `.github/workflows/`).
- **Existing (non-delta) antd deprecations** on not-yet-touched screens are cleared per-cluster as you smoke each route (hook + M1).
- **Codex's route-nav work** (commit 2825c5a) was committed by me to keep HEAD consistent; if the Codex session expects to commit it itself, reconcile (it's already in history).
