# Analysis Exhausted Wait Modal Proposal

Date: 2026-07-04

## Context

When writing analysis polling attempts are exhausted (about 10s x 2 after the
analysis screen mounts) and the submission is still `pending`/`analyzing`, the
current UX does two things at once:

1. `AnalysisLoadingPage` shows a warning `Alert` ("분석 대기 상태로 저장됐어요")
   below the progress steps.
2. `SubmittedAnalysisPanel` immediately calls `router.replace('/library')`,
   moving the learner to My Library with no warning.

The product request for this change is to stop the abrupt redirect and replace
the warning banner with an explicit, centered wait modal that gives the learner
a short choice window before moving on.

## Target Documents

- `docs/Wireframe/13-D-M2-ai-analysis-loading/description.md` (D-M2 exhausted
  polling / stored pending handoff wording)
- Related prior proposals:
  - `docs/sot-change-proposals/2026-06-26-remove-analysis-slow-handoff.md`
    (rule 3: stored pending handoff shown when polling is exhausted)
  - `docs/sot-change-proposals/2026-06-25-writing-analysis-handoff.md`
    (My Library as the recovery surface)

## Proposed Product Rule

1. The active analysis stage stays unchanged: title, progress steps, expected
   time, and the read-only answer lock context. No timed warning banner is
   shown during active analysis.
2. When polling attempts are exhausted and the submission is still
   `pending`/`analyzing`, the app does NOT redirect immediately and does NOT
   show the inline warning `Alert` below the steps.
3. Instead, a centered modal opens over the analysis screen with the message
   "곧 분석이 완료될 거예요. 다른 문제를 풀면서 조금만 기다려주세요!" and two
   footer actions: `대시보드로 이동` and `내 서재로 이동`.
4. The modal starts a 5 second countdown. The `내 서재로 이동` button label
   shows the remaining seconds (5, 4, 3, 2, 1). When the countdown reaches
   zero, the app automatically navigates to My Library (`/library`) using a
   history `replace`, so the dead analysis screen is not left in history.
5. Button navigation is an explicit learner action and uses `push`
   (`/dashboard` or `/library`). Automatic navigation and button navigation
   are mutually exclusive; only the first one fires.
6. The modal cannot be dismissed by mask click, Escape, or a close button; the
   learner either picks a destination or is moved to My Library after 5
   seconds.
7. While the wait modal is open, the leave guards (`beforeunload`, back
   navigation confirm) are released, because the answer is already stored and
   "leaving" is exactly what the modal offers.
8. My Library remains the recovery surface for pending/analyzing submissions
   (unchanged from the 2026-06-25/2026-06-26 proposals).

## Considered Alternatives

1. Keep the current inline Alert + immediate redirect (status quo): rejected —
   the redirect is disorienting and the Alert is visible for under a second
   before the screen changes.
2. Keep the Alert but delay the redirect: rejected — two competing surfaces
   (banner + auto redirect) still race each other; a single modal is clearer.
3. Modal without auto-redirect: rejected by the product request — the flow
   should still converge to My Library so learners do not wait on a screen
   that will not resolve within the polling window.

## Non-Goals

1. Changing the backend polling window (`ANALYSIS_POLL_INTERVAL_MS`,
   `ANALYSIS_POLL_MAX_ATTEMPTS`).
2. Removing the stored pending state or My Library visibility for
   pending/analyzing submissions.
3. Cleaning up the now-unused `feedback.analysis.delayed*` /
   `viewLibraryStatus` message keys (left for a separate cleanup).

## SOT Update Direction

Update `docs/Wireframe/13-D-M2-ai-analysis-loading/description.md` so the
exhausted-polling stage describes the wait modal (message, two destinations,
5 second countdown with auto move to My Library) instead of the inline stored
pending banner + immediate redirect. Apply after user confirmation.
