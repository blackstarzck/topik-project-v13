# Reading Schemas

Source: [OpenAPI JSON](https://api.dotoretopik.com/openapi.json)
Last synced: 2026-06-23

## Schema Index

| Schema | Type | Description |
| --- | --- | --- |
| [ReadingBookmarkResponse](#readingbookmarkresponse) | object | Response for POST /api/reading/bookmark. |
| [ReadingChoiceResponse](#readingchoiceresponse) | object | Single choice option. |
| [ReadingGenerateRequest](#readinggeneraterequest) | object | Request body for POST /api/reading/generate. |
| [ReadingHistoryItem](#readinghistoryitem) | object | Single item in reading history. |
| [ReadingHistoryResponse](#readinghistoryresponse) | object | Response for GET /api/reading/history. |
| [ReadingProblemResponse](#readingproblemresponse) | object | Generated reading problem (answer hidden). |
| [ReadingQuestionTypeInfo](#readingquestiontypeinfo) | object | Question type metadata. |
| [ReadingSessionCreateRequest](#readingsessioncreaterequest) | object | Request body for POST /api/reading/session. |
| [ReadingSessionProblemDTO](#readingsessionproblemdto) | object | Problem within a session (answer hidden). |
| [ReadingSessionResponse](#readingsessionresponse) | object | Response for reading session state. |
| [ReadingSessionResultsResponse](#readingsessionresultsresponse) | object | Response for session results. |
| [ReadingSessionSubmitRequest](#readingsessionsubmitrequest) | object | Request body for POST /api/reading/session/{id}/submit. |
| [ReadingSessionSubmitResponse](#readingsessionsubmitresponse) | object | Response after submitting a session answer. |
| [ReadingSubmitRequest](#readingsubmitrequest) | object | Request body for POST /api/reading/submit. |
| [ReadingSubmitResponse](#readingsubmitresponse) | object | Response after submitting an answer. |

## ReadingBookmarkResponse

Response for POST /api/reading/bookmark.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `problem_id` | yes | string | Identifier of the bookmarked problem. | 3f9a1b2c-4d5e-6f70-8a9b-0c1d2e3f4a5b |
| `is_bookmarked` | yes | boolean | Bookmark state after the toggle: true if now bookmarked. | true |

## ReadingChoiceResponse

Single choice option.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `number` | yes | integer | Choice number, 1-4. | 1 |
| `text` | yes | string | Choice display text. | 글쓴이는 도시 생활을 선호한다. |

## ReadingGenerateRequest

Request body for POST /api/reading/generate.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `question_type` | no | string \| null | TOPIK II reading question type. One of: fill_in_blank (31-34), content_match (35-38), ordering (39-41), topic_title (42-43), blank_inference (44-45), main_idea (46-47), long_reading (48-50). Null lets the server pick randomly. | content_match |
| `question_number_range` | no | string \| null | Original TOPIK question-number range for the type, e.g. '31-34', '35-38'. Null if unspecified. | 35-38 |
| `difficulty` | no | string | Problem difficulty. One of: easy, medium, hard. | medium |
| `topik_level` | no | integer \| null | Target TOPIK level, integer 3-6. Null lets the server decide. | 4 |
| `topic` | no | string \| null | Optional subject/theme (Korean) to bias generation, e.g. '사회', '경제', '문화'. Null for any topic. | 사회 |
| `count` | no | integer | Number of problems to generate, 1-10. | 1 |
| `lang` | no | string | UI language for LLM-generated text. One of: ko, en, vi. | ko |

Example:

```json
{
  "count": 1,
  "difficulty": "medium",
  "lang": "ko",
  "question_number_range": "35-38",
  "question_type": "content_match",
  "topic": "사회",
  "topik_level": 4
}
```

## ReadingHistoryItem

Single item in reading history.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `submission_id` | yes | string | Identifier of the submission. | sub_9d8c7b6a |
| `problem_id` | yes | string | Identifier of the answered problem. | 3f9a1b2c-4d5e-6f70-8a9b-0c1d2e3f4a5b |
| `question_type` | yes | string | Reading question type. One of: fill_in_blank, content_match, ordering, topic_title, blank_inference, main_idea, long_reading. | content_match |
| `user_answer` | yes | integer | Choice number the user submitted, 1-4. | 2 |
| `correct_answer` | yes | integer | Correct choice number, 1-4. | 2 |
| `is_correct` | yes | boolean | Whether the submitted answer was correct. | true |
| `time_spent_seconds` | yes | integer | Seconds the user spent on the problem. | 45 |
| `submitted_at` | yes | string | ISO 8601 timestamp when the answer was submitted. | 2026-06-08T09:30:00Z |

## ReadingHistoryResponse

Response for GET /api/reading/history.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `user_id` | yes | string | Identifier of the user whose history this is. | user_a1b2c3d4 |
| `total` | yes | integer | Total number of history items for the user. | 42 |
| `items` | no | array<[ReadingHistoryItem](./reading.md#readinghistoryitem)> | Reading submission history items, newest first. | [{"correct_answer":2,"is_correct":true,"problem_id":"3f9a1b2c-4d5e-6f70-8a9b-0c1d2e3f4a5b","question_type":"content_match","submission_id":"sub_9d8c7b6a","submitted_at":"2026-06-08T09:30:00Z","time_spent_seconds":45,"user_answer":2}] |

## ReadingProblemResponse

Generated reading problem (answer hidden).

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `id` | yes | string | Unique problem identifier. | 3f9a1b2c-4d5e-6f70-8a9b-0c1d2e3f4a5b |
| `question_type` | yes | string | Reading question type. One of: fill_in_blank, content_match, ordering, topic_title, blank_inference, main_idea, long_reading. | content_match |
| `difficulty` | yes | string | Problem difficulty. One of: easy, medium, hard. | medium |
| `passage` | yes | string | Reading passage text the question is based on. | 요즘 도시에서는 자전거를 이용하는 사람들이 늘고 있다. ... |
| `question` | yes | string | Question prompt shown to the student. | 윗글의 내용과 같은 것을 고르십시오. |
| `choices` | yes | array<[ReadingChoiceResponse](./reading.md#readingchoiceresponse)> | Multiple-choice options (typically 4). | [{"number":1,"text":"도시의 자전거 이용자가 줄고 있다."},{"number":2,"text":"도시의 자전거 이용자가 늘고 있다."}] |
| `created_at` | yes | string | ISO 8601 timestamp when the problem was generated. | 2026-06-08T09:30:00Z |

## ReadingQuestionTypeInfo

Question type metadata.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `type` | yes | string | Question type key. One of: fill_in_blank, content_match, ordering, topic_title, blank_inference, main_idea, long_reading. | content_match |
| `label` | yes | string | Human-readable label for the question type. | 내용 일치 |
| `range` | yes | string | Original TOPIK question-number range for this type. | 35-38번 |
| `description` | yes | string | Short description of what the question type tests. | 글의 내용과 일치하는 것을 선택하는 문제 |

## ReadingSessionCreateRequest

Request body for POST /api/reading/session.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `target_level` | no | integer | Target TOPIK level, integer 1-6. | 4 |
| `question_types` | no | array<string> | Question types to include; empty list means random mix. Allowed values: fill_in_blank, content_match, ordering, topic_title, blank_inference, main_idea, long_reading. | ["content_match","main_idea"] |
| `question_count` | no | integer | Number of questions in the session, 1-20. | 5 |
| `lang` | no | string | UI language for LLM-generated text. One of: ko, en, vi. | ko |

Example:

```json
{
  "lang": "ko",
  "question_count": 5,
  "question_types": [
    "content_match",
    "main_idea"
  ],
  "target_level": 4
}
```

## ReadingSessionProblemDTO

Problem within a session (answer hidden).

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `id` | yes | string | Unique problem identifier. | 3f9a1b2c-4d5e-6f70-8a9b-0c1d2e3f4a5b |
| `question_type` | yes | string | Reading question type. One of: fill_in_blank, content_match, ordering, topic_title, blank_inference, main_idea, long_reading. | content_match |
| `difficulty` | yes | string | Problem difficulty. One of: easy, medium, hard. | medium |
| `passage` | yes | string | Reading passage text the question is based on. | 요즘 도시에서는 자전거를 이용하는 사람들이 늘고 있다. ... |
| `question` | yes | string | Question prompt shown to the student. | 윗글의 내용과 같은 것을 고르십시오. |
| `choices` | yes | array<[ReadingChoiceResponse](./reading.md#readingchoiceresponse)> | Multiple-choice options (typically 4). | [{"number":1,"text":"도시의 자전거 이용자가 줄고 있다."},{"number":2,"text":"도시의 자전거 이용자가 늘고 있다."}] |

## ReadingSessionResponse

Response for reading session state.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `session_id` | yes | string | Unique session identifier. | sess_7a6b5c4d |
| `status` | yes | string | Session status. One of: active, completed, abandoned. | active |
| `total_questions` | yes | integer | Total number of questions in the session. | 5 |
| `current_index` | yes | integer | Zero-based index of the next question to answer. | 0 |
| `problems` | yes | array<[ReadingSessionProblemDTO](./reading.md#readingsessionproblemdto)> | Problems in the session (answers hidden). | [{"choices":[{"number":1,"text":"도시의 자전거 이용자가 줄고 있다."},{"number":2,"text":"도시의 자전거 이용자가 늘고 있다."}],"difficulty":"medium","id":"3f9a1b2c-4d5e-6f70-8a9b-0c1d2e3f4a5b","passage":"요즘 도시에서는 자전거를 이용하는 사람들이 늘고 있다. ...","question":"윗글의 내용과 같은 것을 고르십시오.","question_type? |
| `started_at` | yes | string | ISO 8601 timestamp when the session started. | 2026-06-08T09:30:00Z |
| `completed_at` | no | string \| null | ISO 8601 timestamp when the session completed; null while active. | 2026-06-08T09:45:00Z |

## ReadingSessionResultsResponse

Response for session results.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `session_id` | yes | string | Unique session identifier. | sess_7a6b5c4d |
| `status` | yes | string | Session status. One of: active, completed, abandoned. | completed |
| `total_questions` | yes | integer | Total number of questions in the session. | 5 |
| `correct_count` | yes | integer | Number of questions answered correctly. | 4 |
| `score` | yes | number | Session score as a percentage, 0-100. | 80 |
| `per_question` | yes | array<object> | Per-question result breakdown; each item describes one question's outcome. | [{"correct_answer":2,"is_correct":true,"question_index":0,"user_answer":2}] |
| `started_at` | yes | string | ISO 8601 timestamp when the session started. | 2026-06-08T09:30:00Z |
| `completed_at` | no | string \| null | ISO 8601 timestamp when the session completed; null if not finished. | 2026-06-08T09:45:00Z |

## ReadingSessionSubmitRequest

Request body for POST /api/reading/session/{id}/submit.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `question_index` | yes | integer | Zero-based index of the question being answered within the session. | 0 |
| `user_answer` | yes | integer | Selected choice number, 1-4. | 2 |
| `time_spent_seconds` | no | integer | Seconds the user spent on this question. | 45 |

Example:

```json
{
  "question_index": 0,
  "time_spent_seconds": 45,
  "user_answer": 2
}
```

## ReadingSessionSubmitResponse

Response after submitting a session answer.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `is_correct` | yes | boolean | Whether the submitted answer was correct. | true |
| `correct_answer` | yes | integer | Correct choice number, 1-4. | 2 |
| `explanation` | yes | string | Explanation of why the correct answer is correct. | 지문에서 도시의 자전거 이용자가 늘고 있다고 했으므로 2번이 정답입니다. |
| `xp_earned` | no | integer | Experience points awarded for this answer. | 10 |
| `session_complete` | no | boolean | True if this answer was the last one and the session is now complete. | false |
| `current_index` | no | integer | Zero-based index of the next question to answer. | 1 |

## ReadingSubmitRequest

Request body for POST /api/reading/submit.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `problem_id` | yes | string | Identifier of the problem being answered. | 3f9a1b2c-4d5e-6f70-8a9b-0c1d2e3f4a5b |
| `user_answer` | yes | integer | Selected choice number, 1-4. | 2 |
| `time_spent_seconds` | no | integer | Seconds the user spent on the problem. | 45 |

Example:

```json
{
  "problem_id": "3f9a1b2c-4d5e-6f70-8a9b-0c1d2e3f4a5b",
  "time_spent_seconds": 45,
  "user_answer": 2
}
```

## ReadingSubmitResponse

Response after submitting an answer.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `submission_id` | yes | string | Server-generated identifier for this submission. | sub_9d8c7b6a |
| `problem_id` | yes | string | Identifier of the answered problem. | 3f9a1b2c-4d5e-6f70-8a9b-0c1d2e3f4a5b |
| `is_correct` | yes | boolean | Whether the submitted answer was correct. | true |
| `user_answer` | yes | integer | Choice number the user submitted, 1-4. | 2 |
| `correct_answer` | yes | integer | Correct choice number, 1-4. | 2 |
| `explanation` | yes | string | Explanation of why the correct answer is correct. | 지문에서 도시의 자전거 이용자가 늘고 있다고 했으므로 2번이 정답입니다. |
| `xp_earned` | no | integer | Experience points awarded for this submission. | 10 |
