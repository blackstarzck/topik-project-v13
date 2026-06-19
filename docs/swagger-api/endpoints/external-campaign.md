# External Campaign API

Source: [Swagger UI](https://api.dotoretopik.com/docs) / [OpenAPI JSON](https://api.dotoretopik.com/openapi.json)
Last synced: 2026-06-19

Scope: External campaign upload, submission, contact, and waitlist

## Endpoint Index

| Method | Path | Summary | Auth |
| --- | --- | --- | --- |
| POST | [`/api/external/campaign/contact`](#post-api-external-campaign-contact) | Submit a 'Contact us' inquiry (general lead / support) | CampaignApiKey |
| POST | [`/api/external/campaign/follow-up`](#post-api-external-campaign-follow-up) | Submit the post-result satisfaction survey | CampaignApiKey |
| POST | [`/api/external/campaign/submissions`](#post-api-external-campaign-submissions) | Create a campaign submission (step 2, accepted for review) | CampaignApiKey |
| GET | [`/api/external/campaign/submissions/{submission_id}`](#get-api-external-campaign-submissions-submission-id) | Poll the status / result of a submission | CampaignApiKey |
| POST | [`/api/external/campaign/uploads`](#post-api-external-campaign-uploads) | Upload an answer-sheet attachment (step 1 of submission) | CampaignApiKey |
| POST | [`/api/external/campaign/waitlist`](#post-api-external-campaign-waitlist) | Join the landing-page waitlist (top-of-funnel lead) | CampaignApiKey |

## POST /api/external/campaign/contact

Summary: Submit a 'Contact us' inquiry (general lead / support)

Auth: CampaignApiKey

### Description

Capture a landing-page "Contact us" inquiry (general lead / support).

Send ``name``, ``email``, ``message`` plus optional ``affiliation``,
``inquiry_type``, ``locale`` and attribution fields. Append-only and keyed
by email only (no FK to submissions). Independent of scoring — this is
top-of-funnel contact capture from the v4 modal. Returns the row ``id`` and
``email``.

문의 양식을 제출합니다 (추가 전용).

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `X-API-Key` | header | no | string \| null |  |

### Request Body

Media type: `application/json`

Schema: [CampaignContactRequest](../schemas/external-campaign.md#campaigncontactrequest)

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 201 | Inquiry stored (append-only). | `application/json` | [CampaignContactResponse](../schemas/external-campaign.md#campaigncontactresponse) |
| 401 | Missing or invalid X-API-Key. | - | - |
| 422 | Request body fails validation. | - | - |

Response 201 example:

```json
{
  "id": 42,
  "email": "learner@example.com",
  "created_at": "2026-06-08T09:30:00Z"
}
```

## POST /api/external/campaign/follow-up

Summary: Submit the post-result satisfaction survey

Auth: CampaignApiKey

### Description

Capture the post-result satisfaction / willingness-to-pay survey.

Send ``email`` plus survey fields (``helpfulness_score``,
``most_helpful_part``, ``retry_interest``,
``ai_feedback_interest_after_result``, ``paid_beta_interest``,
``freeform_feedback``) and optional attribution. Append-only and keyed by
email only (no FK to submissions). Returns the new row ``id`` and ``email``.

결과 확인 후 만족도 설문을 제출합니다 (추가 전용).

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `X-API-Key` | header | no | string \| null |  |

### Request Body

Media type: `application/json`

Schema: [CampaignFollowUpRequest](../schemas/external-campaign.md#campaignfollowuprequest)

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 201 | Survey response stored (append-only). | `application/json` | [CampaignFollowUpResponse](../schemas/external-campaign.md#campaignfollowupresponse) |
| 401 | Missing or invalid X-API-Key. | - | - |
| 422 | Request body fails validation. | - | - |

Response 201 example:

```json
{
  "id": 42,
  "email": "learner@example.com",
  "created_at": "2026-06-08T09:30:00Z"
}
```

## POST /api/external/campaign/submissions

Summary: Create a campaign submission (step 2, accepted for review)

Auth: CampaignApiKey

### Description

Step 2: create a campaign submission once the user finishes the form.

Send the answer payload as JSON. For Q53/Q54 include the uploaded
``image_url`` (or ``image_urls``) returned by POST /uploads, or inline
``text`` of at least 100 chars. For Q51/Q52 send exactly 3 entries each of
``user_answers``, ``provided_question_texts`` and ``provided_question_ids``.

The shadow user is upserted by email; a same-email + same-task submission
that is still in flight is accepted but flagged (``is_duplicate=true`` and
stored as ``invalid``). AI scoring is NOT auto-run — a reviewer triggers it
later, so the submission stays ``submitted`` until then.

Returns ``202`` with ``submission_id`` (poll GET /submissions/{id}),
``user_id``, ``workflow_status``, ``is_duplicate`` and the SLA ``due_at``.

답안을 제출합니다. 응답의 submission_id로 상태를 폴링하세요.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `X-API-Key` | header | no | string \| null |  |

### Request Body

Media type: `application/json`

Schema: [CampaignSubmitRequest](../schemas/external-campaign.md#campaignsubmitrequest)

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 202 | Accepted. Poll GET /submissions/{id} for status. | `application/json` | [CampaignSubmitResponse](../schemas/external-campaign.md#campaignsubmitresponse) |
| 400 | Campaign window is closed (detail `CAMPAIGN_WINDOW_CLOSED`). | - | - |
| 401 | Missing or invalid X-API-Key. | - | - |
| 422 | Request body fails Pydantic validation, or task-specific rules fail: Q51/Q52 require exactly 3 each of user_answers, provided_question_texts and provided_question_ids; Q53/Q54 require an image (image_url/image_urls) or text >= 100 chars. | - | - |

Response 202 example:

```json
{
  "submission_id": "3f9c1a2e-7b4d-4e1a-9c2f-0a1b2c3d4e5f",
  "user_id": "a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
  "workflow_status": "submitted",
  "is_duplicate": false,
  "due_at": "2026-06-09T09:30:00Z"
}
```

## GET /api/external/campaign/submissions/{submission_id}

Summary: Poll the status / result of a submission

Auth: CampaignApiKey

### Description

Polling fallback: read the latest status and (once scored) result of a
submission by its UUID.

Use the ``submission_id`` returned by POST /submissions. While pending,
``feedback``, ``total_score``, ``max_score`` and ``completed_at`` are null;
they populate once a reviewer triggers and AI scoring completes. ``due_at``
is the SLA deadline.

submission_id로 채점 상태와 결과를 폴링합니다.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `submission_id` | path | yes | string |  |
| `X-API-Key` | header | no | string \| null |  |

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 200 | Current status. `feedback`/scores populate once scored. | `application/json` | [CampaignStatusResponse](../schemas/external-campaign.md#campaignstatusresponse) |
| 401 | Missing or invalid X-API-Key. | - | - |
| 404 | No submission exists with that id. | - | - |
| 422 | submission_id is not a valid UUID. | - | - |

Response 200 example:

```json
{
  "submission_id": "3f9c1a2e-7b4d-4e1a-9c2f-0a1b2c3d4e5f",
  "workflow_status": "ai_drafted",
  "feedback": {
    "summary": "..."
  },
  "total_score": 22,
  "max_score": 30,
  "submitted_at": "2026-06-08T09:30:00Z",
  "completed_at": "2026-06-08T09:35:00Z",
  "due_at": "2026-06-09T09:30:00Z"
}
```

## POST /api/external/campaign/uploads

Summary: Upload an answer-sheet attachment (step 1 of submission)

Auth: CampaignApiKey

### Description

Step 1 of a submission: upload one attachment and get back a public URL.

Send a single ``multipart/form-data`` part named ``file``. Allowed types:
JPEG, PNG, WebP, HEIC/HEIF, PDF, or plain text (max 20 MB). Content is
validated against its declared MIME type via magic bytes.

Returns ``url`` (the public CDN URL), ``key``, ``content_type`` and
``bytes``. Pass ``url`` back as ``image_url`` (or one entry of
``image_urls``) on the following POST /submissions call.

업로드한 파일의 공개 URL을 받아 /submissions의 image_url로 전달합니다.

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `X-API-Key` | header | no | string \| null |  |

### Request Body

Media type: `multipart/form-data`

Schema: [Body_upload_attachment_api_external_campaign_uploads_post](../schemas/external-campaign.md#body-upload-attachment-api-external-campaign-uploads-post)

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 201 | Stored. Use `url` as `image_url` on POST /submissions. | `application/json` | [CampaignUploadResponse](../schemas/external-campaign.md#campaignuploadresponse) |
| 400 | Empty upload (zero bytes). | - | - |
| 401 | Missing or invalid X-API-Key. | - | - |
| 413 | File exceeds the 20 MB limit. | - | - |
| 415 | Unsupported file type, or file content does not match the declared Content-Type (magic-byte check failed). | - | - |
| 422 | Validation Error | `application/json` | [HTTPValidationError](../schemas/common.md#httpvalidationerror) |
| 502 | Storage backend (SeaweedFS) upload failed. | - | - |

Response 201 example:

```json
{
  "url": "https://cdn.example.com/campaign-uploads/uuid.jpg",
  "key": "campaign-uploads/uuid.jpg",
  "content_type": "image/jpeg",
  "bytes": 348512
}
```

## POST /api/external/campaign/waitlist

Summary: Join the landing-page waitlist (top-of-funnel lead)

Auth: CampaignApiKey

### Description

Capture a landing-page waitlist signup (top-of-funnel lead).

Send ``email`` plus optional attribution (``locale``, ``source``,
``pathname``, ``referrer``, ``user_agent``). Idempotent per email — a repeat
signup refreshes attribution and bumps ``submission_count``. Independent of
submissions / scoring. Returns the stored email and timestamps.

대기자 명단에 이메일을 등록합니다 (이메일당 멱등).

### Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `X-API-Key` | header | no | string \| null |  |

### Request Body

Media type: `application/json`

Schema: [CampaignWaitlistRequest](../schemas/external-campaign.md#campaignwaitlistrequest)

### Responses

| Status | Description | Media | Schema |
| --- | --- | --- | --- |
| 201 | Created or refreshed. Idempotent per email. | `application/json` | [CampaignWaitlistResponse](../schemas/external-campaign.md#campaignwaitlistresponse) |
| 401 | Missing or invalid X-API-Key. | - | - |
| 422 | Request body fails validation (e.g. bad email). | - | - |

Response 201 example:

```json
{
  "email": "learner@example.com",
  "created_at": "2026-06-08T09:30:00Z",
  "updated_at": "2026-06-08T09:30:00Z",
  "submission_count": 1
}
```
