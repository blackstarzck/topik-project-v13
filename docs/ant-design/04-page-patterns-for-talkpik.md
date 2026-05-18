# Page Patterns For TALKPIK AI

This file applies Ant Design page patterns to the TALKPIK AI product structure.

## Product Type

TALKPIK AI is an enterprise-style learning workspace, not a landing page.

Design implication:

- Prioritize repeated use, scanning, learning progress, and task completion.
- Avoid oversized hero sections, decorative marketing cards, and vague slogans.
- The first screen should function as the learner's dashboard.

## Common App Shell

Use:

- `Layout`
- `Sider` or responsive drawer navigation
- `Header`
- `Content`
- floating or docked AI tutor access

Rules:

- Navigation must remain predictable across all main pages.
- The AI tutor must not cover exam-critical actions such as OMR, next, submit,
  or end exam.
- Language/profile controls should be stable and easy to find.

## Dashboard / Workbench

Use Ant Design workbench thinking.

Recommended components:

- `Statistic`
- `Progress`
- `Card`
- `Table` or `Card` plus `Flex`
- `Button`
- `Alert`
- `Tabs` only if there are peer dashboard views.

Required content:

- Current learning goal.
- Today's next learning action.
- Weak points.
- Recent feedback.
- Mock exam status.

Rules:

- The dashboard must answer "what should I do now?"
- Keep primary learning actions more visible than secondary news/profile data.

## Problem Generation Form

Use Ant Design form-page thinking.

Recommended components:

- `Form`
- `Radio.Group`
- `Select`
- `Card`
- `Alert`
- `Button`
- `Steps` if generation becomes multi-step.

Rules:

- Required choices must block generation until complete.
- Preview selected problem type before generation.
- Keep field labels plain and stable.
- Show loading state while generating.

## Problem Solving Page

Recommended components:

- `Card` or content panel for question stem.
- `Radio.Group` or answer controls.
- `Progress` for position in problem set.
- `Button` for previous, next, confirm.
- `Alert` for explanation or correction.

Rules:

- Question content must be more prominent than navigation chrome.
- Answer selection and confirmation must be visually connected.
- Bookmarked/saved state should be visible but secondary.

## Writing Practice Page

Recommended components:

- `Input.TextArea`
- `Form`
- `Card`
- `Alert`
- `Collapse`
- `Progress`
- `Modal`
- `Button`

Rules:

- Writing prompt and answer editor must be the main layout focus.
- Autosave status must be visible near the editor.
- Recommended expressions and required vocabulary should be available without
  covering the writing area.
- Submission requires confirmation.

## Writing Feedback List

Use Ant Design list-page thinking.

Recommended components:

- `Tabs`
- `Table` or `Card` plus `Flex`
- `Tag`
- `Input.Search`
- `Select`
- `Button`
- `Empty`

Rules:

- Separate completed feedback and draft/in-progress answers.
- Show score, type, status, date, and title consistently.
- Filters must be visible and understandable.
- Empty states must suggest the next learning action.

## Writing Feedback Detail

Use Ant Design detail-page thinking.

Recommended components:

- `Descriptions`
- `Statistic`
- `Progress`
- `Tabs`
- `Collapse`
- `Alert`
- `Button`

Rules:

- Show summary score first.
- Then show AI general feedback.
- Then show step-by-step or sentence-level corrections.
- Provide next actions: rewrite, save, export, practice similar.

## Mock Exam

Recommended components:

- `Layout`
- `Progress`
- `Statistic`
- `Radio.Group`
- `Drawer` for OMR on mobile.
- `Modal` for ending exam.
- `Alert` for time warnings.

Rules:

- Timer, current section, and answer status must always be clear.
- OMR access must never hide submit/end controls.
- Exam controls should be stable, not animated in distracting ways.

## Vocabulary And Library

Recommended components:

- `Table` or `Card` plus `Flex`
- `Card`
- `Tag`
- `Input.Search`
- `Select`
- `Empty`
- `Pagination`

Rules:

- Saved items need clear review action.
- Filters should match learner mental models: level, type, tag, date, status.
- Card view and list view may both exist, but state must remain consistent.

## Board And Notices

Recommended components:

- `Tabs`
- `Table` or `Card` plus `Flex`
- `Tag`
- `Typography`
- `Breadcrumb`

Rules:

- Notices and events must be easy to distinguish.
- Detail pages should keep "back to list" behavior predictable.

## Profile Settings

Recommended components:

- `Form`
- `Tabs`
- `Select`
- `Input`
- `Button`
- `Alert`

Rules:

- Separate profile, learning goal, language, subscription, and security areas.
- Destructive account actions require confirmation.
