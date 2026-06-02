# IA Page Implementation Verification Procedure

> Purpose: use this document to verify whether each IA page is implemented well enough against the current product docs, user flow, design intent, route map, policy boundaries, and operating scenarios.
>
## 1. One-Line Rule

An IA page is not complete just because the route opens.

It is complete only when the page satisfies the planned user outcome, visual structure, data behavior, access rules, failure recovery, policy boundaries, and verification evidence.

## 2. Source Priority

Use documents in this order.

1. `docs/sitemap.md`
   - Route, audience, route type, modal host, and current route authority.
2. `docs/Wireframe/README.md` and each `docs/Wireframe/*/description.md`
   - Current IA inventory and page-level screen requirements.
3. `docs/flow/user-flow.md`
   - Current user journey, transitions, entry and exit states.
4. `docs/prd.md`
   - Product purpose, MVP behavior, future/deferred scope notes.
5. `docs/spec.md` and matching `docs/development/*`
   - Implementation, auth, data, deployment, billing, and quality rules.
6. `docs/user-flow.md`
   - Legacy observation only. Do not promote legacy-only behavior to current failure.

If active docs disagree, record `DOC-GAP`.

Known current doc drift:

- `docs/Wireframe/README.md` lists 39 IA entries.
- Five entries, X-13 through X-17, were added after the existing 34 Wireframe screens from codebase route coverage.
- Some historical prose still says 32 or 34 screens.
- Treat the actual IA inventory and sitemap route table as the working source.
- Record stale 32/34-screen wording as `DOC-GAP`, not implementation failure.

## 3. Evidence Sources

Use these sources as checklist inspiration, not as product requirements.

- NN/g usability heuristics: system status, user control, consistency, error prevention, recovery from errors.
  - https://www.nngroup.com/articles/ten-usability-heuristics/
- OWASP WSTG authorization testing: unauthenticated access, horizontal access, vertical access, direct protected URL access.
  - https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/05-Authorization_Testing/02-Testing_for_Bypassing_Authorization_Schema
- OWASP WSTG logout testing: visible logout, server-side session termination, back button after logout, timeout.
  - https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/06-Session_Management_Testing/06-Testing_for_Logout_Functionality
- W3C WCAG 2.2 error identification: errors must be described in text.
  - https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html
- W3C WCAG 2.2 focus order: keyboard focus order must preserve meaning and operation.
  - https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html
- W3C WCAG 2.2 labels or instructions: inputs need labels or instructions.
  - https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html
- NHS form guidance: journeys rarely start at the start page, help belongs in context, error messages should explain how to fix the problem.
  - https://service-manual.nhs.uk/content/how-to-write-good-questions-for-forms/write-the-supporting-content-for-your-form
- Playwright best practices: test user-visible behavior, keep tests isolated, use resilient locators, use web-first assertions.
  - https://playwright.dev/docs/best-practices

## 4. Result Labels

Use one label per IA page and one label per checklist area.

- `PASS`: current docs, implementation, and evidence agree.
- `PARTIAL`: some required behavior exists, but important evidence or behavior is missing.
- `FAIL`: current active docs require it, but implementation is missing or wrong.
- `DEFERRED`: product context exists, but current IA/sitemap or deferred-scope docs keep it out of current implementation.
- `DOC-GAP`: active docs conflict, omit the decision, or leave policy unclear.
- `BLOCKED`: verification cannot run because required environment, data, permission, or service is unavailable.

Do not upgrade `BLOCKED` or fixture-only evidence to `PASS`.

## 5. Route Types

Every IA item must be classified before verification.

- `page`: standalone route with a visible page.
- `hosted modal`: modal hosted inside another route.
- `modal/state`: modal or loading state without a standalone URL.
- `modal/toast`: toast or warning state hosted by a page.
- `route handler`: request handler with redirects, cookies, or server-side effects.

Current special cases:

- `C-03`, `D-M1`, `D-M2`, `D-M3`, `F-M1` are hosted modal/state surfaces.
- `/auth/callback` and `/auth/sign-out` are route handlers.
- `/auth/callback-fragment` is a public page for implicit auth fragment handling.
- `X-11` and `X-12` are current public auth pages, not future scope.

## 6. Common Checklist For Every IA Page

Add this checklist to each IA page spec or use it as the page-level review template.

### Planning

