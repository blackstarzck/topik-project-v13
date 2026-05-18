# Claude Code Project Instructions

Follow `AGENTS.md` and `docs/ai-development-workflow.md` for every task in this repository.

This project has project-local installs only:
- GStack skills: `.claude/skills`
- Superpowers skills: `.claude/skills`

At the start of every conversation or task, invoke `using-superpowers`. Before work begins, check the relevant GStack and Superpowers skills. For GStack in Claude Code, use the short skill names such as `office-hours`, `plan-eng-review`, `review`, `qa`, and `ship`.

## Project State

이 저장소는 현재 **pre-implementation** 상태이며 `src/`, `package.json`은 아직
없습니다. `docs/`의 스펙은 "현재 코드"가 아닌 **구현 시 따라야 할 목표 스펙**으로
읽으세요.

## Source Of Truth

`docs/`는 현행 정본과 레거시 관측으로 구분됩니다. 새 작업은 현행 정본만 사용합니다.

### 현행 정본

- `docs/prd.md`, `docs/spec.md`
- `docs/ant-design/README.md` 및 필독 순서 문서들
- `docs/sitemap.md`의 Target React Route Map
- `docs/ia.md` (인덱스) + `docs/IA/README.md` + 해당 페이지 폴더 `docs/IA/{...}/description.md`
- `docs/IA/analysis-report.md`
- **`docs/flow/user-flow.md`** (사용자 플로우 정본)

### 레거시 관측 (참고용)

- `docs/user-flow.md`, `docs/ia-pages/*.md`, `docs/sitemap.md`의 Legacy HTML Route Map

Do not run a fresh grill-me/domain-discovery interview for this project. The validated source of truth is the `docs/` directory listed above. For every implementation request, infer the user's goal, select the relevant docs, read them before planning, and include a "Docs consulted" section in the plan and final report.

For net-new scope, product pivots, unclear features outside the active docs, or explicit deviations from the docs, use `office-hours` plus `brainstorming`, then stop at one of these gates before implementation:
- a docs update proposal listing the exact files that must change, or
- an explicit user-approved implementation brief with acceptance criteria.

Do not implement directly from office-hours output. If the request conflicts with active docs, report the conflict with exact document references and wait for direction.

For multi-agent work, the main Claude/Codex session is the coordinator and durable context owner. Child agents must receive bounded task packets with goal, docs consulted, extracted requirements, write scope, constraints, and required verification. Child agents must return result packets with files inspected or changed, decisions, checks run, blockers, assumptions, and follow-up. The main session integrates those packets before continuing or claiming completion.

For non-trivial work, implementation work, UI/flow/integration changes, net-new scope, doc conflicts, multi-agent work, or work likely to resume across sessions, create and maintain a context ledger under `docs/ai-workflow/runs/` from `docs/ai-workflow/context-ledger-template.md`. Use `docs/ai-workflow/agent-packets.md` for task and result packets. Before claiming completion, compare the ledger with current file state and verification output. Tiny docs/config edits may skip the ledger only when the final report states the allowed lightweight exception.

When resuming after compaction, pause, or a new session, restore context by reading `CLAUDE.md`, `docs/ai-development-workflow.md`, the latest relevant run ledger, the ledger's docs consulted, and the current file state before continuing.

Fallbacks do not weaken quality gates. If a required tool, skill, reviewer, test runner, browser, child agent, network operation, or context artifact is unavailable, follow the fallback protocol in `docs/ai-development-workflow.md`: recover equivalent evidence, record degraded mode, or fail closed. Fail closed for doc conflicts, missing approval, destructive actions, secret exposure risk, and security uncertainty.

Do not bypass the workflow because the task looks small. Use the lightweight path documented in `docs/ai-development-workflow.md` when the change is small.
