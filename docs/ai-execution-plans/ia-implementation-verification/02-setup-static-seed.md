# IA Implementation Verification - Setup, Static Sync, And Seed Gate

> Part of [IA Implementation Verification](./README.md). Phase 0, Phase 0.5, Phase 1, and Phase 1.5, including Supabase seed-data preconditions.

Use this file directly only when your task matches the summary above.

## 5. Phase 0 - Preparation

- [ ] **Step 0.1: Confirm source priority**

  Use this order:

  1. `docs/sitemap.md`
  2. `docs/Wireframe/README.md` and `docs/Wireframe/*/description.md`
  3. `docs/flow/user-flow.md`
  4. `docs/prd.md`
  5. `docs/spec.md` and selected `docs/development/*`
  6. `docs/user-flow.md` as legacy context only

- [ ] **Step 0.2: Prepare script-backed audit output**

  Create the audit output directory before any phase writes evidence:

  ```powershell
  $runId = Get-Date -Format "yyyyMMdd-HHmmss"
  $auditDir = "reports/ia-verification/runs/$runId"
  New-Item -ItemType Directory -Force $auditDir
  $env:IA_AUDIT_DIR = $auditDir
  ```

  The audit directory must contain only generated run artifacts for that one
  `runId`. Manual notes may be stored there, but final labels must come from JSON
  generated or validated by scripts. Update `reports/ia-verification/latest`
  only after final merge and validation pass. All later commands assume
  `$env:IA_AUDIT_DIR` is set or pass `--audit-dir $auditDir` explicitly.

- [ ] **Step 0.3: Confirm current IA count**

  Run:

  ```powershell
  (Get-ChildItem docs\Wireframe -Directory | Measure-Object).Count
  ```

  Expected: `34`.

- [ ] **Step 0.4: Confirm runnable scripts**

  Run:

  ```powershell
  pnpm --version
  pnpm test
  ```

  If a command is unavailable, label automation evidence as `BLOCKED` and record the missing prerequisite.

  If `pnpm test` fails, classify the root cause in
  `audit-flow-monitor.json` before Phase 0.5:

  - `fail-no-test-surface`: no runnable test files or no stable `src/` surface
    exists for the tested area.
  - `fail-known-preimplementation`: active docs explicitly mark the repo or the
    tested surface as pre-implementation.
  - `fail-product-regression`: tests execute against existing source and fail.
  - `unavailable`: package manager, install, or runtime prerequisite is missing.

  `fail-no-test-surface` and `fail-known-preimplementation` may proceed as
  `CONCERN_ACCEPTED` only when the monitor records the root cause and the
  narrower IA audit scripts (`pnpm test:ia:*`) are still runnable or explicitly
  `BLOCKED`. `fail-product-regression` keeps the checkpoint `FAIL` unless the
  failing tests are proven unrelated to the IA audit and that proof is
  recorded.

- [ ] **Step 0.5: Initialize audit flow monitor**

  Create `<auditDir>/audit-flow-monitor.json` before Phase 0.5 starts.

  Required initial fields:

  - `runId`,
  - `monitorMode`: `independent-agent` or `single-session-degraded`,
  - `checkpoints`,
  - `collectorFirstRule`: `enabled`,
  - `currentPhase`: `Phase 0`,
  - `monitorStatus`.

  The first checkpoint must confirm that the run has an audit directory, a
  source priority decision, IA count evidence, runnable-script evidence, and a
  recorded monitor mode. Phase 0.5 cannot start until this checkpoint is `PASS`
  or `CONCERN_ACCEPTED` with a coordinator reason.

## 6. Phase 0.5 - Document Receipt Gate

This phase prevents agents from claiming they checked an IA item without
recording the active documents that governed the judgment.

Before any document evidence is labeled `BLOCKED`, the coordinator must attempt
the document receipt collector or record why the collector cannot run. A missing
`doc-receipts.json` is a collector input gap, not proof that every IA item was
checked. The monitor must record the attempted command, generated files, and
remaining unavailable evidence.

