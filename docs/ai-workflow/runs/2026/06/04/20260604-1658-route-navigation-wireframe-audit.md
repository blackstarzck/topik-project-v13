# Context Ledger: Route Navigation Wireframe Audit And Remediation

## Run Metadata

- Run id: 20260604-1658-route-navigation-wireframe-audit
- Created: 2026-06-04 16:58 +09:00
- Updated: 2026-06-04 18:12 +09:00
- Main session owner: Codex
- Host: Codex
- Status: complete

## Task

- User goal: Compare implemented routes/navigation with `docs/Wireframe/`, remove `/dev-preview/dashboard`, split the four Wireframe writing pages into separate pages, and reset broken navigation paths.
- Accepted scope:
  - Remove the dev preview dashboard route and public allow-list entry.
  - Replace the prior dynamic `/writing/[questionId]` page with static `/writing/51`, `/writing/52`, `/writing/53`, `/writing/54` page files.
  - Keep shared writing page loading behavior in a common local helper.
  - Replace generated `/practice/problems/:id` navigation targets with `/writing/{questionNo}?problem={problemId}` when the writing question number is valid, or `/practice/problems` as a safe fallback.
  - Replace bare `/practice` library CTAs with `/practice/problems`.
- Out of scope:
  - Admin feature implementation.
  - New Wireframe creation.
  - Visual redesign of the writing/editor screens.

## Docs Consulted

- Exact files read:
  - `.agents/superpowers/skills/using-superpowers/SKILL.md`
  - `.codex/skills/test-driven-development/SKILL.md`
  - `.codex/skills/verification-before-completion/SKILL.md`
  - `.codex/skills/next-best-practices/SKILL.md`
  - `.codex/skills/next-best-practices/references/file-conventions.md`
  - `docs/agent-index.md`
  - `docs/user-communication-style.md`
  - `docs/report-writing-template.md`
  - `docs/ai-development-workflow.md`
  - `docs/ai-workflow/context-and-packets.md`
  - `docs/ai-workflow/templates/context-ledger-template.md`
  - `docs/sitemap.md`
  - `docs/Wireframe/README.md`
  - `docs/Wireframe/06-C-02-problem-list/description.md`
  - `docs/Wireframe/07-C-03-retry-modal/description.md`
  - `docs/Wireframe/08-D-01-short-answer-writing-51/description.md`
  - `docs/Wireframe/09-D-02-answer-writing-52/description.md`
  - `docs/Wireframe/10-D-03-long-form-writing-53/description.md`
  - `docs/Wireframe/11-D-04-essay-writing-54/description.md`
  - `docs/flow/user-flow.md`
  - `docs/user-flow.md`
  - `docs/ui-redesign/PLAN.md`
- Extracted requirements:
  - `docs/sitemap.md` is the route authority.
  - Wireframe D-01, D-02, D-03, D-04 are separate user-facing pages: `/writing/51`, `/writing/52`, `/writing/53`, `/writing/54`.
  - C-02 problem list is `/practice/problems`; C-03 retry modal is hosted by the problem list and opens writing/feedback routes, not `/practice/problems/:id`.
  - Query variants like `/writing/53?problem=...` are variants of the documented writing page route, not separate pages.
  - Dev preview scaffolding is not part of the active Wireframe route set.
- Doc conflicts:
  - Source drift found: `/dev-preview/dashboard`, `/practice/problems/:id`, and `/practice` existed in source/navigation but not in active Wireframe/sitemap route definitions.
- Untouched relevant docs and reason:
  - `docs/ia-pages/README.md` - legacy observed HTML crosswalk only; `docs/sitemap.md` remains the active route authority.

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 2026-06-04 16:58 +09:00 | Remove `/dev-preview/dashboard`. | It was a no-auth QA fixture, absent from sitemap/Wireframe, and publicly allow-listed through `/dev-preview`. | `src/app/dev-preview/dashboard/page.tsx`; `src/lib/routes.ts`; `docs/ui-redesign/PLAN.md` |
| 2026-06-04 17:55 +09:00 | Replace `/writing/[questionId]` with four static page files. | User explicitly asked not to merge the four Wireframe pages into one writing page. | D-01..D-04 Wireframes; user request |
| 2026-06-04 18:04 +09:00 | Centralize selected-problem writing links in `writingProblemHref`. | Dashboard, growth, recommendations, weakness, retry, and library components were generating inconsistent route strings. | `src/lib/writing/routes.ts` |
| 2026-06-04 18:06 +09:00 | Add `question_no` to library problem/submission views. | Saved problem/submission rows need the writing question number to open the correct static writing page. | `docs/Wireframe/18-F-01-my-library/functional-spec.md`; `problems.question_no`; `writing_submissions.question_no` |
| 2026-06-04 18:10 +09:00 | Fix `RetryModal` `Descriptions` prop from `variant="bordered"` to `bordered`. | Same touched file failed typecheck against the installed Ant Design type surface. | `pnpm typecheck` |

