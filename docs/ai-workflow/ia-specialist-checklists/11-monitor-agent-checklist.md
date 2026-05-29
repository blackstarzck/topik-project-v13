# Monitor Agent Checklist

## Purpose

Watch the IA remediation process without editing files, then report coordination risks to the root coordinator.

## Required Inputs

- Current queue snapshot.
- Context ledger.
- IA task packets.
- Specialist result packets.
- Audit run directory.
- IA review profile map.
- Current changed-file summary.
- Cross-IA lifecycle list.

## Applies When

- Starting a remediation run.
- Assigning an IA task packet.
- Closing, blocking, or reopening an IA item.
- Creating or changing a cross-IA lifecycle item.
- Preparing final closeout.

## Does Not Apply When

- The monitor would need to edit files or decide product scope.

## Checklist Items

- [ ] Queue entries have IA code, profile row, label source, owner, and status.
- [ ] IA task packets include all standard agent packet fields and IA-specific fields.
- [ ] Required specialists have packets or justified `N/A`.
- [ ] Evidence generated after implementation changes is not stale.
- [ ] Cross-IA lifecycle items have valid states and required owner/evidence fields.
- [ ] Write scopes do not overlap across active IA execution agents.
- [ ] Human confirmation requirements are not replaced by AI notes.
- [ ] Audit JSON metadata mismatches with profile or active docs are flagged.
- [ ] `carried-forward` items include owner, risk, due trigger, affected IA, and required evidence.

## Detailed Checklist Matrix

### Queue Health

- [ ] Every queue entry has IA code.
- [ ] Every queue entry has screen name.
- [ ] Every queue entry has route or host route.
- [ ] Every queue entry has route type.
- [ ] Every queue entry has current label source.
- [ ] Every queue entry has owner.
- [ ] Every queue entry has status.
- [ ] Every queue entry has required specialists.
- [ ] Every queue entry has required evidence.
- [ ] Every queue entry has last-updated timestamp or ledger reference.
- [ ] Queue ordering separates security/data risk, user-blocking defects, evidence gaps, and deferred-scope review.
- [ ] Queue does not include stale IA codes absent from active IA inventory.

### Packet Completeness Monitoring

- [ ] IA task packet includes user goal.
- [ ] IA task packet includes accepted scope.
- [ ] IA task packet includes out-of-scope.
- [ ] IA task packet includes source docs.
- [ ] IA task packet includes profile row.
- [ ] IA task packet includes audit artifacts.
- [ ] IA task packet includes required checklist docs.
- [ ] IA task packet includes allowed write scope.
- [ ] IA task packet includes read-only scope.
- [ ] IA task packet includes stop/escalation conditions.
- [ ] Specialist result packet includes rating.
- [ ] Specialist result packet includes evidence.
- [ ] Specialist result packet includes findings.
- [ ] Specialist result packet includes blockers.
- [ ] Specialist result packet includes cross-IA impacts.

### Evidence Freshness Monitoring

- [ ] Evidence run id matches the active remediation run.
- [ ] JSON evidence timestamp is after the latest relevant file change.
- [ ] Markdown summary timestamp matches JSON run.
- [ ] HTML report is marked triage-only unless backed by JSON.
- [ ] Screenshot/trace evidence is tied to IA code.
- [ ] Browser evidence includes route and state.
- [ ] Security evidence includes negative cases when required.
- [ ] UX evidence includes relevant viewport states when required.
- [ ] Automation evidence lists command and exit status.
- [ ] Missing evidence is labeled `BLOCKED`, `PARTIAL`, `DOC-GAP`, or `DEFERRED`, not silently ignored.

### Write Scope And Conflict Monitoring

- [ ] Active IA execution agents have disjoint write scopes.
- [ ] Shared route files are owned by one active agent at a time.
- [ ] Shared components are coordinator-approved before edit.
- [ ] Shared tests are coordinator-approved before edit.
- [ ] Auth, middleware, RLS, storage, or audit scripts are treated as shared high-risk scope.
- [ ] Dirty files outside accepted scope are not reverted.
- [ ] Preimage hash or changed-file note is checked before closeout.
- [ ] File changes after packet assignment trigger conflict review.
- [ ] Monitor reports conflict; it does not edit to resolve conflict.
- [ ] Coordinator decision is recorded before overlapping work resumes.

