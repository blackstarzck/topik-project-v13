# IA Remediation Multi-Agent Plan: Completion And Reference

## Completion Gate

An IA item can close only when:

- Required specialists returned result packets or have justified `N/A`.
- The final verifier applied the shared rubric.
- The final verifier is coordinator-owned and separate from the IA execution agent.
- Regenerated JSON evidence supports the final label.
- HTML observations are either backed by source evidence or rejected with rationale.
- Cross-IA impacts are `closed`, `rejected`, or `carried-forward` with owner, risk, due trigger, affected IA, and required evidence.
- Cross-IA impacts are represented in `<auditRunDirectory>/cross-ia-lifecycle-items.json` and match the run state's `crossIaLifecyclePath`.
- Human confirmation is recorded when required.
- The ledger contains docs consulted, commands, results, decisions, and remaining risk.
- Required Supabase fixture evidence is backed by `<auditRunDirectory>/supabase-fixture-manifest.json`, matching fixture keys, RLS case results, and command outputs, or the affected item is `security-fixture`/`blocked_terminal` with owner and next action.
- Browser or visual claims include screenshot artifacts and browser console-log artifacts, or a scoped reason why console capture was not applicable.
- Repo-level gates are recorded when implementation changed user behavior: TDD status, cross-model review, code/doc review, UX/UI Consistency Pass, QA Gate, and workflow checker result.
- Run closeout requires every queue item to be `done`, `blocked_terminal`, or `cancelled`.
- No `claimed`, `in_progress`, `waiting_specialist`, `verifying`, expired lease, or stale session may remain at run closeout.
- The final verifier must compare run state, write-lock registry, task packets, result packets, audit JSON, manual evidence, regenerated artifacts, screenshots, browser console-log artifacts, and current file state.

## Verification Commands

Run after documentation updates:

```bash
node scripts/ai-workflow-check.mjs --repo .
rg -n "specialist-checklists|review-profiles" docs/ai-execution-plans/ia-remediation-multi-agent
rg -n "supabase-fixture-manifest|fixtureManifestPath|security-fixture" docs/ai-execution-plans/ia-remediation-multi-agent
rg -n "TODO|TBD|fill in|later" docs/ai-execution-plans/ia-remediation-multi-agent/specialist-checklists docs/ai-execution-plans/ia-remediation-multi-agent/review-profiles
```

Run after remediation implementation, when the command exists and is required by the changed scope:

```bash
node scripts/ai-workflow-check.mjs --repo .
pnpm test
pnpm test:e2e
pnpm test:ia:flow-edges
```

If a command is unavailable, use the policy below. Do not accept generic manual evidence.

Unavailable command policy:

- Use the command-specific fallback table in the Flow-Edge Gate section.
- A missing command is not automatically degraded.
- If `pnpm test:ia:flow-edges` or `scripts/audit-setup/validate-flow-edges.mjs` is absent, do not invent a replacement command. Use `<auditRunDirectory>/manual-flow-edge-evidence.json` only for the scoped flow-edge gap, or mark the affected item `blocked_terminal`.
- If the missing command is required for final evidence and no defined fallback artifact exists, mark the queue item `blocked_terminal`.
- If a defined fallback exists, the packet must name the artifact path, schema, closure boundary, reviewer, reviewedAt, limitations, and residual risk.

## Docs Consulted

- `docs/agent-index.md`
- `docs/user-communication-style.md`
- `docs/ai-development-workflow.md`
- `docs/ai-workflow/context-and-packets.md`
- `docs/ai-workflow/contracts/agent-packets.md`
- `docs/ai-workflow/review-gates.md`
- `docs/ai-workflow/fallback-and-recovery.md`
- `docs/ai-workflow/ia-page-implementation-verification.md`
- `docs/ai-execution-plans/ia-remediation-multi-agent/review-profiles/ia-review-profile-map.json`
- `docs/Wireframe/README.md`
- `docs/sitemap.md`
- `docs/spec.md`
- `docs/development/backend-auth.md`
- `docs/development/database-schema.md`
- `docs/development/environments.md`
- `docs/development/deferred-scope.md`
