# IA Implementation Verification - Artifacts And Contract

> Part of [IA Implementation Verification](./README.md). Output artifacts, JSON evidence contract, audit-flow monitor rules, and multi-agent dispatch contract.

Use this file directly only when your task matches the summary above.

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

### Canonical Run Binding

Every command in this plan must run against one audit directory by either setting
the environment variable or passing the directory explicitly:

```powershell
$env:IA_AUDIT_DIR = $auditDir
# or
pnpm <script> -- --audit-dir $auditDir
```

The current helper library may fall back to the newest
`reports/ia-verification/runs/*` directory when neither value is set. That
fallback is a local convenience only. It is not canonical for concurrent,
restarted, or resumed runs, and any run that relies on implicit newest-run
selection cannot support final `PASS`.

Historical helper scripts with hardcoded run ids, including `p4-*` helpers and
`merge-shard-cards.mjs`, are not canonical collectors unless rewritten to accept
the active `<auditDir>`.

| Artifact | Path | Purpose |
| --- | --- | --- |
| IA manifest builder | `scripts/audit-setup/build-ia-manifest.mjs` | Derive IA inventory, route types, audience, packs, and expected evidence from active docs. |
| IA manifest | `<auditDir>/ia-manifest.json` | Machine-readable IA inventory used by every later phase. |
| Source map validator | `scripts/audit-setup/validate-ia-source-map.mjs` | Compare manifest entries against `src/app/**`, `src/components/**`, and route handlers. |
| Source map result | `<auditDir>/source-map-results.json` | Machine-readable doc/code source-anchor result. |
| Document receipt builder | `scripts/audit-setup/build-doc-receipts.mjs` | Generate the `<auditDir>/doc-receipts.json` skeleton from the 34 IA folders, sitemap routes, wireframe existence, required active docs, and shard placeholders. |
| Document receipt validator | `scripts/audit-setup/verify-doc-receipts.mjs` | Verify that each IA item records active docs read and extracted requirements. |
| Document receipts | `<auditDir>/doc-receipts.json` | Per-IA proof of active docs consulted, extracted requirements, and doc conflicts. |
| Document receipt validation result | `<auditDir>/doc-receipt-validation-results.json` | Validator output for the document receipt gate. |
| IA static validator | `scripts/verify-ia-coverage.mjs` | Validate IA coverage using the manifest, source map, and document receipts. |
| Seed data planner | `scripts/audit-setup/build-seed-data-plan.mjs` | Derive deterministic Supabase seed preconditions from the IA manifest, source map, and E2E catalog needs. |
| Seed data plan | `<auditDir>/seed-plan.json` | Machine-readable seed preconditions for protected, admin, owner-id, hosted-surface, empty/error/success, and RLS-sensitive scenarios. |
| Seed data verifier | `scripts/audit-setup/verify-seed-data.mjs` | Create or verify dev/preview-only Supabase seed actors and rows, and refuse production or unknown targets. |
| Seed data result | `<auditDir>/seed-results.json` | Machine-readable seed run id, target classification, actor ids, seeded row ids, status, and seed blockers. |
| E2E catalog | `tests/e2e/coverage/ia-catalog.ts` | Single test catalog for 34 IA entries plus hosted surfaces and route handlers. |
| Static IA result | `<auditDir>/static-results.json` | Machine-readable doc/code sync result. |
| Browser result | `<auditDir>/browser-results.json` | Playwright evidence summary. |
| Hosted surface result | `<auditDir>/hosted-surface-results.json` | Modal, toast, loading, autosave, export, and host-route evidence summary. |
| Security/navigation result | `<auditDir>/security-navigation-results.json` | Direct URL, role, owner, session, logout, and back/refresh checks. |
| Agent dispatch planner | `scripts/audit-setup/build-agent-dispatch-plan.mjs` | Create and validate IA shard assignments from the manifest. |
| Agent dispatch plan | `<auditDir>/agent-dispatch-plan.json` | IA shard assignment, concurrency limit, packet paths, and escalation rules. |
| Audit flow monitor result | `<auditDir>/audit-flow-monitor.json` | Machine-readable checkpoints for run order, collector attempts, phase transitions, and premature `BLOCKED` or `PASS` checks. |
| Audit flow monitor notes | `<auditDir>/audit-flow-monitor.md` | Human-readable monitor notes generated from or linked to `audit-flow-monitor.json`. |
| Agent task packets | `<auditDir>/agent-packets/tasks/*.md` | Per-shard instructions prepared before delegated review starts. |
| Agent result packets | `<auditDir>/agent-packets/results/*.md` | Per-shard result packets imported by the coordinator from child-agent responses. |
| Agent IA result JSON | `<auditDir>/agent-packets/results/*.json` | Per-shard machine-readable IA result rows validated before integration. |
| Agent integration result | `<auditDir>/agent-integration-results.json` | Coordinator merge result for delegated findings, conflicts, provenance, and unresolved packet gaps. |
| AI UX checklist | `docs/ai-workflow/ia-ai-first-ux-review-checklist.md` | Phase 5 AI-first UX review standard. |
| AI UX review result | `<auditDir>/ai-ux-review.json` | Machine-readable IA-by-IA AI first-pass UX readiness result. |
| AI UX review notes | `<auditDir>/ai-ux-review.md` | Human-readable AI UX review notes generated from JSON. |
| GPT-5.5 adjudication result | `<auditDir>/manual-review.json` | Legacy-compatible path containing machine-readable independent GPT-5.5 UX/UI and policy judgment results. |
| GPT-5.5 adjudication notes | `<auditDir>/manual-review.md` | Human-readable adjudication notes generated from or linked to JSON. |
| Audit result merger | `scripts/merge-ia-audit-results.mjs` | Merge all phase JSON files and compute final labels. |
| Final audit validator | `scripts/validate-ia-audit-report.mjs` | Fail when final labels violate document, evidence, AI, GPT-5.5 adjudication, or security gates. |
| Final audit JSON | `<auditDir>/ia-implementation-audit.json` | Computed IA-by-IA final result. |
| Final audit report | `<auditDir>/ia-implementation-audit.md` | Human-readable IA-by-IA result table generated from final JSON. |

