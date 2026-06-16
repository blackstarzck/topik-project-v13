# Full UI State Capture QA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture and review every documented TALKPIK AI page and its meaningful UI state changes: before action, in-flight, after success, after failure/error, empty data, populated data, locked/disabled states, and navigation transitions.

**Architecture:** This is a read-mostly QA execution plan. It reuses the existing Playwright/e2e setup, `scripts/design-review/render-shot.mjs`, active Wireframe docs, and Supabase dev test data. App source code should not be changed unless a blocking QA-only helper is explicitly approved; generated screenshots, manifests, traces, and reports are artifacts.

**Tech Stack:** Next.js App Router, React, Ant Design, Tailwind utility layer, Supabase Auth/Postgres/Storage, Playwright, existing `tests/e2e`, Wireframe screenshot evidence under `docs/Wireframe/<screen>/`, and summary reports under `docs/qa/reports/`.

---

## Scope Definition

This plan treats "all states" as every state that is documented, implemented, or reachable through normal QA controls.

Covered:
- All public routes in `src/lib/routes.ts`.
- All protected user-facing routes in `src/lib/routes.ts`.
- Hosted modal/state surfaces listed in `docs/ia.md`.
- For each page/function: idle, validation/disabled, loading or in-flight, success, failure/error, empty data, populated data, locked/free-plan state where applicable.
- Navigation triptychs: before action, moving/loading, after arrival or failure.
- Desktop, tablet, and mobile viewport captures.

Not covered unless separately approved:
- Admin app behavior. This repository is user-facing only.
- Production data mutation.
- Real payment provider flows, because billing remains deferred.
- Real AI quality evaluation, because current feedback can be mock/stub depending on implementation state.
- Infinite browser/device permutations. Extra device-specific checks can be added after this baseline.

## Required Inputs

Before execution, confirm or provide:

- `SUPABASE_TEST_PASSWORD` active in `.env.local`.
- Optional `E2E_STUDENT_EMAIL`; if absent, default is `student@audit.local`.
- Permission to create, mutate, and clean up test-owned data in the dev Supabase project only.
- Permission to use service-role/server-only credentials from `.env.local` for QA seeding if existing e2e seed helpers require them. Values must never be printed.
- Output location. Default:
  - Screenshots: each matching `docs/Wireframe/<screen-folder>/`
  - Screenshot sidecar JSON: next to each PNG in the same Wireframe folder
  - Existing representative images: preserve `browser-screenshot.png`, `wireframe.png`, and `hifi.png`
  - HTML report: `docs/qa/reports/qa-report-YYYYMMDD-HHMM.html`
  - Run ledger: `docs/qa/reports/full-ui-state-capture-qa-YYYYMMDD-HHMM.md`

## Docs Consulted

- `README.md`
- `AGENTS.md` / `README.md`
- `docs/ia.md`
- `docs/Wireframe/README.md`
- `docs/Wireframe/functional-spec-index.md`
- `docs/Wireframe/data-usage-index.md`
- `docs/ant-design/07-review-checklist.md`
- `관련 Supabase migration SQL과 `src/lib/supabase/``
- `.env.example`
- `docs/qa/qa-execution-plan.md`
- `docs/design-review-result/DESIGN-WORKFLOWS-RUNBOOK.md`
- `scripts/design-review/render-shot.mjs`
- `src/lib/routes.ts`
- `playwright.config.ts`
- `tests/e2e/_setup/auth.setup.ts`

Resolved workflow-doc note:
- 2026-06-16 cleanup removed the old run artifact tree from the active documentation model. QA evidence now belongs under `docs/qa/reports/`, while durable decisions move into the relevant active docs.

## Phase 0: Safety, Environment, And Baseline

**Files:**
- Read: `AGENTS.md`
- Read: `.env.example`
- Read: `.env.local` only for key presence, never values
- Read: `.gitignore`
- Artifact: `docs/qa/reports/full-ui-state-capture-qa-YYYYMMDD-HHMM.md`

