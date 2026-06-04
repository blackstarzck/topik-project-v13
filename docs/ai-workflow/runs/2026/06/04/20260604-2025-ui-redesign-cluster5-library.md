# Context Ledger — UI Redesign Cluster 5 (library)

## Run Metadata

- Run id: 20260604-2025-ui-redesign-cluster5-library
- Created: 2026-06-04 20:25 (+09:00)
- Main session owner: Claude Code (Opus 4.8, 1M ctx) — coordinator + durable context owner
- Implementation: isolated sub-agent ("new session" per cluster, per user directive) — understand + surgical edits + self static-gates
- Human/visual review: delegated to **GPT-5.5 (codex)** with screenshots attached (per user directive)
- Host: Claude Code · Effort: ultracode
- Branch: `docs/auth-overview-consolidated-reference` (do NOT switch)
- Status: **cluster-5 verified** — M1 /library @360/768/1280 all ok (0 console/runtime/overlay/antd-deprecation) + static gates + full suite GREEN + GPT-5.5 visual review (0 P1 / 2 P2, both out-of-cluster-scope)
- Resume guide: `20260604-1945-handoff-ui-redesign-resume.md`; prior cluster ledger `20260604-1915-…cluster4-feedback-reports.md`

## Task

- Apply the validated pilot design system to the **library cluster** (Cluster 5) per `docs/ui-redesign/PLAN.md`
  §확장 로드맵. Visual/structural ONLY — never copy/i18n/behavior/routes/data/props.
- Screen: F-01 `/library`. F-M1: `PdfExportModal` antd `<Modal>` → shared `<AppModal>`.
- Out of scope (absolute): admin (frozen); theme global tokens; no new DB schema; the `question_no` field (concurrent-agent data, not visual).

## Docs Consulted