Compatibility note: current scripts may still expose legacy names such as
`manualReview`, `humanConfirmation`, or required evidence input
`human-confirmation`. Under this plan those names mean independent GPT-5.5
adjudication until the scripts are renamed. Do not interpret them as a real-human
provenance requirement.

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
feed one final label. If source files, active docs, seed preconditions, or
evidence inputs change after Phase 1.5 to Phase 4 evidence is generated, the
affected rows are stale and cannot support final `PASS` until regenerated or
explicitly downgraded.

Seed-data rows must also include:

- `seedRunId`,
- `targetEnvironment`,
- `targetClassification`,
- `seedMode`,
- `seededActors`,
- `seededRows`,
- `seedPreconditions`,
- `seedStatus`,
- `seedBlockingReasons`.

Seed data is setup evidence only. A seed row may prove that a browser or
security scenario had the required Supabase actor and target records available,
but it cannot prove rendered page behavior, authorization behavior, or final
`PASS` by itself. Seed actors must have matching `auth.users.id` and
`profiles.id` values, and role truth must come from `profiles.app_role`, not
auth metadata.

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
required GPT-5.5 adjudication that is absent.

Missing evidence may produce `BLOCKED`, but only after the relevant collector has
been attempted at least once or the run records why that collector cannot run.
Do not mark a whole phase or all IA rows `BLOCKED` only because one evidence
class is absent. Collect available evidence first, separate unavailable evidence,
and record the unavailable precondition in `audit-flow-monitor.json`.

`audit-flow-monitor.json` must include, per checkpoint:

- `runId`,
- `phase`,
- `expectedArtifacts`,
- `collectorAttempts`,
- `availableEvidenceCollected`,
- `unavailableEvidence`,
- `prematureBlockedCheck`,
- `prematurePassCheck`,
- `monitorStatus`,
- `blockingReasons`,
- `coordinatorResponse`,
- `generatedAt`.

Valid `monitorStatus` values are `PASS`, `CONCERN_ACCEPTED`, and `FAIL`.
`FAIL` blocks the next phase transition until the coordinator either collects the
missing available evidence or records a concrete impossible precondition.

### Identifier Definitions

Every script that writes JSON rows must compute these identifiers the same way.
The merger and validator rely on byte-equality of the resulting strings, so
ambiguous calculations would create false positives or false negatives at
Phase 6.

- `sourceCommit`: output of `git rev-parse HEAD` captured at collector start.
- `dirtyState`: `clean` when `git status --porcelain --untracked-files=all`
  is empty at collector start; otherwise `dirty`. Record the literal string.
- `evidenceBundleId`: SHA-256 of the canonical Phase 0.5 to Phase 4 evidence
  rows, including Phase 1.5 seed rows where applicable, that feed a final label,
  sorted by `phase`, `iaCode`, and
  `routeOrHostRoute`, excluding volatile fields (`generatedAt`,
  `evidenceBundleId`) and excluding derived report files. The evidence freeze
  step (see [execution order step 13](./05-execution-order-and-reference.md))
  computes this value once and writes it into every
  downstream Phase 5 and Phase 6 row. Phase 0.5 to Phase 4 rows hold the
  placeholder value `pre-freeze` until the freeze step rewrites them.
- Automation gap (2026-06-01): the current helper implementation computes a
  coarse fingerprint from `runId`, `sourceCommit`, and `dirtyState`. That is not
  sufficient for this contract. Until canonical row hashing and evidence freeze
  are implemented, the current `evidenceBundleId` cannot by itself prove that
  upstream evidence stayed unchanged.
- `resultPacketHash`: SHA-256 of the exact coordinator-imported result packet
  payload. For JSON packets, hash canonical JSON (sorted keys, no insignificant
  whitespace). For Markdown packets, hash the imported UTF-8 bytes and record
  `hashInput: "markdown-bytes"`.

### Audit Flow Monitor Contract

Every IA audit run must have an audit flow monitor lane. Prefer an independent
read-only child agent when the runtime permits it. If child agents are not
available, the coordinator must run the same checklist in single-session mode and
record `monitorMode: "single-session-degraded"` in `audit-flow-monitor.json`.

