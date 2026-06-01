# IA Remediation Multi-Agent Plan: Overview And Preflight

This file contains the goal, sources, audit input, risk controls, reconciliation rules, and Phase 0 preflight for the split IA remediation plan.

## Purpose

Use this plan to remediate IA/page verification findings after the audit run has already identified gaps.

This is a separate execution document. It does not modify or replace the upstream [IA implementation verification execution plan](../ia-implementation-verification/README.md).

## Source Priority

Use active docs and audit artifacts in this order:

1. `docs/sitemap.md`, `docs/Wireframe/README.md`, IA `description.md`, and `docs/flow/user-flow.md`.
2. [ia-page-implementation-verification.md](../../ai-workflow/ia-page-implementation-verification.md).
3. Audit JSON from the selected run directory.
4. Generated markdown summaries from the same run.
5. HTML report from the same run as human-readable triage only.

The HTML report can influence prioritization and issue discovery. It cannot be the sole proof for final IA labels.

## Audit Run Selection

At Phase 0 start, the coordinator must select exactly one audit run directory and record it in the ledger and Phase 0 handoff note.

Default selection rule:

- Use the newest audit run directory that contains `ia-implementation-audit.json`, `ia-audit-report.html`, `ia-manifest.json`, and a passing `ia-implementation-audit-validation.json`, unless the user explicitly names another run.
- If a newer audit ledger says not to reuse older artifacts, the remediation coordinator must start Phase 0 fresh for that newer run.
- Older remediation artifacts may be reused only for the same selected audit run and only after the schema validation below passes.

Current workspace note:

- Fresh audit run for new remediation: `reports/ia-verification/runs/20260601-120308/`.
- Legacy remediation artifacts from `reports/ia-verification/runs/20260528-141731/` belong to the earlier X-05/X-07 remediation attempt. Do not mix them into `20260601-120308` without a written migration note.

Known audit impact:

- The report affects queue ordering, cluster discovery, and reviewer context.
- The JSON evidence controls final label evidence, regenerated labels, and closeout.
- Route metadata, audience, route type, modal host, and required packs come from active docs and the IA review profile map.
- If the HTML and JSON disagree, open a reconciliation item before implementation.
- If audit JSON metadata conflicts with active docs or the profile map, keep the label evidence from JSON but open a reconciliation item for the metadata mismatch.

## Risk-Lowering Execution Contract

This plan is execution-ready only when the coordinator can prove these controls before dispatch:

- State machines are closed: every queue item, cross-IA lifecycle item, and reconciliation item is in an allowed state with an owner, timestamp, next action, and terminal rule.
- Wait states are bounded: every lifecycle status (`pending`, `waiting_specialist`, `verifying`, `requeue_requested`, `blocked_terminal`) and every blocking lane (`manual-human`, `security-fixture`, `blocked-prerequisite`) has an aging threshold and an explicit coordinator action.
- Claims and write locks are one coordinator-owned operation: a queue claim cannot stand without the matching write-lock reservation, and a write-lock reservation cannot stand without the matching queue claim.
- Fallbacks are command-specific: manual evidence is allowed only where this plan defines an artifact schema and closure boundary.
- External and privileged tooling is fail-closed: unpinned tool installation, unknown Supabase project identity, production data mutation, service-role ambiguity, or missing fixture provenance blocks the affected item.

If any control above is missing, the coordinator must stop before IA dispatch, write a handoff note, and mark affected queue items `blocked_terminal` or `pending` with the missing prerequisite.

## Reconciliation Items

When the plan says to open a reconciliation item, the coordinator must create or update `<auditRunDirectory>/reconciliation-items.json`.

Required fields per item:

- `reconciliationId`
- `source`
- `affectedIaCodes`
- `routeOrHostRoute`
- `conflictType`: `html-json`, `json-doc`, `profile-doc`, `manifest-profile`, `manual-evidence`, or `other`
- `sourceEvidence`
- `expectedAuthority`
- `owner`
- `status`
- `createdAt`
- `updatedAt`
- `agingDueAt`
- `resolution`
- `requiredEvidenceBeforeClosure`

Allowed statuses:

| From | To |
| --- | --- |
| `proposed` | `accepted`, `rejected`, `blocked_terminal` |
| `accepted` | `in_progress`, `blocked_terminal`, `carried_forward` |
| `in_progress` | `resolved`, `blocked_terminal`, `carried_forward` |
| `resolved` | `verified`, `reopened` |
| `reopened` | `in_progress`, `blocked_terminal`, `carried_forward` |
| `verified` | `closed` |
| `carried_forward` | `reopened` |

