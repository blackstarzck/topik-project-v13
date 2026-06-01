# IA Remediation Multi-Agent Execution Plan

This execution plan was split so AI agents do not need to read one very long file.

Start here instead: [docs/ai-execution-plans/ia-remediation-multi-agent/README.md](../ai-execution-plans/ia-remediation-multi-agent/README.md).

## Short Map

| Need | File |
| --- | --- |
| Goal, source priority, audit input, risk controls, reconciliation, Phase 0 preflight | [00-overview-and-preflight.md](../ai-execution-plans/ia-remediation-multi-agent/00-overview-and-preflight.md) |
| Supabase dummy data, fixture manifest, auth/session states, RLS, storage, admin/RBAC, seed safety | [01-supabase-fixtures.md](../ai-execution-plans/ia-remediation-multi-agent/01-supabase-fixtures.md) |
| Agent roles, tool policy, MCP/plugin policy, workflow diagram | [02-agent-model-tools-workflow.md](../ai-execution-plans/ia-remediation-multi-agent/02-agent-model-tools-workflow.md) |
| Run state, queue artifact, dispatch budget, heartbeat, stale sessions, handoff, monitor packets | [03-run-state-monitoring.md](../ai-execution-plans/ia-remediation-multi-agent/03-run-state-monitoring.md) |
| Task packets, result packets, IA remediation fields, queue rules | [04-task-packets-queue.md](../ai-execution-plans/ia-remediation-multi-agent/04-task-packets-queue.md) |
| Human confirmation, cross-IA flow, flow-edge gates, specialist routing, write locks, write conflicts | [05-human-flow-specialists-conflicts.md](../ai-execution-plans/ia-remediation-multi-agent/05-human-flow-specialists-conflicts.md) |
| Completion gate, verification commands, unavailable-command policy, docs consulted | [06-completion-and-reference.md](../ai-execution-plans/ia-remediation-multi-agent/06-completion-and-reference.md) |

The old path remains only for compatibility with existing references.
