# Writing Analysis Handoff Persistence Proposal

Date: 2026-06-25

## Context

When a learner submits a writing answer and leaves the analysis screen before the backend analysis finishes, the answer must still be discoverable from learner-facing surfaces. The backend may also keep returning `processing` beyond the current 10s x 6 polling window.

## Proposed Product Rule

1. A submitted writing answer is saved to `library_items` automatically as a submission item when `create_external_writing_submission` records it.
2. Automatic save means "the submitted answer is preserved for later review"; it is not a learner bookmark action.
3. `pending` and `analyzing` submissions open the feedback status route, where the existing pending panel can continue polling or explain that the analysis is delayed.
4. Problem list rows with `pending` or `analyzing` feedback do not offer normal retry as the primary path. They show a status action and route to the feedback status page.
5. Library submission rows with `pending` or `analyzing` feedback are visible, but are not selectable for PDF/export bundles until analysis completes or fails.
6. Failed submissions remain visible because the learner did submit an answer. Retry/re-analysis policy can be handled from the feedback status page.

## Non-Goals For This Change

1. Backfilling historical submissions into `library_items`.
2. Changing the backend feedback writer contract.
3. Adding admin or operational tooling.

