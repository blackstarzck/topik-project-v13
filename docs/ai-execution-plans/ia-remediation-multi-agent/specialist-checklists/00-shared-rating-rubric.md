# Shared Rating Rubric

## Purpose

Provide one rating language for every IA specialist so that review packets can be reconciled without changing the meaning of labels.

## Labels

| Label | Meaning |
| --- | --- |
| `PASS` | Current docs, implementation, and evidence agree for the assigned scope. |
| `PARTIAL` | Some required behavior or evidence exists, but one or more important requirements are incomplete. |
| `FAIL` | Active docs require behavior that is missing, wrong, unsafe, or contradicted by implementation. |
| `BLOCKED` | Verification cannot run because required environment, data, permission, service, or artifact is unavailable. |
| `N/A` | The checklist item does not apply to this IA profile and is listed in `notApplicablePacks` or justified by route type. |
| `DOC-GAP` | Active docs conflict, omit a required decision, or leave policy/security/business behavior unclear. |
| `DEFERRED` | Active docs explicitly keep the behavior out of current implementation scope. |

## Evidence Requirements

A rating must include:

- Source documents consulted.
- Implementation files, routes, tests, screenshots, traces, logs, or audit artifacts used as evidence.
- Exact requirement or pack being judged.
- Reason the rating is not a weaker label.
- Follow-up owner when the label is not `PASS` or `N/A`.

## Checklist Application Method

Every specialist must evaluate checklist items at three levels:

1. `Required`: the IA profile or required pack makes the item mandatory.
2. `Conditional`: the item applies only when the IA includes the relevant state, role, data, or interaction.
3. `N/A`: the item does not apply and the reason is recorded.

Do not delete or skip an item silently. Mark it with evidence, blocker, or `N/A` rationale.

## Evidence Depth Levels

| Level | Minimum Evidence |
| --- | --- |
| `source-only` | Active docs prove the behavior is required, deferred, or unresolved. |
| `static` | Source files, route map, profile map, or generated artifacts prove structure. |
| `automated` | Test or audit command proves a behavior or artifact. |
| `browser` | Browser, screenshot, trace, or manual QA proves visible behavior. |
| `negative-case` | A failure, invalid, unauthorized, expired, blocked, or edge path is proven. |
| `human-confirmed` | A named human confirmation artifact exists for business/policy decisions. |

`PASS` requires the strongest evidence level that the IA profile reasonably needs. For example, owner-scoped data needs negative-case evidence; visible interactive UI needs browser or equivalent user-visible evidence; deferred policy needs source-only evidence plus no-overpromise review.

## Rating Decision Order

Apply labels in this order:

1. If required evidence cannot be collected, use `BLOCKED`.
2. If active docs conflict or omit a required decision, use `DOC-GAP`.
3. If active docs explicitly defer the behavior, use `DEFERRED`.
4. If active docs require behavior that is missing or contradicted, use `FAIL`.
5. If behavior exists but required evidence or edge cases are incomplete, use `PARTIAL`.
6. Use `PASS` only when behavior, docs, and required evidence agree.
7. Use `N/A` only with a profile, pack, route-type, or state-based reason.

## Required Result Granularity

Each specialist result must include:

- Overall rating.
- Rating per checklist group.
- Rating per required pack.
- Evidence per required pack.
- `N/A` reasons per skipped group.
- Highest-risk unresolved finding.
- Cross-IA impact list.
- Recommended next owner.

## Research-Backed Evidence Checks

- [ ] Evidence proves the user-visible behavior, not only the internal implementation path.
- [ ] Evidence states whether the check was automated, browser-observed, screenshot-based, log-based, or manual.
- [ ] Accessibility evidence covers keyboard operation, focus visibility, focus order, labels, status messages, and error identification when the IA is visible.
- [ ] Form evidence covers the field-level error, page-level or section-level error summary, focus placement after submit, and preserved user input.
- [ ] Security evidence covers direct URL access, role mismatch, owner mismatch, invalid id, expired session, logout, and raw error/token exposure when applicable.
- [ ] Modal evidence covers trigger, initial focus, close route, focus return, background inertness, escape behavior, and content-heavy modal reading order.
- [ ] AI evidence covers pending state, uncertainty, result source, user feedback/control, failure recovery, and fixture-vs-real-data distinction.
- [ ] Automation evidence uses user-facing selectors or explicit contracts and avoids relying only on brittle DOM structure.
- [ ] Community or blog evidence is marked `advisory`; it cannot override project docs or official standards.
- [ ] Any checklist item imported from an external source is mapped to a project IA pack before it affects a rating.

## Must Not Pass When

- Evidence is fixture-only but the requirement needs current runtime behavior.
- The route opens but the user outcome, state behavior, access boundary, or recovery path is unproven.
- The specialist used the HTML report as the sole evidence source.
- Human confirmation is required and no explicit human confirmation exists.
- A deferred feature is described in UI as if it currently works.
- A hosted surface was reviewed without its host route and trigger path.
- A data page lacks owner, role, invalid-id, or deleted-id evidence where applicable.
- An auth page exposes raw provider errors, token values, secrets, or trusted behavior from untrusted query values.
- Accessibility was judged without keyboard-only operation for interactive IA.
- Validation was judged without checking both error discovery and error recovery.
- Automation only checks HTTP status, screenshot existence, or selector presence without user outcome evidence.
- A specialist cites external guidance as a new product requirement without mapping it to active project docs.

## Result Packet Fields

Each specialist result packet must include:

```json
{
  "iaCode": "X-00",
  "specialist": "role-name",
  "rating": "PASS",
  "scopeReviewed": [],
  "evidence": [],
  "sourceDocs": [],
  "findings": [],
  "crossIaImpacts": [],
  "requiredFollowUps": [],
  "humanConfirmationNeeded": false
}
```

## Source Priority

Use the source priority from [ia-page-implementation-verification.md](../../../ai-workflow/ia-page-implementation-verification.md). For audit outputs, use:

1. Machine-readable JSON evidence.
2. Generated markdown summaries.
3. HTML report as human-readable triage only.

If sources disagree, record the conflict as `DOC-GAP` or a reconciliation item.
