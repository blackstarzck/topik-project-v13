# SOT Change Proposal: feedback retry parent submission migration index

## Target SOT

- `supabase/migrations/INDEX.md`

## Reason

- A new migration was added: `20260629215000_feedback_retry_parent_submission.sql`.
- The migration index should list the new RPC update so future database audits can trace why `create_external_writing_submission` stores `parent_submission_id` for feedback retry submissions.

## Proposed Update

- Add a 2026-06-29 entry for `20260629215000_feedback_retry_parent_submission.sql`.
- Summarize the scope as: `create_external_writing_submission` now validates optional `parent_submission_id`, stores it on new retry submissions, keeps draft idempotency, and preserves service-role-only execution.

## Basis

- The existing `writing_submissions.parent_submission_id` column is already part of the schema.
- Comparison report selection already prefers `parent_submission_id` when it exists.
- Feedback retry now passes the source submission id into the writing route and submit payload.
