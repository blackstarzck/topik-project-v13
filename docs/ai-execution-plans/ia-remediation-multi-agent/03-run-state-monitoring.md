# IA Remediation Multi-Agent Plan: Run State And Monitoring

## Run State And Queue Artifact

The coordinator must maintain `<auditRunDirectory>/remediation-run-state.json`.

Required top-level fields:

- `runId`
- `sourceCommit`
- `createdAt`
- `updatedAt`
- `schemaVersion`
- `queue`
- `activeClaims`
- `crossIaLifecyclePath`
- `retryPolicy`
- `dispatchBudget`
- `coordinatorHeartbeatAt`
- `coordinatorOwner`
- `terminalSummary`

Queue item fields:

- `iaCode`
- `clusterId`
- `status`
- `lane`
- `laneReason`
- `laneChangedAt`
- `attempt`
- `maxAttempts`
- `owner`
- `claimedBy`
- `claimedAt`
- `heartbeatAt`
- `leaseExpiresAt`
- `blockedReason`
- `blockedOwner`
- `agingDueAt`
- `nextCoordinatorAction`
- `packetPath`
- `resultPacketPath`
- `requiredEvidence`
- `writeLocks`
- `version`

Allowed queue statuses:

- `pending`: discovered but not preflight-ready.
- `ready`: eligible for coordinator claim.
- `claimed`: coordinator assigned owner and lease, but work has not started.
- `in_progress`: IA execution agent is active.
- `waiting_specialist`: work is waiting for a coordinator-spawned specialist result.
- `verifying`: final verifier is reconciling evidence.
- `requeue_requested`: the current attempt did not close and needs coordinator decision.
- `done`: IA item is closed.
- `blocked_terminal`: IA item cannot be retried until the prerequisite changes and a new coordinator-authored packet exists.
- `cancelled`: coordinator intentionally removed the item from the run.

Allowed queue lanes:

- `implementable`: source and evidence prerequisites exist, and code/docs work is likely needed.
- `evidence-refresh`: implementation may already satisfy docs, but audit artifacts are stale or missing.
- `manual-human`: human confirmation or manual evidence is required before closeout.
- `security-fixture`: Supabase fixture evidence is missing, stale, incomplete, or points at the wrong project/environment.
- `blocked-prerequisite`: a required script, artifact, fixture, trigger, or source decision is absent.

`status` tracks lifecycle. `lane` tracks why the item is or is not dispatchable. Do not overload `status` with lane names.

Lane-to-status rules:

- `implementable` and `evidence-refresh` items may become `ready` only after packet, tool, fixture, and write-lock prerequisites are proven.
- `manual-human` items remain `pending` until a user delegation record, delegated reviewer result, or manual evidence artifact exists. If the missing human decision cannot be obtained for this run, move the item to `blocked_terminal` or carry it forward only where this plan allows carry-forward.
- `security-fixture` items remain `pending` until the fixture manifest proves the required keys. If fixture provenance cannot be proven, move the item to `blocked_terminal`.
- `blocked-prerequisite` items remain `pending` or `blocked_terminal` until the prerequisite changes and a fresh coordinator-authored packet exists.
- Terminal items keep their last lane as closure context.

Allowed transitions:

| From | To |
| --- | --- |
| `pending` | `ready`, `blocked_terminal`, `cancelled` |
| `ready` | `claimed`, `blocked_terminal`, `cancelled` |
| `claimed` | `in_progress`, `blocked_terminal`, `cancelled` |
| `in_progress` | `waiting_specialist`, `verifying`, `requeue_requested`, `blocked_terminal`, `cancelled` |
| `waiting_specialist` | `in_progress`, `blocked_terminal`, `cancelled` |
| `verifying` | `done`, `requeue_requested`, `blocked_terminal`, `cancelled` |
| `requeue_requested` | `ready`, `blocked_terminal`, `cancelled` |

Default retry policy:

- `maxAttempts: 2` per IA item unless the coordinator records a specific exception in the ledger.
- `blocked_terminal` cannot be retried without a new coordinator-authored packet and a changed prerequisite.
- Queue items must be claimed atomically with their write-lock reservation by updating `claimedBy`, `claimedAt`, `leaseExpiresAt`, write-lock owner/status, and `version` as one coordinator-owned operation.
- A queue item whose `version` changed since packet creation must be re-read before work continues.

Requeue mechanics:

1. Before any `requeue_requested -> ready` transition, increment `attempt`.
2. If the incremented `attempt` is greater than or equal to `maxAttempts`, move the item to `blocked_terminal`.
3. Clear `claimedBy`, `claimedAt`, `heartbeatAt`, `leaseExpiresAt`, and stale `resultPacketPath` unless the result packet is retained as failure evidence.
4. Release all write locks held by the attempt and record `releasedAt`.
5. Invalidate the previous task packet by recording `supersededBy` or `staleReason`.
6. Generate a fresh coordinator-authored packet before the item can become `ready`.
7. Record `blockedOwner`, `blockedReason`, `agingDueAt`, and `nextCoordinatorAction` when the item becomes `blocked_terminal`.

