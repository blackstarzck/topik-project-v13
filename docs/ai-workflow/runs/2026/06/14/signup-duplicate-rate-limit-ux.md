# Signup Duplicate And Rate-Limit UX Run

Date: 2026-06-14

## Goal

Implement the approved plan for security-safe signup behavior:

- Do not expose email existence through public signup.
- Keep Supabase Auth as source of truth.
- Improve `/auth/verify-email` guidance for new or already-existing emails.
- Add signup-specific cooldown for rate-limit responses.

## Docs Consulted

- `docs/spec.md`
- `docs/development/backend-auth.md`
- `docs/development/stack.md`
- `docs/development/auth-overview.md`
- `docs/sitemap.md`
- `docs/flow/user-flow.md`
- `docs/Wireframe/01-A-01-sign-up/description.md`
- `docs/Wireframe/34-X-12-auth-verify-email/description.md`
- `docs/ant-design/README.md`
- `docs/ant-design/08-theme-architecture.md`
- `docs/ant-design/07-review-checklist.md`

Missing required workflow docs:

- `docs/agent-index.md`
- `docs/ai-development-workflow.md`
- `docs/ai-workflow/context-ledger-template.md`
- `docs/ai-workflow/report-template.md`

## Implementation Notes

- TDD started with component and E2E tests for safe duplicate guidance,
  no-user success-like signup, and signup rate-limit cooldown.
- No DB migration and no server API are planned.
- `service_role` must not be used for public duplicate checking.
- `SignUpForm` now treats `error === null` signup responses as successful
  requests regardless of `data.user`.
- Explicit duplicate-email class errors now show security-safe guidance with
  login and password-reset CTAs instead of a direct duplicate-email field error.
- Rate-limit class errors and HTTP 429 now start a sign-up-only 60 second
  cooldown using `talkpik:sign-up:cooldown-until`.
- `VerifyEmailCard` now explains the new-account and existing-account paths and
  exposes login/password-reset CTAs.
- Updated `messages/ko.json`, `messages/en.json`, and `messages/vi.json`.
- Updated auth overview and A-01/X-12 wireframe docs.

## Verification

- RED: `corepack pnpm test tests/components/auth/SignUpForm.test.tsx`
  failed before implementation because `sign-up-safe-guidance` and
  `sign-up-countdown` were missing.
- PASS: `corepack pnpm test tests/components/auth/SignUpForm.test.tsx`
- PASS: `corepack pnpm test tests/components/auth/VerifyEmailCard.test.tsx`
- PASS: `corepack pnpm test tests/components/auth/SignUpForm.test.tsx tests/components/auth/VerifyEmailCard.test.tsx`
- PASS: `corepack pnpm exec tsc --noEmit --pretty false`
- PASS: `corepack pnpm exec eslint src/components/auth/SignUpForm.tsx src/components/auth/VerifyEmailCard.tsx tests/components/auth/SignUpForm.test.tsx tests/e2e/flows/sign-up.spec.ts`
- PASS: `corepack pnpm exec prettier --check docs/development/auth-overview.md docs/Wireframe/01-A-01-sign-up/description.md docs/Wireframe/34-X-12-auth-verify-email/description.md docs/ai-workflow/runs/2026/06/14/signup-duplicate-rate-limit-ux.md`
- PASS: `corepack pnpm exec playwright test tests/e2e/flows/sign-up.spec.ts --project=desktop-1280 --project=mobile-360 --no-deps`
- Browser QA PASS: inspected `http://localhost:3000/sign-up` and
  `http://localhost:3000/auth/verify-email?email=qa%40example.com` in the
  in-app browser. Desktop and 360px mobile CTA layout had no overlapping
  buttons, and console error logs were empty.

Note: Playwright Chromium was missing in the local machine and was installed
with `corepack pnpm exec playwright install chromium` before E2E execution.

---

## Follow-up: Auth Email Result Page Refinement

Date: 2026-06-14

### Goal

Implement the approved two-page auth result plan:

- Keep `/sign-up`, `/auth/verify-email?email=...`, and `/auth/error?reason=...`.
- Do not add duplicate-account routes or query params.
- Keep explicit duplicate-email errors on `/sign-up` with neutral guidance.
- Make `/auth/verify-email` primarily about email verification and move
  login/password-reset CTAs to a secondary section.
- Make `/auth/error?reason=user_not_found` neutral and avoid rendering the
  untrusted `email` query.
- Add `/auth/:path*` `Referrer-Policy: no-referrer` for auth pages with
  email-bearing query strings.

### Docs Consulted

- `AGENTS.md`
- `docs/README.md`
- `docs/spec.md`
- `docs/development/backend-auth.md`
- `docs/development/auth-overview.md`
- `docs/sitemap.md`
- `docs/flow/user-flow.md`
- `docs/Wireframe/01-A-01-sign-up/description.md`
- `docs/Wireframe/33-X-11-auth-error/description.md`
- `docs/Wireframe/34-X-12-auth-verify-email/description.md`
- `docs/ant-design/README.md`
- `docs/ant-design/08-theme-architecture.md`
- `docs/ant-design/07-review-checklist.md`

