# IA Remediation Multi-Agent Plan: Human Review, Flow, Specialists, And Conflicts

## Delegated Human Confirmation

Use this section when the profile row has `humanConfirmationRequired: true` or required evidence includes `human-confirmation-record`.

The default path is delegated review by a separate GPT-5.5 reviewer agent. The coordinator must still record that the user delegated this authority for the run. If there is no user delegation record, the item remains in the `manual-human` lane until the user supplies one or the coordinator marks the item `blocked_terminal`.

The delegated reviewer must be independent:

- It must be a separate GPT-5.5 session from the IA execution agent.
- It must not be the agent that implemented or refreshed the IA evidence.
- It must not be the reconciliation final verifier.
- It must be read-only.
- It must receive a bounded task packet from the coordinator.

The task packet must include:

- `delegationSource`: user message, run policy, or handoff note that authorizes GPT-5.5 delegated human confirmation
- `delegatedReviewerModel`: `gpt-5.5`
- `iaCode`
- `screenName`
- `routeOrHostRoute`
- `humanConfirmationQuestion`
- `requiredHumanEvidence`
- `deferredScopeGuards`
- `sourceDocs`
- `evidenceFiles`
- `screenshotsOrManualArtifacts`
- `decisionOptions`: `PASS`, `FAIL`, `BLOCKED`, or `DEFERRED`
- `mustNotDecide`: items outside the exact human-confirmation question

The delegated reviewer result packet must include:

- `delegationAccepted`: yes/no with the delegation source
- `modelUsed`
- `iaCode`
- `questionAnswered`
- `decision`: `PASS`, `FAIL`, `BLOCKED`, or `DEFERRED`
- `evidenceReviewed`
- `rationale`
- `limitations`
- `residualRisk`
- `reviewedAt`
- `reviewerId`

Closure rules:

- `PASS` may satisfy `human-confirmation-record` only when `delegationAccepted` is yes, `modelUsed` is GPT-5.5, evidence reviewed is listed, and the decision directly answers the packet question.
- `FAIL` moves the IA item to `requeue_requested` or `blocked_terminal` with owner and reason.
- `BLOCKED` keeps the IA item in `manual-human` or `blocked_terminal` with the missing prerequisite.
- `DEFERRED` can close the current IA only when the plan allows `carried-forward` and the item records owner, risk, due trigger, affected IA list, and required evidence.
- A generic AI judgment, self-review, code review, or final-verifier note cannot satisfy `human-confirmation-record`.

## Cross-IA Flow Handling

When one IA fix affects another IA or a page-to-page transition, create a cross-IA lifecycle item:

The coordinator must maintain `<auditRunDirectory>/cross-ia-lifecycle-items.json`.

Required top-level fields:

- `schemaVersion`
- `runId`
- `sourceCommit`
- `createdAt`
- `updatedAt`
- `items`

Required fields per cross-IA item:

- `crossIaId`
- `sourceIaCode`
- `targetIaCodes`
- `routeOrHostRoute`
- `trigger`
- `state`
- `owner`
- `createdAt`
- `updatedAt`
- `agingDueAt`
- `evidence`
- `linkedQueueItemIds`
- `affectedPacketPaths`
- `risk`
- `dueTrigger`
- `requiredEvidenceBeforeClosure`
- `resolution`
- `finalDisposition`
- `carriedForwardReason`

The monitor and final verifier must read this artifact through the run state's `crossIaLifecyclePath`. A queue item affected by a cross-IA item cannot close unless the matching cross-IA item is represented in this file.

| State | Meaning |
| --- | --- |
| `proposed` | A specialist or IA execution agent identified the impact. |
| `approved` | Coordinator accepted it as in scope for the current run. |
| `queued-revisit` | Affected IA must be reopened or checked after the current fix. |
| `applied` | The implementation or docs change was made. |
| `evidence-regenerated` | Audit or test evidence was refreshed for every affected IA. |
| `closed` | Final verifier accepted the evidence. |
| `rejected` | Coordinator rejected the item with rationale. |
| `carried-forward` | Coordinator accepted that the item cannot close in the current run and recorded owner, risk, affected IA, due trigger, and evidence needed. |

Cross-IA items must record source IA, target IA, route or host route, evidence, owner, and final disposition.

`carried-forward` is allowed only when it is outside the accepted scope of the current IA task or blocked by a documented prerequisite. It must include a named owner, explicit risk, due trigger, affected IA list, and the evidence required before closure.

Operational rules:

- `approved` and `queued-revisit` must create or update queue items immediately.
- `approved`, `queued-revisit`, and `applied` cannot remain open when an affected IA item closes.
- A run may close with `carried-forward` only when each item has owner, risk, due trigger, affected IA list, and required evidence.
- `carried-forward` is a run-level decision, not an IA execution-agent decision.

Allowed cross-IA lifecycle transitions:

| From | To |
| --- | --- |
| `proposed` | `approved`, `rejected`, `carried-forward` |
| `approved` | `queued-revisit`, `rejected`, `carried-forward` |
| `queued-revisit` | `applied`, `rejected`, `carried-forward` |
| `applied` | `evidence-regenerated`, `rejected`, `carried-forward` |
| `evidence-regenerated` | `closed`, `rejected`, `queued-revisit` |
| `closed` | none |
| `rejected` | none |
| `carried-forward` | `queued-revisit` only after the due trigger occurs and a coordinator-authored packet exists |

