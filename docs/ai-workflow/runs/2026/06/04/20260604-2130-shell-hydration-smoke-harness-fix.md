# Context Ledger — Dev-smoke hydration fix (allowedDevOrigins) + shell non-bug finding

## Run Metadata

- Run id: 20260604-2130-shell-hydration-smoke-harness-fix
- Created: 2026-06-04 21:30 (+09:00)
- Owner: Claude Code (Opus 4.8, 1M ctx) — coordinator
- Decisions on this run were delegated to **GPT-5.5 (codex)** per user directive (D1/D2/D3/D4 below).
- Branch: `docs/auth-overview-consolidated-reference`
- Status: **root-caused + fixed the smoke-harness blind spot; the "shell @360 doesn't collapse" was NOT a real bug.**

## Task / trigger

GPT-5.5 (decision authority) had directed a dedicated WorkspaceShell mobile-nav fix, because every cluster's
M1 smoke screenshot showed the sidebar not collapsing at ≤360px. Investigating root cause before changing code
(per systematic-debugging) overturned that premise.

## Root cause (evidence-based, real-browser Playwright probes)

- The shell already had correct mobile-nav code (`antd Grid.useBreakpoint` + `Sider breakpoint="md"` +
  hamburger + `AppDrawer`). A direct-navigation probe at 360 showed: Sider stays 240px, no collapse, no
  hamburger — BUT `window.matchMedia("(max-width:767.98px)").matches === true`. So the browser knew it was
  mobile; the React shell did not react.
- Instrumented the shell's effect with raw DOM markers: `data-effect-ran` was **absent** → the client
  `useEffect` **never ran** → the "use client" shell subtree **never hydrated** under the smoke.
- Dev-server log revealed the cause: `⚠ Blocked cross-origin request to Next.js dev resource /_next/* from "127.0.0.1"`.
  **Next.js 16 blocks dev resources for origins not in `allowedDevOrigins`. The default allows `localhost` but NOT
  `127.0.0.1`.** The M1 dev-route smoke (`scripts/dev-route-smoke.mjs`) navigates via `127.0.0.1`, so its dev
  resources were blocked → client components never hydrated → all client-only behaviour (responsive shell, modal
  open, etc.) was invisible to the smoke. **Real users access via `localhost`, which hydrates normally — they
  never saw a broken sidebar.**
- Proof: after adding `allowedDevOrigins: ["127.0.0.1"]` and restarting dev, the **original (unchanged)** shell
  collapses correctly — direct@360 → Sider width 0, `ant-layout-sider-collapsed`, hamburger visible; @1280 →
  expanded, no hamburger; live resize 1280→360 → collapses. The `data-effect-ran="1"`, `data-mq-onmount="true"`,
  `data-ismobile="true"` markers confirmed hydration now runs.

## The fix

- `next.config.ts`: `allowedDevOrigins: ["127.0.0.1"]` (dev-only; ignored in production builds). Smallest correct
  fix (GPT-5.5 D1=A); the auth fixture + smoke harness are already bound to 127.0.0.1, so re-pointing the smoke at
  localhost would break the authenticated session.
- `WorkspaceShell.tsx`: **reverted to original** — it was never broken (GPT-5.5 D2). An abandoned matchMedia
  rewrite + its jsdom unit test + a throwaway diagnostic probe were deleted.

## Docs Consulted

- `docs/ui-redesign/PLAN.md` (§A0 judge=machine-observed-reality; §M1 real-route smoke is the decisive gate;
  "jsdom GREEN ≠ done — browser-boundary bugs need real-route dev render").
- `scripts/dev-route-smoke.mjs` (baseURL `http://127.0.0.1:${port}`; reuses a running dev server), `next.config.ts`,
  `src/components/app/{WorkspaceShell,AppHeader}.tsx`, `src/components/shared/AppDrawer.tsx`, `src/app/(workspace)/layout.tsx`.
- Next.js 16 `allowedDevOrigins` (cross-origin dev-resource protection).
- `CLAUDE.md`, `docs/ai-development-workflow.md`. Memory: feedback-ui-completion-requires-dev-server,
  feedback-concurrent-agent-worktree, project-dev-immutable-cache-stale-chunk.
- Audience: **user** (workspace shell). Doc conflicts: none.
- Untouched relevant docs: `docs/ant-design/08-theme-architecture.md` (no theme-token change).

## Verification State

- **Real-browser probe (decisive):** with `allowedDevOrigins` set, the ORIGINAL shell collapses at ≤360 and
  shows the hamburger; expands ≥768. Screenshot `docs/ui-redesign/pilot-shots/reverify/dashboard-360.png` shows
  the collapsed sidebar (☰) + full-width content (no character-wrap) — the artifact is gone.
