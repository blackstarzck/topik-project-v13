# Final Ratify Gate · Round 3 · Fresh GPT Session
# 별도 GPT 에이전트의 GO / HOLD / NO-GO 최종 결정 (마지막 라운드)

You are GPT-5.5 (Codex), invoked as a **fresh ratify agent** for plan v4. You have NO prior conversation context. You read fresh.

This is **T3 ratify counter round 3/3** — the last round allowed before user escalation. Round 1 returned HOLD on 3 dispatch-readiness items; v3 closed 1 fully and 2 partially. Round 2 returned HOLD on the remaining 2 partial items. v4 attempts to fully close them.

## Round 2 HOLD items (the things v4 must close)

From `tasks/codex-output-auth-overview-fix-final-ratify-round2.md:39-44, 52-55`:

> 1. Update ledger `Accepted scope`, `Extracted requirements`, and `Agent Assignments` from 9 edits to T4a 11 edits + T4b 1 edit.
> 2. Rewrite Task 2 details so Round 2 is fallback-only under T3 HOLD, with no default FAIL→Round 2 path.

(Round 1 HOLD #2 — E8/E8b clarification — was already closed in v3 per Round 2's "HOLD #2 closed" note. Don't re-verify that one unless you see new drift.)

## Required reading

1. **`tasks/codex-output-auth-overview-fix-final-ratify-round2.md`** — Round 2 HOLD verdict (the 2 items above)
2. **`docs/ai-workflow/plans/20260527-1600-auth-overview-codex-fix.md`** — plan v4 (`## Revision history` notes v3→v4 changes)
3. **`docs/ai-workflow/runs/2026/05/27/20260527-1600-auth-overview-codex-fix.md`** — ledger v4 (Decisions table for v3→v4 changes + the "9 edit" lines that should now read "11 + 1 = 12")
4. **Spot-check grep yourself:**
   - `grep -nE "9개 edit|9 edit" docs/ai-workflow/runs/2026/05/27/20260527-1600-auth-overview-codex-fix.md` — should be 0 hits in non-historical sections (Decisions table history rows are OK to retain)
   - `grep -nE "Task 2:" docs/ai-workflow/plans/20260527-1600-auth-overview-codex-fix.md` — verify Task 2 body now says fall-back, not "FAIL→Round 2"
   - `grep -nE "default skip" docs/ai-workflow/plans/20260527-1600-auth-overview-codex-fix.md` — Task 2 body should explicitly say this

## Decision rubric

### GO criteria

- Round 2 HOLD #1 (ledger edit count): ledger Accepted scope, Extracted requirements, Agent Assignments all show 11 + 1 = 12 (or equivalent unambiguous wording). Historical Decisions rows may retain "9 edit" since they record an old state.
- Round 2 HOLD #3 (Task 2 body): Task 2 §body explicitly states fall-back-only behavior. "FAIL→Round 2" as default path is removed or clearly marked as fall-back.
- No new factual errors vs ground truth introduced by v3→v4.

### HOLD criteria

- One of the 2 items partially closed (e.g., ledger has 2 of 3 spots updated but missed one)
- New wording inconsistency introduced

### NO-GO criteria

- One of the 2 items silently dropped
- New factual error vs ground truth
- Plan is in worse shape than v3

## Output format

```
VERDICT: GO | HOLD | NO-GO

REASONING:
<3-5 sentences max>

Round 2 HOLD item check:
- HOLD #1 (ledger edit count normalization): closed / partially closed / not closed — <evidence>
- HOLD #3 (Task 2 body fall-back rewrite): closed / partially closed / not closed — <evidence>

New issues from v3→v4 revise (if any):
- <list, or "none">

Ground-truth re-check (light — only if you spot a fresh citation):
- <only mention if you find a new mismatch>

(If HOLD or NO-GO) What needs to change:
1. <specific>

(If GO) Confidence: low | medium | high
Residual risk (if any): <one line>
```

## Discipline

- This is round 3/3. If you HOLD, the next step is mandatory user escalation per ledger round-cap rule. Be deliberate.
- GO is correct if the 2 Round 2 items are closed even if there are minor cosmetic issues.
- HOLD is appropriate only if a real, blocking gap remains.
- NO-GO is for: regression vs v3, or item silently dropped.

Begin.
