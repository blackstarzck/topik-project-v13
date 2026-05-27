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
- Untouched relevant docs and reason:  # required — 체커가 강제. 'none' 또는 'n/a'도 허용. 'header + indented bullets' shape 가능.

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
- Cross-model review: <reviewer name (e.g. "codex (gstack)"), or "degraded — <reason>" if unavailable>
- Architecture Pass: <passed | failed | skipped — <reason>>  # required when ledger Status reaches `complete` for a phase
- Light Spec: <docs/ai-workflow/light-specs/phase-{n}-{slug}.md>  # required when this ledger belongs to a phase (filename contains `phase-N` or body has `Phase: ...`)
- UX/UI Consistency Pass: <passed | failed | skipped — <reason>>  # required when changed files match UI patterns (see review-gates.md §UX/UI Consistency Pass). 4-line evidence structure mandatory:
  - Tokens: <passed | failed | skipped — <reason>> | <evidence line: 정본 참조 + 검토 결과>
  - Components: <passed | failed | skipped — <reason>> | <evidence line>
  - A11y: <passed | failed | skipped — <reason>> | <evidence line: keyboard/focus/label/contrast 4가지 확인>
  - Responsive: <passed | failed | skipped — <reason>> | <evidence line: 360/768/1280 breakpoint 확인>
- QA Gate: <passed | failed | degraded — <blocker | alternative verification | residual risk> | skipped — <reason>>  # required when changed files match UI patterns (see review-gates.md §QA Gate). passed = 로컬 앱 부팅 + user path 직접 클릭 + 콘솔 에러 캡처 완료. degraded는 단독 불허 — blocker · 대체 검증 · 잔여 위험 세 항목 의무. release/phase complete + degraded이면 fail-closed (사용자/owner 명시 승인 시만 별도 한 줄 추가로 진행 가능).

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
