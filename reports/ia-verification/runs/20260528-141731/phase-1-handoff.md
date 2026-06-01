# Phase 1 Handoff — Cross-Model Review + Browser QA + IA Label Upgrade

- Run id: 20260528-141731
- Created: 2026-06-01
- Predecessor: Phase 0 Remediation (X-05 + X-07 code/UX integration, status `completed_integrated`).
- Predecessor ledger: `docs/ai-workflow/runs/2026/05/29/20260529-1831-ia-remediation-x05-x07.md`
- Predecessor handoff: `reports/ia-verification/runs/20260528-141731/phase-0-remediation-handoff.md`
- Source HEAD at handoff time: `cd2758b43ebe800c17b331dfb7e5a76951285965` (matches `remediation-run-state.json.currentHead`)
- Author: coordinator session 2026-06-01

## TL;DR

Phase 0 closed the X-05/X-07 code + UX slice. Three gates remain unresolved and were
explicitly recorded as `degraded` or `BLOCKED` in Phase 0's verification state:

1. **Cross-model review** — same-family fallback used; no independent-family reviewer available in the predecessor host.
2. **Browser QA — populated weakness state** — `/practice/weakness` rendered only the empty state because the seeded student account has no writing/feedback/recommendation rows.
3. **IA label upgrade (X-05 + X-07)** — `finalLabel: "BLOCKED"` retained despite `status: completed_integrated`, because the audit gate requires evidence categories Phase 0 could not produce.

This handoff sequences the next session's work to close all three.

## Preconditions The Next Session MUST Check Before Acting

Run these first. If any drift, stop and reconcile before touching files.

```
git rev-parse HEAD                                # must match cd2758b…85965 (predecessor head)
git status --short                                # must show 8 modified files + the 9 untracked artifacts listed below
sha256sum src/components/profile/ProfileForm.tsx \
  "src/app/(workspace)/profile/page.tsx" \
  tests/components/profile/ProfileForm.test.tsx \
  src/components/practice/WeaknessView.tsx \
  "src/app/(workspace)/practice/weakness/page.tsx" \
  tests/components/practice/WeaknessView.test.tsx \
  tests/e2e/coverage/coverage-matrix.spec.ts \
  tests/theme/theme-context.test.tsx
# must equal remediation-run-state.json.postIntegration.coordinatorPostimageHashes
```

Expected hashes (postimage of Phase 0):

| File | SHA-256 |
| --- | --- |
| `src/components/profile/ProfileForm.tsx` | `2207698c9381ed41249d9f86f7457985de6785d8a11173e18fe4193c69191c9e` |
| `src/app/(workspace)/profile/page.tsx` | `866cf1cea6a52d18a926f9a0dd0fac0772519b7a4c9c8a29a8b0f0f7d3eefa80` |
| `tests/components/profile/ProfileForm.test.tsx` | `3fdca6bc84e8c76e1997a72bc33276315152273004b209ed6e1b8192075cfb29` |
| `src/components/practice/WeaknessView.tsx` | `cab12753f22e2d059f79aadaca67205ee532e107178e0ee7ad3b4a88b16b8098` |
| `src/app/(workspace)/practice/weakness/page.tsx` | `990fb7ed770dedef4ea0d0554a89d9bbd7ff24bc2b67b1576d5d38e05618d572` |
| `tests/components/practice/WeaknessView.test.tsx` | `981c1bf023c86f5e5537ee5437542bba23706d1986028c0f6a5bb073e5365dfb` |
| `tests/e2e/coverage/coverage-matrix.spec.ts` | `2ad59d7125f3227c599a76566b5db3117b6c4839260a3506ebed97075a22ba26` |
| `tests/theme/theme-context.test.tsx` | `a76974d2560cabf45271df3a4bee5298656eb580fc1af6bbc573dbaa881ca0f1` |

Untracked artifacts (must remain untracked and untouched unless the work explicitly modifies them):

```
docs/ai-workflow/runs/2026/05/29/20260529-1831-ia-remediation-x05-x07.md
reports/ia-verification/runs/20260528-141731/agent-packets/results/ia-x05-profile-remediation-result.md
reports/ia-verification/runs/20260528-141731/agent-packets/results/ia-x07-weakness-remediation-result.md
reports/ia-verification/runs/20260528-141731/agent-packets/tasks/
reports/ia-verification/runs/20260528-141731/phase-0-remediation-handoff.md
reports/ia-verification/runs/20260528-141731/reconciliation-items.json
reports/ia-verification/runs/20260528-141731/remediation-browser-qa.json
reports/ia-verification/runs/20260528-141731/remediation-run-state.json
reports/ia-verification/runs/20260528-141731/write-lock-registry.json
test-results/
tests/e2e/coverage/failure-log.json
```

