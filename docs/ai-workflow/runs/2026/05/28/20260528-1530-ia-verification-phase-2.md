# IA Verification Phase 2 Run (Browser Coverage — Partial)

## Run Metadata

- Run id: 20260528-141731 (continued from Phase 0.5 run)
- Created: 2026-05-28 15:30:00 +09:00
- Updated: 2026-05-28 15:30:00 +09:00
- Main session owner: Claude Code (Opus 4.7)
- Host: Claude Code
- Status: complete (Phase 2 partial — public PASS row-level, protected BLOCKED on storageState precondition)
- Parent ledger: `docs/ai-workflow/runs/2026/05/28/20260528-1417-ia-verification-phase-0.5.md`

## Task

- User goal: Continue IA verification execution per `docs/ai-workflow/ia-implementation-verification-execution-plan.md` Phase 2 (browser coverage).
- Accepted scope (this slice):
  - Build `tests/e2e/coverage/ia-catalog.ts` (Plan §8 Step 2.1).
  - Rewrite `tests/e2e/coverage/coverage-matrix.spec.ts` to use the catalog (Plan §8 Step 2.2).
  - Add `scripts/audit-setup/build-storage-state.mjs` with explicit precondition guard (Plan §8 Step 2.3).
  - Add `scripts/audit-setup/build-browser-results.mjs` to convert Playwright JSON output → browser-results.json (Plan §8 Step 2.4 emission).
  - Run Playwright against existing dev server for the public-route subset; record protected-route rows as BLOCKED with collector-attempt evidence.
  - Update `audit-flow-monitor.json` + re-merge IA audit.
- Out of scope this slice:
  - Generating real `tests/e2e/auth-state/*.json` storage states (requires `SUPABASE_SERVICE_ROLE_KEY` which is rotated out — `.env.local` 2026-05-27 note).
  - Phase 3 hosted-surfaces.spec / Phase 4 session-navigation.spec / Phase 5 AI UX review.
  - `/auth/sign-out` route handler implementation.
- Current next action: Either (a) restore service-role key + re-run with `--apply` to fill auth fixtures, OR (b) author Phase 3 hosted-surfaces.spec.

## Docs Consulted

- Exact files read:
  - `docs/ai-workflow/ia-implementation-verification-execution-plan.md` §4·§8·§13 (re-read)
  - `docs/sitemap.md` Target React Route Map + Overlay/Modal Surfaces
  - `docs/IA/README.md`
  - `playwright.config.ts`
  - `tests/e2e/coverage/coverage-matrix.spec.ts` (prior implementation)
  - `tests/e2e/coverage/golden-path.spec.ts` (for pattern reference)
  - `reports/ia-verification/runs/20260528-141731/ia-manifest.json`
  - `reports/ia-verification/runs/20260528-141731/doc-receipts.json`
  - `reports/ia-verification/runs/20260528-141731/agent-dispatch-plan.json`
  - `.env.local` (read; service-role section commented out per security rotation note)
  - `scripts/audit-setup/ia-audit-lib.mjs`
- Extracted requirements:
  - Plan §8 Step 2.1 catalog must include IA code, screen name, manifest row id, document receipt id, route, route type, audience, packs, fixture id type, expected primary heading + CTA, UX evidence states (default/loading/empty/error/disabled/success), and form/AI/policy/billing/notification/auth/admin evidence flags.
  - Plan §8 Step 2.2 spec must add C-03/D-M1/D-M2/D-M3/F-M1/X-11/X-12 (missing in prior matrix), capture errors + heading + CTA evidence per IA, screenshot per viewport (360/768/1280), and exercise auth fixtures.
  - Plan §8 Step 2.3 storage-state script must produce `student.json`, `content_admin.json`, `org_admin.json`, `platform_admin.json`. Without auth fixtures, protected-route browser evidence stays BLOCKED but public evidence still runs (Plan §4 collector-first rule).
  - Plan §8 Step 2.4 `browser-results.json` must record one row per IA/viewport/state combination with screenshot filenames, state types, AI-ready evidence flags, and per-row status + blockingReasons.
- Doc conflicts:
  - `playwright.config.ts` comment refers to plan `20260523-0100-implementation-coverage-audit.md §10 Task 4` (legacy plan). The active plan is the rev described in `docs/ai-workflow/ia-implementation-verification-execution-plan.md`. The new spec implementation here aligns with the active plan; legacy plan reference is left in the config header (out of scope to retitle this run).
  - `.env.local` says "REMOTE SUPABASE 모드" but `playwright.config.ts` header says storage states "are gitignored and rebuilt by scripts/audit-setup/build-storage-state.mjs for the audit" — that script didn't exist before this slice. Created in this run.
