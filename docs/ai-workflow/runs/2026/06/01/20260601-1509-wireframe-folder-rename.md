# Wireframe Folder Rename Ledger

## Run Metadata

- Run id: 20260601-1509-wireframe-folder-rename
- Created: 2026-06-01 15:09 +09:00
- Updated: 2026-06-01 15:16 +09:00
- Main session owner: Codex
- Host: Codex
- Status: complete

## Task

- User goal: Rename `docs/IA` to `docs/Wireframe` and update affected active references without changing product meaning.
- Accepted scope: Active docs, scripts, tests, source comments, Supabase comments, and this ledger.
- Out of scope: Historical records under `docs/ai-workflow/runs/**`, `reports/**`, `tasks/**`, and `test-results/**`.
- Current next action: Report completion with verification caveats for unrelated repository failures.

## Docs Consulted

- Exact files read:
  - `.agents/superpowers/skills/using-superpowers/SKILL.md`
  - `.codex/skills/executing-plans/SKILL.md`
  - `.codex/skills/verification-before-completion/SKILL.md`
  - `docs/agent-index.md`
  - `docs/user-communication-style.md`
  - `docs/ai-development-workflow.md`
  - `docs/ai-workflow/planning-contracts.md`
  - `docs/ai-workflow/context-and-packets.md`
  - `docs/report-writing-template.md`
  - `docs/ai-workflow/templates/context-ledger-template.md`
  - `docs/ai-workflow/templates/report-template.md`
  - `docs/IA/README.md`
  - `package.json`
  - `scripts/audit-setup/ia-audit-lib.mjs`
  - `scripts/verify-ia-coverage.mjs`
  - `tests/scripts/ia-audit-scripts.test.ts`
  - `tests/e2e/coverage/ia-catalog.ts`
- Extracted requirements:
  - Use Superpowers and project workflow docs before editing.
  - Keep `IA` as the information-architecture concept and IA code system.
  - Rename the active screen artifact folder from `docs/IA` to `docs/Wireframe`.
  - Update active path references only; do not rewrite historical records.
  - Maintain a ledger because this is multi-file, script/test-affecting work.
  - Verify by path search, manifest generation, source-map validation, focused tests, typecheck, lint, and workflow check.
- Doc conflicts: none for the requested path rename. Existing 32-vs-34 IA prose drift is out of scope unless touched by a path-only edit.
- Untouched relevant docs and reason:
  - `docs/ai-workflow/runs/**` - historical run records excluded by user plan.
  - `reports/**` - generated/historical report records excluded by user plan.
  - `tasks/**` - historical command output excluded by user plan.
  - `test-results/**` - generated test output excluded by user plan.

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 2026-06-01 15:09 +09:00 | Keep IA names for concepts, codes, and audit identifiers. | The request is a folder/path rename; changing the IA concept would alter meaning. | User plan |
| 2026-06-01 15:09 +09:00 | Exclude historical run/report/task/test-result files from replacements. | These files record prior states and should not be silently rewritten. | User plan |
| 2026-06-01 15:16 +09:00 | Use `Move-Item` after `git mv` failed with permission denied. | The source and target were verified inside the workspace before moving. | Local command output |

## Active Files

- Files expected to change:
  - `docs/IA/**` renamed to `docs/Wireframe/**`
  - Active docs with path references to `docs/IA`, `./IA`, or `../IA`
  - Audit scripts and tests with hardcoded `docs/IA` paths
  - Source and migration comments that point at `docs/IA`
- Files inspected:
  - `docs/IA/README.md`
  - `scripts/audit-setup/ia-audit-lib.mjs`
  - `scripts/verify-ia-coverage.mjs`
  - `tests/scripts/ia-audit-scripts.test.ts`
  - `tests/e2e/coverage/ia-catalog.ts`
- Files changed:
  - `docs/IA/**` moved to `docs/Wireframe/**`
  - Active docs, scripts, tests, source comments, and Supabase comments containing `docs/IA`, `./IA`, `../IA`, or `docs\IA`
  - `tests/scripts/ia-audit-scripts.test.ts`
  - This ledger
- Files explicitly not to touch:
  - `docs/ai-workflow/runs/**` except this ledger
  - `reports/**`
  - `tasks/**`
  - `test-results/**`

## Agent Assignments

