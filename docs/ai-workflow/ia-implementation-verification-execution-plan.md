# IA Implementation Verification Execution Plan

> For agentic workers: execute this plan task by task. Use checkbox status for tracking. Keep the procedure document at `docs/ai-workflow/ia-page-implementation-verification.md` as the policy source.

**Goal:** turn the IA verification procedure into a repeatable, script-backed execution flow that proves whether all current IA pages, hosted surfaces, and route handlers are implemented well enough.

**Architecture:** use a script-backed, manifest-driven, run-isolated, multi-agent audit. First derive the 34 IA entries from docs, then require document-read receipts, then run static route/code checks, browser checks, hosted-surface checks, and security/navigation checks, then freeze an evidence bundle, then dispatch bounded IA review agents by IA shard, then run an AI-first UX/UI review, then ask a human to confirm the judgment-sensitive items, then merge every script-readable result into one IA report. The final `PASS` label is computed and validated by scripts; prose-only notes or child-agent recommendations cannot override script evidence.

**Tech Stack:** Node.js scripts, JSON schemas, Vitest, Playwright, Next.js App Router, Supabase auth state fixtures, agent task packets, agent result packets, AI UX review packets, human confirmation notes, Markdown reports, and machine-readable JSON audit results.

---

## 1. Current Baseline

- `docs/IA/README.md` currently lists 34 IA folders.
- `docs/sitemap.md` is the route authority, but some prose still says 32 screens. Treat that as `DOC-GAP`, not as an implementation failure.
- `tests/e2e/coverage/coverage-matrix.spec.ts` still has a 32-route-era comment and currently covers only 27 visible IA routes.
- Missing from the current E2E matrix: `C-03`, `D-M1`, `D-M2`, `D-M3`, `F-M1`, `X-11`, `X-12`.
- `/auth/callback` and `/auth/callback-fragment` exist in source. `/auth/sign-out` is required by the verification procedure but no matching source route handler was found during planning.
- `playwright.config.ts` references `tests/e2e/auth-state/{role}.json`, but that directory is not currently present.

## 2. Scope

### In Scope

- Build a repeatable IA verification process for all 34 IA entries.
- Add script-backed gates for every phase.
- Require machine-readable JSON evidence before any final `PASS`.
- Require document-read receipts so agents cannot pass an IA item without recording the active docs they used.
- Include page routes, hosted modals, modal states, toast states, and auth route handlers.
- Separate automated evidence, AI UX review evidence, and human confirmation evidence.
- Use bounded multi-agent review lanes for independent IA shards.
- Require task packets and result packets for every delegated IA review.
- Cover planning, UX/UI, development, data/security, operations, and policy checks.
- Cover external entry scenarios such as direct URL, browser back, refresh, logout, invalid id, malformed id, and wrong-owner id.
- Produce one final report that labels every IA item as `PASS`, `PARTIAL`, `FAIL`, `DEFERRED`, `DOC-GAP`, or `BLOCKED`.

### Out Of Scope

- Fixing product defects found during the audit.
- Changing product scope, billing scope, notification transport, or policy decisions.
- Treating legacy-only routes as current implementation targets.
- Calling a page complete only because the URL opens or returns a non-500 response.
- Letting handwritten Markdown override script-readable audit evidence.
- Letting a child agent's `PASS` recommendation become the final `PASS` label without coordinator merge and script validation.

## 3. Execution Roles

- **Coordinator:** owns source priority, run order, multi-agent dispatch, task packets, result packet integration, result labels, final report, and unresolved risk calls.
- **Planning reviewer:** checks PRD, sitemap, IA docs, and flow alignment.
- **Automation owner:** owns Node/Vitest/Playwright checks, script gates, JSON schemas, result merging, final report validation, and machine-readable outputs.
- **IA shard reviewer:** owns one assigned IA shard, reads only the assigned docs/evidence, writes a result packet, and recommends but does not finalize labels.
- **Reconciliation reviewer:** samples high-risk or disputed IA items after shard review and checks whether child-agent results conflict with JSON evidence.
- **AI UX reviewer:** owns the first-pass IA-by-IA UX readiness review using `docs/ai-workflow/ia-ai-first-ux-review-checklist.md`.
- **Human UX/UI reviewer:** owns final judgment for visual hierarchy, natural language, mobile readability, keyboard/focus feel, modal behavior, and policy-sensitive copy.
- **Security/data reviewer:** owns auth, role, owner, route handler, session, logout, raw error, RLS, and data exposure checks.
- **Operations/policy reviewer:** owns failure recovery, logging expectations, cooldowns, deferred billing, notification transport, and copy overpromising checks.

One person may hold multiple roles, but the final report must keep evidence separated by role area.

## 4. Output Artifacts

Create these artifacts when the plan is executed.

All generated run artifacts must be written under a run-specific directory:

- `auditDir`: `reports/ia-verification/runs/<runId>`
- `runId`: timestamped id such as `20260528-1130`
- `latest`: a pointer or copy updated only after `pnpm test:ia:merge` and
  `pnpm test:ia:validate` pass

Do not let concurrent runs or restarted runs write directly into `latest`.
Every JSON artifact below lives under `<auditDir>` unless the table explicitly
names a source file outside the run directory.