- [ ] **Step 0.5.1: Generate document receipt skeleton**

  Create `scripts/audit-setup/build-doc-receipts.mjs`.

  It must consume `docs/Wireframe/README.md`, `docs/sitemap.md`,
  `docs/flow/user-flow.md`, `docs/prd.md`, and the IA page description paths,
  then emit `<auditDir>/doc-receipts.json` with one receipt skeleton per IA
  item.

  The builder may prefill IA code, screen name, route or host route, audience,
  `docs/Wireframe/<ia-folder>/description.md` path, wireframe path or unavailable
  reason, required active docs, and pre-dispatch placeholders. It must not invent
  extracted requirements; unknown requirement fields stay `TODO` and the
  validator (Step 0.5.2) must fail until a reviewer fills them from the active
  docs.

  Add or confirm this package command before running the builder:

  ```json
  {
    "test:ia:receipts": "node scripts/audit-setup/build-doc-receipts.mjs"
  }
  ```

  After the builder runs, the resulting `<auditDir>/doc-receipts.json` must
  contain one receipt per IA item. Each receipt must include:

  - IA code,
  - screen name,
  - route or host route,
  - audience,
  - `docs/Wireframe/<ia-folder>/description.md` path,
  - `wireframe.png` path or unavailable reason,
  - `docs/sitemap.md` requirement summary,
  - `docs/flow/user-flow.md` previous and next flow summary,
  - `docs/prd.md` requirement summary,
  - conditional docs used, such as `docs/spec.md`,
    `docs/development/backend-auth.md`, `docs/development/auth-overview.md`,
    `docs/development/deferred-scope.md`, or `docs/ant-design/README.md`,
  - extracted requirements,
  - doc conflicts,
  - deferred-scope notes,
  - receipt owner,
  - assigned shard or `pending-dispatch`,
  - assigned agent id when delegated or `not-yet-dispatched`,
  - task packet path placeholder when delegated,
  - result packet path placeholder when delegated,
  - generated timestamp.

  Final shard ids, task packet paths, and result packet paths are enriched by the
  Phase 1 dispatch plan. Phase 0.5 must not fail only because those final
  dispatch fields are not known yet.

  `docs/development/auth-overview.md` is required for auth-related IA items,
  auth route handlers, login/session/logout checks, and Public/Auth shard review.
  Use `docs/development/backend-auth.md` for backend auth, RLS, storage,
  server-only key, and role-boundary checks.

- [ ] **Step 0.5.2: Create document receipt validator**

  Create `scripts/audit-setup/verify-doc-receipts.mjs`.

  Add or confirm this package command before running the gate:

  ```json
  {
    "test:ia:docs": "node scripts/audit-setup/verify-doc-receipts.mjs"
  }
  ```

  It must fail when:

  - an IA item has no receipt,
  - the matching IA `description.md` is missing from the receipt,
  - a current page uses only legacy docs as authority,
  - `docs/flow/user-flow.md` is missing for a user-flow-relevant page,
  - `docs/prd.md` extraction is empty,
  - an auth-related IA item or route handler omits
    `docs/development/auth-overview.md`,
  - an auth/RLS/backend-sensitive item omits `docs/development/backend-auth.md`,
  - extracted requirements are empty,
  - wireframe status is not `present`, `absent-with-reason`, or `not-applicable`,
  - doc conflicts are not recorded as `none`, `DOC-GAP`, or exact file references.

- [ ] **Step 0.5.3: Run document receipt gate**

  Run:

  ```powershell
  pnpm test:ia:receipts -- --audit-dir $auditDir
  pnpm test:ia:docs -- --audit-dir $auditDir
  ```

  Required evidence:

  - `doc-receipts.json`,
  - validator output,
  - one receipt per IA item,
  - assigned shard or `pending-dispatch` placeholder for each IA item,
  - explicit `DOC-GAP` or `BLOCKED` label for any missing active document.

  The receipt builder only creates the skeleton. The validator must keep failing
  until reviewers fill extracted requirements from active docs.

  No later phase can produce a final `PASS` for an IA item with a missing or
  invalid document receipt.

## 7. Phase 1 - Manifest And Static Sync

- [ ] **Step 1.1: Create manifest builder**

  Create `scripts/audit-setup/build-ia-manifest.mjs`.

  It must:

  - parse `docs/Wireframe/README.md` for 34 IA entries,
  - parse `docs/sitemap.md` for route, route type, host route, audience, and route handler rows,
  - parse `docs/ai-workflow/ia-page-implementation-verification.md` for required packs,
  - connect each IA item to its `doc-receipts.json` row,
  - emit `<auditDir>/ia-manifest.json`,
  - fail when a current IA entry lacks a manifest row,
  - fail when a manifest row has no valid document receipt,
  - label stale 32-screen prose as `DOC-GAP`, not `FAIL`.

