# Listening Schemas

Source: [OpenAPI JSON](https://api.dotoretopik.com/openapi.json)
Last synced: 2026-06-23

## Schema Index

| Schema | Type | Description |
| --- | --- | --- |
| [ListeningAnswerResultResponse](#listeninganswerresultresponse) | object | Response after submitting an answer. |
| [ListeningBookmarkResponse](#listeningbookmarkresponse) | object | Response for POST /api/listening/bookmark. |
| [ListeningChoiceDTO](#listeningchoicedto) | object | Single multiple-choice option. |
| [ListeningChoiceWithStatusDTO](#listeningchoicewithstatusdto) | object | Choice with correctness status (shown after submission). |
| [ListeningHistoryItem](#listeninghistoryitem) | object | Single item in a user's listening history. |
| [ListeningHistoryResponse](#listeninghistoryresponse) | object | Response for GET /api/listening/history. |
| [ListeningProblemDTO](#listeningproblemdto) | object | Generated listening problem (answer hidden until submission). |
| [ListeningQuestionTypeDTO](#listeningquestiontypedto) | object | Question type metadata for GET /api/listening/question-types. |
| [ListeningScriptDTO](#listeningscriptdto) | object | Full listening script (shown after answer submission). |
| [ListeningScriptLineDTO](#listeningscriptlinedto) | object | Single line of a listening script (dialogue/narration). |
| [ListeningSessionCreateRequest](#listeningsessioncreaterequest) | object | Request body for POST /api/listening/session. |
| [ListeningSessionResponse](#listeningsessionresponse) | object | Response for a created/retrieved listening session. |
| [ListeningSessionResultsResponse](#listeningsessionresultsresponse) | object | Response for GET session results. |
| [ListeningSessionSummary](#listeningsessionsummary) | object | Summary statistics for a completed session. |
| [ListeningSubmissionItem](#listeningsubmissionitem) | object | Single submission entry within session results. |
| [ListeningSubmitRequest](#listeningsubmitrequest) | object | Request body for POST /api/listening/session/{session_id}/submit. |
| [ListeningVocabularyItemDTO](#listeningvocabularyitemdto) | object | Vocabulary item extracted from the listening script. |

## ListeningAnswerResultResponse

Response after submitting an answer.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `submission_id` | yes | string | Unique submission identifier (UUID). | a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d |
| `problem_id` | yes | string | Identifier of the answered problem. | 3f9a7c2e-1b4d-4a6e-9c8f-2d1e0b5a6c7d |
| `question_index` | yes | integer | 0-based index of the answered question within the session. | 0 |
| `user_answer` | yes | integer | Choice number the user selected (1-4). | 2 |
| `correct_answer` | yes | integer | Correct choice number (1-4). | 2 |
| `is_correct` | yes | boolean | True if the user's answer matches the correct answer. | true |
| `explanation` | yes | string | Explanation of why the correct answer is correct, in the session language. | 남자가 '오후 세 시'라고 말했습니다. |
| `wrong_analysis` | no | string | Analysis of common wrong choices; empty if the answer was correct or none provided. | 1번은 약속 시간이 아니라 현재 시간을 가리킵니다. |
| `script` | no | [ListeningScriptDTO](./listening.md#listeningscriptdto) \| null | Full listening script revealed after submission; null if unavailable. | {"context":"","lines":[{"speaker":"male","speaker_label":"남자","text":"회의는 몇 시예요?"}]} |
| `choices_with_status` | no | array<[ListeningChoiceWithStatusDTO](./listening.md#listeningchoicewithstatusdto)> | All choices annotated with correctness and selection status for UI highlighting. | [{"is_correct":true,"is_user_selected":true,"number":2,"status":"correct","text":"오후 세 시"}] |
| `related_vocabulary` | no | array<[ListeningVocabularyItemDTO](./listening.md#listeningvocabularyitemdto)> | Vocabulary items from the script to help the user review. | [{"definition":"여러 사람이 모여 의논함.","reading":"회의","word":"회의"}] |
| `xp_earned` | no | integer | Experience points awarded for this submission. | 10 |

## ListeningBookmarkResponse

Response for POST /api/listening/bookmark.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `problem_id` | yes | string | Identifier of the bookmarked problem. | 3f9a7c2e-1b4d-4a6e-9c8f-2d1e0b5a6c7d |
| `is_bookmarked` | yes | boolean | True if the problem is now bookmarked, false if it was un-bookmarked. | true |

## ListeningChoiceDTO

Single multiple-choice option.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `number` | yes | integer | Choice number (1-4). | 1 |
| `text` | yes | string | Choice text shown to the user, in Korean. | 오후 세 시 |

## ListeningChoiceWithStatusDTO

Choice with correctness status (shown after submission).

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `number` | yes | integer | Choice number (1-4). | 2 |
| `text` | yes | string | Choice text shown to the user, in Korean. | 오후 세 시 |
| `is_correct` | no | boolean | True if this choice is the correct answer. | true |
| `is_user_selected` | no | boolean | True if the user selected this choice. | true |
| `status` | no | string | Display status for the choice. One of: 'correct', 'wrong', 'neutral'. | correct |

## ListeningHistoryItem

Single item in a user's listening history.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `submission_id` | yes | string | Unique submission identifier (UUID). | a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d |
| `session_id` | yes | string | Identifier of the session this submission belongs to. | 8c1e0b5a-6c7d-4a6e-9c8f-2d1e0b5a6c7d |
| `problem_id` | yes | string | Identifier of the answered problem. | 3f9a7c2e-1b4d-4a6e-9c8f-2d1e0b5a6c7d |
| `question_type` | yes | string | Question type. One of: 'dialogue', 'discourse', 'chart_graph', 'content_match', 'main_idea', 'comprehensive'. | dialogue |
| `level` | yes | integer | TOPIK level of the problem (1-6). | 4 |
| `user_answer` | yes | integer | Choice number the user selected (1-4). | 2 |
| `correct_answer` | yes | integer | Correct choice number (1-4). | 2 |
| `is_correct` | yes | boolean | True if the user's answer was correct. | true |
| `time_spent_seconds` | yes | integer | Seconds spent on this question. | 45 |
| `audio_play_count` | yes | integer | Number of times the audio was played for this question. | 2 |
| `submitted_at` | yes | string | ISO 8601 timestamp when the answer was submitted. | 2026-06-08T09:31:00Z |

## ListeningHistoryResponse

Response for GET /api/listening/history.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `user_id` | yes | string | Identifier of the user whose history is returned. | user_a1b2c3d4 |
| `total` | yes | integer | Total number of history items matching the query (across all pages). | 42 |
| `items` | no | array<[ListeningHistoryItem](./listening.md#listeninghistoryitem)> | History items in the current page. | [{"audio_play_count":2,"correct_answer":2,"is_correct":true,"level":4,"problem_id":"3f9a7c2e-1b4d-4a6e-9c8f-2d1e0b5a6c7d","question_type":"dialogue","session_id":"8c1e0b5a-6c7d-4a6e-9c8f-2d1e0b5a6c7d","submission_id":"a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d","su? |

## ListeningProblemDTO

Generated listening problem (answer hidden until submission).

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `id` | yes | string | Unique problem identifier (UUID). | 3f9a7c2e-1b4d-4a6e-9c8f-2d1e0b5a6c7d |
| `question_type` | yes | string | Question type. One of: 'dialogue', 'discourse', 'chart_graph', 'content_match', 'main_idea', 'comprehensive'. | dialogue |
| `difficulty` | yes | string | Difficulty bucket. One of: 'easy', 'medium', 'hard'. | medium |
| `level` | yes | integer | TOPIK level of the problem (1-6). | 4 |
| `audio_url` | no | string \| null | HMAC-signed proxy URL for the TTS audio clip, shaped '/api/listening/audio/{session_id}/{problem_id}.mp3?token=...'. Null while audio is still generating. | /api/listening/audio/8c1e0b5a-6c7d-4a6e-9c8f-2d1e0b5a6c7d/3f9a7c2e-1b4d-4a6e-9c8f-2d1e0b5a6c7d.mp3?token=ab12cd34 |
| `audio_duration_seconds` | no | integer | Length of the audio clip in seconds; 0 if unknown/not yet generated. | 18 |
| `question` | yes | string | Question text shown to the user, in Korean. | 남자는 몇 시에 회의를 시작합니까? |
| `choices` | yes | array<[ListeningChoiceDTO](./listening.md#listeningchoicedto)> | The four multiple-choice options. | [{"number":1,"text":"오후 두 시"},{"number":2,"text":"오후 세 시"},{"number":3,"text":"오후 네 시"},{"number":4,"text":"오후 다섯 시"}] |
| `created_at` | yes | string | ISO 8601 timestamp when the problem was created. | 2026-06-08T09:30:00Z |

## ListeningQuestionTypeDTO

Question type metadata for GET /api/listening/question-types.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `type` | yes | string | Question type id. One of: 'dialogue', 'discourse', 'chart_graph', 'content_match', 'main_idea', 'comprehensive'. | dialogue |
| `label` | yes | string | Korean display label for the question type. | 대화 듣기 |
| `range` | yes | string | TOPIK question-number range this type covers. | 1-4 |
| `description` | no | string | Short description of the question type; empty if none. | 짧은 대화를 듣고 알맞은 그림이나 답을 고릅니다. |

## ListeningScriptDTO

Full listening script (shown after answer submission).

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `lines` | no | array<[ListeningScriptLineDTO](./listening.md#listeningscriptlinedto)> | Ordered script lines making up the audio. | [{"speaker":"male","speaker_label":"남자","text":"회의는 몇 시예요?"},{"speaker":"female","speaker_label":"여자","text":"오후 세 시예요."}] |
| `context` | no | string | Optional scene/context description for the script; empty if none. | 사무실에서 두 동료가 대화하고 있다. |

## ListeningScriptLineDTO

Single line of a listening script (dialogue/narration).

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `speaker` | yes | string | Speaker role driving the TTS voice. One of: 'male', 'female', 'narrator'. | male |
| `speaker_label` | no | string | Human-readable speaker label shown in the UI, e.g. '남자', '여자', '나레이터'. | 남자 |
| `text` | yes | string | The spoken text content of this line, in Korean. | 안녕하세요. 오늘 회의는 몇 시에 시작합니까? |

## ListeningSessionCreateRequest

Request body for POST /api/listening/session.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `target_level` | no | integer | Target TOPIK level (1-6). Levels 1-2 use TOPIK I question types; 3-6 use TOPIK II. | 4 |
| `question_types` | no | array<string> | Question types to include. Empty list = random mix. Allowed: 'dialogue' (대화 1-4), 'discourse' (담화 5-8), 'chart_graph' (도표/그래프 9-12), 'content_match' (내용 일치 13-16), 'main_idea' (중심 내용 17-20), 'comprehensive' (종합 21-50). | ["dialogue","content_match"] |
| `question_count` | no | integer | Number of problems to generate for the session (1-10). | 3 |
| `lang` | no | string | UI language code for LLM-generated responses. One of: ko, vi, en. | ko |

Example:

```json
{
  "lang": "ko",
  "question_count": 3,
  "question_types": [
    "dialogue",
    "content_match"
  ],
  "target_level": 4
}
```

## ListeningSessionResponse

Response for a created/retrieved listening session.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `id` | yes | string | Unique session identifier (UUID). | 8c1e0b5a-6c7d-4a6e-9c8f-2d1e0b5a6c7d |
| `config` | yes | object | Session configuration echoed back (target_level, question_types, question_count, lang). | {"lang":"ko","question_count":3,"question_types":["dialogue"],"target_level":4} |
| `problems` | yes | array<[ListeningProblemDTO](./listening.md#listeningproblemdto)> | Generated problems for the session (correct answers hidden). | [{"audio_duration_seconds":18,"choices":[{"number":1,"text":"오후 두 시"},{"number":2,"text":"오후 세 시"}],"created_at":"2026-06-08T09:30:00Z","difficulty":"medium","id":"3f9a7c2e-1b4d-4a6e-9c8f-2d1e0b5a6c7d","level":4,"question":"남자는 몇 시에 회의를 시작합니까?","question_type? |
| `current_index` | no | integer | 0-based index of the question the user is currently on. | 0 |
| `total_questions` | yes | integer | Total number of questions in the session. | 3 |
| `status` | yes | string | Session status. One of: 'in_progress', 'completed', 'abandoned'. | in_progress |
| `started_at` | yes | string | ISO 8601 timestamp when the session started. | 2026-06-08T09:30:00Z |
| `ai_audio_notice` | no | string | Disclosure that audio is AI-generated (OpenRAIL-M model). | default: Âm thanh trong bài luyện nghe này được tạo bởi AI, không phải giọng người thật. |

## ListeningSessionResultsResponse

Response for GET session results.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `session_id` | yes | string | Identifier of the session these results belong to. | 8c1e0b5a-6c7d-4a6e-9c8f-2d1e0b5a6c7d |
| `submissions` | no | array<[ListeningSubmissionItem](./listening.md#listeningsubmissionitem)> | All submissions recorded for the session, in order. | [{"audio_play_count":2,"correct_answer":2,"explanation":"","is_correct":true,"problem_id":"3f9a7c2e-1b4d-4a6e-9c8f-2d1e0b5a6c7d","question_type":"dialogue","submission_id":"a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d","submitted_at":"2026-06-08T09:31:00Z","time_spen? |
| `summary` | yes | [ListeningSessionSummary](./listening.md#listeningsessionsummary) | Aggregate statistics for the session. | {"accuracy":0.67,"average_audio_plays":1.5,"correct_count":2,"total_questions":3,"total_time_seconds":135} |

## ListeningSessionSummary

Summary statistics for a completed session.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `total_questions` | no | integer | Total number of questions in the session. | 3 |
| `correct_count` | no | integer | Number of questions answered correctly. | 2 |
| `accuracy` | no | number | Fraction of correct answers (0.0-1.0). | 0.67 |
| `total_time_seconds` | no | integer | Total time spent across all questions, in seconds. | 135 |
| `average_audio_plays` | no | number | Average number of audio plays per question. | 1.5 |

## ListeningSubmissionItem

Single submission entry within session results.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `submission_id` | yes | string | Unique submission identifier (UUID). | a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d |
| `problem_id` | yes | string | Identifier of the answered problem. | 3f9a7c2e-1b4d-4a6e-9c8f-2d1e0b5a6c7d |
| `question_type` | yes | string | Question type. One of: 'dialogue', 'discourse', 'chart_graph', 'content_match', 'main_idea', 'comprehensive'. | dialogue |
| `user_answer` | yes | integer | Choice number the user selected (1-4). | 2 |
| `correct_answer` | yes | integer | Correct choice number (1-4). | 2 |
| `is_correct` | yes | boolean | True if the user's answer was correct. | true |
| `time_spent_seconds` | yes | integer | Seconds spent on this question. | 45 |
| `audio_play_count` | yes | integer | Number of times the audio was played for this question. | 2 |
| `explanation` | no | string | Explanation of the correct answer; empty if none. | 남자가 '오후 세 시'라고 말했습니다. |
| `wrong_analysis` | no | string | Analysis of wrong choices; empty if none. | 1번은 현재 시간을 가리킵니다. |
| `submitted_at` | yes | string | ISO 8601 timestamp when the answer was submitted. | 2026-06-08T09:31:00Z |

## ListeningSubmitRequest

Request body for POST /api/listening/session/{session_id}/submit.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `question_index` | yes | integer | 0-based index of the question being answered within the session. | 0 |
| `user_answer` | yes | integer | Choice number selected by the user (1-4). | 2 |
| `time_spent_seconds` | no | integer | Seconds the user spent on this question before submitting. | 45 |
| `audio_play_count` | no | integer | Number of times the user played the audio clip for this question. | 2 |

Example:

```json
{
  "audio_play_count": 2,
  "question_index": 0,
  "time_spent_seconds": 45,
  "user_answer": 2
}
```

## ListeningVocabularyItemDTO

Vocabulary item extracted from the listening script.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `word` | yes | string | Korean vocabulary word or expression. | 회의 |
| `reading` | no | string | Pronunciation/reading aid for the word; empty if not provided. | 회의 |
| `definition` | no | string | Definition or gloss of the word; empty if not provided. | 여러 사람이 모여 의논함. |