| Artifact | Path | Purpose |
| --- | --- | --- |
| IA manifest builder | `scripts/audit-setup/build-ia-manifest.mjs` | Derive IA inventory, route types, audience, packs, and expected evidence from active docs. |
| IA manifest | `<auditDir>/ia-manifest.json` | Machine-readable IA inventory used by every later phase. |
| Source map validator | `scripts/audit-setup/validate-ia-source-map.mjs` | Compare manifest entries against `src/app/**`, `src/components/**`, and route handlers. |
| Source map result | `<auditDir>/source-map-results.json` | Machine-readable doc/code source-anchor result. |
| Document receipt validator | `scripts/audit-setup/verify-doc-receipts.mjs` | Verify that each IA item records active docs read and extracted requirements. |
| Document receipts | `<auditDir>/doc-receipts.json` | Per-IA proof of active docs consulted, extracted requirements, and doc conflicts. |
| IA static validator | `scripts/verify-ia-coverage.mjs` | Validate IA coverage using the manifest, source map, and document receipts. |
| E2E catalog | `tests/e2e/coverage/ia-catalog.ts` | Single test catalog for 34 IA entries plus hosted surfaces and route handlers. |
| Static IA result | `<auditDir>/static-results.json` | Machine-readable doc/code sync result. |
| Browser result | `<auditDir>/browser-results.json` | Playwright evidence summary. |
| Hosted surface result | `<auditDir>/hosted-surface-results.json` | Modal, toast, loading, autosave, export, and host-route evidence summary. |
| Security/navigation result | `<auditDir>/security-navigation-results.json` | Direct URL, role, owner, session, logout, and back/refresh checks. |
| Agent dispatch planner | `scripts/audit-setup/build-agent-dispatch-plan.mjs` | Create and validate IA shard assignments from the manifest. |
| Agent dispatch plan | `<auditDir>/agent-dispatch-plan.json` | IA shard assignment, concurrency limit, packet paths, and escalation rules. |
| Agent task packets | `<auditDir>/agent-packets/tasks/*.md` | Per-shard instructions prepared before delegated review starts. |
| Agent result packets | `<auditDir>/agent-packets/results/*.md` | Per-shard result packets imported by the coordinator from child-agent responses. |
| Agent IA result JSON | `<auditDir>/agent-packets/results/*.json` | Per-shard machine-readable IA result rows validated before integration. |
| Agent integration result | `<auditDir>/agent-integration-results.json` | Coordinator merge result for delegated findings, conflicts, provenance, and unresolved packet gaps. |
| AI UX checklist | `docs/ai-workflow/ia-ai-first-ux-review-checklist.md` | Phase 5 AI-first UX review standard. |
| AI UX review result | `<auditDir>/ai-ux-review.json` | Machine-readable IA-by-IA AI first-pass UX readiness result. |
| AI UX review notes | `<auditDir>/ai-ux-review.md` | Human-readable AI UX review notes generated from JSON. |
| Human confirmation result | `<auditDir>/manual-review.json` | Machine-readable human UX/UI and policy judgment result. |
| Human confirmation notes | `<auditDir>/manual-review.md` | Human-readable review notes generated from or linked to JSON. |
| Audit result merger | `scripts/merge-ia-audit-results.mjs` | Merge all phase JSON files and compute final labels. |
| Final audit validator | `scripts/validate-ia-audit-report.mjs` | Fail when final labels violate document, evidence, AI, human, or security gates. |
| Final audit JSON | `<auditDir>/ia-implementation-audit.json` | Computed IA-by-IA final result. |
| Final audit report | `<auditDir>/ia-implementation-audit.md` | Human-readable IA-by-IA result table generated from final JSON. |

### Script-Backed Audit Contract

This plan is not a prose-only checklist. Every phase must produce script-readable
evidence.

Each phase follows this shape:

1. input documents,
2. script or test gate,
3. JSON output,
4. `PASS` blocking rules,
5. optional Markdown explanation generated from or linked to the JSON.

Markdown reports explain the evidence. They do not override the JSON result.

Every JSON row must include:

- `runId`,
- `sourceCommit`,
- `dirtyState`,
- `evidenceBundleId`,
- `iaCode`,
- `screenName`,
- `phase`,
- `routeOrHostRoute`,
- `routeType`,
- `audience`,
- `docsConsulted` or `notApplicableReason`,
- `extractedRequirements`,
- `evidence`,
- `status`,
- `blockingReasons`,
- `sourceFiles`,
- `generatedBy`,
- `generatedAt`.

`sourceCommit` and `evidenceBundleId` must match across the phase results that
feed one final label. If source files, active docs, or evidence inputs change
after Phase 2 to Phase 4 evidence is generated, the affected rows are stale and
cannot support final `PASS` until regenerated or explicitly downgraded.

When a row comes from delegated work, it must also include:

- `agentId`,
- `agentSessionId` or `agentRunId`,
- `agentWorkspace` or `agentWorktree`,
- `assignedShard`,
- `taskPacketPath`,
- `resultPacketPath`,
- `sourceRunId`,
- `producedAt`,
- `importedBy`,
- `importedAt`,
- `importStatus`,
- `resultPacketHash`,
- `baseCommit`,
- `coordinatorIntegratedAt`,
- `agentRecommendation`,
- `coordinatorDecision`.

Delegated packets are not durable merely because a child agent says it wrote a
file. The child agent must return the result packet content in its final
response or another coordinator-readable channel. The coordinator imports that
content into `<auditDir>/agent-packets/results/`, records provenance in
`agent-integration-results.json`, and marks the packet `STALE` or `BLOCKED`
when `baseCommit`, `sourceRunId`, or `resultPacketHash` is missing or invalid.

