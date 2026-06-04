# Context Ledger — UI Redesign Cluster 3 (writing)

## Run Metadata

- Run id: 20260604-1845-ui-redesign-cluster3-writing
- Created: 2026-06-04 18:45 (+09:00) · Updated: 2026-06-04 19:10
- Main session owner: Claude Code (Opus 4.8, 1M ctx) — coordinator + durable context owner
- Host: Claude Code · Effort: ultracode (workflows by default)
- Branch: `docs/auth-overview-consolidated-reference` (do NOT switch)
- Status: **cluster-3 verified (M1 + static gates + full suite GREEN)** — clean prod build deferred (dev reused) — pending human visual review
- Resume guide: `20260604-1830-handoff-ui-redesign-expansion.md`

## Task

- Apply the validated pilot design system to the **writing cluster** (Cluster 3) per
  `docs/ui-redesign/PLAN.md` §확장 로드맵. Visual/structural ONLY — never copy/i18n/behavior/routes/data.
- Screens (IA → route, post-Codex rename): D-01 `/writing/short-answer-writing-51`,
  D-02 `/writing/answer-writing-52`, D-03 `/writing/long-form-writing-53`, D-04 `/writing/essay-writing-54`;
  D-M1 SubmissionConfirmModal, D-M3 AutosaveWarningModal → AppModal.
- **Scope decision (D-M2 + feedback deferred to Cluster 4):** `AnalysisLoadingModal` (D-M2) does NOT use
  antd Modal (Card-based panel), lives in `src/components/feedback/`, and renders on the FEEDBACK route
  (`/writing/feedback/short/[id]`, dynamic `[id]` — not in the writing-editor smoke set). It and the other
  feedback page components (FeedbackPageContent/FeedbackSummary/DimensionCardGrid/FeedbackRecommendationCards)
  belong to Cluster 4 (feedback/reports) by code boundary + smoke-ability + to avoid overlap with the
  concurrent Codex feedback work. Cluster 3 = writing-editor-route components + writing/ modals only.
- **Out of scope (absolute):** admin source (frozen). No new DB schema. No global theme token changes.

## Docs Consulted

