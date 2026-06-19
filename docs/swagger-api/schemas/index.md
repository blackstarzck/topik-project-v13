# Schema Index

Source: [OpenAPI JSON](https://api.dotoretopik.com/openapi.json)
Last synced: 2026-06-19

| Group | Schemas |
| --- | ---: |
| [Common](./common.md) | 3 |
| [Eval Auth](./eval-auth.md) | 3 |
| [Admin Eval](./admin-eval.md) | 18 |
| [Admin Campaign](./admin-campaign.md) | 26 |
| [External Campaign](./external-campaign.md) | 11 |
| [Writing](./writing.md) | 16 |
| [Reading](./reading.md) | 15 |
| [Listening](./listening.md) | 17 |
| [Evaluation](./evaluation.md) | 0 |

## All Schemas

| Schema | Group | Description |
| --- | --- | --- |
| [Body_upload_attachment_api_external_campaign_uploads_post](./external-campaign.md#body-upload-attachment-api-external-campaign-uploads-post) | external-campaign |  |
| [CampaignAssignRequest](./admin-campaign.md#campaignassignrequest) | admin-campaign | Admin request to assign or clear the reviewer on a submission. |
| [CampaignAuditEntry](./admin-campaign.md#campaignauditentry) | admin-campaign | One entry in a submission's audit log. |
| [CampaignAuditLogResponse](./admin-campaign.md#campaignauditlogresponse) | admin-campaign | Audit log entries for a submission. |
| [CampaignContactInquiryItem](./admin-campaign.md#campaigncontactinquiryitem) | admin-campaign | One row in the admin contact-inquiries list. |
| [CampaignContactInquiryListResponse](./admin-campaign.md#campaigncontactinquirylistresponse) | admin-campaign | Paginated list of contact inquiries for the admin dashboard. |
| [CampaignContactRequest](./external-campaign.md#campaigncontactrequest) | external-campaign | Landing-page "Contact us" inquiry (general lead / support capture). Independent of submissions/scoring. Append-only — a person may send multiple inquiries. ``inquiry_type`` is the localized display label from the modal's select, stored as free text. |
| [CampaignContactResponse](./external-campaign.md#campaigncontactresponse) | external-campaign | Acknowledgement returned after a contact inquiry submission. |
| [CampaignContentEditRequest](./admin-campaign.md#campaigncontenteditrequest) | admin-campaign | KR content reviewer overlays edits on top of the AI draft. The body is a JSON object whose keys match the report sections — see plan-09 §4 for the canonical key list. |
| [CampaignFollowUpRequest](./external-campaign.md#campaignfollowuprequest) | external-campaign | Post-result satisfaction / willingness-to-pay survey. Linked to the user by email only (no FK to submissions). Append-only. |
| [CampaignFollowUpResponse](./external-campaign.md#campaignfollowupresponse) | external-campaign | Acknowledgement returned after a follow-up survey submission. |
| [CampaignInvalidateRequest](./admin-campaign.md#campaigninvalidaterequest) | admin-campaign | Admin request to mark a submission invalid. |
| [CampaignReviewer](./admin-campaign.md#campaignreviewer) | admin-campaign | One assignable reviewer for the assign/claim dropdown. |
| [CampaignReviewerListResponse](./admin-campaign.md#campaignreviewerlistresponse) | admin-campaign | List of assignable reviewers for the admin dashboard. |
| [CampaignSourceEditRequest](./admin-campaign.md#campaignsourceeditrequest) | admin-campaign | Reviewer correction of the original source fields on a submission. All fields optional — only the keys explicitly present in the request body are applied (partial update via ``model_fields_set``), so a client can edit just the answer text without clearing the question/passage. Editing the applicant's submitted answer is sensitive, so the route audit-logs a before/after snapshot. |
| [CampaignStateTransitionRequest](./admin-campaign.md#campaignstatetransitionrequest) | admin-campaign | Admin request to move a submission to a new workflow status. |
| [CampaignStatsOverview](./admin-campaign.md#campaignstatsoverview) | admin-campaign | Aggregate campaign metrics for the admin overview dashboard. |
| [CampaignStatusResponse](./external-campaign.md#campaignstatusresponse) | external-campaign | Polling endpoint used as a fallback when the dashboard wants a fresh read without going through the admin auth path. |
| [CampaignSubmissionDetail](./admin-campaign.md#campaignsubmissiondetail) | admin-campaign | Full read-side projection of a submission used by the eval dashboard and by the PDF/email render pipeline. |
| [CampaignSubmissionListItem](./admin-campaign.md#campaignsubmissionlistitem) | admin-campaign | One submission row in the admin per-user or cross-user queue. |
| [CampaignSubmissionListResponse](./admin-campaign.md#campaignsubmissionlistresponse) | admin-campaign | Paginated list of submissions for the admin dashboard. |
| [CampaignSubmissionUserDetail](./admin-campaign.md#campaignsubmissionuserdetail) | admin-campaign | Embedded applicant identity within a submission detail. |
| [CampaignSubmitRequest](./external-campaign.md#campaignsubmitrequest) | external-campaign | Body posted by the Next.js form route after the user submits. |
| [CampaignSubmitResponse](./external-campaign.md#campaignsubmitresponse) | external-campaign | Acknowledgement returned after a submission is accepted. |
| [CampaignTranslationRequest](./admin-campaign.md#campaigntranslationrequest) | admin-campaign | KR/VN finalized feedback and translation submitted by a reviewer. |
| [CampaignUploadResponse](./external-campaign.md#campaignuploadresponse) | external-campaign | Returned after a successful multipart file upload. The landing site stores ``url`` and posts it back as ``image_url`` on the following /submissions call. |
| [CampaignUserListResponse](./admin-campaign.md#campaignuserlistresponse) | admin-campaign | Paginated list of campaign users for the admin dashboard. |
| [CampaignUserSummary](./admin-campaign.md#campaignusersummary) | admin-campaign | One row in GET /api/admin/campaign/users. |
| [CampaignWaitlistItem](./admin-campaign.md#campaignwaitlistitem) | admin-campaign | One row in the admin waitlist list. |
| [CampaignWaitlistListResponse](./admin-campaign.md#campaignwaitlistlistresponse) | admin-campaign | Paginated list of waitlist entries for the admin dashboard. |
| [CampaignWaitlistRequest](./external-campaign.md#campaignwaitlistrequest) | external-campaign | Landing-page waitlist signup (top-of-funnel lead capture). Independent of submissions/scoring — email + attribution only. |
| [CampaignWaitlistResponse](./external-campaign.md#campaignwaitlistresponse) | external-campaign | Acknowledgement returned after a waitlist signup. |
| [DatasetResultsResponse](./admin-eval.md#datasetresultsresponse) | admin-eval | Paginated per-case results for an eval run. Each item mirrors a full `eval_results` row (`SELECT *`) enriched with case `input_data`, `description`, `title`, a coerced `passed` bool, and parsed `judge_verdict`/`penalty_results`/`raw_output` JSON; passed through untyped. |
| [DatasetStatsResponse](./admin-eval.md#datasetstatsresponse) | admin-eval | Aggregate statistics for one eval run (from `compute_stats`). |
| [DatasetsResponse](./admin-eval.md#datasetsresponse) | admin-eval | Paginated eval-run records from the SQLite eval database. Each item mirrors a full `eval_datasets` row (`SELECT *`), so the column set is schema-defined; items are passed through untyped to avoid dropping fields. |
| [DeleteSubmissionResponse](./writing.md#deletesubmissionresponse) | writing | Result of deleting a writing submission / 작문 제출 삭제 결과. |
| [EvalRunRequest](./admin-eval.md#evalrunrequest) | admin-eval |  |
| [EvalRunResponse](./admin-eval.md#evalrunresponse) | admin-eval | Acknowledgement returned when an eval subprocess is started. |
| [EvalRunStatusResponse](./admin-eval.md#evalrunstatusresponse) | admin-eval | Current eval run state stored in Redis (TTL 2h). Fields vary by phase: a `running` entry carries pipeline/dataset/mode/ triggered_by; a finished entry carries exit_code and stdout/stderr tails; an internal failure carries `error`. All non-status fields are optional. |
| [EvalUserItem](./admin-eval.md#evaluseritem) | admin-eval | A user who has at least one graded submission. |
| [EvalUsersResponse](./admin-eval.md#evalusersresponse) | admin-eval | Paginated list of users with graded submissions. |
| [ExpertReview](./admin-eval.md#expertreview) | admin-eval | A persisted expert review. All fields are optional because `GET .../my` returns an empty object `{}` when the current admin has not reviewed the target yet. |
| [HTTPValidationError](./common.md#httpvalidationerror) | common |  |
| [ListeningAnswerResultResponse](./listening.md#listeninganswerresultresponse) | listening | Response after submitting an answer. |
| [ListeningBookmarkResponse](./listening.md#listeningbookmarkresponse) | listening | Response for POST /api/listening/bookmark. |
| [ListeningChoiceDTO](./listening.md#listeningchoicedto) | listening | Single multiple-choice option. |
| [ListeningChoiceWithStatusDTO](./listening.md#listeningchoicewithstatusdto) | listening | Choice with correctness status (shown after submission). |
| [ListeningHistoryItem](./listening.md#listeninghistoryitem) | listening | Single item in a user's listening history. |
| [ListeningHistoryResponse](./listening.md#listeninghistoryresponse) | listening | Response for GET /api/listening/history. |
| [ListeningProblemDTO](./listening.md#listeningproblemdto) | listening | Generated listening problem (answer hidden until submission). |
| [ListeningQuestionTypeDTO](./listening.md#listeningquestiontypedto) | listening | Question type metadata for GET /api/listening/question-types. |
| [ListeningScriptDTO](./listening.md#listeningscriptdto) | listening | Full listening script (shown after answer submission). |
| [ListeningScriptLineDTO](./listening.md#listeningscriptlinedto) | listening | Single line of a listening script (dialogue/narration). |
| [ListeningSessionCreateRequest](./listening.md#listeningsessioncreaterequest) | listening | Request body for POST /api/listening/session. |
| [ListeningSessionResponse](./listening.md#listeningsessionresponse) | listening | Response for a created/retrieved listening session. |
| [ListeningSessionResultsResponse](./listening.md#listeningsessionresultsresponse) | listening | Response for GET session results. |
| [ListeningSessionSummary](./listening.md#listeningsessionsummary) | listening | Summary statistics for a completed session. |
| [ListeningSubmissionItem](./listening.md#listeningsubmissionitem) | listening | Single submission entry within session results. |
| [ListeningSubmitRequest](./listening.md#listeningsubmitrequest) | listening | Request body for POST /api/listening/session/{session_id}/submit. |
| [ListeningVocabularyItemDTO](./listening.md#listeningvocabularyitemdto) | listening | Vocabulary item extracted from the listening script. |
| [LoginRequest](./eval-auth.md#loginrequest) | eval-auth |  |
| [LoginResponse](./eval-auth.md#loginresponse) | eval-auth | JWT access/refresh tokens plus the authenticated user's profile. |
| [LoginUser](./eval-auth.md#loginuser) | eval-auth | Authenticated user profile embedded in the login response. |
| [OkClaimResponse](./admin-campaign.md#okclaimresponse) | admin-campaign | Self-claim acknowledgement carrying the new assignee id. 셀프 클레임 성공 응답 (새 담당자 ID 포함). |
| [OkResponse](./admin-campaign.md#okresponse) | admin-campaign | Generic success acknowledgement for mutation endpoints. 변경 작업 성공 응답. |
| [OverviewStatsResponse](./admin-eval.md#overviewstatsresponse) | admin-eval | High-level aggregate stats for the eval dashboard header. |
| [ProvidedQuestion](./common.md#providedquestion) | common | A single prompt blank shown to the applicant for Q51/Q52 fill-in tasks. |
| [ReadingBookmarkResponse](./reading.md#readingbookmarkresponse) | reading | Response for POST /api/reading/bookmark. |
| [ReadingChoiceResponse](./reading.md#readingchoiceresponse) | reading | Single choice option. |
| [ReadingGenerateRequest](./reading.md#readinggeneraterequest) | reading | Request body for POST /api/reading/generate. |
| [ReadingHistoryItem](./reading.md#readinghistoryitem) | reading | Single item in reading history. |
| [ReadingHistoryResponse](./reading.md#readinghistoryresponse) | reading | Response for GET /api/reading/history. |
| [ReadingProblemResponse](./reading.md#readingproblemresponse) | reading | Generated reading problem (answer hidden). |
| [ReadingQuestionTypeInfo](./reading.md#readingquestiontypeinfo) | reading | Question type metadata. |
| [ReadingSessionCreateRequest](./reading.md#readingsessioncreaterequest) | reading | Request body for POST /api/reading/session. |
| [ReadingSessionProblemDTO](./reading.md#readingsessionproblemdto) | reading | Problem within a session (answer hidden). |
| [ReadingSessionResponse](./reading.md#readingsessionresponse) | reading | Response for reading session state. |
| [ReadingSessionResultsResponse](./reading.md#readingsessionresultsresponse) | reading | Response for session results. |
| [ReadingSessionSubmitRequest](./reading.md#readingsessionsubmitrequest) | reading | Request body for POST /api/reading/session/{id}/submit. |
| [ReadingSessionSubmitResponse](./reading.md#readingsessionsubmitresponse) | reading | Response after submitting a session answer. |
| [ReadingSubmitRequest](./reading.md#readingsubmitrequest) | reading | Request body for POST /api/reading/submit. |
| [ReadingSubmitResponse](./reading.md#readingsubmitresponse) | reading | Response after submitting an answer. |
| [ReviewListResponse](./admin-eval.md#reviewlistresponse) | admin-eval | All expert reviews submitted for a target (multi-reviewer). |
| [ReviewRequest](./admin-eval.md#reviewrequest) | admin-eval |  |
| [SaveDraftRequest](./writing.md#savedraftrequest) | writing |  |
| [SaveDraftResponse](./writing.md#savedraftresponse) | writing |  |
| [SubmissionDetailFeedback](./admin-eval.md#submissiondetailfeedback) | admin-eval | AI feedback record within the detail response. |
| [SubmissionDetailResponse](./admin-eval.md#submissiondetailresponse) | admin-eval | Full submission detail: submission record, feedback, and linked task. |
| [SubmissionDetailSubmission](./admin-eval.md#submissiondetailsubmission) | admin-eval | Core submission record within the detail response. |
| [SubmissionDetailTask](./admin-eval.md#submissiondetailtask) | admin-eval | Writing task metadata within the detail response (null when no task linked). |
| [SubmissionResponse](./writing.md#submissionresponse) | writing | Response acknowledging an accepted writing submission. |
| [TaskEnqueuedResponse](./admin-campaign.md#taskenqueuedresponse) | admin-campaign | ARQ enqueue acknowledgement returned by the 202 task endpoints (PDF render, scoring, email send, resend). 백그라운드 작업 등록 응답 (PDF/채점/메일). |
| [TaskStatusResponse](./admin-campaign.md#taskstatusresponse) | admin-campaign | Current ARQ job status from the task-status poll endpoint. ``result`` is present only once the job is complete; ``error`` only if fetching the completed job's result failed. 백그라운드 작업 상태 조회 응답. |
| [TopikWriting51Response](./writing.md#topikwriting51response) | writing | Q51 실용문 빈칸 완성형 (56 keys). |
| [TopikWriting52Response](./writing.md#topikwriting52response) | writing | Q52 문장·문단 완성형 (52 keys). |
| [TopikWriting53Response](./writing.md#topikwriting53response) | writing | Q53 자료 설명형 (53 keys — reference omits scoring_focus). |
| [TopikWriting54Response](./writing.md#topikwriting54response) | writing | Q54 논술·의견 제시형 (51 keys). |
| [UserSubmissionItem](./admin-eval.md#usersubmissionitem) | admin-eval | A single graded writing submission for a user. |
| [UserSubmissionsResponse](./admin-eval.md#usersubmissionsresponse) | admin-eval | Paginated list of a user's graded submissions. |
| [ValidationError](./common.md#validationerror) | common |  |
| [WorkflowStateResponse](./admin-campaign.md#workflowstateresponse) | admin-campaign | New workflow status after a state transition. 상태 전환 후의 새 워크플로 상태. |
| [WritingChatRequest](./writing.md#writingchatrequest) | writing | Request for chat tutor interaction. |
| [WritingGenerateRequestV2](./writing.md#writinggeneraterequestv2) | writing | v2 generate 요청 — task_type 문자열을 item_number:int 로 교체 (라우트 연결은 Step 8). |
| [WritingHistoryItem](./writing.md#writinghistoryitem) | writing |  |
| [WritingHistoryResponse](./writing.md#writinghistoryresponse) | writing |  |
| [WritingSubmitRequest](./writing.md#writingsubmitrequest) | writing | Request to submit a writing for evaluation. |
| [WritingTaskListItem](./writing.md#writingtasklistitem) | writing | Lightweight writing task item for listing. |
| [WritingTaskListResponse](./writing.md#writingtasklistresponse) | writing | Paginated list of writing tasks. |
| [WritingTaskResponse](./writing.md#writingtaskresponse) | writing | Full writing task returned from DB or LLM for practice. |