- [ ] The page has one clear user job.
- [ ] The page purpose matches PRD MVP or is explicitly marked deferred.
- [ ] The entry path from `docs/flow/user-flow.md` is defined.
- [ ] The exit path and next action are defined.
- [ ] Browser back behavior is defined.
- [ ] Direct URL entry behavior is defined.
- [ ] Refresh behavior is defined.
- [ ] Empty state is defined.
- [ ] Error state is defined.
- [ ] Permission or subscription-limited state is defined when relevant.
- [ ] Primary CTA is clear and does not compete with another primary action.

### UX And UI

- [ ] Wireframe Number Map elements are visible or intentionally superseded.
- [ ] Heading, section order, and CTA order match the user's task.
- [ ] The page explains the current system status when loading, saving, submitting, analyzing, or failing.
- [ ] Error messages use plain language and explain the recovery action.
- [ ] Forms have visible labels or instructions.
- [ ] Keyboard focus order follows the visual and task order.
- [ ] Modal focus moves into the modal when opened.
- [ ] Modal focus returns to the trigger when closed.
- [ ] Mobile, tablet, and desktop layouts keep text and controls readable.
- [ ] No UI text promises a deferred feature as if it is currently working.

### Development

- [ ] Sitemap route and implemented route match.
- [ ] Route type is correct: page, hosted modal, modal/state, modal/toast, or route handler.
- [ ] Public, user, and admin audience behavior matches `docs/sitemap.md`.
- [ ] Direct protected URL access redirects or blocks correctly.
- [ ] Invalid id, missing id, wrong id, or malformed query is handled.
- [ ] Back and refresh do not duplicate irreversible actions.
- [ ] Loading, empty, error, disabled, success, and blocked states are implemented.
- [ ] Tests check user-visible behavior, not internal implementation details.
- [ ] HTTP 200 or "no 500" is not used as final proof of correctness.

### Data And Security

- [ ] User-owned data is scoped to the current authenticated user.
- [ ] Admin-only data is scoped to the correct admin role.
- [ ] Horizontal access is tested where ids or row ownership exist.
- [ ] Vertical access is tested where admin/user roles differ.
- [ ] Logout invalidates access to protected pages.
- [ ] Browser back after logout does not reveal protected data after reload.
- [ ] Raw auth errors, tokens, secrets, and service keys are not exposed in UI or URLs.
- [ ] Server-only behavior stays server-side.
- [ ] RLS or equivalent access boundary is documented when data is involved.

### Operations

- [ ] External service failure has a user-facing recovery path.
- [ ] Retry, cooldown, timeout, or rate-limit behavior is defined when relevant.
- [ ] Long-running states explain what is happening.
- [ ] Failure state does not trap the user.
- [ ] Admin or system actions leave audit evidence when required.
- [ ] Operationally useful logs exist for server-only failures when required.

### Policy

- [ ] Billing, subscription, paywall, and payment behavior respects `docs/development/deferred-scope.md`.
- [ ] Notification transport is not implied unless implemented.
- [ ] Language/i18n scope is clear.
- [ ] Email verification, password reset, cooldown, and account cleanup copy matches current auth policy.
- [ ] Privacy-sensitive copy explains why data is requested where needed.
- [ ] Unresolved business, legal, pricing, or retention rules are marked `DOC-GAP`.

### QA

- [ ] Static doc-code sync has evidence.
- [ ] Route/audience tests have evidence.
- [ ] Browser smoke or manual QA evidence exists.
- [ ] Important flows have Playwright, integration, or documented manual checks.
- [ ] Screenshots, trace, logs, or test output are linked in the audit report.
- [ ] Each missing check is labeled `PARTIAL`, `BLOCKED`, `DEFERRED`, or `DOC-GAP`.

## 7. External Entry And Navigation Scenarios

Run these for each `page` route.

- Direct URL while logged out.
- Direct URL as a normal learner.
- Direct URL as content admin, org admin, and platform admin when relevant.
- Direct URL with invalid query.
- Direct URL with malformed id.
- Direct URL with another user's id when ownership applies.
- Browser back from this page.
- Browser forward into this page.
- Refresh while data is loading.
- Refresh after form input.
- Refresh after submit.
- Browser back after submit.
- Browser back after logout.
- Session expired while on the page.
- Network failure during the main action.
- Mobile viewport.
- Tablet viewport.
- Desktop viewport.

For hosted modals and states, run the equivalent host-route trigger scenario.

## 8. IA-Specific Checklist Packs

`CORE` means the common checklist above.