Coordinator decision still pending: whether to commit Phase 0 changes before starting Phase 1.
This handoff does NOT take that decision. Confirm with the user as the first interaction of the
new session.

## Docs To Read First (in this order)

1. `CLAUDE.md` and `AGENTS.md` (workflow contract, communication style).
2. `docs/ai-development-workflow.md` (lightweight vs full path, fallback protocol).
3. `docs/ai-workflow/context-and-packets.md` + `docs/ai-workflow/agent-packets.md`.
4. `docs/ai-workflow/review-gates.md` (UX/UI Consistency Pass + QA Gate definitions).
5. `docs/ai-workflow/fallback-and-recovery.md` (cross-model fallback rules).
6. **Predecessor artifacts** (read in full):
   - `docs/ai-workflow/runs/2026/05/29/20260529-1831-ia-remediation-x05-x07.md`
   - `reports/ia-verification/runs/20260528-141731/remediation-run-state.json`
   - `reports/ia-verification/runs/20260528-141731/phase-0-remediation-handoff.md`
   - `reports/ia-verification/runs/20260528-141731/agent-packets/results/ia-x05-profile-remediation-result.md`
   - `reports/ia-verification/runs/20260528-141731/agent-packets/results/ia-x07-weakness-remediation-result.md`
7. `docs/ai-workflow/plans/20260523-0100-implementation-coverage-audit.md` — for IA audit gate definitions and §7.1.2 (user-dependent seed plan).
8. `docs/ai-workflow/ia-remediation-multi-agent-execution-plan.md` — coordinator rules; do not pass this to workers.

## Coordinator Constraints (Inherited; Do Not Relax)

From `remediation-run-state.json.completionPolicy`:

- `canUpgradeWithoutSecurityFixture: false`
- `canUpgradeHostedConflictsWithoutReconciliation: false`
- `canClaimFlowEdgePass: false`
- `finalReportMustUseTemplate: true`

Memory-bound additional rules the previous session operated under:

- Reports of own work must be cross-audited by independent reviewers; same-family review is degraded fallback only.
- Do not assume an env key is rotated based on a single comment line; grep all lines for the key and verify operationally before claiming "rotated out".
- For docs-only or evidence-only work, the lightweight path applies; do not chain full multi-agent gates unnecessarily.

## Workstream 1 — Cross-Model Review

### Goal
Independent-family review of the Phase 0 X-05 + X-07 diff. Confirms code/UX correctness, surfaces issues a same-family reviewer would normalize away.

### Current state
- Predecessor recorded: *"Cross-model review: degraded; current host exposes Codex-native subagents but no independent model lane. Use same-family reviewer if needed and record the gap."* (`20260529-1831-ia-remediation-x05-x07.md` §Verification State)
- Same-family review applied by `reviewerAgent: 019e7321-8563-70f3-8816-9a6193c3d9cc`; 3 fixes integrated (`remediation-run-state.json.postIntegration.reviewChanges`).

### Inputs
- Diff under review: 8 modified files listed above. Optional further constraint: limit reviewer scope to the 6 X-05/X-07 source/test files; the other 2 (`coverage-matrix.spec.ts`, `theme-context.test.tsx`) are out-of-scope typecheck fixes recorded separately.
- Predecessor ledger §Worker Results and §Verification State.
- Worker result packets (X-05, X-07).
- Coordinator's review-fix addendum recorded at the bottom of each result packet.

### Required steps
1. Pick at least one independent-family reviewer:
   - Option A: `codex` skill (gstack) — if current host is Claude, codex is cross-family.
   - Option B: Gemini / GPT route if available.
   - Option C: Web-fetch Anthropic API in a different model role (e.g., Sonnet reviewing Opus work).
   - If none available, record `degraded — second_consecutive_phase` and escalate to the user; do not silently re-use the Phase 0 same-family fallback.
2. Hand the reviewer a bounded packet:
   - Goal: correctness + UX honesty review of the Phase 0 diff.
   - Scope: 6 X-05/X-07 source/test files (paths above).
   - Required outputs: pass/fail verdict, blocking issues, non-blocking suggestions, explicit honesty audit (claims vs evidence).
   - Out of scope: rewriting copy, expanding feature scope, touching billing/auth/server boundaries.
