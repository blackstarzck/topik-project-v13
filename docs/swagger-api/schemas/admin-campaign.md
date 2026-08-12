# Admin Campaign Schemas

Source snapshot: generated from the former TALKPIK external API documentation on 2026-07-07. The original service and documentation routes are no longer available.
Last synced: 2026-06-23

## Schema Index

| Schema | Type | Description |
| --- | --- | --- |
| [CampaignAssignRequest](#campaignassignrequest) | object | Admin request to assign or clear the reviewer on a submission. |
| [CampaignAuditEntry](#campaignauditentry) | object | One entry in a submission's audit log. |
| [CampaignAuditLogResponse](#campaignauditlogresponse) | object | Audit log entries for a submission. |
| [CampaignContentEditRequest](#campaigncontenteditrequest) | object | KR content reviewer overlays edits on top of the AI draft. The |
| [CampaignInvalidateRequest](#campaigninvalidaterequest) | object | Admin request to mark a submission invalid. |
| [CampaignReviewer](#campaignreviewer) | object | One assignable reviewer for the assign/claim dropdown. |
| [CampaignReviewerListResponse](#campaignreviewerlistresponse) | object | List of assignable reviewers for the admin dashboard. |
| [CampaignSourceEditRequest](#campaignsourceeditrequest) | object | Reviewer correction of the original source fields on a submission. |
| [CampaignStateTransitionRequest](#campaignstatetransitionrequest) | object | Admin request to move a submission to a new workflow status. |
| [CampaignStatsOverview](#campaignstatsoverview) | object | Aggregate campaign metrics for the admin overview dashboard. |
| [CampaignSubmissionDetail](#campaignsubmissiondetail) | object | Full read-side projection of a submission used by the eval |
| [CampaignSubmissionListItem](#campaignsubmissionlistitem) | object | One submission row in the admin per-user or cross-user queue. |
| [CampaignSubmissionListResponse](#campaignsubmissionlistresponse) | object | Paginated list of submissions for the admin dashboard. |
| [CampaignSubmissionUserDetail](#campaignsubmissionuserdetail) | object | Embedded applicant identity within a submission detail. |
| [CampaignTranslationRequest](#campaigntranslationrequest) | object | KR/VN finalized feedback and translation submitted by a reviewer. |
| [CampaignUserListResponse](#campaignuserlistresponse) | object | Paginated list of campaign users for the admin dashboard. |
| [CampaignUserSummary](#campaignusersummary) | object | One row in GET /api/admin/campaign/users. |
| [CampaignWaitlistItem](#campaignwaitlistitem) | object | One row in the admin waitlist list. |
| [CampaignWaitlistListResponse](#campaignwaitlistlistresponse) | object | Paginated list of waitlist entries for the admin dashboard. |
| [OkClaimResponse](#okclaimresponse) | object | Self-claim acknowledgement carrying the new assignee id. |
| [OkResponse](#okresponse) | object | Generic success acknowledgement for mutation endpoints. |
| [TaskEnqueuedResponse](#taskenqueuedresponse) | object | ARQ enqueue acknowledgement returned by the 202 task endpoints |
| [TaskStatusResponse](#taskstatusresponse) | object | Current ARQ job status from the task-status poll endpoint. ``result`` |
| [WorkflowStateResponse](#workflowstateresponse) | object | New workflow status after a state transition. |

## CampaignAssignRequest

Admin request to assign or clear the reviewer on a submission.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `assignee_id` | no | string \| null | UUID of the reviewer to assign; null clears the assignee. | a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d |
| `note` | no | string \| null | Optional note recorded with the assignment. | Reassigned to native reviewer. |

## CampaignAuditEntry

One entry in a submission's audit log.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `id` | yes | integer | Primary key of the audit entry. | 42 |
| `actor_email` | yes | string | Email of the actor who performed the action. | reviewer@example.com |
| `actor_role` | yes | string \| null | Role of the actor at the time of the action; null if unknown. | content_reviewer |
| `action` | yes | string | Action identifier (e.g. state transition, source edit). | state_transition |
| `before` | yes | object \| null | Snapshot of the affected fields before the action; null if not applicable. | {"workflow_status":"content_review"} |
| `after` | yes | object \| null | Snapshot of the affected fields after the action; null if not applicable. | {"workflow_status":"pdf_ready"} |
| `note` | yes | string \| null | Optional note recorded with the action; null if none. | Approved after content review. |
| `at` | yes | string | ISO-8601 UTC timestamp when the action occurred. | 2026-06-08T10:00:00Z |

## CampaignAuditLogResponse

Audit log entries for a submission.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `items` | yes | array<[CampaignAuditEntry](./admin-campaign.md#campaignauditentry)> | Audit entries, typically newest-first. | [] |

## CampaignContentEditRequest

KR content reviewer overlays edits on top of the AI draft. The
body is a JSON object whose keys match the report sections — see
plan-09 §4 for the canonical key list.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `kr_content_edit` | yes | object | Edit overlay keyed by report section (see plan-09 §4 for the canonical keys). | {"grammar":"조사 사용에 주의하세요.","summary":"구조가 명확합니다."} |
| `note` | no | string \| null | Optional reviewer note recorded with the edit. | Tightened the grammar section. |

## CampaignInvalidateRequest

Admin request to mark a submission invalid.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `reason` | yes | string | Reason the submission is being marked invalid. | Answer image was unreadable. |

## CampaignReviewer

One assignable reviewer for the assign/claim dropdown.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `user_id` | yes | string | UUID of the reviewer's user profile. | a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d |
| `email` | yes | string | Reviewer email (may include reserved/dev domains such as .local). | reviewer@example.com |
| `display_name` | yes | string | Reviewer display name shown in the assign dropdown. | Reviewer Kim |
| `roles` | yes | array<string> | Roles granted to the reviewer (e.g. content/translation reviewer). | ["content_reviewer","translation_reviewer"] |

## CampaignReviewerListResponse

List of assignable reviewers for the admin dashboard.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `items` | yes | array<[CampaignReviewer](./admin-campaign.md#campaignreviewer)> | All assignable reviewers. | [] |

## CampaignSourceEditRequest

Reviewer correction of the original source fields on a submission.

All fields optional — only the keys explicitly present in the request body
are applied (partial update via ``model_fields_set``), so a client can edit
just the answer text without clearing the question/passage. Editing the
applicant's submitted answer is sensitive, so the route audit-logs a
before/after snapshot.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `question_topic_text` | no | string \| null | Corrected Q53/Q54 essay topic; omit to leave unchanged. | 환경 보호의 중요성에 대해 쓰십시오. |
| `passage_context` | no | string \| null | Corrected reading passage/prompt context; omit to leave unchanged. | 다음 글을 읽고 200~300자로 쓰십시오. |
| `text` | no | string \| null | Corrected applicant answer text; omit to leave unchanged. | 저는 매일 아침 운동을 합니다. |
| `user_answers` | no | array<string> \| null | Corrected Q51/Q52 per-blank answers (max 3); omit to leave unchanged. | ["감사합니다"] |
| `note` | no | string \| null | Optional reviewer note recorded with the source edit. | Fixed OCR transcription error. |
| `reviewer_tag` | no | string \| null | Reviewer flag/note (e.g. suspected AI-generated answer); shown as a label. |  |

## CampaignStateTransitionRequest

Admin request to move a submission to a new workflow status.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `target_status` | yes | enum(`submitted`, `ai_drafted`, `content_review`, `translation_review`, `pdf_ready`, `delivered`, `followup_sent`, `invalid`, `resend_required`) | Workflow status to transition the submission to. | pdf_ready |
| `note` | no | string \| null | Optional reviewer note recorded with the transition. | Approved after content review. |

## CampaignStatsOverview

Aggregate campaign metrics for the admin overview dashboard.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `total_submissions` | yes | integer | Total number of submissions in the campaign. | 350 |
| `by_status` | yes | object | Submission counts keyed by workflow status. | {"delivered":300,"submitted":10} |
| `by_task_type` | yes | object | Submission counts keyed by task type. | {"Q51":40,"Q52":40,"Q53":130,"Q54":140} |
| `sla_at_risk` | yes | integer | Number of submissions within 6h of their due_at. | 5 |
| `sla_breached` | yes | integer | Number of submissions past their due_at without delivery. | 2 |
| `total_users` | yes | integer | Total number of distinct users in the campaign. | 120 |

## CampaignSubmissionDetail

Full read-side projection of a submission used by the eval
dashboard and by the PDF/email render pipeline.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `id` | yes | string | UUID of the submission. | 3f9c1a2e-7b4d-4e1a-9c2f-0a1b2c3d4e5f |
| `user` | yes | [CampaignSubmissionUserDetail](./admin-campaign.md#campaignsubmissionuserdetail) | Embedded applicant identity. |  |
| `task_type` | yes | enum(`Q51`, `Q52`, `Q53`, `Q54`) | TOPIK writing task. One of: 'Q51', 'Q52', 'Q53', 'Q54'. | Q53 |
| `text` | yes | string | The applicant's written answer. | 저는 매일 아침 운동을 합니다. |
| `passage_context` | yes | string | Reading passage or prompt context the answer responds to. | 다음 글을 읽고 200~300자로 쓰십시오. |
| `question_topic_text` | yes | string \| null | Q53/Q54 essay topic/instruction; null for Q51/Q52. | 환경 보호의 중요성에 대해 쓰십시오. |
| `user_answers` | yes | array<string> \| null | Q51/Q52 per-blank answers; null for Q53/Q54. | ["감사합니다"] |
| `provided_question_ids` | yes | array<string> \| null | Q51/Q52 answered blank ids; null for Q53/Q54. | ["a","b"] |
| `provided_question_texts` | yes | array<[ProvidedQuestion](./common.md#providedquestion)> \| null | Q51/Q52 prompt text per blank; null for Q53/Q54. | [{"id":"a","text":"( ㉠ )에 들어갈 말을 쓰십시오."}] |
| `image_url` | yes | string \| null | Single uploaded answer image URL; null if none. | https://cdn.example.com/uploads/answer-1.jpg |
| `image_urls` | no | array<string> \| null | Multi-image answer URLs (up to 3); null if none. | ["https://cdn.example.com/uploads/answer-1.jpg"] |
| `ocr_text` | no | string \| null | OCR-extracted text from the uploaded image(s); null if not run. | 저는 매일 아침 운동을 합니다. |
| `feedback` | yes | object \| null | Structured AI scoring feedback; null until drafted. | {"summary":"Good structure, minor grammar issues."} |
| `total_score` | yes | number \| null | Awarded score; null until scoring completes. | 42.5 |
| `max_score` | yes | number \| null | Maximum possible score for this task type. | 50 |
| `error_message` | yes | string \| null | Human-readable error if scoring failed; null otherwise. |  |
| `reviewer_tag` | no | string \| null | Reviewer flag/note (e.g. suspected AI-generated answer); shown as a label. |  |
| `kr_content_edit` | yes | object \| null | KR reviewer's edit overlay on the AI draft, keyed by report section; null if unedited. | {"summary":"구조가 명확합니다."} |
| `kr_reviewed_by` | yes | string \| null | Email of the KR content reviewer; null if not yet reviewed. | reviewer@example.com |
| `kr_reviewed_at` | yes | string \| null | ISO-8601 UTC timestamp of KR content review; null if not reviewed. | 2026-06-08T10:00:00Z |
| `kr_feedback` | yes | string \| null | Finalized Korean feedback text; null if not produced. | 전반적으로 잘 작성되었습니다. |
| `vn_translation` | yes | string \| null | Vietnamese translation of the feedback; null if not produced. | Bài viết nhìn chung tốt. |
| `vn_reviewed_by` | yes | string \| null | Email of the VN translation reviewer; null if not reviewed. | reviewer@example.com |
| `vn_reviewed_at` | yes | string \| null | ISO-8601 UTC timestamp of VN translation review; null if not reviewed. | 2026-06-08T11:00:00Z |
| `workflow_status` | yes | enum(`submitted`, `ai_drafted`, `content_review`, `translation_review`, `pdf_ready`, `delivered`, `followup_sent`, `invalid`, `resend_required`) | Current workflow state of the submission. | content_review |
| `assignee_id` | yes | string \| null | UUID of the reviewer currently assigned; null if unassigned. | a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d |
| `due_at` | yes | string | ISO-8601 UTC deadline by which the result is promised. | 2026-06-09T09:30:00Z |
| `submitted_at` | yes | string | ISO-8601 UTC timestamp when the submission was received. | 2026-06-08T09:30:00Z |
| `is_duplicate` | yes | boolean | True if this submission was deduplicated against an existing one. | false |
| `invalid_reason` | yes | string \| null | Reason the submission was marked invalid; null if valid. |  |
| `pdf_url` | yes | string \| null | URL of the generated result PDF; null until generated. | https://cdn.example.com/pdf/result-1.pdf |
| `pdf_filename` | no | string \| null | Filename of the generated result PDF; null until generated. | topik-result-2026-06-08.pdf |
| `pdf_generated_at` | yes | string \| null | ISO-8601 UTC timestamp when the PDF was generated; null until generated. | 2026-06-08T11:30:00Z |
| `email_sent_at` | yes | string \| null | ISO-8601 UTC timestamp when the result email was sent; null if not sent. | 2026-06-08T11:35:00Z |
| `email_attempts` | yes | integer | Number of result-email delivery attempts made. | 1 |
| `email_last_error` | yes | string \| null | Last email delivery error message; null if none. |  |
| `source_channel` | yes | string \| null | Acquisition channel the applicant arrived from; null if unknown. | facebook_group |
| `community_group` | yes | string \| null | Referring community/group name; null if none. | TOPIK Study VN |
| `community_post_url` | yes | string \| null | URL of the referring community post; null if none. | https://facebook.com/groups/topikvn/posts/123 |
| `staff_owner` | yes | string \| null | Staff member who owns/referred this lead; null if none. | minh |

## CampaignSubmissionListItem

One submission row in the admin per-user or cross-user queue.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `id` | yes | string | UUID of the submission. | 3f9c1a2e-7b4d-4e1a-9c2f-0a1b2c3d4e5f |
| `task_type` | yes | enum(`Q51`, `Q52`, `Q53`, `Q54`) | TOPIK writing task. One of: 'Q51', 'Q52', 'Q53', 'Q54'. | Q53 |
| `workflow_status` | yes | enum(`submitted`, `ai_drafted`, `content_review`, `translation_review`, `pdf_ready`, `delivered`, `followup_sent`, `invalid`, `resend_required`) | Current workflow state of the submission. | ai_drafted |
| `total_score` | yes | number \| null | Awarded score; null until scoring completes. | 42.5 |
| `max_score` | yes | number \| null | Maximum possible score for this task type. | 50 |
| `submitted_at` | yes | string | ISO-8601 UTC timestamp when the submission was received. | 2026-06-08T09:30:00Z |
| `due_at` | yes | string | ISO-8601 UTC deadline by which the result is promised. | 2026-06-09T09:30:00Z |
| `sla_risk` | yes | boolean | True if this submission is within 6h of its due_at. | false |
| `is_duplicate` | yes | boolean | True if this submission was deduplicated against an existing one. | false |
| `reviewer_tag` | no | string \| null | Reviewer flag/note (e.g. suspected AI-generated answer); shown as a label. |  |
| `email` | no | string \| null | Applicant email; present on the cross-user queue, null on the per-user list. | learner@example.com |
| `display_name` | no | string \| null | Applicant display name; present on the cross-user queue, null on the per-user list. | Nguyen Van A |

## CampaignSubmissionListResponse

Paginated list of submissions for the admin dashboard.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `items` | yes | array<[CampaignSubmissionListItem](./admin-campaign.md#campaignsubmissionlistitem)> | Page of submission rows. | [] |
| `total` | yes | integer | Total number of submissions matching the query (across all pages). | 350 |

## CampaignSubmissionUserDetail

Embedded applicant identity within a submission detail.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `id` | yes | string | UUID of the user profile. | a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d |
| `email` | yes | string | Applicant email (display projection of the stored value). | learner@example.com |
| `display_name` | yes | string | Applicant display name. | Nguyen Van A |
| `language` | yes | string | Stored preferred language (free-form; typically 'ko', 'vi', 'en'). | vi |

## CampaignTranslationRequest

KR/VN finalized feedback and translation submitted by a reviewer.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `kr_feedback` | no | string \| null | Finalized Korean feedback text; omit to leave unchanged. | 전반적으로 잘 작성되었습니다. |
| `vn_translation` | no | string \| null | Vietnamese translation of the feedback; omit to leave unchanged. | Bài viết nhìn chung tốt. |
| `note` | no | string \| null | Optional reviewer note recorded with the translation. | Reviewed by native speaker. |

## CampaignUserListResponse

Paginated list of campaign users for the admin dashboard.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `items` | yes | array<[CampaignUserSummary](./admin-campaign.md#campaignusersummary)> | Page of user summary rows. | [] |
| `total` | yes | integer | Total number of users matching the query (across all pages). | 120 |

## CampaignUserSummary

One row in GET /api/admin/campaign/users.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `user_id` | yes | string | UUID of the user profile. | a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d |
| `email` | yes | string | User email (display projection of the stored value). | learner@example.com |
| `display_name` | yes | string | User display name. | Nguyen Van A |
| `language` | yes | string | Stored preferred language (free-form; typically 'ko', 'vi', 'en'). | vi |
| `submission_count` | yes | integer | Number of submissions made by this user. | 3 |
| `latest_submitted_at` | yes | string | ISO-8601 UTC timestamp of the user's most recent submission. | 2026-06-08T09:30:00Z |
| `latest_workflow_status` | yes | enum(`submitted`, `ai_drafted`, `content_review`, `translation_review`, `pdf_ready`, `delivered`, `followup_sent`, `invalid`, `resend_required`) | Workflow status of the user's most recent submission. | content_review |
| `sla_risk` | yes | boolean | True if any submission for this user is within 6h of its due_at. | true |

## CampaignWaitlistItem

One row in the admin waitlist list.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `id` | yes | integer | Primary key of the waitlist entry. | 42 |
| `email` | yes | string | Waitlist email (display projection of the stored value). | learner@example.com |
| `locale` | yes | string \| null | Locale the signup came from; null if unknown. | vi |
| `source` | yes | string | Capture source of the signup (free text). | landing_hero |
| `pathname` | yes | string \| null | Page path where the signup occurred; null if not captured. | /campaign |
| `referrer` | yes | string \| null | HTTP referrer at signup time; null if not captured. | https://facebook.com/ |
| `user_agent` | yes | string \| null | Browser user-agent string at signup time; null if not captured. | Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) |
| `submission_count` | yes | integer | Number of times this email signed up (deduplicated upsert counter). | 1 |
| `created_at` | yes | string | ISO-8601 UTC timestamp when the entry was first created. | 2026-06-08T09:30:00Z |
| `updated_at` | yes | string | ISO-8601 UTC timestamp when the entry was last updated. | 2026-06-08T09:30:00Z |

## CampaignWaitlistListResponse

Paginated list of waitlist entries for the admin dashboard.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `items` | yes | array<[CampaignWaitlistItem](./admin-campaign.md#campaignwaitlistitem)> | Page of waitlist rows. | [] |
| `total` | yes | integer | Total number of waitlist entries matching the query. | 500 |

## OkClaimResponse

Self-claim acknowledgement carrying the new assignee id.

셀프 클레임 성공 응답 (새 담당자 ID 포함).

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `ok` | yes | boolean | True when the claim succeeded. | true |
| `assignee_id` | yes | string | UUID of the reviewer who now owns the submission (the caller). | 3f7c1e2a-0b4d-4f9a-9c1e-2a0b4d4f9a9c |

## OkResponse

Generic success acknowledgement for mutation endpoints.

변경 작업 성공 응답.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `ok` | yes | boolean | True when the operation succeeded. | true |

## TaskEnqueuedResponse

ARQ enqueue acknowledgement returned by the 202 task endpoints
(PDF render, scoring, email send, resend).

백그라운드 작업 등록 응답 (PDF/채점/메일).

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `task_id` | yes | string | ARQ job id; poll GET /tasks/{task_id}/status with it. | job-abc123 |
| `status` | yes | string | Initial enqueue status (always 'queued'). | queued |

## TaskStatusResponse

Current ARQ job status from the task-status poll endpoint. ``result``
is present only once the job is complete; ``error`` only if fetching the
completed job's result failed.

백그라운드 작업 상태 조회 응답.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `task_id` | yes | string | The ARQ job id that was polled. | job-abc123 |
| `status` | yes | string | ARQ JobStatus value (e.g. deferred/queued/in_progress/complete/not_found). | complete |
| `result` | no | object \| null | Worker return value; present only when status is 'complete'. | {} |
| `error` | no | string \| null | Truncated error string if fetching a completed job's result raised. |  |

## WorkflowStateResponse

New workflow status after a state transition.

상태 전환 후의 새 워크플로 상태.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `workflow_status` | yes | string | The submission's workflow status after the transition. | in_review |
