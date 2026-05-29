# AI Agent Contract

This file is the short, mandatory contract for every AI agent working in this repository. Keep it small. Put detailed navigation and explanations in the linked docs.

## Project State

This repository is currently pre-implementation. There is no stable `src/` or `package.json` yet. Treat `docs/` as the source of truth for what must be built.

After production source exists, current source code and accepted docs must be reconciled before implementation. Do not silently invent product behavior.

## Mandatory Startup

Before answering, planning, editing, testing, reviewing, or claiming completion:

1. Use Superpowers first.
   - Canonical source: `.agents/superpowers/skills/using-superpowers/SKILL.md`.
   - Claude Code: invoke `using-superpowers` after host mirrors are synced.
   - Codex: use native skill discovery when available after host mirrors are synced; otherwise read the canonical source enough to follow it.
   - If host skill mirrors are missing or stale, run `node scripts/sync-agent-skills.mjs` and then retry host-native skill discovery.
2. Read [docs/agent-index.md](docs/agent-index.md).
3. Read [docs/user-communication-style.md](docs/user-communication-style.md). This is mandatory before any user-facing reply, plan, report, handoff, review, or summary.
4. Select and read the exact docs required by the user's goal.
5. Record `Docs consulted` and extracted requirements in the plan, ledger, or final report.
6. Follow [docs/ai-development-workflow.md](docs/ai-development-workflow.md).

Use [README.md](README.md) and [docs/README.md](docs/README.md) for human-friendly navigation. Use [docs/agent-index.md](docs/agent-index.md) for AI routing.

## Non-Negotiable Rules

- Do not run a fresh grill-me/domain-discovery interview for covered product scope. The product/domain decisions already live in `docs/`.
- If the user request conflicts with active docs, stop and report the conflict with exact file references.
- For net-new scope, product pivots, or requirements not covered by active docs, do not implement directly. First produce either a docs update proposal or a user-approved implementation brief with acceptance criteria.
- No production code before a failing test, unless the task is docs-only, config-only, generated artifacts, or the project has no runnable test surface. Record the exception before editing.
- For non-trivial implementation plans, run the required review gate before code changes.
- For UI or user-facing flows, run design review before implementation and browser/visual QA before completion.
- Fallbacks do not weaken quality gates. Follow the fallback protocol in [docs/ai-workflow/fallback-and-recovery.md](docs/ai-workflow/fallback-and-recovery.md).
- Fail closed for doc conflicts, missing approval, destructive actions, secret exposure risk, and security uncertainty.
- User-facing replies must follow [docs/user-communication-style.md](docs/user-communication-style.md). This is mandatory for every AI agent and applies to every user-facing reply, plan, report, handoff, review, and summary.

## Objectivity And Assumptions

- Do not default to agreeing with the user. Evaluate requests objectively against
  the active docs, current code, security constraints, and implementation risk.
- If the user's request is incorrect, incomplete, risky, or conflicts with
  active docs, state that clearly with concrete references.
- Do not invent product behavior, architecture decisions, data rules, security
  rules, UX flows, or business logic that are not present in active docs or
  explicitly approved by the user.
- When required behavior is missing from active docs, first ask a clarifying
  question or propose a docs update / implementation brief with acceptance
  criteria. Do not implement from assumption.
- Reasonable implementation details may be inferred only when they are low-risk,
  reversible, and directly implied by existing docs, code patterns, or tool
  conventions.
- When making any inference, state the inference and its basis before relying on
  it for implementation.

## Context And Delegation

- For non-trivial work, implementation work, UI/flow/integration changes, net-new scope, doc conflicts, multi-agent work, or work likely to resume later, create and maintain a context ledger under `docs/ai-workflow/runs/YYYY/MM/DD/` from [docs/ai-workflow/context-ledger-template.md](docs/ai-workflow/context-ledger-template.md).
- Tiny docs/config/non-behavioral edits may skip the ledger only when there is no multi-agent work, no behavior change, no doc conflict, and no resume risk. State the exception in the final report.
- In multi-agent work, the main session is the coordinator and durable context owner.
- Child agents execute bounded slices only. They must not redefine product scope or rely on private context that is not reported back.
- Use [docs/ai-workflow/agent-packets.md](docs/ai-workflow/agent-packets.md) for task packets and result packets. Multi-agent / ledger / resume rules: [docs/ai-workflow/context-and-packets.md](docs/ai-workflow/context-and-packets.md).
- Before completion, compare the ledger with current file state, child result packets, and verification output.

## Completion Gate

An AI agent may not claim done until all of these are true:

- Relevant skills were used or explicitly ruled out with a reason.
- Required docs from [docs/agent-index.md](docs/agent-index.md) were read and listed.
- The final report follows [docs/ai-workflow/report-template.md](docs/ai-workflow/report-template.md).
- A required context ledger exists and is current, or the allowed lightweight exception is stated.
- Tests or equivalent verification were run and read.
- Any fallback/degraded-mode path is documented with evidence and remaining risk.
- Code changes passed review; UI changes passed QA or an accepted equivalent.
- Remaining risks and untested areas are reported.

## Detailed References

- AI document router: [docs/agent-index.md](docs/agent-index.md)
- AI workflow entry point: [docs/ai-development-workflow.md](docs/ai-development-workflow.md)
- Workflow sub-docs:
  - Planning + Light Spec contract: [docs/ai-workflow/planning-contracts.md](docs/ai-workflow/planning-contracts.md)
  - Ledger + multi-agent packets + resume: [docs/ai-workflow/context-and-packets.md](docs/ai-workflow/context-and-packets.md)
  - Review gates (TDD / cross-model / plan-PASS / architecture / QA / finish): [docs/ai-workflow/review-gates.md](docs/ai-workflow/review-gates.md)
  - Failure classes + fallback matrix: [docs/ai-workflow/fallback-and-recovery.md](docs/ai-workflow/fallback-and-recovery.md)
- Harness and skill details: [docs/ai-workflow/harness-and-skills.md](docs/ai-workflow/harness-and-skills.md)
- Human docs map: [docs/README.md](docs/README.md)
