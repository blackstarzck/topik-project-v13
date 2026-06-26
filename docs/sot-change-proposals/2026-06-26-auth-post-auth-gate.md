# Auth Post-Auth Gate Flow Proposal

## Summary

Email sign-up confirmation, sign-up confirmation resend, auth-error resend, Google OAuth, and magic-link access should all route authenticated users through `/auth/post-auth` before a product destination.

`/auth/post-auth` remains the single completion gate:

1. If required profile fields or required legal consents are missing, redirect to `/auth/consent`.
2. `/auth/consent` renders the missing profile fields and the required terms/privacy consents in one page.
3. The consent action validates and saves the required data.
4. After saving, the user returns to `/auth/post-auth` for final routing.
5. New or incomplete learners continue to `/onboarding/learning-goal`; fully complete existing learners may continue to `/dashboard`.

## Active SOT Conflict

The current active SOT says email sign-up confirmation continues directly to `/onboarding/learning-goal`:

- `docs/Wireframe/01-A-01-sign-up/functional-spec.md`
- `docs/flow/user-flow.md`
- `docs/Wireframe/34-X-12-auth-verify-email/functional-spec.md`

This proposal does not directly edit those active SOT files. It records the required reconciliation before the active SOT is updated.

## Acceptance Criteria

- Email sign-up calls Supabase `signUp` with `emailRedirectTo` pointing to `/auth/callback?next=/auth/post-auth?intent=sign-up`.
- Sign-up confirmation resend from `/auth/verify-email` uses the same sign-up post-auth callback.
- Sign-up confirmation resend from `/auth/error` uses the same sign-up post-auth callback.
- Magic-link login calls Supabase `signInWithOtp` with `emailRedirectTo` pointing to `/auth/callback?next=/auth/post-auth?intent=login`.
- Google OAuth continues to route through `/auth/post-auth`.
- `/auth/consent` remains one page for missing required profile fields plus required terms/privacy consent.
- Consent save returns to `/auth/post-auth`, and `/auth/post-auth` sends incomplete learners to `/onboarding/learning-goal`.
- E2E verification includes screenshot evidence for the consent completion page when Supabase test credentials are available.

## Operational Note

Supabase Auth redirect URLs must be configured in the project allowlist. Production and preview environments must allow the app origin and `/auth/callback` route because the nested `next` value is handled by the application after the callback.
