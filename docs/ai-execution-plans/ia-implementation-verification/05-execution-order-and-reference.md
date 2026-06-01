# IA Implementation Verification - Execution Order And Reference

> Part of [IA Implementation Verification](./README.md). Execution order, completion gate, docs consulted, extracted requirements, known doc conflicts, ledgers, and glossary.

Use this file directly only when your task matches the summary above.

## 13. Execution Order

Run the process in this order.

### Canonical Command Binding

Before running phase commands:

```powershell
$runId = Get-Date -Format "yyyyMMdd-HHmmss"
$auditDir = "reports/ia-verification/runs/$runId"
New-Item -ItemType Directory -Force $auditDir
$env:IA_AUDIT_DIR = $auditDir
```

Commands may alternatively pass `-- --audit-dir $auditDir`. Do not rely on the
helper library's implicit newest-run fallback for a final audit.

Concrete command sequence:

```powershell
pnpm test:ia:receipts -- --audit-dir $auditDir
pnpm test:ia:docs -- --audit-dir $auditDir
pnpm test:ia:manifest -- --audit-dir $auditDir
pnpm test:ia:source-map -- --audit-dir $auditDir
pnpm test:ia:dispatch -- --audit-dir $auditDir
pnpm test:ia:static -- --audit-dir $auditDir
pnpm test:ia:seed-plan -- --audit-dir $auditDir
pnpm test:ia:seed -- --audit-dir $auditDir
pnpm test:ia:storage-state -- --audit-dir $auditDir
pnpm exec playwright test tests/e2e/coverage/coverage-matrix.spec.ts
pnpm test:ia:browser-results -- --audit-dir $auditDir
pnpm exec playwright test tests/e2e/coverage/hosted-surfaces.spec.ts
pnpm test:ia:hosted-surface-results -- --audit-dir $auditDir
pnpm exec playwright test tests/e2e/coverage/session-navigation.spec.ts tests/e2e/coverage/auth-route-handlers.spec.ts
pnpm test:ia:security-navigation-results -- --audit-dir $auditDir
pnpm test:ia:merge -- --audit-dir $auditDir
pnpm test:ia:validate -- --audit-dir $auditDir
pnpm test:ia:html-report -- --audit-dir $auditDir
```

Playwright output must be discoverable by the matching result-builder command.
If it is not, record the collector attempt and mark only the affected evidence
rows `BLOCKED`.

1. Phase 0: preparation.
2. Initialize the audit flow monitor and record the first checkpoint.
3. Phase 0.5: document receipt gate.
4. Monitor checkpoint: document collector attempted, document receipt output or
   impossible precondition recorded.
5. Phase 1: manifest, static sync, and agent dispatch plan with expected shard
   assignments and expected packet paths only.
6. Monitor checkpoint: static/source collectors attempted and JSON outputs
   recorded.
7. Phase 1.5: Supabase seed-data gate for dev/preview-only seed
   preconditions.
8. Monitor checkpoint: seed collector attempted and seed output or seed blocker
   recorded.
9. Phase 2: page browser matrix.
10. Phase 3: hosted surface checks.
11. Phase 4: security, session, and external entry.
12. Monitor checkpoint: browser, hosted-surface, and security collectors
    attempted; available evidence separated from unavailable evidence.
13. Evidence bundle freeze: verify `runId`, `sourceCommit`, `dirtyState`, and
   `evidenceBundleId`; mark missing inputs `BLOCKED` only when collector attempts
   or impossible preconditions are recorded.
14. Multi-agent dispatch decision: create task packets and spawn IA shard agents,
   or record `delegationMode: "single-session"` and write single-session IA
   result rows.
15. Monitor checkpoint: shard inputs, AI UX inputs, and GPT-5.5 adjudication gaps
    are separated before Phase 5 result labels are merged.
16. Phase 5: IA shard result packets, IA result JSON import, AI-first UX/UI
   review, and GPT-5.5 adjudication.
17. Phase 6: report assembly and final validation.
18. Re-run Phase 0.5 to Phase 4, including Phase 1.5 seed rows, after any
   implementation, seed-input, or document-source fixes.
19. Re-run Phase 5 only for changed pages, unresolved AI findings, unresolved
    GPT-5.5 adjudication judgments, or changed shard packets.
20. Re-run Phase 6 after any upstream result changes.

### Partial Rerun Carry-Over Rule

A Phase 5 row may be reused only when every Phase 0.5 to Phase 4 row, including
Phase 1.5 seed rows where applicable, feeding that same IA final label is either
carried over from the same `sourceRunId`, `sourceCommit`, and
`evidenceBundleId`, or the current run proves the upstream canonical row hashes
are unchanged.