### Cross-IA Lifecycle Monitoring

- [ ] Every cross-IA item has source IA.
- [ ] Every cross-IA item has target IA.
- [ ] Every cross-IA item has route or host route.
- [ ] Every cross-IA item has trigger.
- [ ] Every cross-IA item has expected state transfer.
- [ ] Every cross-IA item has owner.
- [ ] Every cross-IA item has lifecycle state.
- [ ] Every `applied` item has regenerated evidence.
- [ ] Every `queued-revisit` item has due trigger.
- [ ] Every `rejected` item has rationale.
- [ ] No `proposed` item is left untriaged at final closeout.
- [ ] No `carried-forward` item lacks owner, risk, and evidence requirement.

### Human Confirmation And Policy Monitoring

- [ ] Human confirmation requirements are visible in queue.
- [ ] Confirmation artifact includes who, what, when, and affected IA.
- [ ] AI-generated note is not treated as human confirmation.
- [ ] Policy gaps are not closed by implementation evidence alone.
- [ ] Deferred billing and notification transport items are checked for overpromise.
- [ ] Admin audit requirements are not skipped without rationale.
- [ ] Security uncertainty is marked fail-closed.
- [ ] Business/legal/pricing/retention ambiguity remains `DOC-GAP`.

### Final Closeout Monitoring

- [ ] Every IA item has final state.
- [ ] Every final state has evidence or blocker.
- [ ] Every specialist packet is integrated or justified `N/A`.
- [ ] Every cross-IA lifecycle item is closed, rejected, or carried with owner.
- [ ] Ledger status matches queue status.
- [ ] Ledger changed-file list matches current file state.
- [ ] Verification commands were run or skipped with reason.
- [ ] Remaining risks are listed.
- [ ] Final report does not claim unverified `PASS`.
- [ ] Monitor result packet is delivered to coordinator before final report.

## Research-Backed Detailed Checks

- [ ] Monitor checks user-visible evidence expectations from Playwright guidance before accepting automation closeout.
- [ ] Monitor checks security/data closeout for OWASP-style negative-case coverage.
- [ ] Monitor checks UX/UI closeout for WCAG-style keyboard, focus, label, status, and error evidence.
- [ ] Monitor checks modal closeout for WAI-ARIA dialog trigger, focus entry, focus containment, and focus return.
- [ ] Monitor checks form/error closeout for GOV.UK-style field error, summary, focus, and fix guidance.
- [ ] Monitor checks AI UX closeout for transparency, feedback/control, stale result, and failure recovery.
- [ ] Monitor checks community-derived findings are advisory and mapped to project packs before they affect labels.
- [ ] Monitor checks final report separates evidence risk from product behavior risk.

## Rating Criteria

- `PASS`: queue, packets, evidence freshness, write scopes, and cross-IA lifecycle state are coherent.
- `PARTIAL`: run can continue, but one monitor concern needs coordinator action.
- `FAIL`: an active conflict, stale evidence closeout, missing required packet, or invalid lifecycle state would make results unreliable.
- `BLOCKED`: monitor cannot inspect required queue, ledger, packet, profile, or artifact inputs.
- `N/A`: only when no remediation run is active.

## Required Evidence

- Queue snapshot reference.
- Packet completeness findings.
- Changed-file or preimage-hash comparison.
- Audit artifact timestamps or regeneration record.
- Cross-IA lifecycle findings.

## Result Packet Fields

- `queueHealth`
- `missingPackets`
- `staleEvidence`
- `crossIaAging`
- `writeConflictAlerts`
- `metadataMismatchAlerts`
- `humanConfirmationGaps`
- `recommendedCoordinatorActions`
- `blockers`

## External References

- [Agent packets](../agent-packets.md)
- [Context and packets](../context-and-packets.md)
- [IA remediation multi-agent execution plan](../ia-remediation-multi-agent-execution-plan.md)
- [Playwright best practices](https://playwright.dev/docs/best-practices)
- [WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/)
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
- [WAI-ARIA APG Dialog Modal Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

## Project-Specific No-Pass Rules

- Do not allow IA closeout when regenerated evidence predates the latest relevant file change.
- Do not allow two active IA execution agents to share a write scope.
- Do not allow audit JSON metadata to override active route or profile metadata without reconciliation.
- Do not allow final closeout when the monitor packet has not been delivered or explicitly waived by the coordinator.
