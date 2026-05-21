# Fallback And Recovery

Failure classification and fallback matrix. **Entry point**: [`docs/ai-development-workflow.md`](../ai-development-workflow.md).

This sub-doc owns §3e (Fallback And Recovery Protocol) of the legacy workflow.

## Principle

Fallback is not permission to skip a quality gate. It is a controlled way to either recover equivalent evidence through another path or stop safely with a clear blocker report.

## Failure Classes

Classify the failure first:

| Failure class | Examples | Required response |
| --- | --- | --- |
| **Fail closed** | Doc conflict, destructive action, secret exposure risk, security uncertainty, missing user approval | Stop. Report the blocker, exact references, and what decision/input is needed. Do not implement. |
| **Degraded mode** | GStack unavailable, browser automation unavailable, test runner missing, only one AI available | Use the closest equivalent manual or local checklist. Record degraded mode and evidence in the ledger / final report. |
| **Recover** | Context compaction, missing/stale ledger, interrupted session, child result missing context | Rebuild context from `AGENTS.md`/`CLAUDE.md`, [entry workflow doc](../ai-development-workflow.md), run ledger, consulted docs, and current files before continuing. |
| **Retry once** | Transient network error, temporary CLI failure, flaky command | Retry once after checking the command and environment. If it fails again, stop and report the command, output, and next required action. |
| **Reassign** | Child agent timeout, child agent did not return a result packet, overlapping write scope | Main session reclaims the scope or re-delegates with a tighter task packet. Completion blocked until a result packet or direct verification exists. |

## Fallback Matrix

| Normal requirement | Accepted fallback | Not acceptable |
| --- | --- | --- |
| Relevant docs must be read | If a specific doc is missing, state it, read the closest active doc, and use office-hours/brainstorming plus approval gate for net-new scope | Inventing requirements |
| Superpowers skill invocation | Read the project-local skill file directly and follow the closest applicable procedure | Ignoring the skill because the host tool is unavailable |
| GStack review | Run the equivalent review checklist manually and record degraded mode | Skipping review without explanation |
| TDD | If no runnable test surface exists, state the exception and use static inspection, build/typecheck/lint, or manual verification | Writing behavior code with no test or verification note |
| Browser/visual QA | Manual flow checklist, screenshots when available, responsive inspection, or documented blocker | Claiming UI works without any flow evidence |
| Multi-agent reviewer | Same agent performs review gate with explicit self-review checklist, or reassigns to available reviewer | Treating implementation as reviewed |
| Child result packet | Ask for the result packet again, or main session directly inspects files and verification | Trusting hidden child context |
| GitHub/network push | Keep local commit, report remote failure, command output, and retry command | Claiming publication succeeded before remote confirmation |
| Cross-model review | Single model self-reviews with explicit checklist; ledger records `Cross-model review: degraded — <reason>` | Skipping cross-model review without ledger record |
| Plan-review PASS gate (re-review) | After FAIL revision, the same model re-reviews; if model unavailable, ledger records `Re-review: degraded — <reason>` and accepts residual risk | Treating revised plan as PASS without re-review |

## Final Report Fallback Section

When any fallback path was used, the final report must include:

- Normal path that failed
- Failure class (fail-closed / degraded-mode / recover / retry-once / reassign)
- Fallback used
- Evidence collected
- Remaining risk
- Whether completion is allowed or blocked

If the fallback is `fail-closed`, the report must state what input or decision is needed from the user before work can resume.

## Fail-Closed Triggers

Stop and request user input — do not implement — when any of these is true:

- Active docs conflict with the user request
- A destructive action is implied (force push, schema drop, secret rotation, mass file delete)
- A secret exposure risk is present
- Security-relevant behavior is uncertain
- A required user approval is missing
- The plan-review PASS gate has not closed and the implementer is the same model that wrote the plan

## Related

- Ledger fields that record degraded mode and fallback evidence → [`context-and-packets.md`](context-and-packets.md)
- Review gates that may invoke degraded mode → [`review-gates.md`](review-gates.md)
- Planning contracts that govern when fallback is acceptable for plan/light-spec work → [`planning-contracts.md`](planning-contracts.md)
