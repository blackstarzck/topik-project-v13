# Review Gates

All review and verification gates: TDD loop, cross-model review, plan-review PASS gate, code review, architecture pass, QA, and finish. **Entry point**: [`docs/ai-development-workflow.md`](../ai-development-workflow.md).

This sub-doc owns §2 (TDD), §3 (Codex+Claude Together), §3a (Plan-Review PASS Gate), §4 (Review Gate), §4b (Architecture Pass), §5 (QA Gate), and the review portion of §6 (Finish) of the legacy workflow.

## TDD

For code changes, `test-driven-development` is mandatory.

The required loop:

1. Write or update the smallest failing test
2. Run it and verify it fails for the expected reason
3. Write the minimal implementation
4. Run the focused test until it passes
5. Refactor only while tests stay green
6. Run broader verification

### Allowed TDD exceptions

- Documentation-only changes
- Configuration-only changes
- Generated artifacts
- No existing runnable test surface

When an exception applies, state it and use the nearest practical verification (lint, typecheck, build, static inspection, manual flow testing). The "no runnable test surface" exception is temporary — once `package.json` or `src/` exists, behavior changes must not use this exception unless the relevant surface still has no executable test path.

## Cross-Model Review

**Cross-model review is mandatory** for every code change and every non-trivial plan or doc change. A different model than the implementer must read the diff and either record findings or sign off. The intent is to cover one model's blind spots with another model's reading.

Pairing:

- Codex implements → Claude reviews (`requesting-code-review` or GStack `review`)
- Claude implements → Codex reviews (`requesting-code-review` or GStack `gstack-review`)

When only one model is available, the implementer must record `Cross-model review: degraded — <reason>` in the ledger's `## Verification State`. The checker (`scripts/ai-workflow-check.mjs`) treats `Cross-model review:` as required; missing/empty values block CI. Degraded completion is allowed only when the reason is recorded.

The implementer must not mark the task complete until reviewer findings are addressed or explicitly documented as rejected with a reason.

## Plan-Review PASS Gate

When a plan goes through pre-implementation review (`plan-eng-review`, `plan-ceo-review`, `plan-design-review`, or `codex consult` on the plan file) and the reviewer returns **FAIL**, the implementer must:

1. Revise the plan to address the findings
2. **Re-run the same review** against the revised plan
3. Only proceed to implementation after the re-review returns **PASS** (or **CONCERN** with each remaining concern explicitly documented in the ledger as "accepted with reason")

Going straight from "FAIL → revise → implement" without a re-review is a workflow violation: the implementer is signing off on their own revision and the originally-flagged risks have not been re-validated by an independent reader. This is true even when post-implementation cross-model review is planned — that catches code-level issues, not plan-level ones.

Record the pre-implementation review chain in the ledger Decisions table with timestamps for the original review, the revision, and the re-review. If only one model is available for re-review, record `Re-review: degraded — <reason>` and accept the residual risk explicitly.

Exemptions:

- **Lightweight path** changes skip plan review entirely; this gate does not apply
- **PASS verdict** on the first review needs no re-run
- **CONCERN verdict** on the first review needs the concerns documented and accepted, but no full re-review unless the implementer changes the plan in response

### Round-cap rule (lesson from cleanup PR)

- Base limit: 3 rounds
- Workflow-governing docs or first review FAIL: 4-5 rounds allowed
- Beyond 5 rounds: escalation to the user is mandatory (no infinite loops)
- When a round catches a different *layer* (scope summary → task body → prose → verification) each pass, the implementer should fix every layer simultaneously rather than one at a time

### Disagreement resolution

When cross-review surfaces a commitment-level disagreement (not a simple finding):

1. Each side records its position + rationale + trade-off in the ledger (one paragraph)
2. Apply quantitative criteria first (line counts, checker PASS, token cost, explicit user rule)
3. If only qualitative trade-offs remain, each side does a "weakness acknowledgement" round
4. If unresolved, escalate to the user with options A/B + trade-offs + recommendation + risk
5. User's decision and rationale are recorded in the ledger

Downgrades from P1 to P2 (or P2 to accepted) require ledger evidence: originally flagged level, downgraded level, rationale, accepted trade-off, residual risk, owner decision. **PASS is forbidden while any downgraded P1/P2 lacks this record.**

## Code/Doc Review Gate

Every code change must pass review before completion:

- Superpowers review: `requesting-code-review`, then `receiving-code-review` when feedback exists
- GStack review: `review` (Claude) / `gstack-review` (Codex)

Review must check:

- Behavior matches the accepted plan
- Tests cover the changed behavior
- No unrelated refactors or broad rewrites
- Error states, empty states, edge cases handled
- User-facing text and UI remain coherent

When an independent reviewer or GStack review is unavailable, record degraded mode and run an explicit self-review checklist:

- Scope: changed files match accepted scope, no unrelated edits introduced
- Docs: implementation matches consulted active docs
- Tests: changed behavior covered, or TDD exception + substitute verification documented
- Failure paths: error states, empty states, fallback paths considered
- Evidence: verification commands run fresh, outputs read
- Ledger: current and lists remaining risks

## Architecture Pass

Every phase completion must pass an Architecture Pass before the next phase starts. This is a focused last-mile review that makes the domain visible in the code, not a generic refactor:

- Route/page handlers contain no business logic that should live in a service or domain module
- Folder names and module boundaries match `docs/domain-glossary.md` and the agreed phase scope
- A single concept is not implemented in two places. If duplication exists, the ledger records a deliberate reason or the duplication is removed
- File names, function names, and types use domain terms, not implementation terms

The ledger records the result:

```
- Architecture Pass: passed | failed | skipped — <reason>
```

`scripts/ai-workflow-check.mjs` requires this field whenever the ledger's `Status:` is `complete` AND the ledger is a phase ledger. Phase plans (`*-development-phases-and-bootstrap.md`) must also list `Architecture Pass` in every row of the Phase Contract `Completion Gate` column.

## QA Gate

Use QA for user-facing, browser, interaction, or integration work:

- Codex: `gstack-qa` or `gstack-qa-only`
- Claude Code: `qa` or `qa-only`

QA must include:

- Starting the local app when applicable
- Exercising the changed user path
- Checking responsive layout when UI changed
- Capturing failures as reproducible notes
- Adding regression coverage when possible

If browser automation is unavailable, state the blocker and run the closest alternative verification.

## Finish (review portion)

Before saying done:

- Run `verification-before-completion`
- Run focused tests for changed behavior
- Run broader tests, lint, typecheck, or build when available
- Run `node scripts/ai-workflow-check.mjs --repo .` when Node is available, or document why the checker could not run
- Process the Git publication decision per [`git-publication-decision.md`](git-publication-decision.md): pick exactly `no-commit`, `local-commit`, `push-and-pr`, or `blocked` and record it in the final report and ledger
- For release-sized work, run `ship` (Claude) / `gstack-ship` (Codex)

Final response follows [`report-template.md`](report-template.md).

## Related

- Plan and Light Spec that this gate reviews → [`planning-contracts.md`](planning-contracts.md)
- Ledger that records review evidence and degraded status → [`context-and-packets.md`](context-and-packets.md)
- Fallback when a review gate is blocked → [`fallback-and-recovery.md`](fallback-and-recovery.md)
