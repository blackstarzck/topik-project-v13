# Reading API

Source: [Swagger UI](https://api.dotoretopik.com/docs) / [OpenAPI JSON](https://api.dotoretopik.com/openapi.json)
Last synced: 2026-06-23

Scope: Reading generation, submission, sessions, results, and bookmarks

## Endpoint Index

| Method | Path | Summary | Auth |
| --- | --- | --- | --- |
| POST | [`/api/reading/generate`](#post-api-reading-generate) | Generate a reading problem | BearerAuth |
| POST | [`/api/reading/submit`](#post-api-reading-submit) | Submit a reading answer | BearerAuth |
| GET | [`/api/reading/history`](#get-api-reading-history) | Get reading submission history | BearerAuth |
| POST | [`/api/reading/bookmark/{problem_id}`](#post-api-reading-bookmark-problem-id) | Toggle a reading bookmark | BearerAuth |
| POST | [`/api/reading/session/stream`](#post-api-reading-session-stream) | Create a reading session (SSE stream) | BearerAuth |
| GET | [`/api/reading/session/{session_id}`](#get-api-reading-session-session-id) | Get reading session state | BearerAuth |
| POST | [`/api/reading/session/{session_id}/submit`](#post-api-reading-session-session-id-submit) | Submit a session answer | BearerAuth |
| GET | [`/api/reading/session/{session_id}/results`](#get-api-reading-session-session-id-results) | Get reading session results | BearerAuth |
| GET | [`/api/reading/question-types`](#get-api-reading-question-types) | List reading question types | BearerAuth |

## POST /api/reading/generate

Summary: Generate a reading problem

Auth: BearerAuth

### Description

Generate a reading problem / 읽기 문제 생성

**EN:** Uses AI to generate a single reading comprehension problem for the requested
question type, difficulty, and language. Returns the passage, question stem, and
multiple-choice options (the correct answer is not exposed here).

**KR:** 요청한 문제 유형, 난이도, 언어에 맞는 읽기 문제 하나를 AI로 생성합니다.
지문, 질문, 선택지를 반환하며 정답은 포함되지 않습니다.

**Rate limit / 속도 제한:** 10 requests/minute

### Request Body

Media type: `application/json`

Schema: [ReadingGenerateRequest](../schemas/reading.md#readinggeneraterequest)

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | AI-generated reading comprehension problem. | `application/json` | [ReadingProblemResponse](../schemas/reading.md#readingproblemresponse) |
| 401 | Missing or invalid JWT. | - | - |
| 422 | Invalid request body (question_type / difficulty / lang). | - | - |
| 429 | Rate limit exceeded (10 requests/minute). | - | - |
| 502 | AI problem generation failed (LLM unavailable). | - | - |

Response 200 example:

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "question_type": "main_idea",
  "difficulty": "medium",
  "passage": "최근 도시에서는 1인 가구가 빠르게 늘고 있다...",
  "question": "이 글의 중심 내용으로 알맞은 것을 고르십시오.",
  "choices": [
    {
      "number": 1,
      "text": "1인 가구의 증가 원인"
    },
    {
      "number": 2,
      "text": "도시 인구의 감소"
    }
  ],
  "created_at": "2024-11-15T09:30:00"
}
```

## POST /api/reading/submit

Summary: Submit a reading answer

Auth: BearerAuth

### Description

Submit a reading answer / 읽기 답안 제출

**EN:** Grades the user's answer for a standalone reading problem. Send `problem_id`,
the selected `user_answer`, and time spent. Returns whether it was correct, the correct
answer, an explanation, and XP earned.

**KR:** 단일 읽기 문제에 대한 답안을 채점합니다. `problem_id`, 선택한 `user_answer`,
소요 시간을 전송하면 정답 여부·정답·해설·획득 XP를 반환합니다.

### Request Body

Media type: `application/json`

Schema: [ReadingSubmitRequest](../schemas/reading.md#readingsubmitrequest)

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Answer graded; returns correctness, correct answer, explanation and XP. | `application/json` | [ReadingSubmitResponse](../schemas/reading.md#readingsubmitresponse) |
| 401 | Missing or invalid JWT. | - | - |
| 404 | Reading problem not found. | - | - |
| 422 | Invalid request body (problem_id / user_answer). | - | - |

Response 200 example:

```json
{
  "submission_id": "a1b2c3d4-0000-0000-0000-000000000000",
  "problem_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "is_correct": true,
  "user_answer": 2,
  "correct_answer": 2,
  "explanation": "정답은 2번입니다. 본문에서...",
  "xp_earned": 10
}
```

## GET /api/reading/history

Summary: Get reading submission history

Auth: BearerAuth

### Description

Get reading submission history / 읽기 제출 이력 조회

**EN:** Returns a paginated list of the current user's reading submissions, newest first.
Use `limit` (1-100) and `offset` (>= 0) for pagination.

**KR:** 현재 사용자의 읽기 제출 목록을 최신순으로 페이지네이션하여 반환합니다.
`limit`(1-100)과 `offset`(>= 0)으로 페이지를 제어합니다.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `limit` | query | no | integer |  |
| `offset` | query | no | integer |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Paginated reading submission history, newest first. | `application/json` | [ReadingHistoryResponse](../schemas/reading.md#readinghistoryresponse) |
| 401 | Missing or invalid JWT. | - | - |
| 422 | Invalid pagination params (limit 1-100, offset >= 0). | - | - |

Response 200 example:

```json
{
  "user_id": "8b3f1c2d-0000-0000-0000-000000000000",
  "total": 1,
  "items": [
    {
      "submission_id": "sub_9d8c7b6a",
      "problem_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "question_type": "main_idea",
      "user_answer": 2,
      "correct_answer": 2,
      "is_correct": true,
      "time_spent_seconds": 45,
      "submitted_at": "2024-11-15T09:30:00"
    }
  ]
}
```

## POST /api/reading/bookmark/{problem_id}

Summary: Toggle a reading bookmark

Auth: BearerAuth

### Description

Toggle a reading bookmark / 읽기 문제 북마크 토글

**EN:** Flips the bookmark state of a reading problem for the current user and returns
the new state. Pass the problem UUID as the path parameter.

**KR:** 현재 사용자의 읽기 문제 북마크 상태를 전환하고 새 상태를 반환합니다.
경로 파라미터로 문제 UUID를 전달하세요.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `problem_id` | path | yes | string |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | New bookmark state for the problem. | `application/json` | [ReadingBookmarkResponse](../schemas/reading.md#readingbookmarkresponse) |
| 401 | Missing/invalid JWT, or not authorized to bookmark this problem. | - | - |
| 404 | Reading problem not found. | - | - |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |

Response 200 example:

```json
{
  "problem_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "is_bookmarked": true
}
```

## POST /api/reading/session/stream

Summary: Create a reading session (SSE stream)

Auth: BearerAuth

### Description

Create a reading session (SSE) / 읽기 세션 생성 (SSE 스트리밍)

**EN:** Same input as `POST /session`, but streams problems via Server-Sent Events as they
are generated, so the FE can render each problem immediately. Connect as `EventSource` and
listen for `meta`, `problem`, `error`, and the terminal `done` event. Per-problem failures
emit an `error` event without aborting the whole stream.

**KR:** `POST /session`과 입력이 같지만, 생성되는 문제를 Server-Sent Events로 스트리밍하여
FE가 문제를 즉시 렌더링할 수 있습니다. `EventSource`로 연결해 `meta`, `problem`, `error`,
그리고 종료 이벤트 `done`을 수신하세요. 개별 문제 실패는 전체 스트림을 중단하지 않고
`error` 이벤트로 전달됩니다.

**Rate limit / 속도 제한:** 5 requests/minute

### Request Body

Media type: `application/json`

Schema: [ReadingSessionCreateRequest](../schemas/reading.md#readingsessioncreaterequest)

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Server-Sent Events stream (`text/event-stream`). Named events:<br>- `event: meta` — `{session_id, total_questions, status}` sent first.<br>- `event: problem` — one per generated problem: `{index, id, question_type, difficulty, passage, question, choices}`.<br>- `event: error` — `{index, message}` when a single problem fails or times out (stream continues with the next index).<br>- `event: done` — terminal marker: `{session_id, total_generated}`. | `application/json` | - |
| 401 | Missing or invalid JWT. | - | - |
| 422 | Invalid request body (target_level / question_types / question_count). | - | - |
| 429 | Rate limit exceeded (5 requests/minute). | - | - |

## GET /api/reading/session/{session_id}

Summary: Get reading session state

Auth: BearerAuth

### Description

Get reading session state / 읽기 세션 상태 조회

**EN:** Returns the current state of a reading session — its status, problems, the active
question index, and timestamps. Pass the session UUID as the path parameter. Only the
session owner may read it.

**KR:** 읽기 세션의 현재 상태(상태값, 문제, 현재 문제 인덱스, 타임스탬프)를 반환합니다.
경로 파라미터로 세션 UUID를 전달하며 세션 소유자만 조회할 수 있습니다.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `session_id` | path | yes | string |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Current session state including all problems and progress index. | `application/json` | [ReadingSessionResponse](../schemas/reading.md#readingsessionresponse) |
| 401 | Missing/invalid JWT, or not authorized for this session. | - | - |
| 404 | Reading session not found. | - | - |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |

Response 200 example:

```json
{
  "session_id": "9c1e...",
  "status": "in_progress",
  "total_questions": 5,
  "current_index": 2,
  "problems": [
    {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "question_type": "main_idea",
      "difficulty": "medium",
      "passage": "...",
      "question": "...",
      "choices": [
        {
          "number": 1,
          "text": "..."
        }
      ]
    }
  ],
  "started_at": "2024-11-15T09:30:00"
}
```

## POST /api/reading/session/{session_id}/submit

Summary: Submit a session answer

Auth: BearerAuth

### Description

Submit a session answer / 세션 문제 답안 제출

**EN:** Grades the answer for one problem inside a session, identified by `question_index`.
Returns correctness, the correct answer, an explanation, and the updated progress index.
Only the session owner may submit.

**KR:** `question_index`로 지정된 세션 내 문제 하나의 답안을 채점합니다.
정답 여부·정답·해설·갱신된 진행 인덱스를 반환하며 세션 소유자만 제출할 수 있습니다.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `session_id` | path | yes | string |  |

### Request Body

Media type: `application/json`

Schema: [ReadingSessionSubmitRequest](../schemas/reading.md#readingsessionsubmitrequest)

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Answer graded within the session; returns correctness and progress. | `application/json` | [ReadingSessionSubmitResponse](../schemas/reading.md#readingsessionsubmitresponse) |
| 400 | Invalid question_index for this session. | - | - |
| 401 | Missing/invalid JWT, or not authorized for this session. | - | - |
| 404 | Reading session not found. | - | - |
| 422 | Invalid request body (question_index / user_answer). | - | - |

Response 200 example:

```json
{
  "is_correct": true,
  "correct_answer": 3,
  "explanation": "정답은 3번입니다...",
  "xp_earned": 10,
  "session_complete": false,
  "current_index": 3
}
```

## GET /api/reading/session/{session_id}/results

Summary: Get reading session results

Auth: BearerAuth

### Description

Get reading session results / 읽기 세션 결과 조회

**EN:** Returns the final scored summary for a reading session — total questions, correct
count, score, XP, and completion time. Only the session owner may read results.

**KR:** 읽기 세션의 최종 채점 요약(총 문제 수, 정답 수, 점수, XP, 완료 시각)을 반환합니다.
세션 소유자만 결과를 조회할 수 있습니다.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `session_id` | path | yes | string |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Final scored results for the session. | `application/json` | [ReadingSessionResultsResponse](../schemas/reading.md#readingsessionresultsresponse) |
| 401 | Missing/invalid JWT, or not authorized for this session. | - | - |
| 404 | Reading session not found. | - | - |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |

Response 200 example:

```json
{
  "session_id": "9c1e...",
  "status": "completed",
  "total_questions": 5,
  "correct_count": 4,
  "score": 80,
  "per_question": [
    {
      "question_index": 0,
      "is_correct": true,
      "user_answer": 2,
      "correct_answer": 2
    }
  ],
  "started_at": "2024-11-15T09:30:00",
  "completed_at": "2024-11-15T09:45:00"
}
```

## GET /api/reading/question-types

Summary: List reading question types

Auth: BearerAuth

### Description

List reading question types / 읽기 문제 유형 목록

**EN:** Returns the catalogue of reading question types the FE can offer when building a
session — each with its key, Korean label, TOPIK question-number range, and description.

**KR:** 세션 구성 시 FE가 제공할 수 있는 읽기 문제 유형 목록을 반환합니다.
각 항목은 키, 한국어 라벨, TOPIK 문항 번호 범위, 설명을 포함합니다.

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | All supported reading question types with labels and ranges. | `application/json` | array<[ReadingQuestionTypeInfo](../schemas/reading.md#readingquestiontypeinfo)> |
| 401 | Missing or invalid JWT. | - | - |

Response 200 example:

```json
[
  {
    "type": "main_idea",
    "label": "중심 내용 파악",
    "range": "32-34",
    "description": "Identify the main idea of the passage."
  }
]
```
