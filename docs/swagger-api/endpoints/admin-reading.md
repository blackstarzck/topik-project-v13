# Admin Reading API

Source snapshot: generated from the former TALKPIK external API documentation on 2026-07-07. The original service and documentation routes are no longer available.
Last synced: 2026-07-07

Scope: Admin reading question-bank operations.

Boundary note: this is an external backend admin reference only. The v13 user-facing app must not add or expand admin UI from this reference.

## Endpoint Index

| Method | Path | Summary | Auth |
| --- | --- | --- | --- |
| GET | [`/api/admin/reading/questions`](#get-api-admin-reading-questions) | List Questions | BearerAuth |
| PUT | [`/api/admin/reading/questions/{question_id}`](#put-api-admin-reading-questions-question-id) | Edit Question | BearerAuth |
| POST | [`/api/admin/reading/questions/{question_id}/review`](#post-api-admin-reading-questions-question-id-review) | Review Question | BearerAuth |

## GET /api/admin/reading/questions

Summary: List Questions

Auth: BearerAuth

Description: List bank items, optionally filtered by `review_status`, ordered by number.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `review_status` | query | no | string \| null | Optional review status filter. |
| `limit` | query | no | integer | Page size, 1-200, default 50. |
| `offset` | query | no | integer | Pagination offset, default 0. |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Successful Response | `application/json` | [ReadingBankListResponse](../schemas/admin-reading.md#readingbanklistresponse) |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |

## PUT /api/admin/reading/questions/{question_id}

Summary: Edit Question

Auth: BearerAuth

Description: Edit an item's content before approval (`prompt_text`, `answer_key`, `content_team_memo`).

### Request Body

Media type: `application/json`

Schema: [EditRequest](../schemas/admin-reading.md#editrequest)

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Successful Response | `application/json` | [ReadingBankItem](../schemas/admin-reading.md#readingbankitem) |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |

## POST /api/admin/reading/questions/{question_id}/review

Summary: Review Question

Auth: BearerAuth

Description: Set an item's review status and optionally service status.

### Request Body

Media type: `application/json`

Schema: [src__api__routes__admin_reading__ReviewRequest](../schemas/admin-reading.md#src-api-routes-admin-reading-reviewrequest)

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Successful Response | `application/json` | [ReadingBankItem](../schemas/admin-reading.md#readingbankitem) |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |
