# External Campaign Schemas

Source: [OpenAPI JSON](https://api.dotoretopik.com/openapi.json)
Last synced: 2026-06-23

## Schema Index

| Schema | Type | Description |
| --- | --- | --- |
| [Body_upload_attachment_api_external_campaign_uploads_post](#body-upload-attachment-api-external-campaign-uploads-post) | object |  |
| [CampaignContactInquiryItem](#campaigncontactinquiryitem) | object | One row in the admin contact-inquiries list. |
| [CampaignContactInquiryListResponse](#campaigncontactinquirylistresponse) | object | Paginated list of contact inquiries for the admin dashboard. |
| [CampaignContactRequest](#campaigncontactrequest) | object | Landing-page "Contact us" inquiry (general lead / support capture). |
| [CampaignContactResponse](#campaigncontactresponse) | object | Acknowledgement returned after a contact inquiry submission. |
| [CampaignFollowUpRequest](#campaignfollowuprequest) | object | Post-result satisfaction / willingness-to-pay survey. |
| [CampaignFollowUpResponse](#campaignfollowupresponse) | object | Acknowledgement returned after a follow-up survey submission. |
| [CampaignStatusResponse](#campaignstatusresponse) | object | Polling endpoint used as a fallback when the dashboard wants a |
| [CampaignSubmitRequest](#campaignsubmitrequest) | object | Body posted by the Next.js form route after the user submits. |
| [CampaignSubmitResponse](#campaignsubmitresponse) | object | Acknowledgement returned after a submission is accepted. |
| [CampaignUploadResponse](#campaignuploadresponse) | object | Returned after a successful multipart file upload. |
| [CampaignWaitlistRequest](#campaignwaitlistrequest) | object | Landing-page waitlist signup (top-of-funnel lead capture). |
| [CampaignWaitlistResponse](#campaignwaitlistresponse) | object | Acknowledgement returned after a waitlist signup. |

## Body_upload_attachment_api_external_campaign_uploads_post

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `file` | yes | string |  |  |

## CampaignContactInquiryItem

One row in the admin contact-inquiries list.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `id` | yes | integer | Primary key of the contact inquiry. | 42 |
| `name` | yes | string | Name supplied by the person who submitted the inquiry. | Nguyen Van A |
| `email` | yes | string | Contact email (display projection of the stored value). | learner@example.com |
| `affiliation` | yes | string \| null | Organization/affiliation supplied by the contact; null if omitted. | Hanoi University |
| `inquiry_type` | yes | string | Localized inquiry-type label from the contact modal, stored as free text. | General inquiry |
| `message` | yes | string | Free-text message body of the inquiry. | I would like to know more about the campaign. |
| `locale` | yes | string \| null | Locale the inquiry was submitted from; null if unknown. | vi |
| `source` | yes | string | Capture source of the inquiry (free text). | contact_modal |
| `created_at` | yes | string | ISO-8601 UTC timestamp when the inquiry was created. | 2026-06-08T09:30:00Z |

## CampaignContactInquiryListResponse

Paginated list of contact inquiries for the admin dashboard.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `items` | yes | array<[CampaignContactInquiryItem](./external-campaign.md#campaigncontactinquiryitem)> | Page of contact-inquiry rows. | [] |
| `total` | yes | integer | Total number of contact inquiries matching the query. | 12 |

## CampaignContactRequest

Landing-page "Contact us" inquiry (general lead / support capture).

Independent of submissions/scoring. Append-only — a person may send
multiple inquiries. ``inquiry_type`` is the localized display label from
the modal's select, stored as free text.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `name` | yes | string | Name of the person submitting the inquiry. | Nguyen Van A |
| `email` | yes | string | Contact email for replies. | learner@example.com |
| `affiliation` | no | string \| null | Organization/affiliation; null if omitted. | Hanoi University |
| `inquiry_type` | yes | string | Localized inquiry-type label from the modal's select, stored as free text. | General inquiry |
| `message` | yes | string | Free-text message body of the inquiry. | I would like to know more about the campaign. |
| `locale` | no | string \| null | Locale the inquiry was submitted from; null if unknown. | vi |
| `source` | no | string | Capture source of the inquiry (free text). | contact_modal |
| `pathname` | no | string \| null | Page path where the inquiry was submitted; null if not captured. | /campaign |
| `referrer` | no | string \| null | HTTP referrer at submit time; null if not captured. | https://facebook.com/ |
| `user_agent` | no | string \| null | Browser user-agent string at submit time; null if not captured. | Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) |

Example:

```json
{
  "affiliation": "Hanoi University",
  "email": "learner@example.com",
  "inquiry_type": "General inquiry",
  "locale": "vi",
  "message": "I would like to know more about the campaign.",
  "name": "Nguyen Van A",
  "pathname": "/campaign",
  "source": "contact_modal"
}
```

## CampaignContactResponse

Acknowledgement returned after a contact inquiry submission.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `id` | yes | integer | Primary key of the stored inquiry. | 42 |
| `email` | yes | string | Email of the person who submitted the inquiry. | learner@example.com |
| `created_at` | yes | string | ISO-8601 UTC timestamp when the inquiry was created. | 2026-06-08T09:30:00Z |

## CampaignFollowUpRequest

Post-result satisfaction / willingness-to-pay survey.

Linked to the user by email only (no FK to submissions). Append-only.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `email` | yes | string | Email of the respondent (links the survey to the user). | learner@example.com |
| `helpfulness_score` | yes | integer | How helpful the result was, on a 1–5 scale. | 4 |
| `most_helpful_part` | yes | string | Which part of the result the respondent found most helpful (free text). | grammar_feedback |
| `retry_interest` | yes | string | Respondent's interest in retrying/resubmitting (free text). | yes |
| `ai_feedback_interest_after_result` | yes | string | Interest in AI feedback after seeing the result (free text). | very_interested |
| `paid_beta_interest` | yes | string | Interest in joining a paid beta (free text). | maybe |
| `freeform_feedback` | no | string \| null | Optional open-ended feedback; null if omitted. | The feedback was very detailed, thank you! |
| `source` | no | string | Capture source of the survey response (free text). | follow_up |
| `pathname` | no | string \| null | Page path where the survey was submitted; null if not captured. | /result |
| `referrer` | no | string \| null | HTTP referrer at submit time; null if not captured. | https://landing.example.com/result |
| `user_agent` | no | string \| null | Browser user-agent string at submit time; null if not captured. | Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) |

Example:

```json
{
  "ai_feedback_interest_after_result": "very_interested",
  "email": "learner@example.com",
  "freeform_feedback": "The feedback was very detailed, thank you!",
  "helpfulness_score": 4,
  "most_helpful_part": "grammar_feedback",
  "paid_beta_interest": "maybe",
  "pathname": "/result",
  "retry_interest": "yes",
  "source": "follow_up"
}
```

## CampaignFollowUpResponse

Acknowledgement returned after a follow-up survey submission.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `id` | yes | integer | Primary key of the stored survey response. | 42 |
| `email` | yes | string | Email of the respondent. | learner@example.com |
| `created_at` | yes | string | ISO-8601 UTC timestamp when the response was created. | 2026-06-08T09:30:00Z |

## CampaignStatusResponse

Polling endpoint used as a fallback when the dashboard wants a
fresh read without going through the admin auth path.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `submission_id` | yes | string | UUID of the submission being polled. | 3f9c1a2e-7b4d-4e1a-9c2f-0a1b2c3d4e5f |
| `workflow_status` | yes | enum(`submitted`, `ai_drafted`, `content_review`, `translation_review`, `pdf_ready`, `delivered`, `followup_sent`, `invalid`, `resend_required`) | Current workflow state of the submission. | ai_drafted |
| `feedback` | no | object \| null | Structured scoring feedback once available; null while pending. | {"summary":"Good structure, minor grammar issues."} |
| `total_score` | no | number \| null | Awarded score; null until scoring completes. | 42.5 |
| `max_score` | no | number \| null | Maximum possible score for this task type. | 50 |
| `error_message` | no | string \| null | Human-readable error if scoring failed; null otherwise. |  |
| `submitted_at` | yes | string | ISO-8601 UTC timestamp when the submission was received. | 2026-06-08T09:30:00Z |
| `completed_at` | no | string \| null | ISO-8601 UTC timestamp when scoring/delivery completed; null if pending. | 2026-06-08T09:35:00Z |
| `due_at` | yes | string | ISO-8601 UTC deadline by which the result is promised. | 2026-06-09T09:30:00Z |

## CampaignSubmitRequest

Body posted by the Next.js form route after the user submits.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `email` | yes | string | Applicant email; used to upsert a shadow user profile and to deliver results. | learner@example.com |
| `display_name` | yes | string | Applicant display name shown on the result PDF and dashboard. | Nguyen Van A |
| `language` | no | enum(`ko`, `vi`, `en`) | Preferred result/UI language. One of: 'ko', 'vi', 'en'. | vi |
| `marketing_consent` | no | boolean | Whether the applicant opted in to marketing follow-up emails. | true |
| `task_type` | yes | enum(`Q51`, `Q52`, `Q53`, `Q54`) | TOPIK writing task being submitted. One of: 'Q51', 'Q52', 'Q53', 'Q54'. | Q53 |
| `text` | yes | string | The applicant's written answer to be scored. | 저는 매일 아침 운동을 합니다. 건강을 위해서 운동이 중요하다고 생각합니다. |
| `passage_context` | no | string | Optional reading passage or prompt context the answer responds to. | 다음 글을 읽고 200~300자로 쓰십시오. |
| `provided_question_ids` | no | array<string> \| null | Q51/Q52 only: ids of the blanks being answered (max 3). Omit for Q53/Q54. | ["a","b"] |
| `provided_question_texts` | no | array<[ProvidedQuestion](./common.md#providedquestion)> \| null | Q51/Q52 only: prompt text for each answered blank (max 3). Omit for Q53/Q54. | [{"id":"a","text":"( ㉠ )에 들어갈 말을 쓰십시오."}] |
| `user_answers` | no | array<string> \| null | Q51/Q52 only: the applicant's text per blank, aligned to provided_question_ids (max 3). | ["감사합니다","다음에 또 오겠습니다"] |
| `question_topic_text` | no | string \| null | Q53/Q54 only: the essay topic/instruction. Required for Q53/Q54 at the service layer. | 현대 사회에서 환경 보호의 중요성에 대해 자신의 생각을 쓰십시오. |
| `image_url` | no | string \| null | Optional single uploaded answer image (handwritten answer photo). | https://cdn.example.com/uploads/answer-1.jpg |
| `image_urls` | no | array<string> \| null | Optional multi-image superset of image_url; up to 3 answer images per submission. | ["https://cdn.example.com/uploads/answer-1.jpg"] |
| `image_readable` | no | boolean \| null | Client hint indicating whether the uploaded image was legible enough to read. | true |
| `survey_response` | no | object \| null | Free-form intake survey answers, stored as JSONB. | {"goal":"study_abroad","target_level":4} |
| `source_channel` | no | string \| null | Acquisition channel the applicant arrived from (free text). | facebook_group |
| `community_group` | no | string \| null | Name of the community/group that referred the applicant. | TOPIK Study VN |
| `community_post_url` | no | string \| null | URL of the referring community post, if any. | https://facebook.com/groups/topikvn/posts/123 |
| `staff_owner` | no | string \| null | Staff member who owns/referred this lead (free text). | minh |
| `external_ref` | no | string \| null | Optional external reference id for cross-host parity; rarely set. | landing-2026-06-000123 |
| `webhook_url` | no | string \| null | Optional callback URL to notify when the workflow completes. | https://landing.example.com/api/webhooks/campaign |

Example:

```json
{
  "community_group": "TOPIK Study VN",
  "display_name": "Nguyen Van A",
  "email": "learner@example.com",
  "image_urls": [
    "https://cdn.example.com/uploads/answer-1.jpg"
  ],
  "language": "vi",
  "marketing_consent": true,
  "passage_context": "",
  "question_topic_text": "환경 보호의 중요성에 대해 쓰십시오.",
  "source_channel": "facebook_group",
  "task_type": "Q53",
  "text": "현대 사회에서 환경 보호는 매우 중요합니다. 첫째, ..."
}
```

## CampaignSubmitResponse

Acknowledgement returned after a submission is accepted.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `submission_id` | yes | string | UUID of the created submission, used for status polling. | 3f9c1a2e-7b4d-4e1a-9c2f-0a1b2c3d4e5f |
| `user_id` | yes | string | UUID of the (shadow) user profile the submission was attached to. | a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d |
| `workflow_status` | yes | enum(`submitted`, `ai_drafted`, `content_review`, `translation_review`, `pdf_ready`, `delivered`, `followup_sent`, `invalid`, `resend_required`) | Current workflow state, e.g. 'submitted' immediately after intake. | submitted |
| `is_duplicate` | yes | boolean | True if this submission matched an existing one and was deduplicated. | false |
| `due_at` | yes | string | ISO-8601 UTC deadline by which the result is promised. | 2026-06-09T09:30:00Z |
| `estimated_seconds` | no | integer | Rough estimated seconds until an AI draft is available. | 20 |

## CampaignUploadResponse

Returned after a successful multipart file upload.

The landing site stores ``url`` and posts it back as ``image_url``
on the following /submissions call.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `url` | yes | string | Public URL of the stored upload, posted back as image_url on /submissions. | https://cdn.example.com/uploads/answer-1.jpg |
| `key` | yes | string | Storage object key (path within the bucket). | campaign/2026-06/answer-1.jpg |
| `content_type` | yes | string | MIME type of the uploaded file. | image/jpeg |
| `bytes` | yes | integer | Size of the uploaded file in bytes. | 245678 |

## CampaignWaitlistRequest

Landing-page waitlist signup (top-of-funnel lead capture).

Independent of submissions/scoring — email + attribution only.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `email` | yes | string | Email to add to the waitlist. | learner@example.com |
| `locale` | no | string \| null | Locale the signup came from; null if unknown. | vi |
| `source` | no | string | Capture source of the signup (free text). | landing_hero |
| `pathname` | no | string \| null | Page path where the signup occurred; null if not captured. | /campaign |
| `referrer` | no | string \| null | HTTP referrer at signup time; null if not captured. | https://facebook.com/ |
| `user_agent` | no | string \| null | Browser user-agent string at signup time; null if not captured. | Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) |

Example:

```json
{
  "email": "learner@example.com",
  "locale": "vi",
  "pathname": "/campaign",
  "referrer": "https://facebook.com/",
  "source": "landing_hero",
  "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"
}
```

## CampaignWaitlistResponse

Acknowledgement returned after a waitlist signup.

| Field | Required | Type | Description | Example / Default |
| --- | --- | --- | --- | --- |
| `email` | yes | string | The email that was added to (or updated on) the waitlist. | learner@example.com |
| `created_at` | yes | string | ISO-8601 UTC timestamp when the entry was first created. | 2026-06-08T09:30:00Z |
| `updated_at` | yes | string | ISO-8601 UTC timestamp when the entry was last updated. | 2026-06-08T09:30:00Z |
| `submission_count` | yes | integer | Number of times this email signed up (deduplicated upsert counter). | 1 |