- [ ] **Step 0.1: Record current tree and environment**

Run:

```powershell
git status --short
node --version
where.exe node
```

Expected:
- Existing unrelated work is recorded and not reverted.
- Node satisfies `package.json` engines, currently `>=24 <25`.

- [ ] **Step 0.2: Verify required env keys without printing secret values**

Run:

```powershell
$wanted = @(
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "SUPABASE_TEST_PASSWORD",
  "E2E_STUDENT_EMAIL",
  "SUPABASE_SERVICE_ROLE_KEY"
)
$envPath = Join-Path (Get-Location) ".env.local"
if (-not (Test-Path $envPath)) { throw ".env.local not found" }
$map = @{}
foreach ($line in Get-Content -Encoding UTF8 $envPath) {
  $trim = $line.Trim()
  if ($trim -and -not $trim.StartsWith("#") -and $trim.Contains("=")) {
    $eq = $trim.IndexOf("=")
    $key = $trim.Substring(0, $eq).Trim()
    $val = $trim.Substring($eq + 1).Trim().Trim('"').Trim("'")
    if ($wanted -contains $key) { $map[$key] = $val }
  }
}
foreach ($key in $wanted) {
  [pscustomobject]@{
    Key = $key
    Present = $map.ContainsKey($key)
    ValueLength = $(if ($map.ContainsKey($key)) { $map[$key].Length } else { 0 })
  }
}
```

Expected:
- Values are not printed.
- `SUPABASE_TEST_PASSWORD` must be present before direct login.
- `NEXT_PUBLIC_SITE_URL` should be present before production-mode QA.
- `SUPABASE_SERVICE_ROLE_KEY` is optional only if no direct seed is needed.

- [ ] **Step 0.3: Decide server mode**

Preferred:

```powershell
npm run build
node_modules\.bin\next.CMD start --hostname 127.0.0.1 --port 3000
```

Fallback for exploratory UI only:

```powershell
node_modules\.bin\next.CMD dev --hostname 127.0.0.1 --port 3000
```

Expected:
- For final capture, use production build/server when possible.
- Do not run `build` while a dev server is using `.next`.

- [ ] **Step 0.4: Create the run ledger**

Create a ledger with:

```text
Objective: full UI state capture QA
Base URL:
Server mode:
Docs consulted:
Required env presence:
Data mutation permission:
Started at:
```

Expected:
- If interrupted, another agent can resume from the ledger.

## Phase 1: Route And State Inventory

**Files:**
- Read: `src/lib/routes.ts`
- Read: `docs/ia.md`
- Read: `docs/Wireframe/README.md`
- Read: `docs/Wireframe/functional-spec-index.md`
- Read per-screen: `docs/Wireframe/<screen>/description.md`
- Read per-screen: `docs/Wireframe/<screen>/functional-spec.md`
- Artifact: `docs/qa/reports/qa-report-YYYYMMDD-HHMM-state-matrix.json`

- [ ] **Step 1.0: Dispatch read-only inventory agents**

Before taking screenshots, split the investigation into independent read-only agents:

```text
Agent A: Public/Auth routes
Agent B: Workspace routes
Agent C: Practice/Writing/Feedback/Report routes
Agent D: Wireframe folder mapping and output naming
```

Each agent must return:

```text
route or modal
Wireframe folder
page landing exists: yes/no/conditional
loading, empty, data-filled, success, error, disabled, unauthorized states
click, hover, keyboard, drag, form submit, modal, popover, tab, pagination interactions
fixture or mock needed for each state
screenless route evidence requirement, if applicable
```

Constraints:
- File edits are forbidden during this step.
- DB/API writes are forbidden during this step.
- Secret values must not be read aloud or copied into reports.
- Unknowns must be marked `code-unconfirmed`, not guessed.

