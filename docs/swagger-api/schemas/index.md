# Schema Index

Source: [OpenAPI JSON](https://api.dotoretopik.com/openapi.json)
Last synced: 2026-07-07

| Group | Schemas |
| --- | ---: |
| [Common](./common.md) | 3 |
| [Eval Auth](./eval-auth.md) | 3 |
| [Admin Users](./admin-users.md) | 5 |
| [Admin Eval](./admin-eval.md) | 18 |
| [Admin Reading](./admin-reading.md) | 4 |
| [Admin Campaign](./admin-campaign.md) | 24 |
| [External Campaign](./external-campaign.md) | 13 |
| [Writing](./writing.md) | 22 |
| [Reading](./reading.md) | 15 |
| [Listening](./listening.md) | 17 |
| [Evaluation](./evaluation.md) | 9 |

## All Schemas

| Schema | Group | Description |
| --- | --- | --- |
| [HTTPValidationError](./common.md#httpvalidationerror) | common |  |
| [ProvidedQuestion](./common.md#providedquestion) | common | A single prompt blank shown to the applicant for Q51/Q52 fill-in tasks. |
| [ValidationError](./common.md#validationerror) | common |  |
| [LoginRequest](./eval-auth.md#loginrequest) | eval-auth |  |
| [LoginResponse](./eval-auth.md#loginresponse) | eval-auth | JWT access/refresh tokens plus the authenticated user's profile. |
| [LoginUser](./eval-auth.md#loginuser) | eval-auth | Authenticated user profile embedded in the login response. |
| [AdminCreateUserRequest](./admin-users.md#admincreateuserrequest) | admin-users |  |
| [AdminResetPasswordRequest](./admin-users.md#adminresetpasswordrequest) | admin-users |  |
| [AdminUpdateUserRequest](./admin-users.md#adminupdateuserrequest) | admin-users |  |
| [AdminUserListResponse](./admin-users.md#adminuserlistresponse) | admin-users |  |
| [AdminUserResponse](./admin-users.md#adminuserresponse) | admin-users |  |
| [DatasetResultsResponse](./admin-eval.md#datasetresultsresponse) | admin-eval | Paginated per-case results for an eval run. |
| [DatasetStatsResponse](./admin-eval.md#datasetstatsresponse) | admin-eval | Aggregate statistics for one eval run (from `compute_stats`). |
| [DatasetsResponse](./admin-eval.md#datasetsresponse) | admin-eval | Paginated eval-run records from the SQLite eval database. |
| [EvalRunRequest](./admin-eval.md#evalrunrequest) | admin-eval |  |
| [EvalRunResponse](./admin-eval.md#evalrunresponse) | admin-eval | Acknowledgement returned when an eval subprocess is started. |
| [EvalRunStatusResponse](./admin-eval.md#evalrunstatusresponse) | admin-eval | Current eval run state stored in Redis (TTL 2h). |
| [EvalUserItem](./admin-eval.md#evaluseritem) | admin-eval | A user who has at least one graded submission. |
| [EvalUsersResponse](./admin-eval.md#evalusersresponse) | admin-eval | Paginated list of users with graded submissions. |
| [ExpertReview](./admin-eval.md#expertreview) | admin-eval | A persisted expert review. |
| [OverviewStatsResponse](./admin-eval.md#overviewstatsresponse) | admin-eval | High-level aggregate stats for the eval dashboard header. |
| [ReviewListResponse](./admin-eval.md#reviewlistresponse) | admin-eval | All expert reviews submitted for a target (multi-reviewer). |
| [src__api__routes__admin_eval__ReviewRequest](./admin-eval.md#src-api-routes-admin-eval-reviewrequest) | admin-eval | Expert review request. |
| [SubmissionDetailFeedback](./admin-eval.md#submissiondetailfeedback) | admin-eval | AI feedback record within the detail response. |
| [SubmissionDetailResponse](./admin-eval.md#submissiondetailresponse) | admin-eval | Full submission detail: submission record, feedback, and linked task. |
| [SubmissionDetailSubmission](./admin-eval.md#submissiondetailsubmission) | admin-eval | Core submission record within the detail response. |
| [SubmissionDetailTask](./admin-eval.md#submissiondetailtask) | admin-eval | Writing task metadata within the detail response (null when no task linked). |
| [UserSubmissionItem](./admin-eval.md#usersubmissionitem) | admin-eval | A single graded writing submission for a user. |
| [UserSubmissionsResponse](./admin-eval.md#usersubmissionsresponse) | admin-eval | Paginated list of a user's graded submissions. |
| [EditRequest](./admin-reading.md#editrequest) | admin-reading | Admin reading bank edit request. |
| [ReadingBankItem](./admin-reading.md#readingbankitem) | admin-reading | One reading bank item. |
| [ReadingBankListResponse](./admin-reading.md#readingbanklistresponse) | admin-reading | Reading bank list response. |
| [src__api__routes__admin_reading__ReviewRequest](./admin-reading.md#src-api-routes-admin-reading-reviewrequest) | admin-reading | Admin reading review request. |
| [CampaignAssignRequest](./admin-campaign.md#campaignassignrequest) | admin-campaign | Admin request to assign or clear the reviewer on a submission. |
| [CampaignAuditEntry](./admin-campaign.md#campaignauditentry) | admin-campaign | One entry in a submission's audit log. |
| [CampaignAuditLogResponse](./admin-campaign.md#campaignauditlogresponse) | admin-campaign | Audit log entries for a submission. |
| [CampaignContentEditRequest](./admin-campaign.md#campaigncontenteditrequest) | admin-campaign | KR content reviewer overlays edits on top of the AI draft. The |
| [CampaignInvalidateRequest](./admin-campaign.md#campaigninvalidaterequest) | admin-campaign | Admin request to mark a submission invalid. |
| [CampaignReviewer](./admin-campaign.md#campaignreviewer) | admin-campaign | One assignable reviewer for the assign/claim dropdown. |
| [CampaignReviewerListResponse](./admin-campaign.md#campaignreviewerlistresponse) | admin-campaign | List of assignable reviewers for the admin dashboard. |
| [CampaignSourceEditRequest](./admin-campaign.md#campaignsourceeditrequest) | admin-campaign | Reviewer correction of the original source fields on a submission. |
| [CampaignStateTransitionRequest](./admin-campaign.md#campaignstatetransitionrequest) | admin-campaign | Admin request to move a submission to a new workflow status. |
| [CampaignStatsOverview](./admin-campaign.md#campaignstatsoverview) | admin-campaign | Aggregate campaign metrics for the admin overview dashboard. |
| [CampaignSubmissionDetail](./admin-campaign.md#campaignsubmissiondetail) | admin-campaign | Full read-side projection of a submission used by the eval |
| [CampaignSubmissionListItem](./admin-campaign.md#campaignsubmissionlistitem) | admin-campaign | One submission row in the admin per-user or cross-user queue. |
| [CampaignSubmissionListResponse](./admin-campaign.md#campaignsubmissionlistresponse) | admin-campaign | Paginated list of submissions for the admin dashboard. |
| [CampaignSubmissionUserDetail](./admin-campaign.md#campaignsubmissionuserdetail) | admin-campaign | Embedded applicant identity within a submission detail. |
| [CampaignTranslationRequest](./admin-campaign.md#campaigntranslationrequest) | admin-campaign | KR/VN finalized feedback and translation submitted by a reviewer. |
| [CampaignUserListResponse](./admin-campaign.md#campaignuserlistresponse) | admin-campaign | Paginated list of campaign users for the admin dashboard. |
| [CampaignUserSummary](./admin-campaign.md#campaignusersummary) | admin-campaign | One row in GET /api/admin/campaign/users. |
| [CampaignWaitlistItem](./admin-campaign.md#campaignwaitlistitem) | admin-campaign | One row in the admin waitlist list. |
| [CampaignWaitlistListResponse](./admin-campaign.md#campaignwaitlistlistresponse) | admin-campaign | Paginated list of waitlist entries for the admin dashboard. |
| [OkClaimResponse](./admin-campaign.md#okclaimresponse) | admin-campaign | Self-claim acknowledgement carrying the new assignee id. |
| [OkResponse](./admin-campaign.md#okresponse) | admin-campaign | Generic success acknowledgement for mutation endpoints. |
| [TaskEnqueuedResponse](./admin-campaign.md#taskenqueuedresponse) | admin-campaign | ARQ enqueue acknowledgement returned by the 202 task endpoints |
| [TaskStatusResponse](./admin-campaign.md#taskstatusresponse) | admin-campaign | Current ARQ job status from the task-status poll endpoint. ``result`` |
| [WorkflowStateResponse](./admin-campaign.md#workflowstateresponse) | admin-campaign | New workflow status after a state transition. |
| [Body_upload_attachment_api_external_campaign_uploads_post](./external-campaign.md#body-upload-attachment-api-external-campaign-uploads-post) | external-campaign |  |
| [CampaignContactInquiryItem](./external-campaign.md#campaigncontactinquiryitem) | external-campaign | One row in the admin contact-inquiries list. |
| [CampaignContactInquiryListResponse](./external-campaign.md#campaigncontactinquirylistresponse) | external-campaign | Paginated list of contact inquiries for the admin dashboard. |
| [CampaignContactRequest](./external-campaign.md#campaigncontactrequest) | external-campaign | Landing-page "Contact us" inquiry (general lead / support capture). |
| [CampaignContactResponse](./external-campaign.md#campaigncontactresponse) | external-campaign | Acknowledgement returned after a contact inquiry submission. |
| [CampaignFollowUpRequest](./external-campaign.md#campaignfollowuprequest) | external-campaign | Post-result satisfaction / willingness-to-pay survey. |
| [CampaignFollowUpResponse](./external-campaign.md#campaignfollowupresponse) | external-campaign | Acknowledgement returned after a follow-up survey submission. |
| [CampaignStatusResponse](./external-campaign.md#campaignstatusresponse) | external-campaign | Polling endpoint used as a fallback when the dashboard wants a |
| [CampaignSubmitRequest](./external-campaign.md#campaignsubmitrequest) | external-campaign | Body posted by the Next.js form route after the user submits. |
| [CampaignSubmitResponse](./external-campaign.md#campaignsubmitresponse) | external-campaign | Acknowledgement returned after a submission is accepted. |
| [CampaignUploadResponse](./external-campaign.md#campaignuploadresponse) | external-campaign | Returned after a successful multipart file upload. |
| [CampaignWaitlistRequest](./external-campaign.md#campaignwaitlistrequest) | external-campaign | Landing-page waitlist signup (top-of-funnel lead capture). |
| [CampaignWaitlistResponse](./external-campaign.md#campaignwaitlistresponse) | external-campaign | Acknowledgement returned after a waitlist signup. |
| [DeleteSubmissionResponse](./writing.md#deletesubmissionresponse) | writing | Result of deleting a writing submission / 작문 제출 삭제 결과. |
| [SaveDraftRequest](./writing.md#savedraftrequest) | writing |  |
| [SaveDraftResponse](./writing.md#savedraftresponse) | writing |  |
| [SubmissionResponse](./writing.md#submissionresponse) | writing | Response acknowledging an accepted writing submission. |
| [TopikWriting51Response](./writing.md#topikwriting51response) | writing | Q51 실용문 빈칸 완성형 (56 keys). |
| [TopikWriting52Response](./writing.md#topikwriting52response) | writing | Q52 문장·문단 완성형 (52 keys). |
| [TopikWriting53Response](./writing.md#topikwriting53response) | writing | Q53 자료 설명형 (53 keys — reference omits scoring_focus). |
| [TopikWriting54Response](./writing.md#topikwriting54response) | writing | Q54 논술·의견 제시형 (51 keys). |
| [TopikWritingQuestionListResponse](./writing.md#topikwritingquestionlistresponse) | writing | Paginated list of TOPIK writing questions (rich §7 metadata, per item type). |
| [WritingChatRequest](./writing.md#writingchatrequest) | writing | Request for chat tutor interaction. |
| [StartSessionRequest](./writing.md#startsessionrequest) | writing | Begin a writing attempt. |
| [StartSessionResponse](./writing.md#startsessionresponse) | writing | IDs created at the start of a writing attempt. |
| [TutorMessageItem](./writing.md#tutormessageitem) | writing | One turn in a tutor session transcript. |
| [TutorSessionDetailResponse](./writing.md#tutorsessiondetailresponse) | writing | A session header plus its full transcript. |
| [TutorSessionListResponse](./writing.md#tutorsessionlistresponse) | writing | Tutor sessions list. |
| [TutorSessionSummary](./writing.md#tutorsessionsummary) | writing | A tutor session header. |
| [WritingGenerateRequestV2](./writing.md#writinggeneraterequestv2) | writing | v2 generate 요청 — task_type 문자열을 item_number:int 로 교체 (라우트 연결은 Step 8). |
| [WritingHistoryItem](./writing.md#writinghistoryitem) | writing |  |
| [WritingHistoryResponse](./writing.md#writinghistoryresponse) | writing |  |
| [WritingRecommendationItem](./writing.md#writingrecommendationitem) | writing | One row of the guide §7.9 recommendation view — common columns only (no prompt body). |
| [WritingRecommendationListResponse](./writing.md#writingrecommendationlistresponse) | writing | Paginated cross-type list of writing questions (guide §7.9 view, 노출 가능 only). |
| [WritingSubmitRequest](./writing.md#writingsubmitrequest) | writing | Request to submit a writing for evaluation. |
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
| [CombinedFeedbackDetail](./evaluation.md#combinedfeedbackdetail) | evaluation | Merged learning + drill feedback (single pipeline agent output). |
| [DrillExerciseDetail](./evaluation.md#drillexercisedetail) | evaluation | Practice exercise. |
| [ErrorDetail](./evaluation.md#errordetail) | evaluation | A single detected error. |
| [EvaluationFeedbackResponse](./evaluation.md#evaluationfeedbackresponse) | evaluation | Full evaluation feedback response. |
| [EvaluationStatusResponse](./evaluation.md#evaluationstatusresponse) | evaluation | Response for evaluation status polling. |
| [GrammarPointDetail](./evaluation.md#grammarpointdetail) | evaluation | Grammar point for learning. |
| [InlineAnnotationDetail](./evaluation.md#inlineannotationdetail) | evaluation | Inline annotation on essay text. |
| [ModelAnswerDetail](./evaluation.md#modelanswerdetail) | evaluation | Model answer response. |
| [TraitScoreDetail](./evaluation.md#traitscoredetail) | evaluation | Detailed trait score. ``score`` is the FINAL rubric score on this trait's |
