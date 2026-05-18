# Agent Packet Templates

Use these packets whenever the main session delegates work to another agent, Claude Code instance, Codex subagent, OMX team lane, or reviewer.

## Task Packet

```markdown
## Task Packet

- Agent:
- Role:
- Objective:
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

## Result Packet

```markdown
## Result Packet

- Agent:
- Role:
- Objective completed:
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

## Main Session Integration Checklist

- Result packet received and read.
- Files changed are inside delegated write scope.
- Decisions are compatible with accepted docs and scope.
- Verification output was inspected by the main session when correctness depends on it.
- Ledger updated with result packet and current verification state.
- Overlapping write scopes or conflicts are resolved before final verification.
