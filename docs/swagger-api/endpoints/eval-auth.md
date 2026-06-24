# Eval Auth API

Source: [Swagger UI](https://api.dotoretopik.com/docs) / [OpenAPI JSON](https://api.dotoretopik.com/openapi.json)
Last synced: 2026-06-23

Scope: Eval dashboard login

## Endpoint Index

| Method | Path | Summary | Auth |
| --- | --- | --- | --- |
| POST | [`/api/eval/auth/login`](#post-api-eval-auth-login) | Eval dashboard login | none |

## POST /api/eval/auth/login

Summary: Eval dashboard login

Auth: none

### Description

Eval dashboard login / 평가 대시보드 로그인

**EN:** Authenticates with email + password and returns the user's normal JWT,
which carries their real DB roles. Access requires the DB-backed `admin` role
(granted via `scripts/bootstrap_admin.py`); an optional `EVAL_ADMIN_EMAILS`
allowlist further restricts who may sign in. No `admin` role is ever injected.

**KR:** 이메일 + 비밀번호로 인증하고 실제 DB 역할이 담긴 일반 JWT를 반환합니다.
DB의 `admin` 역할(`scripts/bootstrap_admin.py`로 부여)이 필요하며, 선택적
`EVAL_ADMIN_EMAILS` 허용 목록으로 추가 제한할 수 있습니다. `admin` 역할을 임의로 부여하지 않습니다.

**Request example / 요청 예시:**
```json
{ "email": "admin@example.com", "password": "yourpassword" }
```

**Response example / 응답 예시:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "id": "uuid", "email": "admin@example.com", "display_name": "Admin" }
}
```

- `401` — Invalid credentials / 이메일 또는 비밀번호 오류
- `403` — Account not in allowlist / 허용 목록에 없는 계정

### Request Body

Media type: `application/json`

Schema: [LoginRequest](../schemas/eval-auth.md#loginrequest)

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Authenticated. Returns the user's JWT, refresh token, and profile. | `application/json` | [LoginResponse](../schemas/eval-auth.md#loginresponse) |
| 401 | Invalid email or password. | - | - |
| 403 | Account not in EVAL_ADMIN_EMAILS allowlist, or missing the DB `admin` role. | - | - |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |

Response 200 example:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "admin@example.com",
    "display_name": "Admin"
  }
}
```