Record reuse in `<auditDir>/carryover-map.json` with one entry per reused IA
item containing `iaCode`, `carryoverFromRunId`, `sourceEvidenceBundleId`,
`currentRunId`, `reuseReason`, and `upstreamRowHashStatus`.

Do not merge an old Phase 5 row with newly generated upstream evidence for the
same IA item. Mixed `runId` or `evidenceBundleId` values are allowed across
different IA items in one report only when each IA item has an internally
consistent evidence bundle and an explicit carry-over record. The final
validator (`pnpm test:ia:validate`) must fail when any IA item mixes upstream
runs without a matching `carryover-map.json` entry.

## 14. Completion Gate

The IA implementation verification run is complete only when all are true.

- All 34 IA entries appear in the manifest.
- `audit-flow-monitor.json` exists and has no unresolved `FAIL` checkpoints.
- Every final `BLOCKED` caused by missing evidence has a matching collector
  attempt or impossible precondition in `audit-flow-monitor.json`.
- `doc-receipts.json` exists and passes `pnpm test:ia:docs`.
- `ia-manifest.json`, `source-map-results.json`, and `static-results.json` exist.
- `agent-dispatch-plan.json` exists and assigns every IA item to exactly one shard.
- `seed-plan.json` and `seed-results.json` exist, or every seed-dependent row
  has a non-`PASS` label with a recorded seed collector attempt or impossible
  precondition.
- Every seed-dependent final `PASS` has a valid `seedRunId`, matching seed row,
  matching `profiles` row, expected `profiles.app_role`, and required owner,
  wrong-owner, admin target, or state-specific row ids.
- Public routes and seed-independent checks are not blocked solely because seed
  data is missing.
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
- GPT-5.5 adjudication exists for every low-confidence, medium-confidence,
  high-risk, modal, form, AI-output, auth, billing, notification, admin, or
  policy-sensitive item.
- GPT-5.5 adjudication judgments are not replaced by automation-only,
  same-session AI-only, or `source: agent-note` evidence.
- Final report separates AI UX result, AI confidence, GPT-5.5 adjudication, and final UX/UI result.
- Final report links or names the document receipt, static, seed, browser,
  hosted-surface, security/navigation, AI UX, and GPT-5.5 adjudication evidence.
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
- `docs/ai-workflow/contracts/agent-packets.md`
- `docs/ai-workflow/review-gates.md`
- `docs/ai-workflow/fallback-and-recovery.md`
- `docs/ai-workflow/ia-ai-first-ux-review-checklist.md`
- `docs/ai-workflow/ia-page-implementation-verification.md`
- `docs/ai-workflow/templates/context-ledger-template.md`
- `docs/ai-workflow/templates/report-template.md`
- `docs/prd.md`
- `docs/spec.md`
- `docs/development/auth-overview.md`
- `docs/development/backend-auth.md`
- `docs/development/database-schema.md`
- `docs/development/environments.md`
- `docs/development/deferred-scope.md`
- `docs/Wireframe/README.md`
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
- Missing evidence may become `BLOCKED` only after the matching collector is
  attempted or an impossible precondition is recorded.
- Every IA verification run needs an audit flow monitor lane. If no independent
  child agent is available, the coordinator must run the same monitor checklist
  in `single-session-degraded` mode.
- Final labels must be computed or validated by scripts, not handwritten in Markdown.
- Every phase result should be machine-readable so the final report can be merged
  and validated.
- Phase 5 should use AI as the first UX readiness filter, then delegate
  judgment-sensitive UX, copy, trust, and policy calls to an independent GPT-5.5
  adjudicator.
- Phase 1.5 to Phase 4 must collect seed preconditions and AI-ready UX evidence
  so Phase 5 is based on rendered states, navigation scenarios, and recovery
  copy instead of source inspection alone.
- The final report must keep AI UX result, AI confidence, GPT-5.5 adjudication,
  and final UX/UI result in separate fields.
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
- Data-backed IA checks need Supabase seed preconditions for actors, profiles,
  roles, owner records, wrong-owner records, admin targets, and RLS-sensitive
  rows before browser or security evidence can support final `PASS`.
- Seed data proves only that test preconditions exist. It cannot replace
  rendered browser evidence, route-handler evidence, authorization evidence, or
  final validator output.
- Supabase seed work must be limited to safe dev/preview targets; production and
  unknown targets are blockers.
- Role evidence must be read from `profiles.app_role`, with matching
  `auth.users.id` and `profiles.id`.
- GPT-5.5 adjudication must have independent delegated-review provenance;
  same-session AI-generated notes cannot unblock final `PASS`.

