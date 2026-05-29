# Coordinator Checklist

## Purpose

Control the IA remediation run, preserve durable context, assign one IA execution agent per IA item, and prevent cross-IA conflicts from being lost.

## Required Inputs

- [IA remediation multi-agent execution plan](../ia-remediation-multi-agent-execution-plan.md)
- [IA review profile map](../ia-review-profiles/ia-review-profile-map.json)
- Current IA audit JSON, markdown, and HTML report paths.
- Context ledger for the run.
- Base commit, dirty-worktree summary, and allowed write scope.

## Applies When

- Starting, resuming, monitoring, or closing an IA remediation run.
- Assigning an IA execution agent.
- Reconciling specialist results into final labels.

## Does Not Apply When

- A specialist is performing a bounded read-only review inside an IA task packet.
- A single implementation patch can be completed without IA-level orchestration.

## Checklist Items

- [ ] Confirm the current IA inventory count from `docs/IA/README.md`.
- [ ] Confirm route authority from `docs/sitemap.md`.
- [ ] Load the matching IA profile before assigning work.
- [ ] Put the original audit JSON path in the task packet.
- [ ] Treat the HTML report as triage input only.
- [ ] Assign exactly one active IA execution agent per IA code.
- [ ] Allow each IA execution agent to call only the specialists required by the profile or by newly discovered risk.
- [ ] Require specialist result packets before applying cross-domain fixes.
- [ ] Record cross-IA impacts with lifecycle state.
- [ ] Require regenerated evidence before closing an IA item.
- [ ] Keep the ledger current after each IA closes, blocks, or queues a cross-IA revisit.

## Detailed Checklist Matrix

### Run Intake

- [ ] Identify the audit run directory.
- [ ] Identify JSON, markdown, and HTML audit artifacts.
- [ ] Confirm audit JSON parses before queue construction.
- [ ] Confirm IA inventory count from active IA docs.
- [ ] Confirm every queued IA exists in the profile map.
- [ ] Confirm every queued IA has route type, audience, required packs, required specialists, and evidence requirements.
- [ ] Record dirty worktree state before assigning agents.
- [ ] Record files that must not be touched.
- [ ] Record source docs consulted for the run.
- [ ] Record whether this is remediation, re-audit, profile maintenance, or checklist maintenance.

### Queue Construction

- [ ] Group items by IA code, not by route string alone.
- [ ] Separate standalone pages from hosted modals/states.
- [ ] Put host route and hosted surface in the same coordination group when evidence overlaps.
- [ ] Prioritize security/data risks before pure visual polish.
- [ ] Prioritize blocked user outcomes before missing screenshots.
- [ ] Prioritize cross-IA flow defects before isolated page defects when both affect the same route.
- [ ] Mark environmental blockers separately from implementation blockers.
- [ ] Keep deferred-scope items out of implementation queue unless docs require UI correction.
- [ ] Avoid assigning two agents to the same route or shared component at once.
- [ ] Recompute queue after each shared route, auth, data, or audit script change.

### Task Packet Quality

- [ ] Packet has one IA owner.
- [ ] Packet includes accepted scope and explicit out-of-scope items.
- [ ] Packet includes source docs and audit artifacts.
- [ ] Packet includes allowed write scope and read-only scope.
- [ ] Packet includes required specialist checklist paths.
- [ ] Packet includes required evidence by pack.
- [ ] Packet includes negative cases required for the IA.
- [ ] Packet includes cross-IA flow edges already known.
- [ ] Packet includes human confirmation requirements.
- [ ] Packet includes verification commands and expected artifacts.
- [ ] Packet includes preimage hashes or file-state note for shared files.
- [ ] Packet states when the agent must stop and report a conflict.

### Specialist Coordination