Expected:
- Capture scope is based on documented and implemented state inventory, not ad hoc browsing.
- Route handlers are classified as JSON/status/redirect evidence, not screenshot targets.

- [ ] **Step 1.1: Build the page inventory**

Inventory must include:
- IA code
- Screen name
- Route or modal host
- Audience: public or user
- Wireframe folder
- Functional spec path
- Data objects from `data-usage-index.md`
- Capture priority

Expected minimum route count:
- Public paths from `PUBLIC_PATHS`: 12
- Protected route cases from `PROTECTED_ROUTE_CASES`: 22
- Hosted modal/state surfaces: C-03, D-M1, D-M2, D-M3, F-M1

- [ ] **Step 1.2: Build a per-page state inventory**

For each screen, extract:

```text
default/populated
empty
loading
error
success
disabled/validation
locked/paywall
modal open
modal in-flight
modal failure
navigation before
navigation during
navigation after
```

Expected:
- Every state is marked as one of:
  - `capture`: must capture
  - `covered-by-scenario`: captured through another flow
  - `unreachable-with-current-data`: explain why
  - `deferred`: requires separate product/system setup
  - `not-applicable`: not meaningful for this screen

- [ ] **Step 1.3: Define screenshot naming convention**

Use:

```text
docs/Wireframe/<screen-folder>/browser-screenshot--<state>--<viewport>.png
docs/Wireframe/<screen-folder>/browser-screenshot--<state>--<viewport>.json
```

Examples:

```text
docs/Wireframe/02-A-02-login/browser-screenshot--validation-error--desktop.png
docs/Wireframe/06-C-02-problem-list/browser-screenshot--empty-search--mobile.png
docs/Wireframe/08-D-01-short-answer-writing-51/browser-screenshot--autosave-syncing--desktop.png
docs/Wireframe/12-D-M1-submission-confirmation-modal/browser-screenshot--disabled-hardmin--desktop.png
docs/Wireframe/04-B-01-home-dashboard/browser-screenshot--navigation-during--desktop.png
```

Expected:
- Existing `browser-screenshot.png`, `wireframe.png`, and `hifi.png` are not overwritten.
- Filename alone tells which screen, state, and viewport it represents.
- Sidecar JSON stores route, host route, viewport size, final URL, console errors, redirect status, fixture conditions, and verdict.
- `40-X-18-auth-consent` is the only current Wireframe folder without `browser-screenshot.png`; create that representative file only when capturing its stable desktop landing.

## Phase 2: Login And Auth State Preparation

**Files:**
- Read: `tests/e2e/_setup/auth.setup.ts`
- Read: `playwright.config.ts`
- Artifact: `tests/e2e/auth-state/student.json` (gitignored, contains tokens)
- Artifact: screenshots for login states

- [ ] **Step 2.1: Capture public auth page default states**

Capture:
- `/login` default
- `/sign-up` default
- `/password-reset` default
- `/password-reset/confirm` default
- `/auth/error?reason=unknown`
- `/auth/error?reason=otp_expired`
- `/auth/error?reason=over_request_rate_limit&retry_after_seconds=60`
- `/auth/verify-email`
- `/auth/callback-fragment` missing fragment redirect result

Expected:
- Screens are visible, hydrated, and no console/page errors.

- [ ] **Step 2.2: Capture auth validation/failure states**

Actions:
- Submit login with empty fields.
- Submit login with invalid email format.
- Submit login with known email and wrong password.
- Submit sign-up with invalid password and mismatch.
- Submit password reset with invalid email.
- Submit password reset confirm with invalid/mismatched passwords.

Expected captures:

```text
before-submit
during-submit
after-validation-error
after-server-error
```

- [ ] **Step 2.3: Perform direct login and persist storage state**

Run existing setup:

```powershell
$env:E2E_BASE_URL = "http://127.0.0.1:3000"
node_modules\.bin\playwright.CMD test --project=setup
```

