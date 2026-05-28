# IA AI-First UX Review Checklist

> Use this checklist during Phase 5 of
> `docs/ai-workflow/ia-implementation-verification-execution-plan.md`.
> It is a first-pass UX readiness filter for all 34 IA items. It does not
> replace final human UX judgment.

## 1. Purpose

AI-first UX review answers this question:

> Is this IA item ready for a human UX reviewer, and what should the human focus on?

The AI reviewer must check evidence, compare the page against the IA documents,
and flag obvious UX, accessibility, navigation, policy, and AI-behavior risks.

The AI reviewer must not mark an IA item `PASS` from code inspection or HTTP
status alone. A final `PASS` needs rendered evidence and either high-confidence
AI review plus human confirmation, or a recorded reason why human confirmation is
not needed for that specific item.

## 2. Required Inputs

Read these before reviewing any IA item:

- `docs/ai-workflow/ia-implementation-verification-execution-plan.md`
- `docs/ai-workflow/ia-page-implementation-verification.md`
- `docs/IA/README.md`
- matching `docs/IA/<ia-folder>/description.md`
- matching `docs/IA/<ia-folder>/wireframe.png`, when available
- `docs/sitemap.md`
- `docs/flow/user-flow.md`
- `docs/prd.md`
- relevant implementation files under `src/app/**`, `src/components/**`, and
  `src/lib/routes.ts`
- Phase 1 to Phase 4 evidence, especially static results, browser screenshots,
  hosted-surface checks, and security/navigation results

Use `docs/user-flow.md` only as legacy reference. Active docs win.

## 3. Research Basis

This checklist is derived from these external UX sources:

- NN/g 10 usability heuristics:
  https://www.nngroup.com/articles/ten-usability-heuristics/
- W3C WCAG 2.2 Focus Order:
  https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html
- W3C WCAG 2.2 Error Identification:
  https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html
- W3C WCAG 2.2 Labels or Instructions:
  https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html
- W3C WCAG 2.2 Reflow:
  https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
- GOV.UK Design System error message:
  https://design-system.service.gov.uk/components/error-message/
- GOV.UK Design System error summary:
  https://design-system.service.gov.uk/components/error-summary/
- GOV.UK Design System question pages:
  https://design-system.service.gov.uk/patterns/question-pages/
- GOV.UK Service Standard, solve a whole problem:
  https://www.gov.uk/service-manual/service-standard/point-2-solve-a-whole-problem
- Microsoft HAX guidelines for human-AI interaction:
  https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/
- Google People + AI Guidebook:
  https://pair.withgoogle.com/guidebook-v2/

## 4. Result Labels

Use the same final label vocabulary as the execution plan.

- `PASS`: evidence, flow, UX, accessibility, and policy checks are acceptable.
- `PARTIAL`: core path exists, but evidence or secondary UX coverage is missing.
- `FAIL`: user confusion, broken flow, inaccessible interaction, unsafe copy, or
  policy overclaim is present.
- `BLOCKED`: account, fixture, environment, route, or data prerequisite is absent.
- `DOC-GAP`: active docs do not define the behavior clearly enough.
- `DEFERRED`: active docs explicitly keep the behavior out of current scope.

Use this extra Phase 5 field:

- `Human confirmation`: `ready`, `needs-human-judgment`, `not-ready`.

## 5. IA Review Card Template

Create one card per IA item in
`reports/ia-verification/latest/ai-ux-review.md`.

```markdown
### D-01 Short-answer writing 51

- Route or host route: `/writing/51`
- Route type: `page`
- Audience: `user`
- IA source: `docs/IA/08-D-01-short-answer-writing-51/description.md`
- Implementation anchors:
  - `src/app/(workspace)/writing/[questionId]/page.tsx`
  - `src/components/writing/WritingEditor.tsx`
- Required evidence:
  - mobile 360 screenshot:
  - tablet 768 screenshot:
  - desktop 1280 screenshot:
  - direct URL:
  - browser back:
  - keyboard/focus:
  - error/empty/loading state:
- AI UX result: `PARTIAL`
- Confidence: `medium`
- Human confirmation: `needs-human-judgment`

AI findings:
- Page job: clear / unclear / missing evidence
- Entry context: clear / unclear / missing evidence
- Primary action: clear / competing / missing
- Flow continuity: pass / partial / fail
- AI behavior: pass / partial / fail / not applicable
- Form/error UX: pass / partial / fail / not applicable
- Keyboard/focus: pass / partial / fail
- Responsive: pass / partial / fail
- Policy/trust copy: pass / partial / fail / not applicable

Top gaps:
- Focus skips autosave state before submit CTA.
- Refresh after draft input is not verified.

Human reviewer should inspect:
- Whether the writing guide feels helpful or distracting on mobile.
- Whether the Korean error copy sounds natural.
```

## 6. Common Checklist

### 6.1 Page Job And First Impression