- Untouched relevant docs and reason:
  - `docs/development/database-schema.md`: Not needed yet — schema changes are out of scope.
  - `docs/development/deployment.md`: Not needed — no deployment work.
  - `docs/ai-workflow/agent-packets.md`: read for context in Phase 0.5; single-session-degraded mode means no child packets dispatched this slice either.

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 2026-05-28 14:55 +09:00 | Use existing dev server at :3000 (PID 39752 already running) instead of spawning new one. | `pnpm dev` failed with "Another next dev server is already running" — the existing instance was healthy (HTTP 200). | Background task `bt7tcour7` log |
| 2026-05-28 15:00 +09:00 | Build `build-storage-state.mjs` as skeleton with explicit `--apply` gate. | `.env.local` notes `SUPABASE_SERVICE_ROLE_KEY` was rotated out 2026-05-27 ("회전 필수"). Without it admin user seeding is impossible — fail-closed precondition guard is the honest design. | `.env.local` line 13 |
| 2026-05-28 15:10 +09:00 | Coverage matrix spec records `storageStateMissing` annotation per protected route rather than skipping the test entirely. | Plan §4 collector-first rule: missing evidence becomes BLOCKED only after collector attempt is recorded. Spec must attempt navigation for every catalog entry and annotate when fixture absent — not skip the test surface. | Plan §4 + §8 Step 2.2 |
| 2026-05-28 15:20 +09:00 | Classify dev-mode HMR WebSocket console errors as environmental noise in `knownNoise` field of monitor checkpoint. | Two concurrent dev servers / Playwright clients overlap HMR sessions in this audit setup. Production builds do not emit HMR; flag for Phase 5 reviewer rather than treating as product defect. | `browser-results.json` X-01 errors[0] |
| 2026-05-28 15:25 +09:00 | Accept public IA `PARTIAL` (not PASS) due to heuristic CTA-match failures + HMR noise. | Honest reflection of what Playwright observed. Phase 5 AI UX review will reconcile heuristic mismatches vs actual rendered UX. | `browser-results.json` summary |

## Active Files

- Files expected to change:
  - `docs/ai-workflow/runs/2026/05/28/20260528-1530-ia-verification-phase-2.md` (this ledger)
  - `tests/e2e/coverage/ia-catalog.ts` (new)
  - `tests/e2e/coverage/coverage-matrix.spec.ts` (rewrite)
  - `scripts/audit-setup/build-storage-state.mjs` (new)
  - `scripts/audit-setup/build-browser-results.mjs` (new)
  - `package.json` (add `test:ia:storage-state` + `test:ia:browser-results`)
  - `reports/ia-verification/runs/20260528-141731/` updated:
    - `audit-flow-monitor.json` (Phase 2 checkpoint updated)
    - `browser-results.json` (new — 102 rows)
    - `ia-implementation-audit.json` + `.md` (re-merged)
    - `ia-implementation-audit-validation.json` (re-validated)
    - `phase-2-results.md` (new sibling report)
  - `tests/e2e/coverage/failure-log.json` (Playwright reporter output)
  - `tests/e2e/auth-state/build-status.json` (storage-state precondition status)
  - `screenshots/coverage-*.png` (18 new for public IA × 3 viewports)
- Files inspected: (see Docs Consulted)
- Files changed: (matches "Files expected to change" exactly)
- Files explicitly not to touch:
  - `src/**` product code (no UI defect fixes in this slice)
  - `reports/ia-verification/latest`
  - `.env.local` (read-only)

## Agent Assignments

| Agent | Role | Scope | Status | Packet location or summary |
| --- | --- | --- | --- | --- |
| main session (Claude Code) | Coordinator + Automation owner + single-session monitor | Phase 2 catalog/spec/script/Playwright run | complete | Single-session-degraded; no child packets dispatched. |

## Child Result Packets

None — single-session-degraded.

## Verification State

- Required checks:
  - `pnpm test:ia:storage-state` (no `--apply`) — expect BLOCKED with precondition status.
  - `pnpm exec playwright test tests/e2e/coverage/coverage-matrix.spec.ts` — expect row-level PASS for all 102 (assertion-skipped for protected).
  - `pnpm test:ia:browser-results` — emit `browser-results.json` with PARTIAL + BLOCKED rows.
  - `pnpm test:ia:merge` + `pnpm test:ia:validate` — final audit re-merged.
  - `node scripts/ai-workflow-check.mjs --repo .` before final report.
