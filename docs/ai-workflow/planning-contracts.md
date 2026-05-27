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
- **Verification Strategy** — 적용 가능한 [`review-gates.md`](review-gates.md)의 모든 게이트(TDD · Cross-model review · Plan-Review PASS Gate · Code/Doc Review · Architecture Pass · **QA Gate** · UX/UI Consistency Pass · Finish)를 plan이 명시적으로 옮겨와야 한다. UI 작업이면 `QA Gate`를 빼면 안 된다 — 사고 사례: [`reports/phase-6-qa-gate-skipped-postmortem.html`](../../reports/phase-6-qa-gate-skipped-postmortem.html).

For very small changes this can be a short checklist in the agent response. For larger work, save the plan under `docs/ai-workflow/plans/` and follow that folder's `README.md` for naming and required sections.

## 1b. Light Spec

Phase-sized work requires a 1-page light spec at `docs/ai-workflow/light-specs/phase-{n}-{slug}.md` **before any implementation begins**. The light spec compresses the phase's intent and boundaries; the plan is for task-level decomposition.

Six required sections:

1. **Core Functionality** — 1–3 core values delivered this phase
2. **Out of Scope** — what is intentionally not built and why
3. **Minimum Acceptable Behavior** — smallest set of conditions for "it works"
4. **User Flow** — one-line entry-to-exit path, referencing `docs/flow/user-flow.md`
5. **Domain Boundary** — domain handled, its target folder (`docs/domain-glossary.md`), and **`Audience: user · admin · both`** (이 phase 화면/권한 모델의 대상 — UI/권한 분기 한정. 비대화형 `cron · system · external partner`는 별도 축으로 추후 도입). `both`이면 user/admin 각각의 분기 경계와 대응 폴더(예: `src/app/admin/...` vs `src/app/library/...`, `src/lib/admin/`, `src/lib/auth/admin-guard.ts`)를 한 줄씩 명시한다. Audience 필드는 [`review-gates.md`](review-gates.md) Architecture Pass의 "audience 경계 = 코드 boundary 일치" 검증의 입력이 된다. **표준 6섹션을 따르지 않는 기존 light spec**(예: `phase-6-admin-library-hardening.md`)은 별도 `## Audience` 섹션으로 동일 정보를 표기해도 허용한다. 신규 light spec은 본 5번 항목 안에 한 줄로 명시할 것.
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

If a `## Tasks` section exists, its task table must include a `Subagent-eligible? (Y/N + reason)` column and every data row must give a `Y — <reason>` or `N — <reason>` value (em-dash or hyphen accepted). When the phase Audience is `both`, the table must also include an `Audience` column with `user | admin | both | n/a` per row so child agents receive the right boundary in their Task Packet. Phases whose Audience is `user` or `admin` (single-value) may omit the column.

```text
| # | Task | Files | Audience | Subagent-eligible? (Y/N + reason) |
| --- | --- | --- | --- | --- |
| 1 | DB schema | src/db/*.ts | n/a | Y — independent module |
| 2 | Admin role-change RPC | supabase/migrations/*.sql | admin | Y — server-only, isolated |
| 3 | Library UI | src/app/library/*.tsx | user | N — depends on Task 1 result |
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
