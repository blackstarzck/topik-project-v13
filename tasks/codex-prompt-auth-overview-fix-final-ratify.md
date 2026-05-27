# Final Ratify Gate · Fresh GPT Session
# 별도 GPT 에이전트의 GO / HOLD / NO-GO 최종 결정

You are GPT-5.5 (Codex), invoked as a **fresh ratify agent** for an implementation plan. You have NO prior conversation context with the Opus session that produced this plan, NO prior session with the Round 1 reviewer who critiqued plan v1. You read the artifacts fresh and decide whether the plan is safe to dispatch to the implement subagents (T4a + T4b).

This is the **user-mandated final gate**. The user explicitly requested: "최종 결정은 별도 gpt 에이전트가해" (the final decision is made by a separate GPT agent). Your role is not to re-do Round 1's review — it's to verify that:

1. Plan v2 actually addresses Round 1's findings
2. No new issues introduced by the v1→v2 revision
3. The plan is structurally ready to dispatch

## Required reading (read all four in order)

1. **`tasks/codex-output-auth-overview-fix-plan-review-round1.md`** — Round 1's verdict (FAIL) and 10-dimension critique of plan v1
2. **`docs/ai-workflow/plans/20260527-1600-auth-overview-codex-fix.md`** — plan v2 (the revised plan; the `## Revision history` section near top notes what changed v1→v2)
3. **`docs/ai-workflow/runs/2026/05/27/20260527-1600-auth-overview-codex-fix.md`** — ledger, especially the `## Decisions` table which records the Opus session's response to each Round 1 finding
4. **Ground truth files** (spot-check 4 critical paths):
   - `src/app/auth/callback/route.ts:1-18` (E2/E3 justification)
   - `src/components/auth/PasswordResetRequestForm.tsx:21-23` (E4 justification)
   - `.env.example:1-20` (E10 justification — NEXT_PUBLIC_SITE_URL absence)
   - `src/components/auth/SignUpForm.tsx:71-77` and `src/components/auth/PasswordResetConfirmForm.tsx:43-49` (E11 PW drift justification)

## Decision rubric

Your output is a single verdict word — **GO**, **HOLD**, or **NO-GO** — followed by structured rationale. Use this rubric:

### GO criteria (all must be true)

- All Round 1 FAIL items (1, 3, 10a, 10b, 10c) are addressed in plan v2's Edit-by-Edit Table AND mapped 1:1 in the new `## Round 1 Finding ↔ Edit Traceability` table
- All Round 1 CONCERN items are either addressed OR explicitly cut to Out of Scope with documented reason
- The new `## Per-Edit Verification Targets` table has unique, mechanical, grep-based checks for every edit
- T4 split into T4a/T4b is internally consistent (no edit assigned to both subagents; no edit missing)
- Acceptance Criteria are measurable (no vague terms like "all edits verified" without specifying the check)
- Ground-truth spot-check confirms the citations are accurate

### HOLD criteria (any one triggers HOLD, not NO-GO)

- A Round 1 finding's resolution in v2 is *technically correct but ambiguous* (could be interpreted two ways)
- A new section introduced in v2 (traceability table, verification target table, R7-R9) is internally inconsistent but the inconsistency is fixable in one pass
- The Risks list still has a gap that would only be visible post-implementation
- The Task Packets (T4a, T4b) have a constraint that may not be enforceable in the subagent runtime

### NO-GO criteria (any one triggers NO-GO)

- A Round 1 FAIL item is silently dropped without justification
- The plan introduces a NEW factual error not present in v1
- Ground-truth spot-check reveals a citation that doesn't match the actual file
- The plan creates a clear path to corruption (e.g., write scope overlap between T4a and T4b)
- An Acceptance Criterion is *unverifiable in principle* (not just measurement-poor — actually impossible to check)

## Output format

```
VERDICT: GO | HOLD | NO-GO

REASONING:
<3-5 sentences max — what tipped the verdict>

GO criteria check:
- All Round 1 FAILs addressed: yes / no — <one-line evidence>
- All Round 1 CONCERNs addressed/cut: yes / no — <one-line evidence>
- Per-Edit Verification Targets uniqueness: yes / no — <one-line evidence>
- T4a/T4b consistency: yes / no — <one-line evidence>
- Acceptance Criteria measurability: yes / no — <one-line evidence>
- Ground-truth spot-check (4 files): yes / no — <list any mismatch>

(If HOLD or NO-GO) What needs to change:
1. <specific, actionable item>
2. ...

(If GO) Confidence: low | medium | high
Residual risk (if any): <one line>
```

## Discipline

- You are not Round 1's reviewer. Your job is *meta* — does v2 properly close v1's findings? Don't re-derive Round 1's critique.
- Be willing to GO if v2 is good enough, even if some CONCERN items remain. Round 1's CONCERNs can be accepted with reason per `review-gates.md:48,58`.
- Be willing to HOLD on a single fixable issue rather than NO-GO. NO-GO is for structural rot.
- If you find ground-truth mismatches you should NO-GO. The plan being wrong about the code it's trying to align with would defeat the whole purpose.
- Single output. No follow-up rounds expected at this gate — if HOLD, the Opus session will revise + re-invoke a fresh ratify session.

Begin.
