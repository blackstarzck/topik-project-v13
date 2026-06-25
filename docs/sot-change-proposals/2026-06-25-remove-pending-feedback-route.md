# Remove Pending Feedback Route Screen Proposal

Date: 2026-06-25

## Context

The learner-facing app no longer uses the legacy pending feedback route screen
shown at `/writing/feedback/short/:id` or `/writing/feedback/long/:id` while a
submission is still `pending` or `analyzing`.

That legacy screen was implemented by `FeedbackPendingPanel` and the modal
presentation of `AnalysisLoadingModal`. It displayed a read-only submitted
answer behind an analysis loading modal. Learners now discover delayed
submissions from list surfaces instead.

This supersedes the pending-route rule in
`docs/sot-change-proposals/2026-06-25-writing-analysis-handoff.md`.

## Proposed Product Rule

1. Completed feedback routes remain active for completed short and long writing
   submissions.
2. Direct access to a feedback route for a `pending` or `analyzing` submission
   redirects to `/library`, whose default tab is the submissions tab.
3. Problem list rows for `pending` or `analyzing` submissions show a status
   tooltip and do not navigate when clicked.
4. Library submission rows for `pending` or `analyzing` submissions remain
   visible, but the row title is not a feedback link and export selection stays
   disabled.
5. Failed submissions without a feedback bundle show a simple failure notice
   instead of the legacy loading modal.

## Non-Goals

1. Removing completed `/writing/feedback/short/:id` or
   `/writing/feedback/long/:id` result pages.
2. Removing the current submit-time analysis state shown inside writing pages.
3. Changing backend feedback status semantics or Supabase schema.
