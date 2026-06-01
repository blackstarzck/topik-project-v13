# AI UX Reviewer Checklist

## Purpose

Review IA surfaces where AI analysis, writing feedback, recommendations, or long-running generation states shape the user experience.

## Required Inputs

- IA profile row.
- Required packs, especially `WRITE`, `AUTOSAVE`, `SUBMIT`, `LOADING`, `ASYNC`, `DATA`, `CHART`, `RECOMMENDATION`, `PAYWALL-ENTRY`, `EXPORT`, and `RECOVERY`.
- Product docs for writing, feedback, recommendation, and report behavior.
- Current implementation and audit evidence.

## Applies When

- The IA includes AI writing support, analysis loading, feedback, reports, comparison, recommendation, next-problem routing, or weak-area logic.

## Does Not Apply When

- The IA has no AI-mediated outcome, recommendation, analysis, feedback, or generated report behavior.

## Checklist Items

- [ ] The UI explains whether analysis, recommendation, or feedback is pending, complete, failed, or unavailable.
- [ ] Long-running states prevent duplicate submissions and show a safe exit or wait path.
- [ ] Recommendations disclose enough context for the user to understand the next action.
- [ ] Feedback and reports distinguish real data from placeholders, fixtures, or unavailable states.
- [ ] Export behavior does not imply generated content exists before it is available.
- [ ] Paywall or locked recommendation entry follows deferred and policy docs.
- [ ] Recovery path exists for generation failure, timeout, or missing result.
- [ ] AI output does not override source-of-truth product, scoring, or access rules.

## Detailed Checklist Matrix

### AI State Clarity

- [ ] Surface states what AI-related action is happening.
- [ ] Surface distinguishes queued, analyzing, generating, complete, failed, and unavailable states.
- [ ] Pending copy does not promise exact timing unless product docs define it.
- [ ] Long-running work has a visible current status.
- [ ] Timeout state is separate from generic failure.
- [ ] Retry state is separate from regenerate/new-analysis state.
- [ ] User can safely leave or wait according to documented flow.
- [ ] Duplicate submit is prevented while analysis is pending.
- [ ] Completion state clearly shows the result is ready.
- [ ] Missing-result state gives next action.

### Trust, Transparency, And Limits

- [ ] AI output is labeled as feedback, recommendation, analysis, or generated content according to docs.
- [ ] The user can tell what input the AI result is based on.
- [ ] The user can tell whether the result is current, stale, cached, or fixture/sample.
- [ ] The UI does not present AI output as official scoring unless active docs allow it.
- [ ] Limitations are visible when correctness cannot be guaranteed.
- [ ] Low-confidence or partial result state is handled when product supports it.
- [ ] The UI avoids model-internal jargon.
- [ ] The UI does not claim human review unless human review occurred.
- [ ] AI failure copy avoids blaming the user when service failure occurred.
- [ ] AI result does not override auth, data, or policy boundaries.

### Writing And Feedback

- [ ] Writing prompt and user answer remain linked to the generated feedback.
- [ ] Short-answer feedback shows the correct submission context.
- [ ] Long-form feedback shows the correct submission context.
- [ ] Comparison report distinguishes current and previous attempts.
- [ ] Feedback page handles missing submission.
- [ ] Feedback page handles another user's submission id safely.
- [ ] Feedback page handles pending analysis.
- [ ] Feedback page handles failed analysis.
- [ ] Export waits until generated content is available.
- [ ] Exported content matches the visible feedback/report.

### Recommendation UX

- [ ] Recommendation explains why this item is recommended.
- [ ] Recommendation has an empty state when no recommendation exists.
- [ ] Recommendation has fallback when data is insufficient.
- [ ] User can accept the recommendation.
- [ ] User can ignore or choose another path where docs allow it.
- [ ] Recommendation refresh or retry is defined.
- [ ] Weakness-based recommendation identifies source data at a user-friendly level.
- [ ] Next-problem recommendation does not trap the user behind a missing paywall/billing flow.
- [ ] Recommendation does not expose hidden or another user's data.
- [ ] Recommendation evidence distinguishes fixture recommendation from real data.

