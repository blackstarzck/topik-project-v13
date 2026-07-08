# OpenAPI Reference

Index generated from the live Swagger OpenAPI JSON.

| Item | Value |
| --- | --- |
| Swagger UI | [https://api.dotoretopik.com/docs](https://api.dotoretopik.com/docs) |
| OpenAPI JSON | [https://api.dotoretopik.com/openapi.json](https://api.dotoretopik.com/openapi.json) |
| Last synced | 2026-07-07 |
| OpenAPI version | `3.1.0` |
| API title | `TalkPik AI Service` |
| API version | `0.1.0` |
| Paths | 82 |
| Operations | 87 |
| Component schemas | 133 |
| Security schemes | `BearerAuth`, `CampaignApiKey` |

## Endpoint Files

| File | Operations | Scope |
| --- | ---: | --- |
| [Account](./endpoints/account.md) | 1 | User account self-service |
| [Eval Auth](./endpoints/eval-auth.md) | 1 | Eval dashboard login |
| [Admin Users](./endpoints/admin-users.md) | 6 | Admin/user account management; reference only, not v13 user-app scope |
| [Admin Eval](./endpoints/admin-eval.md) | 12 | Evaluation operations, reviews, and datasets |
| [Admin Reading](./endpoints/admin-reading.md) | 3 | Admin reading question-bank operations; reference only, admin-only, not v13 user-app scope |
| [Admin Campaign](./endpoints/admin-campaign.md) | 24 | Campaign admin review, email, PDF, and stats |
| [External Campaign](./endpoints/external-campaign.md) | 6 | External campaign upload, submission, contact, and waitlist |
| [Writing](./endpoints/writing.md) | 12 | TOPIK writing submission, generation, tutor sessions, history, drafts, and PDF |
| [Reading](./endpoints/reading.md) | 9 | Reading generation, submission, sessions, results, and bookmarks |
| [Listening](./endpoints/listening.md) | 10 | Listening sessions, submissions, results, audio, and bookmarks |
| [Evaluation](./endpoints/evaluation.md) | 3 | Async writing evaluation status, SSE stream, and detailed feedback lookup |

## Full Endpoint Index

| Method | Path | Tag | Summary |
| --- | --- | --- | --- |
| DELETE | `/api/auth/profile` | Account | Delete (soft-delete) own account |
| GET | `/api/admin/campaign/contact-inquiries` | Admin Campaign | List contact-us inquiries |
| GET | `/api/admin/campaign/reviewers` | Admin Campaign | List campaign reviewers |
| GET | `/api/admin/campaign/stats/overview` | Admin Campaign | Get campaign stats overview |
| GET | `/api/admin/campaign/submissions` | Admin Campaign | List submission review queue |
| DELETE | `/api/admin/campaign/submissions/{submission_id}` | Admin Campaign | Delete submission |
| GET | `/api/admin/campaign/submissions/{submission_id}` | Admin Campaign | Get submission detail |
| POST | `/api/admin/campaign/submissions/{submission_id}/assign` | Admin Campaign | Assign submission to a reviewer |
| GET | `/api/admin/campaign/submissions/{submission_id}/attachments/{idx}` | Admin Campaign | Download answer attachment |
| GET | `/api/admin/campaign/submissions/{submission_id}/audit-log` | Admin Campaign | Get submission audit log |
| POST | `/api/admin/campaign/submissions/{submission_id}/claim` | Admin Campaign | Self-claim submission |
| POST | `/api/admin/campaign/submissions/{submission_id}/content-edit` | Admin Campaign | Save KR content edit |
| POST | `/api/admin/campaign/submissions/{submission_id}/email` | Admin Campaign | Enqueue result email |
| POST | `/api/admin/campaign/submissions/{submission_id}/invalidate` | Admin Campaign | Force-invalidate submission |
| POST | `/api/admin/campaign/submissions/{submission_id}/pdf` | Admin Campaign | Enqueue PDF render |
| GET | `/api/admin/campaign/submissions/{submission_id}/pdf/download` | Admin Campaign | Download generated PDF |
| POST | `/api/admin/campaign/submissions/{submission_id}/resend-email` | Admin Campaign | Re-enqueue result email |
| POST | `/api/admin/campaign/submissions/{submission_id}/score` | Admin Campaign | Enqueue AI scoring |
| POST | `/api/admin/campaign/submissions/{submission_id}/source-edit` | Admin Campaign | Edit original source fields |
| POST | `/api/admin/campaign/submissions/{submission_id}/state` | Admin Campaign | Transition submission workflow state |
| POST | `/api/admin/campaign/submissions/{submission_id}/translation` | Admin Campaign | Save VN translation / reviewer feedback |
| GET | `/api/admin/campaign/tasks/{task_id}/status` | Admin Campaign | Poll background task status |
| GET | `/api/admin/campaign/users` | Admin Campaign | List campaign users |
| GET | `/api/admin/campaign/users/{email}/submissions` | Admin Campaign | List a user's submissions |
| GET | `/api/admin/campaign/waitlist` | Admin Campaign | List waitlist signups |
| GET | `/api/admin/eval/datasets` | admin-eval | List golden datasets (eval runs) |
| GET | `/api/admin/eval/datasets/{dataset_id}/results` | admin-eval | Get dataset case results |
| GET | `/api/admin/eval/datasets/{dataset_id}/stats` | admin-eval | Get dataset statistics |
| GET | `/api/admin/eval/reviews/{target_type}/{target_id}` | admin-eval | List all expert reviews |
| POST | `/api/admin/eval/reviews/{target_type}/{target_id}` | admin-eval | Submit or update expert review |
| GET | `/api/admin/eval/reviews/{target_type}/{target_id}/my` | admin-eval | Get my expert review |
| POST | `/api/admin/eval/run` | admin-eval | Trigger evaluation pipeline run |
| GET | `/api/admin/eval/run/{run_id}/status` | admin-eval | Poll eval run status |
| GET | `/api/admin/eval/stats/overview` | admin-eval | Dashboard overview statistics |
| GET | `/api/admin/eval/submissions/{submission_id}` | admin-eval | Get submission detail |
| GET | `/api/admin/eval/users` | admin-eval | List users with graded submissions |
| GET | `/api/admin/eval/users/{user_id}/submissions` | admin-eval | List a user's graded submissions |
| GET | `/api/admin/reading/questions` | Admin Reading | List Questions |
| PUT | `/api/admin/reading/questions/{question_id}` | Admin Reading | Edit Question |
| POST | `/api/admin/reading/questions/{question_id}/review` | Admin Reading | Review Question |
| GET | `/api/admin/users` | admin-users | List users (paginated, searchable) |
| POST | `/api/admin/users` | admin-users | Create an admin/user account |
| DELETE | `/api/admin/users/{user_id}` | admin-users | Soft-delete a user |
| GET | `/api/admin/users/{user_id}` | admin-users | Get one user by id |
| PATCH | `/api/admin/users/{user_id}` | admin-users | Update a user's name and/or roles |
| POST | `/api/admin/users/{user_id}/password` | admin-users | Reset a user's password (admin-set) |
| POST | `/api/eval/auth/login` | eval-auth | Eval dashboard login |
| GET | `/api/evaluation/{submission_id}` | Evaluation | Poll writing evaluation status |
| GET | `/api/evaluation/{submission_id}/feedback` | Evaluation | Get detailed writing evaluation feedback |
| GET | `/api/evaluation/{submission_id}/stream` | Evaluation | Stream writing evaluation results (SSE) |
| POST | `/api/external/campaign/contact` | External Campaign | Submit a 'Contact us' inquiry (general lead / support) |
| POST | `/api/external/campaign/follow-up` | External Campaign | Submit the post-result satisfaction survey |
| POST | `/api/external/campaign/submissions` | External Campaign | Create a campaign submission (step 2, accepted for review) |
| GET | `/api/external/campaign/submissions/{submission_id}` | External Campaign | Poll the status / result of a submission |
| POST | `/api/external/campaign/uploads` | External Campaign | Upload an answer-sheet attachment (step 1 of submission) |
| POST | `/api/external/campaign/waitlist` | External Campaign | Join the landing-page waitlist (top-of-funnel lead) |
| GET | `/api/listening/audio-bank/{filename}` | listening | Stream shared bank audio (signed proxy) |
| GET | `/api/listening/audio/{session_id}/{filename}` | listening | Stream listening problem audio (signed proxy) |
| POST | `/api/listening/bookmark/{problem_id}` | listening | Toggle bookmark on a listening problem |
| GET | `/api/listening/history` | listening | Get listening submission history |
| GET | `/api/listening/question-types` | listening | List listening question types for a level |
| POST | `/api/listening/session` | listening | Create a listening session (blocking) |
| GET | `/api/listening/session/{session_id}` | listening | Get listening session state |
| GET | `/api/listening/session/{session_id}/results` | listening | Get listening session results |
| POST | `/api/listening/session/{session_id}/submit` | listening | Submit an answer for a listening problem |
| POST | `/api/listening/session/stream` | listening | Create a listening session (SSE stream) |
| POST | `/api/reading/bookmark/{problem_id}` | reading | Toggle a reading bookmark |
| POST | `/api/reading/generate` | reading | Generate a reading problem |
| GET | `/api/reading/history` | reading | Get reading submission history |
| GET | `/api/reading/question-types` | reading | List reading question types |
| GET | `/api/reading/session/{session_id}` | reading | Get reading session state |
| GET | `/api/reading/session/{session_id}/results` | reading | Get reading session results |
| POST | `/api/reading/session/{session_id}/submit` | reading | Submit a session answer |
| POST | `/api/reading/session/stream` | reading | Create a reading session (SSE stream) |
| POST | `/api/reading/submit` | reading | Submit a reading answer |
| POST | `/api/writing/chat` | Writing | AI writing chat tutor (SSE stream) |
| GET | `/api/writing/chat/sessions` | Writing | List the user's tutor chat sessions |
| GET | `/api/writing/chat/sessions/{session_id}` | Writing | Get one tutor session with its full transcript |
| GET | `/api/writing/feedback/{submission_id}/export-pdf` | Writing | Export feedback as PDF |
| POST | `/api/writing/generate` | Writing | Generate & persist a TOPIK II writing problem (v2) |
| GET | `/api/writing/history` | Writing | Get writing submission history |
| DELETE | `/api/writing/history/{submission_id}` | Writing | Delete writing submission |
| POST | `/api/writing/save-draft` | Writing | Auto-save writing draft |
| POST | `/api/writing/submissions/start` | Writing | Start a writing attempt (draft submission + tutor session) |
| POST | `/api/writing/submit` | Writing | Submit writing for AI evaluation |
| GET | `/api/writing/tasks` | Writing | List writing questions across types (§7.9 view, 노출 가능 only) |
| GET | `/api/writing/tasks/{task_type}` | Writing | List TOPIK II writing questions of a type (메타데이터 적용) |

## Schema Files

| File | Schemas |
| --- | ---: |
| [Common](./schemas/common.md) | 3 |
| [Eval Auth](./schemas/eval-auth.md) | 3 |
| [Admin Users](./schemas/admin-users.md) | 5 |
| [Admin Eval](./schemas/admin-eval.md) | 18 |
| [Admin Reading](./schemas/admin-reading.md) | 4 |
| [Admin Campaign](./schemas/admin-campaign.md) | 24 |
| [External Campaign](./schemas/external-campaign.md) | 13 |
| [Writing](./schemas/writing.md) | 22 |
| [Reading](./schemas/reading.md) | 15 |
| [Listening](./schemas/listening.md) | 17 |
| [Evaluation](./schemas/evaluation.md) | 9 |

## Full Schema Index

| Schema | File | Description |
| --- | --- | --- |
| [HTTPValidationError](./schemas/common.md#httpvalidationerror) | `common.md` |  |
| [ProvidedQuestion](./schemas/common.md#providedquestion) | `common.md` | A single prompt blank shown to the applicant for Q51/Q52 fill-in tasks. |
| [ValidationError](./schemas/common.md#validationerror) | `common.md` |  |
| [LoginRequest](./schemas/eval-auth.md#loginrequest) | `eval-auth.md` |  |
| [LoginResponse](./schemas/eval-auth.md#loginresponse) | `eval-auth.md` | JWT access/refresh tokens plus the authenticated user's profile. |
| [LoginUser](./schemas/eval-auth.md#loginuser) | `eval-auth.md` | Authenticated user profile embedded in the login response. |
| [AdminCreateUserRequest](./schemas/admin-users.md#admincreateuserrequest) | `admin-users.md` |  |
| [AdminResetPasswordRequest](./schemas/admin-users.md#adminresetpasswordrequest) | `admin-users.md` |  |
| [AdminUpdateUserRequest](./schemas/admin-users.md#adminupdateuserrequest) | `admin-users.md` |  |
| [AdminUserListResponse](./schemas/admin-users.md#adminuserlistresponse) | `admin-users.md` |  |
| [AdminUserResponse](./schemas/admin-users.md#adminuserresponse) | `admin-users.md` |  |
| [DatasetResultsResponse](./schemas/admin-eval.md#datasetresultsresponse) | `admin-eval.md` | Paginated per-case results for an eval run. |
| [DatasetStatsResponse](./schemas/admin-eval.md#datasetstatsresponse) | `admin-eval.md` | Aggregate statistics for one eval run (from `compute_stats`). |
| [DatasetsResponse](./schemas/admin-eval.md#datasetsresponse) | `admin-eval.md` | Paginated eval-run records from the SQLite eval database. |
| [EvalRunRequest](./schemas/admin-eval.md#evalrunrequest) | `admin-eval.md` |  |
| [EvalRunResponse](./schemas/admin-eval.md#evalrunresponse) | `admin-eval.md` | Acknowledgement returned when an eval subprocess is started. |
| [EvalRunStatusResponse](./schemas/admin-eval.md#evalrunstatusresponse) | `admin-eval.md` | Current eval run state stored in Redis (TTL 2h). |
| [EvalUserItem](./schemas/admin-eval.md#evaluseritem) | `admin-eval.md` | A user who has at least one graded submission. |
| [EvalUsersResponse](./schemas/admin-eval.md#evalusersresponse) | `admin-eval.md` | Paginated list of users with graded submissions. |
| [ExpertReview](./schemas/admin-eval.md#expertreview) | `admin-eval.md` | A persisted expert review. |
| [OverviewStatsResponse](./schemas/admin-eval.md#overviewstatsresponse) | `admin-eval.md` | High-level aggregate stats for the eval dashboard header. |
| [ReviewListResponse](./schemas/admin-eval.md#reviewlistresponse) | `admin-eval.md` | All expert reviews submitted for a target (multi-reviewer). |
| [src__api__routes__admin_eval__ReviewRequest](./schemas/admin-eval.md#src-api-routes-admin-eval-reviewrequest) | `admin-eval.md` | Expert review request. |
| [SubmissionDetailFeedback](./schemas/admin-eval.md#submissiondetailfeedback) | `admin-eval.md` | AI feedback record within the detail response. |
| [SubmissionDetailResponse](./schemas/admin-eval.md#submissiondetailresponse) | `admin-eval.md` | Full submission detail: submission record, feedback, and linked task. |
| [SubmissionDetailSubmission](./schemas/admin-eval.md#submissiondetailsubmission) | `admin-eval.md` | Core submission record within the detail response. |
| [SubmissionDetailTask](./schemas/admin-eval.md#submissiondetailtask) | `admin-eval.md` | Writing task metadata within the detail response (null when no task linked). |
| [UserSubmissionItem](./schemas/admin-eval.md#usersubmissionitem) | `admin-eval.md` | A single graded writing submission for a user. |
| [UserSubmissionsResponse](./schemas/admin-eval.md#usersubmissionsresponse) | `admin-eval.md` | Paginated list of a user's graded submissions. |
| [EditRequest](./schemas/admin-reading.md#editrequest) | `admin-reading.md` | Admin reading bank edit request. |
| [ReadingBankItem](./schemas/admin-reading.md#readingbankitem) | `admin-reading.md` | One reading bank item. |
| [ReadingBankListResponse](./schemas/admin-reading.md#readingbanklistresponse) | `admin-reading.md` | Paginated reading bank list. |
| [src__api__routes__admin_reading__ReviewRequest](./schemas/admin-reading.md#src-api-routes-admin-reading-reviewrequest) | `admin-reading.md` | Admin reading review status request. |
| [CampaignAssignRequest](./schemas/admin-campaign.md#campaignassignrequest) | `admin-campaign.md` | Admin request to assign or clear the reviewer on a submission. |
| [CampaignAuditEntry](./schemas/admin-campaign.md#campaignauditentry) | `admin-campaign.md` | One entry in a submission's audit log. |
| [CampaignAuditLogResponse](./schemas/admin-campaign.md#campaignauditlogresponse) | `admin-campaign.md` | Audit log entries for a submission. |
| [CampaignContentEditRequest](./schemas/admin-campaign.md#campaigncontenteditrequest) | `admin-campaign.md` | KR content reviewer overlays edits on top of the AI draft. The |
| [CampaignInvalidateRequest](./schemas/admin-campaign.md#campaigninvalidaterequest) | `admin-campaign.md` | Admin request to mark a submission invalid. |
| [CampaignReviewer](./schemas/admin-campaign.md#campaignreviewer) | `admin-campaign.md` | One assignable reviewer for the assign/claim dropdown. |
| [CampaignReviewerListResponse](./schemas/admin-campaign.md#campaignreviewerlistresponse) | `admin-campaign.md` | List of assignable reviewers for the admin dashboard. |
| [CampaignSourceEditRequest](./schemas/admin-campaign.md#campaignsourceeditrequest) | `admin-campaign.md` | Reviewer correction of the original source fields on a submission. |
| [CampaignStateTransitionRequest](./schemas/admin-campaign.md#campaignstatetransitionrequest) | `admin-campaign.md` | Admin request to move a submission to a new workflow status. |
| [CampaignStatsOverview](./schemas/admin-campaign.md#campaignstatsoverview) | `admin-campaign.md` | Aggregate campaign metrics for the admin overview dashboard. |
| [CampaignSubmissionDetail](./schemas/admin-campaign.md#campaignsubmissiondetail) | `admin-campaign.md` | Full read-side projection of a submission used by the eval |
| [CampaignSubmissionListItem](./schemas/admin-campaign.md#campaignsubmissionlistitem) | `admin-campaign.md` | One submission row in the admin per-user or cross-user queue. |
| [CampaignSubmissionListResponse](./schemas/admin-campaign.md#campaignsubmissionlistresponse) | `admin-campaign.md` | Paginated list of submissions for the admin dashboard. |
| [CampaignSubmissionUserDetail](./schemas/admin-campaign.md#campaignsubmissionuserdetail) | `admin-campaign.md` | Embedded applicant identity within a submission detail. |
| [CampaignTranslationRequest](./schemas/admin-campaign.md#campaigntranslationrequest) | `admin-campaign.md` | KR/VN finalized feedback and translation submitted by a reviewer. |
| [CampaignUserListResponse](./schemas/admin-campaign.md#campaignuserlistresponse) | `admin-campaign.md` | Paginated list of campaign users for the admin dashboard. |
| [CampaignUserSummary](./schemas/admin-campaign.md#campaignusersummary) | `admin-campaign.md` | One row in GET /api/admin/campaign/users. |
| [CampaignWaitlistItem](./schemas/admin-campaign.md#campaignwaitlistitem) | `admin-campaign.md` | One row in the admin waitlist list. |
| [CampaignWaitlistListResponse](./schemas/admin-campaign.md#campaignwaitlistlistresponse) | `admin-campaign.md` | Paginated list of waitlist entries for the admin dashboard. |
| [OkClaimResponse](./schemas/admin-campaign.md#okclaimresponse) | `admin-campaign.md` | Self-claim acknowledgement carrying the new assignee id. |
| [OkResponse](./schemas/admin-campaign.md#okresponse) | `admin-campaign.md` | Generic success acknowledgement for mutation endpoints. |
| [TaskEnqueuedResponse](./schemas/admin-campaign.md#taskenqueuedresponse) | `admin-campaign.md` | ARQ enqueue acknowledgement returned by the 202 task endpoints |
| [TaskStatusResponse](./schemas/admin-campaign.md#taskstatusresponse) | `admin-campaign.md` | Current ARQ job status from the task-status poll endpoint. ``result`` |
| [WorkflowStateResponse](./schemas/admin-campaign.md#workflowstateresponse) | `admin-campaign.md` | New workflow status after a state transition. |
| [Body_upload_attachment_api_external_campaign_uploads_post](./schemas/external-campaign.md#body-upload-attachment-api-external-campaign-uploads-post) | `external-campaign.md` |  |
| [CampaignContactInquiryItem](./schemas/external-campaign.md#campaigncontactinquiryitem) | `external-campaign.md` | One row in the admin contact-inquiries list. |
| [CampaignContactInquiryListResponse](./schemas/external-campaign.md#campaigncontactinquirylistresponse) | `external-campaign.md` | Paginated list of contact inquiries for the admin dashboard. |
| [CampaignContactRequest](./schemas/external-campaign.md#campaigncontactrequest) | `external-campaign.md` | Landing-page "Contact us" inquiry (general lead / support capture). |
| [CampaignContactResponse](./schemas/external-campaign.md#campaigncontactresponse) | `external-campaign.md` | Acknowledgement returned after a contact inquiry submission. |
| [CampaignFollowUpRequest](./schemas/external-campaign.md#campaignfollowuprequest) | `external-campaign.md` | Post-result satisfaction / willingness-to-pay survey. |
| [CampaignFollowUpResponse](./schemas/external-campaign.md#campaignfollowupresponse) | `external-campaign.md` | Acknowledgement returned after a follow-up survey submission. |
| [CampaignStatusResponse](./schemas/external-campaign.md#campaignstatusresponse) | `external-campaign.md` | Polling endpoint used as a fallback when the dashboard wants a |
| [CampaignSubmitRequest](./schemas/external-campaign.md#campaignsubmitrequest) | `external-campaign.md` | Body posted by the Next.js form route after the user submits. |
| [CampaignSubmitResponse](./schemas/external-campaign.md#campaignsubmitresponse) | `external-campaign.md` | Acknowledgement returned after a submission is accepted. |
| [CampaignUploadResponse](./schemas/external-campaign.md#campaignuploadresponse) | `external-campaign.md` | Returned after a successful multipart file upload. |
| [CampaignWaitlistRequest](./schemas/external-campaign.md#campaignwaitlistrequest) | `external-campaign.md` | Landing-page waitlist signup (top-of-funnel lead capture). |
| [CampaignWaitlistResponse](./schemas/external-campaign.md#campaignwaitlistresponse) | `external-campaign.md` | Acknowledgement returned after a waitlist signup. |
| [DeleteSubmissionResponse](./schemas/writing.md#deletesubmissionresponse) | `writing.md` | Result of deleting a writing submission / 작문 제출 삭제 결과. |
| [SaveDraftRequest](./schemas/writing.md#savedraftrequest) | `writing.md` |  |
| [SaveDraftResponse](./schemas/writing.md#savedraftresponse) | `writing.md` |  |
| [SubmissionResponse](./schemas/writing.md#submissionresponse) | `writing.md` | Response acknowledging an accepted writing submission. |
| [TopikWriting51Response](./schemas/writing.md#topikwriting51response) | `writing.md` | Q51 실용문 빈칸 완성형 (56 keys). |
| [TopikWriting52Response](./schemas/writing.md#topikwriting52response) | `writing.md` | Q52 문장·문단 완성형 (52 keys). |
| [TopikWriting53Response](./schemas/writing.md#topikwriting53response) | `writing.md` | Q53 자료 설명형 (53 keys — reference omits scoring_focus). |
| [TopikWriting54Response](./schemas/writing.md#topikwriting54response) | `writing.md` | Q54 논술·의견 제시형 (51 keys). |
| [TopikWritingQuestionListResponse](./schemas/writing.md#topikwritingquestionlistresponse) | `writing.md` | Paginated list of TOPIK writing questions (rich §7 metadata, per item type). |
| [WritingChatRequest](./schemas/writing.md#writingchatrequest) | `writing.md` | Request for chat tutor interaction. |
| [StartSessionRequest](./schemas/writing.md#startsessionrequest) | `writing.md` | Begin a writing attempt. |
| [StartSessionResponse](./schemas/writing.md#startsessionresponse) | `writing.md` | IDs created at the start of a writing attempt. |
| [TutorMessageItem](./schemas/writing.md#tutormessageitem) | `writing.md` | One turn in a tutor session transcript. |
| [TutorSessionDetailResponse](./schemas/writing.md#tutorsessiondetailresponse) | `writing.md` | A session header plus its full transcript. |
| [TutorSessionListResponse](./schemas/writing.md#tutorsessionlistresponse) | `writing.md` | Tutor sessions list. |
| [TutorSessionSummary](./schemas/writing.md#tutorsessionsummary) | `writing.md` | A tutor session header. |
| [WritingGenerateRequestV2](./schemas/writing.md#writinggeneraterequestv2) | `writing.md` | v2 generate 요청 — task_type 문자열을 item_number:int 로 교체 (라우트 연결은 Step 8). |
| [WritingHistoryItem](./schemas/writing.md#writinghistoryitem) | `writing.md` |  |
| [WritingHistoryResponse](./schemas/writing.md#writinghistoryresponse) | `writing.md` |  |
| [WritingRecommendationItem](./schemas/writing.md#writingrecommendationitem) | `writing.md` | One row of the guide §7.9 recommendation view — common columns only (no prompt body). |
| [WritingRecommendationListResponse](./schemas/writing.md#writingrecommendationlistresponse) | `writing.md` | Paginated cross-type list of writing questions (guide §7.9 view, 노출 가능 only). |
| [WritingSubmitRequest](./schemas/writing.md#writingsubmitrequest) | `writing.md` | Request to submit a writing for evaluation. |
| [ReadingBookmarkResponse](./schemas/reading.md#readingbookmarkresponse) | `reading.md` | Response for POST /api/reading/bookmark. |
| [ReadingChoiceResponse](./schemas/reading.md#readingchoiceresponse) | `reading.md` | Single choice option. |
| [ReadingGenerateRequest](./schemas/reading.md#readinggeneraterequest) | `reading.md` | Request body for POST /api/reading/generate. |
| [ReadingHistoryItem](./schemas/reading.md#readinghistoryitem) | `reading.md` | Single item in reading history. |
| [ReadingHistoryResponse](./schemas/reading.md#readinghistoryresponse) | `reading.md` | Response for GET /api/reading/history. |
| [ReadingProblemResponse](./schemas/reading.md#readingproblemresponse) | `reading.md` | Generated reading problem (answer hidden). |
| [ReadingQuestionTypeInfo](./schemas/reading.md#readingquestiontypeinfo) | `reading.md` | Question type metadata. |
| [ReadingSessionCreateRequest](./schemas/reading.md#readingsessioncreaterequest) | `reading.md` | Request body for POST /api/reading/session. |
| [ReadingSessionProblemDTO](./schemas/reading.md#readingsessionproblemdto) | `reading.md` | Problem within a session (answer hidden). |
| [ReadingSessionResponse](./schemas/reading.md#readingsessionresponse) | `reading.md` | Response for reading session state. |
| [ReadingSessionResultsResponse](./schemas/reading.md#readingsessionresultsresponse) | `reading.md` | Response for session results. |
| [ReadingSessionSubmitRequest](./schemas/reading.md#readingsessionsubmitrequest) | `reading.md` | Request body for POST /api/reading/session/{id}/submit. |
| [ReadingSessionSubmitResponse](./schemas/reading.md#readingsessionsubmitresponse) | `reading.md` | Response after submitting a session answer. |
| [ReadingSubmitRequest](./schemas/reading.md#readingsubmitrequest) | `reading.md` | Request body for POST /api/reading/submit. |
| [ReadingSubmitResponse](./schemas/reading.md#readingsubmitresponse) | `reading.md` | Response after submitting an answer. |
| [ListeningAnswerResultResponse](./schemas/listening.md#listeninganswerresultresponse) | `listening.md` | Response after submitting an answer. |
| [ListeningBookmarkResponse](./schemas/listening.md#listeningbookmarkresponse) | `listening.md` | Response for POST /api/listening/bookmark. |
| [ListeningChoiceDTO](./schemas/listening.md#listeningchoicedto) | `listening.md` | Single multiple-choice option. |
| [ListeningChoiceWithStatusDTO](./schemas/listening.md#listeningchoicewithstatusdto) | `listening.md` | Choice with correctness status (shown after submission). |
| [ListeningHistoryItem](./schemas/listening.md#listeninghistoryitem) | `listening.md` | Single item in a user's listening history. |
| [ListeningHistoryResponse](./schemas/listening.md#listeninghistoryresponse) | `listening.md` | Response for GET /api/listening/history. |
| [ListeningProblemDTO](./schemas/listening.md#listeningproblemdto) | `listening.md` | Generated listening problem (answer hidden until submission). |
| [ListeningQuestionTypeDTO](./schemas/listening.md#listeningquestiontypedto) | `listening.md` | Question type metadata for GET /api/listening/question-types. |
| [ListeningScriptDTO](./schemas/listening.md#listeningscriptdto) | `listening.md` | Full listening script (shown after answer submission). |
| [ListeningScriptLineDTO](./schemas/listening.md#listeningscriptlinedto) | `listening.md` | Single line of a listening script (dialogue/narration). |
| [ListeningSessionCreateRequest](./schemas/listening.md#listeningsessioncreaterequest) | `listening.md` | Request body for POST /api/listening/session. |
| [ListeningSessionResponse](./schemas/listening.md#listeningsessionresponse) | `listening.md` | Response for a created/retrieved listening session. |
| [ListeningSessionResultsResponse](./schemas/listening.md#listeningsessionresultsresponse) | `listening.md` | Response for GET session results. |
| [ListeningSessionSummary](./schemas/listening.md#listeningsessionsummary) | `listening.md` | Summary statistics for a completed session. |
| [ListeningSubmissionItem](./schemas/listening.md#listeningsubmissionitem) | `listening.md` | Single submission entry within session results. |
| [ListeningSubmitRequest](./schemas/listening.md#listeningsubmitrequest) | `listening.md` | Request body for POST /api/listening/session/{session_id}/submit. |
| [ListeningVocabularyItemDTO](./schemas/listening.md#listeningvocabularyitemdto) | `listening.md` | Vocabulary item extracted from the listening script. |
| [CombinedFeedbackDetail](./schemas/evaluation.md#combinedfeedbackdetail) | `evaluation.md` | Merged learning + drill feedback (single pipeline agent output). |
| [DrillExerciseDetail](./schemas/evaluation.md#drillexercisedetail) | `evaluation.md` | Practice exercise. |
| [ErrorDetail](./schemas/evaluation.md#errordetail) | `evaluation.md` | A single detected error. |
| [EvaluationFeedbackResponse](./schemas/evaluation.md#evaluationfeedbackresponse) | `evaluation.md` | Full evaluation feedback response. |
| [EvaluationStatusResponse](./schemas/evaluation.md#evaluationstatusresponse) | `evaluation.md` | Response for evaluation status polling. |
| [GrammarPointDetail](./schemas/evaluation.md#grammarpointdetail) | `evaluation.md` | Grammar point for learning. |
| [InlineAnnotationDetail](./schemas/evaluation.md#inlineannotationdetail) | `evaluation.md` | Inline annotation on essay text. |
| [ModelAnswerDetail](./schemas/evaluation.md#modelanswerdetail) | `evaluation.md` | Model answer response. |
| [TraitScoreDetail](./schemas/evaluation.md#traitscoredetail) | `evaluation.md` | Detailed trait score. ``score`` is the FINAL rubric score on this trait's |
