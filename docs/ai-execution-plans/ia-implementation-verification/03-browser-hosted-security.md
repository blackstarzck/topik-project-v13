# IA Implementation Verification - Browser, Hosted Surface, And Security Evidence

> Part of [IA Implementation Verification](./README.md). Phase 2, Phase 3, and Phase 4 rendered browser, hosted-surface, session, role, owner, and route-handler evidence.

Use this file directly only when your task matches the summary above.

## 8. Phase 2 - Browser Coverage Upgrade

- [ ] **Step 2.1: Create E2E catalog**

  Create `tests/e2e/coverage/ia-catalog.ts`.

  Each row must include:

  - IA code,
  - screen name,
  - manifest row id,
  - document receipt id,
  - route or host route,
  - route type,
  - audience,
  - required packs,
  - seed scenario id, `seedRunId`, or seed `notApplicableReason`,
  - fixture id type and seed record key when the route has `:id`,
  - owner and wrong-owner seed record keys when owner behavior is tested,
  - admin target seed record key when admin behavior is tested,
  - expected primary heading or status landmark,
  - expected primary CTA or unavailable reason,
  - UX evidence states needed for Phase 5: `default`, `loading`, `empty`,
    `error`, `disabled`, `success`, or unavailable reason,
  - form, AI-output, policy, billing, notification, auth, and admin evidence
    flags when applicable.

- [ ] **Step 2.2: Replace the old route-only coverage matrix**

  Update `tests/e2e/coverage/coverage-matrix.spec.ts` so it imports `ia-catalog.ts`.

  It must check:

  - public pages open without session,
  - protected pages redirect when logged out,
  - protected pages open with the correct auth state,
  - admin pages are tested with role-specific auth states,
  - protected, admin, owner-id, and RLS-sensitive scenarios reference a valid
    seed precondition or an explicit seed blocker,
  - `X-11` and `X-12` are included,
  - console and page errors are captured,
  - visible heading or status exists,
  - primary CTA exists or has a recorded unavailable reason,
  - screenshots are captured for 360, 768, and 1280 widths,
  - AI-ready UX evidence is captured for labels, helper text, loading states,
    empty states, error states, AI rationale, user-control copy, and deferred
    policy copy when applicable.

- [ ] **Step 2.3: Rebuild auth state setup**

  Create `scripts/audit-setup/build-storage-state.mjs`.

  It must create:

  - `tests/e2e/auth-state/student.json`
  - `tests/e2e/auth-state/content_admin.json`
  - `tests/e2e/auth-state/org_admin.json`
  - `tests/e2e/auth-state/platform_admin.json`

  Before writing a role storage state, verify that the target actor exists in
  `seed-results.json`, has a matching `profiles` row, and has the expected
  `profiles.app_role`. Do not treat auth metadata as role truth.

  If Supabase local setup is unavailable, browser checks that require auth stay `BLOCKED`.
  This does not block public browser evidence. The run must still execute public
  route checks and record protected/admin auth-state evidence separately as
  `BLOCKED` with the missing storage-state precondition.

  If storage states are partially available, continue all browser scenarios for
  roles with valid state files. Mark only scenarios requiring a missing or
  invalid role state as `BLOCKED`, and record the missing role in
  `browser-results.json` under `roleStateStatus` (one entry per role:
  `present`, `missing`, or `invalid`). Public-route checks must still run.

  Run:

  ```powershell
  pnpm test:ia:storage-state -- --audit-dir $auditDir
  ```

  Current storage-state output writes `tests/e2e/auth-state/*.json` outside
  `<auditDir>`. Treat the build status as setup evidence and bind it to the IA
  run through `seed-results.json` or the storage-state build-status artifact. The
  helper may expose a non-IA break-glass production override; IA audit runs must
  not use that override.

- [ ] **Step 2.4: Run page browser matrix**

  Start the app in one terminal:

  ```powershell
  pnpm dev
  ```

  Run in another terminal:

  ```powershell
  pnpm exec playwright test tests/e2e/coverage/coverage-matrix.spec.ts
  pnpm test:ia:browser-results -- --audit-dir $auditDir
  ```

  Required evidence:

  - `<auditDir>/browser-results.json`,
  - Playwright JSON output,
  - screenshots for each applicable page and viewport,
  - `seedRunId` or explicit seed blocker for every seed-dependent row,
  - error list,
  - label per IA row,
  - AI-ready evidence bundle per IA row:
    - screenshot filenames with viewport, route, audience, and state,
    - state types covered,
    - form label, helper text, and error evidence,
    - AI rationale, uncertainty, retry, reject, or manual-control evidence,
    - policy or deferred-scope copy evidence,
    - unavailable reason for any state that cannot be exercised.

  `browser-results.json` must contain one row per applicable IA/viewport/state
  combination. A screenshot stored on disk but missing from JSON does not count
  as final evidence.

## 9. Phase 3 - Hosted Surface Checks