## Active Files

- Route/page files changed:
  - Removed `src/app/dev-preview/dashboard/page.tsx`
  - Removed `src/app/(workspace)/writing/[questionId]/page.tsx`
  - Added `src/app/(workspace)/writing/_components/WritingQuestionRoute.tsx`
  - Added `src/app/(workspace)/writing/51/page.tsx`
  - Added `src/app/(workspace)/writing/52/page.tsx`
  - Added `src/app/(workspace)/writing/53/page.tsx`
  - Added `src/app/(workspace)/writing/54/page.tsx`
- Navigation/data files changed:
  - `src/lib/routes.ts`
  - `src/lib/writing/routes.ts`
  - `src/lib/library/types.ts`
  - `src/lib/library/queries.ts`
  - `src/lib/library/server.ts`
  - `src/components/dashboard/DashboardRecommendations.tsx`
  - `src/components/growth/GrowthDashboard.tsx`
  - `src/components/library/LibrarySavedProblemsTab.tsx`
  - `src/components/library/LibraryStatsPanel.tsx`
  - `src/components/library/LibrarySubmissionsTab.tsx`
  - `src/components/practice/AlternativeCardsGrid.tsx`
  - `src/components/practice/NextProblemView.tsx`
  - `src/components/practice/ProblemRow.tsx`
  - `src/components/practice/RecommendationItemCards.tsx`
  - `src/components/practice/RetryModal.tsx`
  - `src/components/practice/WeaknessView.tsx`
- Tests changed/added:
  - `tests/integration/route-matrix.test.ts`
  - `tests/integration/writing-flow.test.ts`
  - `tests/scripts/derive-smoke-routes.test.ts`
  - `tests/scripts/no-dev-preview-route.test.ts`
  - `tests/scripts/writing-static-routes.test.ts`
  - `tests/scripts/no-practice-problem-detail-route.test.ts`
  - `tests/lib/writing/routes.test.ts`
  - `tests/components/practice/NextProblemView.test.tsx`
  - `tests/components/practice/WeaknessView.test.tsx`
- Docs changed:
  - `docs/ui-redesign/PLAN.md`
  - `docs/ai-workflow/runs/2026/06/04/20260604-1658-route-navigation-wireframe-audit.md`
- Files explicitly not touched:
  - Admin feature implementation files.
  - Unrelated dirty files already present in the working tree, including `src/app/layout.tsx`, `next-env.d.ts`, pilot screenshots, shared component pilot files, and unrelated verification scripts.

## Verification State

- RED checks run before implementation:
  - `pnpm vitest run tests\integration\route-matrix.test.ts --testNamePattern "dev preview"` failed while `/dev-preview` remained public.
  - `pnpm vitest run tests\scripts\no-dev-preview-route.test.ts` failed while the dev preview page existed.
  - `pnpm vitest run tests\scripts\writing-static-routes.test.ts` failed while static writing pages were absent and `[questionId]` still existed.
  - `pnpm vitest run tests\integration\writing-flow.test.ts --testNamePattern "static page"` failed while `/writing/51..54/page.tsx` modules did not exist.
  - `pnpm vitest run tests\lib\writing\routes.test.ts` failed while `src/lib/writing/routes.ts` did not exist.
  - `pnpm vitest run tests\scripts\no-practice-problem-detail-route.test.ts` failed with seven `/practice/problems/:id` source offenders.
  - `pnpm vitest run tests\components\practice\NextProblemView.test.tsx tests\components\practice\WeaknessView.test.tsx` failed on old `/practice/problems/:id` expectations.
- Final checks run:
  - `pnpm vitest run tests\integration\writing-flow.test.ts tests\integration\route-matrix.test.ts tests\integration\library-flow.test.ts tests\scripts\derive-smoke-routes.test.ts tests\scripts\no-dev-preview-route.test.ts tests\scripts\writing-static-routes.test.ts tests\scripts\no-practice-problem-detail-route.test.ts tests\lib\writing\routes.test.ts tests\components\practice\NextProblemView.test.tsx tests\components\practice\WeaknessView.test.tsx tests\components\practice\RetryModal.test.tsx tests\components\dashboard\DashboardComponents.test.tsx tests\components\library\LibraryChrome.test.tsx`
  - `pnpm typecheck`
  - `pnpm lint`
  - `node scripts\ai-workflow-check.mjs --repo .`
  - Node route inventory over `src/app`
  - Node fetch smoke against existing dev server for `/writing/51`, `/writing/52`, `/writing/53`, `/writing/54`, `/dev-preview/dashboard`, `/practice/problems/prob-42`
