# Writing API

Source: [Swagger UI](https://api.dotoretopik.com/docs) / [OpenAPI JSON](https://api.dotoretopik.com/openapi.json)
Last synced: 2026-06-23

Scope: TOPIK writing submission, generation, history, drafts, and PDF

## Endpoint Index

| Method | Path | Summary | Auth |
| --- | --- | --- | --- |
| GET | [`/api/writing/history`](#get-api-writing-history) | Get writing submission history | BearerAuth |
| POST | [`/api/writing/submit`](#post-api-writing-submit) | Submit writing for AI evaluation | BearerAuth |
| POST | [`/api/writing/generate`](#post-api-writing-generate) | Generate & persist a TOPIK II writing problem (v2) | BearerAuth |
| POST | [`/api/writing/chat`](#post-api-writing-chat) | AI writing chat tutor (SSE stream) | BearerAuth |
| GET | [`/api/writing/tasks`](#get-api-writing-tasks) | List writing questions across types (§7.9 view, 노출 가능 only) | BearerAuth |
| GET | [`/api/writing/tasks/{task_type}`](#get-api-writing-tasks-task-type) | List TOPIK II writing questions of a type (메타데이터 적용) | BearerAuth |
| POST | [`/api/writing/save-draft`](#post-api-writing-save-draft) | Auto-save writing draft | BearerAuth |
| DELETE | [`/api/writing/history/{submission_id}`](#delete-api-writing-history-submission-id) | Delete writing submission | BearerAuth |
| GET | [`/api/writing/feedback/{submission_id}/export-pdf`](#get-api-writing-feedback-submission-id-export-pdf) | Export feedback as PDF | BearerAuth |

## v13 Integration Notes

- `POST /api/writing/submit` is an async API that returns HTTP 202 and `submission_id`.
- The current live schema no longer accepts `task_id` in `WritingSubmitRequest`; do not send the old `task_id` field.
- Required submit fields are `task_type` and `text`.
- `task_type` is the external TOPIK item code enum: `Q51`, `Q52`, `Q53`, or `Q54`.
- `question_id` is optional. When the selected problem came from `GET /api/writing/tasks`, send that external rich question id, such as `topik-writing-54-0001`; otherwise omit it or send `null` for ad-hoc scoring.
- `user_id` is optional in the live schema. Authenticated v13 requests may send the current learner id; guest-style submissions may use `null`.
- `lang` and `passage_context` remain optional in the live component schema.

```json
{
  "task_type": "Q54",
  "question_id": "topik-writing-54-0001",
  "text": "student answer...",
  "user_id": "112a6b57-9564-4990-8bf3-6b536d622008"
}
```

## GET /api/writing/history

Summary: Get writing submission history

Auth: BearerAuth

### Description

Get writing submission history / 작문 제출 이력 조회

**EN:** Returns a paginated list of the current user's writing submissions, sorted
newest-first. Filter by task type, evaluation status, or date range.

**KR:** 현재 사용자의 작문 제출 목록을 최신순으로 반환합니다.
문제 유형, 평가 상태, 날짜 범위로 필터링 가능합니다.

**Filters / 필터:**
- `task_type`: `Q51` | `Q53` | `Q54`
- `status`: `processing` | `graded` | `failed` | `draft`
- `date_from` / `date_to`: `YYYY-MM-DD`

**Example response / 응답 예시:**
```json
{
  "submissions": [
    {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "task_type": "Q53",
      "content_preview": "현대 사회에서 스트레스를 관리하는 방법에는...",
      "total_score": 42.5,
      "status": "graded",
      "submitted_at": "2024-11-15T09:30:00"
    }
  ],
  "total": 1
}
```

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `limit` | query | no | integer |  |
| `offset` | query | no | integer |  |
| `task_type` | query | no | string \| null |  |
| `status` | query | no | string \| null |  |
| `date_from` | query | no | string \| null |  |
| `date_to` | query | no | string \| null |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Paginated submission history, newest first. | `application/json` | [WritingHistoryResponse](../schemas/writing.md#writinghistoryresponse) |
| 401 | Missing or invalid JWT. | - | - |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |

Response 200 example:

```json
{
  "submissions": [
    {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "task_type": "Q53",
      "content_preview": "현대 사회에서 스트레스를 관리하는 방법에는...",
      "total_score": 42.5,
      "status": "graded",
      "submitted_at": "2024-11-15T09:30:00"
    }
  ],
  "total": 1
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
  "question_id": "topik-writing-53-0001",
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

## POST /api/writing/generate

Summary: Generate & persist a TOPIK II writing problem (v2)

Auth: BearerAuth

### Description

Generate a rich-metadata v2 writing problem (Q51/52/53/54), persist it with
review_status='검수 필요', and return the reference-key JSON for the item_number.

topic is server-selected from the 17 fixed 종합주제 (topic_master); the request's
free ``topic`` field is not used. Rate limit: 10 requests/minute.

### Request Body

Media type: `application/json`

Schema: [WritingGenerateRequestV2](../schemas/writing.md#writinggeneraterequestv2)

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Generated rich-metadata problem (review_status='검수 필요'); the body keys match the reference schema for the requested item_number. | `application/json` | [TopikWriting51Response](../schemas/writing.md#topikwriting51response) | [TopikWriting52Response](../schemas/writing.md#topikwriting52response) | [TopikWriting53Response](../schemas/writing.md#topikwriting53response) | [TopikWriting54Response](../schemas/writing.md#topikwriting54response) |
| 401 | Missing or invalid JWT. | - | - |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |
| 429 | Rate limit exceeded (10 requests/minute). | - | - |
| 500 | AI prompt generation failed. | - | - |

Response 200 example:

```json
{
  "question_id": "topik-writing-53-0063",
  "item_number": 53,
  "topic_main": "사회",
  "topic_detail": "경제",
  "prompt_text": "다음 자료를 보고 200~300자로 쓰십시오.",
  "review_status": "검수 필요",
  "service_status": "내부 테스트"
}
```

## POST /api/writing/chat

Summary: AI writing chat tutor (SSE stream)

Auth: BearerAuth

### Description

AI writing chat tutor (SSE) / AI 작문 채팅 튜터 (SSE 스트리밍)

**EN:** Sends a student message to the AI writing tutor and streams the response
via Server-Sent Events. The tutor provides contextual feedback on the student's
draft essay, corrects grammar, suggests improvements, and encourages the learner.

Connect as `EventSource` or read `text/event-stream`. Each chunk is a partial
text token; the stream ends with `data: [DONE]`.

**KR:** 학생 메시지를 AI 작문 튜터에 전송하고 Server-Sent Events로 응답을 스트리밍합니다.
튜터는 초안에 대한 맥락적 피드백 제공, 문법 수정, 개선 제안, 학습자 격려를 수행합니다.

`EventSource`로 연결하거나 `text/event-stream`을 읽으세요. 각 청크는 부분 텍스트이며
스트림은 `data: [DONE]`으로 종료됩니다.

**Rate limit / 속도 제한:** 20 requests/minute

**Request example / 요청 예시:**
```json
{
  "message": "이 문장이 자연스러운가요?",
  "essay_text": "환경 문제를 해결하기 위해서 우리는 노력해야 한다.",
  "task_id": "Q53",
  "topic": "환경 보호",
  "lang": "ko",
  "conversation_history": []
}
```

**SSE stream example / SSE 스트림 예시:**
```
data: 네, 문장이 자연스럽습니다

data: . 다만 더

data:  구체적인 예시를 추가하면

data: [DONE]
```

### Request Body

Media type: `application/json`

Schema: [WritingChatRequest](../schemas/writing.md#writingchatrequest)

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Server-Sent Events stream (`text/event-stream`). Each event is `data: <partial text>` with embedded newlines escaped as `\n`; `: keep-alive` comments are sent periodically; the stream ends with `data: [DONE]`. Errors are delivered in-stream as `data: {"error": "..."}` before `[DONE]`. | `application/json` | - |
| 401 | Missing or invalid JWT. | - | - |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |
| 429 | Rate limit exceeded (20 requests/minute). | - | - |

## GET /api/writing/tasks

Summary: List writing questions across types (§7.9 view, 노출 가능 only)

Auth: BearerAuth

### Description

List writing questions across types / 유형 통합 작문 문제 목록 (§7.9 추천 뷰)

**EN:** Paginated cross-type list of TOPIK II writing questions read from the guide
§7.9 recommendation view (`topik_writing_question_recommendation_view`) — common
columns only (no prompt body). Only `service_status = '노출 가능'` rows are returned.
For the full per-number metadata of one question, use GET /api/writing/tasks/{task_type}.

**KR:** 51~54번을 한 번에 조회하는 추천 뷰 기반 목록입니다(§7.9). 공통 컬럼만 포함하며
`노출 가능` 문제만 반환합니다. 문제 본문·세부 메타데이터는 /api/writing/tasks/{task_type}에서 조회합니다.

**Filters / 필터:** `item_number`(51|52|53|54, optional), `topic_main`, `topic_detail`,
`difficulty_level`(1~6). Invalid `item_number` → 422. Empty result → 200 with `items: []`.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `item_number` | query | no | string \| null | Filter by item type 51\|52\|53\|54 (accepts Q53/task53). |
| `topic_main` | query | no | string \| null | Filter by 종합 주제 (exact match). |
| `topic_detail` | query | no | string \| null | Filter by 세부 주제 (exact match). |
| `difficulty_level` | query | no | integer \| null | Filter by 내부 난이도 1~6. |
| `limit` | query | no | integer | Page size. |
| `offset` | query | no | integer | Pagination offset. |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Paginated cross-type list of serviceable writing questions. | `application/json` | [WritingRecommendationListResponse](../schemas/writing.md#writingrecommendationlistresponse) |
| 401 | Missing or invalid JWT. | - | - |
| 422 | Invalid item_number filter (must be 51\|52\|53\|54). | - | - |

Response 200 example:

```json
{
  "items": [
    {
      "question_id": "topik-writing-54-0001",
      "item_number": 54,
      "target_level": "TOPIK 5급",
      "difficulty_level": 4,
      "topic_main": "교육",
      "topic_detail": "학교 교육",
      "speech_act": "주장",
      "scenario_type": "온라인 수업의 장단점",
      "recommendation_keys": [
        "item:54",
        "essay_type:장단점형"
      ],
      "avoid_repeat_keys": [
        "issue_topic:온라인 수업"
      ],
      "review_status": "검수 완료",
      "service_status": "노출 가능"
    }
  ],
  "total": 128,
  "limit": 10,
  "offset": 0
}
```

## GET /api/writing/tasks/{task_type}

Summary: List TOPIK II writing questions of a type (메타데이터 적용)

Auth: BearerAuth

### Description

List writing questions of a type / 유형별 작문 문제 목록 (메타데이터 적용)

**EN:** Returns a paginated list of TOPIK II writing questions for the given item type
(`51|52|53|54`) from the rich-metadata tables (`topik_writing_5X_questions`). Each item
is shaped by the §7 discriminated union, keyed by `item_number`. No status gating — all
rows are returned. Empty results return `200` with `items: []` (not 404).

**KR:** 지정한 유형(`51|52|53|54`)의 작문 문제를 리치 메타데이터 테이블에서
페이지네이션 리스트로 반환합니다. 각 item은 §7 판별 유니온 구조(`item_number` 기준)이며,
검수/서비스 상태 필터링은 하지 않습니다(전부 반환). 결과가 없으면 `items: []`로 200을 반환합니다.

**Path / 경로 파라미터:** `task_type` = `51` | `52` | `53` | `54` (also accepts `Q53`, `task53`).

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `task_type` | path | yes | string |  |
| `topic_main` | query | no | string \| null | Filter by 종합 주제 (exact match). |
| `topic_detail` | query | no | string \| null | Filter by 세부 주제 (exact match). |
| `difficulty_level` | query | no | integer \| null | Filter by 내부 난이도 1~6. |
| `limit` | query | no | integer | Page size. |
| `offset` | query | no | integer | Pagination offset. |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Paginated list of rich-metadata questions for the item type. | `application/json` | [TopikWritingQuestionListResponse](../schemas/writing.md#topikwritingquestionlistresponse) |
| 401 | Missing or invalid JWT. | - | - |
| 422 | Invalid task_type (must be 51\|52\|53\|54). | - | - |

Response 200 example:

```json
{
  "items": [
    {
      "question_id": "topik-writing-53-0001",
      "item_number": 53,
      "created_at": "2026-03-19T06:29:01.880869Z",
      "updated_at": "2026-03-25T15:00:00Z",
      "schema_version": "1.0",
      "source_exam_reference": "Seed_53[4-3]valid_questions_62items_2026-03-26.json",
      "source_reference": "Seed_53[4-3]…json / source_id:45e8eaea-…",
      "exam_name": "TOPIK",
      "section": "쓰기",
      "question_type_code": "topik_writing_53_type1_dual_cause",
      "question_type_name": "자료 설명형 / 전체·세부 원인 분석",
      "target_level": "TOPIK 4급",
      "difficulty_level": 4,
      "topic_main": "사회",
      "topic_detail": "경제",
      "secondary_topic_main": "일과 직업",
      "secondary_topic_detail": "취업",
      "topic_source": "메신저 전달 항목(국제 통용 한국어 표준 교육과정 적용 연구 참고)",
      "text_type": "설명문/그래프 설명문",
      "speech_act": "설명",
      "relation": "출제자 → 응시자",
      "scenario_type": "청년 창업 비율(전체)과(와) 업종별 비율의 연결",
      "situation_summary": "청년 창업 비율과 업종별 비율 자료를 보고 200~300자 설명문을 작성하는 상황.",
      "learning_goal_summary": "53번 자료 설명형에서 수치와 항목 차이를 읽고 격식체 설명문으로 정리하는 능력.",
      "prompt_text": "다음을 참고하여 200~300자로 글을 쓰시오. … 3) 위의 내용을 정리하여 마무리하시오.",
      "resolved_text": "(정답을 넣어 복원한 전체 글; nullable — 53번은 보통 비어 있음)",
      "model_answer": "중소벤처기업부 조사에 따르면 청년 창업 비율은 2024년 28%에서 …",
      "answer_key": {
        "answer_type": "data_description_essay",
        "grading_basis": "rubric",
        "required_tasks": [
          "'청년 창업 비율(전체)'의 전체적인 경향을 쓰시오.",
          "…"
        ],
        "word_count_min": 200,
        "word_count_max": 300
      },
      "review_status": "검수 완료",
      "service_status": "노출 가능",
      "auto_checks_passed": true,
      "review_passed": true,
      "recommendation_keys": [
        "item:53",
        "data_type:복합 자료",
        "comparison:추세+항목 비교",
        "…"
      ],
      "avoid_repeat_keys": [
        "data_type:복합 자료",
        "chart_title:청년 창업 비율(전체) / 업종별 비율",
        "…"
      ],
      "content_team_memo": "원본 검수값 True → 사용자 요청에 따라 검수 완료로 정규화. …",
      "data_type": "복합 자료",
      "data_topic": "청년 창업 비율(전체)과(와) 업종별 비율의 연결",
      "chart_title": "청년 창업 비율(전체) / 업종별 비율",
      "chart_unit": "%",
      "comparison_target_count": 4,
      "data_series_count": 5,
      "number_expression_required": true,
      "comparison_type": "추세+항목 비교",
      "change_type": "증가/차이/추세",
      "key_findings": [
        "청년 창업 비율은 2024년 28%에서 2026년 45%로 꾸준히 상승하였다.",
        "…"
      ],
      "required_structure": [
        "도입",
        "전개",
        "마무리"
      ],
      "expression_set": [
        "증가하다",
        "감소하다",
        "가장 높다",
        "가장 낮다",
        "차이가 있다",
        "나타나다"
      ],
      "word_count_min": 200,
      "word_count_max": 300,
      "interpretation_difficulty": "복수 비교",
      "prohibited_elements": [
        "개인 의견",
        "과장 해석",
        "자료에 없는 추론"
      ],
      "source_data": {
        "chart_a": {
          "title": "청년 창업 비율(전체)",
          "unit": "%",
          "chart_type": "bar",
          "year_range": [
            2024,
            2025,
            2026
          ],
          "series": [
            {
              "label": "비율",
              "values": [
                28,
                36,
                45
              ]
            }
          ]
        },
        "chart_b": {
          "title": "업종별 비율",
          "unit": "%",
          "chart_type": "donut",
          "series": [
            {
              "label": "콘텐츠",
              "values": [
                39
              ]
            },
            {
              "label": "IT",
              "values": [
                30
              ]
            }
          ]
        },
        "chart_roles": {
          "chart_a_role": "overall_trend",
          "chart_b_role": "group_detail"
        },
        "narrative": {
          "summary_trend": "…",
          "detail_feature": "…",
          "cause_sentence": "…"
        },
        "context_notes": {
          "cause": "정부의 창업 지원 정책 확대",
          "status": "…"
        }
      },
      "data_asset_url": "https://cdn.example.com/topik/53-0001.png"
    }
  ],
  "total": 62,
  "limit": 10,
  "offset": 0
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
  "task_type": "Q53",
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

## GET /api/writing/feedback/{submission_id}/export-pdf

Summary: Export feedback as PDF

Auth: BearerAuth

### Description

Export feedback as PDF / 피드백 PDF 내보내기

**EN:** Generates and downloads a PDF document containing the full AI evaluation
feedback for the specified submission. The PDF includes scores, annotated corrections,
and study recommendations.

**KR:** 지정된 제출에 대한 전체 AI 평가 피드백이 포함된 PDF를 생성하고 다운로드합니다.
PDF에는 점수, 주석이 달린 수정 사항, 학습 권장 사항이 포함됩니다.

**Response:** `application/pdf` — file download `feedback-{submission_id}.pdf`

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `submission_id` | path | yes | string |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | PDF file download (feedback-{submission_id}.pdf). | `application/json` | - |
| 400 | Invalid submission ID format, or feedback not yet available. | - | - |
| 401 | Missing or invalid JWT. | - | - |
| 404 | Submission not found (or not owned by the user). | - | - |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |
