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