## 17. Doc Conflicts

- `docs/sitemap.md` still contains source-order prose saying the IA inventory is 32 screens.
- `docs/Wireframe/README.md` currently lists 34 IA entries.
- Resolution: use the 34 folder entries plus the current sitemap route table as the working source and label stale 32-screen wording as `DOC-GAP`.
- `docs/development/environments.md` documents a non-audit break-glass force flag
  for production/unknown seeding. IA audit evidence forbids that path. Any seed
  or storage-state artifact created with a production or unknown-target override
  is non-audit evidence and blocks final `PASS`.
- Current automation gaps are execution blockers, not permission to lower the
  audit contract: the validator enforces only a subset of this plan,
  `evidenceBundleId` is currently a coarse run fingerprint, and historical
  helper scripts with hardcoded run ids are not canonical collectors.
- Legacy script fields such as `manualReview`, `humanConfirmation`, and
  `human-confirmation` now map to GPT-5.5 adjudication for this plan until the
  scripts are renamed.

## 18. Untouched Relevant Docs

- Individual `docs/Wireframe/*/description.md` files were not fully read during this
  planning step because this plan defines the execution method. During
  execution, Phase 0.5 records each matching `description.md` path, existence,
  receipt inclusion, and minimum extracted implementation requirements
  (see Step 0.5.1 and Step 0.5.2). Phase 5 then rereads the full body for
  rendered UX review and the no-pass checks in Step 5.3.
- `docs/ant-design/README.md` should be read during Phase 5 before AI UX review and GPT-5.5 UX/UI adjudication.

## 19. Context Ledger

- Ledger: `docs/ai-workflow/runs/2026/05/28/20260528-0814-ia-verification-execution-plan.md`
- Phase 5 AI-first update ledger: `docs/ai-workflow/runs/2026/05/28/20260528-0843-ai-first-ux-review-phase5.md`
- Phase 5 ripple alignment ledger: `docs/ai-workflow/runs/2026/05/28/20260528-0934-phase5-ripple-alignment.md`
- Script-backed audit plan ledger: `docs/ai-workflow/runs/2026/05/28/20260528-1000-script-backed-ia-audit-plan.md`
- Multi-agent IA audit plan ledger: `docs/ai-workflow/runs/2026/05/28/20260528-1027-multi-agent-ia-audit-plan.md`
- Follow-up plan review and GPT-5.5 debate ledger: `docs/ai-workflow/runs/2026/05/28/20260528-1040-ia-verification-plan-review.md`
- Supabase seed-data plan review ledger: `docs/ai-workflow/runs/2026/06/01/20260601-0924-ia-seed-data-plan-review.md`
- IA verification plan review ledger: `docs/ai-workflow/runs/2026/06/01/20260601-1036-ia-verification-plan-review.md`
- IA verification plan consensus update ledger: `docs/ai-workflow/runs/2026/06/01/20260601-1109-ia-verification-plan-consensus-update.md`

## 20. Glossary

- IA: screen structure and screen-level requirements.
- Manifest: one machine-readable list of every IA item and its verification metadata.
- Hosted modal: modal opened from another route, not a standalone page.
- Route handler: server-side request handler, not a visible page.
- Direct URL: user opens a path directly from address bar, bookmark, or external link.
- Storage state: Playwright file that stores an authenticated browser session for tests.
- Seed data: deterministic Supabase records created or verified in dev/preview
  targets so a browser or security scenario has the required actor and data
  preconditions.
- Seed evidence: JSON proof that seed preconditions were created or verified;
  it does not prove page behavior, authorization behavior, or final `PASS`.
- Fixture: fake or seeded test data used by automation. For this plan, database
  fixtures that affect auth, owner, admin, or RLS checks must go through the
  seed-data gate.
- CTA: the main action button.
- AI-first UX review: AI checks every IA item first and creates a focused list of UX risks for GPT-5.5 adjudication.
- GPT-5.5 adjudication: an independent GPT-5.5 session or child agent reviews the AI-flagged judgment items before final `PASS`.
- Document receipt: per-IA proof that the agent read active docs and extracted requirements before judging implementation.
- IA shard: a small group of IA items assigned to one bounded reviewer lane.
- Task packet: the instruction sheet sent to a child agent before delegated review starts.
- Result packet: the evidence summary returned by a child agent after delegated review.
- Agent dispatch plan: the JSON file that says which IA items go to which reviewer lane.
- Coordinator decision: the main session's accepted, rejected, or escalated decision for a child-agent recommendation.
- Script-backed gate: a step where a script or test checks evidence and writes a JSON result.
- Final audit validator: the script that blocks impossible `PASS` labels before the report is accepted.
