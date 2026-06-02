# Claude Code Project Instructions

Follow `AGENTS.md` and `docs/ai-development-workflow.md` for every task in this repository.

This project has project-local installs only:

- GStack skills: `.claude/skills`
- Superpowers skills: `.claude/skills`

At the start of every conversation or task, invoke `using-superpowers`. Before work begins, check the relevant GStack and Superpowers skills. For GStack in Claude Code, use the short skill names such as `office-hours`, `plan-eng-review`, `review`, `qa`, and `ship`.

## Scope Boundary — Admin (READ FIRST)

**This repo is the USER-FACING app. Do NOT build, extend, or "remediate" admin
features here right now.** Admin (IA codes **H-01, X-08, X-10, X-15**) has a
separate source-of-truth implementation in a different local folder; the data
schema was designed admin-first, so **user-facing screens reconcile TO the
existing schema** (do not add admin-oriented schema/migrations). Admin ↔ this-repo
sync is a deliberate LATER phase, after user-facing screens are complete, using
the existing admin docs. **This directive supersedes any handoff / IA-audit text
that lists admin screens as in-scope.** Do not delete the existing admin code
either (it is a self-contained, frozen island). Full detail + the current
admin-code investigation: [`docs/admin-scope-boundary.md`](docs/admin-scope-boundary.md).

## Data Consistency (User ↔ Admin) — high importance

The data schema was designed **admin-first** (admin app: `topik-ai`). User-facing
screens must reconcile TO the existing schema, and user/admin views of the same
data must agree on field meanings, status/enum values, and ownership. **Before
building or changing any user screen that reads/writes a SHARED entity**
(profiles/users, problems/question-bank, writing submissions/feedback, billing,
etc.), consult the method in
[`docs/user-admin-consistency-method.md`](docs/user-admin-consistency-method.md)
(and the artifact `docs/user-admin-data-consistency.md` once it exists). Anchor
naming on `topik-ai/docs/specs/admin-data-contract.md`. Do NOT add admin-oriented
schema to make a user screen work — reconcile the screen to the schema and escalate
real schema gaps. (The filled consistency artifact is built when reconciliation
work starts, not pre-emptively.)

## Project State

This repository now has a foundation implementation. `src/` and `package.json`
exist, with the Next.js App Router scaffold, Supabase/auth/theme foundations,
and some learning and feedback surfaces already started.

Treat `docs/` as the source of truth for product intent, architecture decisions,
workflow rules, quality gates, and intended behavior. Treat current source as
the implementation reference for behavior that already exists. Before changing
behavior, reconcile current source code with accepted docs. Do not silently
invent product behavior.

## Source Of Truth

Separate active source-of-truth docs from legacy observations. Use active docs
for implementation, QA, and review.

### Active Docs

- `docs/prd.md`, `docs/spec.md`
- `docs/ant-design/README.md` and the routed Ant Design detail docs
- `docs/sitemap.md` Target React Route Map
- `docs/ia.md` plus `docs/Wireframe/README.md` and matching page folders under `docs/Wireframe/{...}/description.md`
- `docs/Wireframe/analysis-report.md`
- `docs/flow/user-flow.md`

### Legacy Observations

- `docs/user-flow.md`
- `docs/ia-pages/*.md`
- Legacy HTML Route Map sections in `docs/sitemap.md`

Do not run a fresh grill-me/domain-discovery interview for this project. The validated source of truth is the active `docs/` set above. For every implementation request, infer the user's goal, select the relevant docs, read them before planning, and include a `Docs consulted` section in the plan and final report.

For net-new scope, product pivots, unclear features outside the active docs, or explicit deviations from the docs, use `office-hours` plus `brainstorming`, then stop at one of these gates before implementation:

- a docs update proposal listing the exact files that must change, or
- an explicit user-approved implementation brief with acceptance criteria.

Do not implement directly from office-hours output. If the request conflicts with active docs, report the conflict with exact document references and wait for direction.

For multi-agent work, the main Claude/Codex session is the coordinator and durable context owner. Child agents must receive bounded task packets with goal, docs consulted, extracted requirements, write scope, constraints, and required verification. Child agents must return result packets with files inspected or changed, decisions, checks run, blockers, assumptions, and follow-up. The main session integrates those packets before continuing or claiming completion.

For non-trivial work, implementation work, UI/flow/integration changes, net-new scope, doc conflicts, multi-agent work, or work likely to resume across sessions, create and maintain a context ledger under `docs/ai-workflow/runs/` from `docs/ai-workflow/templates/context-ledger-template.md`. Use `docs/ai-workflow/contracts/agent-packets.md` for task and result packets. Before claiming completion, compare the ledger with current file state and verification output. Tiny docs/config edits may skip the ledger only when the final report states the allowed lightweight exception.

When resuming after compaction, pause, or a new session, restore context by reading `CLAUDE.md`, `docs/ai-development-workflow.md`, the latest relevant run ledger, the ledger's docs consulted, and the current file state before continuing.

Fallbacks do not weaken quality gates. If a required tool, skill, reviewer, test runner, browser, child agent, network operation, or context artifact is unavailable, follow the fallback protocol in `docs/ai-development-workflow.md`: recover equivalent evidence, record degraded mode, or fail closed. Fail closed for doc conflicts, missing approval, destructive actions, secret exposure risk, and security uncertainty.

Do not bypass the workflow because the task looks small. Use the lightweight path documented in `docs/ai-development-workflow.md` when the change is small.

## Communication Style

Use Korean by default for user-facing replies. Write for non-developers and vibe coders: short sentences, concrete wording, and plain Korean before expert terms. Follow `docs/user-communication-style.md` and `docs/report-writing-template.md`.

When a workflow term is needed in a user-facing reply, explain it in Korean first and include the original term in parentheses when helpful. Examples:

- foundation implementation: 기반 구현
- ledger: 작업 일지
- cross-model review: 다른 AI에게 검토받기
- degraded mode: 임시 통과
- P0/P1/P2: 지금 당장 / 이번 주 안에 / 여유 있을 때
- Architecture Pass: 구조 마무리 점검
- Light Spec: 간단 명세서

Internal artifacts such as ledgers, plans, commit messages, agent packets, and code comments may keep their standard English vocabulary because other agents and tools parse them.

If the user explicitly requests engineer mode, raw technical wording, exact original wording, or English terminology, use that style for that answer only. After that answer, return to the default communication style.