Requeue is forbidden when the same prerequisite is still missing. Use `blocked_terminal` until the prerequisite changes.

Atomic claim and write-lock sequence:

1. Read the current run-state file and queue item `version`.
2. Read the write-lock registry and verify every required lock is available.
3. Write proposed run-state and write-lock registry updates to temporary files in the same directory.
4. Replace the write-lock registry with its temporary file using an atomic rename.
5. Replace the run-state file with its temporary file using an atomic rename.
6. Re-read both files.
7. Continue only if `claimedBy`, `leaseExpiresAt`, incremented `version`, lock owner, lock status, and preimage hashes all match the coordinator's intended claim.
8. If either file differs, immediately roll back any matching partial lock owned by the failed claim, re-read both files, and retry once.
9. If the retry fails, leave the item `ready` only when no lock remains reserved. Otherwise move it to `requeue_requested` with a P0 monitor alert.

## Dispatch Budget

- Only the root coordinator may spawn IA execution agents, specialists, monitor agents, or final verifiers.
- Max active IA execution agents: `2` by default.
- Max active IA execution agents may increase to `3` only when write-lock clusters are disjoint and the ledger records the reason.
- Max active specialists per IA item: `2`.
- Additional specialists require a coordinator packet update and ledger rationale.
- IA execution agents cannot recursively delegate or spawn agents.
- Monitor agents do not consume the IA execution budget.
- Final verifiers do not share ownership with IA execution agents.

## Heartbeat, Timeout, And Stale Session Policy

- The coordinator must update `coordinatorHeartbeatAt` at least every 10 minutes while the run has any non-terminal queue item.
- A coordinator run is stale after 15 minutes without `coordinatorHeartbeatAt` movement. A replacement coordinator must use the latest handoff note and run-state files to reclaim or terminally block affected work.
- Active IA execution agents must update `heartbeatAt` at least every 10 minutes while active.
- An IA execution session is stale after 15 minutes without heartbeat.
- An IA execution lease expires after 45 minutes unless the coordinator extends it with a ledger reason.
- Specialist sessions time out after 20 minutes unless the coordinator extends them with a ledger reason.
- Final verifier sessions time out after 20 minutes unless the coordinator extends them with a ledger reason and updates `agingDueAt`.
- The monitor is read-only and non-blocking except for P0 alerts.
- Coordinator action for stale sessions is one of: reclaim the lease, reassign with a fresh packet, or mark `blocked_terminal`.
- If a specialist times out while an IA item is `waiting_specialist`, the coordinator must release the specialist slot, record the timeout in the result-packet area or ledger, and move the IA item to `requeue_requested` or `blocked_terminal`.
- If a final verifier times out while an IA item is `verifying`, the coordinator must move the item to `requeue_requested` or `blocked_terminal`, release verifier ownership, and write a blocker handoff note.

Aging thresholds:

| State or lane | Aging threshold | Required coordinator action |
| --- | --- | --- |
| `pending` | 30 minutes | Convert to `ready`, `blocked_terminal`, or `cancelled` with reason. |
| `claimed` | 10 minutes without `in_progress` | Reclaim claim or move to `blocked_terminal`. |
| `waiting_specialist` | 20 minutes | Release specialist slot, then return to `in_progress`, `requeue_requested`, or `blocked_terminal`. |
| `verifying` | 20 minutes | Reassign final verifier, requeue, or block terminally. |
| `requeue_requested` | 15 minutes | Apply requeue mechanics or block terminally. |
| `manual-human` lane | 1 business day | Record owner, due trigger, and whether the run can carry forward. |
| `security-fixture` lane | 30 minutes | Verify fixture provenance or block terminally. |
| `blocked-prerequisite` lane | 30 minutes | Record the missing prerequisite, owner, due trigger, and whether the item should move to `blocked_terminal`. |
| `blocked_terminal` | 1 business day | Produce aging summary with owner, changed prerequisite needed, and next allowed action. |
| Cross-IA item not `closed`, `rejected`, or `carried-forward` | 30 minutes | Move to a valid terminal/carry-forward state or reopen affected queue items. |

P0 alerts must be handled within 10 minutes. Handling means the coordinator records one of: resolved, reclaimed, reassigned, requeued, `blocked_terminal`, or escalated with owner and due trigger.

P0 monitor alerts:

- Missing active claim owner.
- Expired lease on a write-locked item.
- Shared write-lock collision.
- Stale evidence after a relevant file change.
- Missing result packet for a `verifying` item.
- Timed-out specialist while an IA item is `waiting_specialist`.
- Timed-out final verifier while an IA item is `verifying`.
- Stale coordinator heartbeat while non-terminal queue items exist.
- Invalid queue transition or lifecycle state.
- Metadata conflict affecting route, audience, route type, modal host, required packs, or security evidence.

## Handoff Notes

Because this workflow uses multiple sessions, the coordinator must write handoff notes at fixed checkpoints. A handoff note is a short resume document. It must let a new coordinator continue without reading the entire conversation history.

Handoff path:

- `<auditRunDirectory>/handoffs/<timestamp>-<scope>-handoff.md`