| IA | Route or Host | Type | Required Packs |
| --- | --- | --- | --- |
| X-01 Product landing | `/` | page | CORE, PUBLIC, ENTRY, COPY-POLICY |
| X-13 Terms | `/terms` | page | CORE, PUBLIC, POLICY |
| X-14 Privacy policy | `/privacy` | page | CORE, PUBLIC, POLICY, PII |
| A-01 Sign-up | `/sign-up` | page | CORE, FORM, AUTH, EMAIL, POLICY |
| A-02 Login | `/login` | page | CORE, FORM, AUTH, SESSION |
| X-06 Password reset | `/password-reset` | page | CORE, FORM, AUTH, EMAIL, TOKEN |
| X-16 Password reset confirm | `/password-reset/confirm` | page | CORE, FORM, AUTH, TOKEN, SECURITY |
| A-03 Learning goal setup | `/onboarding/learning-goal` | page | CORE, FORM, GUARD, ONBOARDING |
| B-01 Home dashboard | `/dashboard` | page | CORE, GUARD, DATA, EMPTY, NAV |
| C-01 Problem type recommendations | `/practice/recommendations` | page | CORE, GUARD, DATA, FILTER |
| C-02 Problem list | `/practice/problems` | page | CORE, GUARD, DATA, FILTER, DIRECT-ID |
| C-03 Retry modal | `/practice/problems` | hosted modal | CORE, MODAL, BACK, STATE |
| D-01 Writing 51 | `/writing/51` | page | CORE, WRITE, AUTOSAVE, SUBMIT, BACK, REFRESH |
| D-02 Writing 52 | `/writing/52` | page | CORE, WRITE, AUTOSAVE, SUBMIT, BACK, REFRESH |
| D-03 Writing 53 | `/writing/53` | page | CORE, WRITE, AUTOSAVE, SUBMIT, BACK, REFRESH |
| D-04 Writing 54 | `/writing/54` | page | CORE, WRITE, AUTOSAVE, SUBMIT, BACK, REFRESH |
| D-M1 Submission confirmation | writing routes | hosted modal | CORE, MODAL, IRREVERSIBLE-ACTION |
| D-M2 AI analysis loading | writing submission flow | modal/state | CORE, LOADING, ASYNC, OPS |
| D-M3 Autosave warning | writing routes | modal/toast | CORE, AUTOSAVE, FAILURE, RECOVERY |
| E-01 Short-answer feedback | `/writing/feedback/short/:id` | page | CORE, DATA, OWNER-CHECK, DIRECT-ID, EXPORT |
| E-02 Long-form feedback | `/writing/feedback/long/:id` | page | CORE, DATA, OWNER-CHECK, DIRECT-ID, EXPORT |
| R-01 Comparison report | `/writing/reports/:id/compare` | page | CORE, DATA, CHART, OWNER-CHECK, EXPORT |
| R-02 Next problem recommendation | `/practice/next` | page | CORE, DATA, EMPTY, PAYWALL-ENTRY |
| F-01 My library | `/library` | page | CORE, DATA, OWNER-CHECK, SEARCH, EXPORT |
| F-M1 PDF export modal | library, feedback, report routes | hosted modal | CORE, MODAL, EXPORT, STORAGE, FAILURE |
| G-01 Language settings | `/settings/language` | page | CORE, POLICY, PERSISTENCE, I18N |
| X-15 Admin index | `/admin` | page | CORE, ADMIN, RBAC |
| H-01 Admin problem management | `/admin/problems` | page | CORE, ADMIN, RBAC, AUDIT |
| X-02 Growth dashboard | `/growth` | page | CORE, DATA, CHART, EMPTY |
| X-03 Paywall | `/paywall` | page | CORE, POLICY, DEFERRED-BILLING, BACK |
| X-04 Subscription management | `/subscription` | page | CORE, POLICY, DEFERRED-BILLING, DATA |
| X-05 Profile editing | `/profile` | page | CORE, FORM, PII, OWNER-CHECK |
| X-07 Weakness-based recommendations | `/practice/weakness` | page | CORE, DATA, RECOMMENDATION, EMPTY |
| X-08 Organization admin dashboard | `/admin/org` | page | CORE, ADMIN, RBAC, ORG-SCOPE |
| X-09 Notification settings | `/settings/notifications` | page | CORE, POLICY, PERSISTENCE, TRANSPORT-DEFERRED |
| X-10 Admin user management | `/admin/users` | page | CORE, ADMIN, RBAC, AUDIT, PRIVILEGE |
| X-11 Auth error | `/auth/error` | page | CORE, AUTH, ERROR-REASON, RATE-LIMIT, SECURITY |
| X-12 Auth verify-email | `/auth/verify-email` | page | CORE, AUTH, EMAIL, COOLDOWN, RETRY |
| X-17 Auth callback fragment | `/auth/callback-fragment` | page | CORE, AUTH, FRAGMENT, CLIENT-SESSION, TOKEN, SECURITY |

