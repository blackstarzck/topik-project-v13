# Cross-Model Plan-Eng-Review · Round 1
# `docs/ai-workflow/plans/20260527-1600-auth-overview-codex-fix.md` — auth-overview.md Codex Round-1 적발 정정 Plan

You are GPT-5.5 (Codex) acting as senior plan-eng reviewer on an implementation plan authored by Claude Opus 4.7. This is a strict plan-eng-review per `docs/ai-workflow/review-gates.md` §Plan-Review PASS Gate.

## What this plan does

The plan defines how to fix 7 issues you yourself found in Round 1 of `tasks/codex-output-auth-overview-review-round1.md`:

- 2 FAIL items (dimension #1: callback path wrong, dimension #10: 3 cross-doc conflicts)
- 5 CONCERN items (dimensions #2, #4, #5, #7, #8)
- 3 PASS items (#3, #6, #9 — no fix needed)

Concretely, 9 edits to `docs/development/auth-overview.md` + 1 line addition to `.env.example`.

## Context — what's special about this plan

User has imposed a **3-Layer Gate** workflow:

```
T0 (this review — Round 1 plan-eng-review)
   ↓
T1/T2 revise + Round 2 if FAIL
   ↓
T3 (separate fresh codex session — final GO / HOLD / NO-GO)
   ↓ GO
T4 implement subagent
   ↓
T5 main verify
   ↓
T6 Codex Round 2 post-implementation review
   ↓
T7 final report
```

Your role at T0 is the *first* gate — you decide whether the plan is structurally sound enough that a separate ratify agent + implement subagent can proceed.

## Required reading (ground truth — read in full before scoring)

**The plan file (under review):**
- `docs/ai-workflow/plans/20260527-1600-auth-overview-codex-fix.md`

**The Round 1 review the plan responds to:**
- `tasks/codex-output-auth-overview-review-round1.md`
- `reports/auth-overview-codex-review-20260527.html` (Opus's report consuming your Round 1 output)

**The doc being fixed:**
- `docs/development/auth-overview.md` (read the sections cited in the Edit-by-Edit Table)

**Ground-truth code/config the plan claims to align with:**
- `src/app/auth/callback/route.ts` (for E2, E3)
- `src/app/auth/callback-fragment/page.tsx` (for E2)
- `src/components/auth/PasswordResetRequestForm.tsx:21-23` (for E4)
- `.env.example:1-20` (for E7, E10)
- `src/lib/auth/redirect-url.ts:30-36` (for E7)
- `tests/lib/auth/error-mapping.test.ts`, `tests/integration/route-matrix.test.ts` (for E8, E8b)

**Plan contracts:**
- `docs/ai-workflow/planning-contracts.md` — required sections (Out of Scope, SBU, Subagent-eligible)
- `docs/ai-workflow/review-gates.md` — TDD exception, PASS gate, round-cap, disagreement resolution
- `docs/ai-workflow/agent-packets.md` — Task Packet template (Task 4 uses this)

## Review dimensions

For each dimension, give an explicit verdict (PASS / CONCERN / FAIL) with file:line citations. Cite both the plan-under-review AND the ground-truth file:line.

1. **TDD exception justification** — Plan claims `Documentation-only changes` exception. Is this correct? `.env.example` is config, not docs strictly — does it still qualify? Are the substitute verifications (grep + checker + Round 2) sufficient?

2. **Smallest Buildable Unit choice** — Plan picks "P0 3건 묶음 (P0-1 + P0-2 + P0-3a/b)" as SBU. Is this the right granularity? Should P0-3a (.env.example) actually be split because it's a code-adjacent file with deployment implications, not docs? Or is the bundling correct?

3. **Out of Scope completeness** — 7 items cut. Anything missing that should be cut? Anything wrongly cut (e.g., should "PW max 64 implementation" actually be in scope since cross-doc-conflict #10c is one of the FAIL points)?

4. **Task table Subagent-eligible classification** — Each row's Y/N + reason. Especially T4 (Y — single file multi-line patch). Is the Implement subagent really safe to delegate, given that the 9 edits span multiple sections and one edit (E10 in .env.example) is in a different file? Should T4 be split into T4a (auth-overview.md) and T4b (.env.example)?

5. **Edit-by-Edit Table accuracy** — Each row's "현재 (틀림)" must match what's actually in `auth-overview.md` today, and each "정정" must match the ground-truth file:line citations. Spot-check: E2 (callback row), E4 (reset flow step), E7 (env var note), E10 (.env.example insertion location).

6. **3-Layer Gate design** — User mandated this 3-layer flow (T0 → T3 → T6). Is the plan's separation of concerns clear?
   - T0 (you): plan-eng-review — structural soundness
   - T3 (separate codex): final GO/HOLD/NO-GO — ratification
   - T6 (codex Round 2): post-implementation review — output correctness
   
   Are T3 and T6 truly distinct, or is T3 redundant with T0 + T6? If they're redundant, the user's explicit requirement still wins, but flag any actual redundancy.

7. **Task Packet (T4) completeness** — The packet for the implement subagent. Per `agent-packets.md` template:
   - All required fields present? (Agent, Role, Objective, Audience, Accepted scope, Out of scope, Docs consulted, Extracted requirements, Exact read/write scope, Files not to touch, Constraints, Required verification, Expected output, Context ledger path)
   - Is `Audience: n/a` correct for docs work?
   - Is the `Required verification` actually verifiable by the subagent itself (grep is fine; `node scripts/ai-workflow-check.mjs` requires Node — is that available in subagent sandbox?)

8. **Round-cap & escalation rules** — Plan §Verification Strategy mentions Round-cap 3. But the 3-Layer Gate has multiple round counters (T2 plan round, T3 ratify round, T6 post-impl round). Is the cap interpretation clear? Where does user escalation trigger?

9. **Risks completeness** — 6 risks listed (R1-R6). Anything missing? Specifically:
   - What if Codex CLI is unavailable mid-flow? (degraded mode in `fallback-and-recovery.md`)
   - What if T3 ratify agent gives HOLD with a non-actionable concern?
   - What if E10 (`.env.example` addition) breaks an existing Vercel CI deploy by causing a missing env var error in a different env that didn't previously check for `NEXT_PUBLIC_SITE_URL`?

10. **Acceptance Criteria measurability** — 9 checkboxes. All testable? Specifically:
    - "9개 edit 모두 적용됨 (grep verifiable)" — each edit has a unique grep target?
    - "Codex Round 2 PASS or CONCERN(accepted with reason)" — what counts as "accepted with reason"?
    - "T3 ratify agent verdict: GO" — what if HOLD is acceptable to user but criterion says GO only?

## Output format

Open with a single verdict block:

```
VERDICT: PASS | CONCERN | FAIL
SUMMARY: <2-3 sentences>
```

Then for each dimension:

```
### <n>. <name>
Verdict: PASS | CONCERN | FAIL
Finding: <specific finding with file:line cites — both plan and ground-truth>
Suggested fix: <if not PASS, exact text edit. Be specific: "change Task X step Y from Z to W">
```

End with:
- "## Cross-cutting concerns" — anything not fitting the 10 dimensions
- "## Top 3 blockers (if FAIL)" — most critical items Opus must fix in one revision pass

## Discipline

- Cite both sides: the line in `docs/ai-workflow/plans/20260527-1600-auth-overview-codex-fix.md` AND the ground-truth file:line.
- Don't manufacture concerns. If a section is fine, mark PASS.
- If you find that the plan is technically sound but cosmetically improvable (e.g., section ordering), mark PASS with a note — don't escalate to CONCERN.
- If a claim from your Round 1 review is NOT addressed in this plan, flag that explicitly — the plan must address all FAIL + CONCERN items or justify omission in Out of Scope.
- This is round 1 of max 3 for the plan (base limit per review-gates.md §Round-cap rule, since this is not workflow-governing).

Begin.
