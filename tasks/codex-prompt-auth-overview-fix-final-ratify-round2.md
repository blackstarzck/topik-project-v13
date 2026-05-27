# Final Ratify Gate · Round 2 · Fresh GPT Session
# 별도 GPT 에이전트의 GO / HOLD / NO-GO 최종 결정 (재시도)

You are GPT-5.5 (Codex), invoked as a **fresh ratify agent** for an implementation plan v3. You have NO prior conversation context with the Opus session, NO prior session with previous reviewers. You read the artifacts fresh.

This is **T3 ratify counter round 2/3**. Round 1 (your predecessor session) returned HOLD with 3 specific dispatch-readiness issues. Opus has revised v2→v3 to address them. Your job: verify the v3 revisions actually close the 3 HOLD items without introducing new issues.

## Round 1 HOLD items (the things to verify)

From `tasks/codex-output-auth-overview-fix-final-ratify.md:46-49`:

> 1. Normalize T4a/T4b edit counts everywhere: task table, task packet, ledger, agent assignment, and acceptance criteria.
> 2. Clarify whether `E8b` is a separate edit or a sub-check under `E8`.
> 3. Reconcile T2/T3 wording: either run T2 as written, or explicitly state T3 ratify replaces T2 under the user's final-GPT mandate.

## Required reading (read all four in order)

1. **`tasks/codex-output-auth-overview-fix-final-ratify.md`** — Round 1 HOLD verdict and the 3 items (above)
2. **`docs/ai-workflow/plans/20260527-1600-auth-overview-codex-fix.md`** — plan v3 (the `## Revision history` section near top notes what changed v2→v3)
3. **`docs/ai-workflow/runs/2026/05/27/20260527-1600-auth-overview-codex-fix.md`** — ledger Decisions table for the v2→v3 changes
4. **Spot-check (grep yourself, don't trust the plan's claims):**
   - `grep -nE "T4a|11 edit|9개 edit|10 edit|8 edit" docs/ai-workflow/plans/20260527-1600-auth-overview-codex-fix.md` — count should be consistent at 11 for T4a (with one historical "v2" mention noting old 9)
   - `grep -n "E8b" docs/ai-workflow/plans/20260527-1600-auth-overview-codex-fix.md` — should appear in the preamble explaining it's a separate edit
   - `grep -nE "T2.*(fall-back|skip|Round 2)" docs/ai-workflow/plans/20260527-1600-auth-overview-codex-fix.md` — should consistently describe T2 as fall-back-only under user's final-GPT mandate

## Decision rubric (same as Round 1, applied to v3)

### GO criteria (all must be true)

- HOLD item 1 (edit count normalization): T4a is consistently 11 across (a) Tasks table row, (b) Task Packet header, (c) Extracted requirements, (d) Expected output, (e) Acceptance Criteria. T4b is consistently 1.
- HOLD item 2 (E8/E8b clarification): Plan explicitly states whether E8b is a separate edit or sub-check, and the per-edit verification target table treats them consistently with that decision.
- HOLD item 3 (T2/T3 reconciliation): One unambiguous story across Tasks table, Verification Strategy, 3-Layer Gate diagram, and Status Track. Either T2 runs OR T3 substitutes for it — but not both flavors in the same plan.
- Ground-truth still holds (no regression from Round 1's "yes — no mismatch found"): callback/route.ts, PasswordResetRequestForm.tsx, .env.example, SignUpForm.tsx still match plan's citations.
- v2→v3 revisions do not introduce NEW errors.

### HOLD criteria

- One of the 3 items is *almost* closed but has a remaining ambiguity (e.g., 4 of 5 references to T4a edit count are 11 but one is still 8)
- A new inconsistency was introduced by v2→v3 revise
- A new section reference doesn't resolve (e.g., "see §Per-Edit Verification Targets" but section was inadvertently broken)

### NO-GO criteria

- One of the 3 HOLD items is silently dropped without addressing
- v2→v3 revise introduces a factual error contradicting ground truth
- The plan is now internally self-contradictory in a way that can't be fixed in one pass

## Output format

```
VERDICT: GO | HOLD | NO-GO

REASONING:
<3-5 sentences max>

HOLD item check:
- HOLD #1 (edit count normalization): closed / partially closed / not closed — <evidence with line numbers>
- HOLD #2 (E8/E8b clarification): closed / partially closed / not closed — <evidence with line numbers>
- HOLD #3 (T2/T3 reconciliation): closed / partially closed / not closed — <evidence with line numbers>

New issues from v2→v3 revise (if any):
- <list, or "none">

Ground-truth re-check:
- callback/route.ts:1-18 still matches plan claim: yes / no
- PasswordResetRequestForm.tsx:21-23 still matches: yes / no
- .env.example:1-20 (NEXT_PUBLIC_SITE_URL absence) still matches: yes / no
- SignUpForm.tsx:71-77 / PasswordResetConfirmForm.tsx:43-49 still matches: yes / no

(If HOLD or NO-GO) What needs to change:
1. <specific>

(If GO) Confidence: low | medium | high
Residual risk (if any): <one line>
```

## Discipline

- You are NOT Round 1's ratify agent. Treat this as fresh. Do not assume Round 1's verdict applies — verify v3 independently.
- Be willing to GO if v3 closes the 3 items, even if there's a P2 nit.
- Be willing to HOLD over a single specific gap rather than NO-GO.
- NO-GO is for: HOLD item silently dropped, new factual error vs ground truth, self-contradiction unfixable in one pass.
- Single output. If HOLD, list specific actionable items.
- This is T3 ratify round counter 2/3. If you HOLD, Opus has one more attempt before user escalation.

Begin.
