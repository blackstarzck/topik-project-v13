# OAuth Callback Cookie Fix

## Scope

- User reported Google OAuth returns to `/login` after approving Google sign-in.
- Fix was limited to OAuth callback cookie persistence and regression coverage.

## Docs Consulted

- `.agents/superpowers/skills/using-superpowers/SKILL.md`
- `.agents/superpowers/skills/systematic-debugging/SKILL.md`
- `.agents/superpowers/skills/test-driven-development/SKILL.md`
- `.agents/superpowers/skills/verification-before-completion/SKILL.md`
- `.codex/skills/talkpik-supabase-boundary/SKILL.md`
- `docs/spec.md`
- `docs/development/backend-auth.md`
- `docs/development/auth-overview.md`

## Evidence

- Browser at `http://localhost:3000/login` had no `sb-*`/Supabase session cookies after the failed Google flow.
- Dev server log showed:
  - `GET /auth/callback?... 307`
  - followed immediately by `GET /login 200`
- This indicates `exchangeCodeForSession(code)` reached the success redirect path, but the next protected request did not receive readable auth cookies.

## Change

- `src/app/auth/callback/route.ts`
  - Replaced the generic server helper for callback handling with a request-bound Supabase server client.
  - Collected cookies written by `@supabase/ssr` during `verifyOtp` / `exchangeCodeForSession`.
  - Attached those cookies directly to the final `NextResponse.redirect(...)`.
- `tests/app/auth/callback-route.test.ts`
  - Added regression coverage proving OAuth callback redirect responses include session cookies.

## Verification

- RED:
  - `corepack pnpm exec vitest run tests/app/auth/callback-route.test.ts`
  - Failed as expected because `Set-Cookie` was missing.
- GREEN:
  - `corepack pnpm exec vitest run tests/app/auth/callback-route.test.ts`
  - 4 tests passed.
- Focused auth tests:
  - `corepack pnpm exec vitest run tests/components/auth/LoginForm.test.tsx tests/app/auth/callback-route.test.ts tests/app/auth/post-auth.test.ts tests/lib/auth/oauth.test.ts`
  - 4 files / 20 tests passed.
- Typecheck:
  - `corepack pnpm typecheck`
  - Passed.
- Lint:
  - `corepack pnpm lint`
  - Passed with 6 pre-existing warnings, 0 errors.
- Format:
  - `corepack pnpm exec prettier --check src/app/auth/callback/route.ts tests/app/auth/callback-route.test.ts`
  - Passed after formatting.
- Local server:
  - Started with `.env.local` on `0.0.0.0:3000`.
  - `http://localhost:3000/login` returned 200.

## Remaining Risk

- Full Google account completion still requires the user to retry account selection/approval in the browser.
- `NEXT_PUBLIC_SITE_URL` currently points to `127.0.0.1`; Google OAuth uses `window.location.origin`, but email/magic-link flows use `NEXT_PUBLIC_SITE_URL`.

## Follow-up: Local 0.0.0.0 Redirect

### Scope

- User retried Google sign-in from `http://localhost:3000/login`.
- After approving Google sign-in, the browser landed on `http://0.0.0.0:3000/auth/post-auth?intent=login`.
- Chrome showed `ERR_ADDRESS_INVALID` because `0.0.0.0` is a server bind address, not a browser destination.

### Root Cause

- `src/app/auth/callback/route.ts` built final redirects with `new URL(next, request.url)`.
- If the callback request base URL was `http://0.0.0.0:3000`, the app returned that host to the browser.
- `src/lib/auth/oauth.ts` also trusted `window.location.origin` directly when building Supabase `redirectTo`.

### Change

- `src/app/auth/callback/route.ts`
  - Added browser-visible app URL normalization.
  - Converts local `0.0.0.0` hosts to `localhost` for success redirects, auth error redirects, and fragment fallback redirects.
- `src/lib/auth/oauth.ts`
  - Normalizes local `0.0.0.0` origins to `localhost` before building the OAuth callback URL.
- Tests
  - Added regression coverage for client OAuth URL generation.
  - Added regression coverage for server callback success redirects.

### Verification

- RED:
  - `corepack pnpm exec vitest run tests/lib/auth/oauth.test.ts tests/app/auth/callback-route.test.ts`
  - Failed as expected with actual redirect host `http://0.0.0.0:3000`.
- GREEN:
  - `corepack pnpm exec vitest run tests/lib/auth/oauth.test.ts tests/app/auth/callback-route.test.ts`
  - 2 files / 9 tests passed.