A queue item affected by an `accepted`, `in_progress`, `resolved`, or `reopened` reconciliation item cannot close. A run can close with `carried_forward` reconciliation only when the item records owner, risk, due trigger, affected IA list, and required evidence.

## Phase 0 Preflight

Before assigning remediation work, the coordinator must run a Phase 0 preflight. This phase is allowed to create run-control artifacts and fresh task packets. It must not start IA implementation work.

Missing run-control artifacts in a freshly selected audit run are not a terminal blocker by themselves. They are Phase 0 outputs. If compatible artifacts are absent, create fresh artifacts before dispatch; if incompatible artifacts exist, migrate or archive them as described below.

Preflight checks:

- Reconcile `ia-manifest.json`, the IA review profile map, audit JSON metadata, `docs/sitemap.md`, `docs/Wireframe/README.md`, and the source commit.
- Validate existing run-control artifacts before reuse: JSON artifacts (`remediation-run-state.json`, `write-lock-registry.json`, `reconciliation-items.json`, and `cross-ia-lifecycle-items.json`) must have a supported `schemaVersion`; task packets and result packets must contain all fields required by this split plan.
- If an existing artifact uses legacy statuses, missing required fields, or incompatible schemas, the coordinator must either migrate it with a written migration note or archive it under `<auditRunDirectory>/superseded-artifacts/<timestamp>/` and rebuild fresh artifacts before dispatch. Do not mix legacy run state with the current queue, lane, lock, reconciliation, or cross-IA schemas.
- Fail closed on metadata conflicts that affect route, audience, route type, modal host, required packs, or security evidence.
- Compare profile `humanConfirmationRequired` against manifest/audit evidence requirements. If the profile says human confirmation is not required, record `manual-review: N/A` or regenerate the manifest before queue build.
- Confirm flow-edge tooling and artifacts: `package.json` script, validator script, manifest, and result JSON.
- If flow-edge tooling is absent, mark flow-edge-dependent work as `blocked_terminal` or require the manual flow-edge evidence artifact defined below.
- Confirm required agent tools, MCP servers, plugins, and skills before dispatch. Record availability, version or source path when available, and fallback decision in the ledger.
- Confirm `ui-ux-pro-max` skill availability before assigning UX/UI review to a specific host. This is host-specific evidence, not a repository-wide skill mirror check. If the skill is missing in the active host, do not auto-install it during remediation. Route UX/UI-dependent packets to a host that has the skill, or mark those packets `blocked_terminal` unless a separate coordinator-authored tool-install packet records trusted source URL, pinned commit or release, checksum or equivalent integrity evidence, install command, installed path/version, host refresh result, and rollback or removal path. Non-UX/UI packets may continue when their own prerequisites pass.
- Discover hosted-surface triggers from source before rerunning hosted-surface browser checks.
- Verify storage-state, seeded users, admin role claims, wrong-owner fixtures, stale-token fixtures, and service-role-dependent fixtures before assigning security/navigation IA work.
- Verify environment identity before any security/data work: environment, Supabase project ref, credential type, productionAllowed flag, serviceRoleUse flag, mutationAllowed flag, and fixture provenance.
- For any IA item that touches auth, data, owner scope, storage, RBAC, admin audit, persistence, or Supabase-backed fixtures, verify `<auditRunDirectory>/supabase-fixture-manifest.json` before dispatch. If it is missing, stale, incomplete, or cannot prove the required fixture matrix for the IA profile row, classify the item as `security-fixture` or `blocked_terminal`.
- Generate fresh IA task packets. Do not reuse stale dispatch references when `agent-packets/tasks/` is absent or incomplete.
- Snapshot the initial dirty worktree and classify files as baseline dirty, run-owned, or out of scope.
- Create a Phase 0 handoff note after queue, lock, tool, cross-IA lifecycle, and packet preflight. This note is the resume point if the coordinator session dies before IA work starts.

The output of Phase 0 is `<auditRunDirectory>/remediation-run-state.json`, `<auditRunDirectory>/write-lock-registry.json`, `<auditRunDirectory>/cross-ia-lifecycle-items.json`, a Phase 0 handoff note, and fresh task packet paths.