3. Integrate reviewer findings:
   - Blocking issues → fix in the working tree (TDD where behavior changes).
   - Non-blocking suggestions → record in Phase 1 ledger §Risks And Follow-Up.
4. Update predecessor ledger §Verification State `Cross-model review:` line from `degraded` to `passed - <reviewer>`.

### Done when
- Independent-family reviewer's packet exists at `reports/ia-verification/runs/20260528-141731/agent-packets/results/phase-1-cross-model-review-result.md`.
- Phase 0 ledger updated.
- Any blocking findings either fixed or explicitly accepted by the user with reason recorded.

### Watch for
- Same-family fallback masquerading as cross-model. The reviewer's `reviewerAgent` ID must NOT collide with any subagent already in `remediation-run-state.json.postIntegration.reviewChanges`.
- Bias spillover: if the reviewer was given the predecessor ledger before the diff, mark the review as `biased — context leakage` and redo with a clean prompt.

## Workstream 2 — Browser QA (Populated Weakness State)

### Goal
Capture pixel evidence of `/practice/weakness` in its populated state at 360 / 768 / 1280 breakpoints, with at least one weak-dimension insight panel + one recommendation card with reason + `추천 학습 시작` primary CTA visible.

### Current state
- `/profile` already rendered correctly with all new fields visible (see `remediation-browser-qa.json[0].bodyText`).
- `/practice/weakness` rendered only the empty state: *"글쓰기를 5건 이상 제출하면 약점 분석이 활성화됩니다. 문제 풀기"* (see `remediation-browser-qa.json[1].bodyText`).
- Predecessor accepted this as `QA Gate degraded — residual risk: visual layout of populated weakness recommendations needs seeded browser evidence before IA browser gate can be upgraded`.

### Root cause
`student@audit.local` has zero `writing_submissions`, `feedback_dimension_scores`, `recommendation_runs`, and `recommendation_items` rows. The empty state is hit because:
1. `getWeaknessRecommendations` step 1 (`recommendation_items` join) → 0 rows.
2. Fallback `getWeakDimensions` requires ≥5 scored entries per dimension (`src/lib/practice/weakness.ts:79`) → 0 eligible dimensions → `[]`.
3. UI surfaces the diagnostic empty state.

### Upstream block
The user-dependent seed (writing/feedback/recommendation rows for the seeded accounts) is supposed to be created by `scripts/audit-setup/seed-dev-users.mjs` per the comment in `supabase/seed.sql:7-10` and per `docs/ai-workflow/plans/20260523-0100-implementation-coverage-audit.md §7.1.2`. **That script does not exist in the repo.**

Verified absence:
```
ls scripts/audit-setup/ | grep seed-dev-users   # no match
glob "**/seed-dev-users*"                       # no match
```

Additional env block to verify before action:
- `.env.local:10` has an uncommented `SUPABASE_SERVICE_ROLE_KEY=...` line.
- `.env.local:14-15` has a `2026-05-27 ... 회전 필수` comment and a commented-out duplicate.
- `scripts/audit-setup/build-storage-state.mjs:31` declares the key is "currently rotated out".

These signals contradict. Per the env-rotation memory rule, the next session must operationally verify whether the key on line 10 actually works (e.g., a single `supabase.auth.admin.listUsers` smoke call) before deciding whether to seed against the current Supabase project, request key rotation, or point at a different project.

### Required steps

Sequenced. Earlier steps unlock later steps.

1. **Verify env truth.** Operationally test the line-10 key. If it works, record "active key present, comment is historical". If it fails, escalate to the user to rotate.
2. **Implement `scripts/audit-setup/seed-dev-users.mjs`** per plan §7.1.2:
   - For `student@audit.local`, insert ≥5 `writing_submissions` linked to the 4 published writing problems (51/52/53/54) from `supabase/seed.sql`.
   - For each submission, insert `feedback` + `feedback_dimension_scores` rows covering at least 2 of the 6 weakness dimensions with ≥5 scored entries each (so `getWeakDimensions` threshold gate passes).
   - Insert a `recommendation_runs` row (not expired) + at least 2 `recommendation_items` (`status='active'`, `rank` 1-3) pointing to published problems, with non-null `reason` strings (so `getWeaknessRecommendations` step 1 returns rows).
   - Tag every inserted row with `'audit_seed'` so Task 7 cleanup can scope deletion.
   - The script must be idempotent on re-run (use `on conflict do nothing` or check-then-insert).
   - This is a sizeable implementation; consider whether it deserves its own ledger entry under `docs/ai-workflow/runs/2026/06/01/...` and an agent packet.
