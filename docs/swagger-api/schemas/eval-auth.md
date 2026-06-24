# Eval Auth Schemas

Source: [OpenAPI JSON](https://api.dotoretopik.com/openapi.json)
Last synced: 2026-06-23

## Schema Index

| Schema | Type | Description |
| --- | --- | --- |
| [LoginRequest](#loginrequest) | object |  |
| [LoginResponse](#loginresponse) | object | JWT access/refresh tokens plus the authenticated user's profile. |
| [LoginUser](#loginuser) | object | Authenticated user profile embedded in the login response. |

## LoginRequest

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `email` | yes | string | Account email (must hold the DB `admin` role; subject to the optional EVAL_ADMIN_EMAILS allowlist). | admin@example.com |
| `password` | yes | string | Account password. | yourpassword |

## LoginResponse

JWT access/refresh tokens plus the authenticated user's profile.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `token` | yes | string | JWT access token carrying the user's real DB roles. | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... |
| `refresh_token` | yes | string | JWT refresh token used to obtain a new access token. | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... |
| `user` | yes | [LoginUser](./eval-auth.md#loginuser) | Authenticated user's profile. |  |

## LoginUser

Authenticated user profile embedded in the login response.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `id` | yes | string | User UUID. | uuid |
| `email` | yes | string | User email. | admin@example.com |
| `display_name` | no | string \| null | User display name. | Admin |
| `roles` | no | array<string> | DB-backed roles carried by the JWT (e.g. admin, student). | ["admin"] |