Route handler support checks:

| Route | Type | Required Packs |
| --- | --- | --- |
| `/auth/callback` | route handler | AUTH, TOKEN, NEXT-URL, RAW-ERROR-BLOCK |
| `/auth/sign-out` | route handler | AUTH, SESSION-END, BACK-BUTTON |

## 9. Pack Definitions

Use these definitions when applying the IA-specific packs.

- `ADMIN`: correct admin surface, admin navigation, admin-only empty/error states.
- `ASYNC`: pending state, timeout state, duplicate-submit prevention.
- `AUDIT`: admin action writes audit evidence or documents why not applicable.
- `AUTH`: auth state, public path, callback, redirect, and session behavior.
- `AUTOSAVE`: saved, saving, failed, conflict, stale draft, and recovery behavior.
- `BACK`: browser back keeps the user safe and does not duplicate side effects.
- `CHART`: chart has empty, loading, tooltip/legend, responsive, and fallback states.
- `CLIENT-SESSION`: browser-only token handling is safe and does not leak raw values.
- `COOLDOWN`: resend or retry is disabled and re-enabled at the documented time.
- `COPY-POLICY`: public copy does not overpromise unimplemented features.
- `DATA`: real data contract, loading, empty, error, and fixture distinction.
- `DEFERRED-BILLING`: no billing SDK, checkout, invoice, real payment, or provider promise.
- `DIRECT-ID`: invalid, missing, unauthorized, and deleted ids are handled.
- `EMAIL`: delivery, resend, prefill, invalid email, and provider failure states.
- `EMPTY`: no-data state gives a useful next action.
- `ENTRY`: page works as a first touch from search, link, reload, or bookmark.
- `ERROR-REASON`: known reason codes map to safe user messages and CTAs.
- `EXPORT`: download/export starts, fails, retries, and does not leak another user's data.
- `FAILURE`: user sees the failure and has a recovery route.
- `FILTER`: filter, search, sort, pagination, empty result, and reset behavior.
- `FORM`: labels, instructions, validation, success, disabled, and error messages.
- `FRAGMENT`: URL fragment handling is browser-safe and redirects correctly.
- `GUARD`: audience, role, subscription, and owner boundaries are enforced.
- `I18N`: language choice persistence and translation scope are clear.
- `IRREVERSIBLE-ACTION`: destructive or final actions require confirmation and cannot repeat accidentally.
- `LOADING`: long-running states explain current status and next expected result.
- `MODAL`: focus trap, close, escape, backdrop, trigger return, and mobile layout work.
- `NAV`: sidebar/header/current page state and route availability match role.
- `NEXT-URL`: callback `next` is relative-only and cannot become an open redirect.
- `ONBOARDING`: first-run, skip, resume, and already-completed states are clear.
- `OPS`: logs or operational visibility exist for non-UI failures.
- `ORG-SCOPE`: org admin sees only allowed organization-level data.
- `OWNER-CHECK`: user cannot view or mutate another user's data.
- `PAYWALL-ENTRY`: locked feature entry explains why and how to continue.
- `PERSISTENCE`: saved preference survives reload and session continuation.
- `PII`: personal data is masked, scoped, editable, and not overexposed.
- `POLICY`: business, legal, retention, email, language, or billing rules are explicit.
- `PRIVILEGE`: role changes cannot escalate beyond the actor's authority.
- `PUBLIC`: page works without session and does not rely on protected data.
- `RATE-LIMIT`: retry-after, cooldown, and disabled CTA behavior are verified.
- `RAW-ERROR-BLOCK`: provider raw errors are never shown in UI or URL.
- `RBAC`: role-based access matches the route audience map and backend checks.
- `RECOMMENDATION`: recommendation source, fallback, empty, and refresh behavior are clear.
- `RECOVERY`: user can safely retry, return, or continue.
- `REFRESH`: refresh preserves safe state and does not duplicate side effects.
- `RETRY`: retry action respects cooldown, duplicate prevention, and error recovery.
- `SEARCH`: search handles empty, no results, pagination, and reset.
- `SECURITY`: no token, secret, raw provider error, or cross-user data exposure.
- `SESSION`: login, logout, expired session, and back-after-logout behavior.
- `SESSION-END`: server-side session termination and protected-route rejection after logout.
- `STATE`: hosted state opens from the correct trigger and closes predictably.
- `STORAGE`: exported/generated files are scoped to the owner and safe path.
- `SUBMIT`: validation, confirmation, duplicate prevention, success, and failure.
- `TOKEN`: token exchange, expiry, malformed token, replay, and failure redirect.
- `TRANSPORT-DEFERRED`: notification UI exists but actual transport is not implied.
- `WRITE`: prompt, answer editor, word/length rules, guidance, draft, and submit behavior.

