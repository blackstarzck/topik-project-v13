# HANDOFF — UI Redesign Expansion (resume guide)

> **Read this FIRST when resuming the Wireframe design-system expansion in a new session.**
> Created 2026-06-04 19:45 (+09:00) · Owner: Claude Code (Opus 4.8, 1M). Branch: `docs/auth-overview-consolidated-reference`.
> **Supersedes** `20260604-1830-handoff-ui-redesign-expansion.md` (that one was the cluster-2→3 snapshot).

## ⚠️ CRITICAL UPDATE (2026-06-04 ~21:35) — read before resuming

1. **The M1 dev-smoke was SSR-ONLY (no client hydration) for the entire pilot + clusters 1-5.** Root cause: Next 16
   blocks `/_next/*` dev resources from `127.0.0.1` (default allows only `localhost`), and the smoke navigates via
   `127.0.0.1` → client components never hydrated under smoke. **Fixed** in `next.config.ts` →
   `allowedDevOrigins: ["127.0.0.1"]` (commit `f9ef7b6`). Now the smoke hydrates and actually exercises client behaviour.
   Ledger: `20260604-2130-shell-hydration-smoke-harness-fix.md`.
2. **The "@360 WorkspaceShell sidebar doesn't collapse" was a NON-BUG** — a pure artifact of the SSR-only smoke. With
   hydration unblocked, the ORIGINAL shell collapses correctly at ≤360 (hamburger + drawer). WorkspaceShell was NOT
   changed. (The earlier "fix the shell" plan is superseded.)
3. ✅ **FIXED — `/library` "Maximum update depth exceeded" render loop** (real pre-existing bug, masked by the
   SSR-only smoke). `LibrarySubmissionsTab`: `allItems` recomputed every render → `filtered` useMemo → selection-lift
   useEffect looped. Fix `useMemo(allItems,[query.data,initialItems])` (`6ad6494`) + regression test (`273fd5b`).
4. ✅ **RESOLVED — collision cleared.** The concurrent Codex antd sweep (~50 files) was committed at the user's
   request (`b67ad3b`). `.smoke-skip` removed; gate restored. **Clusters 1-5 re-verified clean under hydration**
   (28-route re-smoke, 0 errors, `1a2ff05`). **Rollout RESUMING at cluster 6 (growth).**
5. **Decisions are delegated to GPT-5.5 (codex)** per user directive; **human/visual review is delegated to GPT-5.5**
   with screenshots attached (`codex exec -i <route>-{360,768,1280}.png ...`). The smoke now HYDRATES, so per-cluster
   M1 actually exercises client behaviour (watch consoleErrors for "Maximum update depth"/antd-deprecation).

## TL;DR (resume in 60s)

- **Goal (`/goal`):** apply the validated pilot design system to every user-facing screen in `docs/Wireframe/`,
  cluster by cluster, per `docs/ui-redesign/PLAN.md`. Visual/structural ONLY — never change copy, i18n keys
  (`t("…")`), behavior, routes, data, or props contracts.
- **Done + committed + real-app-verified:** pilot (`/login`, `/dashboard`) → **C1 auth/onboarding (7)** →
  **C2 practice (+ AppModal)** → **C3 writing** → **C4 feedback/reports** → **C5 library** (GPT-5.5 visual review: 0 P1).
- **Next: Cluster 6 = growth** (X-02 `/growth`, X-07 `/practice/weakness`). Then settings/profile →
  paywall → public/legal. (admin is **FROZEN** — never touch: IA H-01/X-08/X-10/X-15.)
- **Per-cluster human/visual review is delegated to GPT-5.5 (codex) with screenshots attached** (user directive):
  `codex exec -i <route>-{360,768,1280}.png -s read-only -c 'model_reasoning_effort="medium"'`, prompt = English DESIGN.md rules
  + scope rules + the diff (Korean copy NOT evaluated → mojibake-immune since the visual judgment is image-based). Findings drive
  fixes: any P1 is fixed; P2 that would expand beyond the conservative Card→AppCard swap is recorded, not forced.
- **TOP cross-cutting follow-up (GPT-5.5 [P2] every cluster): WorkspaceShell does not collapse to a mobile drawer at ≤360px**
  → all authed pages get a narrow column + hard Korean wrap. Shell-level, not per-cluster. Recommend a dedicated shell task after the clusters.
