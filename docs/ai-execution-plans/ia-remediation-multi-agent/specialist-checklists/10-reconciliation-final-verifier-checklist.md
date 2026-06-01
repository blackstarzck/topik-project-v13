# Reconciliation Final Verifier Checklist

## Purpose

Reconcile IA execution output, specialist result packets, regenerated evidence, and ledger entries before an IA item or run is closed.

## Required Inputs

- IA task packet.
- All specialist result packets.
- Current profile row.
- Regenerated audit artifacts.
- Cross-IA lifecycle list.
- Context ledger.

## Applies When

- Closing an IA item.
- Closing a cross-IA lifecycle item.
- Producing the final run report.

## Does Not Apply When

- An IA task is still in implementation or review.

## Checklist Items

- [ ] Every required specialist either returned a packet or has a documented `N/A` reason.
- [ ] Ratings are reconciled with the shared rubric.
- [ ] The weakest material rating controls the IA closeout label.
- [ ] Regenerated JSON evidence supports the final label.
- [ ] Cross-IA impacts are `closed`, `rejected`, or `carried-forward` with owner, risk, due trigger, affected IA, and required evidence.
- [ ] Human confirmation requirements are satisfied or keep the IA open.
- [ ] Ledger decisions match current file state and command output.
- [ ] Final report lists remaining risks and untested areas.

## Detailed Checklist Matrix

### Packet Completeness

- [ ] IA task packet exists.
- [ ] IA profile row is included.
- [ ] Required packs are listed.
- [ ] Required specialists are listed.
- [ ] Required evidence is listed.
- [ ] Source docs are listed.
- [ ] Audit artifacts are listed.
- [ ] Allowed write scope is listed.
- [ ] Cross-IA impacts are listed.
- [ ] Human confirmation requirement is listed.

### Specialist Result Reconciliation

- [ ] Coordinator packet is present when orchestration is in scope.
- [ ] IA shard reviewer packet is present.
- [ ] UX/UI packet is present for visible IA.
- [ ] Form/error packet is present when input/retry/error packs apply.
- [ ] Hosted surface packet is present for hosted modal/state/toast IA.
- [ ] Security/data packet is present for auth, data, role, owner, id, PII, or storage IA.
- [ ] AI UX packet is present for writing, analysis, feedback, report, or recommendation IA.
- [ ] Ops/policy packet is present for billing, notification, email, rate-limit, audit, language, or deferred-scope IA.
- [ ] Automation owner packet is present when evidence regeneration is claimed.
- [ ] `N/A` decisions are justified by profile, pack, or route type.

### Label Decision

- [ ] Final label uses shared rubric.
- [ ] Weakest material finding controls the final decision.
- [ ] `PASS` has evidence for every required pack.
- [ ] `PARTIAL` lists exact missing evidence or behavior.
- [ ] `FAIL` cites active doc requirement and contradiction.
- [ ] `BLOCKED` cites missing env/data/permission/service/artifact.
- [ ] `DOC-GAP` cites conflicting or absent active docs.
- [ ] `DEFERRED` cites active deferred-scope docs.
- [ ] `N/A` cites profile or route-type reason.
- [ ] Label is not upgraded because of schedule pressure.

### Evidence Reconciliation

- [ ] JSON evidence supports final label.
- [ ] Markdown summary agrees with JSON evidence.
- [ ] HTML observations are confirmed or rejected.
- [ ] Screenshots/traces are from the correct IA and latest run.
- [ ] Tests or manual checks cover primary user outcome.
- [ ] Negative cases are present where required.
- [ ] Accessibility evidence is present for visible interactive IA.
- [ ] Security evidence is present for protected/data/admin IA.
- [ ] Flow-edge evidence is present for cross-IA flows.
- [ ] Human confirmation evidence is present when required.

### Cross-IA Closure

- [ ] Every cross-IA item has source and target IA.
- [ ] Every cross-IA item has state.
- [ ] Every approved item has owner.
- [ ] Every applied item has regenerated evidence.
- [ ] Every rejected item has rationale.
- [ ] No `proposed` item is silently ignored.
- [ ] No `queued-revisit` item remains without owner.
- [ ] Shared route changes triggered affected IA re-check.
- [ ] Hosted surface changes triggered host IA re-check.
- [ ] Flow-edge blockers are listed separately from page blockers.

### Final Report Quality

- [ ] Report states completion decision.
- [ ] Report lists changed files.
- [ ] Report lists docs consulted.
- [ ] Report lists verification commands and results.
- [ ] Report lists skipped checks and reasons.
- [ ] Report lists remaining risks.
- [ ] Report lists follow-up owners.
- [ ] Report uses user-readable Korean in user-facing summary.
- [ ] Report does not hide degraded review or fallback.
- [ ] Report does not claim product behavior changed when only docs changed.

## Research-Backed Detailed Checks

- [ ] Final decision lists every required pack and the specialist that covered it.
- [ ] Final decision lists every external-source-derived check that materially affected the result.
- [ ] Advisory community findings are either mapped to project evidence or excluded with rationale.
- [ ] `PASS` requires user-visible evidence for the main outcome and every required critical state.
- [ ] `PASS` requires negative-case evidence where the IA involves auth, data ownership, admin role, forms, tokens, rate limits, or irreversible actions.
- [ ] `PASS` requires keyboard/focus evidence for visible interactive IA.
- [ ] `PASS` requires host-trigger evidence for hosted surfaces.
- [ ] `PASS` requires automation or documented manual evidence that was generated after the latest relevant change.
- [ ] `PARTIAL` states the exact missing behavior or evidence and the owner.
- [ ] `BLOCKED` states the missing environment, data, permission, service, or artifact.
- [ ] `DOC-GAP` states the conflicting or absent active docs and the decision needed.
- [ ] `DEFERRED` cites the active deferred-scope source and confirms no UI overpromise.
- [ ] Reconciliation checks whether any specialist found a cross-IA impact that has not been closed, rejected, or formally marked `carried-forward`.
- [ ] Final report separates product behavior risk, evidence risk, security risk, and workflow risk.

## Rating Criteria

- `PASS`: all required packets, evidence, cross-IA items, and ledger entries reconcile.
- `PARTIAL`: the IA improved but cannot close as `PASS` because evidence or a follow-up remains.
- `FAIL`: final evidence contradicts the claimed remediation.
- `BLOCKED`: closure requires missing artifacts, data, access, or human confirmation.
- `N/A`: only for closure checks outside assigned scope.

## Required Evidence

- Specialist packet list.
- Final audit JSON reference.
- Ledger entry reference.
- Cross-IA lifecycle status.
- Verification command output.

## Result Packet Fields

- `specialistPacketCoverage`
- `finalLabel`
- `weakestMaterialRating`
- `evidenceSupport`
- `crossIaStatus`
- `closeoutDecision`

## External References

- [Shared rating rubric](./00-shared-rating-rubric.md)
- [Context and packets](../../../ai-workflow/context-and-packets.md)
- [Report template](../../../ai-workflow/templates/report-template.md)
- [Playwright best practices](https://playwright.dev/docs/best-practices)
- [WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/)
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)

## Project-Specific No-Pass Rules

- Do not close an IA item when a required specialist has not reported.
- Do not close a run when the ledger and current file state disagree.
- Do not close an IA item when external-research-derived concerns were used inconsistently across specialists.
- Do not use `carried-forward` without owner, risk, due trigger, affected IA, and required evidence.
