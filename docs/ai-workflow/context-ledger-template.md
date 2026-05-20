# Context Ledger Template

Copy this template to `docs/ai-workflow/runs/YYYY/MM/DD/YYYYMMDD-HHMM-task-slug.md` for any work that requires durable context.

## Run Metadata

- Run id:
- Created:
- Updated:
- Main session owner:
- Host: Codex, Claude Code, or other.
- Status: active, paused, blocked, complete.

## Task

- User goal:
- Accepted scope:
- Out of scope:
- Current next action:

## Docs Consulted

- Exact files read:
- Extracted requirements:
- Doc conflicts: `none` or list file references and conflict details.
- Untouched relevant docs and reason:

## Decisions

Record material decisions in append-only order.

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
|  |  |  |  |

## Active Files

- Files expected to change:
- Files inspected:
- Files changed:
- Files explicitly not to touch:

## Agent Assignments

Use `docs/ai-workflow/agent-packets.md` for packet details.

| Agent | Role | Scope | Status | Packet location or summary |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Child Result Packets

Append each result packet or link to where it is recorded.

## Verification State

- Required checks:
- Checks run:
- Latest results:
- Known failures:
- Skipped checks and reason:

## Fallback State

- Normal path blocked:
- Failure class: fail-closed, degraded-mode, recover, retry-once, reassign, or none.
- Fallback used:
- Evidence collected:
- Completion allowed: yes/no.
- Remaining fallback risk:

## Ledger/File-State Consistency

- Files changed match accepted scope: yes/no.
- Docs consulted match implemented behavior: yes/no.
- Child result packets integrated: yes/no/not applicable.
- Verification state current: yes/no.
- Remaining risks listed: yes/no.

## Risks And Follow-Up

- Remaining risks:
- Assumptions:
- Follow-up needed:
