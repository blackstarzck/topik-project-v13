# AI Development Workflow Contract

This project uses project-local GStack and Superpowers installs. Any AI agent working in this repository, including Codex and Claude Code, must follow this contract before changing code.

## Project State

이 저장소는 현재 **pre-implementation** 상태입니다. `src/`, `package.json`은 아직
없습니다. `docs/` 안의 스펙은 "현재 코드"가 아닌 **구현 시 따라야 할 목표 스펙**으로
읽으세요. `src/`가 생성된 이후에는 그 시점부터 `src/App.tsx`가 라우트의 최종 구현
참조가 됩니다.

## Mandatory Startup

1. Use Superpowers first.
   - Claude Code: invoke the `using-superpowers` skill.
   - Codex: use native skill discovery when available; otherwise read the project-local `.codex/skills/using-superpowers/SKILL.md` just enough to follow it.
2. Load the project source of truth from `docs/` before planning implementation.
3. Check whether a GStack or Superpowers skill applies before answering, planning, editing, testing, reviewing, or declaring completion.
4. Follow the full workflow in `docs/ai-development-workflow.md`.

## Project Source Of Truth

Do not run a fresh grill-me/domain-discovery interview for this project. The domain and product decisions are already validated in `docs/`.

문서들은 **현행 정본**과 **레거시 관측**으로 구분됩니다. 새 구현/QA/리뷰는 현행
정본만 사용하고, 레거시는 제품 히스토리 컨텍스트로만 참조합니다.

### 현행 정본 (active)

- `docs/prd.md` — 제품 요구
- `docs/spec.md` — UI/구현 스펙 (target)
- `docs/ant-design/README.md` — 디자인 시스템 (필독 순서 포함)
- `docs/sitemap.md` Target React Route Map — 라우트
- `docs/ia.md` — 페이지 IA 인덱스
- `docs/IA/README.md` + `docs/IA/<page>/description.md` — 페이지별 IA 정본
- `docs/IA/analysis-report.md` — IA 정합성 분석 (P0 해소 여부 확인)
- **`docs/flow/user-flow.md`** — 사용자 플로우 (노드명은 IA `Source`와 1:1 정합)

### 레거시 관측 (reference only)

- `docs/user-flow.md` — 2026-04-22 HTML 사이트 사용자 흐름 관측
- `docs/ia-pages/*.md` — 같은 시점 페이지별 화면 영역 관측
- `docs/sitemap.md`의 Legacy HTML Route Map 섹션

Goal-to-doc mapping:

- Product scope, user value, roles, monetization, or core requirements: `docs/prd.md`
- Functional behavior, validation, data handling, acceptance details: `docs/spec.md`
- Navigation, routes, page hierarchy, or information architecture: `docs/ia.md`, `docs/sitemap.md` (Target Route Map)
- User journey, step order, transitions, entry/exit states: **`docs/flow/user-flow.md`** (정본). `docs/user-flow.md`는 레거시 관측 컨텍스트로만 참조.
- Visual UI implementation, layout, components, tokens, motion: `docs/ant-design/README.md` plus relevant `docs/ant-design/*.md`
- Specific page or screen implementation: `docs/IA/README.md` plus the matching `docs/IA/<page>/description.md` and wireframe
- Legacy page composition notes (history only): `docs/ia-pages/*.md`

The implementation plan must include a "Docs consulted" section listing exact files read and the requirements extracted from them. If no matching doc is found, the agent must say so before implementation and use GStack office-hours plus Superpowers brainstorming to clarify scope.

If the user's request conflicts with the active documents, stop and report the conflict with exact document references. Do not silently invent a new product direction.

For net-new scope, product pivots, or requirements not covered by active docs, do not proceed directly from office-hours/brainstorming into implementation. First produce either:

- a docs update proposal listing the files that must change, or
- an explicit user-approved implementation brief with acceptance criteria.

Implementation may start only after one of those exists.

## Harness Layout