- [ ] Required specialists are called according to profile map.
- [ ] Optional specialists are called when evidence reveals new risk.
- [ ] Specialists receive read-only scope unless implementation ownership is explicit.
- [ ] Specialist result packets use the shared rubric labels.
- [ ] Specialist findings cite evidence, not only judgment.
- [ ] Specialist `N/A` decisions include route type or pack-based reason.
- [ ] Contradictory specialist findings are reconciled before implementation closeout.
- [ ] Weakest material finding controls final IA state.
- [ ] Cross-IA findings are entered into lifecycle tracking.
- [ ] Rejected specialist findings include rationale.

### Monitor Duties

- [ ] Watch for stale evidence after each change.
- [ ] Watch for agents exceeding write scope.
- [ ] Watch for unresolved cross-IA items.
- [ ] Watch for missing result packet fields.
- [ ] Watch for checklist items imported from external sources without project mapping.
- [ ] Watch for repeated `BLOCKED` items that need environment/data setup.
- [ ] Watch for HTML-only evidence being treated as final proof.
- [ ] Watch for ledger status lagging behind actual file state.
- [ ] Watch for final reports omitting remaining risk.

### Closeout

- [ ] Every IA task has final label.
- [ ] Every final label cites regenerated evidence or documented blocker.
- [ ] Every cross-IA item is closed, rejected, or carried with owner.
- [ ] Every human-confirmation item has an artifact or remains open.
- [ ] Ledger lists changed files, commands, results, skipped checks, and risks.
- [ ] Final report separates completed work from remaining blockers.
- [ ] Workflow checker has been run or a blocker is recorded.
- [ ] No agent session remains responsible for unreported work.

## Research-Backed Detailed Checks

- [ ] Packet includes the exact external-reference class that may apply: accessibility, security, form error, modal, AI UX, automation, or policy.
- [ ] Packet marks external and community sources as `advisory`, not product authority.
- [ ] Queue priority separates user-blocking failure, security risk, evidence gap, and deferred-scope ambiguity.
- [ ] Queue priority does not let easy UI fixes hide security, data, or auth blockers.
- [ ] Cross-IA flow items list source IA, target IA, trigger, expected user outcome, and evidence owner.
- [ ] Every specialist packet states whether the IA needs keyboard-only evidence.
- [ ] Every specialist packet states whether the IA needs negative-case evidence.
- [ ] Every specialist packet states whether the IA needs owner/role/session evidence.
- [ ] Every specialist packet states whether the IA needs manual human confirmation.
- [ ] Monitor checks for stale evidence after any shared route, auth, data, or modal host change.
- [ ] Monitor flags checklist drift when a specialist adds a criterion that is not mapped to a project pack.
- [ ] Closeout requires the weakest material specialist result to be visible in the final IA decision.

## Rating Criteria

- `PASS`: packet, queue, specialist results, cross-IA items, verification, and ledger are complete.
- `PARTIAL`: the run can continue, but one coordination artifact is incomplete.
- `FAIL`: two agents are allowed to modify the same IA or shared flow without coordination.
- `BLOCKED`: required audit artifacts, repository state, or execution authority is unavailable.
- `N/A`: only for checklist items outside the run scope.

## Required Evidence

- Queue snapshot.
- Task packet IDs and assigned IA codes.
- Specialist result packet links.
- Ledger entries for decisions and verification.
- Final audit artifact paths.

## Result Packet Fields

- `queueState`
- `assignedIaCodes`
- `specialistPackets`
- `crossIaLifecycleItems`
- `verificationCommands`
- `remainingRisks`

## External References

- [Context and packets](../context-and-packets.md)
- [Agent packets](../agent-packets.md)
- [Review gates](../review-gates.md)
- [Playwright best practices](https://playwright.dev/docs/best-practices)
- [NN/g usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)

## Project-Specific No-Pass Rules

- Do not mark the run complete while any IA item is only supported by HTML-report evidence.
- Do not close an IA item when a cross-IA flow edge remains `proposed`, `queued-revisit`, or `applied` without regenerated evidence.
- Do not accept a specialist finding that imports a new requirement from external research without mapping it to active project docs or `DOC-GAP`.
