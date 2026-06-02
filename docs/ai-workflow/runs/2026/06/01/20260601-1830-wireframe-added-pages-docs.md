# Context Ledger - Wireframe Added Pages Docs

- Run id: 20260601-1830-wireframe-added-pages-docs
- Created: 2026-06-01 Asia/Seoul
- Updated: 2026-06-01 Asia/Seoul
- Owner: Codex
- Status: active

## User Goal

Add the five missing candidate pages to `docs/Wireframe/`, create `description.md` and `functional-spec.md` for each, fill those documents, and explicitly state that these five screens were added after the existing 34 screens.

## Scope

- Add Wireframe folders 35 through 39.
- Align README, sitemap, IA procedure, source-map scripts, and focused tests to the 39-screen inventory where needed.
- Docs-first task. No production behavior changes except route metadata alignment for `/admin` and `/password-reset/confirm`.
- TDD exception: docs-first/index alignment task. Focused tests were updated with the count change and run after edits.

## Docs Consulted

- `.agents/superpowers/skills/using-superpowers/SKILL.md`
- `docs/agent-index.md`
- `docs/user-communication-style.md`
- `docs/ai-development-workflow.md`
- `docs/ai-workflow/context-and-packets.md`
- `docs/ai-workflow/review-gates.md`
- `docs/ai-workflow/templates/context-ledger-template.md`
- `docs/Wireframe/README.md`
- `docs/sitemap.md`
- `docs/ia.md`
- `docs/flow/user-flow.md`
- `docs/ai-workflow/ia-page-implementation-verification.md`
- `docs/development/auth-overview.md`
- `docs/development/backend-auth.md`
- Prior investigation ledger: `docs/ai-workflow/runs/2026/06/01/20260601-1825-wireframe-missing-pages-investigation.md`

## Extracted Requirements

- Each new page must have its own `description.md` and `functional-spec.md`.
- Each new document must explicitly say the page was added after the existing 34 Wireframe screens.
- Candidate pages come from implemented routes without standalone Wireframe folders:
  - `/terms`
  - `/privacy`
  - `/admin`
  - `/password-reset/confirm`
  - `/auth/callback-fragment`
- IA count and audit tooling should not continue to enforce 34 after adding five folders.

## Decisions

| Time | Decision | Rationale | Evidence |
| --- | --- | --- | --- |
| 2026-06-01 | Assign X-13 through X-17 to the five added screens. | X-12 is the last existing extension IA; sequential X-codes keep inventory readable. | `docs/Wireframe/README.md` |
| 2026-06-01 | Treat `/auth/callback-fragment` as X-17 page, not only a support surface. | It is a visible Next.js page with a client status card and route source. | `src/app/auth/callback-fragment/page.tsx` |
| 2026-06-01 | Keep wireframe images missing and document that they are code-based additions. | User requested documents, not image generation; existing X-11/X-12 already allow no `wireframe.png`. | `docs/Wireframe/33-X-11-auth-error/description.md` |

## Doc Conflicts

- Some older docs and audit plans still refer to 32 or 34 IA entries. This task updates the active Wireframe/sitemap/procedure path and focused tests; historical run ledgers remain untouched.

Untouched relevant docs: historical run ledgers and older IA execution-plan snapshots under `docs/ai-execution-plans/` still mention 34 because they describe past runs/plans, not the current Wireframe source of truth.

## Verification Plan

- Count Wireframe directories and README links.
- Build IA manifest and source map into a temp audit dir.
- Run focused IA audit script tests.
- Run wireframe data inventory test.
- Run workflow check.

## Review Gate

Cross-model review: degraded — no external reviewer tool is available in this session; compensated with manifest/source-map generation, doc receipt validation, focused Vitest coverage, typecheck, and workflow check.

## Verification State

- `Get-ChildItem docs/Wireframe -Directory | Measure-Object`: 39 directories.
- `Select-String docs/Wireframe/README.md -Pattern "description.md\)" | Measure-Object`: 39 README links.
- `node scripts/audit-setup/build-ia-manifest.mjs`: PASS, 39 IA entries.
- `node scripts/audit-setup/validate-ia-source-map.mjs`: PASS, 39/39 IA source-map rows PASS and 2/2 support rows PASS.
- `node scripts/audit-setup/build-doc-receipts.mjs` + `verify-doc-receipts.mjs`: PASS, 39 receipts filled, 0 TODO extractedRequirements.
- `pnpm vitest run tests/scripts/ia-audit-scripts.test.ts tests/audit-setup/build-wireframe-data-inventory.test.ts`: PASS, 2 files / 5 tests.
- `pnpm typecheck`: PASS.
- `git diff --check -- <touched paths>`: PASS.
- New docs explicit note check: 10/10 `description.md` and `functional-spec.md` files contain `기존 34개`.
- `node scripts/ai-workflow-check.mjs --repo .`: PASS.

## Ledger/File-State Consistency

- New Wireframe folders present: `35-X-13-terms`, `36-X-14-privacy-policy`, `37-X-15-admin-index`, `38-X-16-password-reset-confirm`, `39-X-17-auth-callback-fragment`.
- Each new folder has `description.md` and `functional-spec.md`.
- Each new description and functional spec explicitly states that the screen was added after the existing 34 Wireframe screens.
- Active indexes and IA tooling now use 39 as the current inventory count.