- [ ] **Step 1.2: Create source map validator**

  Create `scripts/audit-setup/validate-ia-source-map.mjs`.

  It must:

  - read `ia-manifest.json`,
  - inspect `src/app/**/page.tsx` and `src/app/**/route.ts`,
  - inspect `src/components/**` for hosted surface component evidence,
  - inspect `src/lib/routes.ts` when it exists,
  - emit `<auditDir>/source-map-results.json`,
  - fail when a page route in the manifest has no source route,
  - fail when a route handler is treated as a visible page,
  - label missing source anchors as `FAIL` or `BLOCKED` depending on whether the implementation surface should exist.

- [ ] **Step 1.3: Create static coverage validator**

  Create or update `scripts/verify-ia-coverage.mjs`.

  It must consume:

  - `doc-receipts.json`,
  - `ia-manifest.json`,
  - `source-map-results.json`.

  It must emit `<auditDir>/static-results.json`.

- [ ] **Step 1.4: Add or confirm focused audit scripts**

  Add these scripts to `package.json` when implementing automation:

  ```json
  {
    "test:ia:manifest": "node scripts/audit-setup/build-ia-manifest.mjs",
    "test:ia:receipts": "node scripts/audit-setup/build-doc-receipts.mjs",
    "test:ia:docs": "node scripts/audit-setup/verify-doc-receipts.mjs",
    "test:ia:source-map": "node scripts/audit-setup/validate-ia-source-map.mjs",
    "test:ia:dispatch": "node scripts/audit-setup/build-agent-dispatch-plan.mjs",
    "test:ia:static": "node scripts/verify-ia-coverage.mjs",
    "test:ia:seed-plan": "node scripts/audit-setup/build-seed-data-plan.mjs",
    "test:ia:seed": "node scripts/audit-setup/verify-seed-data.mjs",
    "test:ia:storage-state": "node scripts/audit-setup/build-storage-state.mjs",
    "test:ia:browser-results": "node scripts/audit-setup/build-browser-results.mjs",
    "test:ia:hosted-surface-results": "node scripts/audit-setup/build-hosted-surface-results.mjs",
    "test:ia:security-navigation-results": "node scripts/audit-setup/build-security-navigation-results.mjs",
    "test:ia:merge": "node scripts/merge-ia-audit-results.mjs",
    "test:ia:validate": "node scripts/validate-ia-audit-report.mjs",
    "test:ia:html-report": "node scripts/audit-setup/build-html-report.mjs",
    "test:e2e:ia": "playwright test tests/e2e/coverage"
  }
  ```

- [ ] **Step 1.5: Create agent dispatch plan**

  Create `scripts/audit-setup/build-agent-dispatch-plan.mjs`.

  It must consume:

  - `doc-receipts.json`,
  - `ia-manifest.json`,
  - `source-map-results.json`.

  It must emit `<auditDir>/agent-dispatch-plan.json`.

  It must fail when:

  - an IA item has no assigned shard,
  - a shard has no task packet path,
  - a delegated shard has no expected result packet path,
  - the concurrency group exceeds six active child agents,
  - a high-risk IA item has no escalation trigger,
  - a child agent is assigned final label authority.

- [ ] **Step 1.6: Run static sync**

  Run:

  ```powershell
  pnpm test:ia:manifest -- --audit-dir $auditDir
  pnpm test:ia:source-map -- --audit-dir $auditDir
  pnpm test:ia:dispatch -- --audit-dir $auditDir
  pnpm test:ia:static -- --audit-dir $auditDir
  ```

  Required evidence:

  - all 34 IA entries listed,
  - `X-11` and `X-12` included,
  - one valid document receipt connected to each IA item,
  - hosted surfaces assigned to host routes,
  - route handlers separated from page routes,
  - `agent-dispatch-plan.json` exists and assigns every IA item to exactly one shard,
  - no current failure caused only by legacy route notes,
  - `ia-manifest.json`, `source-map-results.json`, and `static-results.json`
    all present.

  `pnpm test:ia:dispatch` validates shard assignment and expected packet paths
  only. It does not create final task packets and does not depend on
  `static-results.json`. Final task packet dispatch happens after Phase 4
  evidence freeze (see
  [execution order step 13](./05-execution-order-and-reference.md) and
  [Phase 5 step 5.0](./04-review-and-reporting.md)). If the dispatch
  builder is later changed to consume static evidence, move
  `pnpm test:ia:static` before `pnpm test:ia:dispatch` in the command order
  above.

## 7.5 Phase 1.5 - Supabase Seed Data Gate

