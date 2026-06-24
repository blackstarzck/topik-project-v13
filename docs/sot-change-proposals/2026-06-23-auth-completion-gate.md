# SOT Change Proposal: `/auth/consent` Auth Completion Gate

## Context

Current X-18 describes `/auth/consent` as a required legal consent screen. The
product decision for 2026-06-23 is to keep a single post-auth completion screen
instead of adding `/auth/complete-profile`.

## Proposal

Expand X-18 so `/auth/consent` becomes the single authenticated sign-up
completion gate. The screen should collect only missing required profile fields
and any missing required legal consent in one form.

Required profile fields:

- `display_name`: 2-30 characters after trim
- `nickname`: 2-20 characters after trim
- `nationality_country_code`: supported ISO 3166-1 alpha-2 country code

## Acceptance Criteria

- No `/auth/complete-profile` route is added.
- `/terms` remains a public legal document route.
- `/auth/post-auth`, `/auth/consent`, and workspace access use the same auth
  completion status.
- If any required profile field or required consent is missing, the status is
  `pending-auth-completion`.
- `/auth/consent` renders only missing profile fields and only missing required
  legal documents.
- Profile completion and required consent recording are committed atomically by
  a database RPC.
- Magic-link sign-up can still create a user, but incomplete users must pass
  through `/auth/consent` before normal workspace access.

## Notes

This proposal intentionally does not edit active SOT documents. It records the
implementation acceptance criteria for review and later reconciliation into the
X-18 wireframe source of truth.
