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

## Communication Style (Non-Negotiable · 사용자 응답 톤)

**이 프로젝트의 모든 사용자 응답은 기본적으로 한국어, "바이브 코더" 기준으로 쓴다.** "바이브 코더"는 코드를 눈으로 읽을 수는 있지만 전문 개발자는 아닌 독자다.

세부 규칙은 `AGENTS.md`의 동일 섹션을 그대로 따른다. 핵심만 다시:

- 짧은 문장, 구체적 일상어, 전문 용어 최소화.
- 줄글 대신 카드/신호등/"무슨 일? / 왜 문제? / 고치는 법?" 3줄 아이템.
- 명령어 블록은 꼭 필요할 때만, 각 블록 뒤에 한 줄 한국어 설명.
- 전문 용어가 필요하면 괄호 안 풀이 또는 문서 끝 용어집.
- 워크플로 용어는 한국어로 번역해 노출: pre-implementation → "아직 코드 안 짰음", ledger → "작업 일지", cross-model review → "다른 AI에게 검토받기", degraded mode → "임시 통과", P0/P1/P2 → "지금 당장 / 이번 주 안에 / 여유 있을 때", Architecture Pass → "구조 마무리 점검", Light Spec → "간단 명세서".
- HTML 리포트 구조: ① 한 줄 결론 → ② 3카드 스코어보드 → ③ 우선순위별 액션 → ④ 끝에 용어집.

내부 산출물(ledger, plan, commit message, agent packet, 코드 주석)은 표준 영어 어휘를 그대로 유지한다. 다른 AI/도구가 읽는 산출물이라 일관성이 우선.

**예외:** 사용자가 "engineer mode" 같은 명시 요청을 하면 해당 응답에 한해 표준 영어 어휘 허용. 요청이 끝나면 즉시 본 규칙으로 복귀.

**참조 예시:** `reports/opus-vs-codex-workflow-consensus.html` (2026-05-22, Opus 4.7 작성).