Expected:
- Login succeeds with `student@audit.local` unless `E2E_STUDENT_EMAIL` overrides it.
- `tests/e2e/auth-state/student.json` is created.
- Do not print its contents.

- [ ] **Step 2.4: Capture navigation redirect states**

Capture:
- Anonymous user opens `/dashboard`:
  - before request
  - redirect in progress if visible
  - after `/login`
- Authenticated user opens `/login` or `/sign-up`:
  - before request
  - redirect in progress if visible
  - after `/dashboard`

Expected:
- Protected pages redirect anonymous users to login.
- Auth entry pages route authenticated users away according to current code.

## Phase 3: Test Data Strategy

**Files:**
- Read: `docs/Wireframe/data-usage-index.md`
- Read: `tests/e2e/screens/*.spec.ts` seed helpers
- Optional read: `supabase/migrations/INDEX.md`
- Artifact: `docs/qa/reports/qa-report-YYYYMMDD-HHMM-seed-manifest.json`

- [ ] **Step 3.1: Define data personas**

Create or identify these states for the student user:

```text
P0: anonymous user
P1: student with no learning goal
P2: student with learning goal but no submissions
P3: student with active draft
P4: student with completed short submission and feedback
P5: student with completed long submission and feedback
P6: student with comparison report
P7: student with library items and export history
P8: student with expired recommendations
P9: free-plan locked state
P10: error-only or malformed-id state
```

Expected:
- If using one account would overwrite too much state, create temporary QA-owned rows with a unique run id.
- If creating extra auth users is not approved, mark P1/P2 as `UNVERIFIED` with reason.

- [ ] **Step 3.2: Prefer existing e2e seed helpers**

Reuse patterns from:
- `tests/e2e/screens/short-feedback.spec.ts`
- `tests/e2e/screens/long-feedback.spec.ts`
- `tests/e2e/screens/comparison-report.spec.ts`
- `tests/e2e/screens/next-problem.spec.ts`
- `tests/e2e/screens/workspace-layout.spec.ts`

Expected:
- Seeded rows are scoped to `student@audit.local`.
- Seed manifest records inserted IDs for cleanup.
- No service-role key is printed.

- [ ] **Step 3.3: Capture empty-data states before seeding**

Where possible, use URL filters or isolated data rather than destructive deletion:
- Search term with zero results in problem list.
- Library search with zero results.
- Feedback/report malformed or foreign IDs.
- Next problem fallback state if no recommendations exist.

Expected:
- Empty states show next action, reset, retry, or safe escape route.

- [ ] **Step 3.4: Capture populated-data states after seeding**

Seed or use existing:
- Problem list with problems.
- Writing draft.
- Short feedback.
- Long feedback.
- Comparison report.
- Library items.
- Notification preferences.
- Recommendation items.

Expected:
- Populated cards/tables/lists render without overflow.
- Data row actions are visible and usable.

- [ ] **Step 3.5: Cleanup policy**

For each seeded row, record:

```json
{
  "runId": "qa-YYYYMMDD-HHMM",
  "table": "writing_submissions",
  "id": "uuid",
  "cleanup": "delete-after-report-or-keep-if-used-as-baseline"
}
```

Expected:
- Do not delete pre-existing user data unless it was created by this QA run.

## Phase 4: Page-Level Screenshot Capture

**Files:**
- Use: `scripts/design-review/render-shot.mjs`
- Use: `tests/e2e/auth-state/student.json`
- Artifact: `docs/Wireframe/<screen-folder>/browser-screenshot--<state>--<viewport>.png`
- Artifact: sidecar JSON files

- [ ] **Step 4.1: Capture all public default pages**

For each public route:

```powershell
$env:RS_ORIGIN = "http://127.0.0.1:3000"
$env:RS_VIEWPORTS = "360,768,1280"
$env:RS_OUT = "docs/Wireframe/02-A-02-login"
$env:RS_ROUTE = "/login"
$env:RS_LABEL = "browser-screenshot--default"
node scripts/design-review/render-shot.mjs
```

Expected:
- PNG for each viewport.
- Sidecar JSON records status, final URL, error overlay, console errors, body text length.
- Existing `browser-screenshot.png` is preserved.

- [ ] **Step 4.2: Capture all protected default pages**

For each protected route:

```powershell
$env:RS_ORIGIN = "http://127.0.0.1:3000"
$env:RS_STORAGE = "tests/e2e/auth-state/student.json"
$env:RS_VIEWPORTS = "360,768,1280"
$env:RS_OUT = "docs/Wireframe/04-B-01-home-dashboard"
$env:RS_ROUTE = "/dashboard"
$env:RS_LABEL = "browser-screenshot--default"
node scripts/design-review/render-shot.mjs
```

Expected:
- No protected page should redirect to `/login` when using valid storage state.
- Dynamic feedback/report routes must use real seeded IDs, not placeholder IDs.

- [ ] **Step 4.3: Capture global loading/error boundaries**

Actions:
- Navigate to pages cold after clearing cache/context.
- Use route interception for selected data/API calls to force failure where feasible.
- Visit unknown route.
- Visit malformed problem ID.

Expected:
- Loading skeletons/spinners appear where implemented.
- Error screens include retry or safe navigation.
- Unknown route uses app-appropriate 404.

- [ ] **Step 4.4: Capture screenless route evidence**

For route handlers and redirect gates, create JSON evidence in the nearest related Wireframe folder:

```text
/auth/callback -> docs/Wireframe/39-X-17-auth-callback-fragment/route-evidence--auth-callback--<case>.json
/auth/sign-out -> docs/Wireframe/02-A-02-login/route-evidence--auth-sign-out--<case>.json
/auth/post-auth -> docs/Wireframe/04-B-01-home-dashboard/route-evidence--auth-post-auth--<case>.json
/api/export/pdf -> docs/Wireframe/19-F-M1-pdf-export-modal/route-evidence--api-export-pdf--<case>.json
```

Expected:
- Evidence records HTTP method, status, location header, sanitized response body shape, and cookie/session effect.
- Raw tokens, refresh tokens, auth cookies, passwords, and private keys are not written.

## Phase 5: Interaction Lifecycle Capture

**Files:**
- Read per target component source only when necessary
- Use Playwright scripts under temporary workspace or `.scratch/qa-run/`
- Artifact: transition screenshots and JSON observations

- [ ] **Step 5.1: Apply the lifecycle template to each interactive feature**

For every feature in `functional-spec.md`, capture:

```text
1. idle / start-before
2. trigger clicked / start
3. in-flight / loading
4. success / after
5. failure / error
6. disabled or validation state, if applicable
```

Expected:
- If a state is too fast to visually capture, use one of:
  - network interception delay
  - slow server response
  - Playwright `page.route`
  - screenshot immediately after trigger
  - sidecar note: `state too fast; verified by DOM attribute/loading prop`

- [ ] **Step 5.2: Capture form validation states**

Targets:
- A-01 sign-up
- A-02 login
- X-06 password reset
- X-16 password reset confirm
- A-03 learning goal setup
- X-05 profile editing
- G-01 language settings
- X-09 notification settings
- D-01~D-04 writing submit constraints

Expected captures:
- Empty submit.
- Invalid value.
- Dirty but not saved.
- Save/submit disabled with reason.
- Save/submit loading.
- Save success.
- Save failure where safely reproducible.

- [ ] **Step 5.3: Capture writing flow states**

For D-01, D-02, D-03, D-04:
- Default loaded problem.
- No selected/invalid problem.
- Empty answer.
- Below hard minimum.
- At valid minimum.
- Over hard maximum.
- Autosave dirty.
- Autosave syncing.
- Autosave failed.
- Autosave recovered.
- Submission modal open.
- Submission modal disabled.
- Submission modal in-flight.
- Submission modal failure.
- Analysis loading.
- Feedback success page.

