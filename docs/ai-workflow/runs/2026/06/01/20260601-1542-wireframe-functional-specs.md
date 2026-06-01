# Wireframe Functional Specs Ledger

## Run Metadata

- Run id: 20260601-1542-wireframe-functional-specs
- Created: 2026-06-01 15:42 KST
- Updated: 2026-06-01 15:56 KST
- Main session owner: Codex
- Host: Codex
- Status: complete

## Task

- User goal: Create per-page functional specifications under `docs/Wireframe/`, including page-level database data usage from `supabase/migrations/` and current source code.
- Accepted scope:
  - Add `functional-spec.md` for all 34 Wireframe page folders.
  - Add `docs/Wireframe/functional-spec-index.md` and `docs/Wireframe/data-usage-index.md`.
  - Add a read-only inventory script and test for migration/source/page data mapping.
  - Update `package.json` with the new verification script.
- Out of scope:
  - No runtime UI, auth, database, API, or RLS behavior changes.
  - No new database migrations.
  - No billing or organization table design decisions beyond recording current gaps.
- Current next action: Final report.

## Docs Consulted

- Exact files read:
  - `AGENTS.md`
  - `.agents/superpowers/skills/using-superpowers/SKILL.md`
  - `.codex/skills/executing-plans/SKILL.md`
  - `.codex/skills/using-git-worktrees/SKILL.md`
  - `.codex/skills/test-driven-development/SKILL.md`
  - `.codex/skills/writing-plans/SKILL.md`
  - `.codex/skills/talkpik-state-data/SKILL.md`
  - `.codex/skills/talkpik-supabase-boundary/SKILL.md`
  - `.codex/skills/supabase-postgres-best-practices/SKILL.md`
  - `docs/agent-index.md`
  - `docs/user-communication-style.md`
  - `docs/report-writing-template.md`
  - `docs/ai-development-workflow.md`
  - `docs/ai-workflow/planning-contracts.md`
  - `docs/ai-workflow/context-and-packets.md`
  - `docs/ai-workflow/review-gates.md`
  - `docs/ai-workflow/templates/context-ledger-template.md`
  - `docs/Wireframe/README.md`
  - `docs/Wireframe/04-B-01-home-dashboard/description.md`
  - `docs/Wireframe/31-X-09-notification-settings/description.md`
  - `docs/flow/user-flow.md`
  - `docs/user-flow.md`
  - `docs/prd.md`
  - `docs/spec.md`
  - `docs/ia.md`
  - `docs/sitemap.md`
  - `docs/development/database-schema.md`
  - `docs/development/backend-auth.md`
  - `supabase/migrations/INDEX.md`
- Extracted requirements:
  - Active IA source is `docs/Wireframe/`, not legacy `docs/IA` or `docs/ia-pages`.
  - Active user flow is `docs/flow/user-flow.md`; `docs/user-flow.md` is legacy context only.
  - Every Wireframe page folder needs a functional specification with feature, state, permission, implementation, gap, acceptance, and verification sections.
  - Database truth must be derived from SQL migrations first, then checked against source Supabase calls and active docs.
  - User-owned data must respect Supabase RLS and `auth.uid()` ownership boundaries.
  - Admin pages must record role guard/RPC/audit log expectations.
  - Deferred billing and missing organization-specific tables must be recorded as gaps rather than invented.
- Doc conflicts:
  - `docs/sitemap.md` says `docs/Wireframe/README.md` is the current 32-screen IA inventory, but the current folder inventory has 34 page folders.
  - `docs/development/database-schema.md` documents the initial schema baseline and does not fully reflect later migrations such as `profiles.notification_prefs`, `profiles.bio`, auth bootstrap, cleanup/storage hardening, and Phase 6 RPC/admin changes.
  - Existing IA audit output may still contain stale `docs/IA/...` references; this run normalizes to `docs/Wireframe/...`.