- The first heading explains where the user is.
- The page has one clear user job.
- The main CTA is easy to find.
- Secondary actions do not compete with the main CTA.
- The screen does not rely on internal product jargon.
- The page still makes sense when entered directly from a URL, email, or
  notification.

### 6.2 IA And Wireframe Fidelity

- Every required region from `description.md` is present or explicitly
  superseded.
- `wireframe.png` order and relative importance are preserved.
- Missing wireframe items are marked as `missing`, not silently ignored.
- Intentional deviations are marked `superseded` with a reason.
- The page does not add unrelated UI that distracts from the documented user
  task.

### 6.3 User Flow And Navigation

- The page matches the previous and next step in `docs/flow/user-flow.md`.
- Direct URL entry explains the current context and next action.
- Browser back has a predictable result.
- Refresh preserves or clearly explains lost draft/filter/selection state.
- Invalid id, malformed id, wrong-owner id, expired session, and logged-out
  entry have safe outcomes or non-`PASS` labels.
- Users can return to dashboard, list, or the previous task without being stuck.

### 6.4 Human-AI Behavior

Apply this section to recommendations, scoring, feedback, analysis, and any AI
generated guidance.

- The user can tell where AI is involved.
- The page explains why the AI recommendation or feedback appears.
- The page shows enough evidence or context to make the AI result reviewable.
- The user can reject, retry, regenerate, report, or manually choose an
  alternative where appropriate.
- Uncertainty is not hidden behind confident copy.
- AI output is not presented as guaranteed, official, or final when it is only a
  learning aid.

### 6.5 Status, Loading, Empty, And Error States

- Loading states explain what is happening and what the user can or cannot do.
- Autosave states distinguish saved, saving, delayed, and failed.
- Empty states offer a next action.
- Errors use plain language.
- Errors explain what happened, why it matters, and how to recover.
- User input is preserved after recoverable form errors.
- Retry, cancel, back, or support paths exist for important failures.

### 6.6 Forms, Labels, And Instructions

- Inputs have visible labels or instructions.
- Required and optional inputs are clear.
- Helper copy explains why sensitive or unusual data is needed.
- Placeholder text is not the only label.
- Validation messages point to the exact field or action.
- Long forms ask only what is needed for the current task.

### 6.7 Keyboard, Focus, And Modal Behavior

- `Tab` order follows the visual and task order.
- Focus indicators are visible.
- Buttons, links, inputs, tabs, dropdowns, and menus are keyboard reachable.
- `Enter` and `Space` behavior is predictable.
- Modal focus moves inside the modal when opened.
- Modal focus returns to the triggering control when closed.
- `Esc`, close, cancel, and backdrop behavior are documented.
- Background scroll and background interaction are blocked when a blocking modal
  is open.

### 6.8 Responsive And Touch UX

- 360px, 768px, and 1280px evidence exists or the item is not `PASS`.
- 320px to 360px width has no horizontal content loss for core tasks.
- Touch targets are usable on mobile.
- Long Korean and English text do not overflow buttons, cards, or table cells.
- Main CTA remains visible without covering important content.
- Tables, charts, KPI cards, and admin lists keep a readable mobile order.

### 6.9 Policy, Trust, And Security Copy

- Raw provider errors are not shown to users.
- Auth errors give safe next actions.
- Paywall and subscription pages do not imply live payment integration when
  billing is deferred.
- Notification settings do not imply real delivery when notification transport
  is deferred.
- Pricing, refund, retention, account deletion, and legal policy gaps are marked
  `DOC-GAP`.
- Admin pages do not mix admin-only actions into normal learner flows.

## 7. Project-Specific IA Packs

Use these packs to focus the AI review.

### Public And Auth

IA: `X-01`, `A-01`, `A-02`, `X-06`, `X-11`, `X-12`, auth callback routes.

- Public entry and CTA clarity.
- Signup/login/password reset recovery.
- Email verification cooldown and resend copy.
- Raw auth error suppression.
- Direct URL and magic-link entry.
- Session-expired and retry-after states.

### Onboarding And Dashboard

IA: `A-03`, `B-01`, `X-02`.

- First-run context.
- Current learning state.
- Next learning action.
- Progress and dashboard cards.
- Empty and first-use states.

### Practice Selection

IA: `C-01`, `C-02`, `C-03`, `X-07`, `R-02`.

- Recommendation reasoning.
- Filters, sorting, and retry decision.
- AI confidence and user control.
- Return path to problem list.
- Modal behavior for retry/continue.

### Writing And Submission

IA: `D-01`, `D-02`, `D-03`, `D-04`, `D-M1`, `D-M2`, `D-M3`.

- Prompt, answer input, guidance, timer, and autosave visibility.
- Submit confirmation and duplicate-submit prevention.
- AI analysis waiting state.
- Autosave failure recovery.
- Browser back and refresh with draft data.

### Feedback, Reports, And Recommendations

