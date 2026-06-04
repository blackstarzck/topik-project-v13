# Context Ledger — antd deprecated usage fix (user-facing)

## Run Metadata

- Run id: 20260604-2110-antd-deprecated-fix
- Created: 2026-06-04 21:10
- Updated: 2026-06-04 21:10
- Main session owner: Claude (Opus 4.8, ultracode)
- Host: Claude Code
- Status: active

## Task

- User goal: "antd 컴포넌트가 있는 모든 곳에 deprecate 가 된 곳을 찾아 고쳐줘." (Find & fix all deprecated antd component usages.)
- Accepted scope: All **user-facing** (non-admin) deprecated antd props flagged by `antd lint ./src --only deprecated` (antd 6.4.3). 121 issues across 48 files.
- Out of scope: `src/components/admin/**` (47 issues, 16 files). Admin is a FROZEN island owned elsewhere (CLAUDE.md "Scope Boundary — Admin"; [[project-admin-scope-boundary]]). Reported, not modified. Will be handled in the later admin-sync phase.
- Current next action: run deterministic codemod for pure renames, then hand-fix 4 structural cases, then verify.

## Docs Consulted

- Exact files read: `CLAUDE.md`, `.claude/skills/using-superpowers/SKILL.md`, `.claude/skills/ant-design/SKILL.md` + `references/antd-cli.md`, `docs/admin-scope-boundary.md` (via memory), `package.json`, installed `node_modules/antd/es/input/Input.d.ts`.
- Extracted requirements:
  - antd CLI is the authoritative offline source for deprecation/migration (skill mandate: query before changing antd code; `antd lint <path>` after).
  - Admin code is frozen; user screens reconcile to schema. Do not modify/extend/delete admin.
- Doc conflicts: Goal says "모든 곳" (everywhere) but CLAUDE.md hard-excludes admin. Resolved per CLAUDE.md priority (fail-closed on scope): fix all in-scope, report admin exclusion. No active-doc product-behavior conflict (prop renames preserve identical rendering).
- Untouched relevant docs and reason:
  - `docs/prd.md`, `docs/spec.md` — no product-behavior change (mechanical prop rename); not consulted in depth.

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 21:05 | Exclude admin (47 issues) | Frozen island per CLAUDE.md scope boundary | CLAUDE.md / [[project-admin-scope-boundary]] |
| 21:08 | Space/Steps `direction`→`orientation`, Alert `message`→`title`, Spin `tip`→`description` are pure renames | Confirmed via `antd migrate 5 6` (official) + `antd info` (replacement props exist) + lint messages | antd CLI |
| 21:09 | `valueStyle`→`styles.content`, `imageStyle`→`styles.image` are object-merge transforms | lint messages + `antd semantic` confirms `content`/`image` keys exist | antd CLI |
| 21:10 | Input `addonAfter` IS genuinely deprecated (suspected false positive ruled out) | `node_modules/antd/es/input/Input.d.ts:50` `@deprecated Use Space.Compact instead.` | installed types |
| 21:10 | Use deterministic TS-AST codemod for 117 pure renames (component-tag-scoped, non-admin only) over LLM agents | mechanical edits → determinism > LLM; re-lint self-verifies | judgment |

## Active Files

- Files expected to change: 48 non-admin files (see errors/antd-deprecated.json filtered).
- Files explicitly not to touch: `src/components/admin/**`; ambient pre-existing uncommitted changes (next-env.d.ts, layout.tsx, WorkspaceShell.tsx, pilot-shots PNGs, errors/, fonts/, verify-*.mjs, tests/components/app/) — possible concurrent Codex session ([[feedback-concurrent-agent-worktree]]).

## Verification State

- Required checks: re-lint deprecated (non-admin=0), AST full-inventory audit (0), tsc, vitest, runtime warning sweep, completeness for whole-component deprecations.
- Checks run + results:
  - `antd lint --only deprecated`: non-admin **0**, admin 47 (out of scope). ✓
  - AST full-inventory audit (incl. App* wrappers): **0** non-admin findings. ✓
  - `tsc --noEmit`: **exit 0**. ✓
  - `vitest run`: **706 passed / 3 skipped, exit 0** (test-file count drifts ±1 due to concurrent Codex session adding tests/components/app/). ✓
  - Runtime warning sweep (Playwright, 17 routes, hydration confirmed by client-only antd warnings firing): **0 remaining `[antd:…] deprecated`** after fixes. ✓ (Modal destroyOnClose/maskClosable warnings on /library GONE post-fix.)
- Lint blind spots discovered (documented for `antd bug-cli` consideration): `antd lint --only deprecated` MISSED (a) Modal `destroyOnClose`/`maskClosable` passed via the AppModal wrapper, and (b) the whole-component `List` deprecation. Runtime + installed-types `@deprecated` inventory were the true oracles.
- Cross-model review: Claude self (objective oracles: lint count→0 + runtime warnings→0 + typecheck). No Korean copy changed → codex mojibake N/A. Right-sized per [[feedback-docs-only-gate-rightsizing]] (quantitative oracle).

## Scope additions during run

- +6 lint-missed Modal deprecations fixed (AppModal-forwarded): maskClosable→`mask.closable` (PdfExportModal, RetryModal×2, AutosaveWarningModal, SubmissionConfirmModal), destroyOnClose→destroyOnHidden (PdfExportModal). **Total fixed = 127 prop-level.**
- **OPEN — `List` whole-component deprecation:** antd 6 deprecated the `List` component entirely (changelog "Deprecated List component"; runtime warns; removed from docs). No antd replacement/codemod. Used in 11 user-facing files (SentenceFeedbackList, GrowthDashboard, LibraryExportsTab/ReportsTab/SavedProblemsTab/SubmissionsTab/ItemRow, ProblemListView, ProblemRow, NotificationPrefsForm, ConditionsPanel). Removing the warning requires reimplementing list layout with non-deprecated primitives (wrapping antd List does NOT silence it). Deferred pending user decision (design + scope + overlaps active redesign clusters).

## Risks And Follow-Up

- Risks: PdfExportModal addonAfter→Space.Compact is a structural change in just-completed cluster-5 library UI. AppLoading standalone Spin: tip/description both require children to render (no behavior change from rename).
- **Discovered pre-existing bug (NOT mine, out of scope):** `/library` throws "Maximum update depth exceeded" — root in `LibrarySubmissionsTab.tsx` useEffect (line ~150, setSelected) on the default tab. My library edits add zero state/effects (pure prop renames + static Space.Compact); only /library loops among all routes. Reported for separate root-cause investigation.
- Follow-up: admin 47 deprecations → admin-sync phase. `List` migration → see OPEN item.