Expected:
- User input remains visible after failures.
- Buttons lock during in-flight.
- Modal close behavior is predictable.

- [ ] **Step 5.4: Capture modal surfaces**

Targets:
- C-03 retry modal
- D-M1 submission confirmation
- D-M2 AI analysis loading
- D-M3 autosave warning
- F-M1 PDF export modal

For each modal:
- Background page before modal.
- Modal open.
- Disabled state.
- In-flight state.
- Success result.
- Failure result.
- Cancel/close result.

Expected:
- Modal surface inherits theme.
- Focus/close behavior is safe.
- No card-in-card visual nesting unless justified.

- [ ] **Step 5.5: Capture navigation triptychs**

For these flows, capture before/during/after:
- Landing to sign-up.
- Login to dashboard.
- Dashboard to recommendations.
- Recommendations to problem list.
- Problem list to writing.
- Writing to submission modal.
- Submission to analysis loading.
- Analysis to feedback.
- Feedback to report.
- Report to next problem.
- Library to PDF export.
- Profile to settings.
- Paywall to subscription.
- Logout to login.

Expected:
- During state may be very fast; if not visually capturable, record route transition timing and a sidecar note.
- After state must include the destination page and active navigation state.

## Phase 6: Data State Capture Matrix

**Files:**
- Use seed manifest from Phase 3
- Artifact: screenshots grouped by `empty`, `populated`, `locked`, `error`

- [ ] **Step 6.1: Capture empty data states**

Targets:
- Dashboard for no submissions if available.
- Problem list zero search result.
- Library empty or empty search.
- Feedback/report not found.
- Notification history empty if available.
- Recommendations missing/expired fallback.
- Growth dashboard insufficient data or locked.

Expected:
- Empty states are not blank.
- They explain what happened and give next action.

- [ ] **Step 6.2: Capture populated data states**

Targets:
- Dashboard with KPI/recent feedback/recommendations.
- Problem list with rows and status badges.
- Writing screens with actual problem content.
- Feedback short/long with scores, dimensions, sentence feedback.
- Comparison report.
- Library tabs with saved/submitted/export rows.
- Notification settings with saved preferences/history.
- Growth dashboard with chart or locked state.

Expected:
- Tables/cards do not overflow at 360, 768, 1280.
- Long Korean text wraps cleanly.
- Primary CTA hierarchy remains clear.

- [ ] **Step 6.3: Capture permission/plan states**

Targets:
- Free-plan locked growth/weakness/paywall/subscription behavior.
- Anonymous protected-route redirect.
- Foreign or invalid feedback/report ID.

Expected:
- No data leak.
- Locked UI explains limitation and next action.
- Unauthorized/foreign data resolves to 404 or safe empty state, not raw error.

## Phase 7: Responsive And Accessibility Visual Checks

**Files:**
- Read: `docs/ant-design/07-review-checklist.md`
- Artifact: per-page responsive notes

- [ ] **Step 7.1: Capture desktop/tablet/mobile for each default page**

Viewports:

```text
360x720
768x1024
1280x800
```

Expected:
- No horizontal overflow.
- Text does not overlap controls.
- Side navigation/drawer behavior works.
- CTA and form controls remain visible.

- [ ] **Step 7.2: Capture mobile keyboard-sensitive states**

Targets:
- Login email/password.
- Sign-up form.
- Writing textarea.
- Profile fields.
- Notification form.

Expected:
- Keyboard does not permanently hide primary action.
- User can scroll to submit button.

- [ ] **Step 7.3: Capture focus and disabled affordance samples**

Targets:
- Main navigation.
- Form inputs.
- Modal buttons.
- Icon-only buttons if present.

