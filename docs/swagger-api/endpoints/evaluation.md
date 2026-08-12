# Evaluation API

Source snapshot: generated from the former TALKPIK external API documentation on 2026-07-07. The original service and documentation routes are no longer available.
Last synced: 2026-07-07

Scope: Async writing evaluation status, SSE stream, and detailed feedback lookup

## Endpoint Index

| Method | Path | Summary | Auth |
| --- | --- | --- | --- |
| GET | [`/api/evaluation/{submission_id}`](#get-api-evaluation-submission-id) | Poll writing evaluation status | BearerAuth |
| GET | [`/api/evaluation/{submission_id}/feedback`](#get-api-evaluation-submission-id-feedback) | Get detailed writing evaluation feedback | BearerAuth |
| GET | [`/api/evaluation/{submission_id}/stream`](#get-api-evaluation-submission-id-stream) | Stream writing evaluation results (SSE) | BearerAuth |

## v13 Integration Notes

- The 2026-07-07 OpenAPI snapshot registers both evaluation lookup paths. The previous snapshot gap was closed before capture.
- Poll `GET /api/evaluation/{submission_id}` until `status` is `graded`.
- Fetch full scoring details from `GET /api/evaluation/{submission_id}/feedback` after grading completes.
- While grading is still running, the feedback endpoint can return HTTP 202 with `{ "status": "processing" }`.
- `GET /api/evaluation/{submission_id}/stream` is an SSE channel. Test with `curl -N` or a fetch-based SSE client because browser `EventSource` cannot set Authorization headers.

## GET /api/evaluation/{submission_id}

Summary: Poll writing evaluation status

Auth: BearerAuth

### Description

Poll writing evaluation status / 작문 평가 상태 조회

**EN:** Returns the current grading status for a submission created via
`POST /api/writing/submit`. Scoring runs asynchronously on a worker, so
poll this endpoint until `status` becomes `graded`, then fetch the full
result from `GET /api/evaluation/{submission_id}/feedback`.

Status values: `processing` (still grading) | `graded` (done) | `failed`.
Score fields are `null` until grading completes.

**KR:** `POST /api/writing/submit`로 생성한 제출의 채점 상태를 반환합니다.
채점은 워커에서 비동기로 실행되므로 `status`가 `graded`가 될 때까지 폴링한 뒤
`GET /api/evaluation/{submission_id}/feedback`로 전체 결과를 가져오세요.

**DB-first:** checks submission status in PostgreSQL; falls back to the
Arq job info when the row is not yet persisted.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `submission_id` | path | yes | string |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Current evaluation status. Poll until `status` is `graded`. | `application/json` | [EvaluationStatusResponse](../schemas/evaluation.md#evaluationstatusresponse) |
| 401 | Missing or invalid JWT. | - | - |
| 403 | Submission belongs to another user. | - | - |
| 404 | Submission not found. | - | - |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |

Response 200 examples:

processing:

```json
{
  "submission_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "processing"
}
```

graded:

```json
{
  "submission_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "graded",
  "total_score": 48,
  "max_score": 50,
  "processing_time_seconds": 42.1
}
```

## GET /api/evaluation/{submission_id}/feedback

Summary: Get detailed writing evaluation feedback

Auth: BearerAuth

### Description

Get detailed writing evaluation feedback / 작문 평가 상세 피드백 조회

**EN:** Returns the full AI scoring result for a graded submission:
per-trait scores (content / organization / language use), detected errors
with corrections, inline annotations, and an overall summary. Call this
only once `GET /api/evaluation/{submission_id}` reports `graded`. While the
worker is still scoring, this returns **HTTP 202** `{"status": "processing"}`
(a status, not an error) so typed clients get a stable envelope.

**KR:** 채점이 끝난 제출의 전체 AI 결과를 반환합니다: 항목별 점수(내용/구성/
언어사용), 교정이 포함된 오류, 인라인 주석, 종합 요약. 상태 조회가 `graded`가 된
뒤에만 호출하세요. 채점 중이면 **HTTP 202** `{"status": "processing"}`를 반환합니다.

**DB-first:** fetches feedback from PostgreSQL; falls back to the Arq job
result when the row is not yet persisted.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `submission_id` | path | yes | string |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Full AI feedback (only when grading is complete). | `application/json` | [EvaluationFeedbackResponse](../schemas/evaluation.md#evaluationfeedbackresponse) |
| 202 | Still grading — poll again shortly. | `application/json` | - |
| 401 | Missing or invalid JWT. | - | - |
| 403 | Submission belongs to another user. | - | - |
| 404 | Submission not found. | - | - |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |
| 500 | Scoring failed. | - | - |

Response 200 example:

```json
{
  "submission_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "graded",
  "total_score": 48,
  "max_score": 50,
  "processing_time_seconds": 42.1,
  "trait_scores": [
    {
      "trait": "content",
      "trait_korean": "내용",
      "weight": 0.4,
      "score": 9,
      "feedback": "주제를 명확히 다루었고 논리 전개가 일관적입니다.",
      "strengths": [
        "명확한 주제 의식",
        "구체적인 근거"
      ],
      "improvements": [
        "반론에 대한 언급 추가"
      ]
    }
  ],
  "errors": [
    {
      "error_type": "grammar",
      "severity": "minor",
      "original": "사람들이 많이 한다",
      "correction": "사람들이 많이 합니다",
      "explanation": "문어체에서는 격식체 종결어미를 사용합니다."
    }
  ],
  "annotations": [
    {
      "start_offset": 0,
      "end_offset": 12,
      "text": "현대 사회에서",
      "annotation_type": "positive",
      "category": "구성",
      "comment": "도입이 자연스럽습니다.",
      "suggestion": ""
    }
  ],
  "ai_summary": "전반적으로 안정적인 답안입니다. 격식체 사용을 다듬으면 더 좋겠습니다.",
  "degraded": false,
  "degraded_traits": []
}
```

Response 202 example:

```json
{
  "status": "processing"
}
```

## GET /api/evaluation/{submission_id}/stream

Summary: Stream writing evaluation results (SSE)

Auth: BearerAuth

### Description

Streams grading result clusters over Server-Sent Events as the worker finishes them. Events are identified by `event:` name and should be mapped to fixed UI slots rather than arrival order. If grading already completed before connection, the full result set is replayed once and the stream closes.

Consumer notes:

- Use a fetch-based SSE reader or server-side proxy; browser `EventSource` cannot set `Authorization`.
- Test with `curl -N -H "Authorization: Bearer <token>" .../api/evaluation/<id>/stream`.
- Once opened, failures are delivered as an in-stream `error` event, not a 5xx HTTP response.
- Fall back to `GET /api/evaluation/{submission_id}/feedback` if the stream drops.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `submission_id` | path | yes | string |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Server-Sent Events stream of grading result clusters. | `text/event-stream` | - |
| 401 | Missing or invalid JWT. | - | - |
| 403 | Submission belongs to another user, delivered in-stream as `error`. | - | - |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |
