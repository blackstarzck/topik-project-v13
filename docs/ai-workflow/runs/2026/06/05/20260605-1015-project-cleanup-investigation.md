## Run Metadata

- Run id: 20260605-1015-project-cleanup-investigation
- Created: 2026-06-05 10:15 KST
- Updated: 2026-06-05 10:15 KST
- Main session owner: Claude (Opus 4.8 1M)
- Host: Claude Code
- Status: active

## Task

- User goal: 프로젝트에 쌓인 불필요한 파일과 어수선한 프로젝트 구조를 조사하고, 제거/정돈을 위한 실행계획을 **dynamic workflow**로 만든다.
- Explicit user instruction (2nd message): 기존 `harness-removal-plan.html`의 과거 내용은 무시하고 처음부터 다시 조사한다.
- Accepted scope: READ-ONLY investigation + a verified, ordered cleanup execution plan. No deletions executed this run (destructive → fail closed; deliverable is the plan).
- Out of scope: Removing the AI-workflow GOVERNANCE harness (this is NOT a harness-removal task — explicitly reframed). Deleting/editing source-of-truth docs, src/, messages/, fonts/, supabase/, skills, docs/Wireframe. Touching `.smoke-skip` (live sentinel owned by a concurrent session).

## Docs Consulted

- `CLAUDE.md` (scope boundary, source-of-truth list, communication style, ledger/multi-agent rules)
- `MEMORY.md` index (concurrent-agent worktree etiquette, i18n = production assets, dev-server pitfalls)
- `.gitignore` (existing ignore coverage to avoid redundant recommendations)
- `harness-removal-plan.html` (read once, then **explicitly disregarded** per user instruction — treated only as a stray root file candidate)
- `docs/ai-workflow/runs/2026/06/05/20260605-0940-harness-removal-plan-review.md` (Codex session's review ledger — left untouched, concurrent session)

- Extracted requirements:
  - Korean-by-default user-facing report; non-developer-friendly framing.
  - Multi-agent work requires a ledger (this file).
  - i18n `messages/{ko,en,vi}.json` are production assets → HARD KEEP.
  - Do NOT remove governance harness; target genuine junk only.
  - Concurrent Codex session(s) active → never `git add -A`, never touch others' ambient files (`.smoke-skip`).
- Doc conflicts: none. (Note: prior `harness-removal-plan.html` would conflict with CLAUDE.md's mandate to FOLLOW the workflow; user de-scoped it, so no conflict remains.)

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 2026-06-05 10:15 KST | Reframe task from "harness removal" to "unnecessary-file + structure cleanup". | User said start fresh, ignore old plan; CLAUDE.md mandates following the governance workflow. | User request + CLAUDE.md |
| 2026-06-05 10:15 KST | Use a dynamic Workflow (fan-out classify → adversarial verify → synth → completeness critic → backfill). | User explicitly asked for a dynamic workflow; categories are independent and benefit from parallel classification with refutation. | User request + Workflow tool guidance |
| 2026-06-05 10:15 KST | All workflow agents READ-ONLY; no deletion this run. | Deletion is destructive → fail closed; deliverable is a plan pending user approval. | CLAUDE.md fallback/fail-closed |
| 2026-06-05 10:15 KST | HARD-KEEP list pinned in every agent prompt. | Prevent overreach onto source-of-truth/governance/product assets. | CLAUDE.md source-of-truth + admin scope |

## Active Files

- Files expected to change (this run): this ledger; a new cleanup-plan deliverable doc (TBD path).
- Files inspected: root listing, `.gitignore`, docs/ tree structure, candidate scratch dirs (tasks/, reports/, errors/, test-results/, screenshots/), reference greps for root one-off scripts.
- Files explicitly NOT to touch: `harness-removal-plan.html` (user de-scoped), `.smoke-skip` (concurrent sentinel), `docs/ai-workflow/runs/2026/06/05/20260605-0940-*` (Codex ledger), all HARD-KEEP paths, any uncommitted concurrent-session work.

## Agent Assignments (dynamic workflow `wf_c2f60312-4f0`)

| Phase | Agents | Scope |
| --- | --- | --- |
| Classify | 9 (one per category) | root-stray, tasks/, reports/, errors/, test-artifacts, ui-redesign-scratch, run-ledgers-plans, ignored-present, structure-gitignore |
| Verify | per-finding (adversarial) | Refute that each DELETE/UNTRACK/MOVE is safe; default unsafe if uncertain |
| Synthesize | 1 | Ordered execution plan (buckets, steps+gates, decisions, structural recs, rollback) |
| Critique | 1 | Completeness (missed categories) + overreach + ordering |
| Backfill | conditional | Sweep any categories the critic flags as missed; re-synthesize |

## Child Result Packets

Pending workflow completion (Task ID wgwob2csa).

## Verification State

- Required checks: workflow completes; synthesized plan contains no HARD-KEEP path; critic overreach list reconciled; ordering preconditions honored.
- Checks run so far: repo inventory (`git ls-files` counts), disk sizing (`du`), reference greps (verify-pilot/verify-landing/.smoke-skip/harness-removal-plan).
- Cross-model review: degraded — Codex CLI mojibake on Korean (see memory); using adversarial Claude verify agents within the workflow as the independent-perspective gate.
- QA Gate / UX passes: n/a (no UI/product code change this run).

## Fallback State

- Normal path blocked: none.
- Fallback used: none yet.
- Completion allowed: yes, after integrating workflow result into a Korean execution-plan report. No file deletions until user approves.

## Risks And Follow-Up

- Risk: agents may misclassify a governance/source-of-truth doc as junk → mitigated by HARD-KEEP prompt + overreach critic.
- Risk: untracked/ignored deletions are git-unrecoverable → plan must require backup-first.
- Risk: concurrent session(s) editing the same worktree → plan must forbid `git add -A` and isolate cleanup commits.
- Follow-up: present plan + DECISIONS to user; execute only after approval, on a dedicated branch, with per-step verification gates.
