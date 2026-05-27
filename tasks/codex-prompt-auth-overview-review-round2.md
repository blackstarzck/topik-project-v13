# Cross-Model Post-Implementation Review · Round 2
# `docs/development/auth-overview.md` — 정정본 재검수 (T6)

You are GPT-5.5 (Codex), invoked as a **fresh post-implementation reviewer**. Plan v4 dispatched two implement subagents (T4a + T4b) which applied 12 edits across `docs/development/auth-overview.md` + `.env.example`. T5 main session verified 20/20 grep targets PASS and `node scripts/ai-workflow-check.mjs --repo .` PASS.

Your job is the **cross-model review gate** mandated by `docs/ai-workflow/review-gates.md` §Cross-Model Review. This is *post-implementation*, not plan review. You verify that the corrected doc:

1. Actually fixes the 7 Round 1 issues (FAIL 2 + CONCERN 5)
2. Does NOT introduce new factual errors vs ground truth
3. Reads as a coherent reference doc (not just patched-up grep matches)

## Scope: focus on the 4 hot zones

Per Plan v4 §Task 6 Step 1, this Round 2 is *scoped* — only re-verify the dimensions Round 1 flagged. Skip dimensions Round 1 marked PASS (#3 11-reason table, #6 vibe-coder tone, #9 Mermaid diagram).

### Hot zones to verify

| Hot zone | Round 1 dimension | Corresponding edits |
| --- | --- | --- |
| Callback structure | #1 (FAIL) | E2, E3 |
| Password reset flow | #10a (FAIL) | E4 |
| NEXT_PUBLIC_SITE_URL env policy | #10b (FAIL) | E7, E10 |
| Rate limit + session policy | #2 (CONCERN) | E5, E6 |
| PW 8-64 drift | #10c (FAIL) | E11 |
| SSoT matrix (test files) | #4 (CONCERN) | E8, E8b |
| Project state honesty | #5 (CONCERN) | E1 |
| Debug SQL hygiene | #8 (CONCERN) | E9 |

## Required reading

1. **`docs/development/auth-overview.md`** (the corrected doc)
2. **`.env.example`** (the corrected config example)
3. **Ground truth (re-confirm citations still hold)**:
   - `src/app/auth/callback/route.ts` (for callback structure claim)
   - `src/app/auth/callback-fragment/page.tsx` (for fragment fallback claim)
   - `src/components/auth/PasswordResetRequestForm.tsx:21-23` (for reset flow claim)
   - `src/lib/auth/redirect-url.ts:29-35` (for env throw claim)
   - `src/components/auth/SignUpForm.tsx:71-77`, `PasswordResetConfirmForm.tsx:43-49` (for PW drift claim)
   - Supabase official docs (for rate limit / session claims) — link in doc
4. **`tasks/codex-output-auth-overview-review-round1.md`** (Round 1's original findings — to verify they're closed)

## Review dimensions (re-scoped from Round 1)

For each, give PASS / CONCERN / FAIL with file:line cites.

1. **Callback structure (Round 1 dim #1)** — Doc now states Route Handler `route.ts` + `callback-fragment/page.tsx`. Verify against ground truth + check that the surrounding prose (4.4 first sentence + cookie silent-fail explanation) flows coherently.

2. **Password reset flow (Round 1 dim #10a)** — §4.3 step 2 should clearly state Supabase verify endpoint handles token exchange, `/auth/callback` is bypassed. Verify accurate against `PasswordResetRequestForm.tsx:21-23`.

3. **NEXT_PUBLIC_SITE_URL env (Round 1 dim #10b)** — §7 env table row + `.env.example` content. Both should now agree (var listed in both places). Check forward-reference language ("E10 적용 후" or equivalent) reads naturally now that E10 is actually applied.

4. **Rate limit + session policy (Round 1 dim #2)** — §6.3 + §9 Q5 should now cite Supabase official defaults (OTP 360/hour, refresh-token no-expiry-with-rotation). Spot-check against Supabase docs.

5. **PW 8-64 drift (Round 1 dim #10c)** — E11 new paragraph in §10 area. Should record IA-vs-implementation mismatch without committing to either side. Verify it doesn't read like a TODO or a code change request.

6. **SSoT matrix (Round 1 dim #4)** — New test file citations should be in the right rows. Codex T3 Round 1 flagged the duplicate `docs/sitemap.md` in the route-change row — verify whether this duplicate is acceptable cosmetic or a real concern.

7. **Project state honesty (Round 1 dim #5)** — E1 note at top. Should be visible and accurate.

8. **Debug SQL hygiene (Round 1 dim #8)** — §11 first code block should no longer have `supabase db remote commit --linked`.

## Cross-cutting checks

- **Coherence**: Does the doc read as a single coherent reference, or does it look like 12 patched grep-matches glued together?
- **New errors**: Any factual claim in the doc that doesn't match ground truth (read at least the 5 source files cited above)?
- **Forward references**: Anything that says "E10 적용 후" or similar that's now confusing because E10 is the final state?

## Output format

```
VERDICT: PASS | CONCERN | FAIL
SUMMARY: <2-3 sentences>
```

Then per hot zone:

```
### <n>. <name>
Verdict: PASS | CONCERN | FAIL
Finding: <evidence with both doc:line and ground-truth:line>
Suggested fix: <if not PASS>
```

End with:
- "## Cross-cutting" — coherence + new errors check
- "## Top 3 follow-ups (if PASS)" — nice-to-have improvements that are NOT blockers
- "## Top 3 blockers (if FAIL)" — must-fix items

## Discipline

- Round-cap: 3. This is Round 1 of post-implementation review counter (separate from plan review counter and T3 ratify counter).
- PASS is the default outcome if hot zones are closed. Don't manufacture concerns.
- CONCERN over a single fixable issue. FAIL only for items that misrepresent the code or contradict ground truth.

Begin.
