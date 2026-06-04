# User/Admin Data Inventory Ledger

## Run Metadata

- Run id: 20260604-2039-user-admin-data-inventory
- Created: 2026-06-04 20:39 Asia/Seoul
- Updated: 2026-06-04 21:01 Asia/Seoul
- Main session owner: Codex
- Host: Codex
- Status: complete

## Task

- User goal: Build documentation tables that compare v13 user-facing pages, the implemented DB schema they use, and the current topik-ai admin pages/mock data that may manage those same surfaces. Then create a browser-friendly HTML version of the organized content.
- Accepted scope: Documentation and investigation only. Create a cross-app inventory table from existing docs/source and a static HTML report. No real DB CRUD and no product implementation.
- Out of scope: Editing v13 admin features, changing database schema/RPC/RLS, wiring topik-ai to a real DB, running production data checks, or modifying unrelated existing worktree changes.
- Current next action: Complete; next work should select the first reconciliation slice.

## Docs Consulted

- Exact files read:
  - `.agents/superpowers/skills/using-superpowers/SKILL.md`
  - `docs/agent-index.md`
  - `docs/user-communication-style.md`
  - `docs/ai-development-workflow.md`
  - `docs/report-writing-template.md`
  - `.codex/skills/gstack/document-generate/SKILL.md`
  - `docs/ai-workflow/context-and-packets.md`
  - `docs/ai-workflow/templates/context-ledger-template.md`
  - `docs/user-admin-consistency-method.md`
  - `docs/admin-scope-boundary.md`
  - `docs/Wireframe/data-usage-index.md`
  - `docs/development/database-schema.md`
  - `supabase/migrations/20260602120100_billing.sql`
  - `supabase/migrations/20260602120200_notifications_and_settings.sql`
  - `src/lib/supabase/types.ts`
  - `docs/sitemap.md`
  - `docs/ia.md`
  - `docs/spec.md`
  - `docs/development/backend-auth.md`
  - `C:\Users\admin\Desktop\workspace\topik-ai\AGENTS.md`
  - `C:\Users\admin\Desktop\workspace\topik-ai\docs\page-sync\README.md`
  - `C:\Users\admin\Desktop\workspace\topik-ai\docs\page-sync\*-page-sync.md`
  - `C:\Users\admin\Desktop\workspace\topik-ai\docs\architecture\admin-overview.md`
  - `C:\Users\admin\Desktop\workspace\topik-ai\docs\architecture\admin-data-source-transition.md`
  - `C:\Users\admin\Desktop\workspace\topik-ai\docs\specs\admin-data-contract.md`
  - `C:\Users\admin\Desktop\workspace\topik-ai\docs\specs\admin-data-usage-map.md`
  - `C:\Users\admin\Desktop\workspace\topik-ai\docs\specs\admin-action-log.md`
  - `C:\Users\admin\Desktop\workspace\topik-ai\src\app\router\app-router.tsx`
- Extracted requirements:
  - v13 is the user-facing app; topik-ai is the authoritative admin implementation for this reconciliation work.
  - Do not build, extend, or remediate admin features inside v13.
  - Reconcile overlapping entities only.
  - v13 migrations are the concrete implemented schema; topik-ai admin data contract is a candidate/admin-side reference.
  - topik-ai page-sync docs are the primary admin-page contract for this pass; code/service inspection is only a support signal for current mock/store/source state.
  - The planned artifact should contain shared entity mapping, status/enum glossary, and open conflict register.
  - The follow-up HTML artifact should preserve the same documentation baseline while improving browser reviewability.
  - Ledger is required because this is non-trivial, cross-repo, likely-to-resume documentation work.
  - Live DB CRUD validation is explicitly deferred.
- Doc conflicts:
  - `docs/Wireframe/data-usage-index.md` notes database-schema drift: `docs/development/database-schema.md` may lag later migrations under `supabase/migrations`.