Closure guards:

- An affected IA item cannot close while any related cross-IA item is `proposed`, `approved`, `queued-revisit`, `applied`, or `evidence-regenerated`.
- `carried-forward` is allowed only when the item is outside the accepted scope or blocked by a documented prerequisite.
- The final verifier must compare cross-IA items against run state and reject closure if an open impact is missing an owner, risk, due trigger, affected IA list, or required evidence.

## Flow-Edge Gate

For page-to-page and hosted-surface flow changes, final closure requires:

- `<auditRunDirectory>/flow-edge-manifest.json`
- `<auditRunDirectory>/flow-edge-results.json`
- Command output for the flow-edge validation command.

Current prerequisite warning: `pnpm test:ia:flow-edges` and `scripts/audit-setup/validate-flow-edges.mjs` are not established by this document. If they are absent, flow-edge remediation remains `BLOCKED` or must be scoped to documented manual evidence.

Manual fallback artifact:

- Path: `<auditRunDirectory>/manual-flow-edge-evidence.json`
- Required fields:
  - `flowEdgeId`
  - `sourceIaCode`
  - `targetIaCode`
  - `route`
  - `hostRoute`
  - `trigger`
  - `scenario`
  - `steps`
  - `viewport`
  - `authRole`
  - `storageStateArtifact`
  - `expectedResult`
  - `actualResult`
  - `label`
  - `evidenceFiles`
  - `consoleLogFiles`
  - `reviewer`
  - `reviewedAt`
  - `limitations`
  - `verifierDisposition`

Manual flow-edge evidence may close only the scoped flow-edge gap. It must not upgrade unrelated `BLOCKED` security, storage, owner, RBAC, or fixture evidence to `PASS`.

Command-specific fallback policy:

| Command or evidence | Manual fallback allowed? | Closure boundary |
| --- | --- | --- |
| `pnpm test` | No for behavior changes. | Block unless an equivalent focused test command is listed and passes. |
| `pnpm test:e2e` | Degraded only with owner acceptance. | Cannot close security, navigation, auth, owner, storage, or RBAC evidence. |
| `pnpm test:ia:flow-edges` | Yes, only with `<auditRunDirectory>/manual-flow-edge-evidence.json`. | Closes only the scoped flow-edge gap named in the artifact. |
| Storage, owner, RBAC, auth, service-role, or fixture evidence | No generic fallback. | Block unless this plan defines a specific artifact schema and final verifier accepts it. |
| Browser/visual evidence | Degraded only with screenshots, browser console logs, and manual steps listed in the packet. | Cannot close auth, data ownership, or security evidence. |

The final verifier must reject any IA closure that uses generic notes, chat summaries, or unstructured manual observations as substitute evidence for commands or fixtures listed above.

Supabase fixture evidence uses `<auditRunDirectory>/supabase-fixture-manifest.json` as its artifact schema. A screenshot, browser-only observation, manual note, or delegated human-confirmation record cannot replace missing auth, owner, storage, RBAC, service-role, RLS, or fixture evidence.

## Specialist Routing

Use [ia-review-profile-map.json](./review-profiles/ia-review-profile-map.json) for minimum routing.

The IA execution agent may request additional specialists when evidence reveals:

- Data ownership, role, token, PII, or storage risk.
- Hosted modal/state behavior.
- Form, validation, retry, or error-recovery risk.
- AI analysis, recommendation, feedback, report, or async-state risk.
- Deferred billing, notification transport, email, rate-limit, audit, or policy risk.

Specialists are read-only by default. Implementation work stays with the IA execution agent unless the coordinator assigns a bounded write scope.

## Write Lock Registry

The coordinator must maintain `<auditRunDirectory>/write-lock-registry.json`.

Required fields per lock:

- `lockId`
- `clusterId`
- `owner`
- `paths`
- `routeOrHostRoute`
- `iaCodes`
- `status`
- `claimedAt`
- `releasedAt`
- `preimageHashes`

Shared lock clusters must cover:

- Hosted route clusters, such as writing routes plus `D-M1`, `D-M2`, and `D-M3`.
- Export clusters, such as `/library`, feedback routes, report routes, and `F-M1`.
- Shared components.
- Shared tests.
- Route middleware.
- Auth utilities.
- Audit scripts.
- Report-generation scripts.

No two active queue items may hold overlapping paths or cluster IDs. If overlap is discovered after dispatch, the second lease is reclaimed and the item moves to `requeue_requested` or `blocked_terminal`.

## Write Conflict Rules

- The coordinator owns shared queue and ledger files.
- One IA execution agent owns one IA write scope at a time.
- Shared components, shared tests, route middleware, auth utilities, and audit scripts require coordinator approval before edit.
- If a claimed write-scope file changed since the task packet preimage hash, the IA execution agent stops and reports a conflict.
- Pre-existing dirty files must be classified during Phase 0 as baseline dirty, run-owned, or out of scope.
- Untracked files require explicit ownership before they are included in a write scope.
- Do not revert unrelated dirty worktree changes.