- Latest results:
  - Targeted Vitest: 13 files, 130 tests passed.
  - Typecheck: passed.
  - Lint: passed with 21 warnings, all pre-existing outside this change set.
  - Workflow checker: PASS repository state.
  - Route inventory now includes `/writing/51`, `/writing/52`, `/writing/53`, `/writing/54`, and no `/dev-preview/dashboard` or `/practice/problems/:id` page.
  - Dev server smoke: `/writing/51..54` returned `307 /login` for anonymous access, which is expected for protected routes.
- Known failures:
  - `pnpm build` was blocked by `scripts/build-preflight.mjs` because a dev server was already alive on port 3000. The guard explicitly warns that building in that state can corrupt `.next`, so no forced build was run.
- Browser QA:
  - Degraded. The available Playwright MCP tools exposed snapshot/screenshot/click only, no navigation tool. Current page was `about:blank`, so direct browser navigation could not be performed from the MCP surface.
  - Equivalent evidence used: route inventory, protected-route HTTP smoke against the running dev server, targeted component/integration tests, typecheck, lint, workflow checker.
- Cross-model review: degraded — single-agent route remediation; no external reviewer or cross-model lane was available in this turn.
- UX/UI Consistency Pass: degraded — route/navigation-only UI changes; no visual styling, layout, tokens, copy, or component hierarchy changes were introduced, and browser navigation was unavailable from MCP.
  - Tokens: passed — no design token or style-token edits in this change set.
  - Components: passed — existing components keep their current controls and layout; only link/href targets and route helper usage changed.
  - A11y: passed — no labels, roles, focus behavior, or keyboard interaction contracts were changed.
  - Responsive: degraded — no responsive/layout code changed, but browser viewport QA could not run because the exposed MCP browser tools lacked navigation.
- QA Gate: degraded — browser navigation QA unavailable and `pnpm build` blocked by active dev server on port 3000 | targeted route/component/integration tests, typecheck, lint, workflow checker, route inventory, and HTTP smoke passed | full build and visual viewport QA remain unverified until the dev server can be stopped and browser navigation is available.

## Route Inventory Snapshot

```text
page /
page /admin
page /admin/org
page /admin/problems
page /admin/users
handler /auth/callback
page /auth/callback-fragment
page /auth/error
handler /auth/sign-out
page /auth/verify-email
page /dashboard
page /growth
page /library
page /login
page /onboarding/learning-goal
page /password-reset
page /password-reset/confirm
page /paywall
page /practice/next
page /practice/problems
page /practice/recommendations
page /practice/weakness
page /privacy
page /profile
page /settings/language
page /settings/notifications
page /sign-up
page /subscription
page /terms
page /writing/51
page /writing/52
page /writing/53
page /writing/54
page /writing/feedback/long/:id
page /writing/feedback/short/:id
page /writing/reports/:id/compare
```

## Wireframe Mapping For Changed Pages

| Wireframe folder name, code prefix removed | Implemented route |
| --- | --- |
| `short-answer-writing-51` | `/writing/51` |
| `answer-writing-52` | `/writing/52` |
| `long-form-writing-53` | `/writing/53` |
| `essay-writing-54` | `/writing/54` |
| `problem-list` | `/practice/problems` |
| `retry-modal` | hosted by `/practice/problems` and links to `/writing/{questionNo}?problem={problemId}` |

## Fallback State

- Normal path blocked:
  - `pnpm build` only, due active dev server on port 3000.
  - Browser MCP navigation only, due no navigate tool exposed.
- Fallback used:
  - Did not stop the existing dev server.
  - Did not run `pnpm build --force`.
  - Used route inventory, HTTP smoke, and test/type/lint evidence instead.
- Completion allowed:
  - Yes. Core route and navigation behavior is covered by tests and static inventory; build/browser gaps are documented.

## Ledger/File-State Consistency

- Files changed match accepted scope: yes.
- Docs consulted match implemented behavior: yes.
- Child result packets integrated: not applicable; no child agents used.
- Verification state current: yes.
- Remaining risks listed: yes.

## Risks And Follow-Up

- Remaining risks:
  - Full `pnpm build` remains unverified until the current dev server on port 3000 is stopped.
  - Browser visual QA was not run because MCP navigation was unavailable; no visual layout changes were made.
  - Existing lint warnings remain outside this change set.
- Assumptions:
  - `docs/sitemap.md` remains the route authority.
  - `/writing/{questionNo}?problem=...` is the correct selected-problem deep link because D-01..D-04 are the real writing page routes and C-03 already uses that pattern.
  - Invalid or missing question numbers should fall back to `/practice/problems` to avoid generating another 404 route.
