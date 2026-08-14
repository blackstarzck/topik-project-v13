# Admin Users Schemas

Source snapshot: generated from the former TALKPIK external API documentation on 2026-07-07. The original service and documentation routes are no longer available.
Last synced: 2026-06-23

## Schema Index

| Schema | Type | Description |
| --- | --- | --- |
| [AdminCreateUserRequest](#admincreateuserrequest) | object |  |
| [AdminResetPasswordRequest](#adminresetpasswordrequest) | object |  |
| [AdminUpdateUserRequest](#adminupdateuserrequest) | object |  |
| [AdminUserListResponse](#adminuserlistresponse) | object |  |
| [AdminUserResponse](#adminuserresponse) | object |  |

## AdminCreateUserRequest

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `email` | yes | string | Login email (format-validated); normalized to lowercase. Must be unique. | newadmin@keduall.com |
| `password` | yes | string | Strong password: >=12 chars, upper+lower+digit+special, no whitespace. | Str0ng!Pass#2026 |
| `display_name` | yes | string |  | New Admin |
| `roles` | no | array<string> | Subset of {super_admin, admin, student}. Defaults to ['admin']. | ["admin"] |

Example:

```json
{
  "display_name": "New Admin",
  "email": "newadmin@keduall.com",
  "password": "Str0ng!Pass#2026",
  "roles": [
    "admin"
  ]
}
```

## AdminResetPasswordRequest

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `new_password` | yes | string | Strong password (same policy as create). | N3w!Str0ng#Pass |

## AdminUpdateUserRequest

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `display_name` | no | string \| null |  | Renamed Admin |
| `roles` | no | array<string> \| null | Replacement role list, subset of {super_admin, admin, student}. | ["super_admin","admin"] |

Example:

```json
{
  "display_name": "Renamed Admin",
  "roles": [
    "admin"
  ]
}
```

## AdminUserListResponse

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `items` | yes | array<[AdminUserResponse](./admin-users.md#adminuserresponse)> |  |  |
| `total` | yes | integer | Total matching rows (ignoring pagination). | 3 |
| `limit` | yes | integer |  | 20 |
| `offset` | yes | integer |  | 0 |

## AdminUserResponse

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `id` | yes | string |  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 |
| `email` | yes | string |  | newadmin@keduall.com |
| `display_name` | yes | string |  | New Admin |
| `roles` | yes | array<string> |  | ["admin"] |
| `is_deleted` | yes | boolean |  | false |
| `account_source` | yes | string | 'admin_created' for accounts made via this API. | admin_created |
| `activated_at` | no | string \| null |  | 2026-06-22T08:30:00Z |
| `created_at` | no | string \| null |  | 2026-06-22T08:30:00Z |
| `last_active_at` | no | string \| null |  |  |