Missing required workflow docs:

- `docs/agent-index.md`

### TDD Notes

- RED: `corepack pnpm exec vitest run tests/components/auth/SignUpForm.test.tsx tests/components/auth/VerifyEmailCard.test.tsx tests/components/auth/AuthErrorCard.test.tsx tests/lib/auth/error-mapping.test.ts tests/lib/i18n/catalog-parity.test.ts`
  failed before implementation because the old duplicate guidance,
  verify-email heading/body, and `user_not_found` title were still rendered.
- GREEN: the same command passed after updating i18n copy and the X-12 section
  order.

### Verification

- PASS: `corepack pnpm exec vitest run tests/components/auth/SignUpForm.test.tsx tests/components/auth/VerifyEmailCard.test.tsx tests/components/auth/AuthErrorCard.test.tsx tests/lib/auth/error-mapping.test.ts tests/lib/i18n/catalog-parity.test.ts`
- PASS: `corepack pnpm typecheck`
- PASS: `corepack pnpm lint` (existing warnings only in unrelated files:
  `.scratch/qa-diag/scenario-batch2.mjs`,
  `scripts/design-review/render-shot.mjs`, `scripts/i18n/merge-staging.mjs`,
  `tests/e2e/flows/core-writing-flow.spec.ts`,
  `tests/integration/weakness-flow.test.ts`,
  `tests/lib/export/pdf-export.test.ts`)
- PASS: `corepack pnpm exec prettier --check ...` for changed auth/i18n/docs/test files.
- PASS: `$env:E2E_BASE_URL='http://127.0.0.1:3000'; corepack pnpm exec playwright test tests/e2e/flows/sign-up.spec.ts tests/e2e/screens/verify-email.spec.ts tests/e2e/screens/auth-error.spec.ts tests/e2e/screens/screens-public.spec.ts --project=desktop-1280 --project=mobile-360 --no-deps`
  (56 tests).
- Browser QA PASS: inspected `/auth/verify-email?email=qa%40gmail.com` and
  `/auth/error?reason=user_not_found&email=deleted%40example.com` in desktop/mobile
  browser views. X-12 showed verification-first hierarchy and X-11 did not show
  the email query or direct account-existence wording.

Note: the first E2E run exposed ambiguous test locators for the two "다른 이메일로
가입" links and a flaky escape-link click. The selectors were tightened with
exact names and the full E2E command passed afterward.

---

## Follow-up: Email Callback bad_code_verifier

Date: 2026-06-14

### Trigger

User reported that a normal email/password signup created a row in Supabase
Auth -> Users, but clicking the verification email opened
`/auth/error?reason=bad_code_verifier`.

### Root Cause Evidence

- `Authentication > Users` row exists, so account creation succeeded.
- The failure happens after the email link returns to `/auth/callback`.
- The user started signup in the Codex desktop app internal browser and opened
  the email link from Chrome/Naver mail. With PKCE `code` callbacks, the code
  verifier is stored in the browser/origin that started auth; a different
  browser cannot read it.
- Local `.env.local` uses `NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000`, while
  the screenshot showed `localhost:3000`. `localhost` and `127.0.0.1` have
  separate browser storage and can also trigger PKCE verifier mismatch.
- Supabase MCP project/log access was attempted for project
  `fglggyfvzjdsbyckinqa`, but the connector returned a permission error.
  A local Supabase Management API token was then used without printing the
  token value.

### Change

- `src/lib/auth/redirect-url.ts`
  - In development browser runtime, local `window.location.origin` is used
    before `NEXT_PUBLIC_SITE_URL`.
  - `0.0.0.0` browser origins are normalized to `localhost`.
  - Production and non-browser behavior remain unchanged.
- `tests/lib/auth/redirect-url.test.ts`
  - Added RED/GREEN coverage for localhost-over-127 and 0.0.0.0 normalization.
- E2E signup/resend tests now assert that Supabase `redirect_to` origin matches
  the current app origin, not only that `/auth/callback` is present.
- Auth docs now state that Supabase Email Templates for signup/magic-link/email
  change must use `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=...`
  links. This is required to avoid relying on PKCE localStorage when users open
  email links from another browser or mail app.

### External Config Applied

Supabase Dashboard Auth template config was checked and updated:

- Before: confirmation / magic link / email change templates all used
  `{{ .ConfirmationURL }}` and did not use `{{ .TokenHash }}` or
  `{{ .RedirectTo }}`.
- After: all three templates use `{{ .RedirectTo }}` +
  `{{ .TokenHash }}` and no longer use `{{ .ConfirmationURL }}`.

Applied templates:

- Authentication -> Email Templates -> Confirm signup:
  `<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=signup">Confirm email</a>`
- Authentication -> Email Templates -> Magic link:
  `<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Sign in</a>`
- Authentication -> Email Templates -> Email change:
  `<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email_change">Confirm email</a>`
