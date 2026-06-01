# AI Execution Plans

This folder stores execution plans written for AI agents such as Codex and Claude.

These are not product specs. They are operational maps that tell an AI agent what to read, what to generate, what evidence to collect, and what must block completion.

## Plans

| Plan | Purpose | Start here |
| --- | --- | --- |
| IA implementation verification | Verify all IA pages, hosted surfaces, route handlers, data/security cases, AI review, human confirmation, and final IA audit output. | [ia-implementation-verification/README.md](./ia-implementation-verification/README.md) |
| IA remediation multi-agent | Fix IA/page audit findings through coordinated agents, Supabase fixture gates, specialist review, human confirmation, and verified closeout. | [ia-remediation-multi-agent/README.md](./ia-remediation-multi-agent/README.md) |

## How Agents Should Use This Folder

- Start with the plan README, not the longest detail file.
- Read only the phase file that matches the current task.
- Record the exact plan files read in `Docs consulted`.
- Treat these plans as execution guidance. Product behavior still comes from active product, spec, IA, flow, and development docs.