Expected:
- Keyboard focus is visible.
- Disabled buttons have nearby reason or validation text.

## Phase 8: Failure And Error Simulation

**Files:**
- Use Playwright route interception
- Artifact: failure screenshots

- [ ] **Step 8.1: Simulate network failures for client-side actions**

Targets:
- Login/sign-up server error.
- Password reset resend error.
- Notification save error.
- Profile save error.
- PDF export failure.
- Writing autosave failure.
- Writing submit failure.

Expected:
- Failure message appears.
- Loading state stops.
- Input is preserved.
- Retry or escape route exists.

- [ ] **Step 8.2: Simulate slow responses for in-flight screenshots**

Targets:
- Login submit.
- Save settings.
- Autosave.
- Submit writing.
- PDF export.

Expected:
- In-flight visual state captured: spinner, loading button, skeleton, progress, or badge.
- Duplicate clicks are blocked.

- [ ] **Step 8.3: Simulate route/data errors**

Targets:
- Invalid feedback/report ID.
- Malformed problem ID.
- API 500 for selected data fetches.
- Supabase session expired.

Expected:
- Safe error boundary or empty state.
- No stack traces or raw provider errors shown to the user.

## Phase 9: Evidence Report

**Files:**
- Create: `docs/qa/reports/qa-report-YYYYMMDD-HHMM.html`
- Create: `docs/qa/reports/qa-report-YYYYMMDD-HHMM-state-matrix.json`
- Create: `docs/Wireframe/<screen-folder>/browser-screenshot--<state>--<viewport>.png`
- Create: `docs/Wireframe/<screen-folder>/browser-screenshot--<state>--<viewport>.json`
- Update ledger: `docs/qa/reports/full-ui-state-capture-qa-YYYYMMDD-HHMM.md`

- [ ] **Step 9.1: Produce a screenshot manifest**

Manifest schema:

```json
{
  "runId": "qa-YYYYMMDD-HHMM",
  "baseUrl": "http://127.0.0.1:3000",
  "route": "/dashboard",
  "ia": "B-01",
  "state": "default-populated",
  "viewport": "1280x800",
  "file": "docs/Wireframe/04-B-01-home-dashboard/browser-screenshot--default-populated--desktop.png",
  "finalUrl": "http://127.0.0.1:3000/dashboard",
  "status": 200,
  "consoleErrors": [],
  "errorOverlay": false,
  "hydrated": true,
  "verdict": "PASS"
}
```

Expected:
- Every screenshot has metadata.
- `UNVERIFIED` entries include a reason and a retry method.
- Report galleries link to screenshots in their owning Wireframe folders.

- [ ] **Step 9.2: Produce the HTML report**

Report sections:
- Executive summary.
- Environment and secrets policy.
- Commands/checks run.
- Page coverage table.
- State coverage table.
- Navigation triptych gallery.
- Empty vs populated comparison gallery.
- Failure/error gallery.
- Responsive gallery.
- Defect log.
- Spec gaps.
- Unverified list.
- Seed manifest and cleanup status.
- Remaining risks.

Expected:
- Non-developers can understand what was checked.
- Developers can reproduce with commands.

- [ ] **Step 9.3: Apply severity rules**

Severity:

```text
P0: data leak, auth bypass, app crash, writing data loss, admin scope intrusion
P1: core learning flow blocked, mobile unusable, feedback/report unavailable
P2: missing state feedback, partial feature failure, accessibility/responsive issue
P3: copy, minor spacing, cosmetic issue
Spec gap: docs/code behavior undefined or conflicting; not counted as product defect unless data loss/leak occurs
UNVERIFIED: not pass or fail; must include reason and retest method
```

Expected:
- Do not mark unverified items as pass.
- Do not treat deferred billing/admin scope as a defect.

## Phase 10: Cleanup And Handoff

**Files:**
- Read: seed manifest
- Update: ledger
- Do not commit: auth-state, traces, test-results, screenshots containing sensitive data
- Commit allowed: safe Wireframe screenshots and their redacted sidecar JSON when they contain no secret/user-private data

- [ ] **Step 10.1: Cleanup QA-owned test data**

Use the seed manifest to delete only rows created by the run if cleanup is approved.

Expected:
- Pre-existing data remains untouched.
- If keeping data for reproducibility, report exactly which run-owned IDs remain.

- [ ] **Step 10.2: Verify no secret artifacts are staged**

Run:

```powershell
git status --short
```

Expected:
- `tests/e2e/auth-state/` and `test-results/` remain untracked/gitignored.
- No `.env.local` content is printed or staged.

- [ ] **Step 10.3: Final handoff**

Final response must include:
- Report path.
- Wireframe screenshot paths.
- Total pages captured.
- Total screenshots captured.
- P0/P1/P2/P3 counts.
- Unverified count and top reasons.
- Data cleanup status.
- Commands run and result summary.
- Remaining risks.

## Initial State Matrix

This is the minimum capture contract. Add more rows if per-screen docs expose additional states.

| Area | Screens | Required States |
| --- | --- | --- |
| Public auth | A-01, A-02, X-06, X-16, X-11, X-12, X-17 | default, validation error, server error, submit loading, success/redirect, rate limit/cooldown |
| Onboarding | A-03 | default existing, validation error, saving, saved redirect, no-goal or skipped-state if available |
| Dashboard | B-01 | populated, no-submission/new-user if available, loading, error, notification/read state |
| Practice | C-01, C-02, C-03, R-02, X-07 | populated, empty filter, loading, error, selected, locked, expired recommendation, retry modal states |
| Writing | D-01, D-02, D-03, D-04, D-M1, D-M2, D-M3 | empty answer, invalid length, valid answer, dirty, autosaving, autosave failed, submit disabled, submit loading, submit failure, analysis loading, timeout/deferred |
| Feedback/report | E-01, E-02, R-01 | populated, not found, export modal trigger, next action, comparison data |
| Library/export | F-01, F-M1 | empty, populated, search empty, export modal idle/loading/success/failure |
| Settings/profile | G-01, X-05, X-09 | default saved, dirty, validation error, saving, success, failure, upload failure, disabled/no-change |
| Growth/paywall/subscription | X-02, X-03, X-04 | free locked, populated if available, CTA loading, deferred/stub notice |
| Legal/landing | X-01, X-13, X-14 | default, navigation before/during/after, mobile |
| Global | app shell, 404, redirects, logout | anonymous redirect, auth redirect, not-found, sign-out, mobile drawer, sidebar active |

## Execution Readiness Checklist

- [ ] `SUPABASE_TEST_PASSWORD` is present.
- [ ] Data mutation in dev Supabase is approved.
- [ ] Server mode is selected.
- [ ] Run output timestamp is selected.
- [ ] Storage state can be generated.
- [ ] Dynamic IDs for feedback/report can be seeded or found.
- [ ] The state matrix is generated before screenshots.
- [ ] Every screenshot has a manifest row.
- [ ] Every `UNVERIFIED` has reason and retest method.
- [ ] No secret/token artifact is committed.

## Self-Review

Spec coverage:
- Covers all public/protected route groups from `src/lib/routes.ts`.
- Covers all Wireframe screens listed in `docs/Wireframe/README.md`, including hosted modals/states.
- Covers user requirement for before/during/after navigation and success/failure/error states.
- Covers empty-data and populated-data captures.
- Keeps admin scope out of this repository.

Placeholder scan:
- No task depends on unspecified "appropriate handling."
- Each phase has concrete commands or concrete state outputs.

Type/contract consistency:
- `capture`, `covered-by-scenario`, `unreachable-with-current-data`, `deferred`, `not-applicable`, `UNVERIFIED`, and severity terms are used consistently.
