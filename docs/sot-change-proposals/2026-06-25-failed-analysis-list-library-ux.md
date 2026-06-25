# Failed Analysis Submission UX in Problem List and Library

Date: 2026-06-25

## Context

`writing_submissions.feedback_status = "failed"` means the learner's answer was saved, but AI feedback was not produced. Current list and library surfaces can make these submissions look like ordinary completed feedback results, which is misleading because there is no score, summary, PDF-ready feedback, or review-set-ready artifact.

This proposal does not edit the active SOT directly. It records the behavior that should be promoted into the relevant C-02, C-03, F-01, and F-M1 source documents if accepted.

## Proposed Product Rules

1. Failed submissions stay visible as learning history.
2. C-02 problem list includes failed submissions in the solved/done filter because a submission exists.
3. C-02 row status for failed submissions is `Analysis failed`, not a generic completed-result label.
4. C-02 primary CTA for failed submissions remains `Solve again`.
5. C-03 retry modal shows the previous status as `Analysis failed`.
6. C-03 result/status secondary action for failed submissions is `View failed status` and routes to the existing feedback status URL.
7. F-01 library saved-answer rows show an `Analysis failed` tag and a short hint explaining that score and feedback cannot be shown.
8. F-01 failed submissions are not selectable for PDF export or review-set creation.
9. F-M1 server-side PDF resolution rejects failed submissions even when called directly through the export API.
10. Browser print fallback is not allowed for 4xx business-rule failures such as failed-analysis export exclusion.
11. The existing failed feedback page fallback remains the canonical status surface for the failed submission.

## Non-Goals

- No database schema or enum change.
- No Supabase migration.
- No retry/reanalysis backend behavior change.
- No removal or hiding of failed submissions from learner history.
- No backfill of old submissions.

## Acceptance Criteria

- A failed row in C-02 displays `Analysis failed`.
- The C-02 failed row still opens the retry modal and keeps the primary `Solve again` flow.
- The C-03 modal labels failed previous status as `Analysis failed` and exposes `View failed status`.
- F-01 failed rows show an explanatory hint and disable row selection/PDF export with an accessible disabled reason.
- API-level PDF export rejects failed submissions for both direct submission export and library selection export.
- The failed-analysis API rejection returns a stable error code so locale-aware clients do not display a hardcoded server-language string.
