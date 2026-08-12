# Admin Users API

Source snapshot: generated from the former TALKPIK external API documentation on 2026-07-07. The original service and documentation routes are no longer available.
Last synced: 2026-06-23

Scope: Admin/user account management; reference only, not v13 user-app scope

Boundary note: this is an external backend reference only. The v13 user-facing app must not add or expand admin UI from this reference.

## Endpoint Index

| Method | Path | Summary | Auth |
| --- | --- | --- | --- |
| GET | [`/api/admin/users`](#get-api-admin-users) | List users (paginated, searchable) | BearerAuth |
| POST | [`/api/admin/users`](#post-api-admin-users) | Create an admin/user account | BearerAuth |
| GET | [`/api/admin/users/{user_id}`](#get-api-admin-users-user-id) | Get one user by id | BearerAuth |
| PATCH | [`/api/admin/users/{user_id}`](#patch-api-admin-users-user-id) | Update a user's name and/or roles | BearerAuth |
| DELETE | [`/api/admin/users/{user_id}`](#delete-api-admin-users-user-id) | Soft-delete a user | BearerAuth |
| POST | [`/api/admin/users/{user_id}/password`](#post-api-admin-users-user-id-password) | Reset a user's password (admin-set) | BearerAuth |

## GET /api/admin/users

Summary: List users (paginated, searchable)

Auth: BearerAuth

### Description

List users newest-first, with optional role filter and substring search.

Soft-deleted users are excluded. **Requires admin** (read-only).

사용자 목록 (역할 필터 + 이메일/이름 검색, 페이지네이션).

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `role` | query | no | string \| null | Filter by role: super_admin \| admin \| student |
| `q` | query | no | string \| null | Search email or display_name (substring, case-insensitive) |
| `limit` | query | no | integer |  |
| `offset` | query | no | integer |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Successful Response | `application/json` | [AdminUserListResponse](../schemas/admin-users.md#adminuserlistresponse) |
| 401 | Missing or invalid JWT | - | - |
| 403 | Caller lacks the required role | - | - |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |

## POST /api/admin/users

Summary: Create an admin/user account

Auth: BearerAuth

### Description

Create a new, immediately-activated account. **Requires super_admin.**

The account is created with `account_source='admin_created'` and the given
roles (default `['admin']`). The action is recorded in `admin_audit_log`.

관리자 계정 생성 (super_admin 전용, 감사 로그 기록).

### Request Body

Media type: `application/json`

Schema: [AdminCreateUserRequest](../schemas/admin-users.md#admincreateuserrequest)

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 201 | Successful Response | `application/json` | [AdminUserResponse](../schemas/admin-users.md#adminuserresponse) |
| 401 | Missing or invalid JWT | - | - |
| 403 | Caller lacks the required role | - | - |
| 409 | Email already registered | - | - |
| 422 | Weak password or invalid role | - | - |

## GET /api/admin/users/{user_id}

Summary: Get one user by id

Auth: BearerAuth

### Description

Fetch a single user's detail. **Requires admin** (read-only).

사용자 상세 조회.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `user_id` | path | yes | string |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Successful Response | `application/json` | [AdminUserResponse](../schemas/admin-users.md#adminuserresponse) |
| 401 | Missing or invalid JWT | - | - |
| 403 | Caller lacks the required role | - | - |
| 404 | User not found | - | - |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |

## PATCH /api/admin/users/{user_id}

Summary: Update a user's name and/or roles

Auth: BearerAuth

### Description

Update `display_name` and/or replace `roles`. **Requires super_admin.**

Guards: you cannot remove your own `super_admin` role, and you cannot remove
the `super_admin` role from the last remaining super_admin. Audited.

이름/역할 수정 (super_admin 전용, 자기 자신·마지막 super_admin 강등 차단).

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `user_id` | path | yes | string |  |

### Request Body

Media type: `application/json`

Schema: [AdminUpdateUserRequest](../schemas/admin-users.md#adminupdateuserrequest)

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Successful Response | `application/json` | [AdminUserResponse](../schemas/admin-users.md#adminuserresponse) |
| 400 | Guard violation (e.g. cannot remove/delete the last super_admin or self) | - | - |
| 401 | Missing or invalid JWT | - | - |
| 403 | Caller lacks the required role | - | - |
| 404 | Target user not found | - | - |
| 422 | Validation error (weak password / invalid role) | - | - |

## DELETE /api/admin/users/{user_id}

Summary: Soft-delete a user

Auth: BearerAuth

### Description

Soft-delete (scrub email/name, clear password, set is_deleted).
**Requires super_admin.** Cannot delete yourself or the last super_admin.

사용자 소프트 삭제 (super_admin 전용, 자기 자신·마지막 super_admin 삭제 차단).

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `user_id` | path | yes | string |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 204 | Successful Response | - | - |
| 400 | Guard violation (e.g. cannot remove/delete the last super_admin or self) | - | - |
| 401 | Missing or invalid JWT | - | - |
| 403 | Caller lacks the required role | - | - |
| 404 | Target user not found | - | - |
| 422 | Validation error (weak password / invalid role) | - | - |

## POST /api/admin/users/{user_id}/password

Summary: Reset a user's password (admin-set)

Auth: BearerAuth

### Description

Set a new password for the target (no current-password needed).
**Requires super_admin.** The secret is never written to the audit log.

비밀번호 재설정 (super_admin 전용, 현재 비번 불필요, 비밀번호는 감사 로그에 미기록).

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `user_id` | path | yes | string |  |

### Request Body

Media type: `application/json`

Schema: [AdminResetPasswordRequest](../schemas/admin-users.md#adminresetpasswordrequest)

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 204 | Successful Response | - | - |
| 400 | Guard violation (e.g. cannot remove/delete the last super_admin or self) | - | - |
| 401 | Missing or invalid JWT | - | - |
| 403 | Caller lacks the required role | - | - |
| 404 | Target user not found | - | - |
| 422 | Validation error (weak password / invalid role) | - | - |
