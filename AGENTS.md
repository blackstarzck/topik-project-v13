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
3. Select and read the exact docs required by the user's goal.
4. Record `Docs consulted` and extracted requirements in the plan, ledger, or final report.
5. Follow [docs/ai-development-workflow.md](docs/ai-development-workflow.md).

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
- **User-facing replies must follow [`## Communication Style (Non-Negotiable)`](#communication-style-non-negotiable--사용자-응답-톤)** — plain Korean, "vibe coder" reader, bite-sized structure, glossary for any technical term.

## Communication Style (Non-Negotiable · 사용자 응답 톤)

**이 프로젝트의 모든 사용자 응답은 기본적으로 한국어, "바이브 코더" 기준으로 쓴다.** "바이브 코더"는 코드를 눈으로 읽을 수는 있지만 전문 개발자는 아닌 독자다.

This rule governs every reply, summary, plan explanation, and HTML report shown to the user. Internal artifacts (run ledgers, plan files, commit messages, agent task/result packets, code comments, test names) keep their canonical English vocabulary because other agents and tooling read them and they have their own templates.

**필수 규칙 (모두 지킬 것):**

- 짧은 문장. 구체적 일상어. 전문 용어 최소화.
- 어쩔 수 없이 전문 용어를 쓰면 괄호 안에 한 줄 풀이 또는 문서 끝 용어집 첨부.
- 줄글 대신 시각적 구조 사용: 스코어보드 카드, 신호등 상태, "무슨 일? / 왜 문제? / 고치는 법?" 3줄 아이템, 번호 매긴 체크리스트.
- 명령어/코드 블록은 꼭 필요할 때만. 각 블록 뒤에 한 줄 한국어 설명 첨부.
- 워크플로 용어는 다음과 같이 자동 번역해서 노출한다:
  - "pre-implementation" → "아직 코드 안 짰음"
  - "ledger" → "작업 일지"
  - "cross-model review" → "다른 AI에게 검토받기"
  - "degraded mode" → "임시 통과"
  - "P0 / P1 / P2" → "지금 당장 / 이번 주 안에 / 여유 있을 때"
  - "Architecture Pass" → "구조 마무리 점검"
  - "Light Spec" → "간단 명세서"
  - "Plan-Review PASS Gate" → "계획 재검토 통과 관문"
- HTML 리포트 구조: ① 한 줄 결론 → ② 3카드 스코어보드 → ③ 우선순위별 액션 → ④ 끝에 용어집.
- 사용자 노출 출력에서 줄글 마크다운 표는 지양. 카드/3줄 아이템 우선. 표는 다른 AI가 읽는 기술 산출물에만.

**예외:** 사용자가 명시적으로 "engineer mode", "표준 어휘로", "원문 그대로" 등을 요청하면 그 응답에 한해 표준 영어 어휘 사용을 허용한다. 단 그 요청이 끝나면 즉시 본 규칙으로 복귀한다.

**참조 예시 (이 톤을 그대로 따를 것):** `reports/opus-vs-codex-workflow-consensus.html` (2026-05-22, Opus 4.7 작성).

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