3. **Re-run storage state build** (`node scripts/audit-setup/build-storage-state.mjs --apply`) only if env verification succeeded and a fresh storage state is needed.
4. **Capture populated browser evidence**:
   - Boot dev server: `pnpm dev` (terminal 1).
   - Re-run the populated-state probe (terminal 2). Reuse the predecessor's capture pattern; outputs go to `reports/ia-verification/runs/20260528-141731/screenshots/phase-1-qa/weakness-{360,768,1280}.png` and `reports/ia-verification/runs/20260528-141731/phase-1-browser-qa.json`.
   - Required assertions inside the captured bodyText: at least one substring matching `약점 인사이트`, at least one substring matching `추천 학습 시작`, and at least one recommendation card title (any of the 4 writing problem titles from seed.sql).
5. **Update QA Gate** in the predecessor ledger §Verification State from `degraded` to `passed` once evidence is in place. Keep the degraded line as history; append the `passed` line with date.

### Done when
- `seed-dev-users.mjs` exists, runs idempotently, and seeded data is in the target Supabase project.
- `phase-1-browser-qa.json` shows `/practice/weakness` with populated UI elements asserted above.
- 3 screenshots exist at 360 / 768 / 1280.
- Predecessor ledger QA Gate line upgraded.

### Watch for
- The seed must remain `audit_seed`-tagged; do not pollute the project with non-tagged test rows.
- `feedback_dimension_scores` is RLS-owner-scoped. Use the service-role client only inside the seed script and only against a dev/staging project; the production safety guard in `build-storage-state.mjs:84-153` is the existing precedent — mirror that pattern.
- Do not introduce a `--force-prod` bypass without explicit user authorization.
- If `pnpm dev` cannot bind to 127.0.0.1:3000, do not silently switch to a different port — fix the conflict (per project history, multiple stale dev servers have caused false-PASS / false-FAIL signals).

## Workstream 3 — IA Label Upgrade (X-05 + X-07)

### Goal
Move X-05 and X-07 from `finalLabel: "BLOCKED"` to `PARTIAL` (or `PASS` if all evidence categories close) in the IA audit queue.

### Current state
- Both items: `status: completed_integrated`, `finalLabel: "BLOCKED"` (see `remediation-run-state.json.queue[]`).
- Outstanding gaps recorded per item:

X-05 (`/profile`):
- `missing manual-review row`
- `security-navigation-results.json 0 rows — wrong-owner scenario could not be exercised. However, route has no :id param so direct-URL PII leak is structurally prevented — recommend security lane records this as a structural-protection note rather than running test`
- (Description-vs-impl gaps from the source audit are now addressed by Phase 0 code; they remain in the queue's `topGaps` array because the queue snapshot is from the audit run, not the post-remediation state.)

X-07 (`/practice/weakness`):
- `missing manual-review row`
- `Primary CTA matching /(시작|선택|연습)/i not visible` (closes once Workstream 2 evidence lands)
- `browser timeout; no rendered evidence` (closes once Workstream 2 evidence lands)
- (Description ④/⑤/PAYWALL-ENTRY/HAX gaps were addressed in Phase 0 code; same audit-snapshot caveat.)

### Required steps
1. Close Workstream 1 (cross-model review) and Workstream 2 (populated browser evidence) first — these are upstream blockers.
2. **Manual-review row**: produce a structured manual review per IA audit checklist for each of X-05 and X-07. Record under `reports/ia-verification/runs/20260528-141731/manual-review/x-05.md` and `.../x-07.md`. Each must include: tone/honesty audit, HAX guideline 11 (AI confidence framing) check, paywall honesty (X-07), description-vs-impl table.
3. **Security navigation for X-05**: record the structural-protection note. The route has no `:id` param, so direct-URL PII leak is impossible by construction. Document this as the closure for the `0 rows` lane. Do NOT mark `SN-*` as PASS; mark as `structurally_protected_no_test_needed` and log the reason.
4. **Security navigation for X-07**: confirm `/practice/weakness` is signed-in-user-scoped and surfaces no other-user data even in populated state. Either re-use the structural-protection pattern or add a real test.
5. **Re-emit queue entries**: with Workstream 1 + 2 + manual-review + security closure in hand, re-run the IA audit classification step (or manually update the queue records under coordinator authority) to re-evaluate `finalLabel`. Per `completionPolicy`, the upgrade can only happen when each required evidence category is present.
6. **Update `remediation-run-state.json`** with the new `finalLabel` values for X-05 and X-07, the new `topGaps` arrays (with closed gaps removed and any new findings added), and a `lastUpdatedAt` timestamp.

### Done when
- X-05 `finalLabel` ∈ {`PARTIAL`, `PASS`} with closure evidence linked.
- X-07 `finalLabel` ∈ {`PARTIAL`, `PASS`} with closure evidence linked.
- Manual-review rows exist for both.
- Security navigation lane closed (test or structural note).
- Predecessor ledger §Verification State updated accordingly.

### Watch for
- `completionPolicy.canUpgradeWithoutSecurityFixture` is `false`. Do not skip the security lane.
- The audit-snapshot caveat: the `topGaps` array does NOT auto-prune when code changes. Manual update required. Cross-check current code against each listed gap before pruning.
- Do not flip `canUpgrade*` policy flags to clear the gate. Flag flips require explicit user authorization and a documented reason.

## Verification Commands To Re-Establish State In The New Session

Run before first edit:

```
git rev-parse HEAD
git status --short
sha256sum <8 files above>
pnpm vitest run tests/components/profile/ProfileForm.test.tsx tests/components/practice/WeaknessView.test.tsx     # expect 18 pass
pnpm vitest run tests/theme/theme-context.test.tsx                                                                # expect 6 pass
pnpm typecheck                                                                                                    # expect pass
node scripts/ai-workflow-check.mjs --repo .                                                                       # expect pass
```

Run before claiming completion of any workstream:

```
pnpm vitest run tests/components/profile/ProfileForm.test.tsx tests/components/practice/WeaknessView.test.tsx
pnpm typecheck
node scripts/ai-workflow-check.mjs --repo .
# plus the workstream-specific evidence command (browser probe / cross-model packet check / queue snapshot)
```

## Out Of Scope For Phase 1

- Other IA items (A-01..X-12 besides X-05/X-07). They remain `BLOCKED` and are not part of this handoff.
- Billing/provider implementation. `/paywall` and `/subscription` stay shells per `docs/development/deferred-scope.md`.
- Auth component test failures and other repo-wide lint/typecheck noise outside the 8 tracked files.
- Flow-edge validator. Still absent; `canClaimFlowEdgePass: false` remains.
- Reconciliation items for C-03 / D-M1 / D-M2 / D-M3 / F-M1 (hosted-surface metadata conflicts). Tracked in `reconciliation-items.json`; separate workstream.

## Risks And Follow-Up

- **Risk**: If `SUPABASE_SERVICE_ROLE_KEY` truly is rotated out, all of Workstream 2 is blocked until key rotation; user must be looped in early.
- **Risk**: Implementing `seed-dev-users.mjs` may surface schema drift between `supabase/migrations/*` and the documented assumptions in `docs/development/database-schema.md`. Verify before insert.
- **Risk**: A cross-family reviewer may produce findings that re-open code work; budget for at least one iteration after Workstream 1.
- **Follow-up**: Decide whether to commit Phase 0 changes before starting Phase 1, after Phase 1, or in multiple smaller commits. Ask user.
- **Follow-up**: After Phase 1 closure, consider whether the same seed infrastructure unlocks other IA items (B-01 dashboard primary CTA, D-* writing screens, E-* feedback, R-* reports, F-01 library) — likely yes; could be a Phase 2.

## Ledger/File-State Consistency At Handoff Time

- Files changed match Phase 0 accepted scope: yes (8 files; hashes verified above).
- Docs consulted match implemented behavior: yes (predecessor ledger §Docs Consulted is current).
- Child result packets integrated: yes (X-05 + X-07 result packets recorded; coordinator addendum applied).
- Verification state current: yes (predecessor ledger §Verification State reflects degraded + accepted gates).
- Remaining risks listed: yes (above).

## First Action For The New Session

Read this document, then `CLAUDE.md`, then the predecessor ledger. After that, ask the user: "Phase 0 변경분을 먼저 커밋하고 시작할까요, 아니면 Phase 1 작업분과 같이 묶어서 커밋할까요?" Do not edit code before that decision is recorded.