IA shard result packets must have a machine-readable IA result payload. A
general Markdown result packet is not enough for final merge. Use either a
dedicated `<auditDir>/agent-packets/results/<runId>-<shardId>-<agentId>.json`
companion file or a fenced JSON block that can be extracted and validated by
the final validator.

An IA item cannot receive final `PASS` when any required phase has no JSON row,
an invalid document receipt, missing browser/security evidence, unresolved
blocking reasons, missing delegated result packet, unresolved agent conflict, or
required human confirmation that is absent.

### Multi-Agent Dispatch Contract

Multi-agent review is part of the execution plan, not an optional side note. The
coordinator may run up to six child agents concurrently when the evidence bundle
can be split by IA shard. Do not spawn one child agent for all 34 IA items by
default, and do not spawn 34 agents at once by default.

Dispatch planning and child-agent spawning are separate steps:

- Phase 1 creates the shard assignment, concurrency plan, expected packet paths,
  and escalation rules.
- Phase 2 to Phase 4 generate the evidence bundle that shard reviewers need.
- Phase 5 validates that each shard's `requiredEvidenceInputs` exist, then
  creates final task packets and spawns child agents.

Do not spawn IA shard reviewers before required browser, hosted-surface, and
security/navigation evidence either exists or is explicitly labeled `BLOCKED`.

Default IA shards:

1. **Public/Auth shard:** `X-01`, `A-01`, `A-02`, `X-06`, `X-11`, `X-12`, auth callback routes.
2. **Onboarding/Dashboard shard:** `A-03`, `B-01`, `X-02`.
3. **Practice/Writing shard:** `C-01`, `C-02`, `C-03`, `D-01`, `D-02`, `D-03`, `D-04`, `D-M1`, `D-M2`, `D-M3`.
4. **Feedback/Reports/Recommendations shard:** `E-01`, `E-02`, `R-01`, `R-02`, `X-07`.
5. **Library/Settings/Billing shard:** `F-01`, `F-M1`, `G-01`, `X-03`, `X-04`, `X-05`, `X-09`.
6. **Admin shard:** `H-01`, `X-08`, `X-10`, admin role flows, admin RBAC, and admin audit scenarios.

Security/data review is a cross-cutting evidence lane, not a replacement for the
primary IA shard. Each IA item still has exactly one primary shard owner, while
`security-navigation-results.json` records auth, role, owner-id, session,
logout, raw-error, RLS, and data-exposure evidence across shards. A primary
shard may recommend `PASS`, but a blocking security/data row still prevents
final `PASS`.

The coordinator must create `agent-dispatch-plan.json` before dispatch. Each
shard row must include:

- shard id,
- IA codes,
- role focus,
- exact read scope,
- exact write scope,
- task packet path,
- result packet path,
- required JSON evidence inputs,
- concurrency group,
- `subagentEligible` with reason,
- primary shard owner,
- cross-cutting evidence lanes that apply,
- escalation triggers.

Every delegated shard must use the task packet format in
`docs/ai-workflow/agent-packets.md`. The task packet must tell the child agent:

- which IA codes it owns,
- which docs and evidence it must read,
- which files it may write,
- which files it must not touch,
- which checks it must run or inspect,
- which IA result JSON schema or structured JSON block it must return,
- that it may recommend labels but cannot finalize `PASS`.

Every child agent must return a result packet using
`docs/ai-workflow/agent-packets.md`. The result packet must include, per IA item:

- document receipt id,
- phase result ids used,
- evidence inspected,
- recommended label,
- confidence,
- blockers,
- UX/security/policy questions,
- missing evidence,
- exact follow-up owner,
- IA result JSON payload or companion JSON path.

Dedicated one-IA agents are allowed only for escalation. Use a one-IA agent when:

- two shard results conflict,
- an IA item has security, role, owner-id, billing, policy, or admin risk,
- AI confidence is low,
- a modal, form, AI output, auth recovery, or payment-related surface is disputed,
- the coordinator cannot reconcile the evidence from the shard packet.

Coordinator merge rules:

- child-agent recommendations are inputs, not final labels,
- missing or malformed result packets make the assigned IA items `BLOCKED`,
- unresolved conflicts make the assigned IA items `PARTIAL`, `FAIL`, `DOC-GAP`,
  or `BLOCKED`, never final `PASS`,
- `agent-integration-results.json` must record which packet was accepted,
  rejected, or escalated,
- `agent-integration-results.json` must record packet provenance, including
  `sourceRunId`, `baseCommit`, `importStatus`, and `resultPacketHash`,
- single-session mode must fill the same IA result schema as delegated mode,
  with `delegationMode: "single-session"` and no child-agent provenance,
- the central context ledger must link every delegated task packet and result
  packet before Phase 6 validation.

Recommended package scripts when automation is implemented:

```json
{
  "test:ia:manifest": "node scripts/audit-setup/build-ia-manifest.mjs",
  "test:ia:docs": "node scripts/audit-setup/verify-doc-receipts.mjs",
  "test:ia:source-map": "node scripts/audit-setup/validate-ia-source-map.mjs",
  "test:ia:dispatch": "node scripts/audit-setup/build-agent-dispatch-plan.mjs",
  "test:ia:static": "node scripts/verify-ia-coverage.mjs",
  "test:e2e:ia": "playwright test tests/e2e/coverage",
  "test:ia:merge": "node scripts/merge-ia-audit-results.mjs",
  "test:ia:validate": "node scripts/validate-ia-audit-report.mjs"
}
```

