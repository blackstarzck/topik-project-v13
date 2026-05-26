# Codex GPT 5.5 — Phase 7-B Post-Implementation Cross-Review

Phase 7-B (Plan rev3 Task 1) just shipped. 인증 UI 4 화면 + landing + redirect helper.

## Files

- **Plan rev3 Task 1**: `docs/ai-workflow/plans/20260524-phase-7-coverage-gap-fill.md` (Task 1 row + §7 Task 1 AC)
- **Ledger**: `docs/ai-workflow/runs/2026/05/26/20260526-1000-phase-7-b-auth-ui.md`
- **Consensus source (P0-1 A안)**: `docs/ai-workflow/proposals/20260523-coverage-audit-fix-proposals.md`

## What was done

1. **`src/lib/auth/redirect-url.ts`** (R-10 helper): `buildAuthRedirectUrl(path)` returns absolute URL using `NEXT_PUBLIC_SITE_URL` env (or `http://127.0.0.1:3000` fallback in development). Rejects non-http(s) schemes. 6 RED tests pass.

2. **`src/components/auth/SignUpForm.tsx`** (A-01): Ant Design Form + email/password/confirm/displayName(optional)/terms checkbox. `supabase.auth.signUp` + `emailRedirectTo: buildAuthRedirectUrl('/onboarding/learning-goal')`. 이메일 확인 안내 화면 + resend button (`supabase.auth.resend`). 5 tests pass.

3. **`src/components/auth/LoginForm.tsx`** (A-02): Segmented(password / magic-link) + Form. password: `signInWithPassword` → `router.push('/dashboard')`. magic-link: `signInWithOtp` + redirect URL. password mode shows `<Link href="/password-reset">`. 4 tests pass.

4. **`src/components/auth/PasswordResetRequestForm.tsx`** (X-06 request): email → `resetPasswordForEmail` + `redirectTo: buildAuthRedirectUrl('/password-reset/confirm')` → confirmation screen. 2 tests pass.

5. **`src/components/auth/PasswordResetConfirmForm.tsx`** (X-06 confirm): new password + confirm fields → `updateUser({ password })` → success message + redirect `/login`. 2 tests pass.

6. **`src/components/landing/{Hero,FeatureCard}.tsx`**: client components (RSC compatibility). Hero = CTA buttons to sign-up/login. FeatureCard = emoji + title + desc.

7. **5 page.tsx** (X-01 root, A-01, A-02, X-06 request + confirm, all new/rewritten): server components that import the form/landing components. Use plain HTML `<h1>`/`<p>` headings instead of antd Typography destructure to avoid RSC issue.

## Issues encountered and resolved

- `Form<X>` and `Segmented<X>` JSX generic syntax → runtime "Element type is invalid". Removed generic syntax, kept `FormInstance<X>` cast.
- `Typography.Title`/`Typography.Paragraph` destructure at page (server component) level → RSC fails. Moved to plain HTML on page.tsx, kept antd Typography inside client components.
- `vitest.config.ts` was missing `tests/e2e/**` exclude — fixed in 7-A but worth re-checking it didn't regress.

## Test results

- `pnpm vitest run tests/components/auth/ tests/lib/auth/` → 8 files / 31 tests PASS
- `pnpm vitest run` (full) → 368 passed / 3 skipped (54 files)
- `pnpm typecheck` → 0 errors
- 5 routes HTTP 200 (curl): `/`, `/sign-up`, `/login`, `/password-reset`, `/password-reset/confirm`
- `node scripts/ai-workflow-check.mjs --repo .` → PASS

## What you must verify

1. **A안 consensus match**: Plan rev3 Task 1 row lists (a) terms checkbox (b) resend button (c) magic-link toggle (d) confirm page (e) absolute redirect builder. Spot-check each present in implementation.

2. **Security**:
   - `redirect-url.ts` rejects `javascript:` and other non-http schemes? Test it.
   - Production rejects missing `NEXT_PUBLIC_SITE_URL`? (R-10)
   - `signUp` calls always include `emailRedirectTo`? (Supabase requires this for confirmation flow)
   - Password reset confirm page is reachable without auth? It's behind `/password-reset/...` prefix in middleware allowlist.

3. **Form validation**:
   - Email type validation present?
   - Password min length 8?
   - Password confirm match check?
   - Terms acceptance enforced?

4. **RSC vs client boundary**:
   - Page.tsx files are RSC (no "use client"). They import only metadata, Link, and the form/landing client components. Is this correct?
   - Hero/FeatureCard marked "use client" — necessary or could they be RSC with `Typography.Title` direct access? Choose the safer call.

5. **Manual QA defer**:
   - Plan rev3 §7 Task 1 AC includes "manual QA — Mailpit 가입→이메일 확인→학습 목표 도달 (또는 R-9 degraded)". This requires running dev server + real Supabase + Mailpit. Should we DEFER manual QA to Phase 7-E golden-path e2e (Task 13), or attempt now? Recommend.

## Output format

```
VERDICT: <PASS | CONCERN | FAIL>

A안 CONSENSUS MATCH:
- (a) terms checkbox: <YES + cite>
- (b) resend button: <YES + cite>
- (c) magic-link toggle: <YES + cite>
- (d) confirm page route: <YES + cite>
- (e) absolute redirect builder: <YES + cite>

SECURITY:
- javascript: scheme rejection: <verified/concern>
- production missing SITE_URL: <verified>
- signUp emailRedirectTo: <always present?>
- middleware allowlist for /password-reset/confirm: <reachable?>

FINDINGS (P1):
| ID | Section | Issue | Suggested fix |

FINDINGS (P2):
| ID | Section | Issue | Suggested fix |

MANUAL QA RECOMMENDATION:
- <attempt now | defer to Task 13 | reason>

OVERALL:
- <PASS — sub-phase 7-B complete | CONCERN with accept | revise>
```

Short review preferred. This is the largest sub-phase but the patterns are standard.
