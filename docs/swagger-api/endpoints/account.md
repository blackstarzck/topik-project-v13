# Account API

Source: [Swagger UI](https://api.dotoretopik.com/docs) / [OpenAPI JSON](https://api.dotoretopik.com/openapi.json)
Last synced: 2026-07-07

Scope: User account self-service

## Endpoint Index

| Method | Path | Summary | Auth |
| --- | --- | --- | --- |
| DELETE | [`/api/auth/profile`](#delete-api-auth-profile) | Delete (soft-delete) own account | BearerAuth |

## v13 Integration Notes

- This is the external backend profile deletion endpoint for `/settings/account` 회원 탈퇴.
- Call it server-side with the current learner Supabase JWT as `Authorization: Bearer <token>`.
- Request body: none.
- Treat `404 Active profile not found for this user` as a failure for the v13 account-deletion flow unless the API contract changes.
- Do not use `DELETE /api/admin/users/{user_id}` for self-service account deletion; that endpoint is admin-only reference material.

## DELETE /api/auth/profile

Summary: Delete (soft-delete) own account

Auth: BearerAuth

### Description

Soft-delete the authenticated user's own external backend profile. The live OpenAPI says the endpoint marks the caller's profile deleted, anonymizes email/display name/password hash, and blacklists the current access token. Identity comes from the Bearer token; no password confirmation or request body is required.

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Account soft-deleted; email/display name anonymized and current token blacklisted. | `application/json` | - |
| 401 | Missing or invalid Bearer token. | - | - |
| 404 | Active profile not found for this user. | - | - |

Response 200 example:

```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```