## 5. Phase 0 - Preparation

- [ ] **Step 0.1: Confirm source priority**

  Use this order:

  1. `docs/sitemap.md`
  2. `docs/IA/README.md` and `docs/IA/*/description.md`
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
  ```

  The audit directory must contain only generated run artifacts for that one
  `runId`. Manual notes may be stored there, but final labels must come from JSON
  generated or validated by scripts. Update `reports/ia-verification/latest`
  only after final merge and validation pass.

- [ ] **Step 0.3: Confirm current IA count**

  Run:

  ```powershell
  (Get-ChildItem docs\IA -Directory | Measure-Object).Count
  ```

  Expected: `34`.

- [ ] **Step 0.4: Confirm runnable scripts**

  Run:

  ```powershell
  pnpm --version
  pnpm test
  ```

  If a command is unavailable, label automation evidence as `BLOCKED` and record the missing prerequisite.

## 6. Phase 0.5 - Document Receipt Gate

This phase prevents agents from claiming they checked an IA item without
recording the active documents that governed the judgment.

- [ ] **Step 0.5.1: Create document receipt format**

  Create `<auditDir>/doc-receipts.json`.

  Each IA item must include:

  - IA code,
  - screen name,
  - route or host route,
  - audience,
  - `docs/IA/<ia-folder>/description.md` path,
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
  - assigned shard,
  - assigned agent id when delegated,
  - task packet path when delegated,
  - result packet path when delegated,
  - generated timestamp.

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
  pnpm test:ia:docs
  ```

  Required evidence:

  - `doc-receipts.json`,
  - validator output,
  - one receipt per IA item,
  - assigned shard for each IA item,
  - explicit `DOC-GAP` or `BLOCKED` label for any missing active document.

  No later phase can produce a final `PASS` for an IA item with a missing or
  invalid document receipt.

## 7. Phase 1 - Manifest And Static Sync

- [ ] **Step 1.1: Create manifest builder**

  Create `scripts/audit-setup/build-ia-manifest.mjs`.

  It must:

  - parse `docs/IA/README.md` for 34 IA entries,
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
    "test:ia:docs": "node scripts/audit-setup/verify-doc-receipts.mjs",
    "test:ia:source-map": "node scripts/audit-setup/validate-ia-source-map.mjs",
    "test:ia:dispatch": "node scripts/audit-setup/build-agent-dispatch-plan.mjs",
    "test:ia:static": "node scripts/verify-ia-coverage.mjs",
    "test:ia:merge": "node scripts/merge-ia-audit-results.mjs",
    "test:ia:validate": "node scripts/validate-ia-audit-report.mjs",
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
  pnpm test:ia:manifest
  pnpm test:ia:source-map
  pnpm test:ia:dispatch
  pnpm test:ia:static
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
  - fixture id type when the route has `:id`,
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

  If Supabase local setup is unavailable, browser checks that require auth stay `BLOCKED`.

- [ ] **Step 2.4: Run page browser matrix**

  Start the app in one terminal:

  ```powershell
  pnpm dev
  ```

  Run in another terminal:

  ```powershell
  pnpm exec playwright test tests/e2e/coverage/coverage-matrix.spec.ts
  ```

  Required evidence:

  - `<auditDir>/browser-results.json`,
  - Playwright JSON output,
  - screenshots for each applicable page and viewport,
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

  For each scenario, also record:

  - user-facing context copy,
  - recovery CTA,
  - safe return route,
  - whether raw provider, token, owner, or internal error details are hidden,
  - screenshot or unavailable reason for Phase 5 AI UX review.

- [ ] **Step 4.3: Emit security/navigation result JSON**

  Create `<auditDir>/security-navigation-results.json`.

  It must include:

  - IA code,
  - scenario name,
  - actor or session type,
  - route or host route,
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

## 11. Phase 5 - AI-First UX/UI Review And Human Confirmation

Phase 5 starts with AI because AI can cheaply scan all IA items for obvious
readiness gaps. It ends with a human because perceived clarity, trust, wording,
visual hierarchy, and final UX judgment are still judgment-sensitive.

Use `docs/ai-workflow/ia-ai-first-ux-review-checklist.md` as the Phase 5
standard.

- [ ] **Step 5.0: Dispatch IA review agents**

  Before AI UX review starts, the coordinator reads
  `agent-dispatch-plan.json`, verifies that every required evidence input is
  present or explicitly `BLOCKED`, and prepares task packets under
  `<auditDir>/agent-packets/tasks/`.

  Default execution:

  - dispatch one child agent per IA shard,
  - keep concurrent child agents at six or fewer,
  - keep each child agent read/write scope bounded to its shard,
  - tell each child agent to recommend labels only,
  - require each child agent to return a result packet in its final response so
    the coordinator can import it under `<auditDir>/agent-packets/results/`,
  - require each delegated shard to return machine-readable IA result JSON,
  - record packet paths in the central context ledger before continuing.

  If the implementation run is done by one person without child agents, keep the
  same shard boundaries and fill `agent-integration-results.json` with
  `delegationMode: "single-session"` so the final validator can still check
  that every IA item was reviewed by shard. Single-session rows must still use
  the same IA result JSON schema as delegated rows, except child-agent
  provenance fields are marked `not-applicable`.

