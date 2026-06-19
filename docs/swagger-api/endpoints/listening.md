# Listening API

Source: [Swagger UI](https://api.dotoretopik.com/docs) / [OpenAPI JSON](https://api.dotoretopik.com/openapi.json)
Last synced: 2026-06-19

Scope: Listening sessions, submissions, results, audio, and bookmarks

## Endpoint Index

| Method | Path | Summary | Auth |
| --- | --- | --- | --- |
| GET | [`/api/listening/audio-bank/{filename}`](#get-api-listening-audio-bank-filename) | Stream shared bank audio (signed proxy) | BearerAuth |
| GET | [`/api/listening/audio/{session_id}/{filename}`](#get-api-listening-audio-session-id-filename) | Stream listening problem audio (signed proxy) | BearerAuth |
| POST | [`/api/listening/bookmark/{problem_id}`](#post-api-listening-bookmark-problem-id) | Toggle bookmark on a listening problem | BearerAuth |
| GET | [`/api/listening/history`](#get-api-listening-history) | Get listening submission history | BearerAuth |
| GET | [`/api/listening/question-types`](#get-api-listening-question-types) | List listening question types for a level | BearerAuth |
| POST | [`/api/listening/session`](#post-api-listening-session) | Create a listening session (blocking) | BearerAuth |
| GET | [`/api/listening/session/{session_id}`](#get-api-listening-session-session-id) | Get listening session state | BearerAuth |
| GET | [`/api/listening/session/{session_id}/results`](#get-api-listening-session-session-id-results) | Get listening session results | BearerAuth |
| POST | [`/api/listening/session/{session_id}/submit`](#post-api-listening-session-session-id-submit) | Submit an answer for a listening problem | BearerAuth |
| POST | [`/api/listening/session/stream`](#post-api-listening-session-stream) | Create a listening session (SSE stream) | BearerAuth |

## GET /api/listening/audio-bank/{filename}

Summary: Stream shared bank audio (signed proxy)

Auth: BearerAuth

### Description

Stream shared bank audio (signed proxy) / 공용 뱅크 오디오 스트리밍 (서명 프록시)

**EN:** Serves reusable bank audio (`listening/bank/{bank_id}.mp3`) shared across
users and mock-exam sessions. Authorized via an HMAC `token` over the bank id
(no session scope — bank audio is shared content). Used by mock-exam listening,
which stores questions inline (no `listening_problems` row).

**KR:** 여러 사용자·모의고사 세션이 공유하는 뱅크 오디오를 제공합니다. 세션 범위가
없는 공용 콘텐츠이므로 bank id에 대한 HMAC `token`으로 인가합니다.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `filename` | path | yes | string |  |
| `token` | query | yes | string |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Audio binary stream (audio/mpeg). | `application/json` | - |
| 400 | Invalid bank audio path (bank_id not a valid UUID). | - | - |
| 403 | Invalid bank audio token. | - | - |
| 404 | Bank audio not found in storage. | - | - |
| 422 | Missing required `token` query param. | - | - |

## GET /api/listening/audio/{session_id}/{filename}

Summary: Stream listening problem audio (signed proxy)

Auth: BearerAuth

### Description

Stream listening problem audio (signed proxy) / 듣기 문제 오디오 스트리밍 (서명 프록시)

**EN:** Proxies a problem's audio from internal storage (SeaweedFS) to the browser
and returns an `audio/mpeg` binary. Authorization is via an HMAC-signed `token`
query param (since `<audio src>` cannot send an `Authorization` header). The FE
must use the full `audio_url` returned on each session problem — it already embeds
the correct `session_id`, `filename` (`{problem_id}.mp3`), and `token`; do not build
this URL by hand. `session_id` and the filename's UUID are validated to prevent
path traversal.

**KR:** 내부 스토리지(SeaweedFS)의 문제 오디오를 브라우저로 프록시하여 `audio/mpeg`
바이너리를 반환합니다. `<audio src>`는 `Authorization` 헤더를 보낼 수 없으므로
HMAC 서명 `token` 쿼리 파라미터로 인가합니다. FE는 각 세션 문제의 `audio_url`을
그대로 사용해야 합니다(올바른 `session_id`·`filename`·`token` 포함). 경로 조작 방지를
위해 UUID 형식을 검증합니다.

**Errors / 오류:** 400 invalid path; 403 bad/expired token; 404 file missing; 422 token 누락.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `session_id` | path | yes | string |  |
| `filename` | path | yes | string |  |
| `token` | query | yes | string |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Audio binary stream (audio/mpeg). | `application/json` | - |
| 400 | Invalid audio path (session_id/filename not a valid UUID). | - | - |
| 403 | Invalid or expired audio token. | - | - |
| 404 | Audio file not found in storage. | - | - |
| 422 | Missing required `token` query param. | - | - |

## POST /api/listening/bookmark/{problem_id}

Summary: Toggle bookmark on a listening problem

Auth: BearerAuth

### Description

Toggle bookmark on a listening problem / 듣기 문제 북마크 토글

**EN:** Flips the bookmark state for the given problem for the current user and
returns the resulting `is_bookmarked` value.

**KR:** 현재 사용자에 대해 해당 문제의 북마크 상태를 전환하고 결과
`is_bookmarked` 값을 반환합니다.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `problem_id` | path | yes | string |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Bookmark toggled; returns the new state. | `application/json` | [ListeningBookmarkResponse](../schemas/listening.md#listeningbookmarkresponse) |
| 401 | Missing or invalid JWT. | - | - |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |

Response 200 example:

```json
{
  "problem_id": "22222222-2222-2222-2222-222222222222",
  "is_bookmarked": true
}
```

## GET /api/listening/history

Summary: Get listening submission history

Auth: BearerAuth

### Description

Get listening submission history / 듣기 제출 이력 조회

**EN:** Returns a paginated list of the current user's listening submissions.
Optionally filter by question type, correctness, or TOPIK level.

**KR:** 현재 사용자의 듣기 제출 목록을 페이지네이션으로 반환합니다.
문제 유형, 정오답, TOPIK 레벨로 선택 필터링할 수 있습니다.

**Query params / 쿼리 파라미터:**
- `limit` (1-100, default 20), `offset` (>=0, default 0)
- `question_type`, `is_correct`, `level` — optional filters

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `limit` | query | no | integer |  |
| `offset` | query | no | integer |  |
| `question_type` | query | no | string | Filter by question type |
| `is_correct` | query | no | boolean | Filter by correctness |
| `level` | query | no | string | Filter by TOPIK level |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Paginated submission history matching the filters. | `application/json` | [ListeningHistoryResponse](../schemas/listening.md#listeninghistoryresponse) |
| 401 | Missing or invalid JWT. | - | - |
| 422 | Invalid query params (e.g. limit out of 1-100, negative offset). | - | - |

## GET /api/listening/question-types

Summary: List listening question types for a level

Auth: BearerAuth

### Description

List listening question types for a level / 레벨별 듣기 문제 유형 조회

**EN:** Returns the listening question types available for the given TOPIK level
(1-6). The FE uses this to populate session-creation options.

**KR:** 주어진 TOPIK 레벨(1-6)에서 사용 가능한 듣기 문제 유형을 반환합니다.
세션 생성 옵션을 구성할 때 사용합니다.

**Query param / 쿼리 파라미터:** `level` (1-6, default 4)

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `level` | query | no | integer | TOPIK level 1-6 |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Available question types for the requested TOPIK level. | `application/json` | - |
| 401 | Missing or invalid JWT. | - | - |
| 422 | Invalid query param (level outside 1-6). | - | - |

## POST /api/listening/session

Summary: Create a listening session (blocking)

Auth: BearerAuth

### Description

Create a listening session (blocking) / 듣기 세션 생성 (동기)

**EN:** Generates all problems via AI (with optional TTS audio) and returns the
full session in one response. For a long generation use the SSE variant
`POST /session/stream` instead. Each problem's `audio_url` is a signed proxy
path the FE feeds to `GET /audio/{session_id}/{filename}`.

**KR:** AI로 모든 문제를 생성(필요 시 TTS 오디오 포함)하고 세션 전체를 한 번에
반환합니다. 생성이 오래 걸리면 SSE 버전 `POST /session/stream`을 사용하세요.
각 문제의 `audio_url`은 `GET /audio/{session_id}/{filename}`로 재생할 서명된 경로입니다.

**Rate limit / 속도 제한:** 5 requests/minute

### Request Body

Media type: `application/json`

Schema: [ListeningSessionCreateRequest](../schemas/listening.md#listeningsessioncreaterequest)

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Session created with all problems generated. | `application/json` | [ListeningSessionResponse](../schemas/listening.md#listeningsessionresponse) |
| 400 | Invalid request body (validation error). | - | - |
| 401 | Missing or invalid JWT. | - | - |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |
| 429 | Rate limit exceeded (5 requests/minute). | - | - |

Response 200 example:

```json
{
  "id": "11111111-1111-1111-1111-111111111111",
  "config": {
    "target_level": 3,
    "question_types": [
      "main_idea"
    ],
    "question_count": 5
  },
  "problems": [
    {
      "id": "22222222-2222-2222-2222-222222222222",
      "question_type": "main_idea",
      "difficulty": "medium",
      "level": 3,
      "audio_url": "/api/listening/audio/11111111-.../22222222-....mp3?token=...",
      "audio_duration_seconds": 18.4,
      "question": "들은 내용으로 알맞은 것을 고르십시오.",
      "choices": [
        {
          "number": 1,
          "text": "..."
        }
      ],
      "created_at": "2024-11-15T09:30:00"
    }
  ],
  "current_index": 0,
  "total_questions": 5,
  "status": "in_progress",
  "started_at": "2024-11-15T09:30:00"
}
```

## GET /api/listening/session/{session_id}

Summary: Get listening session state

Auth: BearerAuth

### Description

Get listening session state / 듣기 세션 상태 조회

**EN:** Returns the current state of a session (config, problems, progress, status)
for the authenticated owner. Used by the FE to resume an in-progress session.

**KR:** 인증된 소유자의 세션 현재 상태(설정, 문제, 진행도, 상태)를 반환합니다.
진행 중인 세션을 이어서 풀 때 사용합니다.

**Errors / 오류:** 404 if the session does not exist; 401 if it belongs to another user.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `session_id` | path | yes | string |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Current session state with its problems. | `application/json` | [ListeningSessionResponse](../schemas/listening.md#listeningsessionresponse) |
| 401 | Missing/invalid JWT, or session not owned by the caller. | - | - |
| 404 | Session not found. | - | - |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |

## GET /api/listening/session/{session_id}/results

Summary: Get listening session results

Auth: BearerAuth

### Description

Get listening session results / 듣기 세션 결과 조회

**EN:** Returns every submission for the session plus an aggregate summary
(score, accuracy, counts). Used by the FE results screen after a session ends.

**KR:** 세션의 모든 제출과 집계 요약(점수, 정답률, 개수)을 반환합니다.
세션 종료 후 결과 화면에서 사용합니다.

**Errors / 오류:** 401 if the session belongs to another user.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `session_id` | path | yes | string |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | All submissions plus an aggregate summary for the session. | `application/json` | [ListeningSessionResultsResponse](../schemas/listening.md#listeningsessionresultsresponse) |
| 401 | Missing/invalid JWT, or session not owned by the caller. | - | - |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |

## POST /api/listening/session/{session_id}/submit

Summary: Submit an answer for a listening problem

Auth: BearerAuth

### Description

Submit an answer for a listening problem / 듣기 문제 정답 제출

**EN:** Grades the answer for one problem in the session (by `question_index`) and
returns correctness, the correct answer, explanation, wrong-answer analysis, the
audio script, per-choice status, related vocabulary, and XP earned.

**KR:** 세션 내 한 문제(`question_index` 기준)의 정답을 채점하고 정오답 여부,
정답, 해설, 오답 분석, 듣기 스크립트, 보기별 상태, 관련 어휘, 획득 XP를 반환합니다.

**Rate limit / 속도 제한:** 30 requests/minute

**Errors / 오류:** 404 session not found; 401 wrong owner; 400 if `question_index` is out of range.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `session_id` | path | yes | string |  |

### Request Body

Media type: `application/json`

Schema: [ListeningSubmitRequest](../schemas/listening.md#listeningsubmitrequest)

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Answer graded; returns correctness, explanation, script, and XP. | `application/json` | [ListeningAnswerResultResponse](../schemas/listening.md#listeninganswerresultresponse) |
| 400 | Invalid request body, or question_index out of range. | - | - |
| 401 | Missing/invalid JWT, or session not owned by the caller. | - | - |
| 404 | Session not found. | - | - |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |
| 429 | Rate limit exceeded (30 requests/minute). | - | - |

## POST /api/listening/session/stream

Summary: Create a listening session (SSE stream)

Auth: BearerAuth

### Description

Create a listening session (SSE stream) / 듣기 세션 생성 (SSE 스트리밍)

**EN:** Creates the session shell, then generates problems one by one, streaming
each as a named SSE event. Connect as `EventSource` / read `text/event-stream`.

Event sequence:
- `meta` — `{session_id, total_questions, status}` (sent once, first)
- `problem` — one per generated problem, WITHOUT audio (`audio_url: null`) so the
  FE can render the question immediately
- `audio` — `{index, problem_id, audio_url, duration_seconds}` follow-up per problem
  once TTS finishes (`audio_url` null if synthesis failed — problem still usable)
- `error` — `{index, message}` if a single problem times out/fails (stream continues)
- `done` — `{session_id, total_generated}` terminal marker that ends the stream

**KR:** 세션 셸을 만든 뒤 문제를 하나씩 생성하며 각 문제를 명명된 SSE 이벤트로
스트리밍합니다. `EventSource`로 연결하거나 `text/event-stream`을 읽으세요.
이벤트 순서: `meta` → 문제별 `problem`(실패 시 `error`) → 종료 마커 `done`.

**Rate limit / 속도 제한:** 5 requests/minute

### Request Body

Media type: `application/json`

Schema: [ListeningSessionCreateRequest](../schemas/listening.md#listeningsessioncreaterequest)

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Server-Sent Events stream (`text/event-stream`). Named events: `meta` (session_id + total_questions, sent first), `problem` (one per generated problem, WITHOUT audio so the FE renders the question immediately), `audio` (follow-up per problem carrying `audio_url` once TTS finishes; `audio_url` may be null on TTS failure), `error` (per-problem generation failure/timeout — stream continues), and `done` (terminal marker with `total_generated`). The `done` event always closes the stream. | `application/json` | - |
| 401 | Missing or invalid JWT. | - | - |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |
| 429 | Rate limit exceeded (5 requests/minute). | - | - |
