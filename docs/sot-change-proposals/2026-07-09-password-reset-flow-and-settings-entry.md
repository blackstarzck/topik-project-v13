# 2026-07-09 Password Reset Flow and Settings Entry

## Context

The current X-06/X-16 SOT says reset emails should return through `/auth/callback?type=recovery` before `/password-reset/confirm`, but the current user app sent reset links directly to `/password-reset/confirm`. Account settings also did not expose a password setup/change entry point for already authenticated users.

Supabase documents password reset as a two-step flow: request a reset email, then update the password after the recovery session exists. Supabase also documents custom email links with `{{ .TokenHash }}` and `{{ .RedirectTo }}` for server-side callback handling.

## Proposed Policy

- Public `/password-reset` remains security-neutral. It must not say whether the email exists, does not exist, or belongs to email/password, Google, or Magic Link.
- After a syntactically valid public `/password-reset` submission reaches Supabase, provider responses including success, `user_not_found`, rate limit, and unexpected provider errors should render the same neutral check-email state.
- Reset emails should return through `/auth/callback?next=/password-reset/confirm`, where the application verifies the recovery token and then redirects to `/password-reset/confirm`.
- `/auth/callback` must force recovery callbacks to `/password-reset/confirm`, ignoring arbitrary `next` values.
- Authenticated `/settings/account` should include a password setup/change email CTA for the current account email.
- Google users do not reset their Google account password in TALKPIK. Settings copy should explicitly say the action is for the TALKPIK password.
- Magic Link users may set a TALKPIK password; settings copy should say setup/change, not only reset.
- v13 must not infer password credential presence from Supabase identity providers such as `email` or `google`. If the product later needs exact "has password" status, that requires a separate trusted server/admin-owned source.
- Supabase Reset password email template and Redirect URL configuration are owned by the separate `topik-ai` admin/operations surface.

## topik-ai Operational Contract

`topik-ai` should configure the Supabase Reset password template link as:

```html
<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery">Reset password</a>
```

Production Redirect URLs should include the exact Reset password `redirectTo` URL:

```text
https://<production-app-origin>/auth/callback?next=%2Fpassword-reset%2Fconfirm
```

Keep the generic production `/auth/callback` URL for OAuth and other callback flows. `/password-reset/confirm` may remain temporarily allow-listed during rollback or old-email compatibility windows.

## Acceptance Criteria

- `/password-reset` calls `resetPasswordForEmail` with a callback-based `redirectTo`.
- `/password-reset` shows the same neutral sent/check-email state for valid submissions that receive success, unknown-account, rate-limit, or unexpected provider-error responses.
- `/auth/callback?token_hash=...&type=recovery&next=/dashboard` and `/auth/callback?code=...&type=recovery&next=/dashboard` both end at `/password-reset/confirm`.
- `/settings/account` shows a password setup/change CTA only in the authenticated account context.
- Settings CTA sends the reset/setup email directly and does not put the email address in a URL query.
- Settings CTA success, rate-limit, and send-failure feedback uses transient message feedback rather than adding a persistent password-specific Alert under the login-method cards.
- Raw provider errors, tokens, token hashes, and recovery codes are not shown in UI.
- The topik-ai handoff document records template values, Redirect URL values, staging validation, rollback, and security notes.

## Source Notes

- Supabase password reset: https://supabase.com/docs/guides/auth/passwords
- Supabase redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
- Supabase email templates: https://supabase.com/docs/guides/auth/auth-email-templates
- OWASP Forgot Password guidance: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