- [ ] **Step 5.1: Prepare the AI UX review packet**

  For every IA item, gather:

  - IA code and screen name,
  - route or host route,
  - route type,
  - audience,
  - matching `docs/IA/*/description.md`,
  - `wireframe.png` when present,
  - source anchors under `src/app/**`, `src/components/**`, and `src/lib/routes.ts`,
  - Phase 1 static result,
  - Phase 2 browser screenshots for 360, 768, and 1280 widths,
  - Phase 3 hosted-surface evidence when applicable,
  - Phase 4 security/navigation evidence when applicable,
  - Phase 2 to Phase 4 AI-ready UX evidence bundle,
  - shard id,
  - task packet path,
  - result packet path or single-session review row,
  - IA result JSON row or valid unavailable reason.

  Do not start AI review for an IA item that has no matching IA document. Mark it
  `DOC-GAP`. Do not start AI review for a delegated IA item whose result packet
  or IA result JSON is missing, stale, or malformed. Mark it `BLOCKED`.

- [ ] **Step 5.2: Run the AI first-pass UX review**

  Create:

  - `<auditDir>/ai-ux-review.json`
  - `<auditDir>/ai-ux-review.md`

  For every IA item, record the review card shape defined in
  `docs/ai-workflow/ia-ai-first-ux-review-checklist.md`.

  The Markdown card must be generated from, or traceable to, the matching JSON
  row. A Markdown-only AI review cannot contribute to final `PASS`.

  Required AI checks:

  - page job and first impression,
  - IA and wireframe fidelity,
  - user flow and navigation continuity,
  - direct URL, refresh, and browser back expectations,
  - human-AI behavior and user control,
  - status, loading, empty, and error states,
  - forms, labels, and instructions,
  - keyboard, focus, and modal behavior,
  - responsive and touch UX,
  - policy, trust, security, billing, notification, and deferred-scope copy.

  The AI reviewer must return:

  - result: `PASS`, `PARTIAL`, `FAIL`, `BLOCKED`, `DOC-GAP`, or `DEFERRED`,
  - confidence: `high`, `medium`, or `low`,
  - human confirmation: `ready`, `needs-human-judgment`, or `not-ready`,
  - shard id,
  - agent recommendation when delegated,
  - coordinator integration decision,
  - document receipt id,
  - phase result ids used,
  - evidence used,
  - top gaps,
  - exact questions for the human reviewer,
  - missing screenshots or browser evidence.

- [ ] **Step 5.3: Apply AI no-pass rules**

  The AI review cannot mark an item `PASS` when:

  - no rendered screenshot or browser evidence exists,
  - only route existence or HTTP status was verified,
  - the matching IA `description.md` was not read,
  - a required shard result packet is missing,
  - a required IA result JSON row is missing, stale, or malformed,
  - `runId`, `sourceCommit`, or `evidenceBundleId` does not match the evidence
    bundle being merged,
  - a child-agent recommendation conflicts with JSON evidence and the coordinator has not resolved it,
  - a hosted modal was reviewed as a standalone component instead of through its host route,
  - modal trigger, focus entry, focus return, close, cancel, or `Esc` behavior is missing,
  - direct URL, browser back, auth, role, owner-id, or refresh evidence is required but absent,
  - deferred billing or notification copy implies live production behavior,
  - active docs conflict or omit the rule needed to judge the UX.

- [ ] **Step 5.4: Confirm judgment-sensitive items with a human**

  Create or update:

  - `<auditDir>/manual-review.json`
  - `<auditDir>/manual-review.md`

  Human confirmation is required when:

  - AI confidence is `low` or `medium`,
  - AI result is `PARTIAL`, `FAIL`, `BLOCKED`, or `DOC-GAP`,
  - the IA item includes a modal, form, AI output, auth recovery, billing,
    notifications, admin action, or policy-sensitive copy,
  - the AI flags visual hierarchy, wording, tone, trust, mobile readability, or
    Korean copy naturalness as a judgment question.

  The human reviewer should not repeat every mechanical check. Review the
  questions surfaced by the AI card and record the final judgment.

  The human confirmation JSON must include:

  - IA code,
  - AI UX review row id,
  - human reviewer name or role,
  - reviewer type: `human`, `ai-generated`, or `not-applicable`,
  - source: `user-provided`, `external-review-note`, `recorded-live-review`,
    `agent-note`, or `not-applicable`,
  - confirmation reference, such as a user message, external review link, or
    signed manual artifact id,
  - confirmed timestamp,
  - confirmation status: `confirmed`, `rejected`, `needs-follow-up`, or
    `candidate-note-only`,
  - questions reviewed,
  - final UX/UI result,
  - policy or wording concerns,
  - accepted risk, if any,
  - status and blocking reasons.

  A human Markdown note without a matching JSON row cannot unblock final `PASS`.
  An AI-generated `manual-review.json` row or `source: agent-note` can record
  candidate questions, but it cannot satisfy required human confirmation or
  unblock final `PASS`.