IA: `E-01`, `E-02`, `R-01`, `R-02`.

- Feedback basis and explanation.
- Score, rubric, and improvement advice clarity.
- Comparison context.
- Next problem recommendation and return path.
- AI limitation and dispute/report path.

### Library And Export

IA: `F-01`, `F-M1`.

- Saved work discoverability.
- Filter and search state.
- Export trigger and export result.
- PDF modal versus browser print mismatch.
- Failure recovery for export.

### Settings, Profile, Paywall, And Subscription

IA: `G-01`, `X-03`, `X-04`, `X-05`, `X-09`.

- Language and notification settings clarity.
- Profile data purpose.
- Deferred billing copy.
- Notification transport copy.
- Save, cancel, success, and failure states.

### Admin

IA: `H-01`, `X-08`, `X-10`.

- Admin-only entry and role separation.
- Table/list mobile readability.
- Bulk action safety.
- Permission and audit-sensitive copy.
- Normal learner flow isolation.

## 8. Codebase Evidence Anchors

Use these anchors during Phase 5. They are not a complete implementation map;
they are the current starting points for evidence collection.

- Route authority: `docs/sitemap.md`
- IA inventory: `docs/IA/README.md`
- User flow: `docs/flow/user-flow.md`
- Sidebar/protected-route source: `src/lib/routes.ts`
- Auth guard and route exposure: `src/proxy.ts`
- Workspace shell: `src/app/(workspace)/layout.tsx`
- Public pages: `src/app/page.tsx`, `src/app/sign-up/page.tsx`,
  `src/app/login/page.tsx`, `src/app/password-reset/page.tsx`
- Auth pages/handlers: `src/app/auth/callback/route.ts`,
  `src/app/auth/callback-fragment/page.tsx`,
  `src/app/auth/error/page.tsx`,
  `src/app/auth/verify-email/page.tsx`
- Writing route: `src/app/(workspace)/writing/[questionId]/page.tsx`
- Submit modal: `src/components/writing/SubmissionConfirmModal.tsx`
- Autosave warning: `src/components/writing/AutosaveWarningModal.tsx`
- AI loading state: `src/components/feedback/AnalysisLoadingModal.tsx`
- Retry modal: `src/components/practice/RetryModal.tsx`
- Library export: `src/components/library/ExportPdfButton.tsx`
- Current E2E matrix: `tests/e2e/coverage/coverage-matrix.spec.ts`
- Golden path scenarios: `tests/e2e/coverage/golden-path.spec.ts`

## 9. AI Must Not Pass When

Do not mark an item `PASS` when any of these are true:

- No rendered screenshot or browser evidence exists.
- Only HTTP 200 or route existence was verified.
- The matching IA `description.md` was not read.
- The item is a hosted modal but only the component file was inspected.
- The modal trigger from the host route was not verified.
- The item has an auth, role, owner-id, or external-entry scenario that was not
  covered.
- The browser result depends only on fake fixture data and no limitation is
  recorded.
- The page contains policy or deferred-scope claims that active docs do not
  support.
- Active docs conflict and the conflict is unresolved.
- The reviewer cannot inspect keyboard/focus behavior for a keyboard-relevant
  surface.

## 10. AI Reviewer Prompt Template

Use this prompt when assigning the Phase 5 AI-first UX review to a reviewer or
sub-agent.

```text
Review this IA item using docs/ai-workflow/ia-ai-first-ux-review-checklist.md.

Inputs:
- IA code and screen name:
- Route or host route:
- Route type:
- Audience:
- IA description path:
- Wireframe path:
- Implementation anchors:
- Phase 1 to Phase 4 evidence:
- Screenshots:

Return one IA review card with:
- AI UX result: PASS/PARTIAL/FAIL/BLOCKED/DOC-GAP/DEFERRED
- Confidence: high/medium/low
- Human confirmation: ready/needs-human-judgment/not-ready
- Evidence used
- Findings grouped by page job, entry context, primary action, flow continuity,
  AI behavior, form/error UX, keyboard/focus, responsive, policy/trust
- Top gaps
- Exact human review questions
- Screenshot or browser evidence still needed

Rules:
- Do not mark PASS from source inspection alone.
- Treat hosted modals as host-route experiences, not standalone pages.
- Mark unclear product decisions as DOC-GAP.
- Mark unavailable auth/data/env prerequisites as BLOCKED.
```

## 11. Human Confirmation Rule

AI-first review is the filter. Human confirmation is still required when:

- confidence is `low` or `medium`,
- result is `PARTIAL`, `FAIL`, `BLOCKED`, or `DOC-GAP`,
- the IA item includes a modal, form, AI output, auth recovery, billing,
  notifications, admin actions, or policy-sensitive copy,
- the AI flags visual hierarchy, wording, tone, perceived trust, or mobile
  readability as a judgment question.

The human reviewer should not repeat every mechanical check. They should inspect
the questions and risks that the AI card surfaces.
