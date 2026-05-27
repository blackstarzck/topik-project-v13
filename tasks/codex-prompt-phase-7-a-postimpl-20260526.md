# Codex GPT 5.5 — Phase 7-A Post-Implementation Cross-Review

Phase 7-A (Task 0) just shipped. This is the standard post-implementation review per `docs/ai-workflow/review-gates.md` §Cross-Model Review.

## What was done

- `src/lib/supabase/env.ts`: `refine` now allows `http://127.0.0.1` and `http://localhost` when `process.env.NODE_ENV === "development"`. Production/test still enforce `https://`.
- `tests/lib/supabase/env.test.ts`: 3 new test cases. Existing 5 cases preserved. Uses `vi.stubEnv("NODE_ENV", ...)` because `process.env.NODE_ENV` is read-only in Next.js types.
- `vitest.config.ts`: Added `tests/e2e/**` exclude — Playwright e2e specs run via `pnpm exec playwright test`, not vitest. Fixes a pre-existing regression where vitest tried to import the coverage-matrix spec.

## Files changed

- `src/lib/supabase/env.ts` (refine logic)
- `tests/lib/supabase/env.test.ts` (3 new cases + `vi.unstubAllEnvs()` in afterEach)
- `vitest.config.ts` (tests/e2e/** exclude)
- `docs/ai-workflow/runs/2026/05/26/20260526-0900-phase-7-a-env-https-fix.md` (ledger)
- `docs/ai-workflow/light-specs/phase-7-coverage-gap-fill.md` (Audience section format compliance)

## Test results

- `pnpm vitest run tests/lib/supabase/env.test.ts` → 8/8 PASS
- `pnpm vitest run` (full) → 349 passed / 3 skipped / 0 failed
- `pnpm typecheck` → 0 errors
- `pnpm lint` → 0 errors (5 pre-existing warnings)
- `node scripts/ai-workflow-check.mjs --repo .` → PASS

## Your task — verify

1. **Plan rev3 Task 0 AC match**: Verify Task 0 acceptance criteria in `docs/ai-workflow/plans/20260524-phase-7-coverage-gap-fill.md` §7 ("Task 0 AC") is satisfied.

2. **NODE_ENV semantics**:
   - Does `process.env.NODE_ENV === "development"` correctly distinguish dev from test/production in Next.js?
   - Is there any edge case (Edge runtime, server actions, middleware) where NODE_ENV evaluates differently?

3. **Test independence**:
   - Verify `vi.stubEnv` + `vi.unstubAllEnvs` afterEach properly isolates each test.
   - Confirm existing 5 tests (which don't use stubEnv) still behave correctly.

4. **Security**:
   - Production still rejects `http://127.0.0.1`? (Plan R-10 requirement)
   - Any way an attacker could trick the validation by setting `NEXT_PUBLIC_NODE_ENV` or similar?

5. **vitest.config.ts e2e exclude**: Is this change scoped correctly? It should not silently exclude any legitimate vitest spec.

## Output

```
VERDICT: <PASS | CONCERN | FAIL>

PLAN AC MATCH:
- Task 0 AC satisfied? <YES/NO + cite>

FINDINGS:
| ID | Section | Issue | Suggested fix |

SECURITY CHECK:
- Production rejects http://127.0.0.1? <YES/NO + how verified>
- Attack vectors considered: <list>

OVERALL RECOMMENDATION:
- <PASS — sub-phase 7-A complete | CONCERN with accept | revise>
```

Short review — this is a small SBU. Don't overthink.