| Agent | Role | Scope | Status | Packet location or summary |
| --- | --- | --- | --- | --- |
| none | n/a | Solo execution; replacements overlap many shared files. | n/a | n/a |

## Child Result Packets

- None.

## Verification State

- Required checks:
  - Path search for active `docs/IA`, `./IA`, `../IA`, and `docs\IA` references.
  - Folder existence check for `docs/Wireframe` and `docs/IA`.
  - `pnpm vitest run tests/scripts/ia-audit-scripts.test.ts`
  - `node scripts/audit-setup/build-ia-manifest.mjs --audit-dir <temp>`
  - `node scripts/audit-setup/validate-ia-source-map.mjs --audit-dir <temp>`
  - `pnpm typecheck`
  - `pnpm lint`
  - `node scripts/ai-workflow-check.mjs --repo .`
- Checks run:
  - Folder check: `docs/Wireframe/README.md` exists, `docs/IA` absent, 34 screen folders.
  - Active old-path search excluding historical records.
  - `node scripts/audit-setup/build-ia-manifest.mjs --audit-dir <temp>`
  - `node scripts/audit-setup/validate-ia-source-map.mjs --audit-dir <temp>`
  - `pnpm vitest run tests/scripts/ia-audit-scripts.test.ts`
  - `pnpm typecheck`
  - `pnpm lint`
  - `node scripts/ai-workflow-check.mjs --repo .`
- Latest results:
  - Folder check: PASS (`docs/Wireframe` exists, `docs/IA` absent, screen folders=34).
  - Active old-path search: PASS (no matches outside excluded historical records).
  - Manifest + source map: PASS (34 entries; first description path `docs/Wireframe/01-A-01-sign-up/description.md`).
  - Focused Vitest: PASS (1 file, 4 tests).
  - Typecheck: PASS (`tsc --noEmit`).
  - Lint: FAIL due existing React lint issues outside this path rename.
  - Workflow check: FAIL due pre-existing missing fields in `docs/ai-workflow/runs/2026/06/01/20260601-1203-ia-full-audit-run.md`.
- Known failures:
  - `pnpm lint` reports existing `react-hooks/purity` and `react-hooks/set-state-in-effect` errors in runtime files. The only changed line among those reported files is a path comment in `src/components/feedback/AnalysisLoadingModal.tsx`.
  - `node scripts/ai-workflow-check.mjs --repo .` reports missing ledger fields in `20260601-1203-ia-full-audit-run.md`, which is outside this task and excluded by the user plan.
- Skipped checks and reason:
  - Browser QA skipped because this task changes document paths and comments only; no rendered UI behavior changes.
- Cross-model review: degraded - no separate model review available in this execution turn; self-review required before completion.
- Architecture Pass: skipped - no runtime architecture, route, data, or UI behavior changes.
- UX/UI Consistency Pass: skipped - no UI implementation files are changed beyond comments, and no visual behavior changes.
  - Tokens: skipped - no token or style changes.
  - Components: skipped - no component behavior changes.
  - A11y: skipped - no rendered UI changes.
  - Responsive: skipped - no layout changes.
- QA Gate: skipped - no browser-visible UI behavior changes.

## Fallback State

- Normal path blocked: none.
- Failure class: none.
- Fallback used: none.
- Evidence collected: focused checks passed; full lint/workflow failures recorded as unrelated existing repository state.
- Completion allowed: yes for the requested path rename scope; no claim that the whole repository is lint/workflow-clean.
- Remaining fallback risk: repository-level lint and workflow checks still need separate cleanup.

## Ledger/File-State Consistency

- Files changed match accepted scope: yes.
- Docs consulted match implemented behavior: yes.
- Child result packets integrated: not applicable.
- Verification state current: yes.
- Remaining risks listed: yes.

## Risks And Follow-Up

- Remaining risks:
  - Existing dirty worktree contains unrelated user changes; final report must separate these from this task.
  - Existing 32-vs-34 prose drift remains where the original wording already existed.
  - Full lint and workflow checks fail on unrelated existing issues.
- Assumptions:
  - New folder name is exactly `Wireframe`.
  - Historical records are not rewritten.
- Follow-up needed:
  - Separate cleanup for the lint errors and the unrelated incomplete ledger if repository-wide green checks are required.
