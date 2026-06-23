# Writing Schemas

Source: [OpenAPI JSON](https://api.dotoretopik.com/openapi.json)
Last synced: 2026-06-23

## Schema Index

| Schema | Type | Description |
| --- | --- | --- |
| [DeleteSubmissionResponse](#deletesubmissionresponse) | object | Result of deleting a writing submission / 작문 제출 삭제 결과. |
| [SaveDraftRequest](#savedraftrequest) | object |  |
| [SaveDraftResponse](#savedraftresponse) | object |  |
| [SubmissionResponse](#submissionresponse) | object | Response acknowledging an accepted writing submission. |
| [TopikWriting51Response](#topikwriting51response) | object | Q51 실용문 빈칸 완성형 (56 keys). |
| [TopikWriting52Response](#topikwriting52response) | object | Q52 문장·문단 완성형 (52 keys). |
| [TopikWriting53Response](#topikwriting53response) | object | Q53 자료 설명형 (53 keys — reference omits scoring_focus). |
| [TopikWriting54Response](#topikwriting54response) | object | Q54 논술·의견 제시형 (51 keys). |
| [TopikWritingQuestionListResponse](#topikwritingquestionlistresponse) | object | Paginated list of TOPIK writing questions (rich §7 metadata, per item type). |
| [WritingChatRequest](#writingchatrequest) | object | Request for chat tutor interaction. |
| [WritingGenerateRequestV2](#writinggeneraterequestv2) | object | v2 generate 요청 — task_type 문자열을 item_number:int 로 교체 (라우트 연결은 Step 8). |
| [WritingHistoryItem](#writinghistoryitem) | object |  |
| [WritingHistoryResponse](#writinghistoryresponse) | object |  |
| [WritingRecommendationItem](#writingrecommendationitem) | object | One row of the guide §7.9 recommendation view — common columns only (no prompt body). |
| [WritingRecommendationListResponse](#writingrecommendationlistresponse) | object | Paginated cross-type list of writing questions (guide §7.9 view, 노출 가능 only). |
| [WritingSubmitRequest](#writingsubmitrequest) | object | Request to submit a writing for evaluation. |

## DeleteSubmissionResponse

Result of deleting a writing submission / 작문 제출 삭제 결과.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `success` | yes | boolean | Whether the deletion succeeded / 삭제 성공 여부 | true |
| `deleted_id` | yes | string | UUID of the deleted submission / 삭제된 제출 UUID | f47ac10b-58cc-4372-a567-0e02b2c3d479 |

## SaveDraftRequest

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `task_type` | yes | string | Task type the draft belongs to / 초안이 속한 문제 유형 (Q51 \| Q53 \| Q54) | Q53 |
| `task_id` | no | string \| null | Optional specific task UUID; a random task of task_type is chosen if omitted / 문제 UUID (생략 시 무작위 선택) | abc123 |
| `text` | yes | string | Current draft essay text to persist / 저장할 작문 초안 텍스트 | 현대 사회에서 스트레스를 관리하는 방법... |
| `time_spent` | no | integer | Seconds the user has spent on this draft so far / 초안에 소요한 시간(초) | 120 |

## SaveDraftResponse

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `submission_id` | yes | string | UUID of the saved draft submission / 저장된 초안 제출 UUID | draft-f47ac10b |
| `saved_at` | yes | string | ISO-8601 timestamp when the draft was saved / 초안 저장 시각 (ISO-8601) | 2024-11-15T09:35:22 |
| `character_count` | yes | integer | Character count of the saved draft text / 저장된 초안 텍스트의 글자 수 | 45 |

## SubmissionResponse

Response acknowledging an accepted writing submission.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `submission_id` | yes | string | Server-generated identifier for the submission; use to poll for feedback. | sub_9d8c7b6a |
| `status` | yes | string | Current processing status, e.g. 'queued', 'processing', 'completed'. | queued |
| `message` | yes | string | Human-readable status message for display to the user. | Submission received and queued for evaluation. |

## TopikWriting51Response

Q51 실용문 빈칸 완성형 (56 keys).

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `question_id` | yes | string |  |  |
| `created_at` | yes | string |  |  |
| `updated_at` | no | string \| null |  |  |
| `schema_version` | yes | string |  |  |
| `source_exam_reference` | no | string \| null |  |  |
| `source_reference` | no | string \| null |  |  |
| `exam_name` | yes | string |  |  |
| `section` | yes | string |  |  |
| `question_type_code` | yes | string |  |  |
| `question_type_name` | yes | string |  |  |
| `target_level` | no | string \| null |  |  |
| `difficulty_level` | no | integer \| null |  |  |
| `topic_main` | yes | string |  |  |
| `topic_detail` | yes | string |  |  |
| `secondary_topic_main` | no | string \| null |  |  |
| `secondary_topic_detail` | no | string \| null |  |  |
| `topic_source` | yes | string |  |  |
| `text_type` | no | string \| null |  |  |
| `speech_act` | no | string \| null |  |  |
| `relation` | no | string \| null |  |  |
| `scenario_type` | yes | string |  |  |
| `situation_summary` | yes | string |  |  |
| `learning_goal_summary` | no | string \| null |  |  |
| `prompt_text` | yes | string |  |  |
| `resolved_text` | no | string \| null |  |  |
| `model_answer` | no | string \| null |  |  |
| `answer_key` | no | object \| null |  |  |
| `review_status` | yes | string |  |  |
| `service_status` | yes | string |  |  |
| `auto_checks_passed` | no | boolean \| null |  |  |
| `review_passed` | no | boolean \| null |  |  |
| `recommendation_keys` | no | array<-> \| null |  |  |
| `avoid_repeat_keys` | no | array<-> \| null |  |  |
| `content_team_memo` | no | string \| null |  |  |
| `item_number` | yes | integer |  |  |
| `blank_count` | no | integer \| null |  |  |
| `text_state` | no | string \| null |  |  |
| `blank_notation_policy` | no | string \| null |  |  |
| `grammar_patterns` | no | array<-> \| null |  |  |
| `blank_1_position` | no | string \| null |  |  |
| `blank_1_role` | no | string \| null |  |  |
| `blank_1_function` | no | string \| null |  |  |
| `blank_1_answer_type` | no | string \| null |  |  |
| `blank_1_canonical_answer` | no | string \| null |  |  |
| `blank_1_accepted_answers` | no | array<-> \| null |  |  |
| `blank_1_accepted_synonyms` | no | array<-> \| null |  |  |
| `blank_1_target_note` | no | string \| null |  |  |
| `blank_2_position` | no | string \| null |  |  |
| `blank_2_role` | no | string \| null |  |  |
| `blank_2_function` | no | string \| null |  |  |
| `blank_2_answer_type` | no | string \| null |  |  |
| `blank_2_canonical_answer` | no | string \| null |  |  |
| `blank_2_accepted_answers` | no | array<-> \| null |  |  |
| `blank_2_accepted_synonyms` | no | array<-> \| null |  |  |
| `blank_2_target_note` | no | string \| null |  |  |
| `validation_result` | no | object \| null |  |  |

## TopikWriting52Response

Q52 문장·문단 완성형 (52 keys).

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `question_id` | yes | string |  |  |
| `created_at` | yes | string |  |  |
| `updated_at` | no | string \| null |  |  |
| `schema_version` | yes | string |  |  |
| `source_exam_reference` | no | string \| null |  |  |
| `source_reference` | no | string \| null |  |  |
| `exam_name` | yes | string |  |  |
| `section` | yes | string |  |  |
| `question_type_code` | yes | string |  |  |
| `question_type_name` | yes | string |  |  |
| `target_level` | no | string \| null |  |  |
| `difficulty_level` | no | integer \| null |  |  |
| `topic_main` | yes | string |  |  |
| `topic_detail` | yes | string |  |  |
| `secondary_topic_main` | no | string \| null |  |  |
| `secondary_topic_detail` | no | string \| null |  |  |
| `topic_source` | yes | string |  |  |
| `text_type` | no | string \| null |  |  |
| `speech_act` | no | string \| null |  |  |
| `relation` | no | string \| null |  |  |
| `scenario_type` | yes | string |  |  |
| `situation_summary` | yes | string |  |  |
| `learning_goal_summary` | no | string \| null |  |  |
| `prompt_text` | yes | string |  |  |
| `resolved_text` | no | string \| null |  |  |
| `model_answer` | no | string \| null |  |  |
| `answer_key` | no | object \| null |  |  |
| `review_status` | yes | string |  |  |
| `service_status` | yes | string |  |  |
| `auto_checks_passed` | no | boolean \| null |  |  |
| `review_passed` | no | boolean \| null |  |  |
| `recommendation_keys` | no | array<-> \| null |  |  |
| `avoid_repeat_keys` | no | array<-> \| null |  |  |
| `content_team_memo` | no | string \| null |  |  |
| `item_number` | yes | integer |  |  |
| `completion_unit` | no | string \| null |  |  |
| `required_sentence_count` | no | integer \| null |  |  |
| `blank_count` | no | integer \| null |  |  |
| `connection_function` | no | string \| null |  |  |
| `clue_before_text` | no | string \| null |  |  |
| `clue_after_text` | no | string \| null |  |  |
| `required_expression_function` | no | string \| null |  |  |
| `sentence_complexity` | no | string \| null |  |  |
| `answer_scope_type` | no | string \| null |  |  |
| `grammar_patterns` | no | array<-> \| null |  |  |
| `paragraph_role` | no | string \| null |  |  |
| `cohesion_focus` | no | string \| null |  |  |
| `blank_1_canonical_answer` | no | string \| null |  |  |
| `blank_1_accepted_answers` | no | array<-> \| null |  |  |
| `blank_2_canonical_answer` | no | string \| null |  |  |
| `blank_2_accepted_answers` | no | array<-> \| null |  |  |
| `scoring_notes` | no | string \| null |  |  |

## TopikWriting53Response

Q53 자료 설명형 (53 keys — reference omits scoring_focus).

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `question_id` | yes | string |  |  |
| `created_at` | yes | string |  |  |
| `updated_at` | no | string \| null |  |  |
| `schema_version` | yes | string |  |  |
| `source_exam_reference` | no | string \| null |  |  |
| `source_reference` | no | string \| null |  |  |
| `exam_name` | yes | string |  |  |
| `section` | yes | string |  |  |
| `question_type_code` | yes | string |  |  |
| `question_type_name` | yes | string |  |  |
| `target_level` | no | string \| null |  |  |
| `difficulty_level` | no | integer \| null |  |  |
| `topic_main` | yes | string |  |  |
| `topic_detail` | yes | string |  |  |
| `secondary_topic_main` | no | string \| null |  |  |
| `secondary_topic_detail` | no | string \| null |  |  |
| `topic_source` | yes | string |  |  |
| `text_type` | no | string \| null |  |  |
| `speech_act` | no | string \| null |  |  |
| `relation` | no | string \| null |  |  |
| `scenario_type` | yes | string |  |  |
| `situation_summary` | yes | string |  |  |
| `learning_goal_summary` | no | string \| null |  |  |
| `prompt_text` | yes | string |  |  |
| `resolved_text` | no | string \| null |  |  |
| `model_answer` | no | string \| null |  |  |
| `answer_key` | no | object \| null |  |  |
| `review_status` | yes | string |  |  |
| `service_status` | yes | string |  |  |
| `auto_checks_passed` | no | boolean \| null |  |  |
| `review_passed` | no | boolean \| null |  |  |
| `recommendation_keys` | no | array<-> \| null |  |  |
| `avoid_repeat_keys` | no | array<-> \| null |  |  |
| `content_team_memo` | no | string \| null |  |  |
| `item_number` | yes | integer |  |  |
| `data_type` | no | string \| null |  |  |
| `data_topic` | no | string \| null |  |  |
| `chart_title` | no | string \| null |  |  |
| `chart_unit` | no | string \| null |  |  |
| `comparison_target_count` | no | integer \| null |  |  |
| `data_series_count` | no | integer \| null |  |  |
| `number_expression_required` | no | boolean \| null |  |  |
| `comparison_type` | no | string \| null |  |  |
| `change_type` | no | string \| null |  |  |
| `key_findings` | no | array<-> \| null |  |  |
| `required_structure` | no | array<-> \| null |  |  |
| `expression_set` | no | array<-> \| null |  |  |
| `word_count_min` | no | integer \| null |  |  |
| `word_count_max` | no | integer \| null |  |  |
| `interpretation_difficulty` | no | string \| null |  |  |
| `prohibited_elements` | no | array<-> \| null |  |  |
| `source_data` | no | object \| null |  |  |
| `data_asset_url` | no | string \| null |  |  |

## TopikWriting54Response

Q54 논술·의견 제시형 (51 keys).

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `question_id` | yes | string |  |  |
| `created_at` | yes | string |  |  |
| `updated_at` | no | string \| null |  |  |
| `schema_version` | yes | string |  |  |
| `source_exam_reference` | no | string \| null |  |  |
| `source_reference` | no | string \| null |  |  |
| `exam_name` | yes | string |  |  |
| `section` | yes | string |  |  |
| `question_type_code` | yes | string |  |  |
| `question_type_name` | yes | string |  |  |
| `target_level` | no | string \| null |  |  |
| `difficulty_level` | no | integer \| null |  |  |
| `topic_main` | yes | string |  |  |
| `topic_detail` | yes | string |  |  |
| `secondary_topic_main` | no | string \| null |  |  |
| `secondary_topic_detail` | no | string \| null |  |  |
| `topic_source` | yes | string |  |  |
| `text_type` | no | string \| null |  |  |
| `speech_act` | no | string \| null |  |  |
| `relation` | no | string \| null |  |  |
| `scenario_type` | yes | string |  |  |
| `situation_summary` | yes | string |  |  |
| `learning_goal_summary` | no | string \| null |  |  |
| `prompt_text` | yes | string |  |  |
| `resolved_text` | no | string \| null |  |  |
| `model_answer` | no | string \| null |  |  |
| `answer_key` | no | object \| null |  |  |
| `review_status` | yes | string |  |  |
| `service_status` | yes | string |  |  |
| `auto_checks_passed` | no | boolean \| null |  |  |
| `review_passed` | no | boolean \| null |  |  |
| `recommendation_keys` | no | array<-> \| null |  |  |
| `avoid_repeat_keys` | no | array<-> \| null |  |  |
| `content_team_memo` | no | string \| null |  |  |
| `item_number` | yes | integer |  |  |
| `essay_type` | no | string \| null |  |  |
| `issue_topic` | no | string \| null |  |  |
| `prompt_questions` | no | array<-> \| null |  |  |
| `stance_requirement` | no | string \| null |  |  |
| `required_structure` | no | array<-> \| null |  |  |
| `required_reason_count` | no | integer \| null |  |  |
| `example_requirement` | no | string \| null |  |  |
| `word_count_min` | no | integer \| null |  |  |
| `word_count_max` | no | integer \| null |  |  |
| `reasoning_pattern` | no | string \| null |  |  |
| `argument_keywords` | no | array<-> \| null |  |  |
| `vocabulary_level` | no | string \| null |  |  |
| `scoring_focus` | no | array<-> \| null |  |  |
| `prohibited_elements` | no | array<-> \| null |  |  |
| `model_outline` | no | object \| null |  |  |
| `rubric` | no | object \| null |  |  |

## TopikWritingQuestionListResponse

Paginated list of TOPIK writing questions (rich §7 metadata, per item type).

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `items` | yes | array<[TopikWriting51Response](./writing.md#topikwriting51response) \| [TopikWriting52Response](./writing.md#topikwriting52response) \| [TopikWriting53Response](./writing.md#topikwriting53response) \| [TopikWriting54Response](./writing.md#topikwriting54response)> | Questions of the requested item type; each item is the §7 discriminated union shape (keyed by item_number). |  |
| `total` | yes | integer | Total questions matching the filters, ignoring pagination. | 62 |
| `limit` | yes | integer | Page size applied. | 10 |
| `offset` | yes | integer | Offset applied. | 0 |

## WritingChatRequest

Request for chat tutor interaction.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `user_id` | no | string \| null | Authenticated user identifier; null for anonymous/guest sessions. | user_a1b2c3d4 |
| `task_id` | no | enum(`Q51`, `Q52`, `Q53`, `Q54`) | TOPIK II writing task type the chat is about. One of: Q51, Q52, Q53, Q54. | Q54 |
| `message` | yes | string | Student's chat message to the tutor. | 이 문장을 더 자연스럽게 고치려면 어떻게 해야 하나요? |
| `essay_text` | no | string | Current essay draft the student is working on. | 현대 사회에서 의사소통은 매우 중요하다. ... |
| `previous_draft` | no | string | Previous version of the essay draft, used for diff comparison against essay_text. | 현대 사회에서 의사소통이 중요하다. ... |
| `conversation_history` | no | array<object> | Prior chat turns (max 30). Each item is {role, content}; role must be 'user' or 'assistant'. | [{"content":"이 표현이 맞나요?","role":"user"},{"content":"네, 자연스럽습니다.","role":"assistant"}] |
| `topic` | no | string | Topic of the writing task being discussed. | 의사소통의 중요성 |
| `passage_context` | no | string | Full passage text supplied for additional context (e.g. Q51/Q52 blank-fill prompt). | 다음을 읽고 ㉠과 ㉡에 들어갈 말을 각각 쓰십시오. ... |
| `active_blank` | no | string | Currently active blank label for blank-fill tasks, e.g. 'ㄱ' or 'ㄴ'. | ㄱ |
| `lang` | no | enum(`ko`, `vi`, `en`) | Interface language code. One of: ko, vi, en. | ko |
| `consecutive_wrong` | no | integer | Number of consecutive wrong/stuck attempts by the student (0-10), used to adjust tutor tone. | 2 |

Example:

```json
{
  "active_blank": "",
  "consecutive_wrong": 2,
  "conversation_history": [
    {
      "content": "이 표현이 맞나요?",
      "role": "user"
    },
    {
      "content": "네, 자연스럽습니다.",
      "role": "assistant"
    }
  ],
  "essay_text": "현대 사회에서 의사소통은 매우 중요하다. ...",
  "lang": "ko",
  "message": "이 문장을 더 자연스럽게 고치려면 어떻게 해야 하나요?",
  "passage_context": "",
  "previous_draft": "현대 사회에서 의사소통이 중요하다. ...",
  "task_id": "Q54",
  "topic": "의사소통의 중요성",
  "user_id": "user_a1b2c3d4"
}
```

## WritingGenerateRequestV2

v2 generate 요청 — task_type 문자열을 item_number:int 로 교체 (라우트 연결은 Step 8).

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `item_number` | yes | integer | 문제 번호 / 51~54 | 53 |
| `topic` | no | string \| null | 주제 / topic (server may ignore — topic_main is server-selected) | 환경 보호 |
| `difficulty` | no | enum(`easy`, `medium`, `hard`) | easy\|medium\|hard | medium |
| `context_type` | no | string \| null | Q51 전용 지문 유형 / context type | 안내문 |

## WritingHistoryItem

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `id` | yes | string | Submission UUID / 제출 UUID | f47ac10b-58cc-4372-a567-0e02b2c3d479 |
| `task_type` | yes | string | TOPIK II writing task type / 작문 문제 유형 (Q51 \| Q53 \| Q54) | Q53 |
| `content_preview` | yes | string | Truncated preview of the submitted essay text / 제출한 작문 텍스트 미리보기 | 현대 사회에서 스트레스를 관리하는 방법에는... |
| `total_score` | no | number \| null | Total evaluation score; null while processing or for drafts / 총 평가 점수 (처리 중·초안은 null) | 42.5 |
| `status` | yes | string | Evaluation status / 평가 상태 (processing \| graded \| failed \| draft) | graded |
| `submitted_at` | yes | string | ISO-8601 submission timestamp / 제출 시각 (ISO-8601) | 2024-11-15T09:30:00 |

## WritingHistoryResponse

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `submissions` | yes | array<[WritingHistoryItem](./writing.md#writinghistoryitem)> | Page of submissions, newest first / 제출 목록 (최신순) |  |
| `total` | yes | integer | Total number of submissions matching the filters / 필터에 일치하는 전체 제출 수 | 1 |

## WritingRecommendationItem

One row of the guide §7.9 recommendation view — common columns only (no prompt body).

Maps ``topik_writing_question_recommendation_view``: the cross-type list/filter shape.
Full per-number metadata (prompt_text, essay_type, blanks, …) is served by
GET /api/writing/tasks/{task_type}.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `question_id` | yes | string |  |  |
| `item_number` | yes | integer |  |  |
| `target_level` | no | string \| null |  |  |
| `difficulty_level` | no | integer \| null |  |  |
| `topic_main` | yes | string |  |  |
| `topic_detail` | yes | string |  |  |
| `speech_act` | no | string \| null |  |  |
| `scenario_type` | yes | string |  |  |
| `recommendation_keys` | no | array<-> \| null |  |  |
| `avoid_repeat_keys` | no | array<-> \| null |  |  |
| `review_status` | yes | string |  |  |
| `service_status` | yes | string |  |  |

## WritingRecommendationListResponse

Paginated cross-type list of writing questions (guide §7.9 view, 노출 가능 only).

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `items` | yes | array<[WritingRecommendationItem](./writing.md#writingrecommendationitem)> | Questions across item types 51–54 (common §7.9 columns only). |  |
| `total` | yes | integer | Total questions matching the filters, ignoring pagination. | 128 |
| `limit` | yes | integer | Page size applied. | 10 |
| `offset` | yes | integer | Offset applied. | 0 |

## WritingSubmitRequest

Request to submit a writing for evaluation.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `user_id` | no | string \| null | Authenticated user identifier; null for anonymous/guest submissions. | user_a1b2c3d4 |
| `question_id` | no | string \| null | Rich §7 question being answered, as returned by GET /api/writing/tasks (e.g. 'topik-writing-54-0001'). Scoring uses this exact question's prompt, model answer, and rubric. Null for an ad-hoc submission (a random question of task_type is used). | topik-writing-54-0001 |
| `task_type` | yes | enum(`Q51`, `Q52`, `Q53`, `Q54`) | TOPIK II writing task type. One of: Q51, Q52 (short blank-fill), Q53 (~300-char paragraph), Q54 (600-700 char essay). | Q54 |
| `text` | yes | string | Student's writing content. Minimum length depends on task_type (Q51/Q52: 5, Q53: 20, Q54: 100 chars). | 현대 사회에서 의사소통의 중요성은 점점 더 커지고 있다. 사람들은 다양한 매체를 통해 서로의 생각을 나누며 관계를 형성한다. 그러나 정보가 넘쳐나는 환경에서는 정확하고 진실한 소통이 더욱 어려워지기도 한다. 따라서 우리는 상대를 존중하는 태도로 경청하고 명확하게 표현하는 능력을 길러야 한다. |
| `lang` | no | string | User interface language code. One of: ko, en, vi. | ko |
| `passage_context` | no | string | Q51/Q52 only: original passage with ㉠/㉡ blanks. Sent from frontend if not stored in DB; empty otherwise. | 다음을 읽고 ㉠과 ㉡에 들어갈 말을 각각 쓰십시오. ... |

Example:

```json
{
  "lang": "ko",
  "passage_context": "",
  "question_id": "topik-writing-54-0001",
  "task_type": "Q54",
  "text": "현대 사회에서 의사소통의 중요성은 점점 더 커지고 있다. 사람들은 다양한 매체를 통해 서로의 생각을 나누며 관계를 형성한다. 그러나 정보가 넘쳐나는 환경에서는 정확하고 진실한 소통이 더욱 어려워지기도 한다. 따라서 우리는 상대를 존중하는 태도로 경청하고 명확하게 표현하는 능력을 길러야 한다.",
  "user_id": "user_a1b2c3d4"
}
```

### v13 Submit Notes

The live schema requires only `task_type` and `text`. `task_id` is not part of the current OpenAPI component. Use optional `question_id` only for an external rich question id returned by `GET /api/writing/tasks`.

```json
{
  "task_type": "Q54",
  "question_id": "topik-writing-54-0001",
  "text": "student answer...",
  "user_id": "112a6b57-9564-4990-8bf3-6b536d622008"
}
```