Required checkpoints:

- After Phase 0 preflight.
- After each queue item is claimed and before the IA execution agent starts.
- Before requesting a specialist.
- After every specialist result packet.
- Before lease extension, requeue, reassignment, or `blocked_terminal`.
- After cross-IA lifecycle item creation or state change.
- Before final verifier starts.
- After final run closeout.

Required handoff fields:

- `handoffId`
- `createdAt`
- `createdBy`
- `scope`
- `runStatePath`
- `writeLockRegistryPath`
- `queueItemsInScope`
- `activeAgents`
- `openLeases`
- `lastHeartbeatAt`
- `toolsAvailable`
- `toolsMissing`
- `requiredSkillsUsed`
- `decisionsSinceLastHandoff`
- `filesChangedSinceLastHandoff`
- `evidenceProduced`
- `screenshotArtifacts`
- `consoleLogArtifacts`
- `blockers`
- `nextCoordinatorAction`

If an agent or coordinator session dies, the replacement coordinator must read the latest handoff note, re-read `remediation-run-state.json`, re-read `write-lock-registry.json`, and then either reclaim expired leases or mark the item `blocked_terminal`.

## Execution Slice And Workslop Controls

The full workflow document is the policy source. It is not the execution prompt for every agent.

To reduce workslop, the coordinator must create a short execution slice for each agent. The slice is part of the task packet and must contain only the sections needed for that agent's role.

Execution slice rules:

- Max 1 IA item or approved cluster per IA execution agent.
- Max 2 primary goals per packet.
- Max 10 checklist items copied into the packet. Link to the full checklist for reference instead of pasting the whole document.
- Include exact route, host route, IA code, write scope, required evidence, required tools, and stop conditions.
- Browser or visual execution slices must name the expected screenshot artifacts, browser console-log artifacts, and network or runtime error observations to capture.
- Include `mustReadSections` with heading names from this document and checklist docs.
- Include `mustNotDo` so agents do not expand product scope, edit unowned files, or skip evidence.
- Include a `definitionOfDone` that maps to the completion gate.
- Every result packet must answer each checklist item as `PASS`, `PARTIAL`, `FAIL`, `BLOCKED`, `N/A`, `DOC-GAP`, or `DEFERRED`.

No agent may claim completion from a broad summary such as "looks good" or "implemented". Claims must point to evidence files, commands, screenshots, browser console logs, or source lines.

## Monitor Agent Packet And Result

The monitor is not an IA execution agent and does not edit files. It runs with read-only scope over the queue, ledger, task packets, result packets, audit artifacts, and current file-state summary.

Minimum monitor cadence:

- At remediation run start after queue creation.
- After each IA task packet is assigned.
- After each IA task closes, blocks, or creates a cross-IA lifecycle item.
- Before final run closeout.

The coordinator may request additional monitor checks when write conflicts, stale evidence, or cross-IA flow risk appears.

Monitor packets extend the standard [agent packet](../../ai-workflow/contracts/agent-packets.md) contract. The monitor has `Audience: n/a`, `Exact write scope: none`, and a read-only scope that is limited to orchestration artifacts and file-state summaries.

Monitor task packet template:

```markdown
## Task Packet

- Agent:
- Role: read-only monitor
- Objective:
- Audience: n/a
- Accepted scope:
- Out of scope:
- Docs consulted:
- Extracted requirements:
- Exact read scope:
- Exact write scope: none
- Files not to touch:
- Constraints:
- Required verification:
- Expected output:
- Context ledger path:
- Handoff note path:
- Allowed tools:
- Required skills:
- Required MCP/plugins:
- Tool preflight status:
- Tool fallbacks:

## Monitor Fields

- readOnlyScope:
- queueSnapshot:
- ledgerPath:
- taskPacketPaths:
- resultPacketPaths:
- auditRunDirectory:
- profileMapPath:
- currentChangedFiles:
- crossIaLifecyclePath:
- escalationThresholds:
```

Monitor result packet template:

```markdown
## Result Packet

- Agent:
- Role: read-only monitor
- Objective completed:
- Audience verified: n/a - monitor is read-only and has no product audience boundary.
- Files inspected:
- Files changed: none
- Decisions made:
- Tests/checks run:
- Results:
- Blockers:
- Assumptions:
- Scope concerns:
- Recommended follow-up:
- Context ledger updates needed:
- Handoff note updates needed:
- Tools used:
- Required skills used:
- MCP/plugins used:
- Tool failures or fallbacks:

## Monitor Results

- queueHealth:
- missingPackets:
- staleEvidence:
- crossIaAging:
- writeConflictAlerts:
- metadataMismatchAlerts:
- humanConfirmationGaps:
- recommendedCoordinatorActions:
- blockers:
```

Escalate to the coordinator when:

- A required packet is missing or lacks a standard packet field.
- A file changed after the task packet preimage hash.
- Regenerated evidence predates the latest relevant file change.
- A cross-IA item is still `proposed`, `approved`, `queued-revisit`, or `applied` when an affected IA is being closed.
- Audit JSON metadata conflicts with the profile map or active route docs.
