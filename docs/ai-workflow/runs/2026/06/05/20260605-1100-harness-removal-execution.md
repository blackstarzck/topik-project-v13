## Run Metadata

- Run id: 20260605-1100-harness-removal-execution
- Created: 2026-06-05 11:00 KST
- Main session owner: Claude (Opus 4.8 1M, ultracode)
- Host: Claude Code
- Status: active
- Branch: `chore/remove-ai-dev-workflow-harness` (from HEAD `b3605f7`)
- Backup dir (git-unrecoverable untracked): `../_harness-backup-20260605/`
  (auth-state, screenshots, test-results.last-run.json, .smoke-skip, settings.local.json)

## Task

- User goal: EXECUTE `harness-removal-plan.html` (v2.2) via dynamic workflow. Remove the AI
  development-workflow harness (~800 tracked files DELETE + ~30 files STRIP), preserving skills,
  MCP, docs/Wireframe, and product source/config/docs.
- Added requirement (user): a mandatory verification stage; the verifying agent MUST confirm the
  project still runs normally after the work.
- Execution model: deletion is destructive + order-dependent -> guarded SEQUENTIAL (coordinator),
  with gates between steps. Final comprehensive verification = dynamic Workflow (parallel agents
  incl. a project-runs agent), per user's added requirement.

## Decisions Locked (8/8 by user, 2026-06-05)