`monitorMode` describes only the audit flow monitor lane. IA shard execution
mode is recorded separately in `agent-dispatch-plan.json` and
`agent-integration-results.json` through `delegationMode`, shard provenance,
and single-session rows. If the monitor actor changes mid-run, record
`monitorActorMode` per checkpoint rather than changing the global `monitorMode`
to a synthetic value such as `mixed`.

The monitor is read-only. It does not edit phase evidence and does not finalize
labels. It checks whether the coordinator is following the plan before each
phase transition.

The monitor asks these questions at every checkpoint:

- What artifact should this phase create?
- Did the relevant collector run or get an explicit impossible-precondition row?
- Did the collector write JSON, not only prose?
- Are available and unavailable evidence separated?
- Is any `BLOCKED` being assigned before collector attempts are recorded?
- Is any `PASS` being assigned from prose, agent opinion, or incomplete JSON?
- Did final merge use JSON evidence only?

Collector-first examples:

- Missing `doc-receipts.json`: run or create the document-receipt collector
  before marking document evidence `BLOCKED`.
- Missing auth storage states: still collect public-route browser evidence; mark
  only protected or admin auth-state evidence `BLOCKED`.
- Missing seed data: still collect public-route and seed-independent evidence;
  mark only seed-dependent protected, admin, owner-id, hosted-surface,
  empty/error/success, or RLS-sensitive scenarios `BLOCKED` after the seed
  collector attempt is recorded.
- Missing GPT-5.5 adjudication: still run the AI UX review; mark only the
  required adjudication field `BLOCKED`.
- Missing browser evidence: attempt Playwright or record the environment blocker;
  do not convert every route to `BLOCKED` without per-route attempt status.

### Multi-Agent Dispatch Contract

Multi-agent review is part of the execution plan, not an optional side note. The
coordinator may run up to six child agents concurrently when the evidence bundle
can be split by IA shard. Do not spawn one child agent for all 34 IA items by
default, and do not spawn 34 agents at once by default.

Dispatch planning and child-agent spawning are separate steps:

- Phase 1 creates the shard assignment, concurrency plan, expected packet paths,
  and escalation rules.
- Phase 1.5 to Phase 4 generate the seed and behavior evidence bundle that
  shard reviewers need.
- Phase 5 validates that each shard's `requiredEvidenceInputs` exist, then
  creates final task packets and spawns child agents.

Do not spawn IA shard reviewers before required browser, hosted-surface, and
security/navigation evidence either exists or is explicitly labeled `BLOCKED`.
That `BLOCKED` label must be backed by `audit-flow-monitor.json` showing the
collector attempt or impossible precondition.

The audit flow monitor is separate from IA shard review. It may run in parallel
with the coordinator and automation owner, but it is not a primary IA shard and
cannot replace shard review, security review, AI UX review, or GPT-5.5
adjudication.

The monitor lane sits outside the IA shard count, but it stays inside the
global child-agent concurrency cap. When the monitor runs as an independent
child agent concurrently with shard reviewers, run at most five IA shard agents
at the same time, or run the monitor checkpoint before or after the six-shard
batch. Do not exceed six concurrent child agents in total.

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
`docs/ai-workflow/contracts/agent-packets.md`. The task packet must tell the child agent:

- which IA codes it owns,
- which docs and evidence it must read,
- which files it may write,
- which files it must not touch,
- which checks it must run or inspect,
- which IA result JSON schema or structured JSON block it must return,
- that it may recommend labels but cannot finalize `PASS`.

Every child agent must return a result packet using
`docs/ai-workflow/contracts/agent-packets.md`. The result packet must include, per IA item:

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
  "test:ia:receipts": "node scripts/audit-setup/build-doc-receipts.mjs",
  "test:ia:docs": "node scripts/audit-setup/verify-doc-receipts.mjs",
  "test:ia:source-map": "node scripts/audit-setup/validate-ia-source-map.mjs",
  "test:ia:dispatch": "node scripts/audit-setup/build-agent-dispatch-plan.mjs",
  "test:ia:static": "node scripts/verify-ia-coverage.mjs",
  "test:ia:seed-plan": "node scripts/audit-setup/build-seed-data-plan.mjs",
  "test:ia:seed": "node scripts/audit-setup/verify-seed-data.mjs",
  "test:ia:storage-state": "node scripts/audit-setup/build-storage-state.mjs",
  "test:e2e:ia": "playwright test tests/e2e/coverage",
  "test:ia:browser-results": "node scripts/audit-setup/build-browser-results.mjs",
  "test:ia:hosted-surface-results": "node scripts/audit-setup/build-hosted-surface-results.mjs",
  "test:ia:security-navigation-results": "node scripts/audit-setup/build-security-navigation-results.mjs",
  "test:ia:merge": "node scripts/merge-ia-audit-results.mjs",
  "test:ia:validate": "node scripts/validate-ia-audit-report.mjs",
  "test:ia:html-report": "node scripts/audit-setup/build-html-report.mjs"
}
```
