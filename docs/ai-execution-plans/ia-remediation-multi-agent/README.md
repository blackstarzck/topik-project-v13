# IA Remediation Multi-Agent Execution Plan

This folder is the split execution plan for fixing IA/page audit findings after an IA verification run has already identified gaps.

Use this README as the route map. Read only the file that matches the work you are doing, then record that exact file in `Docs consulted`.

## Quick Start

| If you need to... | Read |
| --- | --- |
| Understand the goal, source priority, audit input, risk controls, reconciliation, or Phase 0 preflight | [00-overview-and-preflight.md](./00-overview-and-preflight.md) |
| Prepare, verify, or block Supabase-backed dummy data, auth states, RLS cases, storage fixtures, or fixture manifests | [01-supabase-fixtures.md](./01-supabase-fixtures.md) |
| Choose agent roles, tool policy, MCP/plugin use, workflow shape, or multi-agent execution flow | [02-agent-model-tools-workflow.md](./02-agent-model-tools-workflow.md) |
| Maintain run state, queue artifacts, dispatch budget, heartbeats, leases, stale sessions, handoff notes, or monitor packets | [03-run-state-monitoring.md](./03-run-state-monitoring.md) |
| Create IA task packets, result packets, remediation fields, or queue status decisions | [04-task-packets-queue.md](./04-task-packets-queue.md) |
| Handle human confirmation, cross-IA flow impacts, flow-edge gates, specialist routing, write locks, or write conflicts | [05-human-flow-specialists-conflicts.md](./05-human-flow-specialists-conflicts.md) |
| Check completion rules, verification commands, unavailable-command policy, or source docs | [06-completion-and-reference.md](./06-completion-and-reference.md) |

## What This Plan Covers

This plan tells Codex, Claude, or another AI agent how to remediate IA audit findings without losing shared state. It covers queue ownership, specialist review, Supabase fixture requirements, human confirmation, cross-IA flow handling, final verification, and closeout evidence.

This is not a product spec. Product behavior still comes from active product, spec, IA, flow, and development docs.

## Supporting Docs

| Support doc | Use |
| --- | --- |
| [specialist-checklists/README.md](./specialist-checklists/README.md) | Specialist review criteria and shared rating labels for remediation agents. |
| [review-profiles/README.md](./review-profiles/README.md) | IA-to-specialist and IA-to-evidence routing map. |

## Reading Rule For Agents

1. Start here.
2. Pick the smallest matching file from the table.
3. Read adjacent files only when a task crosses phase boundaries.
4. Keep the old compatibility path, [docs/ai-workflow/ia-remediation-multi-agent-execution-plan.md](../../ai-workflow/ia-remediation-multi-agent-execution-plan.md), as a pointer only.
