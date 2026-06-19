# Writing API

Source: [Swagger UI](https://api.dotoretopik.com/docs) / [OpenAPI JSON](https://api.dotoretopik.com/openapi.json)
Last synced: 2026-06-19

Scope: TOPIK writing submission, generation, history, drafts, and PDF

## Endpoint Index

| Method | Path | Summary | Auth |
| --- | --- | --- | --- |
| POST | [`/api/writing/chat`](#post-api-writing-chat) | AI writing chat tutor (SSE stream) | BearerAuth |
| GET | [`/api/writing/feedback/{submission_id}/export-pdf`](#get-api-writing-feedback-submission-id-export-pdf) | Export feedback as PDF | BearerAuth |
| POST | [`/api/writing/generate`](#post-api-writing-generate) | Generate & persist a TOPIK II writing problem (v2) | BearerAuth |
| GET | [`/api/writing/history`](#get-api-writing-history) | Get writing submission history | BearerAuth |
| DELETE | [`/api/writing/history/{submission_id}`](#delete-api-writing-history-submission-id) | Delete writing submission | BearerAuth |
| POST | [`/api/writing/save-draft`](#post-api-writing-save-draft) | Auto-save writing draft | BearerAuth |
| POST | [`/api/writing/submit`](#post-api-writing-submit) | Submit writing for AI evaluation | BearerAuth |
| GET | [`/api/writing/tasks`](#get-api-writing-tasks) | List writing tasks | BearerAuth |
| GET | [`/api/writing/tasks/{task_type}`](#get-api-writing-tasks-task-type) | Get a specific writing task (DB or AI fallback) | BearerAuth |

## v13 Integration Notes

- `POST /api/writing/submit` is an async API that returns HTTP 202 and `submission_id`.
- The v13 app does not send the local Supabase `problem_id` UUID as external `task_id`. It sends the same value as `task_type`: `Q51`, `Q52`, `Q53`, or `Q54`.
- The v13 submit payload is `task_type`, `task_id`, `text`, and `user_id`. `user_id` is sent as `current`.
- `lang` and `passage_context` remain optional in the live schema, but the v13 default submit payload does not send them.

```json
{
  "task_type": "Q51",
  "task_id": "Q51",
  "text": "student answer...",
  "user_id": "current"
}
```

## DELETE /api/writing/history/{submission_id}

Summary: Delete writing submission

Auth: BearerAuth

### Description

Delete writing submission / 작문 제출 삭제

**EN:** Permanently deletes a writing submission and its evaluation data from the
user's history. Only the submission owner can delete it.

**KR:** 사용자의 이력에서 작문 제출과 평가 데이터를 영구적으로 삭제합니다.
제출 소유자만 삭제할 수 있습니다.

**Response example / 응답 예시:**
```json
{ "success": true, "deleted_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479" }
```

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `submission_id` | path | yes | string |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Submission deleted. | `application/json` | [DeleteSubmissionResponse](../schemas/writing.md#deletesubmissionresponse) |
| 400 | Invalid submission ID format. | - | - |
| 401 | Missing or invalid JWT. | - | - |
| 404 | Submission not found (or not owned by the user). | - | - |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |

Response 200 example:

```json
{
  "success": true,
  "deleted_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```

## POST /api/writing/save-draft

Summary: Auto-save writing draft

Auth: BearerAuth

### Description

Auto-save writing draft / 작문 초안 자동 저장

**EN:** Saves the current draft text for a writing task. Call periodically (e.g. every 30s)
while the user is typing. Returns the draft ID and character count.

**KR:** 현재 작문 초안 텍스트를 저장합니다. 사용자가 입력하는 동안 주기적으로 호출하세요
(예: 30초마다). 초안 ID와 글자 수를 반환합니다.

**Request example / 요청 예시:**
```json
{
  "task_type": "task53",
  "task_id": "abc123",
  "text": "현대 사회에서 스트레스를 관리하는 방법...",
  "time_spent": 120
}
```

**Response example / 응답 예시:**
```json
{
  "submission_id": "draft-f47ac10b",
  "saved_at": "2024-11-15T09:35:22",
  "character_count": 45
}
```

### Request Body

Media type: `application/json`

Schema: [SaveDraftRequest](../schemas/writing.md#savedraftrequest)

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Draft saved; returns draft ID and character count. | `application/json` | [SaveDraftResponse](../schemas/writing.md#savedraftresponse) |
| 401 | Missing or invalid JWT. | - | - |
| 404 | No active writing task found for the given task_type. | - | - |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |

Response 200 example:

```json
{
  "submission_id": "draft-f47ac10b",
  "saved_at": "2024-11-15T09:35:22",
  "character_count": 45
}
```

## POST /api/writing/submit

Summary: Submit writing for AI evaluation

Auth: BearerAuth

### Description

Submit writing for AI evaluation / 작문 AI 평가 제출

**EN:** Enqueues a TOPIK II essay to the async evaluation pipeline and returns
a `submission_id` immediately (HTTP 202). Poll
`GET /api/evaluation/{submission_id}` until `status` is `graded`.

Supported task types:
- `Q51` — Fill-in-the-blank sentence completion (문장 완성)
- `Q52` — Fill-in-the-blank paragraph completion (단락 완성)
- `Q53` — Short informational essay ~200 chars (정보 에세이)
- `Q54` — Argumentative essay ~700 chars (논증 에세이)

**KR:** TOPIK II 작문을 비동기 평가 파이프라인에 큐에 넣고 즉시 `submission_id`를
반환합니다 (HTTP 202). `GET /api/evaluation/{submission_id}`를 폴링해
`status`가 `graded`가 될 때까지 기다리세요.

**Rate limit / 속도 제한:** 5 requests/minute

**Request example / 요청 예시:**
```json
{
  "task_type": "Q53",
  "task_id": "Q53",
  "text": "현대 사회에서 스트레스를 관리하는 방법에는 여러 가지가 있다. 첫째, 규칙적인 운동은...",
  "user_id": "current"
}
```

**Response example / 응답 예시 (202):**
```json
{
  "submission_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "processing",
  "message": "Writing submitted for evaluation. Poll GET /api/evaluation/{submission_id} for results."
}
```

### Request Body

Media type: `application/json`

Schema: [WritingSubmitRequest](../schemas/writing.md#writingsubmitrequest)

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 202 | Submission accepted and enqueued for async evaluation. | `application/json` | [SubmissionResponse](../schemas/writing.md#submissionresponse) |
| 400 | Invalid request body (validation error). | - | - |
| 401 | Missing or invalid JWT. | - | - |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |
| 429 | Rate limit exceeded (5 requests/minute). | - | - |

Response 202 example:

```json
{
  "submission_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "processing",
  "message": "Writing submitted for evaluation. Poll GET /api/evaluation/{submission_id} for results."
}
```

## GET /api/writing/tasks

Summary: List writing tasks

Auth: BearerAuth

### Description

List writing tasks / 작문 문제 목록 조회

**EN:** Returns a paginated list of available TOPIK II writing tasks stored in the
database. Filter by task type or topic keyword.

**KR:** 데이터베이스에 저장된 TOPIK II 작문 문제 목록을 페이지네이션으로 반환합니다.
문제 유형 또는 주제 키워드로 필터링 가능합니다.

**Example response / 응답 예시:**
```json
{
  "tasks": [
    {
      "id": "abc123",
      "task_type": "task54",
      "topic": "인터넷 중독",
      "difficulty": 5,
      "question": "다음을 참고하여 '인터넷 중독의 원인과 해결 방안'에 대한 글을 쓰십시오.",
      "is_active": true
    }
  ],
  "total": 1
}
```

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `task_type` | query | no | string \| null |  |
| `topic` | query | no | string \| null |  |
| `limit` | query | no | integer |  |
| `offset` | query | no | integer |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Paginated list of available writing tasks. | `application/json` | [WritingTaskListResponse](../schemas/writing.md#writingtasklistresponse) |
| 401 | Missing or invalid JWT. | - | - |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |

Response 200 example:

```json
{
  "tasks": [
    {
      "id": "abc123",
      "task_type": "task54",
      "topic": "인터넷 중독",
      "difficulty": 5,
      "question": "다음을 참고하여 '인터넷 중독의 원인과 해결 방안'에 대한 글을 쓰십시오.",
      "is_active": true
    }
  ],
  "total": 1
}
```

## GET /api/writing/tasks/{task_type}

Summary: Get a specific writing task (DB or AI fallback)

Auth: BearerAuth

### Description

Get a specific writing task / 특정 작문 문제 조회

**EN:** Fetches a writing task by type (and optionally topic/difficulty).
Tries the database first; if no matching task is found, generates one via AI (LLM fallback).

**KR:** 유형(및 선택적으로 주제/난이도)으로 작문 문제를 조회합니다.
데이터베이스를 먼저 확인하고, 적합한 문제가 없으면 AI로 생성합니다 (LLM 폴백).

**Path parameter / 경로 파라미터:**
- `task_type`: `task51` | `task53` | `task54`

**Example response / 응답 예시:**
```json
{
  "id": "abc123",
  "task_type": "task54",
  "topic": "1인 가구 증가",
  "question": "다음을 참고하여 '1인 가구 증가의 원인과 문제점 및 해결 방안'에 대한 글을 쓰십시오.",
  "passage": "최근 우리 사회에서 1인 가구가 빠르게 증가하고 있다...",
  "difficulty": 6
}
```

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `task_type` | path | yes | string |  |
| `topic` | query | no | string \| null |  |
| `difficulty` | query | no | integer \| null |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Writing task from the database, or an AI-generated fallback. | `application/json` | [WritingTaskResponse](../schemas/writing.md#writingtaskresponse) |
| 401 | Missing or invalid JWT. | - | - |
| 404 | No active writing task found for the requested type/filters. | - | - |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |

Response 200 example:

```json
{
  "id": "abc123",
  "task_type": "task54",
  "topic": "1인 가구 증가",
  "question": "다음을 참고하여 '1인 가구 증가의 원인과 문제점 및 해결 방안'에 대한 글을 쓰십시오.",
  "passage": "최근 우리 사회에서 1인 가구가 빠르게 증가하고 있다...",
  "difficulty": 6
}
```
