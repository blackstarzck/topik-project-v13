# Context Ledger: Route Scope Alignment

## Run Metadata

- Run id: 20260520-1000-route-scope-alignment
- Created: 2026-05-20 10:00 KST
- Updated: 2026-05-20 10:10 KST
- Main session owner: Codex
- Host: Codex
- Status: complete

## Task

- User goal: Apply the proposed route direction and align affected docs, while clarifying that one assistant-support feature was outside the current Paper frame.
- Accepted scope: Documentation-only route/scope cleanup for legacy IA pages, PRD scope notes, Ant Design page patterns, stack/deferred-scope notes, and sitemap billing wording.
- Out of scope: Production implementation, adding new Paper screens, adding new product scope, billing provider selection, removed assistant-support feature implementation.
- Current next action: Complete; no pending action.

## Docs Consulted

- Exact files read:
  - `.agents/superpowers/skills/using-superpowers/SKILL.md`
  - `docs/agent-index.md`
  - `.agents/skills/talkpik-orchestrator/SKILL.md`
  - `docs/spec.md`
  - `docs/ai-development-workflow.md`
  - `docs/ai-workflow/context-ledger-template.md`
  - `docs/ai-workflow/report-template.md`
  - `docs/sitemap.md`
  - `docs/ia-pages/*.md` headers and `docs/ia-pages/README.md`
  - `docs/prd.md`
  - `docs/ant-design/04-page-patterns-for-talkpik.md`
  - `docs/development/stack.md`
  - `docs/development/deferred-scope.md`
- Extracted requirements:
  - `docs/sitemap.md` is the current route authority until source exists.
  - Legacy `.html` route notes must not be treated as current implementation targets.
  - Active route/IA docs are `docs/sitemap.md`, `docs/ia.md`, `docs/IA`, and `docs/flow/user-flow.md`.
  - Billing remains deferred even when Paper-frame paywall/subscription shells exist.
  - PRD can retain broader product context, but Paper route inventory controls current screen/route implementation.
- Doc conflicts:
  - PRD included a removed assistant-support feature, standalone vocabulary, mock exam, and board as product/MVP context, while current Paper/sitemap route inventory does not include those screens. Resolved at the time by marking them future/deferred until matching IA/routes are added.
- Untouched relevant docs and reason:
  - `docs/IA/*/description.md`: current Paper screen inventory already matches the route authority; no page content change needed.
  - `docs/flow/user-flow.md`: already matches the 32 current IA screens; no flow change needed.

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 10:00 | Keep a then-current assistant-support feature in PRD as future/global-assist product context, not as a current route. | User confirmed route should follow current Paper direction; Paper frame had no standalone screen for that feature. | User request, `docs/sitemap.md`, `docs/prd.md` |
| 10:00 | Convert `ia-pages` per-file route headers to legacy/current mapping. | Individual files still made old routes look current. | `docs/ia-pages/*.md`, `docs/sitemap.md` |
| 10:00 | Clarify `/paywall` and `/subscription` as UI shells only. | Billing implementation is deferred by development scope. | `docs/development/deferred-scope.md`, `docs/sitemap.md` |

## Active Files

- Files expected to change:
  - `docs/sitemap.md`
  - `docs/prd.md`
  - `docs/ant-design/04-page-patterns-for-talkpik.md`
  - `docs/development/stack.md`
  - `docs/development/deferred-scope.md`
  - `docs/ia-pages/*.md`
  - this ledger
- Files inspected:
  - listed under Docs Consulted
- Files changed:
  - `docs/sitemap.md`
  - `docs/prd.md`
  - `docs/ant-design/04-page-patterns-for-talkpik.md`
  - `docs/development/stack.md`
  - `docs/development/deferred-scope.md`
  - `docs/ia-pages/01-home-v1.md`
  - `docs/ia-pages/02-home-v2.md`
  - `docs/ia-pages/03-practice-create.md`
  - `docs/ia-pages/04-practice-solve.md`
  - `docs/ia-pages/05-writing-practice-create.md`
  - `docs/ia-pages/06-writing-51.md`
  - `docs/ia-pages/07-writing-53.md`
  - `docs/ia-pages/08-my-library.md`
  - `docs/ia-pages/09-my-vocabulary.md`
  - `docs/ia-pages/10-writing-feedback-list.md`
  - `docs/ia-pages/11-writing-feedback-detail.md`
  - `docs/ia-pages/12-mock-exam-results.md`
  - `docs/ia-pages/13-mock-exam-history.md`
  - `docs/ia-pages/14-mock-test-setup.md`
  - `docs/ia-pages/14-1-mock-test-exam.md`
  - removed legacy assistant-support IA page
  - `docs/ia-pages/16-board.md`
  - `docs/ia-pages/17-notice-detail.md`
  - `docs/ia-pages/18-profile-settings.md`
  - `docs/ia-pages/README.md`
  - `docs/ai-workflow/runs/2026/05/20/20260520-1000-route-scope-alignment.md`
- Files explicitly not to touch:
  - Production source files; this task is docs-only.

## Agent Assignments

| Agent | Role | Scope | Status | Packet location or summary |
| --- | --- | --- | --- | --- |
| Codex | Solo executor | Documentation alignment and verification | active | Native subagents not used; task was bounded docs work. |

## Child Result Packets

Not applicable.

## Verification State

- Required checks:
  - Confirm no `현재 React route` stale headers remain in `docs/ia-pages`.
  - Confirm PRD/Ant Design/development docs contain explicit Paper/current-route scope notes.
  - Run AI workflow checker.
- Checks run:
  - `rg -n "현재 React route" docs\ia-pages -S`
  - PRD focused `rg` for future/deferred labels and MVP movement
  - Focused `rg` for current mapping, Paper scope, billing deferral, and chart wording
  - `node scripts\sync-agent-skills.mjs --check`
  - `node scripts\ai-workflow-check.mjs --repo .`
- Latest results:
  - No stale Korean `현재 React route` headers remain under `docs/ia-pages`.
  - PRD marks standalone vocabulary, mock exam, board, and notice detail as future/deferred until matching IA/routes exist.
  - Paywall/subscription routes are documented as UI shells and do not reopen billing implementation.
  - Skill mirrors: `PASS agent skill mirrors are in sync`.
  - AI workflow checker: `PASS repository state`.
- Known failures:
  - None yet.
- Skipped checks and reason:
  - Build/test suite: docs-only change with no production code.
- Cross-model review: degraded — historical, pre-rule (single-AI authored before 2026-05-21 cross-review rule was introduced)

## Fallback State

- Normal path blocked: none
- Failure class: none
- Fallback used: none
- Evidence collected: focused `rg` outputs and workflow checker pass
- Completion allowed: yes after verification
- Remaining fallback risk: none

## Ledger/File-State Consistency

- Files changed match accepted scope: yes
- Docs consulted match implemented behavior: yes
- Child result packets integrated: not applicable
- Verification state current: yes
- Remaining risks listed: yes

## Risks And Follow-Up

- Remaining risks:
  - PRD still contains detailed future product requirements for vocabulary, mock exam, and board by design; implementation agents must respect the Paper/sitemap route gate before building those.
- Assumptions:
  - The current Paper 32-screen inventory remains the route implementation boundary.
- Follow-up needed:
  - None.