- [ ] **Step 3.1: Create hosted-surface E2E file**

  Create `tests/e2e/coverage/hosted-surfaces.spec.ts`.

  Required cases:

  - `C-03`: open `/practice/problems`, trigger retry modal, close it, confirm focus returns.
  - `D-M1`: open a writing route, trigger submit, confirm submission modal opens and cancel returns to writing.
  - `D-M2`: confirm submission and verify AI analysis loading state.
  - `D-M3`: simulate autosave failure or network failure and verify warning or toast recovery.
  - `F-M1`: trigger PDF export from library, feedback, or report host route.

- [ ] **Step 3.2: Validate modal behavior**

  Each hosted case must check:

  - focus moves into the surface,
  - keyboard cannot escape unexpectedly,
  - `Esc`, close, cancel, and backdrop behavior are recorded,
  - mobile 360px layout remains usable,
  - final actions prevent duplicate submission or duplicate export,
  - host-before, surface-open, and surface-closed screenshots are captured,
  - trigger copy, recovery copy, and focus return target are recorded,
  - failure and retry states are captured for autosave, analysis, and export
    surfaces when applicable.

- [ ] **Step 3.3: Emit hosted surface result JSON**

  Create `<auditDir>/hosted-surface-results.json`.

  Run after the hosted-surface Playwright checks:

  ```powershell
  pnpm test:ia:hosted-surface-results -- --audit-dir $auditDir
  ```

  It must include:

  - IA code,
  - host route,
  - trigger selector or trigger copy,
  - host-before screenshot,
  - surface-open screenshot,
  - surface-closed screenshot,
  - focus entry result,
  - focus return result,
  - keyboard close result,
  - duplicate-action prevention result,
  - failure or retry evidence when applicable,
  - status and blocking reasons.

  A hosted surface cannot receive final `PASS` when it has only component source
  evidence and no host-route interaction evidence.

  If a hosted surface needs seeded route data to open, submit, retry, autosave,
  analyze, or export, its hosted result row must reference `seedRunId` or an
  explicit seed blocker. Missing seed data blocks only that seed-dependent
  hosted scenario, not unrelated hosted or public-route evidence.

## 10. Phase 4 - Security, Session, And External Entry

Before creating Phase 4 checks, read and extract requirements from:

- `docs/development/auth-overview.md` for current login, sign-up, callback,
  auth error, verify-email, password reset, session expiry, cooldown, and route
  mapping behavior.
- `docs/development/backend-auth.md` for Supabase Auth, RLS, storage,
  server-only key, and backend authorization boundaries.

- [ ] **Step 4.1: Create route handler checks**

  Create either `tests/integration/auth-route-handlers.test.ts` or `tests/e2e/coverage/auth-route-handlers.spec.ts`.

  Required cases:

  - `/auth/callback` rejects external `next` values and falls back to an internal destination.
  - raw provider errors are not exposed in the URL or UI.
  - malformed token inputs land on a safe auth error reason.
  - `/auth/callback-fragment` handles browser-only fragments without leaking token values.
  - `/auth/sign-out` clears session state once the route handler exists.

- [ ] **Step 4.2: Create navigation/session checks**

  Create `tests/e2e/coverage/session-navigation.spec.ts`.

  Required cases:

  - direct protected URL while logged out,
  - direct protected URL as normal learner,
  - direct admin URL as learner,
  - direct admin URL as each admin role,
  - invalid id,
  - malformed id,
  - another user's id,
  - browser back and forward,
  - refresh while loading,
  - refresh after input,
  - refresh after submit,
  - browser back after submit,
  - browser back after logout,
  - expired session,
  - network failure during the main action.

  Do not convert a blocked auth state into `PASS`. Use `BLOCKED` with evidence.
  Do not convert a missing seed precondition into `PASS`. Use `BLOCKED` only
  for the seed-dependent scenario, and keep seed-independent security checks
  running.

  For each scenario, also record:

  - user-facing context copy,
  - recovery CTA,
  - safe return route,
  - whether raw provider, token, owner, or internal error details are hidden,
  - screenshot or unavailable reason for Phase 5 AI UX review.

- [ ] **Step 4.3: Emit security/navigation result JSON**

  Create `<auditDir>/security-navigation-results.json`.

  Run after route-handler and session/navigation checks:

  ```powershell
  pnpm test:ia:security-navigation-results -- --audit-dir $auditDir
  ```

  It must include:

  - IA code,
  - scenario name,
  - actor or session type,
  - actor profile id and `profiles.app_role` when role evidence is involved,
  - route or host route,
  - `seedRunId` or explicit seed blocker when data is required,
  - target table, target row id, owner id, wrong-owner id, or admin target id
    when owner, RLS, or admin behavior is involved,
  - expected outcome,
  - actual outcome,
  - user-facing recovery copy,
  - safe return route,
  - raw error/token/provider exposure result,
  - screenshot or unavailable reason,
  - status and blocking reasons.

  For auth-related rows, also include:

  - `authOverviewRequirementIds` or extracted requirement summaries,
  - callback branch tested,
  - canonical auth error reason tested,
  - cooldown or retry-after expectation when applicable,
  - session-expiry expectation when applicable,
  - `backendAuthRequirementIds` or extracted RLS/auth boundary summaries when
    backend policy is involved.

  Security/navigation evidence is required for final `PASS` whenever the IA item
  is protected, role-specific, owner-id based, direct-URL reachable, or sensitive
  to session/logout/back/refresh behavior.
