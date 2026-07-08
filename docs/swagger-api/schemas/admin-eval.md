# Admin Eval Schemas

Source: [OpenAPI JSON](https://api.dotoretopik.com/openapi.json)
Last synced: 2026-07-07

## Schema Index

| Schema | Type | Description |
| --- | --- | --- |
| [DatasetResultsResponse](#datasetresultsresponse) | object | Paginated per-case results for an eval run. |
| [DatasetStatsResponse](#datasetstatsresponse) | object | Aggregate statistics for one eval run (from `compute_stats`). |
| [DatasetsResponse](#datasetsresponse) | object | Paginated eval-run records from the SQLite eval database. |
| [EvalRunRequest](#evalrunrequest) | object |  |
| [EvalRunResponse](#evalrunresponse) | object | Acknowledgement returned when an eval subprocess is started. |
| [EvalRunStatusResponse](#evalrunstatusresponse) | object | Current eval run state stored in Redis (TTL 2h). |
| [EvalUserItem](#evaluseritem) | object | A user who has at least one graded submission. |
| [EvalUsersResponse](#evalusersresponse) | object | Paginated list of users with graded submissions. |
| [ExpertReview](#expertreview) | object | A persisted expert review. |
| [OverviewStatsResponse](#overviewstatsresponse) | object | High-level aggregate stats for the eval dashboard header. |
| [ReviewListResponse](#reviewlistresponse) | object | All expert reviews submitted for a target (multi-reviewer). |
| [src__api__routes__admin_eval__ReviewRequest](#src-api-routes-admin-eval-reviewrequest) | object | Expert review request. |
| [SubmissionDetailFeedback](#submissiondetailfeedback) | object | AI feedback record within the detail response. |
| [SubmissionDetailResponse](#submissiondetailresponse) | object | Full submission detail: submission record, feedback, and linked task. |
| [SubmissionDetailSubmission](#submissiondetailsubmission) | object | Core submission record within the detail response. |
| [SubmissionDetailTask](#submissiondetailtask) | object | Writing task metadata within the detail response (null when no task linked). |
| [UserSubmissionItem](#usersubmissionitem) | object | A single graded writing submission for a user. |
| [UserSubmissionsResponse](#usersubmissionsresponse) | object | Paginated list of a user's graded submissions. |

## DatasetResultsResponse

Paginated per-case results for an eval run.

Each item mirrors a full `eval_results` row (`SELECT *`) enriched with case
`input_data`, `description`, `title`, a coerced `passed` bool, and parsed
`judge_verdict`/`penalty_results`/`raw_output` JSON; passed through untyped.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `items` | yes | array<object> | Enriched per-case result rows (passthrough). | [{"actual":42.5,"case_id":"tc001","expected_min":40,"score":42.5,"status":"passed"}] |
| `total` | yes | integer | Total matching results. | 1 |
| `limit` | yes | integer | Page size echoed back. | 100 |
| `offset` | yes | integer | Page offset echoed back. | 0 |

## DatasetStatsResponse

Aggregate statistics for one eval run (from `compute_stats`).

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `total` | yes | integer | Total cases in the run. | 20 |
| `passed` | yes | integer | Number of passed cases. | 18 |
| `failed` | yes | integer | Number of failed cases. | 2 |
| `pass_rate` | yes | number | Passed / total, rounded to 4dp. | 0.9 |
| `avg_score` | yes | number | Average weighted score, rounded to 3dp. | 42.3 |
| `total_cost_usd` | yes | number | Summed cost in USD, rounded to 6dp. | 0.0123 |
| `avg_processing_time` | yes | number | Average processing time in seconds, rounded to 2dp. | 1.45 |

## DatasetsResponse

Paginated eval-run records from the SQLite eval database.

Each item mirrors a full `eval_datasets` row (`SELECT *`), so the column set
is schema-defined; items are passed through untyped to avoid dropping fields.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `items` | yes | array<object> | Eval-run rows (passthrough; all eval_datasets columns). | [{"created_at":"2024-11-15T10:00:00","id":"run-2024-11-15","mode":"full","passed":18,"pipeline":"writing_scorer","total":20}] |
| `total` | yes | integer | Total matching eval runs. | 1 |
| `limit` | yes | integer | Page size echoed back. | 50 |
| `offset` | yes | integer | Page offset echoed back. | 0 |

## EvalRunRequest

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `pipeline` | no | string | Pipeline to run. One of: writing_scorer, content_generation, chat_tutor, exam_feedback, chat_modes, q53_dsl. | writing_scorer |
| `dataset` | no | string | Dataset name, or `all`. Safe token: alphanumeric start, no path separators or leading '-'. | all |
| `mode` | no | string | Run mode. One of: full (all cases), quick (fast subset), stability (repeat runs). | quick |
| `case_filter` | no | string \| null | Optional single case id to run. Safe token: alphanumeric start, no path separators or leading '-'. | tc001 |

## EvalRunResponse

Acknowledgement returned when an eval subprocess is started.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `run_id` | yes | string | Run identifier to poll for status. | a1b2c3d4-... |
| `status` | yes | string | Initial run status (always `running`). | running |
| `pipeline` | yes | string | Pipeline that was started. | writing_scorer |
| `dataset` | yes | string | Dataset name, or `all`. | all |
| `mode` | yes | string | Run mode. | quick |

## EvalRunStatusResponse

Current eval run state stored in Redis (TTL 2h).

Fields vary by phase: a `running` entry carries pipeline/dataset/mode/
triggered_by; a finished entry carries exit_code and stdout/stderr tails;
an internal failure carries `error`. All non-status fields are optional.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `status` | yes | string | Run status: running, completed, failed, or error. | completed |
| `exit_code` | no | integer \| null | Subprocess exit code (finished runs). | 0 |
| `stdout_tail` | no | string \| null | Last ~3000 chars of stdout (finished runs). | Passed: 18/20 cases (90.0%)<br>Avg score: 42.3 |
| `stderr_tail` | no | string \| null | Last ~1000 chars of stderr (finished runs). |  |
| `error` | no | string \| null | Internal error message (status=error only). |  |
| `pipeline` | no | string \| null | Pipeline name (running entry). | writing_scorer |
| `dataset` | no | string \| null | Dataset name (running entry). | all |
| `mode` | no | string \| null | Run mode (running entry). | quick |
| `triggered_by` | no | string \| null | Display name of the admin who started the run. | Admin |

## EvalUserItem

A user who has at least one graded submission.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `id` | yes | string | User UUID. | uuid |
| `email` | no | string \| null | User email. | learner@example.com |
| `display_name` | no | string \| null | User display name. | 홍길동 |
| `submission_count` | yes | integer | Number of graded submissions by this user. | 5 |
| `avg_score` | no | number \| null | Average total score across graded submissions. | 48.5 |
| `last_submitted_at` | no | string \| null | ISO timestamp of the user's most recent submission. | 2024-11-15T10:00:00 |

## EvalUsersResponse

Paginated list of users with graded submissions.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `items` | yes | array<[EvalUserItem](./admin-eval.md#evaluseritem)> | Users on the current page. |  |
| `total` | yes | integer | Total matching users. | 1 |
| `limit` | yes | integer | Page size echoed back. | 50 |
| `offset` | yes | integer | Page offset echoed back. | 0 |

## ExpertReview

A persisted expert review.

All fields are optional because `GET .../my` returns an empty object `{}`
when the current admin has not reviewed the target yet.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `id` | no | string \| null | Review UUID. | uuid |
| `target_type` | no | string \| null | Reviewed target type. | submission |
| `target_id` | no | string \| null | Reviewed target UUID. | uuid |
| `reviewer_id` | no | string \| null | Reviewer user UUID. | uuid |
| `reviewer_name` | no | string \| null | Reviewer display name. | Admin A |
| `agreement` | no | string \| null | Agreement: agree \| mostly_agree \| partial \| disagree \| '' (unset). | mostly_agree |
| `grade` | no | string \| null | Letter grade: A \| B \| C \| D \| F \| '' (unset). | B |
| `disagreed_sections` | no | array<string> \| null | Section keys the reviewer disagrees with. | ["expression"] |
| `section_feedbacks` | no | object \| null | Per-section freeform feedback. | {"expression":"어휘 점수가 낮게 책정됨"} |
| `general_feedback` | no | string \| null | Overall freeform feedback. | 채점 기준이 다소 엄격하게 적용된 것 같습니다. |
| `created_at` | no | string \| null | ISO creation timestamp. | 2024-11-15T11:00:00 |
| `updated_at` | no | string \| null | ISO last-update timestamp. | 2024-11-15T11:00:00 |

## OverviewStatsResponse

High-level aggregate stats for the eval dashboard header.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `total_users` | yes | integer | Distinct users with graded submissions. | 1250 |
| `total_submissions` | yes | integer | Total graded submissions. | 1180 |
| `avg_score` | no | number \| null | Average total score across graded submissions. | 42.3 |
| `total_reviews` | yes | integer | Total expert reviews submitted. | 70 |

## ReviewListResponse

All expert reviews submitted for a target (multi-reviewer).

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `items` | yes | array<[ExpertReview](./admin-eval.md#expertreview)> | Reviews for the target. |  |
| `total` | yes | integer | Number of reviews returned. | 1 |

## src__api__routes__admin_eval__ReviewRequest

OpenAPI component key: `src__api__routes__admin_eval__ReviewRequest`. The shared schema title is `ReviewRequest`; use the component key in links to avoid colliding with `src__api__routes__admin_reading__ReviewRequest`.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `agreement` | no | enum(`agree`, `mostly_agree`, `partial`, `disagree`, ``) | Reviewer's agreement with the AI grading. Empty string means unset. | mostly_agree |
| `grade` | no | enum(`A`, `B`, `C`, `D`, `F`, ``) | Reviewer's letter grade for the output. Empty string means unset. | B |
| `disagreed_sections` | no | array<string> | Section keys the reviewer disagrees with (e.g. content, structure, expression). | ["expression"] |
| `section_feedbacks` | no | object | Per-section freeform feedback, keyed by section name. | {"expression":"어휘 점수가 낮게 책정됨"} |
| `general_feedback` | no | string | Overall freeform feedback on the AI grading. | 전반적으로 적절한 채점이나 표현 부분은 재검토 필요. |

## SubmissionDetailFeedback

AI feedback record within the detail response.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `id` | yes | string | Feedback UUID. | uuid |
| `total_score` | no | number \| null | Total score awarded. | 58 |
| `max_score` | no | number \| null | Maximum possible score. | 100 |
| `trait_scores` | no | object | Per-trait score breakdown (passthrough JSON). | {"content":20,"expression":20,"structure":18} |
| `errors` | no | array<-> | Detected errors (passthrough JSON list). |  |
| `error_analysis` | no | object | Error analysis (passthrough JSON). |  |
| `suggestions` | no | array<-> | Improvement suggestions (passthrough JSON list). |  |
| `ai_summary` | no | string | AI summary text. | 전반적으로 잘 작성된 글입니다... |
| `annotations` | no | array<-> | Inline annotations (passthrough JSON list). |  |

## SubmissionDetailResponse

Full submission detail: submission record, feedback, and linked task.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `submission` | yes | [SubmissionDetailSubmission](./admin-eval.md#submissiondetailsubmission) | Submission record. |  |
| `feedback` | yes | [SubmissionDetailFeedback](./admin-eval.md#submissiondetailfeedback) | AI feedback record. |  |
| `task` | no | [SubmissionDetailTask](./admin-eval.md#submissiondetailtask) \| null | Linked writing task, or null if none. |  |

## SubmissionDetailSubmission

Core submission record within the detail response.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `id` | yes | string | Submission UUID. | uuid |
| `user_id` | yes | string | Author user UUID. | uuid |
| `user_email` | no | string \| null | Author email. | learner@example.com |
| `user_display_name` | no | string \| null | Author display name. | 홍길동 |
| `task_type` | no | string \| null | Writing task type. | task54 |
| `text` | no | string \| null | Submitted essay text. | 현대 사회에서... |
| `character_count` | no | integer \| null | Character count of the essay. | 512 |
| `submitted_at` | no | string \| null | ISO submission timestamp. | 2024-11-15T10:00:00 |
| `status` | no | string \| null | Submission status. | graded |

## SubmissionDetailTask

Writing task metadata within the detail response (null when no task linked).

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `id` | no | string \| null | Task UUID. | uuid |
| `title` | no | string | Task title. | 나의 꿈 |
| `prompt` | no | string | Task prompt text. | ... |
| `topic` | no | string | Task topic. | 사회 |
| `task_type` | no | string \| null | Task type. | task54 |
| `model_answer` | no | string \| null | Reference model answer. |  |

## UserSubmissionItem

A single graded writing submission for a user.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `id` | yes | string | Submission UUID. | uuid |
| `task_type` | no | string \| null | Writing task type. | task54 |
| `task_title` | no | string | Task title (empty if unknown). |  |
| `topic` | no | string | Task topic (empty if unknown). |  |
| `submitted_at` | no | string \| null | ISO submission timestamp. | 2024-11-15T10:05:00 |
| `total_score` | no | number \| null | Total score awarded. | 58 |
| `max_score` | no | number \| null | Maximum possible score. | 100 |
| `trait_scores` | no | object | Per-trait score breakdown (passthrough JSON). | {"content":20,"expression":20,"structure":18} |

## UserSubmissionsResponse

Paginated list of a user's graded submissions.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `items` | yes | array<[UserSubmissionItem](./admin-eval.md#usersubmissionitem)> | Submissions on the current page. |  |
| `total` | yes | integer | Total graded submissions for the user. | 1 |
| `limit` | yes | integer | Page size echoed back. | 50 |
| `offset` | yes | integer | Page offset echoed back. | 0 |