- `docs/ui-redesign/PLAN.md` (§Goal, §A0, M1–M6/C1 gate table, 확장 로드맵, 공통 규칙: use-client #14, M4, M6).
- `DESIGN.md` (visual SoT: SPACING xs4/sm8/md16/lg24/xl32, calm/flat, color=meaning, never card-in-card → `.app-card-compact`,
  elevation only on floating surfaces, flat buttons, dark=darkAlgorithm, 9 approved `--app-*` bridge tokens).
- `src/components/shared/{AppCard,AppModal,PageHeader}.tsx` (thin pass-through wrappers — server-safe AppCard/PageHeader; client AppModal).
- `src/theme/spacing.ts` (SPACING consts). `src/styles/global.css` (`.app-card`/`.app-card-compact`/`.app-modal` hooks).
- Wireframe spec for F-01 (library: search/filter, selection-driven export/review actions, saved-answer list, right-rail stats, pagination).
- `scripts/{dev-route-smoke,derive-smoke-routes,ai-workflow-check}.mjs`, `scripts/hooks/require-ui-smoke.mjs`.
- `CLAUDE.md`, `docs/ai-development-workflow.md`. Memory: project-ui-redesign-pilot-plan, feedback-ui-completion-requires-dev-server,
  feedback-concurrent-agent-worktree, project-antd-compound-server-component-react130, project-dev-immutable-cache-stale-chunk.
- Audience: **user** (library is user-facing, RLS auth.uid()-scoped; no admin).
- Doc conflicts: none.
- Untouched relevant docs: `docs/ant-design/08-theme-architecture.md` (not editing theme; rules pre-encoded in the wrappers I reuse).
  `docs/user-admin-consistency-method.md` (no shared-entity schema read/write; visual only — `question_no` logic untouched).

## Progress log

- Precondition: `git status` — only ambient/inherited files dirty (no concurrent-Codex src changes at start). HEAD `395f435`.
- Understand + implement: isolated sub-agent read DESIGN.md + wrappers + F-01 spec + all `src/components/library/**`, applied surgical edits, self-ran static gates.
- Coordinator re-verified all decisive gates (did NOT trust the sub-agent report — A0: judgment = machine reality observed by coordinator).
- **Commit `4e0cc3d`** (cluster-5 UI, 4 files). M1 dev-smoke at that HEAD.
- GPT-5.5 (codex) visual review with the 3 real-app screenshots attached → 0 P1 / 2 P2 (both out of cluster scope; see Cross-model review).

## Active Files

- Changed (commit `4e0cc3d`, 4 files):
  - `src/app/(workspace)/library/page.tsx`: dropped duplicate `<main>` landmark + centering hack (Layout.Content is the `<main>`);
    bare `<h1>{t("heading")}</h1>` → `<PageHeader title={t("heading")} />`; reading-width cap (maxWidth 1200) hoisted to module const
    `LIBRARY_CONTENT_STYLE` with same-line `// ai-check: allow-inline-number` (off-scale px cap, value unchanged). Stays a server component.
  - `src/components/library/PdfExportModal.tsx` (F-M1): antd `<Modal>` → `<AppModal>`; removed `Modal` import, added `AppModal`. ("use client" already present.)
  - `src/components/library/LibraryTabs.tsx`: selection/actions bar `<Card size="small">` → `<AppCard size="small">`; removed `Card` import.
  - `src/components/library/LibraryStatsPanel.tsx`: empty-state + main stats `<Card>` → `<AppCard>` (×2); removed `Card` import.
- NOT changed (no bare antd Card/Modal): the other library components + `.ts` data helpers. `question_no` logic untouched.
- NOT touched: admin (frozen); theme global tokens.

## Verification State

- Checks run at HEAD `4e0cc3d` (cluster-5 UI commit), re-run by the coordinator:
  - `node scripts/ai-workflow-check.mjs --repo . --check-inline-styles --check-antd-deprecations` → PASS repo state + M4 PASS + M6 PASS (exit 0).
    One design-value literal escaped with same-line `// ai-check: allow-inline-number` (maxWidth 1200 reading-width cap, off the SPACING scale, value preserved).
  - `pnpm typecheck` → GREEN (exit 0) — all AppCard/AppModal/PageHeader imports resolve, no orphan Card/Modal import.
  - `pnpm lint` → exit 0 (0 errors; 21 pre-existing warnings, none in touched files).
  - `pnpm vitest run tests/components/library tests/lib/library tests/integration/library-flow.test.ts` → 7 files / 43 tests PASS.
  - `pnpm test` (full suite) → **706 passed | 3 skipped (98 files: 96 passed | 2 skipped)** — no regressions from the `<main>`→`<div>` structural change.
  - **M1 dev-route-smoke** (real running dev :3000 reused, student.json), headSha `4e0cc3d` == HEAD, route `/library` × @360/768/1280 = 3 visits:
    **all ok=true, fatal=false, redirected=false, reasons=[], overlayText="", pageErrors=[]**; consoleErrors = HMR-websocket dev-noise only
    (`ws://…/_next/webpack-hmr … ERR_INVALID_HTTP_RESPONSE`, filtered) → real console errors 0, **antd deprecation 0**; status 200 (auth session valid, no login redirect).
  - **Coordinator self visual inspection** (read the PNGs directly, per user directive to verify runtime with own eyes):
    @1280 — PageHeader "내 서재" h1 + search bar + actions AppCard (선택 0개 / PDF 내보내기 / 복습 세트 생성, disabled when no selection)
    + tabs (저장 답안/비교 리포트/저장 문제/내보내기, list lazy-loading spinner) + right-rail "내 서재 통계" AppCard empty-state.
    Flat white AppCard surfaces on calm canvas, no card-in-card, no horizontal scroll. @768 same, 1-col-ish. @360 — see Responsive note below.
  - `node scripts/ai-workflow-check.mjs --repo . --check-smoke` → M3 PASS (testedRoutes ⊇ requiredRoutes, fresh headSha == HEAD).
  - admin diff (`git diff --name-only -- src/components/admin "src/app/(workspace)/admin"`, working + staged) → empty.
- **Cross-model review: COMPLETED via GPT-5.5 (codex, default frontier model) — visual review with the 3 real-app screenshots attached**
  (`codex exec -i library-{360,768,1280}.png -s read-only`, medium reasoning). Verdict: **OVERALL MINOR ISSUES, 0 P1 / 2 P2**.
  - On-spec (GPT-5.5): surface treatment conforms (flat white, quiet border, ~8px radius, no decorative shadow, no card-in-card);
    spacing reads 16/24 rhythm; hierarchy acceptable (PageHeader clear title, disabled buttons keep actions secondary, no extra primary);
    `maxWidth:1200`+`marginInline:auto` reasonable on desktop (sidebar leaves ~1040px); empty states calm; a11y improved by dropping nested `<main>`.
  - [P2] #1 — @360 content column unusable because the WorkspaceShell sidebar does not collapse to a drawer. GPT-5.5 explicitly marked this
    the **known shell-level mobile-nav issue, NOT a library-cluster regression**. → tracked as the cross-cutting follow-up (below), not fixed here.
  - [P2] #2 — desktop right stats panel sits high with strong weight in empty state, slightly competing with main controls. Advisory polish.
    → recorded, NOT applied: fixing it expands beyond the conservative Card→AppCard swap (would restructure empty-state layout/logic), against the
    plan's locked "conservative extensions only" decision. No P1; nothing blocks the cluster.
  - (Korean copy was NOT evaluated by GPT-5.5 — unchanged and out of scope; and the visual judgment is image-based so the codex-Windows-mojibake
    trap does not apply to the screenshots.)
- UX/UI Consistency Pass: passed
  - Tokens: no new inline magic numbers (M4 PASS). 1 design-value literal (maxWidth 1200 reading cap) escaped with documented
    `// ai-check: allow-inline-number` (off-SPACING-scale; value preserved, not tokenized to avoid changing the visual).
  - Components: bare antd `Card` → shared `AppCard` ×3 (LibraryTabs actions bar, LibraryStatsPanel empty + main); antd `Modal` → `AppModal` ×1
    (PdfExportModal, F-M1); `Card`/`Modal` removed from antd imports; post-edit grep `\bCard\b`/`\bModal\b` over both library dirs clean
    (remaining `Modal` matches = prose comments only). No new antd deprecations (M6 PASS); `Space direction`/`Form` in PdfExportModal left on untouched lines.
  - A11y: removed the duplicate `<main>` on the library page (antd Layout.Content is the main landmark) — same fix as clusters 1-2/4;
    `PageHeader` renders semantic `<header>`+h1; aria/role/data-testid preserved.
  - Responsive: M1 @360/768/1280 all ok=true; cards stack with no horizontal scroll. **@360 shell crowding (pre-existing, not a cluster-5 regression):**
    WorkspaceShell sidebar stays inline at 360px (does not collapse to drawer) → authed content squeezed, Korean text wraps hard. Same across clusters 1-4;
    GPT-5.5 [P2] #1 confirms shell-level. Library cards themselves stack 1-col correctly. Shell mobile-nav is a separate follow-up.
- QA Gate: passed — real dev app M1 on `/library` @360/768/1280 (0 console errors, 0 runtime/pageError, 0 overlay, 0 antd deprecation);
  43 library unit/integration + 706 full-suite green; admin diff empty; GPT-5.5 visual review 0 P1.
- **Deferred (honest): clean `pnpm build`** — dev reused for M1 (M5 blocks build-while-dev). #130 risk ≈ 0 (page stays a server component;
  AppCard/PageHeader server-safe; AppModal/tabs are client). Run when dev is free.