- Untouched relevant docs and reason:
  - topik-ai `docs/specs/page-ia/*.md` - not read one by one because user specifically redirected admin investigation to `docs/page-sync`, and page-sync already references those IA docs per page.
  - topik-ai implementation files beyond feature file listing/search - not exhaustively read because this is a document-first inventory and page-sync is the requested source of truth.

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 2026-06-04 20:39 | Create a new documentation artifact instead of doing real CRUD. | User explicitly redirected the work to document-first investigation. | User request |
| 2026-06-04 20:39 | Treat v13 internal admin as reference-only and topik-ai as the admin comparison target. | v13 admin scope boundary forbids active admin build in v13. | `docs/admin-scope-boundary.md` |
| 2026-06-04 21:04 | Use topik-ai `docs/page-sync` as the primary admin investigation source. | User specifically said topik-ai should be investigated around that folder. | User request |
| 2026-06-04 21:12 | Add a v13 docs artifact and index link only; do not edit topik-ai. | Current deliverable is a cross-repo baseline table owned from v13 docs, with topik-ai as read-only source. | User request + topik-ai docs rules |
| 2026-06-04 21:01 | Add a standalone HTML report beside the Markdown source. | User asked to make the organized content into HTML, and static documentation avoids runtime/development changes. | User request |

## Active Files

- Files expected to change:
  - `docs/user-admin-data-consistency.md`
  - `docs/user-admin-data-consistency.html`
  - `docs/README.md`
  - `docs/ai-workflow/runs/2026/06/04/20260604-2039-user-admin-data-inventory.md`
- Files inspected:
  - See Docs Consulted.
- Files changed:
  - `docs/ai-workflow/runs/2026/06/04/20260604-2039-user-admin-data-inventory.md`
  - `docs/user-admin-data-consistency.md`
  - `docs/user-admin-data-consistency.html`
  - `docs/README.md`
- Files explicitly not to touch:
  - Existing modified/untracked files unrelated to this request.
  - v13 admin implementation files.
  - Supabase migrations/RPC/RLS.
  - topik-ai implementation files/docs.

## Agent Assignments

| Agent | Role | Scope | Status | Packet location or summary |
| --- | --- | --- | --- | --- |
| Main session | Coordinator/investigator | Cross-repo documentation inventory and HTML report | completed | Owns final artifact and verification. |
| Planck | Explore | v13 user route/data usage map, read-only | completed | Returned table of v13 DB/RPC/storage usage by user routes; integrated into `docs/user-admin-data-consistency.md`. |
| Confucius | Explore | topik-ai admin route/mock/service map, read-only | failed | Failed with `context_length_exceeded`; main session used direct `docs/page-sync` extraction plus topik-ai data-source docs as fallback. |

## Child Result Packets

- Planck result integrated:
  - v13 user-facing objects identified: `profiles`, `learning_goals`, `problems`, `problem_assets`, `problem_attempts`, `recommendation_runs`, `recommendation_items`, `writing_drafts`, `writing_submissions`, `writing_feedback`, `feedback_dimension_scores`, `sentence_feedback`, `comparison_reports`, `library_items`, `study_events`, `export_files`, `subscription_plans`, `subscriptions`, `payment_history`, `notification_settings`, `notification_log`, `avatars`, and user-facing RPCs.
  - Noted that several flows use RPC/server actions and therefore need RPC-level mapping, not only table-level mapping.
- Confucius fallback:
  - Directly extracted topik-ai page-sync metadata, CRUD candidates, and user-screen claims from `docs/page-sync`.
  - Used `docs/architecture/admin-data-source-transition.md`, `docs/specs/admin-data-contract.md`, and `src/features/**` file/search evidence for mock/service/store state.

## Verification State

- Required checks:
  - Inspect generated Markdown for required tables and source references.
  - Inspect generated HTML for required sections and UTF-8 Korean content.
  - Run `node scripts/ai-workflow-check.mjs --repo .` if Node is available.