- [ ] **Step 5.5: Check hierarchy, wireframe, keyboard, focus, and policy**

  The combined AI and human notes must answer:

  - can the user identify the screen from the first heading,
  - does one primary CTA dominate,
  - do heading, explanation, content, and CTA follow task order,
  - are `Wireframe Number Map` items `present`, `superseded`, `missing`, or
    `unclear`,
  - does `Tab` order follow visual and task order,
  - is the focus indicator visible,
  - do modal focus entry and return work,
  - do loading, saving, submitting, and failure states use plain language,
  - do paywall, subscription, notification, auth, privacy, and account-policy
    copy respect active docs.

## 12. Phase 6 - Report Assembly

- [ ] **Step 6.1: Merge results**

  Combine:

  - `ia-manifest.json`,
  - `doc-receipts.json`,
  - `source-map-results.json`,
  - `static-results.json`,
  - `browser-results.json`,
  - `hosted-surface-results.json`,
  - `security-navigation-results.json`,
  - `agent-dispatch-plan.json`,
  - `agent-integration-results.json`,
  - `ai-ux-review.json`,
  - `manual-review.json`.

  Run:

  ```powershell
  pnpm test:ia:merge
  ```

  This script creates:

  - `<auditDir>/ia-implementation-audit.json`,
  - `<auditDir>/ia-implementation-audit.md`.

- [ ] **Step 6.2: Apply result labels**

  `scripts/merge-ia-audit-results.mjs` applies these rules:

  - `FAIL` beats `PARTIAL`.
  - `BLOCKED` blocks a final `PASS`.
  - missing or invalid document receipts block a final `PASS`.
  - missing required JSON rows block a final `PASS`.
  - missing delegated result packets block a final `PASS`.
  - child-agent recommendations do not become final labels until coordinator merge accepts them.
  - unresolved child-agent conflicts block a final `PASS`.
  - fixture-only evidence cannot become `PASS`.
  - stale evidence, mixed `runId`s, or mismatched `sourceCommit` /
    `evidenceBundleId` blocks final `PASS`.
  - AI-only judgments cannot become final `PASS` when human confirmation is required.
  - human-only judgments cannot be auto-marked `PASS` without the matching evidence scope.
  - AI-generated manual-review rows cannot satisfy required human confirmation.
  - security/data blockers from cross-cutting evidence lanes override primary
    shard `PASS` recommendations.
  - `DEFERRED` applies only when active docs explicitly keep the behavior out of scope.
  - `DOC-GAP` applies when active docs conflict, omit the rule, or leave policy unclear.
  - Markdown notes can explain a result but cannot override a JSON blocking reason.

- [ ] **Step 6.3: Create final report**

  Create the final report through `scripts/merge-ia-audit-results.mjs`. Do not
  handwrite final labels.

  Required columns:

  - IA code,
  - screen name,
  - route or host route,
  - route type,
  - audience,
  - packs,
  - planning result,
  - AI UX result,
  - AI confidence,
  - human confirmation,
  - final UX/UI result,
  - development result,
  - data/security result,
  - operations result,
  - policy result,
  - QA evidence,
  - shard id,
  - agent recommendation,
  - coordinator decision,
  - final label,
  - top gaps,
  - next owner or reason.

- [ ] **Step 6.4: Validate final audit report**

  Run:

  ```powershell
  pnpm test:ia:validate
  ```

  `scripts/validate-ia-audit-report.mjs` must fail when:

  - `ia-implementation-audit.md` and `ia-implementation-audit.json` disagree,
  - an IA item has `PASS` without a valid document receipt,
  - an IA item has `PASS` without required browser/security/hosted-surface
    evidence,
  - an IA item has `PASS` while any phase result has unresolved
    `blockingReasons`,
  - AI confidence is `low` or `medium` and human confirmation is missing,
  - a modal, form, AI output, auth, billing, notification, admin, or
    policy-sensitive item has no human confirmation,
  - a delegated IA item has no result packet,
  - a delegated or single-session IA item has no valid IA result JSON row,
  - a child-agent result packet was not integrated into
    `agent-integration-results.json`,
  - a child-agent result packet has missing provenance, missing hash, stale
    `baseCommit`, or mismatched `sourceRunId`,
  - a child-agent recommendation conflicts with JSON evidence and has no
    coordinator decision,
  - mixed `runId`, stale `sourceCommit`, or mismatched `evidenceBundleId` feeds
    a final `PASS`,
  - an auth-related IA item, auth route handler, login/session/logout check, or
    Public/Auth shard result has `PASS` without a valid
    `docs/development/auth-overview.md` receipt,
  - an auth/RLS/backend-sensitive item has `PASS` without a valid
    `docs/development/backend-auth.md` receipt,
  - required human confirmation is satisfied only by an AI-generated or
    `source: agent-note` row,
  - legacy docs are used as authority over active docs,
  - final labels were edited manually without matching JSON evidence.

## 13. Execution Order

Run the process in this order.

1. Phase 0: preparation.
2. Phase 0.5: document receipt gate.
3. Phase 1: manifest, static sync, and agent dispatch plan with expected shard
   assignments and expected packet paths only.
4. Phase 2: page browser matrix.
5. Phase 3: hosted surface checks.
6. Phase 4: security, session, and external entry.
7. Evidence bundle freeze: verify `runId`, `sourceCommit`, `dirtyState`, and
   `evidenceBundleId`; mark missing inputs `BLOCKED`.
8. Multi-agent dispatch decision: create task packets and spawn IA shard agents,
   or record `delegationMode: "single-session"` and write single-session IA
   result rows.
