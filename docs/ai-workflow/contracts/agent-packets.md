# Agent Packet Templates

Use these packets whenever the main session delegates work to another agent, Claude Code instance, Codex subagent, OMX team lane, or reviewer.

## Task Packet

```markdown
## Task Packet

- Agent:
- Role:
- Objective:
- Audience:                # user | admin | both | n/a (non-UI/non-permission task)
- Accepted scope:
- Out of scope:
- Docs consulted:
- Extracted requirements:
- Exact read scope:
- Exact write scope:
- Files not to touch:
- Constraints:
- Required verification:
- Expected output:
- Context ledger path:
```

`Audience` 필드는 child agent가 user 라우트 코드를 만지면서 admin 가드/RPC를 호출하거나 그 반대로 가는 실수를 막기 위한 사전 경계다. `both`이면 task 자체를 두 packet으로 쪼개거나 packet 안에서 user-half / admin-half 분기를 명시한다. UI/권한과 무관한 작업(예: 라이브러리 빌드 스크립트 수정)은 `n/a`. 자세한 audience 규칙: [`../../ai-development-workflow.md` §Audience rules](../../ai-development-workflow.md).

## Result Packet

```markdown
## Result Packet

- Agent:
- Role:
- Objective completed:
- Audience verified:        # task packet Audience와 실제 변경된 코드 경계가 일치하는지 (yes/no/n/a + 근거)
- Files inspected:
- Files changed:
- Decisions made:
- Tests/checks run:
- Results:
- Blockers:
- Assumptions:
- Scope concerns:
- Recommended follow-up:
- Context ledger updates needed:
```

`Audience verified`가 `no`이면 main session은 결과를 통합하기 전에 [`fallback-and-recovery.md`](../fallback-and-recovery.md)의 audience-mismatch 처리에 따라 reassign 또는 직접 수정한다.

## Main Session Integration Checklist

- Result packet received and read.
- Files changed are inside delegated write scope.
- Decisions are compatible with accepted docs and scope.
- Verification output was inspected by the main session when correctness depends on it.
- Ledger updated with result packet and current verification state.
- Overlapping write scopes or conflicts are resolved before final verification.