- Checks run:
  - `Get-Content -Encoding UTF8 docs/user-admin-data-consistency.md` - inspected generated Markdown tables.
  - `git diff --check -- docs/user-admin-data-consistency.md docs/README.md docs/ai-workflow/runs/2026/06/04/20260604-2039-user-admin-data-inventory.md` - passed.
  - `node scripts/ai-workflow-check.mjs --repo .` - failed once because the ledger lacked the required UX/UI sub-fields while the repo has pre-existing UI dirty files.
  - `node scripts/ai-workflow-check.mjs --repo .` - passed after ledger UX/UI skip evidence was added.
  - `Get-Content -Encoding UTF8 docs/user-admin-data-consistency.html` - inspected generated HTML header and UTF-8 Korean content.
  - `Select-String -Encoding UTF8 docs/user-admin-data-consistency.html -Pattern "v13 사용자 화면","topik-ai 관리자","검증 메모","사용자 페이지별"` - passed.
  - `git diff --check -- docs/README.md docs/ai-workflow/runs/2026/06/04/20260604-2039-user-admin-data-inventory.md` - passed after HTML ledger update.
  - HTML trailing-whitespace check with `Select-String -Encoding UTF8 -Pattern '[ \t]+$'` - passed.
  - HTML required-marker check for title, major sections, and Markdown source link - passed.
  - `node scripts/ai-workflow-check.mjs --repo .` - failed after HTML update because an unrelated untracked ledger, `docs/ai-workflow/runs/2026/06/04/20260604-2110-antd-deprecated-fix.md`, is missing `## Ledger/File-State Consistency`.
- Latest results:
  - Markdown content is present and readable.
  - HTML report is present, UTF-8 readable, and contains the required major sections.
  - README/ledger whitespace check passed.
  - Task-scoped ledger required-section markers are present.
  - Global workflow check is currently blocked by the unrelated untracked ledger noted above.
- Known failures:
  - Initial workflow check failed with missing `Tokens`, `Components`, `A11y`, and `Responsive` sub-fields under UX/UI Consistency Pass; resolved by adding the required skip evidence because this task changed docs only.
  - Latest global workflow check failed due an unrelated untracked ledger outside this task scope; this task did not modify that file.
- Skipped checks and reason:
  - Live DB CRUD verification: skipped - user explicitly requested document-first inventory and no CRUD validation yet.
- Cross-model review: degraded - used read-only explore child for v13 data inventory; topik-ai child failed with context length and was replaced by direct page-sync extraction.
- Architecture Pass: skipped - docs-only inventory, no implementation or architecture boundary changes.
- UX/UI Consistency Pass: skipped - current task changed docs/ledger only; pre-existing dirty UI files were not part of this task.
  - Tokens: skipped - no design token, CSS, or UI source file was changed by this task.
  - Components: skipped - no React/AntD component implementation was changed by this task.
  - A11y: skipped - no rendered UI, labels, roles, keyboard flow, focus behavior, or contrast changed by this task.
  - Responsive: skipped - no layout or breakpoint behavior changed by this task.
- QA Gate: skipped - docs-only change, no runnable UI path changed.

## Fallback State

- Normal path blocked: partially for the global repo workflow check only, due an unrelated untracked ledger outside this task scope.
- Failure class: partial child-agent failure.
- Fallback used: direct page-sync extraction and targeted topik-ai source/data-source doc inspection.
- Evidence collected: startup docs, v13 schema/page usage docs/source, topik-ai page-sync docs, topik-ai data-source docs/source listing.
- Completion allowed: yes, document-first inventory, HTML report, and task-scoped verification are complete.
- Remaining fallback risk: topik-ai implementation details were not exhaustively read; this is acceptable for page-sync-first documentation inventory. The unrelated ledger must be fixed by its owning task before the global workflow check can pass again.

## Ledger/File-State Consistency

- Files changed match accepted scope: yes.
- Docs consulted match implemented behavior: yes for this document-first inventory level.
- Child result packets integrated: yes.
- Verification state current: yes.
- Remaining risks listed: yes.

## Risks And Follow-Up

- Remaining risks:
  - The inventory may expose mismatches between topik-ai candidate JSON/mock data and v13 real migrations.
  - Some v13 data usage docs may be stale relative to actual source.
  - topik-ai page-sync docs include planned surfaces that are not implemented in v13.
  - Real correctness still requires a later live DB CRUD validation pass after a narrower slice is selected.
- Assumptions:
  - The output artifact belongs in `docs/user-admin-data-consistency.md`, matching the method document.
  - Documentation-only investigation can proceed without live DB access.
- Follow-up needed:
  - Select the first reconciliation slice. Recommended: `problems`/`problem_assets` vs topik-ai `Assessment > TOPIK 쓰기 문제은행`.
  - Turn the selected slice into a field-level mapping and then a CRUD validation checklist.