- `docs/ui-redesign/PLAN.md` (full) — §Goal pipeline, §A0 강제성, machine gates M1–M6/C1, 확장 로드맵,
  공통 규칙(#14 use-client, M4 inline, M6 deprecation).
- `DESIGN.md` (root) — visual SoT: 8-based SPACING (xs4/sm8/md16/lg24/xl32), flat surfaces, color=meaning,
  dark=darkAlgorithm, 9 approved bridge tokens, Do's/Don'ts (never nest card-in-card → `.app-card-compact`).
- `src/components/shared/{AppCard,AppModal,PageContainer,PageHeader,PublicShell,AppDrawer}.tsx` — primitive
  APIs (verified thin pass-throughs: AppCard forwards CardProps + .app-card/.app-surface; AppModal forwards
  ModalProps + merges rootClassName "app-modal"). `src/theme/spacing.ts` (SPACING). `src/styles/global.css` hooks.
- Wireframe specs `docs/Wireframe/{08,09,10,11,12,13,22}-*/{description,functional-spec}.md` (read in understand workflow).
- `scripts/dev-route-smoke.mjs` (M1 CLI), `scripts/hooks/require-ui-smoke.mjs` (Stop-hook freshness),
  `scripts/ai-workflow-check.mjs` (M4/M6/M3 + repo-state ledger gate).
- `CLAUDE.md`, `docs/ai-development-workflow.md`. Prior ledger `20260604-1642-…cluster1-auth.md`.
- Memory: project-ui-redesign-pilot-plan, feedback-ui-completion-requires-dev-server,
  project-antd-compound-server-component-react130, project-pnpm-build-clobbers-dev-server,
  feedback-concurrent-agent-worktree, project-dev-immutable-cache-stale-chunk.
- Audience: **user** (all writing-editor screens are user-facing, RLS auth.uid()-scoped; no admin).
- Doc conflicts: none. (Roadmap lists D-M2 under C3, but code boundary places it in C4 — resolved by the scope decision above, surfaced to user.)
- Untouched relevant docs: `docs/ant-design/08-theme-architecture.md` — not editing theme files (branch-1 holds);
  its rules are pre-encoded in the shared AppCard/AppModal primitives I reuse (no `--app-*` inline).
  `docs/user-admin-consistency-method.md` — no shared-entity schema read/write changes (visual/layout only).

## Progress log

### 18:45 — Codex route-rename reconciliation (precondition)
- Resume git state: Codex writing route-rename work was UNCOMMITTED in the tree (concurrent-agent).
  User chose "내가 먼저 커밋". Verified one coherent concern (rename `/writing/51..54` → descriptive slugs;
  new dirs delegate to shared `_components/WritingQuestionRoute`; nav hrefs via writingQuestionHref/
  writingProblemHref; tests+specs+sitemap updated). No visual changes.
- Full vitest on the tree found **2 FAIL** in `tests/lib/library/server.test.ts` — pre-existing red at HEAD:
  2825c5a added `question_no` to library joins but left the test stale.
- **Commit `19f0d30`** `test(library): expect question_no…` — fixed stale test; verified GREEN in isolation.
- **Commit `e7494e4`** `refactor(routing): rename writing routes…` — Codex route rename, explicit staging
  (no `git add -A`), ambient/inherited excluded.

### 18:55 — Cluster 3 understand (read-only Workflow fan-out, 5 agents)
- DS primitive API + Wireframe intent + per-file edit-lists. Located D-M2 (feedback/AnalysisLoadingModal,
  feedback route) → deferred to C4. Confirmed no antd deprecations in the writing cluster; Descriptions
  `bordered` is correct in 6.4.3 (NOT migrated).

### 19:00 — implement + verify + commit
- 8 files edited (Card→AppCard ×9, Modal→AppModal ×2). **Commit `1b94306`** (UI code only, 8 files).
- M1 dev-smoke at HEAD 1b94306 (real dev :3000, student auth). `.smoke-skip` removed (gate live).

## Active Files

- Changed (cluster 3, commit `1b94306`): QuestionPrompt, HelpPanel, ConditionsPanel, ReferenceMaterials,
  EssayChecklist, LongFormEditor, SubmissionConfirmModal, AutosaveWarningModal (all `src/components/writing/`).
- WritingEditor.tsx NOT changed (no own Card/Modal; its modals are the 2 modal files). WritingPageContent,
  SectionEditor, ManuscriptPreview, ChecklistRow, AutosaveBadge NOT changed (no Card/Modal; pre-existing
  inline numbers are delta-exempt and were not on touched lines).
- NOT touched: admin (frozen); theme global tokens (branch 1); feedback components (Cluster 4).

## Verification State

- Checks run at HEAD `1b94306` (cluster-3 UI commit):
  - `pnpm typecheck` → GREEN (exit 0) — all AppCard/AppModal imports resolve, no orphan Card/Modal.
  - `pnpm lint` → exit 0 (21 warnings, all pre-existing in untouched files; 0 errors).
  - `node scripts/ai-workflow-check.mjs --repo . --check-inline-styles --check-antd-deprecations` →
    M4 PASS + M6 PASS (no new inline magic numbers, no new antd deprecations in the delta).
  - `pnpm vitest run tests/components/writing tests/lib/writing` → 56/56 PASS (incl. SubmissionConfirmModal
    + AutosaveWarningModal tests, which render the modals via AppModal — text/role assertions unaffected).
  - `pnpm test` (full suite) → **706 passed | 3 skipped (98 files: 96 passed | 2 skipped)** — fully green.
  - **M1 dev-route-smoke** (real running dev :3000, student.json), 4 writing routes × @360/768/1280 = 12 visits,
    headSha `1b94306` = HEAD: **all ok=true, fatal=false, redirected=false, reasons=[], overlayText="", pageErrors=[]**;
    consoleErrors = HMR-websocket dev-noise only (filtered) → real console errors 0, **antd deprecation 0**;
    status 200. Artifact: `docs/ui-redesign/pilot-shots/smoke-result.json` + 12 screenshots.
  - Default-problem render confirmed: `getWritingProblem` loads the first published problem per question_no
    when no `?problem=` param, so the bare smoke routes render the REAL editor (not just the Empty fallback) —
    AppCard/AppModal conversions exercised at runtime with seeded data.
  - **Self visual inspection** of 4 screenshots: 51@1280 (2-col QuestionPrompt + 3 HelpPanel AppCards),
    53@1280 (ConditionsPanel AppCard + MaterialsPanel AppCard + 원고지 grid + Tabs), 54@1280 (essay-body
    AppCard + EssayChecklist AppCard + ChecklistRow segments), 51@360 (responsive 1-col stack, no horizontal
    overflow). White AppCard surfaces on calm gray canvas — consistent with the /login + practice pilots.
  - `node scripts/ai-workflow-check.mjs --repo . --check-smoke` → M3 PASS (testedRoutes ⊇ requiredRoutes, fresh headSha).
  - admin diff (`git diff --name-only -- src/components/admin "src/app/(workspace)/admin"`) → empty.
- **Deferred (honest): clean `pnpm build`** — dev server reused for M1 (M5 blocks build-while-dev). #130 risk ≈ 0:
  AppCard is server-safe; all converted files are "use client"; no new server-rendered compound antd. Run when dev is free.
- Cross-model review: degraded — single session; codex disqualified for 한글 mojibake (and copy is UNCHANGED —
  i18n keys preserved — so copy review is moot). Substitute evidence: machine gates (M4/M6/M3) + real-app M1 +
  56 writing units + 706 full-suite + direct screenshot inspection + 5-agent understand fan-out.
- UX/UI Consistency Pass: passed
  - Tokens: no new inline magic numbers (M4 PASS, 0). Touched lines were tag/import swaps only; pre-existing
    string paddings ("4px 0") and fontSize are M4-exempt and left untouched (no visual-value changes).
  - Components: bare antd `Card` → shared `AppCard` (.app-card/.app-surface) ×9 (QuestionPrompt, HelpPanel×2,
    ConditionsPanel×2, ReferenceMaterials, EssayChecklist, LongFormEditor×3); antd `Modal` → `AppModal`
    (.app-modal) ×2 (SubmissionConfirmModal D-M1, AutosaveWarningModal D-M3); removed unused Card/Modal from
    antd imports; no nested cards; `Descriptions bordered` kept (correct in antd 6.4.3, NOT a deprecation).
  - A11y: aria-label/role/data-testid preserved; modal focus-trap/keyboard/maskClosable/footer preserved via
    AppModal pass-through; no landmark change (writing components render inside WorkspaceShell Content — no
    PageContainer / 2nd `<main>` introduced).
  - Responsive: M1 @360/768/1280 all ok=true; screenshots confirm Row/Col 2-col→1-col stacking, no horizontal scroll.
- QA Gate: passed — real dev app M1 on all 4 writing routes @360/768/1280 (0 console errors, 0 antd deprecation);
  56/56 writing units + 706 full-suite green; admin diff empty.
- **Human visual review (#3): PENDING — non-substitutable gate. 12 screenshots in `docs/ui-redesign/pilot-shots/`
  (light; dark mode low-risk — no theme-token change — to confirm in review). Awaiting user sign-off.**

## Ledger/File-State Consistency

- Commits this run: `19f0d30` (stale library test fix) → `e7494e4` (Codex route rename) → `1b94306`
  (cluster-3 UI, 8 files). Evidence commit (this ledger + smoke-result.json + 12 screenshots) follows.
- smoke-result.json headSha `1b94306` == cluster-3 UI commit HEAD (Stop-hook fresh; `.smoke-skip` removed).
- Working tree after evidence commit = only ambient/inherited (below) — none authored by this run.

## Ambient / inherited dirty files — NOT mine, do not commit

next-env.d.ts, src/app/layout.tsx (prior-session suppressHydrationWarning), pilot-shots/dashboard-{360,768,1280}.png
(prior session), errors/, fonts/pretendard/, verify-landing.mjs, verify-pilot.mjs.

## Risks And Follow-Up

- Clean prod build (the one un-run §Goal step) — run when dev server is free.
- Cluster 4 (feedback/reports) inherits D-M2 AnalysisLoadingModal + feedback page components (dynamic `[id]`
  routes need a seeded submission id for M1, or smoke `/practice/next` + unit-test the [id] views).
- Modal runtime: passive route smoke does not OPEN the modals (they need interaction); covered by the 2 modal
  unit tests + the proven AppModal thin-wrapper (cluster-2 precedent).
- Concurrent Codex session: reconciled at preconditions; `git status` swept before every commit; no `git add -A`.
