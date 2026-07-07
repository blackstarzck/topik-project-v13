# Feedback direct next problem start

## Proposal

Change the feedback short/long "다음 문제 풀기" CTA so it starts the next
writing problem directly instead of opening the R-02 `/practice/next`
recommendation page.

## Reason

The requested product behavior is that a learner who finishes a feedback page
continues to the problem whose `problems.id` follows the submitted problem. If
there is no later ID, the flow wraps to the first eligible problem. If that
target problem has already been solved, it still opens as a new attempt.

Current SOT routes E-01/E-02 feedback next CTA to R-02 `/practice/next`, whose
recommendation logic can exclude already attempted problems. That conflicts
with this behavior.

## Proposed Acceptance Criteria

- On `/writing/feedback/short/:id` and `/writing/feedback/long/:id`, clicking
  "다음 문제 풀기" navigates directly to the writing page for the next eligible
  problem.
- The target problem is chosen from visible, published, active writing problems
  with the same `question_no`, sorted by `problems.id ASC`.
- If the submitted problem is last in that order, the next CTA wraps to the
  first eligible problem.
- If only the submitted problem is eligible, the CTA opens the same problem as
  a new attempt.
- The target URL includes `fresh=1` and does not include `retrySubmission`.
- `/practice/next`, recommendation runtime, DB schema, and migrations remain
  unchanged.

## Affected SOT

- `docs/Wireframe/14-E-01-short-answer-feedback/functional-spec.md`
- `docs/Wireframe/15-E-02-long-form-feedback/functional-spec.md`
- `docs/Wireframe/17-R-02-next-problem-recommendation/functional-spec.md`
- `docs/flow/user-flow.md`
- `docs/Wireframe/share/03-learner-side-nav-state/contextual-route-placement.md`