## 10. Automation Procedure

Create or update automation only after writing the failing check first.

Minimum static checks:

- IA inventory count is derived from `docs/Wireframe/README.md`.
- No test or script hardcodes 32 as the current IA count.
- Every IA code maps to `docs/sitemap.md`.
- Every sitemap page route maps to source route coverage.
- Hosted modal/state IA codes map to host routes and trigger evidence.
- Route handlers are checked separately from pages.
- X-11 and X-12 are included in current coverage.
- Legacy-only routes do not become current failures.

Minimum browser checks:

- Page opens at mobile, tablet, and desktop widths.
- Main heading or status is visible.
- Primary CTA is visible or intentionally unavailable.
- Console errors are captured.
- Direct URL behavior is recorded.
- Back/forward behavior is recorded for stateful pages.
- Auth and admin routes are checked with the right storage state.

Minimum report fields:

- IA code
- Screen name
- Route or host route
- Route type
- Audience
- Required packs
- Implementation evidence
- Test evidence
- GPT-5.5 adjudication evidence
- Label
- Gaps
- Follow-up owner or reason

## 11. GPT-5.5 Adjudication Procedure

Independent GPT-5.5 adjudication is required for judgment-heavy checks.

Use GPT-5.5 adjudication for:

- Whether page copy matches the product promise.
- Whether a user understands what to do next.
- Whether a failure message is helpful.
- Whether visual hierarchy matches the task.
- Whether admin surfaces expose too much power.
- Whether deferred billing or notification behavior is overpromised.
- Whether a chart or recommendation is meaningful.

GPT-5.5 adjudication must record evidence:

- Adjudicator model and role
- Date
- IA code
- Scenario tested
- Viewport
- Result label
- Screenshot or notes

## 12. Completion Gate

Do not call the IA implementation coverage complete unless all are true.

- All 39 IA entries are inventoried.
- Route type is assigned for every IA entry.
- Current route/audience mapping is checked.
- Direct URL and browser back scenarios are covered or marked with a label.
- Auth, admin, owner, and session boundaries are checked where relevant.
- Deferred billing and notification transport are not treated as implemented features.
- Static checks and browser checks are separated.
- GPT-5.5-adjudicated judgments are not auto-marked `PASS` without matching
  evidence.
- Report includes evidence and remaining gaps.

## 13. Output Example

```markdown
### X-11 Auth error

- Route: `/auth/error`
- Type: `page`
- Audience: `public`
- Packs: CORE, AUTH, ERROR-REASON, RATE-LIMIT, SECURITY
- Result: PARTIAL
- Evidence:
  - Route exists.
  - Browser screenshot captured.
  - Known reason messages render for sampled reasons.
- Gaps:
  - All 11 reason codes not verified.
  - `retry_after_seconds` countdown evidence missing.
  - raw provider error leak test missing.
```

## 14. Docs Consulted

- `.agents/superpowers/skills/using-superpowers/SKILL.md`
- `docs/agent-index.md`
- `docs/prd.md`
- `docs/sitemap.md`
- `docs/Wireframe/README.md`
- `docs/flow/user-flow.md`
- `docs/user-flow.md`
- `docs/spec.md`
- `docs/development/deferred-scope.md`
- `docs/ai-workflow/templates/context-ledger-template.md`
- `docs/ai-workflow/templates/report-template.md`

## 15. Glossary

- IA: screen structure and screen-level requirements.
- Route: app URL path.
- Hosted modal: modal that lives inside another page.
- Route handler: server-side request handler, not a visible page.
- Direct URL: user types or opens the URL directly.
- Back behavior: what happens when the browser back button is used.
- RLS: database rule that blocks users from reading or changing unauthorized rows.
- Fixture: fake test data.
- DOC-GAP: docs disagree or do not decide the behavior.
- DEFERRED: intentionally not current scope.
