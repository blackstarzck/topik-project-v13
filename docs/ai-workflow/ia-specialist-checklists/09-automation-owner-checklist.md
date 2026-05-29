# Automation Owner Checklist

## Purpose

Own audit evidence regeneration, script readiness, artifact validation, and machine-readable proof after IA remediation.

## Required Inputs

- IA task packet.
- Current audit run directory.
- Existing audit scripts and verification commands.
- Expected output artifact paths.
- Specialist result packets that need evidence regeneration.

## Applies When

- Evidence must be regenerated after an IA fix.
- The run needs to distinguish JSON evidence, generated markdown, and HTML report observations.
- Flow-edge validation artifacts must be produced or checked.

## Does Not Apply When

- A specialist is only providing read-only judgment and no evidence refresh is requested.

## Checklist Items

- [ ] Use JSON audit evidence as the final machine-readable source.
- [ ] Use generated markdown only as a summary of machine-readable evidence.
- [ ] Use the HTML report only for human triage and issue discovery.
- [ ] Regenerate evidence after implementation changes before labels are closed.
- [ ] Validate every IA profile maps to a known IA code and route authority.
- [ ] Record missing automation as `BLOCKED` or prerequisite work, not `PASS`.
- [ ] Record command output in the ledger or result packet.
- [ ] Do not claim flow-edge remediation complete until flow-edge manifest and result artifacts exist.

## Detailed Checklist Matrix

### Artifact Freshness

- [ ] Audit run directory is current for the remediation pass.
- [ ] JSON evidence was generated after the latest relevant source/doc change.
- [ ] Markdown summary was generated from the same JSON run.
- [ ] HTML report was generated from the same run.
- [ ] Artifact timestamps or run ids are recorded.
- [ ] Stale artifacts are not used for final labels.
- [ ] Missing artifact is labeled `BLOCKED`.
- [ ] Regenerated artifact path is recorded in ledger.
- [ ] Failed generation command output is recorded.
- [ ] Manual evidence fallback is explicitly labeled when automation is absent.

### JSON And Profile Validation

- [ ] Audit JSON parses.
- [ ] Audit JSON includes every current IA code.
- [ ] Audit JSON does not include stale IA codes as current failures.
- [ ] IA profile map includes every current IA code.
- [ ] Every profile route exists in sitemap or is documented as hosted/special.
- [ ] Every profile required pack exists in verification procedure.
- [ ] Every required specialist path exists.
- [ ] Every required evidence field is known to the automation owner.
- [ ] Label values are from the shared rubric.
- [ ] JSON evidence controls final label over HTML report.

### Browser/Test Evidence

- [ ] Tests use accessible role, label, visible text, or explicit stable test contract.
- [ ] Tests avoid brittle CSS/layout-only selectors where possible.
- [ ] Tests assert user-visible outcome.
- [ ] Tests assert blocked/error/empty state when required.
- [ ] Tests assert auth/role state when required.
- [ ] Tests assert owner/id negative case when required.
- [ ] Tests assert modal trigger and focus behavior when required.
- [ ] Tests assert cooldown/rate-limit state when required.
- [ ] Tests assert no duplicate side effect when required.
- [ ] Tests capture console errors for browser QA.

### Flow-Edge Evidence

- [ ] Flow-edge manifest exists when page-to-page remediation is claimed.
- [ ] Flow-edge result artifact exists when page-to-page remediation is claimed.
- [ ] Source IA, target IA, route, trigger, and expected state are listed.
- [ ] Hosted modal flow edges include host route and trigger.
- [ ] Writing-to-analysis-to-feedback flow is covered when writing IA changes.
- [ ] Auth callback/error/verify flow is covered when auth IA changes.
- [ ] Admin flow edges are covered with role-specific storage state where available.
- [ ] Broken or absent flow-edge tooling is recorded as `BLOCKED` or manual fallback.

### Evidence Packaging

- [ ] Result packet lists commands run.
- [ ] Result packet lists artifacts generated.
- [ ] Result packet lists skipped checks and reason.
- [ ] Result packet lists known blockers.
- [ ] Result packet lists residual risk.
- [ ] Screenshot paths are stable and tied to IA code.
- [ ] Trace paths are stable and tied to IA code.
- [ ] Logs are redacted before being linked.
- [ ] Evidence bundle can be replayed or independently inspected.
- [ ] Evidence does not include secrets or unnecessary PII.

### Automation Ownership

- [ ] Owner knows which script creates each artifact.
- [ ] Owner knows which script validates each artifact.
- [ ] Owner records missing scripts as prerequisites.
- [ ] Owner does not patch audit labels by hand.
- [ ] Owner separates automation bug from product bug.
- [ ] Owner files profile-map inconsistency separately from implementation failure.
- [ ] Owner verifies docs-only checklist changes with static checks.
- [ ] Owner verifies implementation remediation with runtime/browser checks where applicable.

## Research-Backed Detailed Checks

- [ ] Tests assert user-visible behavior, role/name text, status, and outcome instead of private component structure.
- [ ] Locators prefer accessible roles, labels, visible names, and explicit test contracts.
- [ ] Tests use web-first assertions for visibility, text, enabled/disabled, URL, and state changes.
- [ ] Each IA evidence run is isolated from previous state or documents the shared fixture dependency.
- [ ] Auth, owner, admin, and role fixtures are named and scoped so cross-user tests cannot accidentally reuse the same account.
- [ ] Negative cases exist for invalid id, unauthorized id, expired session, logout, network failure, and rate limit when packs require them.
- [ ] Browser evidence includes console error capture when user-facing route behavior is checked.
- [ ] Screenshot evidence is paired with a semantic assertion, not used alone.
- [ ] HTML reports are regenerated after JSON evidence and include the same run id.
- [ ] Audit JSON parsing is checked before the result is trusted.
- [ ] Generated markdown summaries include source artifact paths and do not introduce labels absent from JSON.
- [ ] Flow-edge manifests list route, trigger, source IA, target IA, and expected state transfer.
- [ ] Soft assertions may collect multiple IA evidence gaps, but final status fails when any required assertion fails.
- [ ] Community testing advice is recorded only as structure guidance; official Playwright docs control automation rules.

## Rating Criteria

- `PASS`: scripts ran, artifacts exist, JSON parses, and evidence supports the label.
- `PARTIAL`: some evidence refreshed but one non-critical artifact or summary is missing.
- `FAIL`: automation reports contradictions, invalid profiles, missing IA rows, or stale labels.
- `BLOCKED`: required script, environment, data, or artifact generator is unavailable.
- `N/A`: no automation or evidence refresh is in scope.

## Required Evidence

- Command output.
- JSON parse result.
- Artifact paths.
- Profile validation result.
- Flow-edge artifact status when relevant.

## Result Packet Fields

- `commandsRun`
- `artifactsGenerated`
- `jsonValidation`
- `profileValidation`
- `flowEdgeArtifacts`
- `blockedAutomation`

## External References

- [IA verification procedure](../ia-page-implementation-verification.md)
- [Review gates](../review-gates.md)
- [Playwright best practices](https://playwright.dev/docs/best-practices)
- [Playwright locators](https://playwright.dev/docs/locators)
- [Reddit QA Playwright framework discussion](https://www.reddit.com/r/QualityAssurance/comments/1248csz/playwright_framework_best_practicesstructure/)

## Project-Specific No-Pass Rules

- Do not pass a remediated IA if the final label is based only on stale audit output.
- Do not pass flow-edge remediation while the validation script or result artifact is absent.
- Do not pass automation evidence that only proves route availability without proving the IA user outcome.
