# Planning Contracts

Planning gates and the contract sections that govern Light Specs and Plans. **Entry point**: [`docs/ai-development-workflow.md`](../ai-development-workflow.md).

This sub-doc owns the rules for §1 (Frame The Work) and §1b (Light Spec) of the legacy workflow. The plan-review PASS gate that follows a plan lives in [`review-gates.md`](review-gates.md).

## 1. Frame The Work

Use the smallest lane that fits the work. Do not start coding without recording the matching evidence in the ledger or final report.

| Situation | First action | Required gate before code |
| --- | --- | --- |
| Work already specified in `docs/` | Cite docs, convert requirements to acceptance criteria | Plan-eng review when architecture/data-flow risk exists |
| New product idea, unclear feature, scope question, explicit deviation | `office-hours` + `brainstorming` | Docs update proposal OR user-approved implementation brief with acceptance criteria — implementation starts only after one exists |
| Clear implementation request | `writing-plans` | Plan-eng review when meaningful risk; design review for UX work |
| Architecture, data flow, or meaningful risk | `plan-eng-review` (Claude) / `gstack-plan-eng-review` (Codex) | PASS gate — see review-gates.md |
| UX, visual design, user-facing workflow | `plan-design-review` / `gstack-plan-design-review` | PASS gate + design review before implementation, browser/visual QA before completion |
| Product scope or business tradeoff | `plan-ceo-review` / `gstack-plan-ceo-review` | Documented decision in ledger |

Do not run a fresh `grill-me`/domain-discovery interview for covered product scope. The product/domain decisions already live in `docs/`.

## Required Output Before Coding

Before any production code or non-trivial doc change, the plan (or short checklist for tiny work) must list:

- Docs consulted — exact files read
- Problem statement
- Files likely to change
- Test strategy
- Known risks
- Acceptance criteria

For very small changes this can be a short checklist in the agent response. For larger work, save the plan under `docs/ai-workflow/plans/` and follow that folder's `README.md` for naming and required sections.

## 1b. Light Spec

Phase-sized work requires a 1-page light spec at `docs/ai-workflow/light-specs/phase-{n}-{slug}.md` **before any implementation begins**. The light spec compresses the phase's intent and boundaries; the plan is for task-level decomposition.

Six required sections:

1. **Core Functionality** — 1–3 core values delivered this phase
2. **Out of Scope** — what is intentionally not built and why
3. **Minimum Acceptable Behavior** — smallest set of conditions for "it works"
4. **User Flow** — one-line entry-to-exit path, referencing `docs/flow/user-flow.md`
5. **Domain Boundary** — domain handled and its target folder (`docs/domain-glossary.md`)
6. **Success Criteria** — how the phase will be closed

The corresponding ledger must reference it:

```
- Light Spec: docs/ai-workflow/light-specs/phase-4-learning-core.md
```

`scripts/ai-workflow-check.mjs` requires this line whenever the ledger is a phase ledger (filename contains `phase-N` or body has `Phase: ...`). Light specs are not required for tiny docs/config or single-task work.

## Plan Template Contract (machine-checked)

Every plan under `docs/ai-workflow/plans/` (other than `README.md` and `*-template.md`) must contain these sections non-empty:

- `## Out of Scope — Intentional Cuts` — items intentionally excluded with reasons; forces subtraction discipline
- `## Smallest Buildable Unit` — smallest slice of the plan that is independently buildable

If a `## Tasks` section exists, its task table must include a `Subagent-eligible? (Y/N + reason)` column and every data row must give a `Y — <reason>` or `N — <reason>` value (em-dash or hyphen accepted).

```text
| # | Task | Files | Subagent-eligible? (Y/N + reason) |
| --- | --- | --- | --- |
| 1 | DB schema | src/db/*.ts | Y — independent module |
| 2 | UI wiring | src/app/*.tsx | N — depends on Task 1 result |
```

Phase plans named `*-development-phases-and-bootstrap.md` are additionally checked: every Phase Contract row's `Completion Gate` cell must mention `Architecture Pass`. CI blocks PRs that violate any of the above.

## When Scope Changes (lesson from cleanup PR)

If a pre-review surfaces scope reduction (e.g., FAIL because a task is too broad), update **every layer** of the plan in the same revision:

- Scope summary at top
- Out of Scope table
- Task table
- Per-task detail sections
- Architecture description
- Risks list
- Verification Strategy

A single-layer fix is the most common cause of repeated FAIL/CONCERN rounds. The reviewer will catch the next inconsistent layer if any is left.

## Related

- Plan review and re-review gate → [`review-gates.md`](review-gates.md)
- Ledger that records the plan's decisions and evidence → [`context-and-packets.md`](context-and-packets.md)
- Failure classes when a planning gate is blocked → [`fallback-and-recovery.md`](fallback-and-recovery.md)
