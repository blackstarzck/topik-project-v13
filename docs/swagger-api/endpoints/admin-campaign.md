# Admin Campaign API

Source snapshot: generated from the former TALKPIK external API documentation on 2026-07-07. The original service and documentation routes are no longer available.
Last synced: 2026-06-23

Scope: Campaign admin review, email, PDF, and stats

## Endpoint Index

| Method | Path | Summary | Auth |
| --- | --- | --- | --- |
| GET | [`/api/admin/campaign/users`](#get-api-admin-campaign-users) | List campaign users | BearerAuth |
| GET | [`/api/admin/campaign/users/{email}/submissions`](#get-api-admin-campaign-users-email-submissions) | List a user's submissions | BearerAuth |
| GET | [`/api/admin/campaign/contact-inquiries`](#get-api-admin-campaign-contact-inquiries) | List contact-us inquiries | BearerAuth |
| GET | [`/api/admin/campaign/waitlist`](#get-api-admin-campaign-waitlist) | List waitlist signups | BearerAuth |
| GET | [`/api/admin/campaign/submissions`](#get-api-admin-campaign-submissions) | List submission review queue | BearerAuth |
| GET | [`/api/admin/campaign/reviewers`](#get-api-admin-campaign-reviewers) | List campaign reviewers | BearerAuth |
| GET | [`/api/admin/campaign/submissions/{submission_id}`](#get-api-admin-campaign-submissions-submission-id) | Get submission detail | BearerAuth |
| DELETE | [`/api/admin/campaign/submissions/{submission_id}`](#delete-api-admin-campaign-submissions-submission-id) | Delete submission | BearerAuth |
| GET | [`/api/admin/campaign/submissions/{submission_id}/audit-log`](#get-api-admin-campaign-submissions-submission-id-audit-log) | Get submission audit log | BearerAuth |
| POST | [`/api/admin/campaign/submissions/{submission_id}/state`](#post-api-admin-campaign-submissions-submission-id-state) | Transition submission workflow state | BearerAuth |
| POST | [`/api/admin/campaign/submissions/{submission_id}/content-edit`](#post-api-admin-campaign-submissions-submission-id-content-edit) | Save KR content edit | BearerAuth |
| POST | [`/api/admin/campaign/submissions/{submission_id}/translation`](#post-api-admin-campaign-submissions-submission-id-translation) | Save VN translation / reviewer feedback | BearerAuth |
| POST | [`/api/admin/campaign/submissions/{submission_id}/source-edit`](#post-api-admin-campaign-submissions-submission-id-source-edit) | Edit original source fields | BearerAuth |
| POST | [`/api/admin/campaign/submissions/{submission_id}/assign`](#post-api-admin-campaign-submissions-submission-id-assign) | Assign submission to a reviewer | BearerAuth |
| POST | [`/api/admin/campaign/submissions/{submission_id}/claim`](#post-api-admin-campaign-submissions-submission-id-claim) | Self-claim submission | BearerAuth |
| POST | [`/api/admin/campaign/submissions/{submission_id}/invalidate`](#post-api-admin-campaign-submissions-submission-id-invalidate) | Force-invalidate submission | BearerAuth |
| GET | [`/api/admin/campaign/stats/overview`](#get-api-admin-campaign-stats-overview) | Get campaign stats overview | BearerAuth |
| POST | [`/api/admin/campaign/submissions/{submission_id}/pdf`](#post-api-admin-campaign-submissions-submission-id-pdf) | Enqueue PDF render | BearerAuth |
| GET | [`/api/admin/campaign/submissions/{submission_id}/pdf/download`](#get-api-admin-campaign-submissions-submission-id-pdf-download) | Download generated PDF | BearerAuth |
| GET | [`/api/admin/campaign/submissions/{submission_id}/attachments/{idx}`](#get-api-admin-campaign-submissions-submission-id-attachments-idx) | Download answer attachment | BearerAuth |
| POST | [`/api/admin/campaign/submissions/{submission_id}/score`](#post-api-admin-campaign-submissions-submission-id-score) | Enqueue AI scoring | BearerAuth |
| POST | [`/api/admin/campaign/submissions/{submission_id}/email`](#post-api-admin-campaign-submissions-submission-id-email) | Enqueue result email | BearerAuth |
| POST | [`/api/admin/campaign/submissions/{submission_id}/resend-email`](#post-api-admin-campaign-submissions-submission-id-resend-email) | Re-enqueue result email | BearerAuth |
| GET | [`/api/admin/campaign/tasks/{task_id}/status`](#get-api-admin-campaign-tasks-task-id-status) | Poll background task status | BearerAuth |

## GET /api/admin/campaign/users

Summary: List campaign users

Auth: BearerAuth

### Description

List campaign applicants with their submission counts and latest status.

캠페인 응시자 목록 (제출 수 / 최신 상태 포함).

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `limit` | query | no | integer |  |
| `offset` | query | no | integer |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Successful Response | `application/json` | [CampaignUserListResponse](../schemas/admin-campaign.md#campaignuserlistresponse) |
| 401 | Missing or invalid admin JWT | - | - |
| 403 | Caller lacks a campaign role | - | - |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |

## GET /api/admin/campaign/users/{email}/submissions

Summary: List a user's submissions

Auth: BearerAuth

### Description

List all submissions for a given user (by email).

특정 사용자(이메일)의 제출 목록.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `email` | path | yes | string |  |
| `limit` | query | no | integer |  |
| `offset` | query | no | integer |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Successful Response | `application/json` | [CampaignSubmissionListResponse](../schemas/admin-campaign.md#campaignsubmissionlistresponse) |
| 401 | Missing or invalid admin JWT | - | - |
| 403 | Caller lacks a campaign role | - | - |
| 404 | User not found | - | - |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |

## GET /api/admin/campaign/contact-inquiries

Summary: List contact-us inquiries

Auth: BearerAuth

### Description

List leads captured from the landing-page "Contact us" form.

랜딩 페이지 문의(Contact us) 리드 목록.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `limit` | query | no | integer |  |
| `offset` | query | no | integer |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Successful Response | `application/json` | [CampaignContactInquiryListResponse](../schemas/external-campaign.md#campaigncontactinquirylistresponse) |
| 401 | Missing or invalid admin JWT | - | - |
| 403 | Caller lacks a campaign role | - | - |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |

## GET /api/admin/campaign/waitlist

Summary: List waitlist signups

Auth: BearerAuth

### Description

List landing-page pre-registration (사전 등록) waitlist signups.

랜딩 페이지 사전 등록 대기자 목록.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `limit` | query | no | integer |  |
| `offset` | query | no | integer |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Successful Response | `application/json` | [CampaignWaitlistListResponse](../schemas/admin-campaign.md#campaignwaitlistlistresponse) |
| 401 | Missing or invalid admin JWT | - | - |
| 403 | Caller lacks a campaign role | - | - |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |

## GET /api/admin/campaign/submissions

Summary: List submission review queue

Auth: BearerAuth

### Description

Flat cross-user submission queue, filterable by status and task type.

상태/유형 필터가 가능한 전체 제출 검토 큐.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `status` | query | no | string \| null |  |
| `task_type` | query | no | string \| null |  |
| `limit` | query | no | integer |  |
| `offset` | query | no | integer |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Successful Response | `application/json` | [CampaignSubmissionListResponse](../schemas/admin-campaign.md#campaignsubmissionlistresponse) |
| 401 | Missing or invalid admin JWT | - | - |
| 403 | Caller lacks a campaign role | - | - |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |

## GET /api/admin/campaign/reviewers

Summary: List campaign reviewers

Auth: BearerAuth

### Description

Users in the campaign role allowlists, for the assign/claim dropdown.

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Successful Response | `application/json` | [CampaignReviewerListResponse](../schemas/admin-campaign.md#campaignreviewerlistresponse) |
| 401 | Missing or invalid admin JWT | - | - |
| 403 | Caller lacks a campaign role | - | - |

## GET /api/admin/campaign/submissions/{submission_id}

Summary: Get submission detail

Auth: BearerAuth

### Description

Get the full review detail for a single submission.

단일 제출의 전체 검토 상세 정보.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `submission_id` | path | yes | string |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Successful Response | `application/json` | [CampaignSubmissionDetail](../schemas/admin-campaign.md#campaignsubmissiondetail) |
| 401 | Missing or invalid admin JWT | - | - |
| 403 | Caller lacks a campaign role | - | - |
| 404 | Submission not found | - | - |
| 422 | Invalid submission UUID | - | - |

## DELETE /api/admin/campaign/submissions/{submission_id}

Summary: Delete submission

Auth: BearerAuth

### Description

Hard-delete a submission. Audit-log rows cascade away with it
(FK ondelete=CASCADE). Restricted to ops/dev admins.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `submission_id` | path | yes | string |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Submission deleted | `application/json` | [OkResponse](../schemas/admin-campaign.md#okresponse) |
| 401 | Missing or invalid admin JWT | - | - |
| 403 | Caller lacks ops_admin/dev_admin role | - | - |
| 404 | Submission not found | - | - |
| 422 | Invalid submission UUID | - | - |

Response 200 example:

```json
{
  "ok": true
}
```

## GET /api/admin/campaign/submissions/{submission_id}/audit-log

Summary: Get submission audit log

Auth: BearerAuth

### Description

Return the recent audit-log entries for a submission.

제출의 최근 감사 로그 항목.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `submission_id` | path | yes | string |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Successful Response | `application/json` | [CampaignAuditLogResponse](../schemas/admin-campaign.md#campaignauditlogresponse) |
| 401 | Missing or invalid admin JWT | - | - |
| 403 | Caller lacks a campaign role | - | - |
| 422 | Invalid submission UUID | - | - |

## POST /api/admin/campaign/submissions/{submission_id}/state

Summary: Transition submission workflow state

Auth: BearerAuth

### Description

Move a submission to a new workflow status (with audit + SLA effects).

제출을 새 워크플로 상태로 전환.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `submission_id` | path | yes | string |  |

### Request Body

Media type: `application/json`

Schema: [CampaignStateTransitionRequest](../schemas/admin-campaign.md#campaignstatetransitionrequest)

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | New workflow status after transition | `application/json` | [WorkflowStateResponse](../schemas/admin-campaign.md#workflowstateresponse) |
| 401 | Missing or invalid admin JWT | - | - |
| 403 | Caller lacks a campaign role | - | - |
| 404 | Submission not found | - | - |
| 409 | Invalid state transition | - | - |
| 422 | Invalid submission UUID | - | - |

Response 200 example:

```json
{
  "workflow_status": "in_review"
}
```

## POST /api/admin/campaign/submissions/{submission_id}/content-edit

Summary: Save KR content edit

Auth: BearerAuth

### Description

Save the KR reviewer's edited Korean content for a submission.

KR 검토자가 수정한 한국어 콘텐츠 저장.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `submission_id` | path | yes | string |  |

### Request Body

Media type: `application/json`

Schema: [CampaignContentEditRequest](../schemas/admin-campaign.md#campaigncontenteditrequest)

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Edit saved | `application/json` | [OkResponse](../schemas/admin-campaign.md#okresponse) |
| 401 | Missing or invalid admin JWT | - | - |
| 403 | Caller lacks kr_content/ops_admin role | - | - |
| 404 | Submission not found | - | - |
| 422 | Invalid submission UUID | - | - |

Response 200 example:

```json
{
  "ok": true
}
```

## POST /api/admin/campaign/submissions/{submission_id}/translation

Summary: Save VN translation / reviewer feedback

Auth: BearerAuth

### Description

Save the Vietnamese translation (and optionally kr_feedback for KR/ops).

베트남어 번역 저장 (KR/운영자는 kr_feedback도 수정 가능).

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `submission_id` | path | yes | string |  |

### Request Body

Media type: `application/json`

Schema: [CampaignTranslationRequest](../schemas/admin-campaign.md#campaigntranslationrequest)

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Translation saved | `application/json` | [OkResponse](../schemas/admin-campaign.md#okresponse) |
| 401 | Missing or invalid admin JWT | - | - |
| 403 | Caller lacks vn_translator/ops_admin role, or a vn_translator attempted to edit kr_feedback | - | - |
| 404 | Submission not found | - | - |
| 422 | Invalid submission UUID | - | - |

Response 200 example:

```json
{
  "ok": true
}
```

## POST /api/admin/campaign/submissions/{submission_id}/source-edit

Summary: Edit original source fields

Auth: BearerAuth

### Description

Reviewer correction of the original source fields (question topic,
passage, applicant answer text, or Q51/Q52 answers).

Partial update — only the fields present in the request body are written.
Editing the applicant's submitted answer is sensitive, so a before/after
snapshot is written to the audit log.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `submission_id` | path | yes | string |  |

### Request Body

Media type: `application/json`

Schema: [CampaignSourceEditRequest](../schemas/admin-campaign.md#campaignsourceeditrequest)

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Source fields updated | `application/json` | [OkResponse](../schemas/admin-campaign.md#okresponse) |
| 401 | Missing or invalid admin JWT | - | - |
| 403 | Caller lacks kr_content/ops_admin/dev_admin role | - | - |
| 404 | Submission not found | - | - |
| 422 | Invalid UUID, no fields to update, or empty text | - | - |

Response 200 example:

```json
{
  "ok": true
}
```

## POST /api/admin/campaign/submissions/{submission_id}/assign

Summary: Assign submission to a reviewer

Auth: BearerAuth

### Description

Assign (or clear) the reviewer for a submission. ops_admin only.

제출 담당 검토자 지정/해제 (운영자 전용).

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `submission_id` | path | yes | string |  |

### Request Body

Media type: `application/json`

Schema: [CampaignAssignRequest](../schemas/admin-campaign.md#campaignassignrequest)

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Assignee updated | `application/json` | [OkResponse](../schemas/admin-campaign.md#okresponse) |
| 401 | Missing or invalid admin JWT | - | - |
| 403 | Caller lacks ops_admin role | - | - |
| 404 | Submission not found | - | - |
| 422 | Invalid submission or assignee UUID | - | - |

Response 200 example:

```json
{
  "ok": true
}
```

## POST /api/admin/campaign/submissions/{submission_id}/claim

Summary: Self-claim submission

Auth: BearerAuth

### Description

Self-claim: assign the submission to the calling reviewer.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `submission_id` | path | yes | string |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Submission claimed by caller | `application/json` | [OkClaimResponse](../schemas/admin-campaign.md#okclaimresponse) |
| 401 | Missing or invalid admin JWT | - | - |
| 403 | Caller lacks kr_content/vn_translator/ops_admin role | - | - |
| 404 | Submission not found | - | - |
| 422 | Invalid submission UUID | - | - |

Response 200 example:

```json
{
  "ok": true,
  "assignee_id": "3f...uuid"
}
```

## POST /api/admin/campaign/submissions/{submission_id}/invalidate

Summary: Force-invalidate submission

Auth: BearerAuth

### Description

Force a submission into the invalid state with a reason. ops/dev only.

제출을 사유와 함께 무효 처리 (운영/개발자 전용).

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `submission_id` | path | yes | string |  |

### Request Body

Media type: `application/json`

Schema: [CampaignInvalidateRequest](../schemas/admin-campaign.md#campaigninvalidaterequest)

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Submission invalidated | `application/json` | [OkResponse](../schemas/admin-campaign.md#okresponse) |
| 401 | Missing or invalid admin JWT | - | - |
| 403 | Caller lacks ops_admin/dev_admin role | - | - |
| 404 | Submission not found | - | - |
| 422 | Invalid submission UUID | - | - |

Response 200 example:

```json
{
  "ok": true
}
```

## GET /api/admin/campaign/stats/overview

Summary: Get campaign stats overview

Auth: BearerAuth

### Description

Aggregate campaign metrics: totals, status/type breakdowns, SLA risk.

캠페인 통계 요약 (총계, 상태/유형 분포, SLA 위험).

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Successful Response | `application/json` | [CampaignStatsOverview](../schemas/admin-campaign.md#campaignstatsoverview) |
| 401 | Missing or invalid admin JWT | - | - |
| 403 | Caller lacks a campaign role | - | - |

## POST /api/admin/campaign/submissions/{submission_id}/pdf

Summary: Enqueue PDF render

Auth: BearerAuth

### Description

Enqueue an ARQ job to render the submission's report PDF.

제출 리포트 PDF 렌더링 작업을 큐에 등록.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `submission_id` | path | yes | string |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 202 | Render job queued | `application/json` | [TaskEnqueuedResponse](../schemas/admin-campaign.md#taskenqueuedresponse) |
| 401 | Missing or invalid admin JWT | - | - |
| 403 | Caller lacks a PDF-capable campaign role | - | - |
| 404 | Submission not found | - | - |
| 422 | Invalid submission UUID | - | - |
| 503 | ARQ enqueue failed | - | - |

Response 202 example:

```json
{
  "task_id": "job-abc123",
  "status": "queued"
}
```

## GET /api/admin/campaign/submissions/{submission_id}/pdf/download

Summary: Download generated PDF

Auth: BearerAuth

### Description

Proxy the generated PDF through the API as an authenticated attachment.

The raw SeaweedFS URL is internal infra (unreachable in production) and
serves files inline. This endpoint adds campaign-role auth and sets
Content-Disposition so the browser downloads a properly named file.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `submission_id` | path | yes | string |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | PDF file as an attachment | `application/json` | - |
| 400 | Invalid storage key prefix | - | - |
| 401 | Missing or invalid admin JWT | - | - |
| 403 | Caller lacks a campaign role | - | - |
| 404 | Submission not found, PDF not generated, or empty object | - | - |
| 422 | Invalid submission UUID | - | - |
| 502 | Could not fetch PDF from storage | - | - |

## GET /api/admin/campaign/submissions/{submission_id}/attachments/{idx}

Summary: Download answer attachment

Auth: BearerAuth

### Description

Proxy an uploaded answer image through the API so the dashboard can render it.

The raw SeaweedFS URL is internal infra; we proxy behind campaign-role auth.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `submission_id` | path | yes | string |  |
| `idx` | path | yes | integer |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Attachment image (or PDF) bytes | `application/json` | - |
| 400 | Invalid storage key prefix | - | - |
| 401 | Missing or invalid admin JWT | - | - |
| 403 | Caller lacks a campaign role | - | - |
| 404 | Submission not found, index out of range, or empty object | - | - |
| 422 | Invalid submission UUID | - | - |
| 502 | Could not fetch image from storage | - | - |

## POST /api/admin/campaign/submissions/{submission_id}/score

Summary: Enqueue AI scoring

Auth: BearerAuth

### Description

Manually trigger AI evaluation for a submission still in `submitted`.

Scoring is not auto-enqueued on intake (token-cost control); a reviewer
inspects the submission first, then triggers eval on demand.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `submission_id` | path | yes | string |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 202 | Scoring job queued | `application/json` | [TaskEnqueuedResponse](../schemas/admin-campaign.md#taskenqueuedresponse) |
| 401 | Missing or invalid admin JWT | - | - |
| 403 | Caller lacks a scoring-capable campaign role | - | - |
| 404 | Submission not found | - | - |
| 409 | Submission is not in 'submitted' status | - | - |
| 422 | Invalid submission UUID | - | - |
| 503 | ARQ enqueue failed | - | - |

Response 202 example:

```json
{
  "task_id": "job-abc123",
  "status": "queued"
}
```

## POST /api/admin/campaign/submissions/{submission_id}/email

Summary: Enqueue result email

Auth: BearerAuth

### Description

Enqueue an ARQ job to email the generated PDF report to the applicant.

생성된 PDF 리포트를 응시자에게 메일로 발송하는 작업을 큐에 등록.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `submission_id` | path | yes | string |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 202 | Email job queued | `application/json` | [TaskEnqueuedResponse](../schemas/admin-campaign.md#taskenqueuedresponse) |
| 401 | Missing or invalid admin JWT | - | - |
| 403 | Caller lacks an email-capable campaign role | - | - |
| 404 | Submission not found | - | - |
| 409 | PDF not generated yet (POST /pdf first), or an email job is already in progress | - | - |
| 422 | Invalid submission UUID | - | - |

Response 202 example:

```json
{
  "task_id": "email:job-abc123",
  "status": "queued"
}
```

## POST /api/admin/campaign/submissions/{submission_id}/resend-email

Summary: Re-enqueue result email

Auth: BearerAuth

### Description

Re-send the result email (ops/dev only); reuses the existing PDF.

결과 메일 재발송 (운영/개발자 전용); 기존 PDF 재사용.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `submission_id` | path | yes | string |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 202 | Resend job queued | `application/json` | [TaskEnqueuedResponse](../schemas/admin-campaign.md#taskenqueuedresponse) |
| 401 | Missing or invalid admin JWT | - | - |
| 403 | Caller lacks ops_admin/dev_admin role | - | - |
| 404 | Submission not found | - | - |
| 409 | No PDF to attach | - | - |
| 422 | Invalid submission UUID | - | - |
| 503 | ARQ enqueue failed | - | - |

Response 202 example:

```json
{
  "task_id": "job-abc123",
  "status": "queued"
}
```

## GET /api/admin/campaign/tasks/{task_id}/status

Summary: Poll background task status

Auth: BearerAuth

### Description

Dashboard polls this every ~1s after kicking off /pdf or /email
so it can refresh the submission row once the worker writes the
result back to the DB.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `task_id` | path | yes | string |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Current ARQ job status (with result when complete) | `application/json` | [TaskStatusResponse](../schemas/admin-campaign.md#taskstatusresponse) |
| 401 | Missing or invalid admin JWT | - | - |
| 403 | Caller lacks a campaign role | - | - |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |

Response 200 example:

```json
{
  "task_id": "job-abc123",
  "status": "complete",
  "result": {}
}
```
