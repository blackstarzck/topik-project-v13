# Writing Submit Analysis Page Flow

## Background

Current D-M2 SOT describes AI analysis as `modal/state` with a dimmed read-only submitted-answer background. The requested behavior changes the post-submit analysis experience into a page-level state that is available only from the successful submit transition.

## Proposed Behavior

- When the user confirms submission, keep the submit-confirm modal open while `submitWritingAction` is pending.
- During pending, the submit button shows loading and duplicate clicks/close/cancel are blocked.
- When the submit API succeeds, close the submit-confirm modal and show a page-level analysis view from in-memory submit state.
- The page-level analysis view is not a direct URL. Refreshing or directly opening `/writing/*` renders the normal writing route, not the analysis view.
- Browser back/forward cannot restore the analysis view because it is not pushed into history.
- When the submit API fails, close the submit-confirm modal and show a separate submit-failure modal.

## Acceptance Criteria

- 51, 52, 53, and 54 writing workspaces share the same submit sequence.
- Submit pending state remains visible in the confirm modal.
- Submit success renders a page-level D-M2 analysis surface, not an overlay modal.
- Submit failure hides D-M1 before showing a failure modal.
- Existing feedback routes may still render their own pending/failed state for already-created submissions.

## SOT Follow-Up

If this behavior is accepted, update `docs/Wireframe/13-D-M2-ai-analysis-loading/functional-spec.md` and `description.md` from `modal/state` to a page-level transient state.
