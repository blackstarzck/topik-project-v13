# Admin Console Derived Spec — Ledger

## Run Metadata

- Run id: 20260604-2100-admin-console-derived-spec
- Created: 2026-06-04 21:00 Asia/Seoul
- Main session owner: Claude (Opus 4.8)
- Host: Claude Code
- Status: complete

## Task

- User goal: "현재 구현된 내용을 바탕으로 관리자 페이지를 만들경우 어떤 내용으로 만들어야 할지" md + html 문서로 작성.
- Interpreted scope: Documentation only. Reverse-derive — from v13's currently-implemented user-facing features + shared schema — what an admin console would need to manage. Organized by admin screen. Two deliverables: a Markdown spec and a self-contained HTML view.
- Out of scope (explicit): building/extending/removing any admin code in v13; schema/migration/RPC/RLS changes; editing topik-ai; live DB CRUD. Admin is owned by topik-ai (`docs/admin-scope-boundary.md`).
- Framing decision: deliverable is a derived planning reference for the LATER admin↔v13 sync phase, NOT a build mandate for v13. This is stated prominently in both files (banner / section 0).

## Docs Consulted

- Exact files read:
  - `.claude/skills/using-superpowers/SKILL.md` (invoked at task start)
  - `docs/admin-scope-boundary.md`
  - `docs/user-admin-data-consistency.md` (primary evidence — prior Codex inventory)
  - `docs/user-admin-consistency-method.md`
  - `docs/ai-workflow/runs/2026/06/04/20260604-2039-user-admin-data-inventory.md`
  - `src/app/(workspace)/admin/page.tsx`
  - `src/lib/auth/admin-guard.ts`
  - Globbed: `src/app/**/page.tsx`, `src/{components,lib}/admin/**/*.{ts,tsx}`
- Extracted requirements:
  - v13 = user-facing only; topik-ai = authoritative admin. Do not build admin in v13.
  - Reconcile overlapping entities only; user screens reconcile TO admin-first schema.
  - User-owned / service-written / immutable data → admin should be read/support/analytics, not CRUD.
  - Anchor screen names/terms on topik-ai admin contract (via the prior inventory).
- Doc conflicts: none new. (Inventory already notes `database-schema.md` may lag migrations; not material to this doc-level derivation.)
- Untouched relevant docs and reason:
  - topik-ai source/docs — not re-read directly; the prior inventory (section 6) already extracted the topik-ai page structure, and a prior child agent hit `context_length_exceeded` reading topik-ai. Relied on the inventory as the anchored source.

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 2026-06-04 21:00 | Produce a derived planning reference, not a v13 build artifact. | Admin scope boundary forbids active admin build in v13. | `docs/admin-scope-boundary.md` |
| 2026-06-04 21:00 | Reuse the prior inventory as the primary evidence base; reorganize by admin screen. | The entity↔admin mapping was already done on 2026-06-04; the new value is screen-level structure + CRUD/read classification. | `docs/user-admin-data-consistency.md` |
| 2026-06-04 21:00 | Classify each area CRUD vs state-change vs read/support vs analytics. | Highest-risk admin mistake is direct CRUD on user-owned/immutable data. | inventory §4–§7 |
| 2026-06-04 21:00 | Skip editing `docs/README.md` index. | README is already dirty from concurrent work; user asked only for md+html. Avoid mixing concerns. | git status + [[feedback-concurrent-agent-worktree]] |

## Active Files

- Files created:
  - `docs/admin-console-derived-spec.md`
  - `docs/admin-console-derived-spec.html`
  - `docs/ai-workflow/runs/2026/06/04/20260604-2100-admin-console-derived-spec.md`
- Files explicitly not touched:
  - Any `src/**/admin/**`, `src/lib/admin/**`, `src/lib/auth/admin-guard.ts` (read-only).
  - `supabase/migrations/**`, RPC/RLS.
  - topik-ai repo.
  - Pre-existing dirty/untracked files unrelated to this request.

## Verification State

- Required checks (docs-only, right-sized per [[feedback-docs-only-gate-rightsizing]]):
  - Markdown content present + internally consistent with the inventory.
  - HTML well-formed and viewable standalone (no external deps).
  - `git diff --check` whitespace on new docs.
  - `node scripts/ai-workflow-check.mjs --repo .` if Node available.
- Checks run: see "Latest results" after execution.
- Cross-model review: skipped — docs-only derivation from an already cross-audited inventory; finding is quantitative (mapping reproduced from inventory tables), not new product behavior. Per [[feedback-docs-only-gate-rightsizing]], round-cap 1, no debate gate.
- Architecture Pass: skipped — no implementation/architecture boundary change.
- UX/UI Consistency Pass: skipped — no app UI source changed (the HTML is a standalone doc, not an app surface).
  - Tokens: skipped — no design token/CSS/UI source changed in the app.
  - Components: skipped — no React/AntD component changed.
  - A11y: skipped — standalone reference doc; not a rendered app surface or component.
  - Responsive: skipped — no app layout/breakpoint changed (doc has a minimal responsive style only).
- QA Gate: skipped — docs-only, no runnable app path changed.

## Latest results

- `git diff --check` (3 new docs): clean (exit 0).
- HTML tag-balance (html/head/body/table/thead/tbody/tr/div/dl): all open==close.
- `ai-workflow-check.mjs`: green for THIS ledger (only failure remaining = concurrent session's `20260604-2110-antd-deprecated-fix.md`, not touched).
- UI smoke guard (Stop hook) fired on AMBIENT change `src/app/(workspace)/profile/page.tsx`
  (`<Space direction=> orientation=>`, antd-6 deprecation — concurrent Codex `antd-deprecated-fix`, NOT this turn).
  Resolved with real evidence rather than bypass: reused running dev server (PID on :3000, HTTP 200),
  ran `dev-route-smoke.mjs --routes /profile,/dashboard --viewports 1280` (via PowerShell — Git Bash mangled
  `/profile`→`C:/Program Files/Git/profile`, see [[project-ui-redesign-pilot-plan]] Git Bash trap).
  Artifact `docs/ui-redesign/pilot-shots/smoke-result.json`: both routes ok=true status=200,
  consoleErrors=0, antd-deprecated=0.
- Did NOT edit the concurrent agent's `profile/page.tsx` or its ledger; did NOT create `.smoke-skip`.

## Ledger/File-State Consistency

- Files changed match accepted scope: yes (3 doc files only; no src/schema/topik-ai touched).
- Docs consulted match produced content: yes — content is derived from the inventory tables and the read admin code/routes.
- Child result packets integrated: n/a (no child agents this run).
- Verification state current: yes (whitespace clean, HTML tag-balanced, workflow-check green for this ledger).
- Remaining risks listed: yes (see below).

## Risks And Follow-Up

- Risks:
  - Screen names/terms are anchored via the inventory, not a fresh topik-ai read; verify against `topik-ai/docs/specs/admin-data-contract.md` before any real mapping.
  - Some v13 usage docs may lag migrations (per inventory note).
- Assumptions:
  - Deliverable belongs in `docs/` (sibling to the inventory).
  - This is pre-CRUD planning; no live validation expected now.
- Follow-up:
  - First reconciliation slice = `problems`/`problem_assets` ↔ Assessment 쓰기 문제은행 → field-level mapping + status/enum glossary.
  - Optional: add a discoverability link in `docs/README.md` once concurrent README edits settle.