9. Phase 5: IA shard result packets, IA result JSON import, AI-first UX/UI
   review, and human confirmation.
10. Phase 6: report assembly and final validation.
11. Re-run Phase 0.5 to Phase 4 after any implementation or document-source fixes.
12. Re-run Phase 5 only for changed pages, unresolved AI findings, unresolved
    human judgments, or changed shard packets.
13. Re-run Phase 6 after any upstream result changes.

## 14. Completion Gate

The IA implementation verification run is complete only when all are true.

- All 34 IA entries appear in the manifest.
- `doc-receipts.json` exists and passes `pnpm test:ia:docs`.
- `ia-manifest.json`, `source-map-results.json`, and `static-results.json` exist.
- `agent-dispatch-plan.json` exists and assigns every IA item to exactly one shard.
- Every phase JSON row for a final label has matching `runId`, `sourceCommit`,
  and `evidenceBundleId`.
- If child agents were used, every delegated shard has a task packet, imported
  result packet, valid IA result JSON row, and coordinator provenance record.
- If child agents were not used, `agent-integration-results.json` records
  `delegationMode: "single-session"` and still reviews every IA item by shard
  using the same IA result JSON schema.
- Every IA item has a route type.
- Every IA item has a final label.
- Every final label is computed in `ia-implementation-audit.json`.
- Every `page` route has direct URL and browser back evidence or a non-`PASS` label.
- Every protected route has logged-out and authenticated evidence or a non-`PASS` label.
- Admin routes have role-specific evidence or a non-`PASS` label.
- Owner-id routes have invalid, malformed, and wrong-owner id evidence or a non-`PASS` label.
- Auth-related IA items, auth route handlers, login/session/logout checks, and
  Public/Auth shard rows include `docs/development/auth-overview.md` receipts.
- Auth/RLS/backend-sensitive rows include `docs/development/backend-auth.md`
  receipts.
- Hosted modals and state surfaces have trigger evidence from host routes.
- Route handlers are checked separately from visible pages.
- Billing and notification deferred scope is respected.
- Every IA item has an AI UX review card.
- Every child-agent recommendation has a coordinator decision.
- No final `PASS` depends only on a child-agent recommendation.
- Every unresolved child-agent conflict has a non-`PASS` label.
- Security/data cross-cutting blockers prevent final `PASS` even when the
  primary IA shard recommends `PASS`.
- Human confirmation exists for every low-confidence, medium-confidence, high-risk, modal, form, AI-output, auth, billing, notification, admin, or policy-sensitive item.
- Human review judgments are not replaced by automation-only, AI-only, or
  `source: agent-note` evidence.
- Final report separates AI UX result, AI confidence, human confirmation, and final UX/UI result.
- Final report links or names the document receipt, static, browser, hosted-surface,
  security/navigation, AI UX, and human confirmation evidence.
- `pnpm test:ia:merge` and `pnpm test:ia:validate` pass, or the run is
  explicitly labeled `BLOCKED`.
- Handwritten Markdown changes never override JSON evidence or validation output.

## 15. Docs Consulted

- `.agents/superpowers/skills/using-superpowers/SKILL.md`
- `.codex/skills/gstack/document-generate/SKILL.md`
- `.codex/skills/writing-plans/SKILL.md`
- `.codex/skills/verification-before-completion/SKILL.md`
- `docs/agent-index.md`
- `docs/ai-development-workflow.md`
- `docs/ai-workflow/planning-contracts.md`
- `docs/ai-workflow/context-and-packets.md`
- `docs/ai-workflow/agent-packets.md`
- `docs/ai-workflow/review-gates.md`
- `docs/ai-workflow/fallback-and-recovery.md`
- `docs/ai-workflow/ia-ai-first-ux-review-checklist.md`
- `docs/ai-workflow/ia-page-implementation-verification.md`
- `docs/ai-workflow/context-ledger-template.md`
- `docs/ai-workflow/report-template.md`
- `docs/prd.md`
- `docs/spec.md`
- `docs/development/auth-overview.md`
- `docs/development/backend-auth.md`
- `docs/development/deferred-scope.md`
- `docs/IA/README.md`
- `docs/sitemap.md`
- `docs/flow/user-flow.md`
- `package.json`
- `src/lib/routes.ts`
- `tests/integration/route-matrix.test.ts`
- `tests/e2e/coverage/coverage-matrix.spec.ts`
- `tests/e2e/coverage/golden-path.spec.ts`
- `playwright.config.ts`
- NN/g 10 usability heuristics: `https://www.nngroup.com/articles/ten-usability-heuristics/`
- W3C WCAG Focus Order: `https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html`
- W3C WCAG Error Identification: `https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html`
- W3C WCAG Labels or Instructions: `https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html`
- W3C WCAG Reflow: `https://www.w3.org/WAI/WCAG22/Understanding/reflow.html`
- GOV.UK Design System error message: `https://design-system.service.gov.uk/components/error-message/`
- GOV.UK Design System error summary: `https://design-system.service.gov.uk/components/error-summary/`
- GOV.UK Design System question pages: `https://design-system.service.gov.uk/patterns/question-pages/`
- GOV.UK Service Standard solve a whole problem: `https://www.gov.uk/service-manual/service-standard/point-2-solve-a-whole-problem`
- Microsoft HAX human-AI interaction guidelines: `https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/`
- Google People + AI Guidebook: `https://pair.withgoogle.com/guidebook-v2/`