- Untouched relevant docs and reason:
  - `docs/development/deferred-scope.md` - not needed for implementation beyond the accepted billing/org gap already captured from `docs/sitemap.md` and database docs.
  - `docs/ant-design/README.md` - no UI implementation or visual design change is in scope.

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 2026-06-01 15:42 | Work in the current branch/workspace. | The branch is not main/master and the worktree already contains untracked `docs/Wireframe/` source material; creating a fresh worktree would lose that local context. | `git branch --show-current`, `git status --short` |
| 2026-06-01 15:42 | Treat migrations and source usage as stronger evidence than prose docs when they conflict. | User asked to catch unnoticed DB tables/columns/data; SQL/source are the current implementation evidence. | User request, `docs/development/backend-auth.md` |
| 2026-06-01 15:44 | Write a failing inventory test before implementation. | The plan requires TDD for the new script. | `tests/audit-setup/build-wireframe-data-inventory.test.ts` |
| 2026-06-01 15:50 | Add `--write-specs` support to the inventory script. | Keeps page specs and global indexes in sync with the same DB/source inventory evidence. | `scripts/audit-setup/build-wireframe-data-inventory.mjs` |
| 2026-06-01 15:56 | Git publication decision: no-commit. | Repo-wide format and workflow checks fail on pre-existing unrelated files, and the working tree has many unrelated user changes. | `pnpm format`, `node scripts/ai-workflow-check.mjs --repo .`, `git status --short` |

## Active Files

- Files expected to change:
  - `package.json`
  - `scripts/audit-setup/build-wireframe-data-inventory.mjs`
  - `tests/audit-setup/build-wireframe-data-inventory.test.ts`
  - `docs/Wireframe/**/functional-spec.md`
  - `docs/Wireframe/functional-spec-index.md`
  - `docs/Wireframe/data-usage-index.md`
  - `reports/wireframe-functional-specs/runs/**/data-inventory.json`
  - this ledger
- Files inspected:
  - `docs/Wireframe/**/description.md`
  - `docs/sitemap.md`
  - `docs/flow/user-flow.md`
  - `src/**`
  - `supabase/migrations/**`
- Files changed:
  - `docs/ai-workflow/runs/2026/06/01/20260601-1542-wireframe-functional-specs.md`
  - `package.json`
  - `scripts/audit-setup/build-wireframe-data-inventory.mjs`
  - `tests/audit-setup/build-wireframe-data-inventory.test.ts`
  - `docs/Wireframe/**/functional-spec.md`
  - `docs/Wireframe/functional-spec-index.md`
  - `docs/Wireframe/data-usage-index.md`
  - `reports/wireframe-functional-specs/runs/20260601-1542/data-inventory.json`
  - `reports/ia-verification/runs/20260601-120308/doc-receipts.json`
  - `reports/ia-verification/runs/20260601-120308/doc-receipt-validation-results.json`
  - `reports/ia-verification/runs/20260601-120308/ia-manifest.json`
  - `reports/ia-verification/runs/20260601-120308/source-map-results.json`
- Files explicitly not to touch:
  - Existing user changes outside this accepted scope.
  - Runtime UI/source files except read-only inspection.
  - Existing Supabase migrations.

## Agent Assignments

| Agent | Role | Scope | Status | Packet location or summary |
| --- | --- | --- | --- | --- |
| Codex | implementer | Full accepted scope | active | Single-session implementation; no child agent dispatched. |

## Child Result Packets

Not applicable.

## Verification State

- Required checks:
  - `pnpm test -- tests/audit-setup/build-wireframe-data-inventory.test.ts`
  - `pnpm test:wireframe:data-map`
  - `pnpm test:ia:manifest`
  - `pnpm test:ia:source-map`
  - `pnpm test:ia:docs`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm format`
  - `node scripts/ai-workflow-check.mjs --repo .`
- Checks run:
  - `pnpm test -- tests/audit-setup/build-wireframe-data-inventory.test.ts`
  - `pnpm test:wireframe:data-map -- --audit-dir reports/wireframe-functional-specs/runs/20260601-1542`
  - `pnpm test:ia:manifest`
  - `pnpm test:ia:source-map`
  - `pnpm test:ia:receipts`
  - `pnpm test:ia:docs`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm exec prettier --check package.json scripts/audit-setup/build-wireframe-data-inventory.mjs tests/audit-setup/build-wireframe-data-inventory.test.ts docs/ai-workflow/runs/2026/06/01/20260601-1542-wireframe-functional-specs.md docs/Wireframe/functional-spec-index.md docs/Wireframe/data-usage-index.md docs/Wireframe/*/functional-spec.md reports/wireframe-functional-specs/runs/20260601-1542/data-inventory.json`
  - `pnpm format`
  - `node scripts/ai-workflow-check.mjs --repo .`
