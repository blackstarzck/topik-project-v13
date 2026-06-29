# Auth Email Verified Access Gate Proposal

Date: 2026-06-29
Status: proposed

## Reason

`profiles.status = 'active'` and Supabase Auth email verification are separate
states. The user app must not treat an active profile as proof that the email is
verified.

## Proposed SOT Update

- Define protected resource access as `active profile + email_confirmed_at is not null`.
- Keep auth completion status focused on profile, required consent, and learning
  goal readiness after email verification has passed.
- Keep `/auth/verify-email` as signup guidance and resend UI, not as the error
  page for expired or invalid tokens.
- Require `/auth/consent` page/action and `complete_auth_gate` consent writes to
  reject email-unverified sessions before reading legal documents or writing
  `user_consents`.
- Document that `/auth/error?reason=otp_expired` remains the token-expiry
  recovery flow.

## Implementation Reference

- `src/lib/auth/access-gate.ts`
- `src/app/auth/post-auth/page.tsx`
- `src/app/auth/consent/page.tsx`
- `src/app/auth/consent/actions.ts`
- `src/app/(workspace)/layout.tsx`
- `supabase/migrations/20260629120000_auth_email_verified_access_gate.sql`

## Rejected Alternative

Do not add `pending-email-verification` to every auth completion status model.
That would mix access eligibility with profile/consent/onboarding readiness and
would incorrectly suggest that learning goal setup is part of signup completion.