- Checks run:
  - `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/` → `200`
  - `node scripts/audit-setup/build-storage-state.mjs` → exit 1, BLOCKED, missing `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_TEST_PASSWORD`
  - `pnpm exec playwright test tests/e2e/coverage/coverage-matrix.spec.ts --project desktop-1280 --grep "public"` → 6/6 PASS
  - `pnpm exec playwright test tests/e2e/coverage/coverage-matrix.spec.ts` → 102/102 PASS (stats: 0 unexpected, 0 skipped, ~89s)
  - `IA_AUDIT_DIR=... pnpm test:ia:browser-results` → 102 rows, 18 PARTIAL + 84 BLOCKED, overall BLOCKED
  - `IA_AUDIT_DIR=... pnpm test:ia:merge` → PASS, ia-implementation-audit regenerated
  - `IA_AUDIT_DIR=... pnpm test:ia:validate` → PASS (BLOCKED labels accepted given monitor collector-attempt evidence)
- Latest results:
  - Catalog covers 34 IA + 5 hosted surfaces (PUBLIC_IA / PAGE_IA / HOSTED_SURFACE_IA helpers exposed).
  - Spec runs 34 IA × 3 viewports = 102 tests; 0 unexpected.
  - 18 public-route screenshots captured at 360/768/1280.
  - 18 public rows PARTIAL (heading PASS but heuristic CTA-pattern not matched + dev-mode HMR console error per page).
  - 84 protected rows BLOCKED with `storageStateMissing: true` + concrete `storageStatePath`.
  - Final IA audit: 34 BLOCKED, 0 PASS, 0 FAIL.
- Known failures:
  - SUPABASE_SERVICE_ROLE_KEY rotated out → can't seed storage states (security precondition; classified BLOCKED).
  - Heuristic CTA-pattern regex didn't match for X-01 (actual landing copy differs from regex set); flagged for Phase 5 AI UX review to verify rendered UX or correct catalog.
  - Dev-mode HMR WebSocket console errors counted in `errors[]` per row (recorded in monitor `knownNoise` field as environmental, not product).
- Skipped checks and reason:
  - `pnpm test` full suite: skipped this slice — Phase 2 changes are in test infrastructure (no src/**) and the Phase 0.5 ledger already ran the full suite.
  - Phase 3-5 collectors: still BLOCKED on remaining preconditions (specs not yet authored + storage states missing + human reviewer absent).
- Cross-model review: degraded — no Codex pass this slice.
- Architecture Pass: skipped — no `src/**` production architecture change.
- Light Spec: n/a (audit infrastructure slice).
- UX/UI Consistency Pass: skipped — no UI files changed.
  - Tokens / Components / A11y / Responsive: skipped.
- QA Gate: skipped — no UI files changed.

## Fallback State

- Normal path blocked: partially — protected-route browser evidence requires service-role rotation.
- Failure class: degraded-mode.
- Fallback used: collector-first attempted, record storageState-missing as BLOCKED with concrete preconditions per row + monitor checkpoint. Public-route evidence collected end-to-end.
- Evidence collected:
  - 18 public-route screenshots × 3 viewports
  - 102 browser-results.json rows
  - Storage-state precondition snapshot (`tests/e2e/auth-state/build-status.json`)
  - Phase 2 monitor checkpoint updated with collector attempts + `knownNoise` classification
- Completion allowed: yes for Phase 2 partial scope; final IA PASS still gated on Phase 3-5.
- Remaining fallback risk: HMR console-error noise classification is monitor-side only; Phase 5 reviewer must apply it.

## Ledger/File-State Consistency

- Files changed match accepted scope: yes
- Docs consulted match implemented behavior: yes
- Child result packets integrated: not applicable (single-session-degraded)
- Verification state current: yes
- Remaining risks listed: yes

## Risks And Follow-Up

- Remaining risks:
  - Heuristic CTA-pattern in catalog may produce false negatives — Phase 5 AI UX review must verify against actual rendered UX before treating as defect.
  - Browser evidence currently uses default state only; loading/empty/error/disabled/success captures require user-interaction sequences in Phase 3 hosted-surfaces spec + Phase 5 review.
  - `playwright.config.ts` references legacy plan path in its header comment — cosmetic drift, not breaking.
- Assumptions:
  - User accepts public-route PARTIAL as honest reflection of Phase 2 row-level evidence; Phase 5 will reconcile heuristic mismatches.
  - Service-role rotation is a separate ops decision (security-sensitive); this run does not request rotation.
- Follow-up needed:
  - Rotate SUPABASE_SERVICE_ROLE_KEY → set SUPABASE_TEST_PASSWORD → run `pnpm test:ia:storage-state --apply` → re-run coverage matrix for protected IA.
  - Author `tests/e2e/coverage/hosted-surfaces.spec.ts` (Phase 3).
  - Author `tests/e2e/coverage/session-navigation.spec.ts` + auth-route-handlers tests (Phase 4).
  - Implement `/auth/sign-out` route handler (still missing per source-map FAIL).
  - Codex cross-model review of catalog + spec before relying on them as Phase 5 input.