- Focused auth tests:
  - `corepack pnpm exec vitest run tests/components/auth/LoginForm.test.tsx tests/app/auth/callback-route.test.ts tests/app/auth/post-auth.test.ts tests/lib/auth/oauth.test.ts`
  - 4 files / 22 tests passed.
- Typecheck:
  - `corepack pnpm typecheck`
  - Passed.
- Format:
  - `corepack pnpm exec prettier --check src/app/auth/callback/route.ts src/lib/auth/oauth.ts tests/app/auth/callback-route.test.ts tests/lib/auth/oauth.test.ts`
  - Passed after formatting.
- Lint:
  - `corepack pnpm lint`
  - Passed with 6 pre-existing warnings, 0 errors.
- Browser:
  - Opened `http://localhost:3000/login`.
  - Browser reached `http://localhost:3000/dashboard`, indicating the current session is authenticated and no browser-visible `0.0.0.0` URL remained.

### Remaining Risk

- A fresh Google account approval should still be manually retried by the user if they want to validate the full external Google prompt again.

## Follow-up: Auth Consent Runtime Error

### Scope

- User reached `http://localhost:3000/auth/consent?next=%2Fauth%2Fpost-auth%3Fintent%3Dlogin`.
- Next.js dev overlay showed:
  - `Runtime Error`
  - `Element type is invalid`
  - render method of `AuthConsentPage`
  - highlighted `<Title level={2}>`

### Root Cause

- `src/app/auth/consent/page.tsx` was a Server Component that directly imported Ant Design UI and destructured `Typography.Title`, `Typography.Paragraph`, and `Typography.Text`.
- The project already documents this pattern as unsafe in `src/components/legal/TermsContent.tsx`: AntD compound typography components need a client component boundary.
- The server page should own auth/data/redirect logic, while AntD rendering should live in a `"use client"` component.

### Change

- `src/app/auth/consent/page.tsx`
  - Removed direct `antd` imports and `Typography` destructuring.
  - Keeps only auth/session/profile/missing-consent lookup and redirect decisions.
  - Delegates UI rendering to `AuthConsentPanel`.
- `src/components/auth/AuthConsentPanel.tsx`
  - New `"use client"` component.
  - Renders the consent heading, missing legal documents, required checkbox, hidden `next` field, and submit button with AntD.
- Tests
  - Added a server-safety regression test that keeps direct AntD UI out of the route page.
  - Added a client panel render test.

### Verification

- RED:
  - `corepack pnpm exec vitest run tests/app/auth/consent-page.test.ts tests/components/auth/AuthConsentPanel.test.tsx`
  - Failed as expected:
    - route page still imported `antd`
    - `AuthConsentPanel` did not exist yet.
- GREEN:
  - `corepack pnpm exec vitest run tests/app/auth/consent-page.test.ts tests/components/auth/AuthConsentPanel.test.tsx`
  - 2 files / 2 tests passed.
- Focused auth tests:
  - `corepack pnpm exec vitest run tests/components/auth/LoginForm.test.tsx tests/app/auth/callback-route.test.ts tests/app/auth/post-auth.test.ts tests/lib/auth/oauth.test.ts tests/app/auth/consent-page.test.ts tests/components/auth/AuthConsentPanel.test.tsx`
  - 6 files / 24 tests passed.
- Typecheck:
  - `corepack pnpm typecheck`
  - Passed.
- Format:
  - `corepack pnpm exec prettier --check src/app/auth/consent/page.tsx src/components/auth/AuthConsentPanel.tsx tests/app/auth/consent-page.test.ts tests/components/auth/AuthConsentPanel.test.tsx`
  - Passed.
- AntD CLI:
  - `corepack pnpm dlx @ant-design/cli info Typography --format json`
  - Confirmed `Typography.Title`, `Typography.Paragraph`, and `Typography.Text` are documented subcomponents.
  - `corepack pnpm dlx @ant-design/cli lint src/components/auth/AuthConsentPanel.tsx --format json`
  - 0 issues.
- Lint:
  - `corepack pnpm lint`
  - Passed with 6 pre-existing warnings, 0 errors.
- Browser:
  - Opened `http://localhost:3000/auth/consent?next=%2Fauth%2Fpost-auth%3Fintent%3Dlogin`.
  - Runtime Error overlay was gone.
  - Consent page rendered with heading, required documents, checkbox, and submit button.

### Remaining Risk

- I did not click "동의하고 계속" because that records legal consent for the signed-in user. The user should confirm/check the box and submit in the browser.
