# Context And Packets

Context-ledger rules, agent task/result packet rules, multi-agent integration, and resume/compaction recovery. **Entry point**: [`docs/ai-development-workflow.md`](../ai-development-workflow.md).

This sub-doc owns §3b (Multi-Agent Context Management), §3c (Context Ledger), and §3d (Resume And Compaction Recovery) of the legacy workflow.

## Multi-Agent Context Management

The main session is the coordinator and durable context owner. Child agents are execution surfaces, not the source of truth.

Before spawning or asking another agent to work, the main session must prepare a task packet using [`agent-packets.md`](agent-packets.md):

- User goal and accepted scope
- Docs consulted and extracted requirements
- Exact write scope or read-only scope
- Expected output format
- Verification the child agent should run
- Known constraints, conflicts, and files not to touch

Child agents must return a result packet:

- Files inspected or changed
- Summary of decisions made
- Tests, checks, or commands run
- Blockers, conflicts, and assumptions
- Recommended follow-up, if any

The main session integrates the result packet into the central context ledger before continuing. It does not assume that a child agent's hidden context, branch, or worktree is durable. For parallel implementation, assign disjoint write scopes where possible; if write scopes overlap, the main session resolves the conflict before any final verification.

### Subagent dispatch rule

Subagent dispatch is driven by the plan's task table. Each task row declares `Subagent-eligible? (Y/N + reason)`. The main session sends task packets to a child agent for rows marked `Y` and executes `N` rows directly. Tightly coupled work (e.g. RED test fixture + GREEN implementation sharing export names and error strings) should be marked `N` and assigned to a single owner. For phase-sized work, look for `Y` rows first; sequential execution by the main session is the fallback when no rows are subagent-eligible.

## Context Ledger

For non-trivial work, create a run ledger under `docs/ai-workflow/runs/YYYY/MM/DD/` using [`context-ledger-template.md`](context-ledger-template.md). Name the file `YYYYMMDD-HHMM-task-slug.md`.

### When a ledger is required

| Trigger | Required |
| --- | --- |
| Multi-agent work | Yes |
| Implementation work | Yes |
| UI, route, user-flow, or integration change | Yes |
| Doc conflict or net-new scope | Yes |
| Work likely to span multiple sessions or context compaction | Yes |
| Touches `scripts/`, `.github/`, `.agents/`, `.codex/`, `.claude/`, `docs/ai-workflow/`, or workflow-governing files (`AGENTS.md`, `CLAUDE.md`, `docs/agent-index.md`, this file, sub-docs) | Yes |
| Tiny docs/config edit with no behavior change, no conflict, no multi-agent work, no resume risk | May skip with reason stated in final report |

Treat work as non-trivial when more than one tracked file is intentionally changed, OR when any of these change: route, UI, auth, database, API, dependency, test strategy, deployment, AI-service boundary.

### Required sections (machine-checked)

`scripts/ai-workflow-check.mjs` requires every ledger to contain these section headings non-empty:

- `## Docs Consulted`
- `## Verification State`
- `## Ledger/File-State Consistency`

`## Verification State` must include a `Cross-model review:` line with a non-empty value (use `degraded — <reason>` when only one model is available). Phase ledgers (filename contains `phase-N` or body has `Phase: ...`) must also include `Light Spec:` pointing to an existing light-spec file. When `Status:` reaches `complete` AND the ledger is a phase ledger, an `Architecture Pass:` line is required.

### When to update the ledger

- After selecting docs and extracting requirements
- After each material decision
- Before delegating to a child agent
- After each child result packet
- After changing implementation scope
- Before final verification

Before claiming completion, compare the ledger with current file state:

- Files changed match the accepted scope
- Docs consulted match the implemented behavior
- Child result packets are integrated
- Verification state is current
- Remaining risks are listed

## Resume And Compaction Recovery

When resuming work after a pause, context compaction, or a new agent session, restore context in this order:

1. Read `AGENTS.md` or `CLAUDE.md`, depending on the host
2. Read [`docs/ai-development-workflow.md`](../ai-development-workflow.md) (entry point)
3. Open the latest relevant run ledger under `docs/ai-workflow/runs/YYYY/MM/DD/`
4. Re-read the ledger's `Docs consulted` files when they govern the next action
5. Inspect current file state for paths listed in the ledger
6. Resume from the ledger's `Next action` and `Verification state`

If a required ledger is missing, report `context ledger missing`, create one from [`context-ledger-template.md`](context-ledger-template.md), reconstruct the known state from docs and current files, then continue.

## Related

- Plan and Light Spec that the ledger references → [`planning-contracts.md`](planning-contracts.md)
- Review gates the ledger must record results from → [`review-gates.md`](review-gates.md)
- Fallback class when a packet handoff fails → [`fallback-and-recovery.md`](fallback-and-recovery.md)