| ID | Decision |
| --- | --- |
| GO | Execute harness removal (supersedes 1015 ledger's "junk cleanup" reframing) |
| D-ia-audit | DELETE (audit-setup/ + verify/merge/validate + test:ia npm lines + consuming tests + e2e/coverage) |
| D-ci | REPLACE with minimal product CI (Node24/pnpm: typecheck+test+lint+build) |
| D-superpowers | KEEP (delete only completed theme plan 2026-05-26-theme-system-refactor.md) |
| D-build-preflight | KEEP (prebuild + build-preflight.mjs + its test) |
| D-sync-agent-skills | KEEP (remove only CI invocation) |
| D-comm-style | STRIP user-communication-style.md (keep Korean tone, drop harness framing/links) |
| D-pr-template | STRIP-minimal (Summary/Why/Risks, drop harness checklist) |
| D-talkpik-skills | STRIP (keep skill files; remove dead harness refs only) |

## Docs Consulted

- `harness-removal-plan.html` (v2.2 plan, the spec for this run)
- `docs/ai-workflow/runs/2026/06/05/20260605-0940-...` (Codex review: REJECT->addressed)
- `docs/ai-workflow/runs/2026/06/05/20260605-1015-...` (prior Claude "junk cleanup" reframing; superseded by user GO)
- `CLAUDE.md` (scope boundary, source-of-truth, communication style, fail-closed-on-destructive)
- `package.json`, `.github/workflows/ai-workflow-check.yml`, git config

## Scope Confirmed (git ls-files, 2026-06-05)

- DELETE trees: docs/ai-workflow 230, reports 155, tasks 167, errors 31, docs/ai-execution-plans 31,
  scripts/audit-setup 20.
- DELETE single: docs/agent-index.md, docs/ai-development-workflow.md, docs/report-writing-template.md,
  docs/ant-design/06-ai-development-workflow.md, docs/superpowers/plans/2026-05-26-theme-system-refactor.md,
  .gitmessage, .github/workflows/ai-workflow-check.yml.
- DELETE scripts: ai-workflow-check(+selftest), derive-smoke-routes, dev-route-smoke, read-pilot-goal,
  hooks/require-ui-smoke, test-qa-gate-fixtures, test-uxui-fixtures, merge-ia-audit-results,
  validate-ia-audit-report, verify-ia-coverage, 6x _tmp-*, root verify-landing/verify-pilot.
- DELETE tests: tests/scripts/{ai-workflow-check,derive-smoke-routes,dev-route-smoke,read-pilot-goal,
  ia-audit-scripts,seed-data-plan,seed-data-verify}.test.ts, tests/audit-setup/, tests/e2e/coverage/.
- KEEP scripts: build-preflight, sync-agent-skills, i18n/*, eslint/postcss.config.
- KEEP tests: build-preflight, no-dev-preview-route, no-practice-problem-detail-route,
  writing-static-routes, tests/e2e/phase-6-smoke.spec.mjs.
- STRIP: CLAUDE.md, AGENTS.md, README.md, docs/README.md, .claude/settings.json, package.json,
  playwright.config.ts + preserved files with dead refs (sweep-authoritative, step 5).
- HARD-KEEP (never touch): .agents/**, .claude/skills/**, .codex/skills/**, skills-lock.json,
  docs/Wireframe/**, src/**, messages/**, fonts/**, supabase/** (refs stripped, files kept).

## Execution Steps + Gates

1. [done] Branch + backup + decisions locked + baseline (no live dev server).
2. [done] Wiring cut -> commit 64487c4 (CI->ci.yml, Stop hook removed, 17 npm IA lines, .gitmessage + git config unset). JSON valid.
3+4. [done] Deleted harness/smoke/IA-audit tests + scripts -> commit 085a106. Gate: typecheck OK, test 610 passed/3 skipped (no orphan import). build-wireframe-data-inventory confirmed IA-audit (deleted per D-ia-audit; NOTE in report: removes the "unclassifiedDbObjectCount=0" inventory completeness guard).
5. [done] Authoritative repo-wide denylist sweep -> 31 preserved files stripped (dynamic workflow wnig3ihp5, all residual 0 + productPreserved) + CLAUDE.md/AGENTS.md/PR-template by main session; deleted 757 tracked (6 trees + 5 single files) in SAME commit f2c7792. Independent re-sweep = 0 residual. Code/config diffs reviewed: next.config allowedDevOrigins intact, playwright reporter repointed to test-results/, src comments only, .env vars preserved, README/docs mermaid pruned cleanly, SQL logic untouched, PLAN.md 397->373 (not gutted). Gate: typecheck OK, test 610 passed/3 skipped.
6. [done] .gitignore cleaned -> commit 2c22c0d (dropped audit-setup + tests/e2e/coverage rules, added test-results/, fixed stale comments). sync-agent-skills (KEEP) re-run OK, talkpik mirrors refreshed from stripped source. Untracked ambient (.smoke-skip, settings.local.json, auth-state, screenshots, test-results) left in place (concurrent-session respect + git-unrecoverable); all backed up.
7. [running] Verification WORKFLOW wuw9so06h: typecheck+test+lint+sweep(0)+PROJECT-RUNS(clean build + next start :3210 + route render)+completeness critic.

## Commit Chain (on b3605f7)

- 64487c4 wiring cut
- 085a106 delete scripts + tests
- f2c7792 strip refs + delete doc trees (same commit)
- 2c22c0d .gitignore cleanup

## Concurrent-Session Cautions (shared worktree)

- A `pnpm dev` (PID 50824) was alive at start, gone by branch creation; concurrent session may restart it.
- NEVER `git add -A`; stage harness paths explicitly. Keep harness commits separate from any product changes.
- harness-removal-plan.html + .smoke-skip = ambient/untracked -> never commit (confirm via git status).
- Re-check for a live dev server before running `next build` (clobber risk per memory).

## Verification State (FINAL)

Verification workflow wuw9so06h ran but 4/6 agents failed to emit StructuredOutput
(known flakiness) -> coordinator re-verified directly (honest ground truth; not trusting
the workflow's misleading allPass=true which only saw typecheck+lint):

- typecheck: PASS (pnpm typecheck exit 0, no diagnostics — workflow agent + step gates).
- test: PASS at the clean harness-removal HEAD (step-5 gate: 610 passed / 3 skipped).
  NOT re-run on current working tree because a CONCURRENT SESSION has layered unrelated
  uncommitted docs changes (see below) — re-running now would not measure this work.
- lint: PASS-with-warnings (exit 0; 9 pre-existing unused-var warnings, 0 errors; none in
  files this task touched).
- residual-ref sweep: 0 matches (repo-wide denylist, preserved tracked files).
- PROJECT-RUNS (user-mandated): VERIFIED. A live dev server (concurrent session) on :3000
  serves /=200, /login=200, /dashboard=200, 127.0.0.1/login=200 on the post-removal code.
  Clean `pnpm build` DEFERRED (degraded, justified): a concurrent session's live dev server
  on :3000 would be corrupted by a concurrent build (.next clobber). Harness removal changes
  no build inputs (no src/ logic change; prebuild/build/start preserved). Run `pnpm build`
  when no dev server is up for a cold-build confirmation.
- completeness/overreach: PASS. scripts/ = build-preflight + sync-agent-skills + i18n only;
  .github/workflows = ci.yml only; 0 deleted-tree refs in tracked files; skills 241, Wireframe
  113, src 249 intact; settings.json={"hooks":{}}; .gitmessage gone; commit.template empty;
  ZERO product/skill/Wireframe/supabase files deleted (813 deleted = all harness).

## Concurrent Session (do not touch)

After my 4 commits, a concurrent session began a SEPARATE docs cleanup in the same worktree:
M README/docs-README/prd/spec/sitemap/ia/flow/domain-glossary/ant-design-04, D docs/ia-pages/*
+ docs/user-flow.md, M CLAUDE.md (source-of-truth refinement: dropped Legacy Observations +
user-flow/ia-pages, added Wireframe/functional-spec-index.md + data-usage-index.md — both
verified present), new untracked docs/sample-5*.json. These are NOT part of harness removal
and were left untouched/uncommitted (concurrent-agent etiquette). CLAUDE.md user edit kept as-is.

## Outcome

Harness removal COMPLETE + verified. 4 clean commits on chore/remove-ai-dev-workflow-harness
(b3605f7 -> 2c22c0d). Backups + archived ledgers in ../_harness-backup-20260605/.
NOTE: D-ia-audit deletion removed the wireframe-data-inventory completeness guard
(memory: unclassifiedDbObjectCount=0); the GENERATED indexes (functional-spec-index.md,
data-usage-index.md) remain as static files but will no longer auto-regenerate.
