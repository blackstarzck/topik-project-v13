# Auth Identity Linking UX Proposal

## Context

TALKPIK AI uses Supabase Auth for email/password and Google OAuth sign-in. Supabase Auth can associate multiple identities with one user. The UX must avoid exposing whether an email already has an account on public screens while still making linked login methods understandable after the user is authenticated.

## Proposed Policy

- Same verified email: allow Supabase Auth automatic identity linking. Do not create a separate app-level merge table or custom user merge flow.
- Different email: do not automatically merge accounts. Treat manual account linking across different emails as out of scope for v1.
- Public auth screens: never state that an email exists, does not exist, or belongs to a specific provider.
- Authenticated profile screen: show the user's available login methods and allow linking Google as an additional method.
- Provider unlinking: defer until a separate design covers re-authentication, minimum identity count, and account lockout prevention.

## Acceptance Criteria

- Email duplicate or account-exists cases on `/sign-up` continue to use security-safe guidance with login and password reset actions.
- OAuth provider raw errors, tokens, and account existence details are not shown in URL or UI.
- After Google OAuth completes for a user with a Google identity, `/auth/post-auth` may attach `notice=google-linked` only to authenticated destination routes.
- `/profile` shows email and Google login method status to the authenticated user.
- Google linking from `/profile` calls Supabase Auth `linkIdentity({ provider: "google" })`.
- No database migration is required for this v1.

## Documents To Update If Accepted

- `docs/Wireframe/01-A-01-sign-up/functional-spec.md`
- `docs/Wireframe/02-A-02-login/functional-spec.md`
- `docs/Wireframe/27-X-05-profile-editing/functional-spec.md`