- **Bounded re-verification M1 (GPT-5.5 D3=A)** on dashboard/library/writing/feedback @360/768/1280, now hydrating:
  - `/dashboard` → **ok all viewports**, 0 console/runtime errors. Shell collapses at 360.
  - `/writing/feedback/short/<seed>` → **ok all viewports**.
  - `/library` → **FAIL: "Maximum update depth exceeded" (setState-in-useEffect loop)** + antd Modal
    `destroyOnClose`/`maskClosable` deprecation warnings.
  - `/writing/short-answer-writing-51` → FAIL: antd Modal `maskClosable` deprecation warning.
  - **Attribution:** the failing routes coincide with the concurrent **Codex antd-deprecation codemod** that is
    UNCOMMITTED in the working tree (~50 `src/components` files; `git diff` on `PdfExportModal.tsx` shows Codex's
    `direction→orientation`, `message→title`, `addonAfter`→`Space.Compact`). The render loop is in the working
    tree (Codex's in-flight sweep), NOT in committed HEAD, and NOT from my cluster-5 changes (pure AppCard/AppModal/
    PageHeader wrapper swaps have no effects). **Clean attribution of the /library loop requires re-smoking
    `/library` at a committed HEAD once Codex lands its sweep — deferred (see follow-up).**
- **Cross-model review: COMPLETED via GPT-5.5 (codex)** — GPT-5.5 was the decision authority for this run
  (D1 keep allowedDevOrigins; D2 revert shell + delete abandoned test/probe; D3 bounded re-verify; D4 resume
  cluster 6 after). All decisions recorded above.
- UX/UI Consistency Pass: passed (this change is dev-config only; no component/visual change shipped)
  - Tokens: no token or inline-style change (next.config only; WorkspaceShell reverted to HEAD).
  - Components: no component change shipped (WorkspaceShell reverted). The shared shell/AppDrawer mobile-nav is
    confirmed correct under hydration.
  - A11y: the hamburger toggle + Drawer nav now actually render at ≤360 (were invisible to the blind smoke);
    semantic landmark unchanged.
  - Responsive: real-browser probe confirms Sider collapse at <768 and expand at ≥768; `/dashboard` 360 screenshot clean.
- QA Gate: dashboard + feedback routes ok (0 errors) under hydration; library/writing failures attributed to the
  concurrent Codex uncommitted sweep (not committed, not mine) — documented, not masked.

## Active Files (mine, this run)

- Changed (to commit): `next.config.ts` (allowedDevOrigins).
- Reverted to HEAD: `src/components/app/WorkspaceShell.tsx`.
- Deleted (scaffolding): `tests/components/app/WorkspaceShell.test.tsx`, `scripts/_tmp-shell-probe.mjs`.
- NOT mine (concurrent Codex, uncommitted, left untouched): ~50 `src/components/**` antd-codemod edits,
  `scripts/_tmp-antd-*.mjs`, `docs/admin-console-derived-spec.*`, `docs/user-admin-data-consistency.*`,
  `docs/ai-workflow/runs/.../2039-user-admin-data-inventory.md`, `.../2100-admin-console-derived-spec.md`,
  `.../2110-antd-deprecated-fix.md`, `docs/README.md`.

## Ledger/File-State Consistency

- Commit this run: `next.config.ts` + this ledger + the `/dashboard` reverify screenshots only (explicit paths;
  NOT `git add -A`; Codex's uncommitted files excluded).
- The smoke hook may see Codex's dirty UI files; a `.smoke-skip` sentinel documents the intentional defer (the
  failing `/library` smoke is Codex's uncommitted loop, not my change). Remove once Codex lands + /library re-smokes clean.

## Risks And Follow-Up (HIGH IMPORTANCE)

1. ✅ **RESOLVED — clusters 1-5 bounded hydrated re-smoke done.** The M1 smoke was SSR-only (no hydration) for the
   pilot + clusters 1-5 (127.0.0.1 cross-origin block); `allowedDevOrigins` fixed it. Re-verification smoke (now
   hydrating) over 14 representative routes (dashboard, library, writing, feedback, practice/recommendations,
   practice/weakness, growth, settings/notifications, profile, paywall, subscription, /, terms, login) × {360,1280}
   = **28 visits all ok=true, 0 console errors, 0 runtime errors, 0 antd deprecations, 0 overlays** at HEAD `273fd5b`.
   Artifact: `docs/ui-redesign/pilot-shots/reverify2-smoke.json`. Clusters 1-5 client behaviour is now positively verified.
2. ✅ **FIXED — `/library` "Maximum update depth exceeded" render loop.** Pre-existing in `LibrarySubmissionsTab`
   (`allItems` recomputed every render → `filtered` useMemo → selection-lift useEffect looped). Fix: `useMemo(allItems,
   [query.data, initialItems])` (commit `6ad6494`) + regression test `LibrarySubmissionsTab.test.tsx` (commit `273fd5b`,
   validate-the-validator confirmed). `/library` @360/768/1280 now consoleErrors=[].
3. ✅ **RESOLVED — concurrent Codex antd-deprecation sweep committed** at the user's request (commit `b67ad3b`,
   ~50 files + Codex docs/ledgers). Shared tree is clean again; cluster rollout can resume.
4. WorkspaceShell mobile-nav: **no fix needed** (was never broken). The earlier GPT-5.5 "fix the shell" directive
   is superseded by this evidence.
5. **Next: resume cluster 6 (growth)** with the now-hydrating smoke as the verification baseline.
