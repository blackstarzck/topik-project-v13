# Remove Analysis Slow Handoff Proposal

Date: 2026-06-26

## Context

The current D-M2 AI analysis loading SOT still describes a status/message update
when analysis takes longer than 10 seconds. The product request for this change
is to stop showing the yellow "analysis is taking longer than usual" handoff
during the active analysis stage.

## Proposed Product Rule

1. The active analysis stage keeps showing only the normal analysis title,
   progress steps, expected time, and submitted-answer lock context.
2. The app does not show an automatic slow-analysis warning just because 10
   seconds have elapsed.
3. The stored pending handoff remains available only when polling attempts are
   exhausted and the submission is explicitly treated as saved for later status
   checking.
4. My Library remains the recovery surface for pending/analyzing submissions,
   but the analysis screen should not interrupt ordinary active analysis with a
   timed handoff banner.

## SOT Update Direction

Update `docs/Wireframe/13-D-M2-ai-analysis-loading/description.md` and related
D-M2 functional wording so the "10 seconds elapsed" slow-warning rule is removed
or narrowed to the exhausted-polling stored-pending state.

## Non-Goals

1. Changing the backend polling window.
2. Removing the stored pending state.
3. Removing My Library visibility for pending/analyzing submissions.