## 16. Extracted Requirements

- Active docs govern implementation and QA.
- Legacy docs are reference only.
- Current working IA inventory is 34 entries.
- Page completion requires user outcome, visual structure, data behavior, access rules, failure recovery, policy boundaries, and evidence.
- Route handlers are not visible pages and require separate verification.
- Public, user, and admin audiences must be checked separately.
- Direct URL, browser back, refresh, logout, invalid id, malformed id, wrong-owner id, and expired session scenarios must be covered or explicitly labeled.
- Deferred billing and notification transport must not be treated as implemented behavior.
- The full IA audit should be script-backed. Every phase should have input docs,
  a script or test gate, JSON output, `PASS` blocking rules, and a human-readable
  summary.
- Document-read receipts are required before an IA item can receive final `PASS`.
- Final labels must be computed or validated by scripts, not handwritten in Markdown.
- Every phase result should be machine-readable so the final report can be merged
  and validated.
- Phase 5 should use AI as the first UX readiness filter, then keep human confirmation for judgment-sensitive UX, copy, trust, and policy calls.
- Phase 2 to Phase 4 must collect AI-ready UX evidence so Phase 5 is based on rendered states, navigation scenarios, and recovery copy instead of source inspection alone.
- The final report must keep AI UX result, AI confidence, human confirmation, and final UX/UI result in separate fields.
- AI UX review must check human-AI control, explanation, uncertainty, retry/reject paths, and recovery states for recommendation, scoring, feedback, and analysis screens.
- Accessibility checks must include focus order, visible focus, labels or instructions, error identification, and responsive reflow evidence.
- Multi-agent review must be coordinated by the main session, not by hidden child-agent context.
- Every delegated IA shard requires a task packet before dispatch and a result packet before integration.
- Child agents may recommend labels, but the coordinator and validation scripts own final labels.
- The plan's task table or equivalent dispatch plan must say which work is subagent-eligible and why.
- Multi-agent IA audit artifacts must be run-isolated by `runId`; `latest`
  cannot be the direct write target for active runs.
- Child-agent results must be imported by the coordinator with provenance,
  hashes, source run, base commit, and IA-specific machine-readable result rows.
- Auth-related IA checks must use `docs/development/auth-overview.md` for
  current login, signup, callback, auth error, verify-email, password-reset,
  cooldown, and session-expiry behavior.
- Backend-auth, RLS, storage, server-only key, and role-boundary checks must use
  `docs/development/backend-auth.md`.
- Human confirmation must have real human provenance; AI-generated manual notes
  cannot unblock final `PASS`.

## 17. Doc Conflicts

- `docs/sitemap.md` still contains source-order prose saying the IA inventory is 32 screens.
- `docs/IA/README.md` currently lists 34 IA entries.
- Resolution: use the 34 folder entries plus the current sitemap route table as the working source and label stale 32-screen wording as `DOC-GAP`.

## 18. Untouched Relevant Docs

- Individual `docs/IA/*/description.md` files were not fully read during this planning step because this plan defines the execution method. Execution Phase 5 reads each page document when that IA item is reviewed.
- `docs/ant-design/README.md` should be read during Phase 5 before AI UX review and human UX/UI confirmation.

## 19. Context Ledger

- Ledger: `docs/ai-workflow/runs/2026/05/28/20260528-0814-ia-verification-execution-plan.md`
- Phase 5 AI-first update ledger: `docs/ai-workflow/runs/2026/05/28/20260528-0843-ai-first-ux-review-phase5.md`
- Phase 5 ripple alignment ledger: `docs/ai-workflow/runs/2026/05/28/20260528-0934-phase5-ripple-alignment.md`
- Script-backed audit plan ledger: `docs/ai-workflow/runs/2026/05/28/20260528-1000-script-backed-ia-audit-plan.md`
- Multi-agent IA audit plan ledger: `docs/ai-workflow/runs/2026/05/28/20260528-1027-multi-agent-ia-audit-plan.md`
- Follow-up plan review and GPT-5.5 debate ledger: `docs/ai-workflow/runs/2026/05/28/20260528-1040-ia-verification-plan-review.md`

## 20. Glossary

- IA: screen structure and screen-level requirements.
- Manifest: one machine-readable list of every IA item and its verification metadata.
- Hosted modal: modal opened from another route, not a standalone page.
- Route handler: server-side request handler, not a visible page.
- Direct URL: user opens a path directly from address bar, bookmark, or external link.
- Storage state: Playwright file that stores an authenticated browser session for tests.
- Fixture: fake or seeded data used for tests.
- CTA: the main action button.
- AI-first UX review: AI checks every IA item first and creates a focused list of UX risks for human confirmation.
- Human confirmation: a person reviews the AI-flagged judgment items before final `PASS`.
- Document receipt: per-IA proof that the agent read active docs and extracted requirements before judging implementation.
- IA shard: a small group of IA items assigned to one bounded reviewer lane.
- Task packet: the instruction sheet sent to a child agent before delegated review starts.
- Result packet: the evidence summary returned by a child agent after delegated review.
- Agent dispatch plan: the JSON file that says which IA items go to which reviewer lane.
- Coordinator decision: the main session's accepted, rejected, or escalated decision for a child-agent recommendation.
- Script-backed gate: a step where a script or test checks evidence and writes a JSON result.
- Final audit validator: the script that blocks impossible `PASS` labels before the report is accepted.
