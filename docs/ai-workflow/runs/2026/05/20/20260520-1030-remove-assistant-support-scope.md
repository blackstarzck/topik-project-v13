# 2026-05-20 10:30 Remove Assistant Support Scope

## Run Metadata

- Run id: 20260520-1030-remove-assistant-support-scope
- Created: 2026-05-20 10:30 KST
- Updated: 2026-05-20 10:30 KST
- Main session owner: Codex
- Host: Codex
- Status: complete

## Task

- User goal: Remove the deprecated assistant-support feature content from the PRD and any other documents where that scope remains.
- Accepted scope: Documentation-only removal from PRD, README, sitemap, IA docs, legacy page observations, design guidance, and affected historical ledgers.
- Out of scope: Removing general AI problem generation, writing feedback, saved feedback, or the TALKPIK AI product name.
- Current next action: Complete; report changes and verification.

## Docs Consulted

- Exact files read:
  - `.agents/superpowers/skills/using-superpowers/SKILL.md`
  - `docs/agent-index.md`
  - `.agents/skills/talkpik-orchestrator/SKILL.md`
  - `docs/spec.md`
  - `docs/prd.md`
  - `docs/sitemap.md`
  - `docs/ia.md`
  - `docs/ia-pages/README.md`
  - `docs/user-flow.md`
  - `docs/ant-design/04-page-patterns-for-talkpik.md`
  - `docs/ai-workflow/context-ledger-template.md`
- Extracted requirements:
  - Treat `docs/` as the current source of truth because this project is pre-implementation.
  - Remove the deprecated assistant-support feature from active product, IA, sitemap, flow, README, and design guidance.
  - Keep unrelated AI requirements: generated practice, writing feedback, and saved feedback remain product scope.
  - Verify removal with focused content and path searches.
- Doc conflicts: none after this update. Earlier future/deferred notes for the removed scope were superseded by the current user request.
- Untouched relevant docs and reason: `.agents` and `.codex` skill references with unrelated "Tutorial" wording were not edited because they are not product assistant-support scope.

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 10:30 | Remove the deprecated assistant-support feature rather than keep it as future/deferred scope. | User explicitly asked to remove it from PRD and other documents. | User request |
| 10:30 | Preserve generated practice and writing feedback references. | The request is scoped to the deprecated support feature, not all AI functionality. | `docs/prd.md`, `docs/spec.md` |
| 10:30 | Normalize historical run notes that still contained the removed scope. | The user asked to remove this content from other documents too, and search showed run ledgers still contained it. | `rg` verification |

## Active Files

- Files expected to change:
  - `README.md`
  - `docs/prd.md`
  - `docs/user-flow.md`
  - `docs/sitemap.md`
  - `docs/ia.md`
  - `docs/ia-pages/README.md`
  - `docs/ia-pages/00-common-layout.md`
  - `docs/ia-pages/09-my-vocabulary.md`
  - `docs/ia-pages/14-1-mock-test-exam.md`
  - `docs/ia-pages/99-open-questions.md`
  - removed legacy assistant-support IA page
  - `docs/ant-design/01-design-values.md`
  - `docs/ant-design/02-global-styles.md`
  - `docs/ant-design/04-page-patterns-for-talkpik.md`
  - `docs/ant-design/05-visual-motion-illustration.md`
  - `docs/ant-design/07-review-checklist.md`
  - affected `docs/ai-workflow/runs/**` ledgers
- Files inspected:
  - Files listed above plus workflow and skill routing docs.
- Files changed:
  - `README.md`
  - `docs/prd.md`
  - `docs/user-flow.md`
  - `docs/sitemap.md`
  - `docs/ia.md`
  - `docs/ia-pages/README.md`
  - `docs/ia-pages/00-common-layout.md`
  - `docs/ia-pages/09-my-vocabulary.md`
  - `docs/ia-pages/14-1-mock-test-exam.md`
  - `docs/ia-pages/99-open-questions.md`
  - removed legacy assistant-support IA page deleted
  - `docs/ant-design/01-design-values.md`
  - `docs/ant-design/02-global-styles.md`
  - `docs/ant-design/04-page-patterns-for-talkpik.md`
  - `docs/ant-design/05-visual-motion-illustration.md`
  - `docs/ant-design/07-review-checklist.md`
  - `docs/ai-workflow/runs/2026/05/20/20260520-1030-remove-assistant-support-scope.md`
  - `docs/ai-workflow/runs/2026/05/20/20260520-1000-route-scope-alignment.md`
  - `docs/ai-workflow/runs/2026/05/19/20260519-0834-serverless-dev-spec-recommendation.md`
  - `docs/ai-workflow/runs/2026/05/19/20260519-0841-auth-ai-boundary-recommendation.md`
  - `docs/ai-workflow/runs/2026/05/19/20260519-0940-development-stack-freeze.md`
  - `docs/ai-workflow/runs/2026/05/19/20260519-1445-remove-ai-vercel-boundary.md`
- Files explicitly not to touch:
  - Unrelated dirty worktree changes outside this removal.

## Agent Assignments

| Agent | Role | Scope | Status | Packet location or summary |
| --- | --- | --- | --- | --- |
| Codex main | Coordinator/executor | Search, edit, and verify documentation removal. | complete | This ledger |

## Child Result Packets

No child agents used.

## Verification State

- Required checks:
  - Focused content search for removed feature terms.
  - Focused path search for removed feature terms.
  - Agent skill mirror check.
  - AI workflow repository check.
- Checks run:
  - Focused content search across `README.md`, `docs`, `.agents`, and `.codex` for the removed feature terms.
  - Focused path search across `README.md`, `docs`, `.agents`, and `.codex` for the removed feature terms.
  - `node scripts/sync-agent-skills.mjs --check`
  - `node scripts/ai-workflow-check.mjs --repo .`
- Latest results:
  - Content/path searches: no matches for the removed feature terms.
  - Skill mirror check: pass.
  - Workflow check: pass.
- Known failures:
  - First workflow check failed because this ledger lacked required template sections; this file was expanded to match the required structure.
- Skipped checks and reason:
  - No application tests; this was a docs-only change in a pre-implementation repository.
- Cross-model review: degraded — historical, pre-rule (single-AI authored before 2026-05-21 cross-review rule was introduced)

## Fallback State

- Normal path blocked: no.
- Failure class: none.
- Fallback used: none.
- Evidence collected: focused search output and workflow checks.
- Completion allowed: yes.
- Remaining fallback risk: none.

## Ledger/File-State Consistency

- Files changed match accepted scope: yes.
- Docs consulted match implemented behavior: yes.
- Child result packets integrated: not applicable.
- Verification state current: yes.
- Remaining risks listed: yes.

## Risks And Follow-Up

- Remaining risks: Existing unrelated dirty worktree state remains; this task did not revert or normalize it.
- Assumptions: The user intended removal of this feature scope only, not all AI product capability.
- Follow-up needed: none after final verification passes.
