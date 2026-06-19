# Writing Schemas

Source: [OpenAPI JSON](https://api.dotoretopik.com/openapi.json)
Last synced: 2026-06-19

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
| [WritingChatRequest](#writingchatrequest) | object | Request for chat tutor interaction. |
| [WritingGenerateRequestV2](#writinggeneraterequestv2) | object | v2 generate 요청 — task_type 문자열을 item_number:int 로 교체 (라우트 연결은 Step 8). |
| [WritingHistoryItem](#writinghistoryitem) | object |  |
| [WritingHistoryResponse](#writinghistoryresponse) | object |  |
| [WritingSubmitRequest](#writingsubmitrequest) | object | Request to submit a writing for evaluation. |
| [WritingTaskListItem](#writingtasklistitem) | object | Lightweight writing task item for listing. |
| [WritingTaskListResponse](#writingtasklistresponse) | object | Paginated list of writing tasks. |
| [WritingTaskResponse](#writingtaskresponse) | object | Full writing task returned from DB or LLM for practice. |

## DeleteSubmissionResponse

Result of deleting a writing submission / 작문 제출 삭제 결과.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `success` | yes | boolean | Whether the deletion succeeded / 삭제 성공 여부 | true |
| `deleted_id` | yes | string | UUID of the deleted submission / 삭제된 제출 UUID | f47ac10b-58cc-4372-a567-0e02b2c3d479 |

## SaveDraftRequest

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `task_type` | yes | string | Task type the draft belongs to / 초안이 속한 문제 유형 (task51 \| task53 \| task54) | task53 |
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

## WritingChatRequest

Request for chat tutor interaction.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `user_id` | no | string \| null | Authenticated user identifier; null for anonymous/guest sessions. | user_a1b2c3d4 |
| `task_id` | no | enum(`Q51`, `Q52`, `Q53`, `Q54`) | TOPIK II writing task type the chat is about. One of: Q51, Q52, Q53, Q54. enum: `Q51`, `Q52`, `Q53`, `Q54` | Q54 |
| `message` | yes | string | Student's chat message to the tutor. maxLength: 2000 | 이 문장을 더 자연스럽게 고치려면 어떻게 해야 하나요? |
| `essay_text` | no | string | Current essay draft the student is working on. maxLength: 5000 | 현대 사회에서 의사소통은 매우 중요하다. ... |
| `previous_draft` | no | string | Previous version of the essay draft, used for diff comparison against essay_text. maxLength: 5000 | 현대 사회에서 의사소통이 중요하다. ... |
| `conversation_history` | no | array<object> | Prior chat turns (max 30). Each item is {role, content}; role must be 'user' or 'assistant'. | [{"content":"이 표현이 맞나요?","role":"user"},{"content":"네, 자연스럽습니다.","role":"assistant"}] |
| `topic` | no | string | Topic of the writing task being discussed. maxLength: 500 | 의사소통의 중요성 |
| `passage_context` | no | string | Full passage text supplied for additional context (e.g. Q51/Q52 blank-fill prompt). maxLength: 3000 | 다음을 읽고 ㉠과 ㉡에 들어갈 말을 각각 쓰십시오. ... |
| `active_blank` | no | string | Currently active blank label for blank-fill tasks, e.g. 'ㄱ' or 'ㄴ'. maxLength: 20 | ㄱ |
| `lang` | no | enum(`ko`, `vi`, `en`) | Interface language code. One of: ko, vi, en. enum: `ko`, `vi`, `en` | ko |
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
| `difficulty` | no | enum(`easy`, `medium`, `hard`) | easy\|medium\|hard enum: `easy`, `medium`, `hard` | medium |
| `context_type` | no | string \| null | Q51 전용 지문 유형 / context type | 안내문 |

## WritingHistoryItem

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `id` | yes | string | Submission UUID / 제출 UUID | f47ac10b-58cc-4372-a567-0e02b2c3d479 |
| `task_type` | yes | string | TOPIK II writing task type / 작문 문제 유형 (task51 \| task53 \| task54) | task53 |
| `content_preview` | yes | string | Truncated preview of the submitted essay text / 제출한 작문 텍스트 미리보기 | 현대 사회에서 스트레스를 관리하는 방법에는... |
| `total_score` | no | number \| null | Total evaluation score; null while processing or for drafts / 총 평가 점수 (처리 중·초안은 null) | 42.5 |
| `status` | yes | string | Evaluation status / 평가 상태 (processing \| graded \| failed \| draft) | graded |
| `submitted_at` | yes | string | ISO-8601 submission timestamp / 제출 시각 (ISO-8601) | 2024-11-15T09:30:00 |

## WritingHistoryResponse

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `submissions` | yes | array<[WritingHistoryItem](./writing.md#writinghistoryitem)> | Page of submissions, newest first / 제출 목록 (최신순) |  |
| `total` | yes | integer | Total number of submissions matching the filters / 필터에 일치하는 전체 제출 수 | 1 |

## WritingSubmitRequest

Request to submit a writing for evaluation.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `user_id` | no | string \| null | Authenticated user identifier; null for anonymous/guest submissions. v13 submit integration sends `current`. | current |
| `task_id` | no | string \| null | Identifier of the writing task being answered; null for ad-hoc submissions. v13 submit integration sends the same TOPIK task code as `task_type`, not the local Supabase `problem_id` UUID. | Q51 |
| `task_type` | yes | enum(`Q51`, `Q52`, `Q53`, `Q54`) | TOPIK II writing task type. One of: Q51, Q52 (short blank-fill), Q53 (~300-char paragraph), Q54 (600-700 char essay). enum: `Q51`, `Q52`, `Q53`, `Q54` | Q51 |
| `text` | yes | string | Student's writing content. Minimum length depends on task_type (Q51/Q52: 5, Q53: 20, Q54: 100 chars). maxLength: 5000 | student answer... |
| `lang` | no | string | User interface language code. One of: ko, en, vi. Optional in the live component schema; v13 default submit payload does not send it. | ko |
| `passage_context` | no | string | Q51/Q52 only: original passage with blanks. Optional in the live component schema; v13 default submit payload does not send it. maxLength: 3000 |  |

v13 submit example:

```json
{
  "task_type": "Q51",
  "task_id": "Q51",
  "text": "student answer...",
  "user_id": "current"
}
```

`lang` and `passage_context` remain optional in the live component schema. The v13 default submit payload does not send them.

## WritingTaskListItem

Lightweight writing task item for listing.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `id` | yes | string | Unique task identifier. | task_5f9c2e10 |
| `task_type` | yes | string | TOPIK II writing task type. One of: Q51, Q52, Q53, Q54. | Q54 |
| `title` | yes | string | Short display title for the task. | 의사소통의 중요성에 대해 쓰기 |
| `topic` | no | string | Topic of the writing task. | 의사소통의 중요성 |
| `generated_by` | no | string | Origin of the task. One of: 'human', 'llm', 'fallback'. | human |
| `difficulty_level` | no | integer | Difficulty rating, typically 1 (easiest) to 10 (hardest). | 5 |

## WritingTaskListResponse

Paginated list of writing tasks.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `items` | yes | array<[WritingTaskListItem](./writing.md#writingtasklistitem)> | Writing tasks in the current page. | [{"difficulty_level":5,"generated_by":"human","id":"task_5f9c2e10","task_type":"Q54","title":"의사소통의 중요성에 대해 쓰기","topic":"의사소통의 중요성"}] |
| `total` | yes | integer | Total number of tasks available across all pages. | 128 |

## WritingTaskResponse

Full writing task returned from DB or LLM for practice.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `id` | yes | string | Unique task identifier. | task_5f9c2e10 |
| `task_type` | yes | string | TOPIK II writing task type. One of: Q51, Q52, Q53, Q54. | Q54 |
| `title` | yes | string | Short display title for the task. | 의사소통의 중요성에 대해 쓰기 |
| `prompt` | yes | string | Full task prompt/instructions shown to the student. | 다음을 주제로 하여 자신의 생각을 600~700자로 글을 쓰십시오. |
| `topic` | no | string | Topic of the writing task. | 의사소통의 중요성 |
| `generated_by` | no | string | Origin of the task. One of: 'human', 'llm', 'fallback'. | human |
| `difficulty_level` | no | integer | Difficulty rating, typically 1 (easiest) to 10 (hardest). | 5 |
| `target_char_count` | no | integer \| null | Recommended answer length in characters; null if not applicable. | 700 |
| `max_score` | no | integer | Maximum achievable score (Q51/Q52: 10, Q53: 30, Q54: 50). | 50 |
| `reference_material` | no | object \| null | Optional supporting material (chart/data/passage) for the task; null if none. | {"caption":"연도별 인구 변화","type":"graph"} |
| `instruction` | no | string \| null | Q51/Q52 only: blank-fill instruction text; null for other task types. | ㉠과 ㉡에 들어갈 말을 각각 쓰십시오. |
| `passage` | no | string \| null | Q51/Q52 only: passage text containing the blanks; null for other task types. | 안녕하세요. 다음 주에 모임이 있어서 ㉠. 꼭 참석해 ㉡. |
| `blanks` | no | array<string> \| null | Q51/Q52 only: ordered blank labels to fill, e.g. ['㉠', '㉡']; null otherwise. | ["㉠","㉡"] |
| `header` | no | object \| null | Q51/Q52 only: document header fields, e.g. {'recipient': ..., 'subject': ...}; null otherwise. | {"recipient":"김 선생님","subject":"모임 안내"} |
| `greeting` | no | string \| null | Q51/Q52 only: greeting line of the document; null otherwise. | 안녕하세요. |
| `body_lines` | no | array<string> \| null | Q51/Q52 only: ordered body lines of the document; null otherwise. | ["다음 주에 모임이 있습니다.","꼭 참석해 주시기 바랍니다."] |
| `closing` | no | string \| null | Q51/Q52 only: closing line of the document; null otherwise. | 감사합니다. |