| Path | Owner | Purpose |
| --- | --- | --- |
| `.claude/skills/` | Claude Code | Project-local GStack (short names) and Superpowers skills |
| `.codex/skills/` | Codex | Project-local GStack (`gstack-*` prefix) and Superpowers skills |
| `.codex/superpowers/` | Codex | Bundled Superpowers source tree |
| `.agents/skills/gstack/` | Generic agent fallback | Shared GStack assets (`bin/`, `browse/`, `qa/`, `review/`, `ETHOS.md`) for agents that do not have a host-specific folder. Treat as read-only mirror of the gstack core. |
| `.omx/` | OMX runtime | Local bun/python deps, logs, state. Do not edit by hand. |

Agents that do not have a dedicated folder should consult `.agents/skills/gstack/`
as a last-resort skill source; primary skills always live under the
host-specific folder above.

## Skill Names

Use these project-local skills. Do not install global copies.

Codex GStack skills are prefixed:
- `gstack-office-hours`
- `gstack-plan-ceo-review`
- `gstack-plan-design-review`
- `gstack-plan-eng-review`
- `gstack-review`
- `gstack-qa`
- `gstack-ship`

Claude Code GStack skills are short names:
- `office-hours`
- `plan-ceo-review`
- `plan-design-review`
- `plan-eng-review`
- `review`
- `qa`
- `ship`

Superpowers skills have the same names for both hosts:
- `brainstorming`
- `writing-plans`
- `test-driven-development`
- `systematic-debugging`
- `requesting-code-review`
- `receiving-code-review`
- `verification-before-completion`
- `finishing-a-development-branch`

## Non-Negotiable Rules

- No production code before a failing test, unless the task is docs-only, config-only, generated artifacts, or the existing project has no runnable test surface. If an exception applies, record the reason before editing.
- For work covered by `docs/`, treat the docs as accepted product/domain context and proceed to planning. Use GStack office-hours only for net-new scope, ambiguous requests outside the docs, or explicit product pivots.
- For any non-trivial implementation plan, run GStack engineering review before code changes.
- For UI or user-facing flows, run design review before implementation and browser/visual QA before completion.
- Every implementation must finish with review, verification, and a clear list of tests run.
- If both Codex and Claude Code are available, one agent implements and the other reviews before final completion. If only one agent is active, perform the same review gates locally.
- In multi-agent work, the main session is the coordinator and durable context owner. Child agents execute bounded slices only; they do not redefine product scope, overwrite shared plans, or rely on private context that is not reported back.
- Before delegating, the main session must provide a task packet: user goal, accepted scope, docs consulted, extracted requirements, exact write/read scope, constraints, and required verification.
- After delegation, child agents must return a result packet: files inspected or changed, decisions made, checks run, blockers, assumptions, and recommended follow-up.
- The main session must integrate child result packets before continuing, resolving overlapping write scopes or context conflicts before final verification.
- For non-trivial work, implementation work, UI/flow/integration changes, net-new scope, doc conflicts, multi-agent work, or work likely to resume across sessions, create and maintain a context ledger under `docs/ai-workflow/runs/` from `docs/ai-workflow/context-ledger-template.md`.
- Before completion, compare the context ledger with current file state, child result packets, and verification output. Do not claim completion if the ledger is stale.
- Tiny docs/config/non-behavioral edits may skip the context ledger only when no multi-agent work, no behavior change, no doc conflict, and no resume risk exists; the final report must state the reason.
- When resuming after compaction, a pause, or a new agent session, read the latest relevant ledger first, then re-open the docs and files it references before continuing.
- Fallbacks do not weaken quality gates. If a required tool, skill, reviewer, test runner, browser, child agent, network operation, or context artifact is unavailable, use the fallback protocol in `docs/ai-development-workflow.md`: recover equivalent evidence, record degraded mode, or fail closed.
- Fail closed for doc conflicts, missing approval, destructive actions, secret exposure risk, and security uncertainty. Do not implement through those blockers.

## Completion Gate

An AI agent may not claim done until all of these are true:

- The relevant skills were used or explicitly ruled out with a reason.
- The relevant docs were read and listed in the plan/final report.
- The final report follows `docs/ai-workflow/report-template.md`.
- A context ledger exists and is current when the workflow requires one, or the final report states the allowed lightweight exception.
- Tests or equivalent verification were run and read.
- Any fallback or degraded-mode path was documented with the failed normal path, evidence collected, and remaining risk.
- GStack review or Superpowers code review was completed for code changes.
- GStack QA or equivalent browser/flow verification was completed for UI changes.
- Remaining risks and untested areas are reported.
