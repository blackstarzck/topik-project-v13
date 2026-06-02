# Context Ledger — IA autonomous-progress wave (cleanup + admin migration + i18n)

## Run Metadata

- Run id: 20260602-1300-ia-autonomous-cleanup-migration-i18n
- Created: 2026-06-02
- Updated: 2026-06-02
- Main session owner: Claude Code (Opus 4.8 1M) — coordinator + durable context owner
- Host: Claude Code
- Parent run: `docs/ai-workflow/runs/2026/06/01/20260601-1701-ia-remediation-full-ceremony.md`
- Resume source: `reports/ia-verification/runs/20260601-120308/handoffs/20260602-RESUME-fresh-session.md`
- Status: in_progress

## Task

- User goal: continue the IA full-feature build. User chose the **autonomous-progress lane**
  ("자동 진행분 몰아치기"): do everything that does NOT need the user (migration apply / server
  boot / external API keys) end-to-end.
- Accepted scope (this run):
  - **Phase A — Cleanup**: delete 3 confirmed-orphan files (zero importers), apply 2 proposed
    doc edits (C-02 functional-spec + data-usage-index for `list_user_problems` RPC), harden
    the flaky `writing-flow notFound questionId=99` test (cross-file unhandled-rejection leak).
  - **Phase B — Admin migration design + wiring**: design SQL (USER applies later) for
    (a) `get_admin_org_dashboard` 4th KPI = assignment submission-rate, (b) create-organization
    bootstrap RPC; wire admin components (X-08 assignment-rate, X-10 org-affiliation column +
    bulk reactivate/role-change) to the seam, typecheck green.
  - **Phase C — i18n incremental string migration**: cluster-by-cluster per the G-01 i18n plan,
    ko verbatim + en + vi, guarded by `catalog-parity.test.ts`. Parallel-safe approach required
    (single-file-per-locale catalog → write-conflict risk).
- Out of scope (needs user / blocked): applying migrations (no DDL creds in coordinator env),
  prod build + Playwright evidence phase (server), external integrations (OAuth/payment/email/
  Zalo/AI/share/file-upload — need provider keys), X-07 per-card paywall tier (product decision).

## Docs Consulted

- Exact files read:
  - `CLAUDE.md`, `AGENTS.md`, `docs/ai-development-workflow.md` (workflow + Korean tone).
  - Parent run ledger `20260601-1701-ia-remediation-full-ceremony.md`.
  - Resume handoff `20260602-RESUME-fresh-session.md`.
  - i18n plan `docs/ai-workflow/runs/2026/06/02/20260602-i18n-infrastructure-g01.md`.
  - `reports/ia-verification/runs/20260601-120308/reconciliation-items.json`.
  - `docs/Wireframe/06-C-02-problem-list/functional-spec.md`, `docs/Wireframe/data-usage-index.md`.
  - Source: `src/app/(workspace)/dashboard/page.tsx`, `src/components/practice/problem-list-data.ts`,
    `tests/integration/{writing-flow,learning-flow}.test.ts`.
- Extracted requirements:
  - Orphan deletion is allowed only after confirming ZERO importers (verified: no src/tests import).
  - `list_user_problems` RPC backs C-02 problem list (SECURITY INVOKER, caller RLS, SQL-side
    status filter + window total_count). Must be reverse-indexed in data-usage-index.md (RPC count
    18 → 19) and added to C-02 DB-usage table.
  - i18n: each migrated string → ko verbatim (keep unit tests green) + en + vi; run parity test
    per batch; `metadata.title` needs `generateMetadata()`.
- Doc conflicts: none new. (Open reconciliation items rec-002/003/004/006 belong to the parent run.)
- Untouched relevant docs and reason:
  - `docs/prd.md`, `docs/spec.md` — product intent unchanged this run.
  - `docs/flow/user-flow.md` — no flow-edge changes this run.

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 2026-06-02T13:00Z | Lane = autonomous-progress pile-on | User AskUserQuestion answer "자동 진행분 몰아치기 (추천)" | user |
| 2026-06-02T13:05Z | Code state re-verified GREEN before work (typecheck 0 / lint 0 err / 502 pass) | Don't trust self-reports on resume | this run |
| 2026-06-02T13:15Z | Phase A: 3 orphans deleted | Whole-repo grep confirmed ZERO importers in src/tests (refs only in historical report/doc/codex artifacts); no barrel re-export; dashboard page uses DashboardBody/Header not DashboardContent; FeedbackRecommendationCards (plural) is the live one | grep + dashboard page.tsx |
| 2026-06-02T13:20Z | Phase A: 2 doc edits applied (list_user_problems) | data-usage-index RPC count 18→19 + page-data-links 125→126 + new `public.list_user_problems` section; C-02 functional-spec DB-table row + 구현상태 note + 2 Evidence lines | `problem-list-data.ts`, migration 20260602120400 |
| 2026-06-02T13:30Z | Flaky test ROOT CAUSE = load-induced timeout, NOT unhandled rejection (handoff misdiagnosed) | Reproduced on pass 3/4: 3 unrelated files (writing-flow/learning-flow/admin-role-matrix) ALL timed out at ~5007ms simultaneously. `learning-flow > redirects when no goal` has only immediately-resolved mocks yet timed out at 5s → only possible via worker event-loop starvation under parallel load, not a logic bug. Matches memory lesson `project-ia-audit-dev-server-degradation`. | repro loop bx9q64ne5 |
| 2026-06-02T13:35Z | Fix = vitest `testTimeout: 20000` (was 5s default) | Heavy integration tests import full server-component module graphs + render under parallel load; 5s too tight. 20s removes false positive WITHOUT masking a real deadlock (which would still hang to ceiling). Verified: 6/6 clean passes post-fix (vs 1/4 fail pre-fix), +earlier 4-pass repro = 10 post-fix passes, 0 recurrence. | repro loop behf8x8i7 |

## Active Files

- Files expected to change:
  - DELETE: `src/components/learning/DashboardContent.tsx`,
    `src/components/feedback/FeedbackRecommendationCard.tsx` (singular),
    `src/components/reports/MetricsTable.tsx`.
  - EDIT (docs): `docs/Wireframe/06-C-02-problem-list/functional-spec.md`,
    `docs/Wireframe/data-usage-index.md`.
  - EDIT (test): `tests/integration/learning-flow.test.ts` (well-formed thenable mock).
  - Phase B/C files appended as work proceeds.
- Files explicitly not to touch: production env/secrets, `.env.local` values, `supabase/migrations`
  application (design only — USER applies).

## Verification State

- Required checks: `pnpm -s typecheck`, `pnpm -s lint`, `pnpm -s test`; flaky-test repro loop.
- Baseline (pre-work, 2026-06-02): typecheck 0, lint 0 errors (19 pre-existing warnings),
  test 71 files / 502 passed / 3 skipped.
- Phase A result (2026-06-02): typecheck 0, lint 0 errors (19 pre-existing warnings),
  test 71 files / 502 passed / 3 skipped. Flaky-test fix verified by 6/6 clean repro passes.
  Deletions orphaned nothing (typecheck clean).
- Cross-model review: pending (Claude reviewer for Korean-copy-touching i18n per
  `codex-review-mojibake-windows`; codex acceptable for ASCII SQL/test-infra).

## Risks And Follow-Up

- i18n full migration is large + translation-quality (esp. vi) is generated, not human-reviewed →
  scope a meaningful, parity-guarded subset; flag remaining clusters honestly.
- Flaky test is nondeterministic → must reproduce before claiming fix; verify with repeated runs.
- Admin migration SQL cannot be applied here → hand off explicit apply steps to USER.