- Latest results:
  - RED: failed as expected because `scripts/audit-setup/build-wireframe-data-inventory.mjs` did not exist yet.
  - GREEN: passed after adding the inventory script and `test:wireframe:data-map`.
  - Inventory output: 34 pages, 17 tables, 18 RPC/functions, 3 storage buckets, 78 source usages, 121 page data links, 0 unclassified DB objects.
  - 34/34 Wireframe folders have `functional-spec.md`.
  - IA manifest, IA source-map, IA receipts, IA docs validation all passed after receipts were regenerated from current `docs/Wireframe` paths.
  - `pnpm lint` exited 0 with 20 pre-existing warnings outside the new script/test.
  - `pnpm typecheck` exited 0.
  - Targeted Prettier check for this run's changed files exited 0.
  - `pnpm format` failed because the broader repository has 180 pre-existing formatting differences.
  - `node scripts/ai-workflow-check.mjs --repo .` failed on unrelated existing ledger `docs/ai-workflow/runs/2026/06/01/20260601-1203-ia-full-audit-run.md`.
- Known failures:
  - Repo-wide Prettier check fails on existing files outside this run.
  - Repo-wide workflow checker fails on an existing IA audit ledger missing required sections/fields.
- Skipped checks and reason:
  - Browser/visual QA skipped - no UI runtime behavior change is in scope.
- Cross-model review: degraded - no second model review surface is available in this Codex session; self-review and workflow checks will be recorded.
- Architecture Pass: skipped - docs/script-only work, no runtime architecture boundary change.
- UX/UI Consistency Pass: skipped - docs/script-only work, no UI component or style change.
  - Tokens: skipped - no UI token or CSS change.
  - Components: skipped - no UI component change.
  - A11y: skipped - no rendered UI change.
  - Responsive: skipped - no responsive layout change.
- QA Gate: skipped - no user-facing runtime path changed.

## Fallback State

- Normal path blocked: no.
- Failure class: degraded-mode.
- Fallback used: targeted Prettier check on this run's changed files, focused inventory test, IA validation checks, lint, and typecheck.
- Evidence collected: verification commands listed above.
- Completion allowed: yes for implementation scope; no commit/publication due repo-wide unrelated failures and dirty working tree.
- Remaining fallback risk: repo-wide formatting and workflow-check failures still need separate cleanup.

## Ledger/File-State Consistency

- Files changed match accepted scope: yes.
- Docs consulted match implemented behavior: yes.
- Child result packets integrated: not applicable.
- Verification state current: yes.
- Remaining risks listed: yes.

## Risks And Follow-Up

- Remaining risks:
  - Existing working tree has many unrelated user changes; final report must distinguish this run's files from pre-existing dirty state.
  - Some DB-to-page links are inferred from source modules and route ownership, not explicit page-level query calls.
  - Current prose docs are partially stale relative to migrations.
  - Repo-wide `pnpm format` and `node scripts/ai-workflow-check.mjs --repo .` are not green because of unrelated existing files.
- Assumptions:
  - "All discovered features/data" means evidence-based best effort plus explicit gap recording, not inventing missing schema or product behavior.
  - Generated docs may use Korean prose because the surrounding docs and user request are Korean.
- Follow-up needed:
  - Separate cleanup for pre-existing repo-wide formatting issues if the team wants `pnpm format` green.
  - Separate cleanup for `docs/ai-workflow/runs/2026/06/01/20260601-1203-ia-full-audit-run.md` if the team wants workflow checker green.
