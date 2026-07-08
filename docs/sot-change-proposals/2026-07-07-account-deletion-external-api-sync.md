# 2026-07-07 Account Deletion External API Sync Proposal

## Context

User request: when a learner withdraws from `/settings/account`, the app must also delete the learner from the external TalkPik backend database.

Live source checked on 2026-07-07:

- Swagger UI: <https://api.dotoretopik.com/docs>
- OpenAPI JSON: <https://api.dotoretopik.com/openapi.json>
- Endpoint: `DELETE /api/auth/profile`
- Auth: `BearerAuth`
- Request body: none
- Success: `200 Account soft-deleted; email/display name anonymized and current token blacklisted.`
- Failure: `401 Missing or invalid Bearer token.`, `404 Active profile not found for this user.`

## Proposed Acceptance Criteria

1. `/settings/account` still uses the existing type-to-confirm 회원 탈퇴 modal and `POST /auth/account-delete` form route.
2. `POST /auth/account-delete` verifies the request is same-origin before reading session state.
3. The route obtains the current Supabase user and session access token server-side.
4. The route calls external `DELETE /api/auth/profile` with `Authorization: Bearer <access_token>` before local `request_account_deletion`.
5. If external deletion fails, times out, is not configured, or returns a non-2xx status other than `404`, local Supabase deletion does not run and the learner is redirected to `/settings/account?delete=error`.
6. If external deletion succeeds or returns `404 Active profile not found for this user`, the existing local `request_account_deletion` RPC runs, then `signOut({ scope: "global" })`, then redirect to `/login?reason=withdrawn`.
7. The app must not use `DELETE /api/admin/users/{user_id}` for learner self-service deletion.
8. The external deletion request has an app-level timeout. A timeout is treated as failure and must not run local Supabase deletion.
9. Tests must include route-level failure ordering and Playwright browser coverage with a disposable non-production user and local mock external API.

## Notes

- `404 Active profile not found for this user` is treated as an idempotent "already externally deleted" result only for learner self-service deletion. This keeps retry possible when the external API succeeded but the local RPC failed.
- The external API base URL remains `TALKPIK_API_BASE_URL`; no browser-visible env var is introduced.
- Live production external deletion is not exercised in e2e. Browser e2e uses a local mock API for deterministic, non-destructive verification.