- **How:** follow "The expansion recipe" below. Each cluster = surgical visual edits → static gates → **real-app
  M1 dev-smoke (PowerShell)** → commit code → commit evidence → update ledger/memory/this handoff.
- **The machine gates judge reality, not your report** (PLAN §A0). "Done" = gate exit codes + M1 ok, not a claim.
- **Concurrent Codex runs in the SAME worktree.** `git status` (full) before EVERY commit; never `git add -A`;
  commit by concern; ambient files (below) go in no commit. See `feedback-concurrent-agent-worktree`.

## Resume reading order

1. `CLAUDE.md` + `docs/ai-development-workflow.md` (workflow, lanes, gates, communication style = Korean default).
2. `docs/ui-redesign/PLAN.md` — §Goal (machine-derivable), §강제성 A0, gates M1–M6/C1 table, §확장 로드맵 (cluster order), §공통 규칙 (#14 use-client, M4, M6).
3. `DESIGN.md` (root) — the **visual** source of truth (8-based SPACING xs4/sm8/md16/lg24/xl32, calm/flat, color=meaning, dark=darkAlgorithm, 9 approved `--app-*` bridge tokens, **never card-in-card** → `.app-card-compact`).
4. **This handoff.**
5. Cluster ledgers: `20260604-1642-…cluster1-auth.md` (C1+C2), `20260604-1845-…cluster3-writing.md` (C3), `20260604-1915-…cluster4-feedback-reports.md` (C4).
6. Memory: `project-ui-redesign-pilot-plan` (latest state + per-cluster traps), `feedback-ui-completion-requires-dev-server`, `project-antd-compound-server-component-react130`, `project-pnpm-build-clobbers-dev-server`, `feedback-concurrent-agent-worktree`, `project-dev-immutable-cache-stale-chunk`.
7. `git log --oneline -16` and `git status --short` (confirm state below).

## Committed state (branch `docs/auth-overview-consolidated-reference`, do NOT switch)

| commit | what |
|---|---|
| `c29f48b` `cbb8285` | **C1** auth/onboarding UI + M1 evidence (7 screens) |
| `2825c5a` | Codex route-nav audit (static writing pages) — committed by me to keep HEAD consistent |
| `b5b345e` `c96d821` | **C2** practice UI + **AppModal** + M1 evidence |
| `49b6fb9` | old handoff doc |
| `19f0d30` | fix pre-existing stale library test (2825c5a added `question_no`, test not updated → HEAD was red) |
| `e7494e4` | **Codex writing route-rename** `/writing/51..54` → descriptive slugs (`short-answer-writing-51`, `answer-writing-52`, `long-form-writing-53`, `essay-writing-54`); committed with user approval to settle the concurrent work |
| `1b94306` `36a4064` | **C3** writing UI (Card→AppCard ×9, Modal→AppModal ×2) + M1 evidence (4 routes) |
| `3df0535` `555bb0c` | **C4** feedback/reports UI (Card→AppCard ×~30, /practice/next h1→PageHeader) + M1 evidence (3 routes) |
| `1fd4ec2` `395f435` | handoff updates |
| `4e0cc3d` `c69def2` | **C5** library UI (Card→AppCard ×3, PdfExportModal Modal→AppModal, page `<main>`→PageHeader) + M1 evidence + GPT-5.5 review |

HEAD should be `c69def2` (unless work continued). All committed work is gate-verified. `git status` should show ONLY the ambient/inherited files (below) — nothing else.

## Shared design-system primitives (already built — REUSE, do not recreate)

`src/components/shared/`:
- **`AppCard`** (server-safe, no "use client"): `<Card>` wrapper, forwards all `CardProps`, adds `.app-card`/`.app-surface`. Replace bare antd `<Card>` (preserve `size`/`title`/`aria-*`/`role`/`data-testid`/`textAlign`; drop ad-hoc inline `maxWidth`/`margin`). Remove `Card` from the antd import once unused.
- **`AppModal`** ("use client"): `<Modal>` wrapper, forwards all `ModalProps`, merges `rootClassName` with `"app-modal"`. Replace bare antd `<Modal>`.
- **`AppDrawer`** ("use client"): `<Drawer>` wrapper + `.app-drawer`.
- **`PageHeader`** (server-safe): `{ title, subtitle?, actions? }` → semantic `<header>` + h1. Use for an authed page's h1 (replaces a bare `<Title level=…>`/`<h1>` that acts as the page title).
- **`PageContainer`** (server-safe): the single `<main>`, sizes narrow=480/default=1040/wide=1280. **Public pages only.** **DO NOT use on authed pages** (antd `Layout.Content` already renders the `<main>` landmark → a 2nd `<main>` is an a11y bug).
- **`PublicShell`** (server-safe): pre-auth shell.
- Tokens: `src/theme/spacing.ts` → `SPACING {xs:4,sm:8,md:16,lg:24,xl:32}` (plain consts, RSC-safe). CSS hooks in `src/styles/global.css`: `.app-card*`, `.app-modal`, `.app-drawer`, `.app-page-header*`, `.app-public-shell*`, `.app-workspace-narrow`, `.app-card-compact`.

## The expansion recipe (apply to EACH cluster)

1. **Precondition:** `git status` (full). If there is uncommitted concurrent-Codex work, coordinate first (see traps). Confirm HEAD is clean of others' changes before you start.
2. **Understand (read-only):** for each screen, read `docs/Wireframe/NN-CODE-name/{description,functional-spec}.md` + the rendered components. A read-only Workflow fan-out (Explore agentType + a structured edit-list schema) per component group works well and saves context (see the C3/C4 understand workflows). Embed the DS primitive API + M4/M6 rules in the agent prompts so they don't re-derive.
3. **Edit surgically (visual/structural ONLY):**
   - Bare antd `<Card>` → `<AppCard>`; antd `<Modal>` → `<AppModal>`. Remove the now-unused name from the antd import. Verify with a `\bCard\b|\bModal\b` grep over the touched dirs (catches leftovers).
   - **Authed page** with a bare `<main style>`/`<h1>` → drop the `<main>` (Content is the landmark) and use `<PageHeader title=… />`. Constrained authed forms use `<div className="app-workspace-narrow">`; data/list pages render directly into Content.
   - **Public page** → `<PublicShell><PageContainer size="narrow"><AppCard>{form}</AppCard></PageContainer></PublicShell>` (mirror `src/app/login/page.tsx`).
   - Migrate antd deprecations that RENDER: `<Space direction>`→`orientation`; `bodyStyle/headStyle`→`styles.*`; `Tabs.TabPane`→`items`; `dropdownClassName`→`popupClassName`; `Statistic valueStyle`→`styles.content`. **`Descriptions bordered` (boolean) is CORRECT in antd 6.4.3 — do NOT migrate it.**
   - `"use client"` on any component rendering compound antd (Modal/Form/Tabs/Typography-destructure/Radio.Group/Descriptions/Steps/Skeleton.Button).
4. **Static gates** (dev server stays up; these don't touch `.next`): `node scripts/ai-workflow-check.mjs --repo . --check-inline-styles --check-antd-deprecations` (M4+M6) → exit 0 · `pnpm typecheck` → 0 · `pnpm lint` → 0 errors · `pnpm vitest run <touched test dirs>` → green · `pnpm test` (full) before claiming done.
5. **Commit the cluster CODE** (so the smoke is fresh at the UI-commit HEAD — the Stop hook checks `smoke.headSha == HEAD`). Stage ONLY your files (explicit paths, no `git add -A`).
6. **Real-app M1 dev-smoke (THE acceptance gate) — run via the PowerShell tool, not Bash:**
   ```
   node scripts/dev-route-smoke.mjs --routes /a,/b --viewports 360,768,1280 --auth tests/e2e/auth-state/student.json --port 3000
   ```
   Confirm every `perRouteResult[].ok === true`, `reasons:[]`, no `overlayText`, no `pageErrors`, and 0 antd deprecation in `consoleErrors` (the only allowed noise is the HMR-websocket `ERR_INVALID_HTTP_RESPONSE` lines — filtered, fine). Confirm `headSha == HEAD`. Then `node scripts/ai-workflow-check.mjs --repo . --check-smoke` (M3) + `git diff --name-only -- src/components/admin "src/app/(workspace)/admin"` (admin diff must be EMPTY).
7. **Look at the screenshots yourself** (`docs/ui-redesign/pilot-shots/`) — don't trust ok=true alone (project's #1 lesson).
8. **Fill the cluster ledger** (from `docs/ai-workflow/templates/context-ledger-template.md`) — the repo-state gate REQUIRES these sections when UI changed: `## Docs Consulted` (+ `Untouched relevant docs:`), `## Verification State` (+ `Cross-model review:`, `UX/UI Consistency Pass:` with `Tokens:`/`Components:`/`A11y:`/`Responsive:`, `QA Gate:`), `## Ledger/File-State Consistency`. Mirror an existing passing ledger's exact field labels.
9. **Commit evidence** (smoke-result.json + the cluster's screenshots; NOT the inherited `dashboard-*.png`) + update ledger/memory/this handoff.
10. **Human visual review** (`#3`, non-substitutable per PLAN/memory) — surface screenshots; dark mode too.

## Critical traps (all hit this session — read before editing)

- **Git Bash mangles `--routes /a,/b`** (turns leading `/` into `C:/Program Files/Git/…`). **Run dev-route-smoke via the PowerShell tool.**
- **Dev server is shared/running on :3000** — M1 **reuses** it. **Never `pnpm build` while dev is up** (corrupts `.next`; M5 preflight blocks it). The one un-run §Goal step is the clean prod build — run only when dev is down (`dev 정지 → rm -rf .next → pnpm build`), then restart dev. #130 risk ≈ 0 (server pages delegate to "use client" children; AppCard is server-safe).
- **M4 (inline-style delta)** flags BARE numeric literals in `style={{}}` for `width/height/min*/max*/padding*/margin*/gap/borderRadius/top/right/bottom/left/inset` — **including `0`**. NOT flagged: string values (`"8px 0"`, `"100%"`), `fontSize`/`opacity`/`zIndex`/`flex*`/`borderWidth`, and JSX attrs (Row `gutter`, Space `size`). It runs on **diff-added lines**, so a `<Card>`→`<AppCard>` swap only exposes numbers ON the same line. Escape hatch = `// ai-check: allow-inline-number <reason>` **ON THE SAME LINE as the number** (per-line raw test). You CANNOT put `//` inside a JSX attribute → extract the style object to a module const and put the comment trailing on the const line (see AnalysisLoadingModal `maxWidth:480`, DetailedFeedbackPanel `styles.body.paddingTop:0`). Never change a visual VALUE to fit a token.
- **`replace_all` with an indentation prefix misses other-indented identical tags.** Using `      <Card>` (6-space) skipped a 4-space `<Card>` in ScoreComparisonChart — caught only by the post-edit `\bCard\b` grep. Prefer **bare** old_strings (`<Card>`, `</Card>`) for replace_all, and ALWAYS grep the touched dirs for leftover `\bCard\b|\bModal\b` after.
- **Stop hook (`scripts/hooks/require-ui-smoke.mjs`)** blocks turn-end if UI (`src/…tsx|css`) changed (dirty OR in the last commit) without a fresh, all-ok M1 artifact at HEAD. Order is **edit → commit → smoke**. Evidence/docs commits don't touch UI so they don't re-arm it. `.smoke-skip` sentinel = intentional defer (it was removed when C3 resumed; recreate only to defer deliberately).
- **Dynamic `[id]` routes** (E-01/E-02 feedback, R-01 reports) need a real id to render (else `notFound()` → 404). Use the **deterministic audit seed** (`scripts/audit-setup/verify-seed-data.mjs`): student submissions `a0d17000-0000-4000-8000-000000000051` (q51/short → E-01), `…053` (q53/long → E-02), `…055` (q51), all `feedback_status=complete`. **R-01 has NO seeded `comparison_reports` row** — to smoke it, seed one (current `…055` vs previous `…051`) via service-role, **with user authorization**.
- **Service-role DB reads/writes are gated.** An ad-hoc node script using `SUPABASE_SERVICE_ROLE_KEY` to enumerate users/rows was **DENIED by the safety classifier** (PII into transcript). Don't work around it. Verify seed state the legitimate way: the **student-session dev-smoke** (200 vs 404). `.env.local` has the keys + `SUPABASE_ENV_LABEL=dev` (the project's own `verify-seed-data.mjs --apply` is the sanctioned seeding path, dev-guarded).
- **Concurrent multi-agent worktree:** Claude + Codex run in parallel here. Before any commit, `git status` (full); commit by concern; never `git add -A`; ambient files go in no commit. A surprise "linter revert" is usually the OTHER agent — suspect it first.

## Remaining clusters + screen → route/file map (admin EXCLUDED: H-01, X-08, X-10, X-15)

| # | cluster | screens (IA → route) | notes |
|---|---|---|---|
| ~~5~~ | ~~library~~ **DONE** (`4e0cc3d`/`c69def2`) | F-01 `/library`; F-M1 PdfExportModal → AppModal | Card→AppCard ×3 + Modal→AppModal + page `<main>`→PageHeader. M1 /library @3 viewports 0-error; GPT-5.5 0 P1. |
| ~~6~~ | ~~growth~~ **DONE** (`a2b20ab`/`8d5a9f0`/`3605c3b`) | X-02 `/growth`, X-07 `/practice/weakness` | Card→AppCard ×18 + card-in-card→`.app-card-compact`; weakness 2×`<main>` dropped + PageHeader. GPT-5.5: 2 P1 FIXED (growth title→PageHeader, weakness locked→AppCard), 2 P2 recorded. M1 paywall branch 0-error (free-plan; unlocked branch = unit+pattern, honest gap). |
| ~~7~~ | ~~settings/profile~~ **DONE** (`37ffc16`/`f3c4d4a`) | G-01/X-09/X-05 | Card→AppCard ×11; 3 pages drop `<main>` + h1→PageHeader; forms→`.app-workspace-narrow`; avatar div→AppCard. GPT-5.5 0 P1 / 2 P2 (recorded). |
| **8** | **paywall/subscription** ←NEXT | X-03 `/paywall`, X-04 `/subscription` | client shells (PaywallShell/SubscriptionShell in `src/components/settings/`). (antd deprecations already Codex-swept.) **Multi-agent worktree: a `.smoke-skip` from another session is present — leave it, rely on explicit per-cluster M1.** |
| (P) | public/legal | X-01 `/` (landing), X-13 `/terms`, X-14 `/privacy` | public → PublicShell; landing is plain-CSS hero; legal is static semantic HTML. |

## Open follow-ups / honest gaps

- **Human visual review of clusters 1–4 is PENDING** (screenshots in `pilot-shots/`). PLAN/memory mark it non-substitutable and "before scaling further." Recommend the user eyeball it before cluster 5+ (the patterns are conservative extensions of the approved pilot → low rework risk, but it's a real gate).
- **R-01 `/writing/reports/[id]/compare` was NOT runtime-smoked** (no seeded comparison report; seeding needs an authorized service-role write). Covered by typecheck + reports unit test (ReportsChrome) + the AppCard pattern proven on E-01/E-02/R-02. Seed + smoke it when authorized.
- **@360 WorkspaceShell sidebar does not collapse** to the mobile drawer → authed-page content is narrow and text wraps heavily. **Pre-existing across clusters 1–4, not a per-cluster regression.** A shell/header mobile-nav follow-up (separate from the component DS pass).
- **Clean prod build** not run (dev was up) — run when the dev server is free.
- **Dark mode** verified only by parity test + low-risk reasoning (no theme-token change); eyeball it in review.
- **M1/M3 CI wiring** (browser + auth) still deferred (only M4/M6 are wired in `.github/workflows/`).
- **Existing (non-delta) antd deprecations** on not-yet-touched screens are cleared per-cluster as you smoke each route (hook + M1).

## Ambient / inherited dirty files — do NOT commit (not part of any cluster)

`next-env.d.ts` (Next auto-gen), `src/app/layout.tsx` (prior-session `suppressHydrationWarning` for browser extensions — decide separately), `docs/ui-redesign/pilot-shots/dashboard-{360,768,1280}.png` (prior session), `errors/` (a debug screenshot), `fonts/pretendard/` (abandoned? DESIGN.md uses system-ui — confirm before using/removing), `verify-landing.mjs` + `verify-pilot.mjs` (legacy `/dev-preview` scratch). None are mine; surfaced for the user to decide.