### Feedback Loops And User Control

- [ ] User feedback controls are visible if the product collects AI feedback.
- [ ] Feedback control explains what is collected.
- [ ] Feedback control explains whether it affects future recommendations.
- [ ] User can correct or retry when AI result is unhelpful and docs allow it.
- [ ] User can continue without giving feedback.
- [ ] User can recover from failed feedback submission.
- [ ] User control does not create unsupported product promises.
- [ ] Human confirmation is required when profile says AI notes are insufficient.

### Evidence To Capture

- [ ] Pending state evidence.
- [ ] Completion state evidence.
- [ ] Failure state evidence.
- [ ] Timeout or blocked-service evidence where feasible.
- [ ] Fixture-vs-real-data distinction.
- [ ] Recommendation reason evidence.
- [ ] User control/feedback evidence where applicable.
- [ ] Export-after-generation evidence.
- [ ] Owner-scope evidence for AI output.
- [ ] Cross-IA handoff evidence from writing to analysis to feedback/report.

## Research-Backed Detailed Checks

- [ ] AI-assisted surfaces state what is being generated, checked, recommended, or retrieved.
- [ ] Pending state communicates progress honestly without implying a guaranteed result.
- [ ] The user can tell whether a result is fresh, cached, unavailable, fixture-based, or regenerated.
- [ ] Result confidence, limitation, or "review needed" state is visible when the product cannot guarantee correctness.
- [ ] Recommendations explain the next action using user-understandable reasons, not model-internal terms.
- [ ] User can accept, ignore, retry, regenerate, or navigate away according to the IA flow.
- [ ] Feedback/report output does not present speculative AI text as official scoring unless active docs allow it.
- [ ] AI failure separates timeout, service failure, missing input, invalid submission, and no recommendation available.
- [ ] User feedback controls explain what feedback is collected and how it affects the system when such feedback exists.
- [ ] AI output is scoped to the current user and cannot expose another user's prompt, answer, report, or recommendation context.
- [ ] Long-form feedback and comparison reports preserve source submission identity and avoid mixing old/new attempts.
- [ ] Exported AI feedback states whether generation is complete before export.
- [ ] Paywall entry does not promise AI capability beyond current deferred-scope rules.
- [ ] Test evidence checks user-visible AI states instead of model implementation details.

## Rating Criteria

- `PASS`: AI-mediated states, result availability, recommendation rationale, and recovery evidence are complete.
- `PARTIAL`: core AI-facing result exists but pending, failure, or recovery evidence is incomplete.
- `FAIL`: UI implies an unavailable AI result, traps the user, or presents fixture/generated content as verified data.
- `BLOCKED`: AI state cannot be exercised because service, data, or evidence is unavailable.
- `N/A`: no AI-mediated behavior exists in the IA profile.

## Required Evidence

- Pending and completion state evidence.
- Failure or timeout evidence when relevant.
- Data source or fixture distinction.
- Recommendation or feedback result evidence.
- Export evidence when relevant.

## Result Packet Fields

- `aiStateCoverage`
- `resultAvailability`
- `recommendationClarity`
- `feedbackReportEvidence`
- `failureRecovery`
- `fixtureRisk`

## External References

- NN/g usability heuristics.
- Playwright best practices for user-visible assertions.
- [Google People + AI Guidebook feedback loops](https://pair.withgoogle.com/guidebook/chapters/feedback-and-controls/design-ai-feedback-loops)
- [Google People + AI Guidebook patterns](https://pair.withgoogle.com/guidebook/patterns)
- [NN/g AI hallucinations](https://www.nngroup.com/articles/ai-hallucinations/)

## Project-Specific No-Pass Rules

- Do not pass AI analysis loading without timeout or failure-state evidence.
- Do not pass recommendation IA if the source, empty state, and next action are unclear.
- Do not pass AI result IA if fixture, stale, pending, failed, and complete states are not distinguishable.