## Ledger/File-State Consistency

- Commits this run: `4e0cc3d` (cluster-5 UI, 4 files). Evidence commit (this ledger + smoke-result.json + 3 library screenshots) follows.
- smoke-result.json headSha `4e0cc3d` == cluster-5 UI commit HEAD (Stop-hook fresh; `.smoke-skip` absent).
- Working tree after evidence commit = only ambient/inherited (below).

## Ambient / inherited dirty files — NOT mine, do not commit

next-env.d.ts, src/app/layout.tsx, docs/ui-redesign/pilot-shots/dashboard-{360,768,1280}.png, errors/, fonts/, verify-landing.mjs, verify-pilot.mjs.

## Risks And Follow-Up

- **WorkspaceShell mobile-nav at ≤360 (TOP cross-cutting follow-up):** sidebar doesn't collapse to a drawer → all authed pages get a narrow
  content column + hard Korean text wrap. Pre-existing across clusters 1-5; GPT-5.5 flagged it [P2] this run. Affects the whole authed app →
  a dedicated shell task (re-verify all authed routes after), not a per-cluster component fix. **Recommend to the user as the next dedicated item.**
- [P2] stats-panel empty-state prominence (desktop) — advisory polish, recorded not applied (conservative-scope decision).
- Clean prod build (the one un-run §Goal step) — run when dev is free.
- Remaining clusters: 6 growth (X-02 /growth, X-07 /practice/weakness) → 7 settings/profile → 8 paywall/subscription → public/legal.
