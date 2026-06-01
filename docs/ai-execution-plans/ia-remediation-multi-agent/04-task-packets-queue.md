# IA Remediation Multi-Agent Plan: Task Packets And Queue Rules

## Required IA Task Packet Fields

IA task packets extend the standard [agent packet](../../ai-workflow/contracts/agent-packets.md) contract. Every IA packet must include all standard task packet fields plus IA-specific fields.

Required packet template:

```markdown
## Task Packet

- Agent:
- Role: IA execution agent
- Objective:
- Audience:
- Accepted scope:
- Out of scope:
- Docs consulted:
- Extracted requirements:
- Exact read scope:
- Exact write scope:
- Files not to touch:
- Constraints:
- Required verification:
- Expected output:
- Context ledger path:
- Handoff note path (`handoffNotePath`):
- Allowed tools (`allowedTools`):
- Required skills (`requiredSkills`):
- Required MCP/plugins (`requiredMcpOrPlugins`):
- Tool preflight status (`toolPreflightStatus`):
- Tool fallbacks (`toolFallbacks`):
- Tool use evidence (`toolUseEvidence`):
- Execution slice (`executionSlice`):
- Must-read sections (`mustReadSections`):
- Must-not-do (`mustNotDo`):
- Definition of done (`definitionOfDone`):

## IA Remediation Fields

- iaCode:
- screenName:
- profileRow:
- requiredSpecialists:
- requiredChecklistDocs:
- requiredPacks:
- requiredEvidence:
- auditRunDirectory:
- auditJsonPath:
- htmlReportPath:
- sourceDocs:
- allowedWriteScope:
- readOnlyScopes:
- baseCommit:
- preimageHashes:
- crossIaImpacts:
- humanConfirmationRequired:
- deferredScopeGuards:
- verificationCommands:
- environment:
- productionAllowed:
- supabaseProjectRef:
- allowedCredentials:
- serviceRoleUse:
- mutationAllowed:
- fixtureProvenance:
- toolUseEvidence:
```

The IA-specific fields must include:

- `iaCode`
- `screenName`
- `profileRow` from [ia-review-profile-map.json](./review-profiles/ia-review-profile-map.json)
- `requiredSpecialists`
- `requiredChecklistDocs`
- `requiredPacks`
- `requiredEvidence`
- `auditRunDirectory`
- `auditJsonPath`
- `htmlReportPath`
- `sourceDocs`
- `allowedWriteScope`
- `readOnlyScopes`
- `baseCommit`
- `preimageHashes` for files in write scope
- `crossIaImpacts`
- `humanConfirmationRequired`
- `deferredScopeGuards`
- `verificationCommands`
- `environment`, `productionAllowed`, `supabaseProjectRef`, `allowedCredentials`, `serviceRoleUse`, `mutationAllowed`, and `fixtureProvenance` when the packet touches security, data, auth, storage, Supabase, owner scope, admin scope, or fixtures
- `fixtureManifestPath`, `requiredFixtureKeys`, `fixtureSeedStatus`, `seedCommand`, `verifyCommand`, `cleanupCommand`, `rollbackOrResetBoundary`, `fixtureFreshnessCheckedAt`, `expectedRlsCases`, and fixture category fields when the packet touches auth, data, owner scope, storage, RBAC, admin audit, persistence, Supabase, or fixtures
- `allowedTools`, `requiredSkills`, `requiredMcpOrPlugins`, `toolPreflightStatus`, `toolFallbacks`, and `toolUseEvidence`
- `handoffNotePath`
- `executionSlice`, `mustReadSections`, `mustNotDo`, and `definitionOfDone`

IA result packets must include:

- `iaCode`
- `queueItemStatus`
- `toolsUsed`
- `requiredSkillsUsed`
- `mcpOrPluginsUsed`
- `toolFailuresOrFallbacks`
- `handoffNotesWritten`
- `checklistResults`
- `evidenceFiles`
- `screenshotArtifacts`
- `consoleLogArtifacts`
- `commandsRun`
- `filesChanged`
- `crossIaLifecycleUpdates`
- `remainingBlockers`
- `recommendedNextCoordinatorAction`
- `fixtureManifestPath`, `fixtureKeysUsed`, `fixtureEvidenceFiles`, `rlsCaseResults`, and `fixtureCleanupStatus` when fixtures were required or used

## Queue Rules

1. Build the queue from audit JSON labels and profile rows.
2. Use HTML report ordering only as a triage hint.
3. Build lane classification before dispatch and persist it as the queue item `lane`. `status` remains the lifecycle state from [03-run-state-monitoring.md](./03-run-state-monitoring.md).
   - `implementable`: source and evidence prerequisites exist, and code/docs work is likely needed.
   - `evidence-refresh`: implementation may already satisfy docs, but audit artifacts are stale or missing.
   - `manual-human`: human confirmation or manual evidence is required before closeout.
   - `security-fixture`: the Supabase fixture manifest is missing, stale, incomplete, points at the wrong project/environment, or cannot prove required storage state, seeded user, role, wrong-owner, stale-token, RLS, storage, admin audit, or service-role fixture evidence.
   - `blocked-prerequisite`: a required script, artifact, fixture, trigger, or source decision is absent.
4. Record `laneReason` and `laneChangedAt` whenever the lane changes.
5. Prefer `FAIL` before `PARTIAL`, `PARTIAL` before `BLOCKED` only inside the same lane.
6. Do not dispatch `blocked-prerequisite`, unresolved `manual-human`, or unresolved `security-fixture` items until the prerequisite changes.
7. Group related hosted surfaces with their host IA when flow evidence would otherwise be duplicated.
8. Never run two IA execution agents that can write the same route, component, test, or shared flow file at the same time.
9. Use active docs and profile rows for route, audience, route type, modal host, and required pack metadata.
10. For `PARTIAL` rows whose audit markdown says `none`, extract actionable work from `manual-review.json`, `agent-integration-results.json`, and generated result packets before dispatch.
11. Fresh task packets are required for every queue item. Missing task packets are a P0 monitor alert.