Phase 1.5 creates or verifies only the deterministic Supabase rows required for
later evidence collection. It is a precondition gate, not implementation proof.
Run it after static sync and before browser, hosted-surface, or security checks
that depend on database state.

- [ ] **Step 1.5.1: Create seed-data plan**

  Create `scripts/audit-setup/build-seed-data-plan.mjs`.

  It must consume:

  - `doc-receipts.json`,
  - `ia-manifest.json`,
  - `source-map-results.json`,
  - `static-results.json`,
  - `agent-dispatch-plan.json`,
  - `tests/e2e/coverage/ia-catalog.ts` when it exists.

  It must emit `<auditDir>/seed-plan.json`.

  Each seed-plan row must include:

  - IA code,
  - scenario name,
  - route or host route,
  - audience,
  - required role or `not-applicable`,
  - required Supabase tables and record keys,
  - owner record key when the route has `:id`,
  - wrong-owner record key when owner enforcement is tested,
  - admin target record key when admin action evidence is needed,
  - published, private, empty, error, or success-state record key when relevant,
  - `targetEnvironment`,
  - `targetClassification`,
  - `seedPreconditions`,
  - `seedAllowed`,
  - `blockingIfMissing`.

  The plan must keep public routes and seed-independent scenarios explicitly
  marked as `seedAllowed: false` with a `notApplicableReason`, so missing seed
  data cannot block unrelated public evidence.

- [ ] **Step 1.5.2: Create seed-data verifier**

  Create `scripts/audit-setup/verify-seed-data.mjs`.

  It must create or verify only the minimal deterministic Supabase data required
  by `seed-plan.json`:

  - learner actor,
  - content admin actor,
  - org admin actor,
  - platform admin actor,
  - wrong-owner learner actor,
  - one matching `profiles` row for every seeded `auth.users` actor,
  - `profiles.app_role` values for role checks,
  - owner-bound rows for `:id` routes,
  - wrong-owner target rows for owner-denial checks,
  - admin target rows for admin action checks,
  - published/private problem rows where visibility or RLS is tested,
  - minimal empty, error, and success-state rows where the E2E catalog requires
    those states.

  It must refuse to seed production and unknown targets. Treat
  `unknown-treat-as-prod` as unsafe and record a seed blocker instead of
  writing rows. Do not define any exception path for production seeding.
  This IA audit rule overrides any broader break-glass production override
  documented for non-audit operations. If a force flag is used in any
  storage-state or seed helper, the result is non-audit evidence and blocks
  final `PASS`.

  If Supabase setup is unavailable, record a seed collector attempt and mark
  only seed-dependent scenarios `BLOCKED`. Public routes and seed-independent
  checks must still run in later phases.

  The verifier must emit `<auditDir>/seed-results.json` with:

  - `seedRunId`,
  - `targetEnvironment`,
  - `targetClassification`,
  - `seedMode`,
  - `seededActors`,
  - `seededRows`,
  - `seedPreconditions`,
  - `seedStatus`,
  - `seedBlockingReasons`,
  - `generatedAt`.

  It must fail the seed row when an actor lacks a matching `profiles` row, when
  role truth is read from auth metadata instead of `profiles.app_role`, or when
  an owner, wrong-owner, admin, published, private, empty, error, or success
  record required by the seed plan is missing.

- [ ] **Step 1.5.3: Run seed-data gate**

  Run:

  ```powershell
  pnpm test:ia:seed-plan -- --audit-dir $auditDir
  pnpm test:ia:seed -- --audit-dir $auditDir
  ```

  Current automation may verify only a narrower seed surface than this full
  plan. If a required seed scenario is not emitted by the verifier, mark only
  that scenario `BLOCKED` after recording the collector attempt. Use `--apply`
  only against a classified dev/preview target, for example:

  ```powershell
  pnpm test:ia:seed -- --audit-dir $auditDir --apply
  ```

  Never use a production or unknown-target override for IA audit evidence.

  Required evidence:

  - `<auditDir>/seed-plan.json`,
  - `<auditDir>/seed-results.json`,
  - seed-run id,
  - target environment classification,
  - actor ids and profile ids,
  - owner, wrong-owner, admin target, published/private, empty, error, and
    success-state row ids when applicable,
  - seed status or seed blocker per seed-dependent scenario.

  Later browser and security rows must reference `seedRunId` or an explicit seed
  blocker for every seed-dependent scenario. A seed row alone never counts as
  rendered page, route handler, or authorization evidence.
