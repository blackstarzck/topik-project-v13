# topik-ai Handoff: Reset Password Email Template

Owner boundary: `v13` owns the learner-facing password reset request, auth callback, confirm screen, and account-settings CTA. `topik-ai` owns Supabase Auth email template configuration and Redirect URL operations.

## Required Supabase Settings

Reset password subject:

```text
Reset your password
```

Reset password body link contract:

```html
<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery">Reset password</a>
```

Required production Redirect URL allow-list entry for Reset password:

```text
https://<production-app-origin>/auth/callback?next=%2Fpassword-reset%2Fconfirm
```

Also keep the generic callback entry for OAuth and other auth callback flows:

```text
https://<production-app-origin>/auth/callback
```

Recommended non-production entries:

```text
http://localhost:3000/**
https://*-<vercel-team-or-account>.vercel.app/**
```

Temporary compatibility entry:

```text
https://<production-app-origin>/password-reset/confirm
```

Keep the compatibility entry only while old emails or rollback procedures may still need it.

## Expected Link Shape

When a learner requests a password reset in v13, `resetPasswordForEmail` passes:

```text
redirectTo=https://<app-origin>/auth/callback?next=%2Fpassword-reset%2Fconfirm
```

The production Redirect URL allow-list must include that exact `redirectTo` value, including the `next` query string.

With the template above, the email link must land on:

```text
https://<app-origin>/auth/callback?next=%2Fpassword-reset%2Fconfirm&token_hash=<redacted>&type=recovery
```

`v13` then calls Supabase `verifyOtp` from `/auth/callback`, sets the auth cookies, ignores arbitrary recovery `next` values, and redirects the learner to `/password-reset/confirm`.

## Staging Validation

1. In staging, request a reset email from `/password-reset`.
2. Inspect the received email link without publishing token values to logs or chat.
3. Confirm the link path is `/auth/callback`.
4. Confirm query parameters include `next=/password-reset/confirm`, `token_hash=<present>`, and `type=recovery`.
5. Click the link and confirm the browser lands on `/password-reset/confirm`.
6. Submit a new password and confirm success returns the learner to `/login`.
7. Repeat from `/settings/account` using the password setup/change CTA.

## Rollback

If the TokenHash template fails in staging or production:

1. Revert the Reset password template link to Supabase's default `{{ .ConfirmationURL }}` based link.
2. Keep `/password-reset/confirm` in the Redirect URL allow list.
3. Leave v13's `/auth/callback` recovery handling in place; it is defensive and compatible with future TokenHash rollout.
4. Re-test `/password-reset` and `/settings/account` reset requests before closing the incident.

## Security Notes

- Do not expose `token_hash`, recovery codes, access tokens, refresh tokens, or raw provider error descriptions in UI, logs, screenshots, tickets, or handoff comments.
- Public reset screens must not reveal whether an email exists or which provider the account uses.
- Public reset screens should render the same neutral check-email state after valid Supabase reset requests, including unknown-account, rate-limit, and unexpected provider-error responses.
- Google account passwords are not reset by TALKPIK. Settings copy must make clear that the action is for the TALKPIK password.
- Magic Link users can set a TALKPIK password, so use setup/change copy rather than reset-only copy.
- v13 does not infer password credential presence from `getUserIdentities()` provider values. Exact "has password" UX requires a separate trusted server/admin-owned source.

## References

- Supabase password reset: https://supabase.com/docs/guides/auth/passwords
- Supabase email templates: https://supabase.com/docs/guides/auth/auth-email-templates
- Supabase redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
- OWASP Forgot Password Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
